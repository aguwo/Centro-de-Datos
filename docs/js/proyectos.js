// El apartado Proyectos (paso 35): un proyecto completo en una página, para verlo entero y crear o cambiar
// lo que sea. El escritorio infinito queda para mirar y marcar avances.
// Sus widgets comparten ctx.caja (widgets.js): el proyecto abierto, o nada para ver la galería.
//   galeria  (paso 57) una tarjeta por proyecto: su portada, cuánto lleva, si va al día y su siguiente tarea
//   caja     la cabecera: dónde está, el título (se escribe encima), sus datos, la descripción y el avance
//   tablero  sus tareas por estado (arrastrar una a otra columna le cambia el estado) o en lista
//   dentro   sus notas y próximos eventos
// Solo muestra proyectos (paso 35b): los ramos y los objetivos tendrán su propia vista, con su propio diseño.
// Los widgets no saben de proyectos más allá de MUESTRA: otra vista puede reusarlos con otro tipo.
import { el, datos, dia, hora, colorDe, colorDeProyecto, cajasDe, areaDe, dentroDe, escribible, escribiendoEn, sinTildes } from "./base.js";
import { hoyTexto, diasEntre, corto } from "./fechas.js";
import { cambiar, cambiarProps, completar, dentroDeCaja } from "./acciones.js";
import { mostrarPanel, formulario, camposDe, tienePropiedad } from "./panel.js";
import { listaDeTareas, seccion, porFecha, agregarTarea } from "./tareas.js";
import { ocurre } from "./agenda.js";
import { icono, portada, elegir as adivinar, progreso, anillo, pastilla, moverConSuavidad } from "./dibujos.js";

const ESTADOS = ["Por hacer", "En curso", "Esperando", "Hecho"]; // las columnas del tablero (el Inbox son los post-its)
const HECHAS_A_LA_VISTA = 5;
const HOLGURA = 0.1; // cuánto puedes ir detrás del plazo (en fracción) antes de que diga «Atrasado»
const MUESTRA = "proyecto"; // el tipo de caja que muestra esta página

const esCaja = (n) => n?.tipos.clave === MUESTRA;
const terminada = (n) => n.estado === "Hecho";
const estadoDe = (t) => t.estado ?? "Por hacer";
const porNombre = (a, b) => a.titulo.localeCompare(b.titulo, "es");
const porCercania = (a, b) => (dia(a.fecha) || "9999").localeCompare(dia(b.fecha) || "9999"); // las con fecha primero, la más cercana arriba
const de = (clave, caja) => datos.nodos.filter((n) => n.tipos.clave === clave && n.estado !== "Inbox" && cajasDe(n.id).includes(caja));
const punto = (n) => {
  const i = el("i", { className: "punto" });
  i.style.setProperty("--c", n.tipos.clave === "proyecto" ? colorDeProyecto(n.id) : colorDe(n.tipos.clave));
  return i;
};
const elegir = (ctx, caja) => ctx.cambiar({ caja });

// El proyecto abierto, o nada (entonces se ve la galería).
const cajaDe = (ctx) => (esCaja(datos.nodo.get(ctx.caja)) ? datos.nodo.get(ctx.caja) : null);

// El tema de su portada (dibujos.js): el que le pusiste (props.icono) o uno adivinado por su nombre y descripción.
const TEMAS = [[/robot|agente|asistente|inteligencia artificial/i, "chip"], [/minecraft|roblox|juego|servidor/i, "bloques"],
  [/web|p[áa]gina|sitio|tienda|app/i, "web"], [/datos|sql/i, "base"]];
const temaDe = (n) => n.props?.icono ?? adivinar(`${n.titulo} ${n.contenido ?? ""}`, TEMAS, "proyecto");

