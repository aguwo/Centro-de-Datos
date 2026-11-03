// Los widgets de Productividad (paso 32): tus proyectos y sus tareas. Comparten ctx (widgets.js):
// ctx.area es el chip elegido y ctx.filtro, el chip o uno de sus proyectos: lo que muestra "tareas".
// Viven en ctx y no dentro del widget para que no se pierdan si la ventana se vuelve a armar.
//   proyectos  una fila de chips: tus áreas (Proyectos, Universidad...) y al final Todas y Sin proyecto. Elegir uno filtra las tareas
//              y muestra debajo solo sus proyectos y tópicos (los ramos), cada uno con su color, su avance, cuántas
//              tareas van atrasadas y la próxima. Tocar uno lo filtra (tocarlo de nuevo vuelve al área).
//              Soltar una tarea encima de un chip o un proyecto la mueve ahí. Un proyecto sin nada pendiente se puede cerrar.
//              Las áreas se ordenan arrastrando un chip sobre otro; el orden queda en cada área (props.orden).
//   tareas     las del filtro, por grupo (atrasadas, hoy, próximas, sin fecha; las hechas, plegadas).
//              "Agregar tarea" entiende fechas escritas ("dentista mañana 10:00") y deja la tarea en lo elegido.
// Lo del Inbox no aparece aquí: son los post-its (postits.js).
import { el, datos, dia, cajasDe, areaDe, areasEnOrden, proyectoDe, colorDeProyecto, irA } from "./base.js";
import { hoyTexto, corto } from "./fechas.js";
import { cambiar, cambiarProps, mover } from "./acciones.js";
import { listaDeTareas, seccion, porFecha, agregarTarea } from "./tareas.js";
import { esObjetivo, aportesDe } from "./objetivos.js";

const LISTADOS = ["proyecto", "topico"]; // lo que aparece bajo cada área (paso 36b: los ramos también)
const TODAS = "todas", SIN = "sin"; // los filtros que no son un proyecto ni un área
const NOMBRE = { [TODAS]: "Todas", [SIN]: "Sin proyecto" };
const filtroDe = (ctx) => ctx.filtro ?? TODAS;
const enCaja = (id) => id !== TODAS && id !== SIN;
const nombreDe = (id) => NOMBRE[id] ?? datos.nodo.get(id)?.titulo ?? "";

const deTipo = (clave) => datos.nodos.filter((n) => n.tipos.clave === clave && n.estado !== "Inbox");
// Las tareas de un filtro: todas, las que no están en ningún proyecto, o las que están dentro de esa caja (a cualquier profundidad).
// Un objetivo (paso 37b) cuenta como caja junto con lo que le aporta: sus tareas son las de esos proyectos y ramos.
const cajas = (id) => [id, ...(esObjetivo(datos.nodo.get(id)) ? aportesDe(id).map((a) => a.id) : [])];
const de = (id) => deTipo("tarea").filter((n) => (id === TODAS ? true : id === SIN ? !proyectoDe(n.id) : cajas(id).some((c) => cajasDe(n.id).includes(c))));

// Cómo va un filtro: cuántas tareas tiene, cuántas hechas y atrasadas, y cuál es la próxima.
function resumen(id) {
  const hoy = hoyTexto(), ts = de(id), abiertas = ts.filter((n) => n.estado !== "Hecho").sort(porFecha);
  return { total: ts.length, hechas: ts.length - abiertas.length, abiertas: abiertas.length,
    atrasadas: abiertas.filter((n) => dia(n.fecha) && dia(n.fecha) < hoy).length, proxima: abiertas.find((n) => n.fecha) ?? abiertas[0] };
}
const cuenta = (r) => [r.atrasadas && `${r.atrasadas} atrasada${r.atrasadas > 1 ? "s" : ""}`, `${r.hechas} de ${r.total}`].filter(Boolean).join(" · ");

