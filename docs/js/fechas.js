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
