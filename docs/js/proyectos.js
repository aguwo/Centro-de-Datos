// El apartado Proyectos (paso 35): una caja (área, ramo, proyecto, objetivo...) completa en una página,
// para verla entera y crear o cambiar lo que sea. El escritorio infinito queda para mirar y marcar avances.
// Sus widgets comparten ctx.caja (widgets.js): la que elegiste en el índice.
//   indice   todas tus cajas como árbol (área › ramo › proyecto), con buscador; las terminadas, plegadas
//   caja     la cabecera: tipo, dónde está, el título (se escribe encima), sus datos, la descripción y el avance
//   tablero  sus tareas por estado (arrastrar una a otra columna le cambia el estado) o en lista
//   dentro   lo demás que tiene adentro: otras cajas, notas y eventos
// Una caja es cualquier nodo cuyo tipo tiene "nivel" (paso 19) y es de los MODULOS de aquí: no hay nada escrito solo para proyectos.
import { el, datos, dia, hora, colorDe, colorDeProyecto, cajasDe, dentroDe, escribible, escribiendoEn } from "./base.js";
import { hoyTexto, corto } from "./fechas.js";
import { cambiar, completar, dentroDeCaja } from "./acciones.js";
import { mostrarPanel, formulario, camposDe, tienePropiedad } from "./panel.js";
import { listaDeTareas, seccion, porFecha, agregarTarea } from "./tareas.js";
import { ocurre } from "./agenda.js";

const ESTADOS = ["Por hacer", "En curso", "Esperando", "Hecho"]; // las columnas del tablero (el Inbox son los post-its)
const HECHAS_A_LA_VISTA = 5;
const DIA = 864e5;
// Los módulos cuyas cajas se ven aquí. Las de otros módulos (las categorías de Finanzas, por ejemplo)
// tendrán su propio apartado.
const MODULOS = ["General", "Productividad"];

// Una caja es un nodo cuyo tipo tiene nivel (área, tópico, proyecto, objetivo...).
const esCaja = (n) => {
  const t = n && datos.tipo.get(n.tipos.clave);
  return t?.nivel != null && MODULOS.includes(t.modulo);
};
const terminada = (n) => n.estado === "Hecho";
const estadoDe = (t) => t.estado ?? "Por hacer";
const sinTildes = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const porNombre = (a, b) => a.titulo.localeCompare(b.titulo, "es");
const de = (clave, caja) => datos.nodos.filter((n) => n.tipos.clave === clave && n.estado !== "Inbox" && cajasDe(n.id).includes(caja));
const punto = (n) => {
  const i = el("i", { className: "punto" + (n.tipos.clave === "objetivo" ? " anillo" : "") });
  i.style.setProperty("--c", n.tipos.clave === "proyecto" ? colorDeProyecto(n.id) : colorDe(n.tipos.clave));
  return i;
};
const elegir = (ctx, caja) => ctx.cambiar({ caja });

// La caja elegida; si no hay (o ya no existe), el primer proyecto activo, o la primera caja.
function cajaDe(ctx) {
  const n = datos.nodo.get(ctx.caja);
  if (esCaja(n)) return n;
  const cajas = datos.nodos.filter(esCaja).sort(porNombre);
  return cajas.find((c) => c.tipos.clave === "proyecto" && !terminada(c)) ?? cajas[0];
}

// ---------- índice ----------
export function indice(v, ctx) {
  const buscar = el("input", { type: "search", placeholder: "Buscar…", ariaLabel: "Buscar un proyecto, ramo o área" });
  const arbol = el("nav", { className: "desliza arbol", ariaLabel: "Tus cajas" });
  const nueva = el("button", { className: "nueva", textContent: "+ Nuevo proyecto",
    onclick: () => formulario(null, { tipos: ["proyecto", "objetivo", "topico", "area"].filter((c) => datos.tipo.has(c)) }) });
  v.append(buscar, arbol, nueva);

  function dibujar() {
    const elegida = cajaDe(ctx)?.id, cajas = datos.nodos.filter(esCaja);
    // Cuántas tareas pendientes hay en cada caja (contando las de sus cajas de adentro).
    const pendientes = new Map();
    for (const t of datos.nodos) if (t.tipos.clave === "tarea" && t.estado !== "Hecho" && t.estado !== "Inbox")
      for (const c of cajasDe(t.id)) pendientes.set(c, (pendientes.get(c) ?? 0) + 1);
    const item = (n, nivel = 0) => {
      const b = el("button", { className: "item" + (nivel ? "" : " raiz"), ariaCurrent: n.id === elegida ? "page" : "false",
        onclick: () => elegir(ctx, n.id) }, punto(n), el("span", { className: "nombre", textContent: n.titulo }),
        pendientes.get(n.id) ? el("span", { className: "n", textContent: pendientes.get(n.id) }) : "");
      b.style.setProperty("--sangria", nivel);
      return b;
    };
    const texto = sinTildes(buscar.value.trim());
    if (texto) { // buscando: una lista simple con lo que coincide
      const hay = cajas.filter((n) => sinTildes(n.titulo).includes(texto)).sort(porNombre);
      return arbol.replaceChildren(...(hay.length ? hay.map((n) => item(n, 1)) : [el("p", { className: "vacio", textContent: "Nada con ese nombre." })]));
    }
    // El árbol: cada caja activa con las suyas debajo (por tipo y nombre). Las terminadas, al final y plegadas.
    const orden = (n) => datos.tipo.get(n.tipos.clave)?.orden ?? 0;
    const hijas = (id) => cajas.filter((c) => datos.padre.get(c.id) === id && !terminada(c)).sort((a, b) => orden(a) - orden(b) || porNombre(a, b));
    const rama = (n, nivel) => [item(n, nivel), ...hijas(n.id).flatMap((h) => rama(h, nivel + 1))];
    const raices = cajas.filter((c) => !esCaja(datos.nodo.get(datos.padre.get(c.id))) && !terminada(c)).sort((a, b) => orden(a) - orden(b) || porNombre(a, b));
    const hechas = cajas.filter(terminada).sort(porNombre);
    arbol.replaceChildren(...raices.flatMap((r) => rama(r, 0)),
      hechas.length ? el("details", { className: "terminadas", open: hechas.some((h) => h.id === elegida) },
        el("summary", { textContent: `Terminadas (${hechas.length})` }), ...hechas.map((n) => item(n, 1))) : "");
  }
  buscar.oninput = dibujar;
  return dibujar;
}

