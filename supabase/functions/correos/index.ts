// Edge Function "correos" (paso 88): los avisos de BancoEstado se anotan solos.
// La llama el script de Google (correos/Codigo.gs) que corre en cada Gmail tuyo cada 15 minutos,
// con la clave CORREOS_CLAVE (supabase secrets set). Por cada correo:
//   1. leer.ts saca qué fue (compra, transferencia enviada o recibida) y cuánto
//   2. si ya se anotó ese mismo correo, no hace nada (props.correo = su id en Gmail)
//   3. lo anota en tu cuenta del día a día; la categoría la copia del último gasto con el mismo nombre
//      (si nunca lo categorizaste, queda «por revisar» en Finanzas y lo eliges con un toque)
import { createClient } from "npm:@supabase/supabase-js@2";
import { leer } from "./leer.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const revisar = <T>({ data, error }: { data: T; error: unknown }) => { if (error) throw error; return data; };

Deno.serve(async (req) => {
  const clave = Deno.env.get("CORREOS_CLAVE");
  if (!clave || req.headers.get("x-clave") !== clave) return new Response("No autorizado", { status: 401 });
  const { id, asunto = "", texto = "", fecha } = await req.json();
  const m = leer(asunto, texto);
  if (!id || !m) return Response.json({ entendido: false });

  // La cuenta del día a día: la que no es de ahorro ni Junaeb (como en la web).
  const cuentas = revisar(await db.from("nodos").select("id, owner_id, titulo, tipos!inner(clave)").eq("tipos.clave", "cuenta").eq("archivado", false)
    .order("creado_en")) as any[];
  const cuenta = cuentas.find((c) => !/ahorro|junaeb/i.test(c.titulo)) ?? cuentas[0];
  if (!cuenta) return Response.json({ entendido: true, anotado: false, motivo: "no hay cuentas" });

  const ya = revisar(await db.from("registros").select("id").eq("owner_id", cuenta.owner_id).eq("props->>correo", id).limit(1)) as any[];
  if (ya.length) return Response.json({ entendido: true, anotado: false, motivo: "ya estaba" });

  const [antes] = m.clase === "gasto" ? revisar(await db.from("registros").select("otro_id").eq("owner_id", cuenta.owner_id)
    .eq("clase", "gasto").eq("titulo", m.titulo).not("otro_id", "is", null).order("fecha", { ascending: false }).limit(1)) as any[] : [];
  revisar(await db.from("registros").insert({ owner_id: cuenta.owner_id, clase: m.clase, titulo: m.titulo, valor: m.valor, unidad: "CLP",
    fecha: fecha ?? new Date().toISOString(), nodo_id: cuenta.id, otro_id: antes?.otro_id ?? null,
    props: { correo: id, notas: `${asunto}\n${texto}`.slice(0, 600) } }));
  return Response.json({ entendido: true, anotado: true, ...m });
});
