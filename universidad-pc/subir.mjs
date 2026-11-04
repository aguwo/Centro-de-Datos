// Sube al centro de datos lo que leer.mjs sacó del portal (paso 50): las notas nuevas y la asistencia de cada clase.
// Se puede correr todas las veces que quieras: lo que ya está igual no se vuelve a escribir, y nada se duplica.
//
//   plan(portal, base)        compara y dice qué hay que cambiar. No sabe de internet: así se puede probar solo.
//   subir(portal, conexion)   trae tus datos, calcula el plan y lo escribe con tu sesión (Row Level Security igual que en la web).
//
// Cómo se emparejan las cosas, porque el portal y el centro de datos no las escriben igual:
//   ramo        «BASES DE DATOS» = «Base de Datos»: se comparan las palabras sin tildes, sin «de/y/la…» y por sus 4 primeras letras
//   evaluación  igual que el ramo, con lo que va antes de « — » («Certamen 1 — Base de Datos» = «Certamen 1»),
//               solo entre los eventos del ramo que no se repiten (las clases sí se repiten)
//   clase       por su fecha y hora. Si ese día ya anotaste a mano si fuiste, se corrige esa anotación en vez de agregar otra.
//               Solo las de días anteriores a hoy: el portal ya lista las clases que vienen (con «-», como si faltaras)
//               y no las cuenta hasta que el profesor pasa la lista. Lo que se subió del portal y ya no calza, se borra.
// Lo que no encuentra pareja no se crea solo (podría quedar repetido con otro nombre): se avisa, y se arregla
// cambiándole el nombre al evento para que se parezca al del portal.
export const ZONA = "America/Santiago";

const VACIAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "a"]);
export const clave = (titulo) => titulo.split(" — ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .split(/[^a-z0-9]+/).filter((p) => p && !VACIAS.has(p)).map((p) => p.slice(0, 4)).sort().join(" ");

// "2026-08-06T10:10" (hora de Chile) -> instante en UTC. Sin hora, a mediodía.
export function instante(local) {
  const supuesto = Date.parse((local.length > 10 ? local : local + "T12:00") + ":00Z");
  const enChile = Date.parse(new Date(supuesto).toLocaleString("sv-SE", { timeZone: ZONA }).replace(" ", "T") + "Z");
  return new Date(2 * supuesto - enChile).toISOString();
}
const diaEnChile = (fecha) => new Date(fecha).toLocaleDateString("sv-SE", { timeZone: ZONA });

/**
 * portal: los ramos de leerNotas(). base: { ramos, eventos, asistencias } del centro de datos
 * (ramos = tópicos con semestre; eventos con padre_id = su ramo; asistencias = registros con nodo_id = su ramo).
 */
export function plan(portal, { ramos, eventos, asistencias }, hoy = diaEnChile(new Date())) {
  const p = { notas: [], nuevas: [], cambios: [], borrar: [], sinRamo: [], sinEvaluacion: [] };
  const porSemestre = [...ramos].sort((a, b) => String(b.props?.semestre).localeCompare(String(a.props?.semestre)));
  for (const r of portal) {
    const ramo = porSemestre.find((x) => clave(x.titulo) === clave(r.nombre));
    if (!ramo) { p.sinRamo.push(r.nombre); continue; }

    const suyos = eventos.filter((e) => e.padre_id === ramo.id && !e.props?.repite);
    for (const ev of r.evaluaciones.filter((e) => e.nota !== null)) {
      const e = suyos.find((x) => clave(x.titulo) === clave(ev.nombre));
      if (!e) p.sinEvaluacion.push({ ramo: ramo.titulo, nombre: ev.nombre, nota: ev.nota });
      else if (e.props?.nota !== ev.nota || e.props?.portal !== ev.nombre) // portal = su nombre allá, y la marca de que no se edita a mano
        p.notas.push({ id: e.id, titulo: e.titulo, props: { ...e.props, nota: ev.nota, portal: ev.nombre } });
    }

    const libres = asistencias.filter((a) => a.nodo_id === ramo.id);
    for (const c of r.asistencia.clases.filter((c) => c.fecha.slice(0, 10) < hoy)) {
      const fecha = instante(c.fecha), valor = c.fui ? 1 : 0, props = { portal: c.descripcion };
      const i = libres.findIndex((a) => Date.parse(a.fecha) === Date.parse(fecha));
      const j = i >= 0 ? i : libres.findIndex((a) => !a.props?.portal && diaEnChile(a.fecha) === diaEnChile(fecha));
      if (j < 0) { p.nuevas.push({ clase: "asistencia", nodo_id: ramo.id, fecha, valor, props }); continue; }
      const [a] = libres.splice(j, 1); // una anotación sirve para una sola clase
      if (Number(a.valor) !== valor || i < 0) p.cambios.push({ id: a.id, fecha, valor, props: { ...a.props, ...props } });
    }
    p.borrar.push(...libres.filter((a) => a.props?.portal).map((a) => a.id)); // las anotaciones a mano se quedan
  }
  return p;
}

// ---------- con internet ----------
// conexion = { url, llave, token }: la dirección de Supabase, la llave pública (docs/config.js) y tu sesión.
async function pedir({ url, llave, token }, ruta, { method = "GET", body } = {}) {
  const res = await fetch(`${url}/rest/v1/${ruta}`, {
    method, body: body && JSON.stringify(body),
    headers: { apikey: llave, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`${method} ${ruta.split("?")[0]}: ${res.status} ${await res.text()}`);
  return method === "GET" ? res.json() : null;
}

export async function subir(portal, conexion) {
  const nodos = (clave) => pedir(conexion, `nodos?select=id,titulo,props,tipos!inner(clave)&tipos.clave=eq.${clave}&archivado=eq.false`);
  const ramos = (await nodos("topico")).filter((r) => r.props?.semestre);
  const ids = ramos.map((r) => r.id).join(",");
  const [eventos, arbol, asistencias] = await Promise.all([
    nodos("evento"),
    pedir(conexion, `arbol?select=id,padre_id&padre_id=in.(${ids})`),
    pedir(conexion, `registros?select=id,fecha,valor,nodo_id,props&clase=eq.asistencia&nodo_id=in.(${ids})`),
  ]);
  const padre = new Map(arbol.map((a) => [a.id, a.padre_id]));
  const p = plan(portal, { ramos, eventos: eventos.map((e) => ({ ...e, padre_id: padre.get(e.id) })), asistencias });

  for (const n of p.notas) await pedir(conexion, `nodos?id=eq.${n.id}`, { method: "PATCH", body: { props: n.props } });
  if (p.nuevas.length) await pedir(conexion, "registros", { method: "POST", body: p.nuevas });
  for (const { id, ...cambio } of p.cambios) await pedir(conexion, `registros?id=eq.${id}`, { method: "PATCH", body: cambio });
  if (p.borrar.length) await pedir(conexion, `registros?id=in.(${p.borrar.join(",")})`, { method: "DELETE" });
  return p;
}
