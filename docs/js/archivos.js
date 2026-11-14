// Paso 101: Archivos, un explorador donde todo tu árbol es una carpeta.
// Sirve para llegar a cualquier rama (Botánica, Conocimiento Personal, Por leer...), aunque no tenga apartado propio.
//   carpeta  lo que puede contener cosas (su tipo tiene "nivel" en la base: área, tópico, proyecto, objetivo...)
//            o cualquier nodo al que ya le metiste algo. No hay una lista por rama: sale del árbol de la base.
//   archivo  todo lo demás. Tocarlo abre su ficha (el panel de siempre, panel.js) para verlo y editarlo.
// Sus dos widgets comparten ctx.carpeta (widgets.js): el id de la carpeta abierta, o nada para ver la raíz.
//   arbol-carpetas  (costado) las carpetas como árbol, que se abren y cierran
//   carpeta         la carpeta abierta: dónde está, sus carpetas en tarjetas y sus archivos agrupados por tipo
import { el, datos, colorDe, colorDeProyecto, cajasDe, sinTildes, irA } from "./base.js";
import { mostrarPanel, formulario } from "./panel.js";
import { icono, insignia } from "./dibujos.js";

// ---------- El árbol ----------
// Lo que hay directo dentro de cada carpeta (null = la raíz: lo que no está dentro de nada).
// Se calcula una vez por cada carga de datos.
let cache = { de: null, hijos: new Map() };
function hijosDe(id = null) {
  if (cache.de !== datos.nodos) {
    const hijos = new Map();
    for (const n of datos.nodos) {
      const p = datos.padre.get(n.id) ?? null;
      if (!hijos.has(p)) hijos.set(p, []);
      hijos.get(p).push(n);
    }
    for (const lista of hijos.values()) lista.sort(enOrden);
    cache = { de: datos.nodos, hijos };
  }
  return cache.hijos.get(id) ?? [];
}
const tipoDe = (n) => datos.tipo.get(n.tipos.clave);
const esCarpeta = (n) => tipoDe(n)?.nivel != null || hijosDe(n.id).length > 0;
// Primero lo más general (áreas, luego tópicos...), después el orden que elegiste (props.orden) y al final por nombre.
const enOrden = (a, b) => (tipoDe(a)?.orden ?? 999) - (tipoDe(b)?.orden ?? 999)
  || (a.props?.orden ?? Infinity) - (b.props?.orden ?? Infinity) || a.titulo.localeCompare(b.titulo, "es");
const carpetasDe = (id) => hijosDe(id).filter(esCarpeta);
const archivosDe = (id) => hijosDe(id).filter((n) => !esCarpeta(n));
// Todo lo que hay dentro, a cualquier profundidad (para buscar).
const todoDentro = (id) => hijosDe(id).flatMap((n) => [n, ...todoDentro(n.id)]);

// ---------- Cómo se ve cada cosa ----------
// El ícono de cada tipo; uno propio (props.icono) gana. Un tipo nuevo sin ícono sale con puntos.
const ICONO = { area: "carpeta", topico: "libro", proyecto: "proyecto", objetivo: "objetivo", categoria: "monedas", rutina: "reloj",
  tarea: "si", nota: "lista", evento: "calendario", habito: "repetir", planta: "hoja", recurso: "libro", alimento: "manzana",
  receta: "plato", cuenta: "billetera", suscripcion: "repetir", hito: "estrella" };
const iconoDe = (n) => n.props?.icono ?? ICONO[n.tipos.clave] ?? "puntos";
// Una carpeta usa el color de su proyecto o ramo (el que le elegiste, o uno suyo); un archivo, el de su tipo.
const colorDeCarpeta = (n) => (n ? colorDeProyecto(n.id) : "var(--acento)");
// «2 carpetas · 14 cosas»
const cuantas = (k, uno, varios) => k && `${k} ${k === 1 ? uno : varios}`;
const resumen = (id) => [cuantas(carpetasDe(id).length, "carpeta", "carpetas"), cuantas(archivosDe(id).length, "cosa", "cosas")].filter(Boolean).join(" · ") || "Vacía";

