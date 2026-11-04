// Íconos y portadas ilustradas (paso 52). Son trazos SVG escritos aquí mismo: no dependen de imágenes de afuera
// y toman el color del texto que los rodea (currentColor), así un mismo dibujo sirve para cualquier ramo o proyecto.
//   icono(nombre)          un ícono de línea de 24×24, ej. icono("reloj")
//   portada(tema, color)   una franja con el dibujo de un tema, teñida con ese color, y su ícono encima
//   elegir(texto, reglas)  el primer nombre cuya palabra clave aparece en el texto (para adivinar tema o tipo)
//   anillo(fraccion, texto, minimo)  un anillo de avance de 0 a 1, con el texto al centro y, si se da, la marca del mínimo
// Agregar uno = agregarlo a ICONOS (y, si es un tema con dibujo, a DIBUJOS).
import { el } from "./base.js";

const ICONOS = {
  // temas (uno por ramo o proyecto)
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  base: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
  hoja: '<path d="M5 19c0-8 6-13 15-14-1 9-6 15-14 15M5 19l7-7"/>',
  dialogo: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>',
  red: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6.5 6.5l3.5 3.5M17.5 6.5L14 10M12 15v3"/>',
  libro: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  // tipos de evaluación
  certamen: '<path d="M14 4l6 6-10 10H4v-6zM12 6l6 6"/>',
  lab: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-10V3"/>',
  test: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  oral: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  imagen: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  proyecto: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  examen: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11"/>',
  trabajo: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 19h4"/>',
  // lo demás
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  objetivo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  alerta: '<path d="M12 3l9.5 17H2.5z"/><path d="M12 10v4M12 17.5v.5"/>',
  estrella: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  si: '<path d="M5 12l5 5 9-10"/>',
  no: '<path d="M6 6l12 12M18 6L6 18"/>',
};

// Los dibujos de las portadas, en un lienzo de 240×80. Se dibujan con el color del tema (currentColor) a distintas opacidades.
const DIBUJOS = {
  chip: '<g fill="none" stroke="currentColor" stroke-width="2" opacity=".55"><path d="M0 18h56v28h44V26h70M0 62h34v14h80V48h56v32M134 8v26h62v28h44M178 0v16h62"/></g><g fill="currentColor"><circle cx="56" cy="18" r="4"/><circle cx="100" cy="26" r="4"/><circle cx="114" cy="76" r="4"/><circle cx="196" cy="34" r="4"/></g><rect x="142" y="46" width="40" height="26" rx="4" fill="currentColor" opacity=".3"/>',
  base: '<g fill="currentColor" opacity=".35"><path d="M150 20c0-6 44-6 44 0v46c0 6-44 6-44 0z"/></g><g fill="none" stroke="currentColor" stroke-width="2" opacity=".8"><ellipse cx="172" cy="20" rx="22" ry="6"/><path d="M150 36c0 6 44 6 44 0M150 52c0 6 44 6 44 0"/></g><g stroke="currentColor" stroke-width="2" opacity=".45"><path d="M36 22h84M36 38h64M36 54h92M36 70h52"/></g><g fill="currentColor" opacity=".8"><rect x="20" y="18" width="8" height="8" rx="2"/><rect x="20" y="34" width="8" height="8" rx="2"/><rect x="20" y="50" width="8" height="8" rx="2"/></g>',
  hoja: '<circle cx="196" cy="22" r="13" fill="currentColor" opacity=".5"/><path d="M0 64Q44 40 88 58T176 52T240 46V80H0Z" fill="currentColor" opacity=".3"/><path d="M0 74Q66 58 132 72T240 66V80H0Z" fill="currentColor" opacity=".55"/><path d="M46 52q10-24 32-26q-4 22-32 26z" fill="currentColor" opacity=".7"/><path d="M28 22h44M38 30h26M116 16h40" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/>',
  dialogo: '<path d="M124 10h82a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10h-50l-16 14V54h-16a10 10 0 0 1-10-10V20a10 10 0 0 1 10-10z" fill="currentColor" opacity=".3"/><path d="M30 26h56a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H54l-12 10V58H30a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8z" fill="none" stroke="currentColor" stroke-width="2" opacity=".7"/><g fill="currentColor" opacity=".8"><circle cx="46" cy="42" r="3"/><circle cx="58" cy="42" r="3"/><circle cx="70" cy="42" r="3"/></g><path d="M140 30h52M140 40h34" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
  red: '<g fill="none" stroke="currentColor" stroke-width="2" opacity=".5"><path d="M44 24L108 44L172 18M108 44L140 70M108 44L66 68M172 18L212 50L140 70"/></g><g fill="currentColor"><circle cx="44" cy="24" r="7" opacity=".7"/><circle cx="108" cy="44" r="11" opacity=".85"/><circle cx="172" cy="18" r="7" opacity=".7"/><circle cx="140" cy="70" r="6" opacity=".6"/><circle cx="66" cy="68" r="5" opacity=".6"/><circle cx="212" cy="50" r="6" opacity=".6"/></g>',
  libro: '<g fill="currentColor"><rect x="150" y="16" width="14" height="56" rx="2" opacity=".6"/><rect x="168" y="22" width="12" height="50" rx="2" opacity=".4"/><rect x="184" y="12" width="16" height="60" rx="2" opacity=".7"/><rect x="204" y="26" width="10" height="46" rx="2" opacity=".35"/></g><path d="M24 28h80M24 42h96M24 56h60" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/>',
};

const svg = (viewBox, trazos, clase) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("class", clase);
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = trazos;
  return s;
};

export const icono = (nombre) => svg("0 0 24 24", ICONOS[nombre] ?? ICONOS.libro, "icono");

// Un ícono dentro de un cuadrado redondeado, teñido con un color (el del ramo, por ejemplo).
export function insignia(nombre, color, clase = "") {
  const i = el("span", { className: "insignia " + clase }, icono(nombre));
  i.style.setProperty("--c", color);
  return i;
}

export function portada(tema, color, clase = "") {
  const p = el("div", { className: "portada " + clase }, svg("0 0 240 80", DIBUJOS[tema] ?? DIBUJOS.libro, "dibujo"), insignia(tema, color, "grande"));
  p.style.setProperty("--c", color);
  p.querySelector(".dibujo").setAttribute("preserveAspectRatio", "xMidYMid slice");
  return p;
}

export const elegir = (texto, reglas, porDefecto) => reglas.find(([palabras]) => palabras.test(texto ?? ""))?.[1] ?? porDefecto;

// El anillo mide 100 de largo (pathLength), así la fracción se escribe tal cual: 0,52 = 52.
export function anillo(fraccion, texto, minimo) {
  const f = Math.max(0, Math.min(1, fraccion ?? 0)) * 100;
  const marca = minimo == null ? "" : `<line x1="18" y1="1" x2="18" y2="6" class="minimo" transform="rotate(${minimo * 360} 18 18)"/>`;
  return el("span", { className: "anillo" }, svg("0 0 36 36",
    `<circle cx="18" cy="18" r="15" pathLength="100" class="fondo-anillo"/>` +
    `<circle cx="18" cy="18" r="15" pathLength="100" class="avance" stroke-dasharray="${f} 100" transform="rotate(-90 18 18)"/>` + marca, "anillo-svg"),
    el("b", { textContent: texto }));
}
