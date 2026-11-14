// Paso 101: Archivos, un explorador donde todo tu árbol es una carpeta.
// Sirve para llegar a cualquier rama (Botánica, Conocimiento Personal, Por leer...), aunque no tenga apartado propio.
//   carpeta  lo que puede contener cosas (su tipo tiene "nivel" en la base: área, tópico, proyecto, objetivo...)
//            o cualquier nodo al que ya le metiste algo. No hay una lista por rama: sale del árbol de la base.
//   archivo  todo lo demás. Abrirlo muestra su ficha (el panel de siempre, panel.js).
// Paso 105: el árbol crece desde aquí: arrastrar para mover (a una carpeta, al árbol o a la ruta), cortar y pegar,
// «Mover a…» (sirve en el celular), nueva carpeta ahí mismo, y los bordes de las columnas se arrastran.
// Paso 103: se maneja como el Explorador de Windows. Un clic elige (Ctrl suma, Shift elige un rango), doble clic abre,
// el teclado recorre, hay atrás y adelante, tres maneras de ver (Íconos, Lista, Detalles), clic derecho y Supr.
// Sus tres widgets comparten el ctx del apartado (widgets.js):
//   ctx.carpeta    el id de la carpeta abierta (nada = la raíz, «Todo»)
//   ctx.elegidos   lo elegido (un Set de ids); ctx.ancla, donde está el cursor; ctx.desde, dónde empieza un rango
//   ctx.atras / ctx.adelante  las carpetas por las que pasaste
//   ctx.vista, ctx.orden, ctx.agrupar  cómo se ve (se recuerda en este navegador)
//   arbol-carpetas        (costado) las carpetas como árbol, que se abren y cierran
//   carpeta               la carpeta abierta: dónde está y lo que tiene
//   propiedades-carpeta   (a la derecha) las propiedades de lo elegido, o de la carpeta abierta, para cambiarlas ahí
import { el, datos, colorDe, colorDeProyecto, cajasDe, sinTildes, irA, dia, avisar, escribible, escribiendoEn, flotante } from "./base.js";
import { mostrarPanel, formulario, editorDePropiedades, tienePropiedad } from "./panel.js";
import { cambiar, completar, crear, mover, porQueNoVa, dentroDeCaja } from "./acciones.js";
import { corto } from "./fechas.js";
import { icono, insignia } from "./dibujos.js";
import { formaDe, iconoDe } from "./formas.js";
import { menuEn } from "./menu.js";

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
// Una carpeta usa el color de su proyecto o ramo (el que le elegiste, o uno suyo). Los archivos se ven con la forma
// de su categoría (formas.js, paso 102), con el ícono y el color de su categoría.
const colorDeCarpeta = (n) => (n ? colorDeProyecto(n.id) : "var(--acento)");
const colorDeCosa = (n) => (esCarpeta(n) ? colorDeCarpeta(n) : colorDe(n.tipos.clave));
// «2 carpetas · 14 cosas»
const cuantas = (k, uno, varios) => k && `${k} ${k === 1 ? uno : varios}`;
const resumen = (id) => [cuantas(carpetasDe(id).length, "carpeta", "carpetas"), cuantas(archivosDe(id).length, "cosa", "cosas")].filter(Boolean).join(" · ") || "Vacía";

// Si una carpeta tiene su propio apartado, se puede ir a verla completa allá.
const SU_APARTADO = [
  [(n) => n.tipos.clave === "proyecto", "Proyectos", (n) => irA("proyectos", { caja: n.id })],
  [(n) => n.tipos.clave === "topico" && n.props?.semestre, "Universidad", (n) => irA("universidad", { ramo: n.id })],
];

// ---------- Moverse ----------
// La carpeta abierta (o nada = la raíz). Si la borraron o archivaron, se vuelve a la raíz.
const abierta = (ctx) => datos.nodo.get(ctx.carpeta) ?? null;
// Entrar a una carpeta. Queda en el historial (para «atrás»), salvo cuando se viaja por el historial.
// Al subir, queda elegida la carpeta de donde venías, como en Windows.
function entrar(ctx, id = null, historia = true) {
  const desde = abierta(ctx)?.id ?? null;
  if (id === desde) return;
  if (historia) { (ctx.atras ??= []).push(desde); ctx.adelante = []; }
  const venia = desde && datos.padre.get(desde) === id ? desde : null;
  ctx.cambiar({ carpeta: id, buscar: "", elegidos: new Set(venia ? [venia] : []), ancla: venia, desde: venia });
}
// Atrás (-1) o adelante (1) en el historial.
function viajar(ctx, k) {
  const [de, a] = k < 0 ? [ctx.atras, (ctx.adelante ??= [])] : [ctx.adelante, (ctx.atras ??= [])];
  if (!de?.length) return;
  a.push(abierta(ctx)?.id ?? null);
  entrar(ctx, de.pop(), false);
}
const subir = (ctx) => abierta(ctx) && entrar(ctx, datos.padre.get(ctx.carpeta) ?? null);
// Abrir algo: una carpeta se abre aquí mismo; un archivo, en su ficha.
const abrir = (ctx, n) => (esCarpeta(n) ? entrar(ctx, n.id) : mostrarPanel(n.id));
// Lo elegido que sigue existiendo, como nodos.
const elegidosDe = (ctx) => [...(ctx.elegidos ?? [])].map((id) => datos.nodo.get(id)).filter(Boolean);

