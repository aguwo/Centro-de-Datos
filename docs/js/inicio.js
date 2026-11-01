// El Inicio (paso 15): tu panel de control con lo de hoy, lo que viene, el Inbox y los proyectos en curso.
import { db, $, el, avisar, datos, colorDe, recargar } from "./base.js";
import { mostrarPanel } from "./panel.js";

// El día de una fecha, como texto "2026-11-01".
// Las fechas sin hora (las de Notion, guardadas a medianoche UTC) se leen tal cual, sin zona horaria,
// para que no se corran un día. Las que tienen hora se pasan a tu hora local.
const sinHora = (d) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
function dia(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  return sinHora(d) ? fecha.slice(0, 10) : d.toLocaleDateString("sv-SE"); // "sv-SE" escribe AAAA-MM-DD
}
const hora = (fecha) => {
  const d = new Date(fecha);
  return sinHora(d) ? "" : d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
};
const sumarDias = (texto, n) => { const d = new Date(texto + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };

export function dibujarInicio() {
  const { nodos, conexiones, nodo } = datos;
  const hoy = new Date().toLocaleDateString("sv-SE");
  const enSemana = sumarDias(hoy, 7);
  // Para mostrar al lado de cada tarea a qué proyecto o área pertenece.
  const contexto = new Map();
  for (const c of conexiones) {
    if (c.relacion === "pertenece_a" && !contexto.has(c.origen_id)) contexto.set(c.origen_id, nodo.get(c.destino_id).titulo);
  }
  const abierta = (n) => n.estado !== "Hecho";
  const accionable = (n) => ["tarea", "evento"].includes(n.tipos.clave);
  const porFecha = (a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "");

  const deHoy = nodos.filter((n) => accionable(n) && abierta(n) && dia(n.fecha) && dia(n.fecha) <= hoy
                                     && !(n.tipos.clave === "evento" && dia(n.fecha) < hoy)) // eventos pasados no se arrastran
                     .sort(porFecha);
  const proximos = nodos.filter((n) => accionable(n) && abierta(n) && dia(n.fecha) > hoy && dia(n.fecha) <= enSemana).sort(porFecha);
  const inbox = nodos.filter((n) => n.estado === "Inbox" && n.tipos.clave === "tarea");
  const proyectos = nodos.filter((n) => n.tipos.clave === "proyecto" && n.estado === "En curso");

  const fila = (n, { conCheck = true, mostrarDia = false } = {}) => {
    const li = el("li");
    if (conCheck && n.tipos.clave === "tarea") {
      const check = el("input", { type: "checkbox", title: "Marcar como hecha" });
      check.onchange = () => completar(n);
      li.append(check);
    } else {
      const p = el("span", { className: "punto" });
      p.style.setProperty("--c", colorDe(n.tipos.clave));
      li.append(p);
    }
    const nombre = el("a", { textContent: n.titulo, title: n.titulo });
    nombre.onclick = () => mostrarPanel(n.id);
    const d = n.tipos.clave === "proyecto" ? null : dia(n.fecha); // en un proyecto la fecha es su inicio: no se muestra
    const cuando = [mostrarDia || (d && d < hoy) ? d?.split("-").reverse().slice(0, 2).join("/") : "", d ? hora(n.fecha) : ""].filter(Boolean).join(" ");
    const meta = el("span", { className: "meta" + (d && d < hoy ? " atrasada" : ""),
                              textContent: [contexto.get(n.id), cuando].filter(Boolean).join(" · ") });
    li.append(nombre, meta);
    return li;
  };
  const tarjeta = (titulo, lista, vacio, opciones) => el("section", { className: "tarjeta" },
    el("h2", {}, el("span", { textContent: titulo }), el("span", { textContent: String(lista.length) })),
    lista.length ? el("ul", {}, ...lista.map((n) => fila(n, opciones))) : el("p", { className: "vacio", textContent: vacio }));

  $("tablero").replaceChildren(
    tarjeta("Hoy", deHoy, "Nada para hoy. 🎉"),
    tarjeta("Próximos 7 días", proximos, "Semana despejada.", { mostrarDia: true }),
    tarjeta("Inbox", inbox, "Inbox vacío: todo está ordenado."),
    tarjeta("Proyectos en curso", proyectos, "No hay proyectos en curso.", { conCheck: false }),
  );
}

// Marcar hecha. Una tarea repetitiva no se cierra: su fecha salta a la próxima vez que toca.
const SALTO = { Diaria: 1, Semanal: 7, Mensual: 30 };
async function completar(n) {
  const salto = SALTO[n.props?.repeticion];
  const cambios = salto && n.fecha
    ? { fecha: new Date(new Date(n.fecha).getTime() + salto * 864e5).toISOString() }
    : { estado: "Hecho" };
  const { error } = await db.from("nodos").update(cambios).eq("id", n.id);
  if (error) return avisar(error.message);
  recargar();
}

// Captura rápida: crea una tarea en el Inbox, sin fecha ni conexiones. Después la ordenas.
$("form-captura").onsubmit = async (e) => {
  e.preventDefault();
  const titulo = $("captura").value.trim();
  if (!titulo) return;
  const { error } = await db.from("nodos").insert({ tipo_id: datos.tipo.get("tarea").id, titulo, estado: "Inbox" });
  if (error) return avisar(error.message);
  $("captura").value = "";
  recargar();
};
