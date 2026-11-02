// La agenda por horas: una columna por día, cada evento o tarea con hora es un bloque.
// La usa "Tu día" en Hoy (un día, desde ahora) y la usará el calendario (siete días).
// Solo sabe dibujar: qué pasa al tocar un bloque o al soltar una tarea encima lo decide quien la usa.
import { el, datos, dia, sinHora, colorDe } from "./base.js";
import { hoyTexto, hhmm, horaDecimal } from "./fechas.js";

const DURACION = 0.75; // si algo no dice cuándo termina, se dibuja de 45 minutos

// Lo que va en la agenda de un día: eventos y tareas abiertas con esa fecha.
// ini y fin son horas locales (14.5 = 14:30); ini es null si no tiene hora (va arriba, en "todo el día").
export function delDia(d) {
  return datos.nodos
    .filter((n) => ["evento", "tarea"].includes(n.tipos.clave) && dia(n.fecha) === d && n.estado !== "Hecho")
    .map((n) => {
      const ini = sinHora(new Date(n.fecha)) ? null : horaDecimal(n.fecha);
      const fin = ini === null ? null : n.props?.fecha_fin && dia(n.props.fecha_fin) === d ? horaDecimal(n.props.fecha_fin) : ini + DURACION;
      return { n, ini, fin: Math.max(fin ?? 0, (ini ?? 0) + 0.25), tarea: n.tipos.clave === "tarea" };
    })
    .sort((a, b) => (a.ini ?? -1) - (b.ini ?? -1));
}

// Si dos bloques se pisan, se reparten el ancho (como Google Calendar).
function columnas(items) {
  const grupos = [];
  for (const x of items) {
    const g = grupos.find((g) => g.some((y) => x.ini < y.fin && y.ini < x.fin));
    g ? g.push(x) : grupos.push([x]);
  }
  for (const g of grupos) g.forEach((x, i) => Object.assign(x, { col: i, de: g.length }));
  return items;
}

// cont: dónde dibujar. dias: ["2026-11-02", ...]. Opciones:
//   desde, hasta  qué horas se ven (por defecto de 7 a 24)
//   alto          píxeles por hora
//   todoElDia     si se muestra la fila de lo que no tiene hora (por defecto sí)
//   alTocar(n)    al hacer clic en un bloque
//   alSoltar(id, dia, hora)  al soltar encima algo arrastrado (con su id); la hora viene redondeada a media hora
export function dibujarAgenda(cont, dias, { desde = 7, hasta = 24, alto = 48, todoElDia: conTodoElDia = true, alTocar, alSoltar } = {}) {
  const hoy = hoyTexto(), ahora = new Date().getHours() + new Date().getMinutes() / 60;
  const plantilla = `52px repeat(${dias.length}, minmax(0, 1fr))`;
  const fila = (clase, ...hijos) => { const f = el("div", { className: clase }, ...hijos); f.style.gridTemplateColumns = plantilla; return f; };
  const bloque = (x, todoElDia) => {
    const b = el("button", { className: "bloque" + (x.tarea ? " tarea" : "") + (todoElDia ? " todo-el-dia" : ""), title: x.n.titulo, onclick: () => alTocar?.(x.n) },
      el("b", { textContent: x.n.titulo }), todoElDia ? "" : el("small", { textContent: hhmm(x.ini) + (x.fin - x.ini !== DURACION ? "–" + hhmm(x.fin) : "") }));
    b.style.setProperty("--c", colorDe(x.n.tipos.clave));
    return b;
  };

  const cabecera = dias.length > 1 && fila("agenda-cab", el("span"), ...dias.map((d) => {
    const f = new Date(d + "T12:00");
    return el("span", { className: d === hoy ? "hoy" : "" }, f.toLocaleDateString("es-CL", { weekday: "short" }) + " ", el("b", { textContent: f.getDate() }));
  }));
  const items = dias.map(delDia);
  const todoElDia = conTodoElDia && items.some((l) => l.some((x) => x.ini === null)) && fila("agenda-todo", el("span", { className: "hora", textContent: "todo el día" }),
    ...items.map((l) => el("div", {}, ...l.filter((x) => x.ini === null).map((x) => bloque(x, true)))));

  const cuerpo = fila("agenda-cuerpo", el("div", { className: "horas" },
    ...Array.from({ length: hasta - desde }, (_, i) => { const s = el("span", { className: "hora", textContent: `${desde + i}:00` }); s.style.top = i * alto + "px"; return s; })));
  cuerpo.style.height = (hasta - desde) * alto + "px";
  cuerpo.style.setProperty("--alto", alto + "px");
  dias.forEach((d, i) => {
    const col = el("div", { className: "dia" + (d === hoy ? " hoy" : "") });
    for (const x of columnas(items[i].filter((x) => x.ini !== null && x.fin > desde))) {
      const b = bloque(x);
      const ini = Math.max(x.ini, desde);
      const altoBloque = Math.max(22, (x.fin - ini) * alto - 2);
      b.classList.toggle("corto", altoBloque < 40); // poco espacio: la hora va al lado del nombre
      Object.assign(b.style, { top: (ini - desde) * alto + "px", height: altoBloque + "px",
        left: `calc(${(x.col / x.de) * 100}% + 2px)`, width: `calc(${100 / x.de}% - 4px)` });
      col.append(b);
    }
    if (d === hoy && ahora >= desde) { const l = el("i", { className: "ahora" }); l.style.top = (ahora - desde) * alto + "px"; col.append(l); }
    if (alSoltar) {
      col.ondragover = (e) => { e.preventDefault(); col.classList.add("soltar"); };
      col.ondragleave = () => col.classList.remove("soltar");
      col.ondrop = (e) => {
        e.preventDefault(); col.classList.remove("soltar");
        const r = col.getBoundingClientRect();
        const h = Math.round((desde + ((e.clientY - r.top) / r.height) * (hasta - desde)) * 2) / 2;
        alSoltar(e.dataTransfer.getData("text/plain"), d, Math.min(h, hasta - 1));
      };
    }
    cuerpo.append(col);
  });
  cont.replaceChildren(...[cabecera, todoElDia, cuerpo].filter(Boolean));
}