// ---------- Mover y crear carpetas (paso 105) ----------
// Mover varias cosas a una carpeta (null = afuera de todo). Lo que no puede ir ahí se salta y se dice por qué.
// Sale «Deshacer», que devuelve cada una a donde estaba.
function moverA(ids, destino_id) {
  const nodos = ids.map((id) => datos.nodo.get(id)).filter((n) => n && (datos.padre.get(n.id) ?? null) !== destino_id);
  const van = nodos.filter((n) => !porQueNoVa(n, destino_id)), no = nodos.map((n) => porQueNoVa(n, destino_id)).filter(Boolean);
  if (!van.length) return no.length && avisar(no[0]);
  const antes = new Map(van.map((n) => [n, datos.padre.get(n.id) ?? null]));
  for (const n of van) mover(n, destino_id);
  const donde = destino_id ? `«${datos.nodo.get(destino_id).titulo}»` : "Todo";
  avisar((van.length > 1 ? `${van.length} cosas movidas a ${donde}` : `«${van[0].titulo}» movido a ${donde}`) + (no.length ? ` · ${no.length} no: ${no[0]}` : ""),
    { texto: "Deshacer", hacer: () => antes.forEach((p, n) => mover(n, p)) });
}
// «Mover a…»: una ventana con todas las carpetas (con su camino) y un buscador. Sirve también en el celular.
function moverAEleccion(ids) {
  const camino = (n) => [...cajasDe(n.id).reverse().map((id) => datos.nodo.get(id).titulo), n.titulo].join(" › ");
  const carpetas = datos.nodos.filter((n) => tipoDe(n)?.nivel != null).map((n) => ({ n, camino: camino(n) })).sort((a, b) => a.camino.localeCompare(b.camino, "es"));
  const buscar = el("input", { type: "search", placeholder: "Buscar carpeta…", ariaLabel: "Buscar carpeta" }), lista = el("ul", { className: "candidatos" });
  const opcion = (id, titulo, dibujo) => el("li", {}, el("button", { onclick: () => { d.close(); moverA(ids, id); } }, dibujo, el("span", { textContent: titulo })));
  const llenar = () => {
    const t = sinTildes(buscar.value.trim());
    lista.replaceChildren(t ? "" : opcion(null, "Todo (afuera de todo)", insignia("carpeta", "var(--acento)", "chica")),
      ...carpetas.filter((c) => sinTildes(c.camino).includes(t)).slice(0, 60).map((c) => opcion(c.n.id, c.camino, insignia(iconoDe(c.n), colorDeCarpeta(c.n), "chica"))));
  };
  buscar.oninput = llenar;
  llenar();
  const d = flotante(ids.length > 1 ? `Mover ${ids.length} cosas a…` : `Mover «${datos.nodo.get(ids[0])?.titulo}» a…`, el("div", { className: "mover-a" }, buscar, lista));
  buscar.focus();
}
// Las clases de carpeta que se pueden crear dentro de n (null = la raíz, donde van las áreas): las más específicas que
// ella que su tipo deja ir ahí (dentro de un área: tópico, objetivo, proyecto...).
const carpetasPosibles = (n) => datos.tipos.filter((t) => t.nivel != null && (n ? t.nivel > (tipoDe(n)?.nivel ?? Infinity) && dentroDeCaja(t.clave, n.id) : t.nivel === 0));

