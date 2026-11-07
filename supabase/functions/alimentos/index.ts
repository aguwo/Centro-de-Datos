// Edge Function "alimentos" (paso 72): busca alimentos con sus macros en Open Food Facts, la base libre de
// alimentos y productos (https://world.openfoodfacts.org). La web no le puede preguntar directo (Open Food Facts
// no deja que otras páginas lo llamen desde el navegador), así que pregunta aquí y esta función le pregunta a ella.
//   entra   { q: "arroz" }
//   sale    [{ codigo, nombre, marca, kcal_100g, prot_100g, carb_100g, grasa_100g, porcion_g }, ...]
// Primero los productos que se venden en Chile; si son pocos, se completan con los del resto del mundo.
// Solo vuelven los que traen calorías y macros que cuadran entre sí (4 kcal por gramo de proteína y de carbohidrato,
// 9 por gramo de grasa): los datos los suben personas y algunos vienen mal. Pide sesión (la llama la web con la tuya).
const BUSCAR = "https://search.openfoodfacts.org/search";
const CAMPOS = "code,product_name,product_name_es,brands,nutriments,serving_quantity";
const CUANTOS = 8;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };

const redondo = (x: unknown) => (typeof x === "number" && isFinite(x) ? Math.round(x * 10) / 10 : null);
function limpio(p: any) {
  const n = p.nutriments ?? {};
  return {
    codigo: p.code, nombre: (p.product_name_es || p.product_name || "").trim(), marca: [p.brands ?? []].flat()[0] ?? null,
    kcal_100g: redondo(n["energy-kcal_100g"]), prot_100g: redondo(n.proteins_100g), carb_100g: redondo(n.carbohydrates_100g),
    grasa_100g: redondo(n.fat_100g), porcion_g: redondo(Number(p.serving_quantity)) || null,
  };
}
function cuadra(x: any) {
  if ([x.kcal_100g, x.prot_100g, x.carb_100g, x.grasa_100g].some((v) => v === null)) return false;
  const calculadas = 4 * x.prot_100g + 4 * x.carb_100g + 9 * x.grasa_100g;
  return Math.abs(x.kcal_100g - calculadas) <= Math.max(15, x.kcal_100g * 0.2);
}
async function buscar(q: string) {
  const r = await fetch(`${BUSCAR}?${new URLSearchParams({ q, langs: "es", page_size: "24", fields: CAMPOS })}`);
  if (!r.ok) throw new Error(`Open Food Facts respondió ${r.status}`);
  return ((await r.json()).hits ?? []).map(limpio).filter((x: any) => x.nombre && cuadra(x));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const q = String((await req.json()).q ?? "").trim().slice(0, 80).replace(/["\\:]/g, " ");
    if (q.length < 2) return Response.json([], { headers: CORS });
    const chile = await buscar(`${q} countries_tags:"en:chile"`);
    const todos = chile.length >= CUANTOS ? chile : [...chile, ...(await buscar(q)).filter((x: any) => !chile.some((c: any) => c.codigo === x.codigo))];
    return Response.json(todos.slice(0, CUANTOS), { headers: CORS });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 502, headers: CORS });
  }
});
