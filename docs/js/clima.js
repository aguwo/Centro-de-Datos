// El tiempo de hoy y un consejo práctico. Los datos vienen de Open-Meteo (gratis, sin clave).
// Se piden una vez cada media hora; entre medio se reusa lo último.
import { el } from "./base.js";

// La ciudad. Por ahora se cambia aquí; más adelante será un ajuste tuyo guardado en la base.
export const CIUDAD = { nombre: "Concepción", lat: -36.83, lon: -73.05 };

const URL = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
  latitude: CIUDAD.lat, longitude: CIUDAD.lon, timezone: "auto", forecast_days: 1,
  current: "temperature_2m,weather_code",
  hourly: "temperature_2m,precipitation_probability",
  daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
});

// Códigos del cielo (los de la OMM que usa Open-Meteo): desde qué código vale cada descripción.
const CIELO = [[0, "Despejado", "sol"], [1, "Poco nublado", "sol-nube"], [3, "Nublado", "nube"], [45, "Niebla", "nube"],
  [51, "Llovizna", "lluvia"], [61, "Lluvia", "lluvia"], [71, "Nieve", "nieve"], [80, "Chubascos", "lluvia"], [95, "Tormenta", "lluvia"]];
const ICONO = {
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  "sol-nube": '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 20h9a4 4 0 0 0 .4-8 5 5 0 0 0-9.6 1.6A3.2 3.2 0 0 0 8 20z"/>',
  nube: '<path d="M7 19h10a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.4 2A3.5 3.5 0 0 0 7 19z"/>',
  lluvia: '<path d="M7 15h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.8A3.2 3.2 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  nieve: '<path d="M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.8A3.2 3.2 0 0 0 7 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01"/>',
};
const cielo = (codigo) => CIELO.filter(([desde]) => codigo >= desde).at(-1);

let guardado = null, pedido = 0;
async function pronostico() {
  if (!guardado || Date.now() - pedido > 30 * 60_000) {
    const r = await fetch(URL);
    if (!r.ok) throw new Error("Open-Meteo respondió " + r.status);
    guardado = await r.json();
    pedido = Date.now();
  }
  return guardado;
}

// Las horas que quedan del día: [{ h: 14, t: 18, lluvia: 20 }, ...]
const horasDe = (p) => p.hourly.time.map((t, i) => ({ h: +t.slice(11, 13), t: Math.round(p.hourly.temperature_2m[i]), lluvia: p.hourly.precipitation_probability[i] ?? 0 }));

// Un consejo práctico con lo que queda del día. Se elige el primero que aplique.
export function consejo(horas, ahora = new Date().getHours()) {
  const quedan = horas.filter((x) => x.h >= ahora);
  const lluvia = quedan.find((x) => x.lluvia >= 60);
  if (lluvia) return `Va a llover cerca de las ${lluvia.h}:00 (${lluvia.lluvia} %). Lleva paraguas o sal antes.`;
  const salir = quedan.filter((x) => x.h >= 8 && x.h <= 20 && x.lluvia < 30).sort((a, b) => b.t - a.t)[0];
  const noche = horas.find((x) => x.h === 21);
  const partes = [];
  if (salir) partes.push(`La mejor hora para salir es a las ${salir.h}:00 (${salir.t}°).`);
  if (salir?.t >= 28) partes.push("Hace calor: toma agua.");
  if (noche && noche.t <= 12 && ahora < 21) partes.push(`Lleva chaqueta para la noche: a las 21:00 baja a ${noche.t}°.`);
  return partes.join(" ") || "Buen día para lo que tengas planeado.";
}

// Dibuja la ventana del tiempo dentro de cont.
export async function dibujarClima(cont) {
  try {
    const p = await pronostico();
    const [, texto, icono] = cielo(p.current.weather_code);
    const horas = horasDe(p), ahora = new Date().getHours();
    const proximas = horas.filter((x) => x.h > ahora && x.h % 2 === 0).slice(0, 5);
    const ahoraDiv = el("div", { className: "clima-ahora" });
    ahoraDiv.innerHTML = `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${ICONO[icono]}</svg>`;
    ahoraDiv.append(
      el("div", {}, el("b", { textContent: Math.round(p.current.temperature_2m) + "°" }), el("span", { textContent: texto })),
      el("dl", {}, el("dt", { textContent: "Máx" }), el("dd", { textContent: Math.round(p.daily.temperature_2m_max[0]) + "°" }),
        el("dt", { textContent: "Mín" }), el("dd", { textContent: Math.round(p.daily.temperature_2m_min[0]) + "°" }),
        el("dt", { textContent: "Lluvia" }), el("dd", { textContent: (p.daily.precipitation_probability_max[0] ?? 0) + " %" })));
    cont.replaceChildren(ahoraDiv,
      proximas.length ? el("ol", { className: "clima-horas" }, ...proximas.map((x) => el("li", {}, el("span", { textContent: x.h + ":00" }), el("b", { textContent: x.t + "°" })))) : "",
      el("p", { className: "consejo", textContent: consejo(horas, ahora) }));
  } catch {
    cont.replaceChildren(el("p", { className: "vacio", textContent: "No pude traer el clima. Lo intento de nuevo en un rato." }));
  }
}
