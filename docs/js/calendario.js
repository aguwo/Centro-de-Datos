// El calendario (paso 30): un cajón que sale desde el dock, con vista de día, semana y mes.
//   Tocar un hueco crea un evento a esa hora; tocar un evento lo edita (editor-evento en index.html).
//   Los eventos pueden repetirse (agenda.js sabe cuándo ocurren) y borrarse "solo este" o "todos".
//   "Mis calendarios" son tus áreas (Universidad, Salud...): cada evento va en el del área donde está.
// Más adelante (paso 33) se sincroniza con Google Calendar.
import { $, el, datos, dia, sinHora } from "./base.js";
import { hoyTexto, sumarDias, lunes, sinHoraISO, conHoraISO, horaDecimal, hhmm, aHora } from "./fechas.js";
import { delDia, dibujarAgenda } from "./agenda.js";
import { crear, cambiar, cambiarProps, archivar } from "./acciones.js";
import { mostrarPanel } from "./panel.js";

const ALTO = 44; // píxeles por hora
const PALETA = ["#3b82f6", "#22c55e", "#ec4899", "#f97316", "#8b5cf6", "#14b8a6", "#ef4444", "#a16207"];
const MAX_EN_MES = 3; // cuántas cosas se ven por día en la vista de mes; el resto, "+2 más"
const pantallaAngosta = matchMedia("(max-width: 700px)");
let vista = pantallaAngosta.matches ? "dia" : "semana", foco = hoyTexto();

// ---------- Mis calendarios: uno por área, más "Tareas" ----------
// El calendario de un nodo es el área a la que pertenece (subiendo de caja en caja).
function areaDe(id) {
  for (let p = id; p; p = datos.padre.get(p)) if (datos.nodo.get(p)?.tipos.clave === "area") return p;
  return "";
}
const calendarioDe = (n) => (n.tipos.clave === "tarea" ? "tareas" : areaDe(n.id));
// Todas las áreas (para elegir al crear); las que tienen algo van primero y se reparten los colores.
function calendarios() {
  const usados = new Set(datos.nodos.filter((n) => ["evento", "tarea"].includes(n.tipos.clave)).map(calendarioDe));
  const areas = datos.nodos.filter((n) => n.tipos.clave === "area")
    .sort((a, b) => usados.has(b.id) - usados.has(a.id) || a.titulo.localeCompare(b.titulo, "es"));
  return [...areas.map((a, i) => ({ id: a.id, nombre: a.titulo, color: PALETA[i % PALETA.length], usado: usados.has(a.id) })),
    { id: "", nombre: "Sin área", color: "#94a3b8", usado: usados.has("") }, { id: "tareas", nombre: "Tareas", color: "#eab308", usado: usados.has("tareas") }];
}
const colorDeCal = (id) => calendarios().find((c) => c.id === id)?.color;

// Los que escondiste quedan guardados en este navegador.
const ESCONDIDOS = new Set(leer());
function leer() { try { return JSON.parse(localStorage.getItem("calendarios-escondidos")) ?? []; } catch { return []; } }
function guardar() { try { localStorage.setItem("calendarios-escondidos", JSON.stringify([...ESCONDIDOS])); } catch {} }
const seVe = (x) => !ESCONDIDOS.has(calendarioDe(x.n));

// ---------- Dibujar ----------
const textoFecha = (d, opciones) => new Date(d + "T12:00").toLocaleDateString("es-CL", opciones);

export function dibujarCalendario() {
  if (!$("calendario").classList.contains("abierto")) return; // cerrado no gasta tiempo
  for (const b of $("cal-vistas").children) b.setAttribute("aria-pressed", b.dataset.vista === vista);
  dibujarLado();
  if (vista === "mes") return dibujarMes();
  const dias = vista === "dia" ? [foco] : Array.from({ length: 7 }, (_, i) => sumarDias(lunes(foco), i));
  $("cal-titulo").textContent = textoFecha(foco, vista === "dia" ? { weekday: "long", day: "numeric", month: "long" } : { month: "long", year: "numeric" });
  const cuerpo = $("cal-cuerpo"), arriba = cuerpo.scrollTop;
  dibujarAgenda(cuerpo, dias, {
    desde: 0, hasta: 24, alto: ALTO, filtro: seVe, color: (n) => colorDeCal(calendarioDe(n)),
    alTocar: tocar, alTocarHueco: (d, h) => editar(null, { d, h }),
  });
  cuerpo.scrollTop = arriba || 8 * ALTO; // la primera vez abre en las 8:00; después se queda donde estabas
}

