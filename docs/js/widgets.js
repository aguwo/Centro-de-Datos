// Los widgets (paso 34a): cada ventana de un apartado es una pieza suelta que se puede poner en cualquier apartado.
// Un apartado con "columnas" (apartados.js) se arma solo con sus widgets: no necesita HTML propio en index.html.
// Agregar un widget = escribir su función crear y anotarlo en esta lista.
// Paso 34b: cada persona puede tener su propia disposición guardada en la base (tabla disposiciones);
// si no tiene, vale la de apartados.js.
// Paso 62: un apartado puede ofrecer varias "vistas" (apartados.js); arriba sale un selector y la que eliges
// se guarda como tu disposición. La primera es la de siempre: elegirla borra lo guardado.
//
//   titulo  (opcional) lo que dice arriba de la ventana; sin título, empieza directo con su contenido
//   crece   (opcional) ocupa el alto que sobra en su columna (las listas largas); las demás miden lo que su contenido
//   filtra  (opcional) elige qué muestran las otras ventanas del apartado; en el teléfono va primero
//   crear(v, ctx)  arma la ventana v una sola vez y devuelve la función que la redibuja cuando llegan datos.
//           v.sub es el <small> al lado del título (para una cuenta o un resumen).
//           ctx es lo que comparten las ventanas de un mismo apartado (ej. ctx.filtro: el área o proyecto elegido).
//           ctx.cambiar({ ... }) lo cambia y redibuja todas las ventanas del apartado.
import { el, db, datos, escribir } from "./base.js";
import { tareasDeHoy, elTiempo, tuDia } from "./hoy.js";
import { tareasDelFiltro, areasYProyectos } from "./productividad.js";
import { galeria, cabecera, tablero, dentro } from "./proyectos.js";
import { tarjetasDeRamos, paginaDeRamo, loQueViene } from "./universidad.js";
import { loImportante, diasDeLaSemana } from "./semana.js";
import { cifras, peso, anillos, habitosHoy, constancia, despensa, diaComida, comidas, plato, anotar, semanaComida } from "./salud.js";
import { modo, fondo, barra, ventanas, cuenta } from "./ajustes.js";

export const WIDGETS = {
  "tareas-de-hoy": { titulo: "Tareas de hoy", crece: true, crear: tareasDeHoy },
  "el-tiempo":     { titulo: "El tiempo", crear: elTiempo },
  "tu-dia":        { titulo: "Tu día", crece: true, crear: tuDia },
  "tareas":        { titulo: "Tareas", crece: true, crear: tareasDelFiltro },
  "proyectos":     { crece: true, filtra: true, crear: areasYProyectos },
  "galeria":       { crear: galeria },
  "caja":          { crear: cabecera },
  "tablero":       { titulo: "Tareas", crear: tablero },
  "dentro":        { crear: dentro },
  "ramos":         { crear: tarjetasDeRamos },
  "ramo":          { crear: paginaDeRamo },
  "lo-que-viene":  { titulo: "Lo que viene", crear: loQueViene },
  "lo-importante": { crear: loImportante },
  "dias":          { crece: true, crear: diasDeLaSemana },
  "cifras":        { crear: cifras },
  "peso":          { crear: peso },
  "anillos":       { titulo: "Anillos de hoy", crear: anillos },
  "habitos-hoy":   { titulo: "Hábitos de hoy", crear: habitosHoy },
  "constancia":    { titulo: "Constancia", crear: constancia },
  "despensa":      { titulo: "Despensa", crear: despensa },
  "dia-comida":    { crear: diaComida },
  "comidas":       { crear: comidas },
  "plato":         { titulo: "Tu plato", crear: plato },
  "anotar":        { titulo: "Anotar comida", crear: anotar },
  "semana-comida": { titulo: "La semana", crear: semanaComida },
  "modo":          { titulo: "Modo y color", crear: modo },
  "fondo":         { titulo: "Fondo de pantalla", crear: fondo },
  "barra":         { titulo: "Barra lateral", crear: barra },
  "ventanas":      { titulo: "Ventanas y letra", crear: ventanas },
  "cuenta":        { titulo: "Tu cuenta", crear: cuenta },
};