// Arrastrar: lo elegido (o lo que tomaste) se lleva encima de algo con data-destino (una carpeta, una fila del árbol
// o un paso de la ruta; "" = Todo). Se marca dónde caería. En el celular no se arrastra: está «Mover a…».
let llevando = [], sobre = null;
function arrastrable(raiz, ctx) {
  raiz.addEventListener("dragstart", (e) => {
    const id = e.target.closest?.("[data-id]")?.dataset.id;
    if (!id) return;
    llevando = ctx.elegidos?.has(id) ? [...ctx.elegidos] : [id];
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", llevando.map((x) => datos.nodo.get(x)?.titulo).join("\n"));
  });
  raiz.addEventListener("dragend", () => { llevando = []; marcarSobre(null); });
}
function soltable(raiz) {
  const destinoDe = (e) => e.target.closest?.("[data-destino]");
  raiz.addEventListener("dragover", (e) => {
    const d = destinoDe(e);
    if (!d || !llevando.length || llevando.includes(d.dataset.destino)) return marcarSobre(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    marcarSobre(d);
  });
  raiz.addEventListener("drop", (e) => {
    const d = destinoDe(e);
    if (!d || !llevando.length) return;
    e.preventDefault();
    moverA(llevando, d.dataset.destino || null);
    llevando = [];
    marcarSobre(null);
  });
}
function marcarSobre(d) { if (sobre !== d) { sobre?.classList.remove("soltar"); d?.classList.add("soltar"); sobre = d; } }

// ---------- Cómo se ve (se recuerda en este navegador) ----------
// Detalles muestra estas columnas; cualquiera sirve para ordenar.
const COLUMNAS = {
  titulo: { nombre: "Nombre", valor: (n) => n.titulo },
  categoria: { nombre: "Categoría", valor: (n) => n.tipos.nombre },
  estado: { nombre: "Estado", valor: (n) => n.estado ?? "" },
  fecha: { nombre: "Fecha", valor: (n) => dia(n.fecha) ?? "" },
};
const AGRUPAR = {
  categoria: { nombre: "Categoría", de: (n) => n.tipos.nombre },
  estado: { nombre: "Estado", de: (n) => n.estado ?? "Sin estado" },
  nada: { nombre: "Nada", de: () => "" },
};
const VISTAS = { iconos: "Íconos", lista: "Lista", detalles: "Detalles" };
const GUARDADO = "archivos:vista";
function leerVista() { try { return JSON.parse(localStorage.getItem(GUARDADO)) ?? {}; } catch { return {}; } }
function guardarVista(ctx) { try { localStorage.setItem(GUARDADO, JSON.stringify({ vista: ctx.vista, orden: ctx.orden, agrupar: ctx.agrupar })); } catch {} }

// Las carpetas siempre primero. Sin orden elegido, el de siempre (enOrden); con uno, por esa columna (los vacíos al final).
function ordenar(cosas, orden) {
  const c = COLUMNAS[orden?.por];
  const comparar = c ? (a, b) => !c.valor(a) - !c.valor(b) || orden.al * c.valor(a).localeCompare(c.valor(b), "es", { numeric: true }) || enOrden(a, b) : enOrden;
  return [...cosas].sort((a, b) => esCarpeta(b) - esCarpeta(a) || comparar(a, b));
}

// ---------- El árbol del costado ----------
// Cada carpeta con su flechita para abrirla o cerrarla. Las carpetas del camino a la abierta se abren solas.
export function arbolDeCarpetas(v, ctx) {
  const abiertas = new Set(); // las carpetas abiertas en el árbol
  let ultima; // la carpeta que estaba abierta al dibujar la vez anterior
  const lista = el("ul", { className: "arbol-carpetas" });
  v.append(lista);
  soltable(lista);
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
      boton.dataset.destino = n.id;
      const li = el("li", {}, el("div", { className: "fila-arbol" }, flecha, boton));
      li.style.setProperty("--nivel", nivel);
      return abierto ? [li, ...subs.flatMap((s) => fila(s, nivel + 1))] : [li];
    };
    const raiz = el("button", { className: "nombre-arbol raiz", ariaCurrent: String(!actual), onclick: () => entrar(ctx, null) }, icono("carpeta"), el("span", { textContent: "Todo" }));
    raiz.dataset.destino = "";
    lista.replaceChildren(el("li", {}, el("div", { className: "fila-arbol" }, raiz)), ...carpetasDe(null).flatMap((n) => fila(n, 0)));
  }
}

