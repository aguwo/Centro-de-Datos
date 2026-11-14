// Edge Function "eva" (paso 56): copia de EV@ (Moodle de la UCSC), solo lectura, dos veces al día.
// La llama la base sola (pg_cron, migración 0019) con una clave que solo la base conoce. Hace cuatro cosas:
//   1. busca tus ramos que dicen su curso de EV@ (propiedad «Curso en EV@» del ramo)
//   2. le pregunta a EV@ las entregas y los cuestionarios (paso 115) de esos cursos y si ya los hiciste
//   3. aplica plan.ts: crea las tareas que faltan, mueve fechas y marca las hechas
//   4. (paso 115) guarda en cada ramo la lista de su material (props.material) y cuándo fue la copia (props.eva_al_dia)
// Secretos (supabase secrets set): EVA_TOKEN, el token de tu EV@. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { plan, material, type Pendiente } from "./plan.ts";

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
    .eq("tipos.clave", "ramo").eq("archivado", false).not("props->>eva", "is", null)) as any[])
    .map((r) => ({ id: r.id, owner_id: r.owner_id, props: r.props, eva: Number(r.props.eva) }));
  if (!ramos.length) return Response.json({ ramos: 0 });

  // 2. Entregas y cuestionarios de esos cursos. Solo se pregunta si ya los hiciste para los que vencen desde hace un mes.
  const cursos = [...new Set(ramos.map((r) => r.eva))];
  const params = Object.fromEntries(cursos.map((c, i) => [`courseids[${i}]`, c]));
  const reciente = (vence: string | null) => !!vence && Date.parse(vence) > Date.now() - 30 * 864e5;
  const fecha = (segundos: number) => (segundos ? new Date(segundos * 1000).toISOString() : null);
  const pendientes: Pendiente[] = [];
  for (const c of (await eva("mod_assign_get_assignments", params)).courses) {
    for (const a of c.assignments) {
      const vence = fecha(a.duedate);
      let hecha = false;
      if (reciente(vence)) {
        const s = (await eva("mod_assign_get_submission_status", { assignid: a.id })).lastattempt ?? {};
        hecha = (s.submission ?? s.teamsubmission)?.status === "submitted";
      }
      pendientes.push({ clave: `assign:${a.id}`, curso: c.id, titulo: `Entregar ${a.name.trim()}`, vence, hecha, enlace: `${EVA}/mod/assign/view.php?id=${a.cmid}` });
    }
  }
  // Los cuestionarios: EV@ solo devuelve los que puedes ver (no los de la otra sección). Hecho = un intento terminado.
  for (const q of (await eva("mod_quiz_get_quizzes_by_courses", params)).quizzes) {
    const vence = fecha(q.timeclose);
    const hecha = reciente(vence) && (await eva("mod_quiz_get_user_attempts", { quizid: q.id, status: "finished" })).attempts.length > 0;
    pendientes.push({ clave: `quiz:${q.id}`, curso: q.course, titulo: `Responder ${q.name.trim()}`, vence, hecha, enlace: `${EVA}/mod/quiz/view.php?id=${q.coursemodule}` });
  }

  // 3. Lo que ya está en el centro de datos, y el plan
  const tareas = (revisar(await db.from("nodos").select("id, fecha, estado, props, tipos!inner(clave)")
    .eq("tipos.clave", "tarea").not("props->>eva", "is", null)) as any[])
    .map((t) => ({ id: t.id, fecha: t.fecha, estado: t.estado, eva: t.props.eva }));
  const p = plan(pendientes, ramos, tareas);

  for (const { ramo_id, ...t } of p.crear) {
    // El tipo "tarea" de esa persona (si tiene su copia) o la plantilla.
    const [tipo] = revisar(await db.from("tipos").select("id").eq("clave", "tarea")
      .or(`owner_id.eq.${t.owner_id},owner_id.is.null`).order("owner_id", { nullsFirst: false }).limit(1)) as any[];
    const nodo = revisar(await db.from("nodos").insert({ ...t, tipo_id: tipo.id }).select("id").single()) as any;
    revisar(await db.from("conexiones").insert({ owner_id: t.owner_id, origen_id: nodo.id, relacion: "trata_sobre", destino_id: ramo_id }));
  }
  for (const { id, ...cambio } of p.cambiar) revisar(await db.from("nodos").update(cambio).eq("id", id));

  // 4. El material de cada curso, guardado en sus ramos junto con la hora de esta copia (la web avisa si se queda vieja).
  const al_dia = new Date().toISOString();
  for (const curso of cursos) {
    const lista = material(await eva("core_course_get_contents", { courseid: curso }));
    for (const r of ramos.filter((x) => x.eva === curso))
      revisar(await db.from("nodos").update({ props: { ...r.props, material: lista, eva_al_dia: al_dia } }).eq("id", r.id));
  }
  return Response.json({ ramos: ramos.length, pendientes: pendientes.length, creadas: p.crear.length, cambiadas: p.cambiar.length });
});
