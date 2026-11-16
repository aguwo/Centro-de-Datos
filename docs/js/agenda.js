// La agenda por horas: una columna por día, cada evento o tarea con hora es un bloque.
// La usan "Tu día" en Hoy (un día, desde ahora) y el calendario (un día o siete).
// Solo sabe dibujar: qué pasa al tocar un bloque, un hueco o al soltar una tarea encima lo decide quien la usa.
import { el, datos, dia, sinHora, colorDe, colorDeSuCaja, sinLoQueYaSeVe, conNodo } from "./base.js";
import { hoyTexto, hhmm, horaDecimal, ocurreEl, esDia } from "./fechas.js";
import { arrastrable } from "./movimiento.js";

const DURACION = 0.75; // si algo no dice cuándo termina, se dibuja de 45 minutos

// ¿Un evento ocurre el día d? Su fecha es la primera vez; la regla de cómo sigue está en fechas.js.
export const ocurre = (n, d) => ocurreEl(dia(n.fecha), n.props, d);
// El próximo día (desde hoy, hasta 60 días) en que ocurre un evento, contando los que se repiten; si no, null.
// La usan Proyectos (sus próximos eventos) y la forma Calendario (formas.js).
export function proximaVez(e, hoy = hoyTexto()) {
  for (let i = 0, d = new Date(hoy + "T12:00"); i < 60; i++, d.setDate(d.getDate() + 1)) {
    const s = d.toLocaleDateString("sv-SE");
    if (ocurre(e, s)) return s;
  }
  return null;
}

// Lo que va en la agenda de un día: eventos (también los que se repiten) y tareas abiertas con esa fecha.
// ini y fin son horas locales (14.5 = 14:30); ini es null si no tiene hora (va arriba, en "todo el día").
export function delDia(d) {
  return datos.nodos
    .filter((n) => n.tipos.clave === "evento" ? ocurre(n, d) : n.tipos.clave === "tarea" && n.estado !== "Hecho" && dia(n.fecha) === d)
    .map((n) => {
      const ini = sinHora(new Date(n.fecha)) ? null : horaDecimal(n.fecha);
      const termina = n.props?.fecha_fin && !sinHora(new Date(n.props.fecha_fin)) ? horaDecimal(n.props.fecha_fin) : null;
      const fin = ini === null ? null : termina > ini ? termina : ini + DURACION;
      return { n, d, ini, fin: Math.max(fin ?? 0, (ini ?? 0) + 0.25), tarea: n.tipos.clave === "tarea" };
    })
    .sort((a, b) => (a.ini ?? -1) - (b.ini ?? -1));
}

// Si dos bloques se pisan, se escalonan (como Google Calendar): cada uno parte un poco más a la derecha y llega
// hasta el borde, encima del anterior. Abajo va lo que se repite (las clases) y encima lo de una vez (una evaluación),
// así lo puntual se lee entero y de lo de siempre queda a la vista su orilla con su color.
const fijo = (x) => !!x.n.props?.repite;
function columnas(items) {
  const grupos = [];
  for (const x of items) {
    const g = grupos.find((g) => g.some((y) => x.ini < y.fin && y.ini < x.fin));
    g ? g.push(x) : grupos.push([x]);
  }
  for (const g of grupos) g.sort((a, b) => fijo(b) - fijo(a) || a.ini - b.ini).forEach((x, i) => Object.assign(x, { col: i, de: g.length }));
  return items;
}
// Marca un lugar con su día (data-d), para saber dónde cae lo que se arrastra.
export const conDia = (lugar, d) => ((lugar.dataset.d = d), lugar);
const ESCALON = 22; // % que se corre cada bloque encima de otro
const LINEA = 15.6; // alto de una línea de texto en un bloque (12px × 1.3, como en estilos.css)