// Cómo va un proyecto: cuánto lleva hecho, cuánto de su plazo ya pasó y, con eso, un veredicto (salud).
// tiempo: de 0 (empezó) a 1 (vence hoy); null si no tiene fecha de fin.
export function ritmo(n) {
  const hoy = hoyTexto(), ts = de("tarea", n.id), hechas = ts.filter(terminada).length;
  const pendientes = ts.filter((t) => !terminada(t)).sort(porCercania);
  const atrasadas = pendientes.filter((t) => dia(t.fecha) && dia(t.fecha) < hoy);
  const ini = dia(n.fecha) ?? dia(n.creado_en), fin = dia(n.props?.fecha_fin); // sin fecha de inicio, cuenta desde que lo creaste
  const hecho = ts.length ? hechas / ts.length : 0;
  const quedan = fin ? diasEntre(hoy, fin) : null;
  const tiempo = ini && fin ? Math.max(0, Math.min(1, diasEntre(ini, hoy) / Math.max(1, diasEntre(ini, fin)))) : null;
  const [texto, clase] = terminada(n) ? ["Terminado", "va"] : n.estado === "Esperando" ? ["En pausa", "nada"] : !fin ? ["Sin plazo", "nada"]
    : atrasadas.length || quedan < 0 || hecho + HOLGURA < tiempo ? ["Atrasado", "riesgo"] : ["Al día", "bien"];
  return { ts, hechas, hecho, pendientes, atrasadas, ini, fin, quedan, tiempo, salud: { texto, clase } };
}
// Cuándo toca una tarea, corto: "hoy", "atrasada" o el día.
const cuandoToca = (t) => { const d = dia(t.fecha), hoy = hoyTexto(); return !d ? "" : d < hoy ? "atrasada" : d === hoy ? "hoy" : corto(d); };

// ---------- galería ----------
// Arriba, en la barra del apartado, un resumen en pastillas. Debajo, buscador, filtros y una tarjeta por proyecto:
// los activos primero, luego los en pausa y al final los terminados. Tocar una tarjeta abre el proyecto.
const FILTROS = [["todos", "Todos", () => true], ["curso", "En curso", (n) => !terminada(n) && n.estado !== "Esperando"],
  ["pausa", "En pausa", (n) => n.estado === "Esperando"], ["terminados", "Terminados", terminada]];
const orden = (n) => (terminada(n) ? 2 : n.estado === "Esperando" ? 1 : 0);