// Mes: seis semanas; cada día con lo que tiene. Tocar el número abre ese día.
function dibujarMes() {
  const primero = foco.slice(0, 8) + "01", mes = foco.slice(0, 7), hoy = hoyTexto();
  $("cal-titulo").textContent = textoFecha(primero, { month: "long", year: "numeric" });
  const nombres = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((n) => el("span", { className: "dn", textContent: n }));
  const celdas = Array.from({ length: 42 }, (_, i) => {
    const d = sumarDias(lunes(primero), i);
    const verDia = () => { foco = d; vista = "dia"; dibujarCalendario(); };
    const numero = el("button", { className: "num", textContent: +d.slice(8), title: "Ver el día", onclick: verDia });
    const cosas = delDia(d).filter(seVe), sobran = cosas.length - MAX_EN_MES;
    const celda = el("div", { className: "d" + (d.slice(0, 7) !== mes ? " fuera" : "") + (d === hoy ? " hoy" : "") }, numero,
      ...cosas.slice(0, sobran > 0 ? MAX_EN_MES - 1 : MAX_EN_MES).map((x) => {
        const c = el("button", { className: "chip-mes", title: x.n.titulo, onclick: () => tocar(x.n, d) },
          x.ini === null ? "" : el("small", { textContent: hhmm(x.ini) + " " }), x.n.titulo);
        c.style.setProperty("--c", colorDeCal(calendarioDe(x.n)));
        return c;
      }),
      sobran > 0 ? el("button", { className: "chip-mes mas", textContent: `+${sobran + 1} más`, onclick: verDia }) : "");
    celda.onclick = (e) => { if (e.target === celda) editar(null, { d, h: 9 }); };
    return celda;
  });
  $("cal-cuerpo").scrollTop = 0;
  $("cal-cuerpo").replaceChildren(el("div", { className: "mes" }, ...nombres, ...celdas));
}

// El costado: mini mes (tocar un día lo muestra) y Mis calendarios (marcar o desmarcar).
function dibujarLado() {
  const primero = foco.slice(0, 8) + "01", hoy = hoyTexto();
  $("cal-mini").replaceChildren(
    el("b", { textContent: textoFecha(primero, { month: "long", year: "numeric" }) }),
    ...["L", "M", "M", "J", "V", "S", "D"].map((x) => el("span", { textContent: x })),
    ...Array.from({ length: 42 }, (_, i) => {
      const d = sumarDias(lunes(primero), i);
      return el("button", { textContent: +d.slice(8), onclick: () => { foco = d; dibujarCalendario(); },
        className: [d.slice(0, 7) !== primero.slice(0, 7) && "fuera", d === hoy && "hoy", d === foco && "foco"].filter(Boolean).join(" ") });
    }));
  // Solo los calendarios que tienen algo (las áreas sin eventos no ocupan espacio).
  $("cal-calendarios").replaceChildren(...calendarios().filter((c) => c.usado).map((c) => {
    const caja = el("input", { type: "checkbox", checked: !ESCONDIDOS.has(c.id),
      onchange: () => { caja.checked ? ESCONDIDOS.delete(c.id) : ESCONDIDOS.add(c.id); guardar(); dibujarCalendario(); } });
    const l = el("label", {}, caja, c.nombre);
    l.style.setProperty("--c", c.color);
    return el("li", {}, l);
  }));
}

// Una tarea se abre en su panel de siempre; un evento, en el editor.
const tocar = (n, d) => (n.tipos.clave === "evento" ? editar(n, { d }) : mostrarPanel(n.id));

// ---------- Editor de eventos ----------
const REPITE = (d) => {
  const f = new Date(d + "T12:00");
  return [["", "No se repite"], ["Cada día", "Cada día"], ["Cada semana", `Cada semana el ${f.toLocaleDateString("es-CL", { weekday: "long" })}`],
    ["Días hábiles", "Todos los días hábiles (lunes a viernes)"], ["Cada mes", `Cada mes el día ${f.getDate()}`],
    ["Cada año", `Cada año el ${f.toLocaleDateString("es-CL", { day: "numeric", month: "long" })}`]];
};
let abierto = null; // { n, d }: el evento que se edita (n es null si es nuevo) y el día que tocaste

