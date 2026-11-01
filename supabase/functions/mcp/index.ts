// Punto de entrada de la Edge Function "mcp" (Deno).
// URL pública: https://<proyecto>.supabase.co/functions/v1/mcp
import { createClient } from "npm:@supabase/supabase-js@2";
import { atenderPost } from "./servidor.ts";
import { crearRepositorio } from "./repositorio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function urlPublica(req: Request): string {
  const u = new URL(req.url);
  return `${SUPABASE_URL}/functions/v1${u.pathname.replace(/^\/functions\/v1/, "").replace(/\/\.well-known.*$/, "")}`;
}

// Metadatos OAuth (RFC 9728): le dicen al cliente MCP (por ejemplo Claude) dónde iniciar sesión.
function metadatosRecurso(req: Request): Response {
  return Response.json({
    resource: urlPublica(req),
    authorization_servers: [`${SUPABASE_URL}/auth/v1`],
    bearer_methods_supported: ["header"],
  });
}

function noAutorizado(req: Request): Response {
  const meta = `${urlPublica(req)}/.well-known/oauth-protected-resource`;
  return new Response(JSON.stringify({ error: "Se necesita iniciar sesión" }), {
    status: 401,
    headers: { "content-type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${meta}"` },
  });
}

Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);
  if (pathname.includes("/.well-known/oauth-protected-resource")) return metadatosRecurso(req);

  if (req.method === "GET") return new Response("Usa POST (MCP Streamable HTTP)", { status: 405 });
  if (req.method === "DELETE") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return noAutorizado(req);

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return noAutorizado(req);

  return atenderPost(req, crearRepositorio(db));
});