// ---------- tareas ----------
export function tareasDelFiltro(v, ctx) {
  // Agregar: queda por hacer, con la fecha que hayas escrito, y dentro de lo que tengas elegido.
  const { form, cuando: vista, campo } = agregarTarea(() => (enCaja(filtroDe(ctx)) ? filtroDe(ctx) : undefined));
  // El proyecto elegido se puede abrir completo en la página Proyectos.
  const abrir = el("button", { className: "abrir", textContent: "Abrir ↗", title: "Ver y editar todo en Proyectos",
    onclick: () => irA("proyectos", { caja: filtroDe(ctx) }) });
  const lista = el("div", { className: "desliza grupos" });
  v.querySelector("h3").append(abrir);
  v.append(form, vista, lista);

  return () => {
    const f = filtroDe(ctx), hoy = hoyTexto(), ts = de(f), abiertas = ts.filter((n) => n.estado !== "Hecho").sort(porFecha);
    v.sub.textContent = `${nombreDe(f)} · ${cuenta(resumen(f))}`;
    abrir.hidden = datos.nodo.get(f)?.tipos.clave !== "proyecto"; // Proyectos muestra solo proyectos
    campo.placeholder = enCaja(f) ? `Agregar tarea a ${nombreDe(f)}…` : "Agregar tarea…";
    const cuando = (n) => (dia(n.fecha) ? (dia(n.fecha) < hoy ? "atrasadas" : dia(n.fecha) === hoy ? "hoy" : "proximas") : "sinFecha");
    const grupo = (g) => abiertas.filter((n) => cuando(n) === g);
    const opciones = { sinCaja: datos.nodo.get(f)?.tipos.clave === "proyecto", conFecha: true }; // dentro de un proyecto no hace falta decir cuál
    const hechas = ts.filter((n) => n.estado === "Hecho");
    lista.replaceChildren(
      ...seccion("Atrasadas", listaDeTareas(grupo("atrasadas"), { ...opciones, atrasada: true }), "alerta"),
      ...seccion("Hoy", listaDeTareas(grupo("hoy"), { ...opciones, conFecha: false })),
      ...seccion("Próximas", listaDeTareas(grupo("proximas"), opciones)),
      ...seccion("Sin fecha", listaDeTareas(grupo("sinFecha"), opciones)),
      hechas.length ? el("details", { className: "hechas" }, el("summary", { textContent: `Hechas (${hechas.length})` }), listaDeTareas(hechas, opciones)) : "",
      abiertas.length || hechas.length ? "" : el("p", { className: "vacio", textContent: "No hay tareas aquí. Agrega la primera arriba." }));
  };
}