// ---------- cabecera ----------
export function cabecera(v, ctx) {
  return () => {
    const n = cajaDe(ctx);
    if (!n) return v.replaceChildren(el("p", { className: "vacio", textContent: "Todavía no tienes proyectos. Crea el primero con «+ Nuevo proyecto»." }));
    if (escribiendoEn(v) && v.dataset.id === n.id) return; // estás escribiendo aquí: no se pisa
    v.dataset.id = n.id;

    const tipo = el("span", { className: "chip", textContent: n.tipos.nombre });
    tipo.style.setProperty("--c", colorDe(n.tipos.clave));
    const titulo = escribible("h2", n.titulo, (t) => (t && t !== n.titulo ? cambiar(n, { titulo: t }) : (titulo.textContent = n.titulo)), "titulo-caja");
    const editar = () => formulario(n);
    const puedeTerminar = tienePropiedad(n, "estado");
    const acciones = el("div", { className: "acciones-caja" },
      el("button", { textContent: "Editar todo", onclick: editar }),
      puedeTerminar ? el("button", { textContent: terminada(n) ? "Reabrir" : "✓ Terminar",
        onclick: () => cambiar(n, { estado: terminada(n) ? "En curso" : "Hecho" }) }) : "");
    // Sus datos como fichas; tocar cualquiera abre el formulario completo.
    const ruta = cajasDe(n.id).reverse().map((id) => datos.nodo.get(id)?.titulo).filter(Boolean).join(" › ");
    const ficha = (nombre, valor) => el("button", { className: "ficha", onclick: editar }, el("span", { textContent: nombre }), valor);
    const fichas = el("div", { className: "fichas" },
      ...(ruta ? [ficha("Dentro de", ruta)] : []),
      ...camposDe(n).map((c) => ficha(c.nombre, c.valor)),
      el("button", { className: "ficha vacia", textContent: "+ Más datos", onclick: editar }));
    const descripcion = el("textarea", { className: "descripcion", value: n.contenido ?? "", rows: 2, ariaLabel: "Descripción",
      placeholder: `¿De qué se trata ${n.titulo}? La idea, con quién, links…` });
    descripcion.onchange = () => cambiar(n, { contenido: descripcion.value.trim() || null });

    v.replaceChildren(el("div", { className: "arriba" }, tipo, el("span", { className: "suave" }, ruta ? "en " + ruta.split(" › ").at(-1) : ""), acciones),
      el("div", { className: "nombre-caja" }, punto(n), titulo), fichas, descripcion, avance(n));
  };
}