// Las columnas de un apartado: las tuyas, si las guardaste, o las de siempre.
// Lo guardado se revisa antes de usarlo: los widgets que no existen se saltan, las columnas vacías
// se quitan y, si no queda nada, vale la de siempre. Así un dato raro nunca deja un apartado en blanco.
export function disposicionDe(a) {
  const tuya = normal(datos.disposiciones.get(a.id));
  return tuya.length ? tuya : columnasDe(a);
}
const lista = (x) => (Array.isArray(x) ? x : []);
const normal = (columnas) => lista(columnas)
  .map((c) => ({ ancho: Number(c?.ancho) > 0 ? Number(c.ancho) : 1, costado: c?.costado === true, widgets: lista(c?.widgets).filter((id) => WIDGETS[id]) }))
  .filter((c) => c.widgets.length);
// Las columnas de siempre: las de su primera vista, si tiene vistas.
const columnasDe = (a) => a.vistas?.[0].columnas ?? a.columnas;

// Paso 62: elegir una de las vistas de un apartado. La primera es la de siempre, así que elegirla borra lo guardado
// (si algún día cambia en apartados.js, te llega sola). Las otras se guardan como tu disposición.
function elegirVista(a, vista) {
  const deSiempre = vista === a.vistas[0];
  if (deSiempre) datos.disposiciones.delete(a.id);
  else datos.disposiciones.set(a.id, vista.columnas);
  // Se ve al tiro (quien llama redibuja); la base se pone al día por detrás.
  return escribir(deSiempre ? db.from("disposiciones").delete().eq("apartado", a.id)
    : db.from("disposiciones").upsert({ apartado: a.id, columnas: vista.columnas }, { onConflict: "owner_id,apartado" }));
}
// El selector de vistas: un botón por vista; queda marcada la que estás usando (ninguna, si armaste otra cosa).
function selectorDeVistas(a, redibujar) {
  const botones = a.vistas.map((vista) => el("button", { textContent: vista.nombre, onclick: () => { elegirVista(a, vista); redibujar(); } }));
  const caja = el("div", { className: "segmento vistas", role: "group", ariaLabel: "Vista" }, ...botones);
  caja.marcar = (columnas) => a.vistas.forEach((vista, i) =>
    botones[i].setAttribute("aria-pressed", String(JSON.stringify(normal(vista.columnas)) === JSON.stringify(normal(columnas)))));
  return caja;
}

// Arma la <section> de un apartado: su título y sus columnas de ventanas.
// Una columna con costado: true (paso 38b) va pegada al borde izquierdo, a todo el alto, y se esconde con su botón;
// queda escondida o no según la dejaste la última vez (en este navegador).
// Devuelve la sección (para ponerla en la página) y la función que la redibuja entera.
// Las ventanas se arman al primer dibujo y se vuelven a armar solo si cambió la disposición.
export function montar(a) {
  const titulo = el("h2", { className: "sobre-foto", id: a.id + "-titulo" });
  // La barra: una fila bajo el título, a todo el ancho, para pastillas o avisos de un widget (vacía no se ve).
  const barra = el("div", { className: "barra-apartado" });
  const vistas = a.vistas?.length > 1 ? selectorDeVistas(a, () => dibujar()) : null;
  const cabeza = vistas ? el("div", { className: "cabeza-apartado" }, titulo, vistas) : titulo;
  const seccion = el("section", { id: a.id, className: "apartado con-widgets oculto" }, cabeza, barra);
  const ctx = { barra, cambiar(campos) { Object.assign(ctx, campos); dibujar(); } };
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
    const centro = columnas.filter((c) => !c.costado), lado = columnas.filter((c) => c.costado);
    const grilla = el("div", { className: "columnas" }, ...centro.map((c) => el("div", { className: "columna" }, ...c.widgets.map(ventana))));
    grilla.style.setProperty("--columnas", centro.map((c) => `minmax(0, ${c.ancho ?? 1}fr)`).join(" "));
    const costado = lado.length ? el("aside", { className: "costado vidrio" }, botonCostado(), ...lado.flatMap((c) => c.widgets.map(ventana))) : null;
    barra.replaceChildren(); // lo que puso la disposición anterior (ej. otra vista) no se queda
    armada.costado?.remove();
    if (armada.grilla) armada.grilla.replaceWith(grilla);
    else seccion.append(grilla);
    if (costado) cabeza.after(costado);
    seccion.classList.toggle("con-costado", !!costado);
    armada = { clave: JSON.stringify(columnas), grilla, costado, redibujar };
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
    vistas?.marcar(columnas);
    titulo.textContent = a.titulo?.() ?? a.nombre;
    for (const r of armada.redibujar) r();
  }
  return { seccion, dibujar, ctx };
}
