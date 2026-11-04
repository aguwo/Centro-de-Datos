// Edge Function "eva" (paso 56): copia de EV@ (Moodle de la UCSC), solo lectura, dos veces al día.
// La llama la base sola (pg_cron, migración 0019) con una clave que solo la base conoce. Hace tres cosas:
//   1. busca tus ramos que dicen su curso de EV@ (propiedad «Curso en EV@» del tópico)
//   2. le pregunta a EV@ las entregas de esos cursos y si ya entregaste cada una
//   3. aplica plan.ts: crea las tareas que faltan, mueve fechas y marca las entregadas
// Secretos (supabase secrets set): EVA_TOKEN, el token de tu EV@. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { plan, type Entrega } from "./plan.ts";

const EVA = "https://uvirtual2.ucsc.cl";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function eva(funcion: string, params: Record<string, string | number> = {}) {
  const cuerpo = new URLSearchParams({ wstoken: Deno.env.get("EVA_TOKEN")!, moodlewsrestformat: "json", wsfunction: funcion });
  for (const [k, v] of Object.entries(params)) cuerpo.set(k, String(v));
  const r = await (await fetch(`${EVA}/webservice/rest/server.php`, { method: "POST", body: cuerpo })).json();
  if (r?.exception) throw new Error(`EV@ ${funcion}: ${r.message}`);
  return r;
}
const revisar = <T>({ data, error }: { data: T; error: unknown }) => { if (error) throw error; return data; };

Deno.serve(async (req) => {
  const ok = revisar(await db.rpc("eva_clave_ok", { clave: req.headers.get("x-clave") ?? "" }));
  if (!ok) return new Response("No autorizado", { status: 401 });

  // 1. Ramos con curso de EV@
  const ramos = (revisar(await db.from("nodos").select("id, owner_id, props, tipos!inner(clave)")
    .eq("tipos.clave", "topico").eq("archivado", false).not("props->>eva", "is", null)) as any[])
    .map((r) => ({ id: r.id, owner_id: r.owner_id, eva: Number(r.props.eva) }));
  if (!ramos.length) return Response.json({ ramos: 0 });

  // 2. Entregas de esos cursos. Solo se pregunta si entregaste las que vencen desde hace un mes en adelante.
  const cursos = [...new Set(ramos.map((r) => r.eva))];
  const params = Object.fromEntries(cursos.map((c, i) => [`courseids[${i}]`, c]));
  const hace30 = Date.now() - 30 * 864e5;
  const entregas: Entrega[] = [];
  for (const c of (await eva("mod_assign_get_assignments", params)).courses) {
    for (const a of c.assignments) {
      const vence = a.duedate ? new Date(a.duedate * 1000).toISOString() : null;
      let entregada = false;
      if (vence && Date.parse(vence) > hace30) {
        const s = (await eva("mod_assign_get_submission_status", { assignid: a.id })).lastattempt ?? {};
        entregada = (s.submission ?? s.teamsubmission)?.status === "submitted";
      }
      entregas.push({ id: a.id, curso: c.id, nombre: a.name.trim(), vence, entregada, enlace: `${EVA}/mod/assign/view.php?id=${a.cmid}` });
    }
  }

  // 3. Lo que ya está en el centro de datos, y el plan
  const tareas = (revisar(await db.from("nodos").select("id, fecha, estado, props, tipos!inner(clave)")
    .eq("tipos.clave", "tarea").not("props->>eva", "is", null)) as any[])
    .map((t) => ({ id: t.id, fecha: t.fecha, estado: t.estado, eva: t.props.eva }));
  const p = plan(entregas, ramos, tareas);

  for (const { ramo_id, ...t } of p.crear) {
    // El tipo "tarea" de esa persona (si tiene su copia) o la plantilla.
    const [tipo] = revisar(await db.from("tipos").select("id").eq("clave", "tarea")
      .or(`owner_id.eq.${t.owner_id},owner_id.is.null`).order("owner_id", { nullsFirst: false }).limit(1)) as any[];
    const nodo = revisar(await db.from("nodos").insert({ ...t, tipo_id: tipo.id }).select("id").single()) as any;
    revisar(await db.from("conexiones").insert({ owner_id: t.owner_id, origen_id: nodo.id, relacion: "trata_sobre", destino_id: ramo_id }));
  }
  for (const { id, ...cambio } of p.cambiar) revisar(await db.from("nodos").update(cambio).eq("id", id));
  return Response.json({ ramos: ramos.length, entregas: entregas.length, creadas: p.crear.length, cambiadas: p.cambiar.length });
});
