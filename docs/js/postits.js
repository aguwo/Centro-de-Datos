// Los post-its (paso 31): lo que está en el Inbox (cualquier cosa con estado "Inbox": tareas, proyectos...),
// pegado alrededor de las secciones del escritorio, para que lo veas mientras lo usas y lo ordenes.
//   arrastrar   lo mueve; su lugar queda guardado en props.postit = { x, y } (en el mundo del escritorio)
//   tocar       escribes encima y cambia el título (Enter guarda, Escape deshace)
//   ✓ / ×       listo (Hecho) / soltar (archivar)
//   Pasar a…    el formulario de siempre, con el estado en "Por hacer": al guardar sale del Inbox y deja de ser post-it
// Los que no tienen lugar guardado se reparten solos en los bordes libres.
// En pantallas angostas no hay escritorio: se ven en una fila arriba de Hoy.
import { $, el, datos, colorDe } from "./base.js";
import { cambiar, cambiarProps, completar, archivar, crear } from "./acciones.js";
import { escritorioActivo, alCambiarDeModo, alrededor, centro, zoom } from "./escritorio.js";
import { formulario } from "./panel.js";

const TAMANO = { ancho: 184, alto: 150 }; // el mismo de estilos.css
const CERCA = 120;                         // un lugar a menos de esto de otro post-it ya está ocupado
const EN_CELULAR = "hoy-titulo";            // sin escritorio, la fila va justo después de este elemento

const capa = () => $("postits");
const enInbox = () => datos.nodos.filter((n) => n.estado === "Inbox").sort((a, b) => a.id.localeCompare(b.id));
// A qué se puede pasar un post-it: los tipos que tienen estado (tarea, proyecto, objetivo...).
const ordenables = () => datos.tipos.filter((t) => t.propiedades?.some((p) => p.clave === "estado")).map((t) => t.clave);

export function dibujarPostits() {
  const c = capa();
  if (escritorioActivo()) { if (c.parentElement.id !== "mundo") $("mundo").append(c); }
  else if (c.previousElementSibling?.id !== EN_CELULAR) $(EN_CELULAR).after(c);
  if (c.contains(document.activeElement)) return; // estás escribiendo en uno: se redibuja cuando termines
  const lista = enInbox(), lugar = repartir(lista);
  c.replaceChildren(...lista.map((n) => postit(n, lugar.get(n.id))));
}

// Dónde va cada uno: el suyo si lo moviste; si no, el primer lugar libre alrededor de las secciones.
function repartir(lista) {
  const lugar = new Map(lista.filter((n) => n.props?.postit).map((n) => [n.id, n.props.postit]));
  const libres = escritorioActivo() ? alrededor(TAMANO.ancho, TAMANO.alto) : [];
  const ocupados = [...lugar.values()];
  const libre = (l) => !ocupados.some((o) => Math.hypot(o.x - l.x, o.y - l.y) < CERCA);
  let apilados = 0;
  for (const n of lista) {
    if (lugar.has(n.id) || !libres.length) continue;
    // Si ya no queda lugar, se apilan corridos sobre el primero.
    const l = libres.find(libre) ?? { x: libres[0].x + 16 * ++apilados, y: libres[0].y + 16 * apilados };
    lugar.set(n.id, l);
    ocupados.push(l);
  }
  return lugar;
}

// El papel: del color de su tipo, un poco girado (siempre igual para el mismo post-it).
function papel(n, l, ...hijos) {
  const p = el("div", { className: "postit" }, ...hijos);
  p.style.setProperty("--c", colorDe(n?.tipos.clave ?? "tarea"));
  p.style.setProperty("--giro", (n ? (parseInt(n.id.slice(0, 2), 16) % 7) - 3 : 0) + "deg");
  if (l) Object.assign(p.style, { left: l.x + "px", top: l.y + "px" });
  if (n) p.dataset.id = n.id;
  return p;
}

// El texto se escribe encima. Enter o salir guarda; Escape deshace.
function escribible(inicial, alTerminar) {
  const t = el("p", { className: "texto", textContent: inicial, contentEditable: "plaintext-only", spellcheck: false });
  t.onkeydown = (e) => {
    if (e.key === "Escape") t.textContent = inicial;
    if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); t.blur(); }
  };
  t.onblur = () => alTerminar(t.textContent.trim());
  return t;
}

function postit(n, l) {
  const boton = (texto, title, accion, className) => el("button", { className, textContent: texto, title, ariaLabel: title, onclick: accion });
  const sale = (accion) => () => { p.classList.add("sale"); accion(n); };
  const p = papel(n, l,
    el("header", {},
      el("span", { className: "tipo", textContent: n.tipos.nombre }),
      boton("✓", "Listo", sale(completar)),
      boton("×", "Soltar (se archiva)", sale(archivar))),
    escribible(n.titulo, (t) => (t && t !== n.titulo ? cambiar(n, { titulo: t }) : dibujarPostits())),
    boton(`Pasar a ${n.tipos.nombre.toLowerCase()} →`, "Ponerle fecha, proyecto y lo demás", () =>
      formulario(n, { tipos: ordenables(), valores: { estado: "Por hacer" } }), "pasar"));
  return p;
}

// "+ Nuevo → Post-it": uno en blanco al medio de lo que estás mirando. Al terminar de escribir queda en el Inbox.
export function nuevoPostit() {
  const { x, y } = centro(), l = { x: Math.round(x - TAMANO.ancho / 2), y: Math.round(y - TAMANO.alto / 2) };
  const p = papel(null, l, el("header", {}, el("span", { className: "tipo", textContent: "Post-it" })),
    escribible("", (titulo) => (titulo ? crear("tarea", { titulo, estado: "Inbox", props: { postit: l } }, { enfocar: false }) : p.remove())));
  capa().append(p);
  p.querySelector(".texto").focus();
}

// Arrastrar (solo en el escritorio). Un toque sin moverse es para escribir: pone el cursor en el texto.
function arrastrar() {
  let t = null;
  capa().addEventListener("pointerdown", (e) => {
    const p = e.target.closest(".postit[data-id]");
    if (!p || !escritorioActivo() || e.button !== 0 || e.target.closest("button") || e.target === document.activeElement) return;
    e.preventDefault(); // que no seleccione texto mientras se mueve
    t = { p, x: e.clientX, y: e.clientY, x0: p.offsetLeft, y0: p.offsetTop, movido: false };
    p.setPointerCapture(e.pointerId);
  });
  capa().addEventListener("pointermove", (e) => {
    if (!t) return;
    const dx = (e.clientX - t.x) / zoom(), dy = (e.clientY - t.y) / zoom();
    if (!t.movido && Math.hypot(dx, dy) < 4) return;
    t.movido = true;
    t.p.classList.add("moviendo");
    Object.assign(t.p.style, { left: t.x0 + dx + "px", top: t.y0 + dy + "px" });
  });
  capa().addEventListener("pointerup", () => {
    if (!t) return;
    const { p, movido } = t;
    t = null;
    if (!movido) return enfocarTexto(p.querySelector(".texto"));
    p.classList.remove("moviendo");
    cambiarProps(datos.nodo.get(p.dataset.id), { postit: { x: Math.round(p.offsetLeft), y: Math.round(p.offsetTop) } });
  });
}
// El cursor al final del texto.
function enfocarTexto(t) {
  t.focus();
  getSelection().selectAllChildren(t);
  getSelection().collapseToEnd();
}

export function iniciarPostits() {
  arrastrar();
  alCambiarDeModo(dibujarPostits);
}
