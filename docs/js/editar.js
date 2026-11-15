// Paso 117: editar un apartado. Cada apartado (Salud, Finanzas, Universidad...) es una plantilla: sus columnas de
// widgets en apartados.js. Con «Editar apartado» se arma un borrador de esas columnas y se cambia a gusto; al guardar
// va a tu cuenta (tabla disposiciones, llave apartado:<id>). Sin cambios, o con «Volver a la de siempre», se borra y
// vale la de apartados.js. Aquí no hay nada de un apartado en particular.
// Paso 118: las piezas se arrastran (con el mouse o el dedo, desde su agarre ⋮⋮) y las demás se corren para hacerle
// lugar; a la derecha, el panel «Agregar» trae todas las piezas para arrastrarlas (o tocarlas) al apartado; y todo se
// deshace y rehace (botones, Ctrl+Z y Ctrl+Shift+Z). Cada cambio se anima: lo que se movió viaja a su lugar nuevo.
import { el, db, datos, escribir, enLaWeb, sinTildes } from "./base.js";
import { icono } from "./dibujos.js";

export const llaveEditada = (a) => "apartado:" + a.id;
const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const CURVA = "cubic-bezier(.22,.8,.24,1)"; // la misma --suave-curva de estilos.css

// ---------- Los cambios al borrador (cada uno devuelve un borrador nuevo; ci = columna, pi = pieza) ----------
const conColumna = (b, ci, cambio) => b.map((c, j) => (j === ci ? { ...c, ...cambio(c) } : c));
const insertar = (xs, i, x) => [...xs.slice(0, i), x, ...xs.slice(i)];
// Una pieza solo pasa a otra columna si es de las normales (no un título de bloque ni el costado).
export const puedeIrA = (b, j) => !!b[j] && !b[j].bloque && !b[j].costado;
export const CAMBIOS = {
  // Lleva la pieza [ci, pi] a [cj, pj]; pj cuenta sin la pieza que se mueve (como se ve mientras la arrastras).
  llevar(b, [ci, pi], [cj, pj]) {
    const w = b[ci].widgets[pi], sin = conColumna(b, ci, (c) => ({ widgets: c.widgets.filter((_, k) => k !== pi) }));
    return conColumna(sin, cj, (c) => ({ widgets: insertar(c.widgets, pj, w) }));
  },
  mover: (b, ci, pi, d) => CAMBIOS.llevar(b, [ci, pi], [ci, pi + d]),
  cambiarDeColumna: (b, ci, pi, d) => CAMBIOS.llevar(b, [ci, pi], [ci + d, b[ci + d].widgets.length]),
  poner: (b, ci, pi, id) => conColumna(b, ci, (c) => ({ widgets: insertar(c.widgets, Math.min(pi, c.widgets.length), id) })),
  duplicar: (b, ci, pi) => CAMBIOS.poner(b, ci, pi + 1, b[ci].widgets[pi]),
  quitar: (b, ci, pi) => conColumna(b, ci, (c) => ({ widgets: c.widgets.filter((_, k) => k !== pi) })),
  ancho: (b, ci, d) => conColumna(b, ci, (c) => ({ ancho: Math.max(0.5, Math.round(((c.ancho ?? 1) + d) * 4) / 4) })),
  columna: (b, ci) => insertar(b, ci + 1, { ancho: 1, widgets: [] }),
};

// ---------- Animar un cambio ----------
// Mide dónde estaba cada pieza (por su clave), hace el cambio y hace viajar cada una desde ahí hasta su lugar nuevo;
// las que no estaban aparecen creciendo un poco. Sirve para cualquier caja con hijos [data-clave].
function viajar(x, desde, hasta, duracion = 260) {
  const dx = enLaWeb(desde.left - hasta.left), dy = enLaWeb(desde.top - hasta.top);
  if (Math.abs(dx) + Math.abs(dy) > 0.5) x.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: duracion, easing: CURVA });
}
export function conViaje(caja, cambiar) {
  if (quieto()) return cambiar();
  const antes = new Map([...caja.querySelectorAll("[data-clave]")].map((x) => [x.dataset.clave, x.getBoundingClientRect()]));
  cambiar();
  for (const x of caja.querySelectorAll("[data-clave]")) {
    const r = antes.get(x.dataset.clave);
    if (r) viajar(x, r, x.getBoundingClientRect(), 320);
    else x.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: CURVA });
  }
}

