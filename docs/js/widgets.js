// Los widgets (paso 34a): cada ventana de un apartado es una pieza suelta que se puede poner en cualquier apartado.
// Un apartado con "columnas" (apartados.js) se arma solo con sus widgets: no necesita HTML propio en index.html.
// Agregar un widget = escribir su función crear y anotarlo en esta lista.
// Paso 34b: cada persona puede tener su propia disposición guardada en la base (tabla disposiciones);
// si no tiene, vale la de apartados.js.
//
//   titulo  (opcional) lo que dice arriba de la ventana; sin título, empieza directo con su contenido
//   crece   (opcional) ocupa el alto que sobra en su columna (las listas largas); las demás miden lo que su contenido
//   filtra  (opcional) elige qué muestran las otras ventanas del apartado; en el teléfono va primero
//   crear(v, ctx)  arma la ventana v una sola vez y devuelve la función que la redibuja cuando llegan datos.
//           v.sub es el <small> al lado del título (para una cuenta o un resumen).
//           ctx es lo que comparten las ventanas de un mismo apartado (ej. ctx.filtro: el área o proyecto elegido).
//           ctx.cambiar({ ... }) lo cambia y redibuja todas las ventanas del apartado.
import { el, datos } from "./base.js";
import { tareasDeHoy, elTiempo, tuDia } from "./hoy.js";
import { tareasDelFiltro, areasYProyectos } from "./productividad.js";
import { indice, cabecera, tablero, dentro } from "./proyectos.js";
import { franjaDeObjetivos } from "./objetivos.js";

export const WIDGETS = {
  "tareas-de-hoy": { titulo: "Tareas de hoy", crece: true, crear: tareasDeHoy },
  "el-tiempo":     { titulo: "El tiempo", crear: elTiempo },
  "tu-dia":        { titulo: "Tu día", crece: true, crear: tuDia },
  "tareas":        { titulo: "Tareas", crece: true, crear: tareasDelFiltro },
  "proyectos":     { crece: true, filtra: true, crear: areasYProyectos },
  "indice":        { crece: true, filtra: true, crear: indice },
  "caja":          { crear: cabecera },
  "tablero":       { titulo: "Tareas", crece: true, crear: tablero },
  "dentro":        { crear: dentro },
  "objetivos":     { crear: franjaDeObjetivos },
};

// Las columnas de un apartado: las tuyas, si las guardaste, o las de siempre.
// Lo guardado se revisa antes de usarlo: los widgets que no existen se saltan, las columnas vacías
// se quitan y, si no queda nada, vale la de siempre. Así un dato raro nunca deja un apartado en blanco.
export function disposicionDe(a) {
  const lista = (x) => (Array.isArray(x) ? x : []);
  const tuya = lista(datos.disposiciones.get(a.id))
    .map((c) => ({ ancho: Number(c?.ancho) > 0 ? Number(c.ancho) : 1, costado: c?.costado === true, arriba: c?.arriba === true, widgets: lista(c?.widgets).filter((id) => WIDGETS[id]) }))
    .filter((c) => c.widgets.length);
  return tuya.length ? tuya : a.columnas;
}

// Arma la <section> de un apartado: su título y sus columnas de ventanas.
// Una columna con costado: true (paso 38b) va pegada al borde izquierdo, a todo el alto, y se esconde con su botón;
// queda escondida o no según la dejaste la última vez (en este navegador).
// Una columna con arriba: true (paso 37b) va como franja a todo el ancho, sobre las demás columnas.
// Devuelve la sección (para ponerla en la página) y la función que la redibuja entera.
// Las ventanas se arman al primer dibujo y se vuelven a armar solo si cambió la disposición.
export function montar(a) {
  const titulo = el("h2", { className: "sobre-foto", id: a.id + "-titulo" });
  const seccion = el("section", { id: a.id, className: "apartado con-widgets oculto" }, titulo);
  const ctx = { cambiar(campos) { Object.assign(ctx, campos); dibujar(); } };
  let armada = { clave: null, grilla: null, redibujar: [] };

  function armar(columnas) {
    const redibujar = [];
    const ventana = (id) => {
      const w = WIDGETS[id], sub = el("small");
      const v = el("div", { className: ["ventana vidrio", "w-" + id, w.crece && "crece", w.filtra && "filtra"].filter(Boolean).join(" ") },
        w.titulo ? el("h3", {}, w.titulo, sub) : "");
      v.sub = sub;
      redibujar.push(w.crear(v, ctx));
      return v;
    };
    const centro = columnas.filter((c) => !c.costado && !c.arriba), lado = columnas.filter((c) => c.costado);
    const franja = columnas.filter((c) => c.arriba).flatMap((c) => c.widgets.map(ventana));
    const grilla = el("div", { className: "columnas" }, ...centro.map((c) => el("div", { className: "columna" }, ...c.widgets.map(ventana))));
    grilla.style.setProperty("--columnas", centro.map((c) => `minmax(0, ${c.ancho ?? 1}fr)`).join(" "));
    const costado = lado.length ? el("aside", { className: "costado vidrio" }, botonCostado(), ...lado.flatMap((c) => c.widgets.map(ventana))) : "";
    armada.costado?.remove();
    for (const f of armada.franja ?? []) f.remove();
    if (armada.grilla) armada.grilla.replaceWith(grilla);
    else seccion.append(grilla);
    grilla.before(...franja);
    if (costado) titulo.after(costado);
    seccion.classList.toggle("con-costado", !!costado);
    armada = { clave: JSON.stringify(columnas), grilla, costado, franja, redibujar };
  }

  const guardado = "costado-cerrado:" + a.id;
  const leer = () => { try { return localStorage.getItem(guardado) === "1"; } catch { return false; } };
  seccion.classList.toggle("costado-cerrado", leer());
  function botonCostado() {
    const b = el("button", { className: "plegar", onclick: () => {
      const cerrado = seccion.classList.toggle("costado-cerrado");
      try { localStorage.setItem(guardado, cerrado ? "1" : "0"); } catch {}
      poner();
    } });
    const poner = () => { const c = seccion.classList.contains("costado-cerrado");
      b.textContent = c ? "›" : "‹"; b.title = c ? "Mostrar el costado" : "Esconder el costado"; b.ariaExpanded = String(!c); };
    poner();
    return b;
  }

  function dibujar() {
    const columnas = disposicionDe(a);
    if (JSON.stringify(columnas) !== armada.clave) armar(columnas);
    titulo.textContent = a.titulo?.() ?? a.nombre;
    for (const r of armada.redibujar) r();
  }
  return { seccion, dibujar, ctx };
}
