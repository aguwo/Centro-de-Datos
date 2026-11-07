// Íconos y portadas ilustradas (paso 52). Son trazos SVG escritos aquí mismo: no dependen de imágenes de afuera
// y toman el color del texto que los rodea (currentColor), así un mismo dibujo sirve para cualquier ramo o proyecto.
//   icono(nombre)          un ícono de línea de 24×24, ej. icono("reloj")
//   portada(tema, color, clase, foto)  una franja con el dibujo de un tema, teñida con ese color, y su ícono encima;
//                          con foto (el enlace a una imagen), la foto en vez del dibujo; con la clase "lisa", solo el color
//   elegir(texto, reglas)  el primer nombre cuya palabra clave aparece en el texto (para adivinar tema o tipo)
//   progreso(fraccion, marca, nombre)  una barra delgada de avance de 0 a 1 y, si se da, una rayita en la marca (ej. el mínimo)
//   anillo(fraccion, texto)     un anillo de avance de 0 a 1 con un texto al medio (ej. "54%")
//   pastilla(nombre, texto)     una píldora con un ícono y un texto, para resúmenes y avisos
//   moverConSuavidad(caja, cambiar)  hace el cambio y lo que tiene data-id viaja de su lugar viejo al nuevo
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
  web: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  bloques: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
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
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  no: '<path d="M6 6l12 12M18 6L6 18"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  // salud (paso 63): hábitos, comida y macros
  balanza: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.6-2"/>',
  fuego: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  carne: '<path d="M14.5 4a5.5 5.5 0 0 1 5.5 5.5c0 3-2.5 5.5-5.5 5.5-1 0-2-.3-2.7-.8l-3.6 3.6a2 2 0 1 1-2.8 2.8 2 2 0 1 1 2.8-2.8l3.6-3.6c-.5-.8-.8-1.7-.8-2.7A5.5 5.5 0 0 1 14.5 4z"/>',
  grano: '<path d="M12 21V8M12 8c-3 0-4-3-4-5 3 0 4 2 4 5zM12 8c3 0 4-3 4-5-3 0-4 2-4 5zM12 14c-3 0-4-3-4-5 3 0 4 2 4 5zM12 14c3 0 4-3 4-5-3 0-4 2-4 5z"/>',
  gota: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  plato: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  pildora: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 10l7 7"/>',
  caja: '<path d="M4 8h16M6 8v11h12V8M9 4h6v4"/>',
  lista: '<path d="M4 6h9M4 12h9M4 18h6M15 15l2.5 2.5L22 13"/>',
  loto: '<circle cx="12" cy="5" r="2"/><path d="M5 20c2-5 12-5 14 0M8 13.5l4-3 4 3"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  pesa: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  taza: '<path d="M4 9h12v5a5 5 0 0 1-10 0zM16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>',
  manzana: '<path d="M12 7c-4-2-8 1-7 6 1 5 4 8 7 6 3 2 6-1 7-6 1-5-3-8-7-6zM12 7c0-2 1-3 3-4"/>',
  corazon: '<path d="M20.8 5.6a5 5 0 0 0-7.6-.6L12 6.2l-1.2-1.2a5 5 0 0 0-7.1 7.1L12 20.4l8.3-8.3a5 5 0 0 0 .5-6.5z"/>',
};