// ---------- La carpeta abierta ----------
export function carpetaAbierta(v, ctx) {
  Object.assign(ctx, { vista: "iconos", agrupar: "categoria", orden: null }, leerVista());
  let armado = [], total = 0; // con qué se armó la última vez y cuántas cosas muestra
  const boton = (texto, titulo, hacer) => el("button", { className: "nav-carpeta", textContent: texto, title: titulo, ariaLabel: titulo, onclick: hacer });
  const atras = boton("←", "Atrás (Alt+←)", () => viajar(ctx, -1)), adelante = boton("→", "Adelante (Alt+→)", () => viajar(ctx, 1)), arriba = boton("↑", "Subir (Retroceso)", () => subir(ctx));
  const ruta = el("nav", { className: "ruta-carpeta", ariaLabel: "Dónde estás" });
  const buscar = el("input", { type: "search", placeholder: "Buscar aquí…", ariaLabel: "Buscar en esta carpeta y lo de adentro" });
  const cabeza = el("div", { className: "cabeza-carpeta" });
  const herramientas = el("div", { className: "herramientas-carpeta" });
  // El cuerpo recibe el teclado (data-teclas: las flechas no mueven el escritorio infinito mientras estás aquí).
  const cuerpo = el("div", { className: "cuerpo-carpeta", tabIndex: 0, ariaLabel: "Lo que hay en la carpeta", role: "listbox", ariaMultiSelectable: "true" });
  cuerpo.dataset.teclas = "";
  const estado = el("footer", { className: "estado-carpeta" });
  v.append(el("div", { className: "barra-carpeta" }, atras, adelante, arriba, ruta, buscar), cabeza, herramientas, cuerpo, estado);
  buscar.oninput = () => ctx.cambiar({ buscar: buscar.value, elegidos: new Set() });

  // ---- El mouse: un clic elige, doble clic abre, clic derecho trae el menú ----
  // En una pantalla táctil, tocar abre (como en el celular); dejar el dedo apretado elige y trae el menú, y desde ahí
  // cada toque suma o quita.
  const tactil = matchMedia("(hover: none)");
  const itemDe = (e) => e.target.closest("[data-id]");
  // Los botones propios de una forma (marcar hecha, anotar...) hacen lo suyo y no eligen.
  const botonPropio = (e, item) => { const b = e.target.closest("button"); return b && b !== item && !b.matches(".abrir-forma"); };
  cuerpo.onclick = (e) => {
    const item = itemDe(e);
    if (botonPropio(e, item)) return;
    if (!item) return elegir([]); // clic en lo vacío: no queda nada elegido
    const id = item.dataset.id, elegidos = ctx.elegidos ?? new Set();
    if (tactil.matches && !elegidos.size) return abrir(ctx, datos.nodo.get(id));
    if (e.shiftKey && ctx.desde) return elegir(rango(ctx.desde, id), id, ctx.desde);
    if (e.ctrlKey || e.metaKey || tactil.matches) {
      const otros = new Set(elegidos);
      otros[otros.has(id) ? "delete" : "add"](id);
      return elegir([...otros], id);
    }
    elegir([id], id);
  };
  arrastrable(cuerpo, ctx);
  soltable(v);
  cuerpo.ondblclick = (e) => { const item = itemDe(e); if (item && !botonPropio(e, item)) abrir(ctx, datos.nodo.get(item.dataset.id)); };
  cuerpo.oncontextmenu = (e) => {
    const item = itemDe(e);
    if (item && !ctx.elegidos?.has(item.dataset.id)) elegir([item.dataset.id], item.dataset.id);
    menuEn(e, item ? opcionesDe(elegidosDe(ctx)) : [
      { texto: "Nuevo aquí", hacer: () => nuevoEn(abierta(ctx)) },
      ...carpetasPosibles(abierta(ctx)).map((t) => ({ texto: `Nueva carpeta: ${t.nombre}`, hacer: () => nuevaCarpeta(t.clave) })),
      ctx.cortados?.size && { texto: "Pegar aquí", atajo: "Ctrl+V", hacer: pegar },
      "-",
      { texto: "Elegir todo", atajo: "Ctrl+A", hacer: () => elegir(visibles()) },
    ]);
  };
  // Los botones de atrás y adelante del mouse.
  v.onmouseup = (e) => { if (e.button === 3 || e.button === 4) { e.preventDefault(); viajar(ctx, e.button === 3 ? -1 : 1); } };

  // ---- El teclado ----
  const ATAJOS = {
    ArrowUp: (e) => moverCursor(0, -1, e.shiftKey), ArrowDown: (e) => moverCursor(0, 1, e.shiftKey),
    ArrowLeft: (e) => moverCursor(-1, 0, e.shiftKey), ArrowRight: (e) => moverCursor(1, 0, e.shiftKey),
    Home: (e) => cursorEn(visibles()[0], e.shiftKey), End: (e) => cursorEn(visibles().at(-1), e.shiftKey),
    Enter: () => { const sel = elegidosDe(ctx); if (sel.length === 1) abrir(ctx, sel[0]); },
    Backspace: () => subir(ctx), "Alt+ArrowUp": () => subir(ctx),
    "Alt+ArrowLeft": () => viajar(ctx, -1), "Alt+ArrowRight": () => viajar(ctx, 1),
    "Ctrl+a": () => elegir(visibles(), ctx.ancla),
    "Ctrl+x": () => cortar(elegidosDe(ctx)), "Ctrl+v": () => pegar(),
    Delete: () => archivarTodo(elegidosDe(ctx)),
    F2: () => ctx.renombrar?.(() => cuerpo.focus()),
    Escape: () => (ctx.elegidos?.size ? elegir([]) : cuerpo.blur()),
  };
  v.onkeydown = (e) => {
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    const tecla = (e.altKey ? "Alt+" : "") + (e.ctrlKey || e.metaKey ? "Ctrl+" : "") + (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (ATAJOS[tecla]) { e.preventDefault(); return ATAJOS[tecla](e); }
    // Una letra: salta a lo siguiente que empieza con ella.
    if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey && e.key !== " ") {
      const ids = visibles(), desde = ids.indexOf(ctx.ancla), letra = sinTildes(e.key);
      cursorEn([...ids.slice(desde + 1), ...ids.slice(0, desde + 1)].find((id) => sinTildes(datos.nodo.get(id)?.titulo).startsWith(letra)));
    }
  };
  return dibujar;

  // ---- Elegir ----
  // Lo que se ve, en orden (el de la pantalla).
  function visibles() { return [...cuerpo.querySelectorAll("[data-id]")].map((x) => x.dataset.id); }
  function rango(a, b) { const ids = visibles(), i = ids.indexOf(a), j = ids.indexOf(b); return ids.slice(Math.min(i, j), Math.max(i, j) + 1); }
  function elegir(ids, ancla = null, desde = ancla) { ctx.cambiar({ elegidos: new Set(ids), ancla, desde }); }
  // Las flechas: lo más cercano hacia ese lado en la pantalla (sirve igual en una grilla, una lista o una tabla).
  // Con Shift se elige el rango desde donde empezaste.
  function moverCursor(dx, dy, shift) {
    const actual = cuerpo.querySelector(`[data-id="${ctx.ancla}"]`);
    if (!actual) return cursorEn(visibles()[0]);
    const centro = (x) => { const r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const [ax, ay] = centro(actual);
    let mejor, menor = Infinity;
    for (const x of cuerpo.querySelectorAll("[data-id]")) {
      const [cx, cy] = centro(x), hacia = (cx - ax) * dx + (cy - ay) * dy, aLado = Math.abs((cx - ax) * dy + (cy - ay) * dx);
      if (hacia > 4 && hacia + 3 * aLado < menor) { menor = hacia + 3 * aLado; mejor = x; }
    }
    cursorEn(mejor?.dataset.id, shift);
  }
  function cursorEn(id, shift) {
    if (!id) return;
    if (shift && ctx.desde) elegir(rango(ctx.desde, id), id, ctx.desde);
    else elegir([id], id);
  }

  // ---- Lo que se hace con lo elegido ----
  function opcionesDe(sel) {
    const una = sel.length === 1 ? sel[0] : null, suyo = una && SU_APARTADO.find(([es]) => es(una));
    const porHacer = sel.filter((n) => tienePropiedad(n, "estado") && n.estado !== "Hecho");
    return [
      una && { texto: esCarpeta(una) ? "Abrir" : "Abrir ficha", atajo: "Enter", hacer: () => abrir(ctx, una) },
      una && esCarpeta(una) && { texto: "Ver su ficha", hacer: () => mostrarPanel(una.id) },
      suyo && { texto: `Abrir en ${suyo[1]}`, hacer: () => suyo[2](una) },
      porHacer.length && { texto: porHacer.length > 1 ? `Marcar ${porHacer.length} hechas` : "Marcar hecha", hacer: () => porHacer.forEach(completar) },
      una && { texto: "Renombrar", atajo: "F2", hacer: () => ctx.renombrar?.(() => cuerpo.focus()) },
      "-",
      { texto: "Cortar", atajo: "Ctrl+X", hacer: () => cortar(sel) },
      una && esCarpeta(una) && ctx.cortados?.size && { texto: "Pegar dentro", atajo: "Ctrl+V", hacer: () => pegar(una.id) },
      { texto: "Mover a…", hacer: () => moverAEleccion(sel.map((n) => n.id)) },
      "-",
      una && esCarpeta(una) && { texto: "Nuevo aquí", hacer: () => nuevoEn(una) },
      "-",
      { texto: sel.length > 1 ? `Archivar ${sel.length}` : "Archivar", atajo: "Supr", hacer: () => archivarTodo(sel) },
    ];
  }
  // Cortar marca lo elegido (se ve más suave); pegar lo mueve a la carpeta abierta (o a la que digas).
  function cortar(sel) { if (sel.length) ctx.cambiar({ cortados: new Set(sel.map((n) => n.id)) }); }
  function pegar(destino_id = ctx.carpeta ?? null) {
    if (!ctx.cortados?.size) return;
    moverA([...ctx.cortados], destino_id);
    ctx.cambiar({ cortados: null });
  }
  // Nueva carpeta en la abierta: se crea con nombre «Nueva carpeta», queda elegida y se escribe su nombre encima (como F2).
  async function nuevaCarpeta(clave) {
    const n = abierta(ctx);
    const id = await crear(clave, { titulo: "Nueva carpeta" }, { conexion: n ? dentroDeCaja(clave, n.id) : undefined, enfocar: false });
    if (!id) return;
    elegir([id], id);
    ctx.renombrar?.(() => cuerpo.focus());
  }
  // Archivar no borra: deja de verse y se puede recuperar. Igual sale «Deshacer» un rato.
  function archivarTodo(sel) {
    if (!sel.length) return;
    for (const n of sel) cambiar(n, { archivado: true });
    elegir([]);
    avisar(sel.length > 1 ? `${sel.length} cosas archivadas` : `«${sel[0].titulo}» archivado`,
      { texto: "Deshacer", hacer: () => sel.forEach((n) => cambiar(n, { archivado: false })) });
  }

  // ---- Dibujar ----
  // Se arma de nuevo solo si cambió lo que se muestra (los datos, la carpeta, la búsqueda o cómo se ve). Elegir solo
  // vuelve a marcar: así el doble clic cae sobre lo mismo que el primer clic, y el teclado no pierde su lugar.
  function dibujar() {
    const clave = [datos.nodos, datos.registros, ctx.carpeta, ctx.buscar, ctx.vista, ctx.orden?.por, ctx.orden?.al, ctx.agrupar];
    if (clave.some((x, i) => x !== armado[i])) { armar(); armado = clave; }
    marcar();
  }

  function armar() {
    const n = abierta(ctx), id = n?.id ?? null;
    if (buscar.value !== (ctx.buscar ?? "")) buscar.value = ctx.buscar ?? "";

    // Dónde estás: Todo › Universidad › Base de Datos. Cada paso se puede tocar para volver ahí.
    // También se puede soltar algo encima de un paso para llevarlo ahí.
    const paso = (p) => { const b = el("button", { textContent: p ? datos.nodo.get(p).titulo : "Todo", onclick: () => entrar(ctx, p) }); b.dataset.destino = p ?? ""; return b; };
    ruta.replaceChildren(...[null, ...(n ? cajasDe(id).reverse() : [])].flatMap((p, i) => [i ? el("span", { ariaHidden: "true", textContent: "›" }) : "", paso(p)]),
      n ? el("span", { ariaHidden: "true", textContent: "›" }) : "", n ? el("b", { textContent: n.titulo }) : "");
    buscar.placeholder = `Buscar en ${n?.titulo ?? "todo"}…`;

    // La cabecera: su ícono grande, qué es y qué hay adentro, y lo que se puede hacer con ella.
    const suyo = n && SU_APARTADO.find(([es]) => es(n));
    cabeza.replaceChildren(
      insignia(n ? iconoDe(n) : "carpeta", colorDeCarpeta(n), "grande"),
      el("div", { className: "nombre-carpeta" }, el("h3", { textContent: n?.titulo ?? "Todo" }),
        el("small", { textContent: [n?.tipos.nombre, resumen(id)].filter(Boolean).join(" · ") })),
      el("div", { className: "acciones-carpeta" },
        suyo ? el("button", { textContent: `Abrir en ${suyo[1]} ›`, onclick: () => suyo[2](n) }) : "",
        botonCarpeta(n),
        el("button", { className: "principal", textContent: "+ Nuevo aquí", onclick: () => nuevoEn(n) })));
    cabeza.style.setProperty("--c", colorDeCarpeta(n));

    // Cómo se ve: Íconos, Lista o Detalles, y por qué se ordena y agrupa.
    const elegir1 = (opciones, valor, cambio) => {
      const s = el("select", { onchange: () => { cambio(s.value); guardarVista(ctx); ctx.cambiar({}); } },
        ...Object.entries(opciones).map(([k, o]) => el("option", { value: k, textContent: o.nombre ?? o })));
      s.value = valor;
      return s;
    };
    herramientas.replaceChildren(
      el("div", { className: "segmento", role: "group", ariaLabel: "Cómo se ve" }, ...Object.entries(VISTAS).map(([k, nombre]) =>
        el("button", { textContent: nombre, ariaPressed: String(ctx.vista === k), onclick: () => { ctx.vista = k; guardarVista(ctx); ctx.cambiar({}); } }))),
      el("label", {}, "Ordenar ", elegir1({ natural: "Normal", ...COLUMNAS }, ctx.orden?.por ?? "natural", (k) => (ctx.orden = k === "natural" ? null : { por: k, al: 1 }))),
      el("label", {}, "Agrupar ", elegir1(AGRUPAR, ctx.agrupar, (k) => (ctx.agrupar = k))));

    // Lo que se muestra: lo de esta carpeta o, buscando, lo que calza de aquí y de todo lo de adentro (con dónde está).
    const texto = sinTildes(ctx.buscar?.trim() ?? "");
    const cosas = ordenar(texto ? todoDentro(id).filter((x) => sinTildes(x.titulo).includes(texto)) : hijosDe(id), ctx.orden);
    const grupo = (x) => (ctx.agrupar === "nada" ? "" : esCarpeta(x) ? "Carpetas" : AGRUPAR[ctx.agrupar].de(x));
    const grupos = [...Map.groupBy(cosas, grupo)];
    cuerpo.dataset.vista = ctx.vista;
    cuerpo.replaceChildren(...(ctx.vista === "detalles" ? [detalles(grupos, texto)] : grupos.map(([g, xs]) => seccion(g, xs, texto))),
      cosas.length ? "" : el("p", { className: "vacio", textContent: texto ? "Nada con ese nombre aquí adentro." : "Esta carpeta está vacía. Crea lo primero con «+ Nuevo aquí»." }));
    total = cosas.length;
  }

  // «+ Carpeta»: con una sola clase posible la crea al tiro; con varias, pregunta cuál.
  function botonCarpeta(n) {
    const clases = carpetasPosibles(n);
    if (!clases.length) return "";
    return el("button", { textContent: "+ Carpeta", title: "Nueva carpeta aquí", onclick: (e) => clases.length === 1 ? nuevaCarpeta(clases[0].clave)
      : menuEn(e, clases.map((t) => ({ texto: t.nombre, hacer: () => nuevaCarpeta(t.clave) }))) });
  }

  // Lo elegido se marca, el cursor del teclado queda a la vista, y abajo cuántas hay.
  function marcar() {
    atras.disabled = !ctx.atras?.length; adelante.disabled = !ctx.adelante?.length; arriba.disabled = !abierta(ctx);
    for (const x of cuerpo.querySelectorAll("[data-id]")) {
      x.ariaSelected = String(!!ctx.elegidos?.has(x.dataset.id));
      x.role = "option";
      x.classList.toggle("cursor", x.dataset.id === ctx.ancla);
      x.classList.toggle("cortado", !!ctx.cortados?.has(x.dataset.id));
      x.draggable = !tactil.matches;
      if (esCarpeta(datos.nodo.get(x.dataset.id))) x.dataset.destino = x.dataset.id; // una carpeta recibe lo que sueltes encima
    }
    if (cuerpo.contains(document.activeElement)) cuerpo.querySelector(".cursor")?.scrollIntoView({ block: "nearest" });
    const k = elegidosDe(ctx).length;
    estado.replaceChildren(el("span", { textContent: [cuantas(total, "elemento", "elementos") || "Vacía", cuantas(k, "elegido", "elegidos")].filter(Boolean).join(" · ") }),
      el("small", { textContent: ctx.cortados?.size ? `${ctx.cortados.size} para mover: Ctrl+V pega en la carpeta abierta` : "Arrastra para mover · Ctrl+X y Ctrl+V · F2 renombra · Supr archiva" }));
  }

  // Íconos (las formas) o Lista (ícono y nombre): una sección por grupo, con su título.
  function seccion(titulo, xs, buscando) {
    const carpetas = xs.filter(esCarpeta), archivos = xs.filter((x) => !esCarpeta(x));
    const cosa = (x) => (ctx.vista === "lista" ? filaLista(x, buscando) : esCarpeta(x) ? tarjetaCarpeta(x, buscando) : tarjetaArchivo(x, buscando));
    return el("section", { className: "grupo-carpeta" }, titulo ? el("h4", {}, titulo, el("small", { textContent: xs.length })) : "",
      ...(ctx.vista === "lista" ? [el("div", { className: "lista-archivos" }, ...xs.map(cosa))]
        : [carpetas.length && el("div", { className: "carpetas" }, ...carpetas.map(cosa)), archivos.length && el("div", { className: "archivos" }, ...archivos.map(cosa))].filter(Boolean)));
  }
  // Detalles: una tabla con una columna por dato. Tocar una columna ordena por ella (otra vez, al revés).
  function detalles(grupos, buscando) {
    const cabecera = el("tr", {}, ...Object.entries(COLUMNAS).map(([k, c]) => {
      const por = ctx.orden?.por === k;
      return el("th", { ariaSort: por ? (ctx.orden.al > 0 ? "ascending" : "descending") : "none" }, el("button", { textContent: c.nombre + (por ? (ctx.orden.al > 0 ? " ▴" : " ▾") : ""),
        onclick: () => { ctx.orden = { por: k, al: por ? -ctx.orden.al : 1 }; guardarVista(ctx); ctx.cambiar({}); } }));
    }));
    return el("table", { className: "detalles-archivos" }, el("thead", {}, cabecera), ...grupos.map(([g, xs]) => el("tbody", {},
      g ? el("tr", { className: "grupo" }, el("th", { colSpan: 4, textContent: `${g} · ${xs.length}` })) : "",
      ...xs.map((x) => {
        const f = el("tr", {}, el("td", {}, el("span", { className: "nombre-detalle" }, icono(iconoDe(x)), el("span", { textContent: x.titulo }),
          donde(x, buscando) ? el("small", { textContent: "En " + donde(x, buscando) }) : "")),
        el("td", { textContent: esCarpeta(x) ? `Carpeta · ${resumen(x.id)}` : x.tipos.nombre }),
        el("td", {}, x.estado ? el("span", { className: "pastilla-estado", textContent: x.estado }) : ""),
        el("td", { textContent: dia(x.fecha) ? corto(dia(x.fecha)) : "" }));
        f.dataset.id = x.id;
        f.style.setProperty("--c", colorDeCosa(x));
        return f;
      }))));
  }
  // Buscando, cada cosa dice dónde está (su caja), porque puede venir de más adentro.
  function donde(x, buscando) {
    return buscando ? datos.nodo.get(datos.padre.get(x.id))?.titulo : null;
  }
  function tarjetaCarpeta(x, buscando) {
    const t = el("button", { className: "tarjeta-carpeta", tabIndex: -1 }, icono(iconoDe(x)), el("b", { textContent: x.titulo }),
      el("small", { textContent: [donde(x, buscando) ?? x.tipos.nombre, resumen(x.id)].join(" · ") }));
    t.dataset.id = x.id;
    t.style.setProperty("--c", colorDeCarpeta(x));
    return t;
  }
  // La forma de su categoría; tocarla elige (abrir es con doble clic). Buscando, va con dónde está arriba.
  function tarjetaArchivo(x, buscando) {
    const forma = formaDe(x, { tocar: null }), lugar = donde(x, buscando);
    const t = lugar ? el("div", { className: "con-lugar" }, el("small", { textContent: "En " + lugar }), forma) : forma;
    t.dataset.id = x.id;
    return t;
  }
  function filaLista(x, buscando) {
    const f = el("button", { className: "fila-lista", tabIndex: -1, title: donde(x, buscando) ? "En " + donde(x, buscando) : "" }, icono(iconoDe(x)), el("span", { textContent: x.titulo }));
    f.dataset.id = x.id;
    f.classList.toggle("es-carpeta", esCarpeta(x));
    f.style.setProperty("--c", colorDeCosa(x));
    return f;
  }
}

// ---------- Las propiedades (a la derecha) ----------
// De lo elegido o, sin nada elegido, de la carpeta abierta. Se cambian ahí mismo (panel.js, editorDePropiedades).
// El nombre se cambia escribiendo encima (o con F2). En el celular sale desde abajo cuando eliges algo.
export function propiedadesCarpeta(v, ctx) {
  return function dibujar() {
    if (escribiendoEn(v)) return; // escribiendo un nombre o un valor: no se pisa
    const sel = elegidosDe(ctx), nodos = sel.length ? sel : [abierta(ctx)].filter(Boolean), una = nodos.length === 1 ? nodos[0] : null;
    v.classList.toggle("con-eleccion", sel.length > 0);
    ctx.renombrar = null;
    if (!nodos.length) return v.replaceChildren(titulo("Propiedades"), cabeza(insignia("carpeta", "var(--acento)", "grande"), el("h4", { textContent: "Todo" }), resumen(null)),
      el("p", { className: "vacio", textContent: "Elige algo para ver y cambiar sus propiedades." }));

    const misma = new Set(nodos.map((n) => n.tipos.clave)).size === 1;
    let nombre;
    if (una) {
      nombre = escribible("h4", una.titulo, (t) => t && t !== una.titulo && cambiar(una, { titulo: t }), "nombre-propiedades");
      // F2: se escribe encima del nombre; al terminar, luego() (el foco vuelve a la carpeta).
      ctx.renombrar = (luego) => { nombre.focus(); getSelection().selectAllChildren(nombre); nombre.addEventListener("blur", () => setTimeout(luego), { once: true }); };
    } else nombre = el("h4", { textContent: `${nodos.length} cosas` });
    const detalle = una ? [una.tipos.nombre, esCarpeta(una) && resumen(una.id)].filter(Boolean).join(" · ") : misma ? nodos[0].tipos.nombre : "Varias categorías";
    const caja = una && datos.nodo.get(datos.padre.get(una.id));
    v.replaceChildren(
      titulo(sel.length > 1 ? `Propiedades · ${sel.length} elegidas` : "Propiedades"),
      cabeza(insignia(iconoDe(nodos[0]), colorDeCosa(nodos[0]), "grande"), nombre, detalle),
      caja ? el("p", { className: "dentro-de" }, "Dentro de ", el("button", { textContent: caja.titulo + " ›", onclick: () => entrar(ctx, caja.id) })) : "",
      editorDePropiedades(nodos),
      sel.length > 1 ? el("small", { className: "vacio", textContent: `Lo que cambies aquí se aplica a las ${sel.length}.` }) : "",
      el("div", { className: "acciones" },
        una ? el("button", { textContent: "Abrir ficha", title: "Sus notas y conexiones", onclick: () => mostrarPanel(una.id) }) : "",
        sel.length ? el("button", { className: "listo", textContent: "Listo", onclick: () => ctx.cambiar({ elegidos: new Set() }) }) : ""));
  };
  function titulo(t) { return el("h3", { textContent: t }); }
  function cabeza(dibujo, nombre, detalle) { return el("div", { className: "cabeza-propiedades" }, dibujo, el("div", {}, nombre, el("small", { textContent: detalle }))); }
}

// «+ Nuevo aquí»: el formulario de siempre, con los tipos que pueden ir dentro de esta carpeta, y ya metido en ella.
// En la raíz, cualquier tipo, suelto.
function nuevoEn(n) {
  if (!n) return formulario(null);
  const tipos = datos.tipos.filter((t) => t.conexiones?.some((c) => c.hacia.includes(n.tipos.clave))).map((t) => t.clave);
  formulario(null, { tipos: tipos.length ? tipos : undefined, dentro: n.id });
}
