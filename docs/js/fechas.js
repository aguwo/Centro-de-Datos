// Ayudas de fechas. Los días se manejan como texto "2026-11-01": se comparan y ordenan solos.
export const hoyTexto = () => new Date().toLocaleDateString("sv-SE"); // "sv-SE" escribe AAAA-MM-DD
export const sumarDias = (texto, n) => { const d = new Date(texto + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
export const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
export const corto = (texto) => texto.split("-").reverse().slice(0, 2).join("/"); // "2026-11-01" -> "01/11"
export const lunes = (texto) => { const d = new Date(texto + "T12:00:00"); return sumarDias(texto, -((d.getDay() + 6) % 7)); };

// Cómo se guarda un día sin hora: a medianoche UTC (igual que las fechas importadas de Notion).
export const sinHoraISO = (texto) => texto + "T00:00:00+00:00";
// Un día a una hora local (h = 14.5 son las 14:30), como fecha completa para guardar.
export const conHoraISO = (texto, h) => { const d = new Date(texto + "T00:00:00"); d.setMinutes(Math.round(h * 60)); return d.toISOString(); };
// 14.5 -> "14:30"
export const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
// Al revés: "14:30" -> 14.5
export const aHora = (t) => { const [h, m] = t.split(":"); return +h + m / 60; };
// La hora local de una fecha completa como número (14:30 -> 14.5)
export const horaDecimal = (fecha) => { const d = new Date(fecha); return d.getHours() + d.getMinutes() / 60; };

// ---------- Eventos que se repiten (migración 0011) ----------
// ¿Un evento que ocurre por primera vez el día "primero" ocurre también el día d?
// p son sus props: repite (una de las REGLAS), repite_hasta (último día) y excepto ("día,día" que se saltan).
// El conector (supabase/functions/mcp/dias.ts) usa la misma regla; tests/dias.test.ts revisa que digan lo mismo.
const MEDIODIA = (d) => new Date(d + "T12:00:00");
const REGLAS = {
  "Cada día": () => true,
  "Cada semana": (a, b) => a.getDay() === b.getDay(),
  "Días hábiles": (a, b) => b.getDay() % 6 !== 0, // ni sábado (6) ni domingo (0)
  "Cada mes": (a, b) => a.getDate() === b.getDate(),
  "Cada año": (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth(),
};
export function ocurreEl(primero, p, d) {
  p ??= {};
  if (!primero || d < primero || p.excepto?.split(",").includes(d)) return false;
  if (d === primero) return true;
  const regla = REGLAS[p.repite];
  return !!regla && !(p.repite_hasta && d > p.repite_hasta) && regla(MEDIODIA(primero), MEDIODIA(d));
}

// ---------- Fechas escritas (paso 32) ----------
// Saca la fecha y la hora de un texto y deja el resto como título:
//   "llamar al dentista mañana 10:00"   -> { titulo: "llamar al dentista", dia: mañana, hora: 10 }
//   "entregar informe el viernes 18h"   -> el próximo viernes a las 18:00
//   "pagar la luz 15/11", "comprar pan hoy", "examen 3 de diciembre a las 8:30"
// Sin hora queda el día solo; con hora y sin día, hoy. Si no encuentra nada, dia y hora quedan en null.
const DIAS = ["domingo", "lunes", "martes", "mi[eé]rcoles", "jueves", "viernes", "s[aá]bado"];
// ¿Es el nombre de un día de la semana? (con o sin tilde, mayúscula o minúscula)
const DIA = new RegExp(`^(${DIAS.join("|")})$`, "i");
export const esDia = (texto) => DIA.test(texto);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ANTES = "(?:^|\\s)", DESPUES = "(?=\\s|$|[,.;])";
const dosDigitos = (n) => String(n).padStart(2, "0");

export function leerFecha(texto, hoy = hoyTexto()) {
  let resto = texto, dia = null, hora = null;
  const buscar = (patron, alEncontrar) => {
    const m = resto.match(new RegExp(ANTES + patron + DESPUES, "i"));
    if (!m) return false;
    alEncontrar(m);
    resto = resto.replace(m[0], " ");
    return true;
  };
  // La hora: 18:30, 18.30, 18h, 6pm, "a las 18"
  const doce = (h, ampm) => (+h % 12) + (/pm/i.test(ampm) ? 12 : 0); // 12am = 0, 12pm = 12
  buscar("(?:a las? )?(\\d{1,2})[:.](\\d{2})\\s*(?:hrs?|h)?", (m) => { if (+m[1] < 24 && +m[2] < 60) hora = +m[1] + m[2] / 60; })
    || buscar("(?:a las? )?(\\d{1,2})\\s*(am|pm)", (m) => (hora = doce(m[1], m[2])))
    || buscar("(?:a las? )?(\\d{1,2})\\s*(?:hrs?|h)", (m) => (hora = +m[1]))
    || buscar("a las? (\\d{1,2})", (m) => (hora = +m[1]));
  // El día: pasado mañana, mañana, hoy, un día de la semana, 15/11, 15 de noviembre, 15 nov
  const sumar = (n) => () => (dia = sumarDias(hoy, n));
  buscar("(?:para )?pasado ma[ñn]ana", sumar(2))
    || buscar("(?:para )?ma[ñn]ana", sumar(1))
    || buscar("(?:para )?hoy", sumar(0))
    || buscar(`(?:para )?(?:el |este |pr[oó]ximo )?(${DIAS.join("|")})`, (m) => {
      const quiero = DIAS.findIndex((d) => new RegExp(`^${d}$`, "i").test(m[1])), hoyEs = new Date(hoy + "T12:00").getDay();
      dia = sumarDias(hoy, (quiero - hoyEs + 7) % 7 || 7); // el próximo: si hoy es viernes, "viernes" es en una semana
    })
    || buscar("(?:para )?(?:el )?(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?", (m) => (dia = conAnio(hoy, m[2], m[1], m[3])))
    || buscar(`(?:para )?(?:el )?(\\d{1,2})(?: de)? (${MESES.join("|")})[a-záéíóú]*`, (m) =>
      (dia = conAnio(hoy, MESES.indexOf(m[2].toLowerCase().slice(0, 3)) + 1, m[1])));
  if (hora !== null && !dia) dia = hoy;
  return { titulo: resto.replace(/\s+/g, " ").trim(), dia, hora };
}
// Un día y mes sin año es el próximo que viene (el 5/1 escrito en diciembre es en enero del año siguiente).
function conAnio(hoy, mes, diaDelMes, anio) {
  const texto = (y) => `${y}-${dosDigitos(mes)}-${dosDigitos(diaDelMes)}`;
  if (anio) return texto(anio.length === 2 ? "20" + anio : anio);
  const y = +hoy.slice(0, 4);
  return texto(y) < hoy ? texto(y + 1) : texto(y);
}
// Lo leído, listo para guardar en la columna fecha (o null si no había fecha).
export const fechaLeida = ({ dia, hora }) => (!dia ? null : hora === null ? sinHoraISO(dia) : conHoraISO(dia, hora));