// ---------- Arrastrar ----------
// Arrastra «pieza» (un elemento de la página) dentro de la sección: sale una copia que sigue al puntero, en su lugar
// queda un hueco que se corre a donde caería (las demás piezas se mueven suave para hacerle lugar) y, al soltar, la
// copia aterriza en el hueco y se llama soltar({ ci, pi }) (o soltar(null) si se soltó fuera de las columnas).
// Si el puntero no se movió (fue un toque), se llama tocar() en vez. Cerca del borde de arriba o de abajo, la
// sección se desplaza sola.
const UMBRAL = 5; // px que hay que mover para que cuente como arrastre y no como toque
export function arrastrar(e, { seccion, pieza, propia, soltar, tocar }) {
  if (e.button > 0) return;
  e.preventDefault();
  const inicio = { x: e.clientX, y: e.clientY };
  let fantasma = null, hueco = null, destino = null, puntero = inicio, cuadro = 0;

  const empezar = () => {
    const r = pieza.getBoundingClientRect();
    fantasma = pieza.cloneNode(true);
    fantasma.classList.add("fantasma");
    Object.assign(fantasma.style, { left: enLaWeb(r.left) + "px", top: enLaWeb(r.top) + "px", width: enLaWeb(r.width) + "px", height: enLaWeb(r.height) + "px" });
    fantasma.removeAttribute("data-clave");
    document.body.append(fantasma);
    hueco = el("div", { className: "hueco" });
    hueco.style.height = enLaWeb(Math.min(r.height, 320)) + "px";
    if (propia) { pieza.after(hueco); pieza.classList.add("arrastrada"); }
    seccion.classList.add("arrastrando");
    cuadro = requestAnimationFrame(seguir);
  };
  // Cada cuadro: la copia sigue al puntero, el hueco va a donde caería y, cerca de un borde, se desplaza.
  const seguir = () => {
    fantasma.style.translate = `${enLaWeb(puntero.x - inicio.x)}px ${enLaWeb(puntero.y - inicio.y)}px`;
    const s = seccion.getBoundingClientRect(), borde = 70;
    if (puntero.y < s.top + borde) seccion.scrollTop -= (s.top + borde - puntero.y) / 4;
    else if (puntero.y > s.bottom - borde) seccion.scrollTop += (puntero.y - s.bottom + borde) / 4;
    const d = destinoEn(seccion, puntero);
    if (d?.col !== destino?.col || d?.pi !== destino?.pi) {
      destino = d;
      conViaje(seccion, () => (d ? (d.antes ? d.antes.before(hueco) : d.col.querySelector(":scope > .final-columna").before(hueco)) : hueco.remove()));
    }
    cuadro = requestAnimationFrame(seguir);
  };
  const mover = (m) => {
    puntero = { x: m.clientX, y: m.clientY };
    if (!fantasma && Math.hypot(puntero.x - inicio.x, puntero.y - inicio.y) > UMBRAL) empezar();
  };
  const terminar = () => {
    removeEventListener("pointermove", mover);
    removeEventListener("pointerup", terminar);
    removeEventListener("pointercancel", terminar);
    if (!fantasma) return tocar?.();
    cancelAnimationFrame(cuadro);
    const final = destino && { ci: destino.ci, pi: destino.pi };
    const listo = () => { fantasma.remove(); hueco.remove(); pieza.classList.remove("arrastrada"); seccion.classList.remove("arrastrando"); soltar(final); };
    if (!final || !hueco.isConnected || quieto()) return listo();
    // La copia aterriza en el hueco y recién ahí se arma el apartado nuevo.
    const de = fantasma.getBoundingClientRect(), a = hueco.getBoundingClientRect();
    const [tx, ty] = fantasma.style.translate.split(" ").map((v) => parseFloat(v) || 0);
    fantasma.animate([{ translate: `${tx}px ${ty}px` }, { translate: `${tx + enLaWeb(a.left - de.left)}px ${ty + enLaWeb(a.top - de.top)}px`, transform: "none" }],
      { duration: 220, easing: CURVA, fill: "forwards" }).finished.then(listo, listo);
  };
  addEventListener("pointermove", mover);
  addEventListener("pointerup", terminar);
  addEventListener("pointercancel", terminar);
}