export function galeria(v, ctx) {
  const buscar = el("input", { type: "search", placeholder: "Buscar un proyecto…", ariaLabel: "Buscar un proyecto" });
  const filtros = el("div", { className: "segmento", role: "group", ariaLabel: "Mostrar" });
  const grilla = el("div", { className: "tarjetas-proyectos" });
  v.append(el("div", { className: "barra-galeria" }, buscar, filtros,
    el("button", { className: "principal", textContent: "+ Nuevo proyecto", onclick: () => formulario(null, { tipos: [MUESTRA] }) })), grilla);
  buscar.oninput = () => dibujar();
  return dibujar;

  function dibujar() {
    // Las tarjetas entran animadas solo si la galería no estaba a la vista (al llegar al apartado o al volver de un proyecto).
    // Si ya se ve, un redibujo (ej. al volver a la pestaña llegan los datos de nuevo) no repite la animación.
    grilla.classList.toggle("animar", !v.checkVisibility());
    v.hidden = !!cajaDe(ctx);
    if (v.hidden) return ctx.barra.replaceChildren(); // el resumen es de la galería: con un proyecto abierto no se ve
    const todas = datos.nodos.filter(esCaja), ritmos = new Map(todas.map((n) => [n.id, ritmo(n)]));
    const activas = todas.filter((n) => !terminada(n) && n.estado !== "Esperando");
    const pendientes = activas.flatMap((n) => ritmos.get(n.id).pendientes);
    const semana = pendientes.filter((t) => dia(t.fecha) && diasEntre(hoyTexto(), dia(t.fecha)) >= 0 && diasEntre(hoyTexto(), dia(t.fecha)) <= 7).sort(porCercania);
    const atrasados = activas.filter((n) => ritmos.get(n.id).salud.texto === "Atrasado").length;
    ctx.barra.replaceChildren(...[
      pastilla("proyecto", `${activas.length} en curso`),
      pastilla("test", `${pendientes.length} tareas pendientes`),
      semana.length && pastilla("calendario", `Esta semana: ${semana[0].titulo}` + (semana.length > 1 ? ` y ${semana.length - 1} más` : "")),
      atrasados && pastilla("alerta", `${atrasados} ${atrasados === 1 ? "atrasado" : "atrasados"}`, "alerta"),
    ].filter(Boolean));

    const filtro = ctx.ver ?? "todos";
    filtros.replaceChildren(...FILTROS.map(([id, texto, pasa]) => el("button", { type: "button", textContent: `${texto} ${todas.filter(pasa).length}`,
      ariaPressed: String(id === filtro), onclick: () => ctx.cambiar({ ver: id }) })));
    const texto = sinTildes(buscar.value.trim()), pasa = FILTROS.find(([id]) => id === filtro)[2];
    const lista = todas.filter((n) => pasa(n) && sinTildes(n.titulo).includes(texto)).sort((a, b) => orden(a) - orden(b) || porNombre(a, b));
    grilla.replaceChildren(...(lista.length ? lista.map((n, i) => tarjeta(n, ritmos.get(n.id), i))
      : [el("p", { className: "vacio vidrio ventana", textContent: todas.length ? "Ningún proyecto con ese nombre." : "Todavía no tienes proyectos. Crea el primero con «+ Nuevo proyecto»." })]));
  }

  // Una tarjeta: portada con su veredicto, nombre y anillo de avance, su siguiente tarea y la barra de lo hecho
  // con una rayita donde debería ir según el plazo.
  function tarjeta(n, r, i) {
    const color = colorDeProyecto(n.id), sig = r.pendientes[0], area = datos.nodo.get(areaDe(n.id))?.titulo;
    const tapa = portada(temaDe(n), color, "", n.props?.portada);
    tapa.append(el("span", { className: "como " + r.salud.clase, textContent: r.salud.texto }));
    const t = el("button", { className: "tarjeta-proyecto", onclick: () => elegir(ctx, n.id) }, tapa,
      el("span", { className: "cuerpo" },
        el("span", { className: "nombre" },
          el("span", {}, el("small", { textContent: [area, n.estado].filter(Boolean).join(" · ") }), el("b", { textContent: n.titulo })),
          anillo(r.hecho)),
        el("span", { className: "sigue" }, icono("flecha"),
          el("span", { textContent: sig?.titulo ?? (r.ts.length ? "Todo hecho" : "Sin tareas todavía") }),
          sig && dia(sig.fecha) ? el("span", { className: "cuenta" + (cuandoToca(sig) === "atrasada" ? " atrasada" : ""), textContent: cuandoToca(sig) }) : ""),
        el("span", { className: "ritmo" },
          el("span", {}, el("span", { textContent: `${r.hechas} de ${r.ts.length} hechas` }),
            el("span", { textContent: r.tiempo !== null ? `plazo ${Math.round(r.tiempo * 100)}%` : r.quedan !== null ? `vence ${corto(r.fin)}` : "sin plazo" })),
          progreso(r.hecho, r.tiempo, "Dónde deberías ir según el plazo"))));
    t.style.setProperty("--c", color);
    t.style.setProperty("--i", i);
    return t;
  }
}

