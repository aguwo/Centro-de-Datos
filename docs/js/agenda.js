// La agenda por horas: una columna por día, cada evento o tarea con hora es un bloque.
// La usan "Tu día" en Hoy (un día, desde ahora) y el calendario (un día o siete).
// Solo sabe dibujar: qué pasa al tocar un bloque, un hueco o al soltar una tarea encima lo decide quien la usa.
import { el, datos, dia, sinHora, colorDe, colorDeSuCaja, sinLoQueYaSeVe } from "./base.js";
import { hoyTexto, hhmm, horaDecimal, ocurreEl, esDia } from "./fechas.js";

const DURACION = 0.75; // si algo no dice cuándo termina, se dibuja de 45 minutos

// ¿Un evento ocurre el día d? Su fecha es la primera vez; la regla de cómo sigue está en fechas.js.
export const ocurre = (n, d) => ocurreEl(dia(n.fecha), n.props, d);

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
//   filtro(x)     qué se muestra (x es un elemento de delDia); por defecto, todo
//   color(n)      el color de cada bloque; por defecto, el de su tipo
//   alTocar(n, d) al hacer clic en un bloque (d: el día, para saber cuál de las repeticiones)
//   alTocarHueco(d, hora)    al hacer clic en un espacio vacío
//   alSoltar(id, d, hora)    al soltar encima algo arrastrado (con su id)
//   (las horas de alTocarHueco y alSoltar vienen redondeadas a media hora)
export function dibujarAgenda(cont, dias, { desde = 7, hasta = 24, alto = 48, todoElDia: conTodoElDia = true,
  filtro = () => true, color = (n) => colorDeSuCaja(n.id) ?? colorDe(n.tipos.clave), alTocar, alTocarHueco, alSoltar } = {}) {
  const hoy = hoyTexto(), ahora = new Date().getHours() + new Date().getMinutes() / 60;
  const plantilla = `52px repeat(${dias.length}, minmax(0, 1fr))`;
  const fila = (clase, ...hijos) => { const f = el("div", { className: clase }, ...hijos); f.style.gridTemplateColumns = plantilla; return f; };
  const bloque = (x, todoElDia) => {
    const b = el("button", { className: "bloque" + (x.tarea ? " tarea" : "") + (todoElDia ? " todo-el-dia" : ""), title: x.n.titulo, onclick: () => alTocar?.(x.n, x.d) },
      el("b", { textContent: sinLoQueYaSeVe(x.n.titulo, esDia) }), todoElDia ? "" : el("small", { textContent: hhmm(x.ini) + (x.fin - x.ini !== DURACION ? "–" + hhmm(x.fin) : "") }));
    b.style.setProperty("--c", color(x.n));
    return b;
  };

  const cabecera = dias.length > 1 && fila("agenda-cab", el("span"), ...dias.map((d) => {
    const f = new Date(d + "T12:00");
    return el("span", { className: d === hoy ? "hoy" : "" }, f.toLocaleDateString("es-CL", { weekday: "short" }) + " ", el("b", { textContent: f.getDate() }));
  }));
  const items = dias.map((d) => delDia(d).filter(filtro));
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