// Dónde caería algo soltado en el punto p: la columna visible bajo el puntero (o la más cercana de esa fila) y antes
// de qué pieza. pi cuenta sin la pieza que se está arrastrando.
function destinoEn(seccion, p) {
  const cols = [...seccion.querySelectorAll(".columna[data-ci]")].filter((c) => c.checkVisibility());
  const rects = cols.map((c) => c.getBoundingClientRect());
  const enFila = cols.filter((_, i) => p.y >= rects[i].top - 60 && p.y <= rects[i].bottom + 120);
  if (!enFila.length) return null;
  const distancia = (c) => { const r = c.getBoundingClientRect(); return p.x < r.left ? r.left - p.x : p.x > r.right ? p.x - r.right : 0; };
  const col = enFila.reduce((m, c) => (distancia(c) < distancia(m) ? c : m));
  if (distancia(col) > 160) return null;
  const piezas = [...col.querySelectorAll(":scope > .pieza-editable:not(.arrastrada)")];
  const pi = piezas.findIndex((x) => { const r = x.getBoundingClientRect(); return p.y < r.top + r.height / 2; });
  return { col, ci: Number(col.dataset.ci), pi: pi < 0 ? piezas.length : pi, antes: piezas[pi] };
}

// ---------- Los controles ----------
const boton = (contenido, titulo, hacer, apagado, clase = "boton-icono") => el("button", { type: "button", className: clase, title: titulo,
  ariaLabel: titulo, disabled: !!apagado, onclick: hacer }, contenido);

// Una pieza mientras editas: su contenido, el agarre ⋮⋮ para arrastrarla (o moverla con las flechas, Supr la quita)
// y, al pasar por encima o tocarla, Duplicar y Quitar.
export function piezaEditable(contenido, { clave, ci, pi, b, editar, alArrastrar }) {
  const agarre = el("button", { type: "button", className: "agarre", title: "Arrastrar (o mover con las flechas)", ariaLabel: "Mover pieza", textContent: "⋮⋮" });
  const caja = el("div", { className: "pieza-editable" }, contenido, agarre,
    el("div", { className: "controles-pieza" },
      boton(icono("secciones"), "Duplicar", () => editar("duplicar", ci, pi)),
      boton("×", "Quitar", () => editar("quitar", ci, pi))));
  caja.dataset.clave = clave;
  agarre.onpointerdown = (e) => alArrastrar(e, caja);
  agarre.onkeydown = (e) => {
    const n = b[ci].widgets.length;
    const accion = { ArrowUp: pi > 0 && ["mover", ci, pi, -1], ArrowDown: pi < n - 1 && ["mover", ci, pi, 1],
      ArrowLeft: puedeIrA(b, ci - 1) && ["cambiarDeColumna", ci, pi, -1], ArrowRight: puedeIrA(b, ci + 1) && ["cambiarDeColumna", ci, pi, 1],
      Delete: ["quitar", ci, pi], Backspace: ["quitar", ci, pi] }[e.key];
    if (accion) { e.preventDefault(); editar(...accion); }
  };
  return caja;
}

// Arriba de cada columna: su ancho y sumar una columna a su derecha.
export const controlesDeColumna = (b, ci, editar) => el("div", { className: "controles-columna" },
  el("span", { textContent: "Ancho" }),
  boton("−", "Más angosta", () => editar("ancho", ci, -0.25), (b[ci].ancho ?? 1) <= 0.5),
  boton("+", "Más ancha", () => editar("ancho", ci, 0.25)),
  el("span", { className: "relleno" }),
  boton("⊞", "Columna nueva a la derecha", () => editar("columna", ci)));