// Tres datos: cuánto va hecho, cuánto queda del plazo y qué está atrasado.
function avance(n) {
  const hoy = hoyTexto(), ts = de("tarea", n.id), hechas = ts.filter(terminada).length;
  const atrasadas = ts.filter((t) => !terminada(t) && dia(t.fecha) && dia(t.fecha) < hoy).sort(porFecha);
  const barra = (pct, color) => {
    const b = el("span", { className: "barra-p" }, el("span", { style: `width: ${Math.max(0, Math.min(100, pct))}%` }));
    if (color) b.style.setProperty("--c", color);
    return b;
  };
  const dato = (etiqueta, valor, ...resto) => el("div", { className: "dato" }, el("span", { className: "rotulo", textContent: etiqueta }), valor, ...resto);
  // El plazo: de la fecha de inicio a la de fin (si las tiene).
  const ini = dia(n.fecha), fin = dia(n.props?.fecha_fin);
  let plazo = dato("Plazo", el("b", { textContent: "Sin plazo" }), el("small", { className: "suave", textContent: "Ponle una fecha de fin en «Editar todo»." }));
  if (fin) {
    const quedan = Math.round((new Date(fin) - new Date(hoy)) / DIA);
    const total = ini ? Math.max(1, (new Date(fin) - new Date(ini)) / DIA) : null;
    plazo = dato("Plazo", el("b", { className: quedan < 0 ? "alerta" : "", textContent: quedan > 0 ? `Faltan ${quedan} días` : quedan === 0 ? "Vence hoy" : `Venció hace ${-quedan} días` }),
      total ? barra(((total - quedan) / total) * 100, "var(--suave)") : el("small", { className: "suave", textContent: "hasta el " + corto(fin) }));
  }
  return el("div", { className: "avance" },
    dato("Tareas hechas", el("b", { textContent: `${hechas} de ${ts.length}` }), barra(ts.length ? (hechas / ts.length) * 100 : 0, n.tipos.clave === "proyecto" ? colorDeProyecto(n.id) : null)),
    plazo,
    dato("Atrasadas", el("b", { className: atrasadas.length ? "alerta" : "", textContent: String(atrasadas.length) }),
      el("small", { className: "suave", textContent: atrasadas.length ? "la más vieja, del " + corto(dia(atrasadas[0].fecha)) : "Vas al día." })));
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
  const cuerpo = el("div", { className: "desliza" });
  v.append(el("div", { className: "barra-tareas" }, vistas, form), cuando, cuerpo);

  return () => {
    const n = cajaDe(ctx);
    if (!n) return cuerpo.replaceChildren();
    const ts = de("tarea", n.id), vista = ctx.vista ?? "tablero";
    v.sub.textContent = `${ts.filter(terminada).length} de ${ts.length} hechas`;
    for (const b of vistas.children) b.setAttribute("aria-pressed", b.dataset.vista === vista);
    campo.placeholder = `Agregar tarea a ${n.titulo}… (ej. «revisar el viernes 18:00»)`;
    cuerpo.replaceChildren(vista === "lista" ? enLista(ts, n) : enTablero(ts, n, ctx));
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
    b.ondragstart = (e) => e.dataTransfer.setData("text/plain", t.id);
    return b;
  };
  return el("div", { className: "tablero" }, ...ESTADOS.map((estado) => {
    let xs = ts.filter((t) => estadoDe(t) === estado).sort(porFecha);
    if (estado === "Hecho") xs = xs.reverse();
    const todas = estado !== "Hecho" || ctx.verHechas || xs.length <= HECHAS_A_LA_VISTA;
    const col = el("div", { className: "columna-estado" },
      el("header", {}, el("span", { className: "rotulo", textContent: estado }), el("span", { className: "suave", textContent: xs.length })),
      ...(todas ? xs : xs.slice(0, HECHAS_A_LA_VISTA)).map(tarjeta),
      todas ? "" : el("button", { className: "mas", textContent: `Ver las ${xs.length} hechas`, onclick: () => ctx.cambiar({ verHechas: true }) }));
    col.ondragover = (e) => { e.preventDefault(); col.classList.add("soltar"); };
    col.ondragleave = () => col.classList.remove("soltar");
    col.ondrop = (e) => {
      e.preventDefault();
      col.classList.remove("soltar");
      const t = datos.nodo.get(e.dataTransfer.getData("text/plain"));
      if (t?.tipos.clave !== "tarea" || estadoDe(t) === estado) return;
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
    if (!n) return v.replaceChildren();
    const hoy = hoyTexto();
    const hijas = datos.nodos.filter((c) => esCaja(c) && datos.padre.get(c.id) === n.id).sort(porNombre);
    const notas = de("nota", n.id).sort(porNombre);
    const eventos = de("evento", n.id).map((e) => ({ e, d: proximo(e, hoy) })).filter((x) => x.d).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 5);
    const nuevo = (clave) => el("button", { className: "redondo", textContent: "+", title: `Nueva ${datos.tipo.get(clave)?.nombre.toLowerCase()} aquí`,
      onclick: () => formulario(null, { tipos: [clave], conexion: dentroDeCaja(clave, n.id) }) });
    const pieza = (titulo, boton, cosas, vacio) => el("div", { className: "pieza" },
      el("h4", {}, el("span", { textContent: titulo }), boton || ""),
      cosas.length ? el("ul", {}, ...cosas) : el("p", { className: "vacio", textContent: vacio }));
    const fila = (x, extra, accion) => el("li", {}, el("button", { onclick: accion }, punto(x), el("span", { className: "nombre", textContent: x.titulo }), extra ? el("small", { textContent: extra }) : ""));
    v.replaceChildren(
      pieza("Adentro", null, hijas.map((h) => fila(h, h.tipos.nombre, () => elegir(ctx, h.id))), "No tiene otras cajas adentro."),
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
