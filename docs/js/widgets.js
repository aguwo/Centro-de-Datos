// Los widgets (paso 34a): cada ventana de un apartado es una pieza suelta que se puede poner en cualquier apartado.
// Un apartado con "columnas" (apartados.js) se arma solo con sus widgets: no necesita HTML propio en index.html.
// Agregar un widget = escribir su función crear y anotarlo en esta lista.
//
//   titulo  (opcional) lo que dice arriba de la ventana; sin título, empieza directo con su contenido
//   crece   (opcional) ocupa el alto que sobra en su columna (las listas largas); las demás miden lo que su contenido
//   filtra  (opcional) elige qué muestran las otras ventanas del apartado; en el teléfono va primero
//   crear(v, ctx)  arma la ventana v una sola vez y devuelve la función que la redibuja cuando llegan datos.
//           v.sub es el <small> al lado del título (para una cuenta o un resumen).
//           ctx es lo que comparten las ventanas de un mismo apartado (ej. ctx.filtro: el área o proyecto elegido).
//           ctx.cambiar({ ... }) lo cambia y redibuja todas las ventanas del apartado.
import { el } from "./base.js";
import { tareasDeHoy, elTiempo, tuDia } from "./hoy.js";
import { tareasDelFiltro, areasYProyectos } from "./productividad.js";

export const WIDGETS = {
  "tareas-de-hoy": { titulo: "Tareas de hoy", crece: true, crear: tareasDeHoy },
  "el-tiempo":     { titulo: "El tiempo", crear: elTiempo },
  "tu-dia":        { titulo: "Tu día", crece: true, crear: tuDia },
  "tareas":        { titulo: "Tareas", crece: true, crear: tareasDelFiltro },
  "proyectos":     { crece: true, filtra: true, crear: areasYProyectos },
};

// Arma la <section> de un apartado: su título y sus columnas de ventanas.
// Devuelve la sección (para ponerla en la página) y la función que la redibuja entera.
export function montar(a) {
  const titulo = el("h2", { className: "sobre-foto", id: a.id + "-titulo" });
  const redibujar = [];
  const ctx = { cambiar(campos) { Object.assign(ctx, campos); dibujar(); } };
  const ventana = (id) => {
    const w = WIDGETS[id], sub = el("small");
    const v = el("div", { className: ["ventana vidrio", "w-" + id, w.crece && "crece", w.filtra && "filtra"].filter(Boolean).join(" ") },
      w.titulo ? el("h3", {}, w.titulo, sub) : "");
    v.sub = sub;
    redibujar.push(w.crear(v, ctx));
    return v;
  };
  const grilla = el("div", { className: "columnas" }, ...a.columnas.map((c) => el("div", { className: "columna" }, ...c.widgets.map(ventana))));
  grilla.style.setProperty("--columnas", a.columnas.map((c) => `minmax(0, ${c.ancho ?? 1}fr)`).join(" "));

  function dibujar() {
    titulo.textContent = a.titulo?.() ?? a.nombre;
    for (const r of redibujar) r();
  }
  return { seccion: el("section", { id: a.id, className: "apartado con-widgets oculto" }, titulo, grilla), dibujar };
}