// cont: dónde dibujar. dias: ["2026-11-02", ...]. Opciones:
//   desde, hasta  qué horas se ven (por defecto de 7 a 24)
//   alto          píxeles por hora
//   todoElDia     si se muestra la fila de lo que no tiene hora (por defecto sí)
//   filtro(x)     qué se muestra (x es un elemento de delDia); por defecto, todo
//   color(n)      el color de cada bloque; por defecto, el de su tipo
//   alTocar(n, d) al hacer clic en un bloque (d: el día, para saber cuál de las repeticiones)
//   alTocarHueco(d, hora)    al hacer clic en un espacio vacío
//   alSoltar(id, d, hora)    al soltar encima algo arrastrado (con su id)
//   (las horas de alTocarHueco y alSoltar vienen redondeadas a media hora)
//   alMover(x, d, hora)      con esto los bloques se pueden arrastrar a otro día u hora (paso 126): al soltar dice
//                            adónde (hora redondeada a 15 minutos, o null si cayó en «todo el día»)
export function dibujarAgenda(cont, dias, { desde = 7, hasta = 24, alto = 48, todoElDia: conTodoElDia = true,
  filtro = () => true, color = (n) => colorDeSuCaja(n.id) ?? colorDe(n.tipos.clave), alTocar, alTocarHueco, alSoltar, alMover } = {}) {
  const hoy = hoyTexto(), ahora = new Date().getHours() + new Date().getMinutes() / 60;
  const plantilla = `52px repeat(${dias.length}, minmax(0, 1fr))`;
  const fila = (clase, ...hijos) => { const f = el("div", { className: clase }, ...hijos); f.style.gridTemplateColumns = plantilla; return f; };
  const bloque = (x, todoElDia) => {
    const b = el("button", { className: "bloque" + (x.tarea ? " tarea" : "") + (todoElDia ? " todo-el-dia" : ""), title: x.n.titulo, onclick: () => alTocar?.(x.n, x.d) },
      el("b", { textContent: sinLoQueYaSeVe(x.n.titulo, esDia) }), todoElDia ? "" : el("small", { textContent: hhmm(x.ini) + (x.fin - x.ini !== DURACION ? "–" + hhmm(x.fin) : "") }));
    b.style.setProperty("--c", color(x.n));
    conNodo(b, x.n, x.d);
    if (alMover) moverBloque(b, x);
    return b;
  };

  // Arrastrar un bloque: mientras, una sombra muestra dónde y a qué hora quedaría; al soltar, alMover dice adónde.
  // Los lugares donde se puede soltar son las columnas de horas y las celdas de «todo el día» (llevan data-d).
  const sombra = el("div", { className: "bloque sombra" }, el("b"), el("small"));
  const destinoEn = (p) => {
    const lugar = p && document.elementFromPoint(p.x, p.y)?.closest("[data-d]");
    if (!lugar || !cont.contains(lugar)) return null;
    if (!lugar.classList.contains("dia")) return { lugar, d: lugar.dataset.d, hora: null };
    const r = lugar.getBoundingClientRect(), horas = hasta - desde;
    const hora = Math.round((desde + ((p.arriba - r.top) / r.height) * horas) * 4) / 4; // de a 15 minutos
    return { lugar, d: lugar.dataset.d, hora: Math.min(Math.max(hora, desde), hasta - 0.25) };
  };
  const moverBloque = (b, x) => {
    const dura = x.ini === null ? 1 : x.fin - x.ini;
    let antes = null;
    arrastrable(b, {
      desplaza: cont,
      mover: (p) => {
        const a = destinoEn(p);
        antes?.lugar.classList.remove("soltar");
        antes = a;
        if (a?.hora == null) return sombra.remove(), a?.lugar.classList.add("soltar"); // en «todo el día» se marca la celda
        sombra.style.setProperty("--c", color(x.n));
        Object.assign(sombra.style, { top: (a.hora - desde) * alto + "px", height: Math.max(22, dura * alto - 2) + "px" });
        sombra.firstChild.textContent = sinLoQueYaSeVe(x.n.titulo, esDia);
        sombra.lastChild.textContent = hhmm(a.hora) + "–" + hhmm(Math.min(a.hora + dura, 24));
        if (sombra.parentElement !== a.lugar) a.lugar.append(sombra);
      },
      soltar: (p) => {
        antes?.lugar.classList.remove("soltar");
        sombra.remove();
        const a = p && destinoEn(p);
        if (a && (a.d !== x.d || a.hora !== x.ini)) alMover(x, a.d, a.hora);
      },
    });
  };

  const cabecera = dias.length > 1 && fila("agenda-cab", el("span"), ...dias.map((d) => {
    const f = new Date(d + "T12:00");
    return el("span", { className: d === hoy ? "hoy" : "" }, f.toLocaleDateString("es-CL", { weekday: "short" }) + " ", el("b", { textContent: f.getDate() }));
  }));
  const items = dias.map((d) => delDia(d).filter(filtro));
  const todoElDia = conTodoElDia && items.some((l) => l.some((x) => x.ini === null)) && fila("agenda-todo", el("span", { className: "hora", textContent: "todo el día" }),
    ...items.map((l, i) => conDia(el("div", {}, ...l.filter((x) => x.ini === null).map((x) => bloque(x, true))), dias[i])));

  const cuerpo = fila("agenda-cuerpo", el("div", { className: "horas" },
    ...Array.from({ length: hasta - desde }, (_, i) => { const s = el("span", { className: "hora", textContent: `${desde + i}:00` }); s.style.top = i * alto + "px"; return s; })));
  cuerpo.style.height = (hasta - desde) * alto + "px";
  cuerpo.style.setProperty("--alto", alto + "px");
  dias.forEach((d, i) => {
    const col = conDia(el("div", { className: "dia" + (d === hoy ? " hoy" : "") }), d);
    for (const x of columnas(items[i].filter((x) => x.ini !== null && x.fin > desde))) {
      const b = bloque(x);
      const ini = Math.max(x.ini, desde);
      const altoBloque = Math.max(22, (x.fin - ini) * alto - 2);
      // La hora va debajo del nombre y el nombre usa las líneas que quedan (hasta 3). Si dos líneas no caben holgadas,
      // se aprietan (menos relleno y menos interlineado); solo si ni así caben, la hora va al lado.
      b.classList.toggle("apretado", altoBloque < 2 * LINEA + 6);
      b.classList.toggle("corto", altoBloque < 28);
      b.style.setProperty("--lineas", Math.min(3, Math.max(1, Math.floor((altoBloque - 6) / LINEA) - 1)));
      Object.assign(b.style, { top: (ini - desde) * alto + "px", height: altoBloque + "px",
        left: `calc(${x.col * ESCALON}% + 2px)`, width: `calc(${100 - x.col * ESCALON}% - 4px)`, zIndex: x.col + 1 });
      b.classList.toggle("encima", x.col > 0);
      b.classList.toggle("unico", x.n.tipos.clave === "evento" && !fijo(x)); // lo de una vez (una evaluación) va lleno de color
      col.append(b);
    }
    if (d === hoy && ahora >= desde) { const l = el("i", { className: "ahora" }); l.style.top = (ahora - desde) * alto + "px"; col.append(l); }
    // La hora (redondeada a media hora) del punto donde está el mouse dentro de la columna.
    const horaEn = (e) => { const r = col.getBoundingClientRect(); return Math.min(Math.floor((desde + ((e.clientY - r.top) / r.height) * (hasta - desde)) * 2) / 2, hasta - 1); };
    if (alTocarHueco) col.onclick = (e) => { if (e.target === col) alTocarHueco(d, horaEn(e)); };
    if (alSoltar) {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add("soltar"); };
      col.ondragleave = () => col.classList.remove("soltar");
      col.ondrop = (e) => {
        e.preventDefault(); col.classList.remove("soltar");
        alSoltar(e.dataTransfer.getData("text/plain"), d, horaEn(e));
      };
    }
    cuerpo.append(col);
  });
  cont.replaceChildren(...[cabecera, todoElDia, cuerpo].filter(Boolean));
}