// La barra de arriba mientras editas. Se arma una vez; poner({ antes, despues, tuya }) prende o apaga sus botones.
export function barraDeEdicion(a, { deshacer, rehacer, volver, cancelar, guardar }) {
  const atras = boton("↶", "Deshacer (Ctrl+Z)", deshacer), adelante = boton("↷", "Rehacer (Ctrl+Shift+Z)", rehacer);
  const deSiempre = boton("Volver a la de siempre", "Volver a la de siempre", volver, false, "suave");
  const barra = el("div", { className: "barra-edicion" }, icono("secciones"), el("b", { textContent: `Editando «${a.nombre}»` }),
    el("span", { className: "relleno" }), atras, adelante, deSiempre,
    el("button", { type: "button", textContent: "Cancelar", onclick: cancelar }),
    el("button", { type: "button", className: "principal", textContent: "Guardar", onclick: guardar }));
  barra.poner = ({ antes, despues, tuya }) => { atras.disabled = !antes; adelante.disabled = !despues; deSiempre.hidden = !tuya; };
  return barra;
}

// El panel «Agregar» de la derecha: buscador, «De <apartado>» o «Todas», y una tarjeta por pieza.
// grupos = [[nombre del grupo, icono, [[id, nombre], ...]], ...]. Una tarjeta se arrastra al apartado
// (alArrastrar(e, tarjeta, id)) o, con un toque o Enter, se agrega al final de la primera columna (agregar(id)).
export function panelDePiezas(a, grupos, { alArrastrar, agregar }) {
  let filtro = "", todas = !grupos.some(([g]) => g === a.nombre);
  const lista = el("div", { className: "lista-piezas" });
  const buscador = el("input", { type: "search", placeholder: "Buscar piezas", ariaLabel: "Buscar piezas", oninput: (e) => { filtro = sinTildes(e.target.value); dibujar(); } });
  const pestana = (texto, valor) => el("button", { type: "button", textContent: texto, onclick: () => { todas = valor; dibujar(); } });
  const pestanas = [pestana("De " + a.nombre, false), pestana("Todas", true)];
  function dibujar() {
    pestanas.forEach((p, i) => p.setAttribute("aria-pressed", String(i === Number(todas))));
    const elegidos = grupos.filter(([g]) => todas || g === a.nombre);
    const tarjetas = (ws, ic, g) => ws.filter(([, n]) => !filtro || sinTildes(n).includes(filtro)).map(([id, n]) => {
      const t = el("button", { type: "button", className: "tarjeta-pieza", title: "Arrastra al apartado, o toca para agregar al final" },
        el("span", { className: "miniatura" }, icono(ic)), el("span", {}, el("b", { textContent: n }), el("small", { textContent: g })),
        el("span", { className: "agarre-tarjeta", ariaHidden: "true", textContent: "⋮⋮" }));
      t.onpointerdown = (e) => alArrastrar(e, t, id);
      t.onkeydown = (e) => e.key === "Enter" && (e.preventDefault(), agregar(id));
      return t;
    });
    const hay = elegidos.flatMap(([g, ic, ws]) => { const ts = tarjetas(ws, ic, g); return ts.length ? [todas ? el("h5", { textContent: g }) : "", ...ts] : []; });
    lista.replaceChildren(...(hay.length ? hay : [el("p", { className: "nada-seccion", textContent: "Ninguna pieza se llama así." })]));
  }
  dibujar();
  return el("aside", { className: "panel-piezas vidrio", ariaLabel: "Agregar piezas" }, el("h3", { textContent: "Agregar" }), buscador,
    el("div", { className: "segmento", role: "group", ariaLabel: "Qué piezas" }, ...pestanas), lista);
}

// Guarda tus columnas, o las borra si son las de siempre (o si columnas es null).
export function guardarEditada(a, columnas, deSiempre) {
  const llave = llaveEditada(a);
  if (!columnas || JSON.stringify(columnas) === JSON.stringify(deSiempre))
    return datos.disposiciones.has(llave) && escribir(db.from("disposiciones").delete().eq("apartado", llave), () => datos.disposiciones.delete(llave));
  return escribir(db.from("disposiciones").upsert({ apartado: llave, columnas }, { onConflict: "owner_id,apartado" }),
    () => datos.disposiciones.set(llave, columnas));
}