// n: el evento (o null para uno nuevo). d: el día; h: la hora (para uno nuevo).
function editar(n, { d, h = 9 }) {
  const f = $("editor-evento").querySelector("form"), x = f.elements;
  abierto = { n, d };
  f.reset();
  const ini = n && !sinHora(new Date(n.fecha)) ? horaDecimal(n.fecha) : h;
  const fin = n?.props?.fecha_fin && !sinHora(new Date(n.props.fecha_fin)) ? horaDecimal(n.props.fecha_fin) : ini + 1;
  x.titulo.value = n?.titulo ?? "";
  x.fecha.value = n ? dia(n.fecha) : d;
  x.todo.checked = !!n && sinHora(new Date(n.fecha));
  x.ini.value = hhmm(ini);
  x.fin.value = hhmm(Math.min(fin, 23.75));
  ponerRepite(n?.props?.repite ?? "");
  x.hasta.value = n?.props?.repite_hasta ?? "";
  x.notas.value = n?.contenido ?? "";
  x.calendario.replaceChildren(...calendarios().filter((c) => c.id !== "tareas").map((c) => el("option", { value: c.id, textContent: c.nombre })));
  x.calendario.value = n ? areaDe(n.id) : [...x.calendario.options].find((o) => o.value && !ESCONDIDOS.has(o.value))?.value ?? "";
  x.calendario.disabled = !!n; // por ahora el área se elige al crear
  f.querySelector(".aviso-repite").hidden = !n?.props?.repite;
  f.querySelector(".eliminar").hidden = !n;
  f.querySelector(".eliminar-cual").hidden = true;
  ajustar();
  $("editor-evento").showModal();
  if (!n) x.titulo.focus();
}
function ponerRepite(valor) {
  const x = $("editor-evento").querySelector("form").elements;
  x.repite.replaceChildren(...REPITE(x.fecha.value).map(([v, t]) => el("option", { value: v, textContent: t })));
  x.repite.value = valor;
}
// Lo que se ve según lo marcado: sin "todo el día" van las horas; si se repite, el "hasta".
function ajustar() {
  const f = $("editor-evento").querySelector("form"), x = f.elements;
  f.querySelector(".horas").hidden = x.todo.checked;
  f.querySelector(".hasta").hidden = !x.repite.value;
}

async function guardarEvento(e) {
  e.preventDefault();
  const x = e.target.elements, { n } = abierto;
  const ini = aHora(x.ini.value), fin = Math.max(aHora(x.fin.value), ini + 0.25);
  const props = { ...(n?.props ?? {}), fecha_fin: x.todo.checked ? null : conHoraISO(x.fecha.value, fin),
    repite: x.repite.value || null, repite_hasta: (x.repite.value && x.hasta.value) || null };
  for (const k in props) if (props[k] === null) delete props[k];
  const campos = { titulo: x.titulo.value.trim(), contenido: x.notas.value.trim() || null, props,
    fecha: x.todo.checked ? sinHoraISO(x.fecha.value) : conHoraISO(x.fecha.value, ini) };
  $("editor-evento").close();
  if (n) await cambiar(n, campos);
  else await crear("evento", campos, x.calendario.value && { relacion: "pertenece_a", destino_id: x.calendario.value });
}

function iniciarEditor() {
  const dlg = $("editor-evento"), f = dlg.querySelector("form"), x = f.elements;
  f.onsubmit = guardarEvento;
  x.todo.onchange = x.repite.onchange = ajustar;
  x.fecha.onchange = () => ponerRepite(x.repite.value);
  f.querySelector(".cancelar").onclick = () => dlg.close();
  // Eliminar = archivar (se puede recuperar). Si se repite, pregunta: solo este día o todos.
  f.querySelector(".eliminar").onclick = () => {
    if (!abierto.n.props?.repite) return dlg.close(), archivar(abierto.n);
    f.querySelector(".eliminar").hidden = true;
    f.querySelector(".eliminar-cual").hidden = false;
  };
  f.querySelector(".solo-este").onclick = () => {
    const { n, d } = abierto, excepto = [...(n.props.excepto?.split(",") ?? []), d];
    dlg.close();
    cambiarProps(n, { excepto: excepto.join(",") });
  };
  f.querySelector(".todos").onclick = () => { dlg.close(); archivar(abierto.n); };
}

// ---------- El cajón ----------
const avanzar = (n) => {
  foco = vista === "dia" ? sumarDias(foco, n) : vista === "semana" ? sumarDias(foco, 7 * n)
    : sumarDias(foco.slice(0, 8) + "01", n < 0 ? -1 : 31).slice(0, 8) + "01";
  dibujarCalendario();
};

export function iniciarCalendario() {
  $("cal-hoy").onclick = () => { foco = hoyTexto(); dibujarCalendario(); };
  $("cal-ant").onclick = () => avanzar(-1);
  $("cal-sig").onclick = () => avanzar(1);
  $("cal-crear").onclick = () => editar(null, { d: foco, h: Math.min(new Date().getHours() + 1, 23) });
  for (const b of $("cal-vistas").children) b.onclick = () => { vista = b.dataset.vista; dibujarCalendario(); };
  iniciarEditor();
}