// Si una carpeta tiene su propio apartado, se puede ir a verla completa allá.
const SU_APARTADO = [
  [(n) => n.tipos.clave === "proyecto", "Proyectos", (n) => irA("proyectos", { caja: n.id })],
  [(n) => n.tipos.clave === "topico" && n.props?.semestre, "Universidad", (n) => irA("universidad", { ramo: n.id })],
];

// La carpeta abierta (o nada = la raíz). Si la borraron o archivaron, se vuelve a la raíz.
const abierta = (ctx) => datos.nodo.get(ctx.carpeta) ?? null;
const entrar = (ctx, id) => ctx.cambiar({ carpeta: id ?? null, buscar: "" });

// ---------- El árbol del costado ----------
// Cada carpeta con su flechita para abrirla o cerrarla. Las carpetas del camino a la abierta se abren solas.
export function arbolDeCarpetas(v, ctx) {
  const abiertas = new Set(); // las carpetas abiertas en el árbol
  let ultima; // la carpeta que estaba abierta al dibujar la vez anterior
  const lista = el("ul", { className: "arbol-carpetas" });
  v.append(lista);
  return dibujar;

  function dibujar() {
    const actual = abierta(ctx);
    if (actual?.id !== ultima) for (const c of actual ? cajasDe(actual.id) : []) abiertas.add(c); // al entrar a una, se abre su camino
    ultima = actual?.id;
    const fila = (n, nivel) => {
      const subs = carpetasDe(n.id), abierto = abiertas.has(n.id);
      const flecha = subs.length ? el("button", { className: "flecha-arbol", ariaLabel: (abierto ? "Cerrar " : "Abrir ") + n.titulo, ariaExpanded: String(abierto),
        onclick: () => { abiertas[abierto ? "delete" : "add"](n.id); dibujar(); } }) : el("span", { className: "flecha-arbol" });
      const boton = el("button", { className: "nombre-arbol", ariaCurrent: String(n.id === actual?.id), onclick: () => entrar(ctx, n.id) },
        icono(iconoDe(n)), el("span", { textContent: n.titulo }));
      boton.style.setProperty("--c", colorDeCarpeta(n));
      const li = el("li", {}, el("div", { className: "fila-arbol" }, flecha, boton));
      li.style.setProperty("--nivel", nivel);
      return abierto ? [li, ...subs.flatMap((s) => fila(s, nivel + 1))] : [li];
    };
    const raiz = el("button", { className: "nombre-arbol raiz", ariaCurrent: String(!actual), onclick: () => entrar(ctx, null) }, icono("carpeta"), el("span", { textContent: "Todo" }));
    lista.replaceChildren(el("li", {}, el("div", { className: "fila-arbol" }, raiz)), ...carpetasDe(null).flatMap((n) => fila(n, 0)));
  }
}

