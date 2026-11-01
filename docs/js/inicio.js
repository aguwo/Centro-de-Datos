// El Inicio: las señales arriba y las tarjetas en tres columnas (Hacer, Cuidarme, Mi vida).
// Este archivo solo sabe DIBUJAR una tarjeta cualquiera; qué muestra cada una está en tarjetas.js.
import { db, $, el, datos, escribir } from "./base.js";
import { mostrarPanel } from "./panel.js";
import { TARJETAS, COLUMNAS, contexto } from "./tarjetas.js";

export function dibujarInicio() {
  const c = contexto();
  const resultados = TARJETAS.map((t) => ({ t, ...t.calcular(c) }));

  $("fecha-hoy").textContent = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const senales = resultados.filter((r) => r.senal);
  $("senales").replaceChildren(...senales.map(({ t, senal }) =>
    el("div", { className: "senal " + senal.nivel }, el("b", { textContent: t.titulo }), el("span", { textContent: senal.texto }))));

  $("tablero").replaceChildren(...Object.entries(COLUMNAS).map(([clave, nombre]) =>
    el("div", { className: "columna" }, el("h2", { textContent: nombre }),
      ...resultados.filter((r) => r.t.columna === clave).map(tarjeta))));
}

function tarjeta({ t, filas, resumen, vacio }) {
  return el("section", { className: "tarjeta" },
    el("h3", {}, el("span", { textContent: t.titulo }), el("small", { textContent: resumen ?? String(filas.length) })),
    filas.length ? el("ul", {}, ...filas.map(fila)) : el("p", { className: "vacio", textContent: vacio }));
}

function fila(f) {
  const li = el("li");
  if (f.marcar) {
    const check = el("input", { type: "checkbox", checked: !!f.hecho, title: f.hecho ? "Desmarcar" : "Marcar" });
    check.onchange = () => { check.disabled = true; f.marcar(); }; // se vuelve a habilitar al redibujar
    li.append(check);
  }
  const texto = el("a", { textContent: f.texto, title: f.texto });
  if (f.id) texto.onclick = () => mostrarPanel(f.id);
  li.append(texto);
  if (f.puntos) li.append(el("span", { className: "puntos", title: "Últimos 7 días" },
    ...f.puntos.map((si) => el("i", { className: si ? "si" : "" }))));
  if (f.meta) li.append(el("span", { className: "meta" + (f.alerta ? " atrasada" : ""), textContent: f.meta }));
  if (f.barra !== undefined && f.barra !== null) {
    const barra = el("span", { className: "barra" + (f.barra > 1 ? " pasada" : "") }, el("span"));
    barra.firstChild.style.width = Math.max(0, Math.min(1, f.barra)) * 100 + "%";
    li.classList.add("con-barra");
    li.append(barra);
  }
  return li;
}

// Captura rápida: crea una tarea en el Inbox, sin fecha ni conexiones. Después la ordenas.
$("form-captura").onsubmit = async (e) => {
  e.preventDefault();
  const titulo = $("captura").value.trim();
  if (!titulo) return;
  if (await escribir(db.from("nodos").insert({ tipo_id: datos.tipo.get("tarea").id, titulo, estado: "Inbox" }))) $("captura").value = "";
};
