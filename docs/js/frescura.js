// Paso 114: avisos de datos viejos. Lo que llega solo (los gastos del banco, la asistencia del portal de la U, EV@) puede
// dejar de llegar sin que nadie se entere: un secreto que falta, el PC apagado, una clave que cambió. Aquí se mira
// cuándo llegó lo último de cada fuente y, si pasó más de lo normal, arriba de Hoy sale un aviso con qué revisar.
//
// Las fuentes están en FUENTES: agregar una = agregar un objeto ahí. Cada fuente tiene:
//   nombre      cómo se llama en el aviso («Los gastos del banco»)
//   icono       su dibujo (dibujos.js)
//   ultimo()    el día de lo último que llegó (AAAA-MM-DD), o nada si nunca llegó nada
//   dias        cuántos días sin nada nuevo todavía es normal
//   aplica()    (opcional) si ahora tiene sentido esperarla (ej. la asistencia, solo con ramos en curso)
//   revisar     qué hacer para que vuelva a llegar, en pasos cortos
import { el, datos, dia, flotante } from "./base.js";
import { hoyTexto, diasEntre, corto } from "./fechas.js";
import { insignia } from "./dibujos.js";

// El día del registro más nuevo que cumple filtro (ej. los gastos que anotó la función correos traen props.correo).
const ultimoRegistro = (filtro) => datos.registros.filter(filtro).map((r) => dia(r.fecha)).sort().at(-1);
const ramosEnCurso = () => datos.nodos.filter((n) => n.tipos.clave === "ramo" && n.estado !== "Hecho");

export const FUENTES = [
  {
    id: "banco", nombre: "Los gastos del banco", icono: "billetera", dias: 7,
    ultimo: () => ultimoRegistro((r) => ["gasto", "ingreso"].includes(r.clase) && r.props?.correo),
    revisar: [
      "En GitHub, revisa que la acción «Publicar agente» termine bien (necesita el secreto SUPABASE_ACCESS_TOKEN).",
      "En Supabase, la función «correos» necesita su secreto CORREOS_CLAVE.",
      "En tu Gmail, el script de Google (correos/Codigo.gs) tiene que tener su activador de cada 15 minutos.",
    ],
  },
  {
    id: "portal", nombre: "La asistencia de la U", icono: "persona", dias: 4,
    ultimo: () => ultimoRegistro((r) => r.clase === "asistencia" && r.props?.portal),
    aplica: () => ramosEnCurso().length > 0,
    revisar: [
      "Prende el PC: universidad-pc sube la asistencia cada 3 horas mientras está prendido.",
      "Si sigue sin llegar, corre otra vez instalar.ps1 en la carpeta universidad-pc.",
      "Si cambiaste tu clave de la U, guárdala de nuevo con guardar-clave.ps1.",
    ],
  },
  {
    // Paso 115: la copia de EV@ corre dos veces al día y deja en cada ramo cuándo fue (props.eva_al_dia).
    id: "eva", nombre: "La copia de EV@", icono: "libro", dias: 2,
    ultimo: () => ramosEnCurso().map((n) => n.props?.eva_al_dia && dia(n.props.eva_al_dia)).filter(Boolean).sort().at(-1),
    aplica: () => ramosEnCurso().some((n) => n.props?.eva),
    revisar: [
      "Publica la función «eva» de nuevo (la acción «Publicar agente» de GitHub, o a mano con supabase functions deploy eva).",
      "Si cambiaste tu clave de EV@, el token EVA_TOKEN de Supabase deja de servir: saca uno nuevo y guárdalo como secreto.",
      "En Supabase, revisa que la tarea programada de la copia (pg_cron) siga activa.",
    ],
  },
];

// Ocultar un aviso por unos días («Ya sé»): se guarda en este navegador, hasta qué día no se muestra.
const OCULTO = "datos-viejos-oculto", POR = 7;
const ocultos = () => { try { return JSON.parse(localStorage.getItem(OCULTO)) ?? {}; } catch { return {}; } };
function ocultar(id, hasta) {
  try { localStorage.setItem(OCULTO, JSON.stringify({ ...ocultos(), [id]: hasta })); } catch {}
}

// Las fuentes que están viejas hoy, cada una con { fuente, ultimo (día, o null si nunca llegó nada), hace (días) }.
export function viejas(hoy = hoyTexto()) {
  const callados = ocultos();
  return FUENTES.filter((f) => !f.aplica || f.aplica()).map((fuente) => {
    const ultimo = fuente.ultimo() ?? null;
    return { fuente, ultimo, hace: ultimo && diasEntre(ultimo, hoy) };
  }).filter((v) => (!v.ultimo || v.hace > v.fuente.dias) && !(callados[v.fuente.id] >= hoy));
}

// Los avisos, listos para poner arriba de una ventana. Sin nada viejo, no se dibuja nada.
// alCambiar() redibuja la ventana (al tocar «Ya sé» el aviso se va).
export function avisosDeDatos(alCambiar) {
  const lista = viejas();
  if (!lista.length) return "";
  return el("div", { className: "datos-viejos" }, ...lista.map(({ fuente, ultimo, hace }) =>
    el("div", { className: "dato-viejo", role: "status" },
      insignia(fuente.icono, "var(--aviso)"),
      el("p", {}, el("b", { textContent: fuente.nombre + ": " }),
        ultimo ? `lo último llegó hace ${hace} días (el ${corto(ultimo)}).` : "todavía no llega nada."),
      el("button", { className: "pildora", textContent: "¿Qué reviso?", onclick: () => explicar(fuente) }),
      el("button", { className: "callar", textContent: "Ya sé", title: `No avisar por ${POR} días`, onclick: () => {
        const d = new Date(); d.setDate(d.getDate() + POR);
        ocultar(fuente.id, d.toLocaleDateString("sv-SE"));
        alCambiar();
      } }))));
}

function explicar(fuente) {
  flotante(`${fuente.nombre}: qué revisar`, el("ol", { className: "pasos-revisar" }, ...fuente.revisar.map((t) => el("li", { textContent: t }))));
}