// ---------- La carpeta abierta ----------
export function carpetaAbierta(v, ctx) {
  const ruta = el("nav", { className: "ruta-carpeta", ariaLabel: "Dónde estás" });
  const cabeza = el("div", { className: "cabeza-carpeta" });
  const buscar = el("input", { type: "search", placeholder: "Buscar aquí y en lo de adentro…", ariaLabel: "Buscar en esta carpeta" });
  const cuerpo = el("div", { className: "cuerpo-carpeta" });
  v.append(ruta, cabeza, el("div", { className: "herramientas-carpeta" }, buscar), cuerpo);
  buscar.oninput = () => { ctx.buscar = buscar.value; dibujar(); };
  return dibujar;

  function dibujar() {
    const n = abierta(ctx), id = n?.id ?? null;
    if (buscar.value !== (ctx.buscar ?? "")) buscar.value = ctx.buscar ?? "";

    // Dónde estás: Todo › Universidad › Base de Datos. Cada paso se puede tocar para volver ahí. En la raíz no se ve.
    ruta.hidden = !n;
    if (n) ruta.replaceChildren(...[null, ...cajasDe(id).reverse()].flatMap((p) => [
      el("button", { textContent: p ? datos.nodo.get(p).titulo : "Todo", onclick: () => entrar(ctx, p) }), el("span", { ariaHidden: "true", textContent: "›" })]),
      el("b", { textContent: n.titulo }));

    // La cabecera: su ícono grande, qué es y qué hay adentro, y lo que se puede hacer con ella.
    const abrir = n && SU_APARTADO.find(([es]) => es(n));
    cabeza.replaceChildren(
      n ? el("button", { className: "volver", ariaLabel: "Volver", textContent: "‹", onclick: () => entrar(ctx, datos.padre.get(id)) }) : "",
      insignia(n ? iconoDe(n) : "carpeta", colorDeCarpeta(n), "grande"),
      el("div", { className: "nombre-carpeta" }, el("h3", { textContent: n?.titulo ?? "Todo" }),
        el("small", { textContent: [n?.tipos.nombre, resumen(id)].filter(Boolean).join(" · ") })),
      el("div", { className: "acciones-carpeta" },
        n ? el("button", { textContent: "Ficha", title: "Ver y editar sus datos", onclick: () => mostrarPanel(id) }) : "",
        abrir ? el("button", { textContent: `Abrir en ${abrir[1]} ›`, onclick: () => abrir[2](n) }) : "",
        el("button", { className: "principal", textContent: "+ Nuevo aquí", onclick: () => nuevoEn(n) })));
    cabeza.style.setProperty("--c", colorDeCarpeta(n));

    // Buscando: lo que calza, de aquí y de todo lo de adentro, con dónde está.
    const texto = sinTildes(ctx.buscar?.trim() ?? "");
    const cosas = texto ? todoDentro(id).filter((x) => sinTildes(x.titulo).includes(texto)) : hijosDe(id);
    const carpetas = cosas.filter(esCarpeta), archivos = cosas.filter((x) => !esCarpeta(x));
    // Los archivos, agrupados por tipo (Plantas, Notas, Tareas...), en el orden de los tipos.
    const grupos = Map.groupBy(archivos, (x) => x.tipos.clave);
    cuerpo.replaceChildren(...[
      carpetas.length && seccion("Carpetas", carpetas.length, el("div", { className: "carpetas" }, ...carpetas.map((x) => tarjetaCarpeta(x, texto)))),
      ...[...grupos].map(([clave, xs]) => seccion(datos.tipo.get(clave)?.nombre ?? clave, xs.length, el("div", { className: "archivos" }, ...xs.map((x) => tarjetaArchivo(x, texto))))),
      !cosas.length && el("p", { className: "vacio", textContent: texto ? "Nada con ese nombre aquí adentro." : "Esta carpeta está vacía. Crea lo primero con «+ Nuevo aquí»." }),
    ].filter(Boolean));
  }

  function seccion(titulo, k, contenido) {
    return el("section", { className: "grupo-carpeta" }, el("h4", {}, titulo, el("small", { textContent: k })), contenido);
  }
  // Buscando, cada cosa dice dónde está (su caja), porque puede venir de más adentro.
  function donde(x, buscando) {
    return buscando ? datos.nodo.get(datos.padre.get(x.id))?.titulo : null;
  }

  function tarjetaCarpeta(x, buscando) {
    const t = el("button", { className: "tarjeta-carpeta", onclick: () => entrar(ctx, x.id) },
      icono(iconoDe(x)), el("b", { textContent: x.titulo }),
      el("small", { textContent: [donde(x, buscando) ?? x.tipos.nombre, resumen(x.id)].join(" · ") }));
    t.style.setProperty("--c", colorDeCarpeta(x));
    return t;
  }
  function tarjetaArchivo(x, buscando) {
    return el("button", { className: "tarjeta-archivo", onclick: () => mostrarPanel(x.id) },
      insignia(iconoDe(x), colorDe(x.tipos.clave)),
      el("span", {}, el("b", { textContent: x.titulo }),
        el("small", { textContent: [donde(x, buscando), x.estado].filter(Boolean).join(" · ") || x.tipos.nombre })));
  }
}

// «+ Nuevo aquí»: el formulario de siempre, con los tipos que pueden ir dentro de esta carpeta, y ya metido en ella.
// En la raíz, cualquier tipo, suelto.
function nuevoEn(n) {
  if (!n) return formulario(null);
  const tipos = datos.tipos.filter((t) => t.conexiones?.some((c) => c.hacia.includes(n.tipos.clave))).map((t) => t.clave);
  formulario(null, { tipos: tipos.length ? tipos : undefined, dentro: n.id });
}