// Los dibujos de las portadas, en un lienzo de 240×80. Se dibujan con el color del tema (currentColor) a distintas opacidades.
const DIBUJOS = {
  chip: '<g fill="none" stroke="currentColor" stroke-width="2" opacity=".55"><path d="M0 18h56v28h44V26h70M0 62h34v14h80V48h56v32M134 8v26h62v28h44M178 0v16h62"/></g><g fill="currentColor"><circle cx="56" cy="18" r="4"/><circle cx="100" cy="26" r="4"/><circle cx="114" cy="76" r="4"/><circle cx="196" cy="34" r="4"/></g><rect x="142" y="46" width="40" height="26" rx="4" fill="currentColor" opacity=".3"/>',
  base: '<g fill="currentColor" opacity=".35"><path d="M150 20c0-6 44-6 44 0v46c0 6-44 6-44 0z"/></g><g fill="none" stroke="currentColor" stroke-width="2" opacity=".8"><ellipse cx="172" cy="20" rx="22" ry="6"/><path d="M150 36c0 6 44 6 44 0M150 52c0 6 44 6 44 0"/></g><g stroke="currentColor" stroke-width="2" opacity=".45"><path d="M36 22h84M36 38h64M36 54h92M36 70h52"/></g><g fill="currentColor" opacity=".8"><rect x="20" y="18" width="8" height="8" rx="2"/><rect x="20" y="34" width="8" height="8" rx="2"/><rect x="20" y="50" width="8" height="8" rx="2"/></g>',
  hoja: '<circle cx="196" cy="22" r="13" fill="currentColor" opacity=".5"/><path d="M0 64Q44 40 88 58T176 52T240 46V80H0Z" fill="currentColor" opacity=".3"/><path d="M0 74Q66 58 132 72T240 66V80H0Z" fill="currentColor" opacity=".55"/><path d="M46 52q10-24 32-26q-4 22-32 26z" fill="currentColor" opacity=".7"/><path d="M28 22h44M38 30h26M116 16h40" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/>',
  dialogo: '<path d="M124 10h82a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10h-50l-16 14V54h-16a10 10 0 0 1-10-10V20a10 10 0 0 1 10-10z" fill="currentColor" opacity=".3"/><path d="M30 26h56a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H54l-12 10V58H30a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8z" fill="none" stroke="currentColor" stroke-width="2" opacity=".7"/><g fill="currentColor" opacity=".8"><circle cx="46" cy="42" r="3"/><circle cx="58" cy="42" r="3"/><circle cx="70" cy="42" r="3"/></g><path d="M140 30h52M140 40h34" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
  red: '<g fill="none" stroke="currentColor" stroke-width="2" opacity=".5"><path d="M44 24L108 44L172 18M108 44L140 70M108 44L66 68M172 18L212 50L140 70"/></g><g fill="currentColor"><circle cx="44" cy="24" r="7" opacity=".7"/><circle cx="108" cy="44" r="11" opacity=".85"/><circle cx="172" cy="18" r="7" opacity=".7"/><circle cx="140" cy="70" r="6" opacity=".6"/><circle cx="66" cy="68" r="5" opacity=".6"/><circle cx="212" cy="50" r="6" opacity=".6"/></g>',
  libro: '<g fill="currentColor"><rect x="150" y="16" width="14" height="56" rx="2" opacity=".6"/><rect x="168" y="22" width="12" height="50" rx="2" opacity=".4"/><rect x="184" y="12" width="16" height="60" rx="2" opacity=".7"/><rect x="204" y="26" width="10" height="46" rx="2" opacity=".35"/></g><path d="M24 28h80M24 42h96M24 56h60" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/>',
  web: '<g fill="none" stroke="currentColor" stroke-width="2" opacity=".7"><rect x="126" y="10" width="100" height="62" rx="6"/><path d="M126 23h100"/></g><g fill="currentColor"><circle cx="135" cy="16.5" r="2.5" opacity=".8"/><circle cx="143" cy="16.5" r="2.5" opacity=".8"/><circle cx="151" cy="16.5" r="2.5" opacity=".8"/><rect x="136" y="32" width="52" height="8" rx="3" opacity=".55"/><rect x="136" y="46" width="80" height="5" rx="2" opacity=".35"/><rect x="136" y="56" width="64" height="5" rx="2" opacity=".35"/><rect x="196" y="32" width="20" height="8" rx="3" opacity=".7"/></g><path d="M0 76Q40 54 80 66T160 62T240 58V80H0Z" fill="currentColor" opacity=".25"/>',
  bloques: '<g fill="currentColor"><rect x="150" y="42" width="22" height="22" opacity=".55"/><rect x="172" y="42" width="22" height="22" opacity=".35"/><rect x="194" y="42" width="22" height="22" opacity=".55"/><rect x="161" y="20" width="22" height="22" opacity=".75"/><rect x="183" y="20" width="22" height="22" opacity=".45"/><rect x="172" y="-2" width="22" height="22" opacity=".3"/><rect x="0" y="64" width="240" height="16" opacity=".25"/><rect x="0" y="64" width="240" height="4" opacity=".45"/><rect x="40" y="38" width="9" height="26" opacity=".5"/><rect x="28" y="20" width="33" height="22" opacity=".35"/></g>',
  proyecto: '<g fill="currentColor"><rect x="136" y="16" width="44" height="54" rx="5" opacity=".3"/><rect x="186" y="16" width="44" height="40" rx="5" opacity=".3"/></g><g fill="currentColor" opacity=".8"><rect x="142" y="24" width="32" height="10" rx="3"/><rect x="142" y="40" width="32" height="10" rx="3" opacity=".6"/><rect x="192" y="24" width="32" height="10" rx="3"/></g><path d="M24 30h80M24 44h60M24 58h88" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/>',
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

export function portada(tema, color, clase = "", foto) {
  const p = el("div", { className: "portada " + clase }, svg("0 0 240 80", DIBUJOS[tema] ?? DIBUJOS.libro, "dibujo"), insignia(tema, color, "grande"));
  p.style.setProperty("--c", color);
  if (/^https?:\/\//.test(foto ?? "")) { // la foto va encima del dibujo; si no carga, se sigue viendo el dibujo
    const img = el("img", { className: "foto", src: foto, alt: "", loading: "lazy", decoding: "async" });
    img.onerror = () => img.remove();
    p.querySelector(".dibujo").after(img);
    p.classList.add("con-foto");
  }
  p.querySelector(".dibujo").setAttribute("preserveAspectRatio", "xMidYMid slice");
  return p;
}

export const elegir = (texto, reglas, porDefecto) => reglas.find(([palabras]) => palabras.test(texto ?? ""))?.[1] ?? porDefecto;

// Una barra delgada de avance (0 a 1), con el color --c de lo que la rodea. marca (0 a 1, opcional): una rayita ahí; nombre: lo que dice al pasar encima.
export function progreso(fraccion, marca, nombre = "Mínimo") {
  const relleno = el("i");
  relleno.style.width = Math.max(0, Math.min(1, fraccion ?? 0)) * 100 + "%";
  const b = el("span", { className: "progreso" }, relleno);
  if (marca != null) {
    const raya = el("b", { title: `${nombre}: ${Math.round(marca * 100)}%` });
    raya.style.left = marca * 100 + "%";
    b.append(raya);
  }
  return b;
}

// Un anillo de avance (0 a 1) con un texto al medio. pathLength=100 deja escribir el avance como porcentaje directo.
export function anillo(fraccion, texto) {
  const pct = Math.round(Math.max(0, Math.min(1, fraccion ?? 0)) * 100);
  const a = el("span", { className: "anillo-avance" }, svg("0 0 44 44",
    `<circle cx="22" cy="22" r="18" pathLength="100" class="pista"/>${pct ? `<circle cx="22" cy="22" r="18" pathLength="100" class="lleno" stroke-dasharray="100" stroke-dashoffset="${100 - pct}"/>` : ""}`, "aro"),
    el("b", { textContent: texto ?? pct + "%" }));
  return a;
}

export const pastilla = (nombre, texto, clase = "") => el("span", { className: "pastilla " + clase }, icono(nombre), texto);

// Hace un cambio en la caja (cambiar) y anima lo que se movió: cada elemento con data-id viaja desde donde estaba
// hasta donde quedó, y lo nuevo aparece. Usa View Transitions del navegador, que dibuja el viaje por encima de todo
// (así una tarjeta cruza de una columna a otra sin cortarse). Sin soporte, con «reducir movimiento» o si la caja
// no está a la vista, solo hace el cambio.
export function moverConSuavidad(caja, cambiar) {
  if (!document.startViewTransition || !caja.checkVisibility() || matchMedia("(prefers-reduced-motion: reduce)").matches) return cambiar();
  const nombrar = (nombre) => caja.querySelectorAll("[data-id]").forEach((x) => (x.style.viewTransitionName = nombre(x)));
  nombrar((x) => "m-" + x.dataset.id);
  const t = document.startViewTransition(() => { cambiar(); nombrar((x) => "m-" + x.dataset.id); });
  t.finished.finally(() => nombrar(() => ""));
}