// ---------- cabecera ----------
export function cabecera(v, ctx) {
  return () => {
    const n = cajaDe(ctx);
    // Recién abierto (otro proyecto, o no estaba a la vista): la portada y las tarjetas entran animadas; un redibujo no las repite.
    const animar = v.dataset.id !== n?.id || !v.checkVisibility();
    v.hidden = !n;
    if (!n) return;
    if (escribiendoEn(v) && v.dataset.id === n.id) return; // estás escribiendo aquí: no se pisa
    v.dataset.id = n.id;

    const titulo = escribible("h2", n.titulo, (t) => (t && t !== n.titulo ? cambiar(n, { titulo: t }) : (titulo.textContent = n.titulo)), "titulo-caja");
    const editar = () => formulario(n);
    const puedeTerminar = tienePropiedad(n, "estado");
    // Sus enlaces (ej. «Proyecto en Claude», paso 38c) como botones que abren en otra pestaña.
    const conEnlace = (datos.tipo.get(n.tipos.clave)?.propiedades ?? [])
      .filter((p) => p.tipo === "enlace" && /^https?:\/\//.test(n.props?.[p.clave] ?? ""));
    const enlaces = conEnlace.map((p) => el("a", { className: "boton", href: n.props[p.clave], target: "_blank", rel: "noopener", textContent: p.nombre + " ↗" }));
    const conPortada = tienePropiedad(n, "portada"), foto = elegirFoto(n);
    const acciones = el("div", { className: "acciones-caja" }, ...enlaces,
      conPortada ? el("button", { textContent: "Cambiar portada", ariaExpanded: "false", onclick: (e) => {
        foto.hidden = !foto.hidden;
        e.currentTarget.ariaExpanded = String(!foto.hidden);
        if (!foto.hidden) foto.querySelector("input").focus();
      } }) : "",
      el("button", { textContent: "Editar todo", onclick: editar }),
      puedeTerminar ? el("button", { textContent: terminada(n) ? "Reabrir" : "✓ Terminar",
        onclick: () => cambiar(n, { estado: terminada(n) ? "En curso" : "Hecho" }) }) : "");
    // Dónde está (área › ramo...) y sus datos como fichas; tocar una abre el formulario completo.
    // Los enlaces ya van como botón y la portada se ve arriba: no se repiten como ficha.
    const ruta = cajasDe(n.id).reverse().map((id) => datos.nodo.get(id)?.titulo).filter(Boolean).join(" › ");
    const ficha = (nombre, valor) => el("button", { className: "ficha", onclick: editar }, el("span", { textContent: nombre }), valor);
    const fichas = el("div", { className: "fichas" },
      ...camposDe(n).filter((c) => c.tipo !== "enlace" && c.tipo !== "imagen").map((c) => ficha(c.nombre, c.valor)),
      el("button", { className: "ficha vacia", textContent: "+ Más datos", onclick: editar }));
    const descripcion = el("textarea", { className: "descripcion", value: n.contenido ?? "", rows: 2, ariaLabel: "Descripción",
      placeholder: `¿De qué se trata ${n.titulo}? La idea, con quién, links…` });
    descripcion.onchange = () => cambiar(n, { contenido: descripcion.value.trim() || null });

    // Arriba, la portada (paso 58) a todo el ancho: su foto o el dibujo de su tema. Encima, volver y las acciones;
    // abajo, dónde está, el título y sus datos.
    const volver = el("button", { className: "volver", textContent: "‹ Proyectos", onclick: () => ctx.cambiar({ caja: null }) });
    const heroe = portada(temaDe(n), colorDeProyecto(n.id), "heroe" + (animar ? " animar" : ""), n.props?.portada);
    heroe.append(el("div", { className: "arriba" }, volver, acciones),
      el("div", { className: "pie" }, el("span", { className: "ruta", textContent: ruta ? "en " + ruta : "Sin área" }), titulo, fichas));
    v.replaceChildren(heroe, foto, descripcion, avance(n, animar));
  };
}

// El cuadro para cambiar la portada: pegar el enlace de una foto, o quitarla (vuelve el dibujo). Parte escondido.
function elegirFoto(n) {
  const campo = el("input", { type: "url", value: n.props?.portada ?? "", placeholder: "Pega el enlace de una foto (https://…)", ariaLabel: "Enlace de la foto de portada" });
  const quitar = el("button", { type: "button", textContent: "Quitar foto", hidden: !n.props?.portada, onclick: () => cambiarProps(n, { portada: null }) });
  const f = el("form", { className: "elegir-foto", hidden: true }, campo, el("button", { className: "principal", textContent: "Usar esta foto" }), quitar,
    el("small", { className: "suave", textContent: "Sirve cualquier foto de internet: clic derecho sobre ella › «Copiar dirección de imagen»." }));
  f.onsubmit = (e) => {
    e.preventDefault();
    const url = campo.value.trim();
    if (url && !/^https?:\/\//.test(url)) return campo.setCustomValidity("Tiene que empezar con https://"), campo.reportValidity();
    cambiarProps(n, { portada: url || null });
  };
  campo.oninput = () => campo.setCustomValidity("");
  return f;
}

// Tres tarjetas bajo la portada (paso 59): lo siguiente que toca, cómo vas (hecho vs plazo) y la línea del plazo.
function avance(n, animar) {
  const r = ritmo(n), color = colorDeProyecto(n.id);
  const tarjeta = (titulo, ...cosas) => el("section", { className: "tarjeta-avance" }, el("span", { className: "rotulo", textContent: titulo }), ...cosas);
  const caja = el("div", { className: "avance" + (animar ? " animar" : "") }, siguientePaso(r, tarjeta), ritmoDe(r, tarjeta), plazoDe(n, r, tarjeta));
  caja.style.setProperty("--c", color);
  return caja;
}

// Lo siguiente que toca: la tarea pendiente más cercana, para marcarla de una. Tocar su nombre abre todos sus datos.
function siguientePaso(r, tarjeta) {
  const [sig, despues] = r.pendientes;
  if (!sig) return tarjeta("Siguiente paso", el("p", { className: "vacio", textContent: r.ts.length ? "Todo hecho. ¡Bien!" : "Sin tareas todavía: agrega la primera abajo." }));
  const cuando = cuandoToca(sig);
  return tarjeta("Siguiente paso",
    el("div", { className: "sig" },
      el("button", { className: "marcar", title: "Marcar como hecha", ariaLabel: "Marcar «" + sig.titulo + "» como hecha", onclick: (e) => {
        e.currentTarget.classList.add("hecha"); // el ✓ se ve al tiro, antes de que vuelvan los datos
        completar(sig);
      } }, icono("si")),
      el("button", { className: "nombre", onclick: () => mostrarPanel(sig.id) },
        el("b", { textContent: sig.titulo }),
        el("small", { className: cuando === "atrasada" ? "alerta" : "suave", textContent: cuando ? (cuando === "atrasada" ? "Atrasada, era para el " + corto(dia(sig.fecha)) : "Para " + (cuando === "hoy" ? "hoy" : "el " + cuando)) : "Sin fecha" }))),
    despues ? el("small", { className: "despues suave", textContent: "Después: " + despues.titulo }) : "");
}

// Cómo vas: el anillo con lo hecho, el veredicto y lo que lo explica.
function ritmoDe(r, tarjeta) {
  const pct = (x) => Math.round(x * 100) + "%";
  const texto = r.tiempo === null ? "Ponle fecha de fin y te digo si vas a tiempo."
    : `Llevas ${pct(r.hecho)} hecho y pasó ${pct(r.tiempo)} del plazo.` + (r.atrasadas.length ? ` ${r.atrasadas.length} ${r.atrasadas.length === 1 ? "tarea atrasada" : "tareas atrasadas"}.` : "");
  return tarjeta("Ritmo", el("div", { className: "ritmo-caja" }, anillo(r.hecho),
    el("div", {}, el("span", { className: "como " + r.salud.clase, textContent: r.salud.texto }),
      el("p", { textContent: texto }), el("small", { className: "suave", textContent: `${r.hechas} de ${r.ts.length} tareas hechas` }))));
}

// El plazo como una línea del inicio al fin: lo que ya pasó, la marca de hoy y un punto por cada tarea con fecha
// (de su color si está hecha, de aviso si falta y de alerta si se atrasó). Pasar encima de un punto dice cuál es.
function plazoDe(n, r, tarjeta) {
  if (!r.fin) return tarjeta("Plazo", el("b", { className: "grande", textContent: "Sin plazo" }),
    el("button", { textContent: "Poner fecha de fin", onclick: () => formulario(n) }));
  const quedan = r.quedan > 0 ? `Faltan ${r.quedan} días` : r.quedan === 0 ? "Vence hoy" : `Venció hace ${-r.quedan} días`;
  if (r.tiempo === null) return tarjeta("Plazo", el("b", { className: "grande" + (r.quedan < 0 ? " alerta" : ""), textContent: quedan }), el("small", { className: "suave", textContent: "hasta el " + corto(r.fin) }));
  const lugar = (d) => Math.max(0, Math.min(1, diasEntre(r.ini, d) / Math.max(1, diasEntre(r.ini, r.fin)))) * 100 + "%";
  const hoy = hoyTexto();
  const puntos = r.ts.filter((t) => dia(t.fecha)).map((t) => {
    const d = dia(t.fecha), clase = terminada(t) ? "hecha" : d < hoy ? "atrasada" : "falta";
    const p = el("i", { className: "hito " + clase, title: `${t.titulo} · ${corto(d)}` });
    p.style.left = lugar(d);
    return p;
  });
  const pasado = el("span", { className: "pasado" }), marca = el("b", { className: "hoy", title: "Hoy" });
  pasado.style.width = marca.style.left = r.tiempo * 100 + "%";
  return tarjeta("Plazo", el("b", { className: "grande" + (r.quedan < 0 ? " alerta" : ""), textContent: quedan }),
    el("div", { className: "linea-plazo" }, pasado, ...puntos, marca),
    el("div", { className: "extremos suave" }, el("span", { textContent: corto(r.ini) }), el("span", { textContent: corto(r.fin) })));
}

// ---------- tareas ----------
export function tablero(v, ctx) {
  const vistas = el("div", { className: "segmento", role: "group", ariaLabel: "Ver como" },
    ...[["tablero", "Tablero"], ["lista", "Lista"]].map(([id, texto]) => {
      const b = el("button", { type: "button", textContent: texto, onclick: () => ctx.cambiar({ vista: id }) });
      b.dataset.vista = id;
      return b;
    }));
  const { form, cuando, campo } = agregarTarea(() => cajaDe(ctx)?.id);
  const cuerpo = el("div"); // el tablero mide lo que su contenido; cada columna se desliza por dentro si no cabe
  v.append(el("div", { className: "barra-tareas" }, vistas, form), cuando, cuerpo);
  let antes = {}; // qué se mostraba (proyecto y vista) y qué tareas había en qué estado (paso 60)

  return () => {
    const n = cajaDe(ctx);
    v.hidden = !n;
    if (!n) return;
    const ts = de("tarea", n.id), vista = ctx.vista ?? "tablero";
    v.sub.textContent = `${ts.filter(terminada).length} de ${ts.length} hechas`;
    for (const b of vistas.children) b.setAttribute("aria-pressed", b.dataset.vista === vista);
    campo.placeholder = `Agregar tarea a ${n.titulo}… (ej. «revisar el viernes 18:00»)`;
    // Si es el mismo proyecto y la misma vista y alguna tarea cambió de estado (o llegó o se fue), las tarjetas viajan
    // a su lugar nuevo; si no, se dibuja de una (abrir otro proyecto o un redibujo sin cambios no anima nada).
    const ahora = { vista: n.id + vista, firma: ts.map((t) => t.id + estadoDe(t)).join() };
    const dibujar = () => cuerpo.replaceChildren(vista === "lista" ? enLista(ts, n) : enTablero(ts, n, ctx));
    ahora.vista === antes.vista && ahora.firma !== antes.firma ? moverConSuavidad(cuerpo, dibujar) : dibujar();
    antes = ahora;
  };
}

// Una columna por estado. Arrastrar una tarjeta a otra columna le cambia el estado; tocarla abre todos sus datos.
function enTablero(ts, caja, ctx) {
  const hoy = hoyTexto();
  const tarjeta = (t) => {
    const d = dia(t.fecha), donde = datos.padre.get(t.id) !== caja.id && dentroDe(t.id);
    const b = el("button", { className: "tarjeta" + (terminada(t) ? " hecha" : ""), draggable: true, title: "Toca para ver y editar todo",
      onclick: () => mostrarPanel(t.id) },
      el("span", { className: "t", textContent: t.titulo }),
      el("span", { className: "m" },
        t.props?.prioridad ? el("b", { className: "alta", textContent: t.props.prioridad }) : "",
        d ? el("span", { className: !terminada(t) && d < hoy ? "alerta" : "", textContent: (d === hoy ? "hoy" : corto(d)) + (hora(t.fecha) ? " · " + hora(t.fecha) : "") }) : "",
        donde ? el("span", { textContent: donde }) : ""));
    b.dataset.id = t.id; // así moverConSuavidad la reconoce antes y después de redibujar
    b.ondragstart = (e) => { e.dataTransfer.setData("text/plain", t.id); b.classList.add("arrastrando"); };
    b.ondragend = () => b.classList.remove("arrastrando");
    return b;
  };
  return el("div", { className: "tablero" }, ...ESTADOS.map((estado) => {
    let xs = ts.filter((t) => estadoDe(t) === estado).sort(porFecha);
    if (estado === "Hecho") xs = xs.reverse();
    const todas = estado !== "Hecho" || ctx.verHechas || xs.length <= HECHAS_A_LA_VISTA;
    const col = el("div", { className: "columna-estado" },
      el("header", {}, el("span", { className: "rotulo", textContent: estado }), el("span", { className: "suave", textContent: xs.length })),
      el("div", { className: "tarjetas-estado" }, ...(todas ? xs : xs.slice(0, HECHAS_A_LA_VISTA)).map(tarjeta),
        todas ? "" : el("button", { className: "mas", textContent: `Ver las ${xs.length} hechas`, onclick: () => ctx.cambiar({ verHechas: true }) })));
    col.ondragover = (e) => { e.preventDefault(); col.classList.add("soltar"); };
    col.ondragleave = () => col.classList.remove("soltar");
    col.ondrop = (e) => {
      e.preventDefault();
      col.classList.remove("soltar");
      const t = datos.nodo.get(e.dataTransfer.getData("text/plain"));
      if (t?.tipos.clave !== "tarea" || estadoDe(t) === estado) return;
      // Se mueve al tiro, sin esperar a la base; cuando vuelven los datos, se acomoda en su lugar.
      const tablero = col.closest(".tablero"), suya = tablero.querySelector(`[data-id="${t.id}"]`);
      if (suya) moverConSuavidad(tablero, () => col.querySelector(".tarjetas-estado").prepend(suya));
      estado === "Hecho" ? completar(t) : cambiar(t, { estado });
    };
    return col;
  }));
}

// La misma lista de siempre (marcar, prioridad...), agrupada por estado.
function enLista(ts, caja) {
  const opciones = { conFecha: true, sinCaja: caja.tipos.clave === "proyecto" };
  return el("div", { className: "grupos" }, ...ESTADOS.flatMap((estado) => seccion(estado, listaDeTareas(ts.filter((t) => estadoDe(t) === estado).sort(porFecha), opciones))));
}

// ---------- lo demás ----------
export function dentro(v, ctx) {
  return () => {
    const n = cajaDe(ctx);
    v.hidden = !n;
    if (!n) return;
    const hoy = hoyTexto();
    const notas = de("nota", n.id).sort(porNombre);
    const eventos = de("evento", n.id).map((e) => ({ e, d: proximo(e, hoy) })).filter((x) => x.d).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 5);
    const nuevo = (clave) => el("button", { className: "redondo", textContent: "+", title: `Nueva ${datos.tipo.get(clave)?.nombre.toLowerCase()} aquí`,
      onclick: () => formulario(null, { tipos: [clave], conexion: dentroDeCaja(clave, n.id) }) });
    const pieza = (titulo, boton, cosas, vacio) => el("div", { className: "pieza" },
      el("h4", {}, el("span", { textContent: titulo }), boton),
      cosas.length ? el("ul", {}, ...cosas) : el("p", { className: "vacio", textContent: vacio }));
    const fila = (x, extra, accion) => el("li", {}, el("button", { onclick: accion }, punto(x), el("span", { className: "nombre", textContent: x.titulo }), extra ? el("small", { textContent: extra }) : ""));
    v.replaceChildren(
      pieza("Notas y enlaces", nuevo("nota"), notas.map((x) => fila(x, "", () => mostrarPanel(x.id))), "Ideas, apuntes o links de esto."),
      pieza("Próximos eventos", nuevo("evento"), eventos.map(({ e, d }) => fila(e, d === hoy ? "hoy" : corto(d), () => mostrarPanel(e.id))), "Nada agendado."));
  };
}
// El próximo día (desde hoy, hasta 60 días) en que ocurre un evento, contando los que se repiten.
function proximo(e, hoy) {
  for (let i = 0, d = new Date(hoy + "T12:00"); i < 60; i++, d.setDate(d.getDate() + 1)) {
    const s = d.toLocaleDateString("sv-SE");
    if (ocurre(e, s)) return s;
  }
  return null;
}
