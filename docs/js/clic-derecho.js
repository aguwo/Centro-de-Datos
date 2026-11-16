// Paso 127: clic derecho (o dejar el dedo apretado) sobre una tarea, un evento o cualquier cosa tuya, en cualquier parte
// de la web: sale un menú con lo que se le puede hacer. Cada vista solo marca sus elementos con conNodo(elemento, n, d)
// (base.js); el menú es uno solo y ofrece lo que sirve según lo que es: si tiene estado, terminarla; si tiene fecha,
// moverla; si se repite, saltarse solo ese día. Una opción nueva es una línea en opcionesDe.
import { datos, avisar, dia, sinHora } from "./base.js";
import { hoyTexto, sumarDias, sinHoraISO } from "./fechas.js";
import { menuEn } from "./menu.js";
import { completar, reabrir, cambiar, cambiarProps, moverA } from "./acciones.js";
import { mostrarPanel, formulario, tienePropiedad } from "./panel.js";
import { editar as editarEvento } from "./calendario.js";

// Borrar = archivar (deja de verse, pero se recupera con «Deshacer» o pidiéndoselo al agente).
const borrar = (n) => { cambiar(n, { archivado: true }); avisar(`«${n.titulo}» borrado`, { texto: "Deshacer", hacer: () => cambiar(n, { archivado: false }) }); };

// d: el día en que se vio (solo importa en lo que se repite: cuál de todas las veces).
export function opcionesDe(n, d) {
  const hoy = hoyTexto(), seRepite = !!n.props?.repite, evento = n.tipos.clave === "evento";
  const de = n.fecha && dia(n.fecha); // lo que se repite se mueve entero desde su primera vez (moverA)
  const conFecha = !!de && !seRepite, conHora = conFecha && !sinHora(new Date(n.fecha));
  const hecha = n.estado === "Hecho";
  return [
    { texto: "Abrir", hacer: () => mostrarPanel(n.id) },
    { texto: "Editar…", hacer: () => (evento ? editarEvento(n, { d: d ?? de ?? hoy }) : formulario(n)) },
    "-",
    tienePropiedad(n, "estado") && (hecha ? { texto: "Volver a abrir", hacer: () => reabrir(n) } : { texto: "Marcar como hecha", hacer: () => completar(n) }),
    conFecha && de !== hoy && { texto: "Mover a hoy", hacer: () => moverA(n, de, hoy) },
    conFecha && { texto: "Pasar al día siguiente", hacer: () => moverA(n, de, sumarDias(de, 1)) },
    conFecha && { texto: "Pasar a la próxima semana", hacer: () => moverA(n, de, sumarDias(de, 7)) },
    conHora && { texto: "Quitar la hora (todo el día)", hacer: () => moverA(n, de, de, null) },
    !de && tienePropiedad(n, "fecha") && { texto: "Poner para hoy", hacer: () => cambiar(n, { fecha: sinHoraISO(hoy) }) },
    seRepite && d && { texto: "Saltar solo este día", hacer: () => cambiarProps(n, { excepto: [...(n.props.excepto?.split(",") ?? []), d].join(",") }) },
    "-",
    { texto: "Copiar el nombre", hacer: () => navigator.clipboard?.writeText(n.titulo).then(() => avisar("Nombre copiado")) },
    "-",
    { texto: seRepite ? "Borrar (todas las veces)" : "Borrar", hacer: () => borrar(n) },
  ];
}

// Un solo oído para toda la web. Si ya hay otro menú (Archivos tiene el suyo) o se hizo en un campo para escribir,
// se deja tranquilo; si no hay nodo debajo, sigue el menú de siempre (el zoom, menu.js).
document.addEventListener("contextmenu", (e) => {
  if (e.defaultPrevented || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  const x = e.target.closest?.("[data-nodo]"), n = x && datos.nodo.get(x.dataset.nodo);
  if (n) menuEn(e, opcionesDe(n, x.dataset.dia));
});