// ---------- proyectos ----------
export function areasYProyectos(v, ctx) {
  const chips = el("div", { className: "pildoras", role: "group", ariaLabel: "Áreas" });
  const lista = el("ul", { className: "desliza proyectos" });
  v.append(chips, lista);
  let primera = TODAS; // el primer chip: lo que se ve si no has elegido nada
  const areaElegida = () => ctx.area ?? primera;
  const elegir = (filtro, area = areaElegida()) => ctx.cambiar({ filtro, area });

  // Un chip: elige el área (y con eso, qué proyectos se ven y qué tareas).
  const chip = (c) => {
    const b = el("button", { textContent: c.nombre, title: cuenta(c), ariaPressed: String(c.id === areaElegida()),
      onclick: () => elegir(c.id, c.id) });
    if (c.atrasadas) b.classList.add("con-atrasadas");
    if (c.nodo) {
      b.draggable = true; // arrastrar un área sobre otra las reordena
      b.ondragstart = (e) => e.dataTransfer.setData("text/plain", c.id);
      recibir(b, c);
    }
    return b;
  };
  // Un proyecto: su color, su avance y la próxima tarea. Si no le queda nada pendiente, "Cerrar proyecto".
  const proyecto = (p) => {
    const b = el("button", { className: "filtro", ariaPressed: String(p.id === filtroDe(ctx)),
      onclick: () => elegir(filtroDe(ctx) === p.id ? areaElegida() : p.id) },
      el("span", { className: "nombre" }, el("i", { className: "punto" }), p.nombre),
      el("span", { className: "meta" + (p.atrasadas ? " atrasada" : ""), textContent: [p.nodo.tipos.clave !== "proyecto" && p.nodo.tipos.nombre, cuenta(p)].filter(Boolean).join(" · ") }),
      el("span", { className: "barra-p" }, el("span", { style: `width: ${p.total ? (p.hechas / p.total) * 100 : 0}%` })));
    if (p.proxima) b.append(el("span", { className: "proxima", textContent: `Próxima: ${p.proxima.titulo}${p.proxima.fecha ? " · " + corto(dia(p.proxima.fecha)) : ""}` }));
    const li = el("li", { className: "proyecto" }, b);
    li.style.setProperty("--c", colorDeProyecto(p.id));
    // Un ramo no termina por quedarse sin tareas (termina con el semestre): cerrar es solo para proyectos.
    if (!p.abiertas && p.nodo.tipos.clave === "proyecto") li.append(el("button", { className: "cerrar", textContent: "✓ Cerrar proyecto",
      title: "No le queda nada pendiente: marcarlo como hecho", onclick: () => cambiar(p.nodo, { estado: "Hecho" }) }));
    recibir(li, p);
    return li;
  };

  return () => {
    const fila = (n) => ({ id: n.id, nombre: n.titulo, nodo: n, ...resumen(n.id) });
    const proyectos = LISTADOS.flatMap(deTipo).filter((p) => p.estado !== "Hecho").map(fila)
      .sort((a, b) => (a.proxima?.fecha ?? "9").localeCompare(b.proxima?.fecha ?? "9") || a.nombre.localeCompare(b.nombre, "es"));
    // Las áreas que tienen proyectos activos o tareas pendientes, en tu orden; Todas y Sin proyecto, al final.
    const areas = areasEnOrden().map(fila).filter((a) => a.abiertas || proyectos.some((p) => areaDe(p.id) === a.id));
    const filas = [...areas, ...[TODAS, SIN].map((id) => ({ id, nombre: NOMBRE[id], ...resumen(id) }))];
    primera = filas[0].id;

    const area = filas.some((c) => c.id === areaElegida()) ? areaElegida() : TODAS; // el área pudo quedarse sin nada activo
    const visibles = area === TODAS ? proyectos : proyectos.filter((p) => areaDe(p.id) === area);
    const sigue = (f) => f === area || visibles.some((p) => p.id === f) || esObjetivo(datos.nodo.get(f)); // un objetivo se elige en su franja
    if (area !== areaElegida() || !sigue(filtroDe(ctx)))
      return elegir(area, area); // lo elegido se cerró o se borró

    chips.replaceChildren(...filas.map(chip));
    lista.replaceChildren(...visibles.map(proyecto));
    if (!visibles.length) lista.append(el("li", { className: "vacio", textContent: area === SIN
      ? "Aquí están las tareas que no son de ningún proyecto." : "Esta área no tiene proyectos ni tópicos activos." }));
  };
}

// Deja el área "a" justo antes de "antesDe" y guarda el nuevo orden (solo en las que cambiaron de lugar).
function reordenar(a, antesDe) {
  const lista = areasEnOrden().filter((n) => n !== a);
  lista.splice(lista.indexOf(antesDe), 0, a);
  lista.forEach((n, i) => n.props?.orden !== i && cambiarProps(n, { orden: i }));
}

// Soltar una tarea encima de un área o proyecto la mueve ahí; soltar un área sobre otra las reordena.
function recibir(destino, f) {
  const tarea = (e) => datos.nodo.get(e.dataTransfer.getData("text/plain"));
  destino.ondragover = (e) => { e.preventDefault(); destino.classList.add("soltar"); };
  destino.ondragleave = () => destino.classList.remove("soltar");
  destino.ondrop = (e) => {
    e.preventDefault();
    destino.classList.remove("soltar");
    const n = tarea(e);
    if (n?.tipos.clave === "tarea" && datos.padre.get(n.id) !== f.id) mover(n, f.id);
    if (n?.tipos.clave === "area" && f.nodo?.tipos.clave === "area" && n !== f.nodo) reordenar(n, f.nodo);
  };
}
