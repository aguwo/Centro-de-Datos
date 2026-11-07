// Íconos y portadas (paso 52). Los íconos son trazos SVG escritos aquí mismo: no dependen de imágenes de afuera
// y toman el color del texto que los rodea (currentColor), así un mismo ícono sirve para cualquier ramo o proyecto.
//   icono(nombre)          un ícono de línea de 24×24, ej. icono("reloj")
//   portada(tema, color, clase, foto)  una franja del color del ramo o proyecto con el ícono de su tema encima;
//                          con foto (el enlace a una imagen), la foto sobre el color
//   elegir(texto, reglas)  el primer nombre cuya palabra clave aparece en el texto (para adivinar tema o tipo)
//   progreso(fraccion, marca, nombre)  una barra delgada de avance de 0 a 1 y, si se da, una rayita en la marca (ej. el mínimo)
//   anillo(fraccion, texto)     un anillo de avance de 0 a 1 con un texto al medio (ej. "54%")
//   pastilla(nombre, texto)     una píldora con un ícono y un texto, para resúmenes y avisos
//   moverConSuavidad(caja, cambiar)  hace el cambio y lo que tiene data-id viaja de su lugar viejo al nuevo
// Agregar uno = agregarlo a ICONOS.
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
  const p = el("div", { className: "portada " + clase }, insignia(tema, color, "grande"));
  p.style.setProperty("--c", color);
  if (/^https?:\/\//.test(foto ?? "")) { // la foto encima del color; si no carga, queda el color
    const img = el("img", { className: "foto", src: foto, alt: "", loading: "lazy", decoding: "async" });
    img.onerror = () => { img.remove(); p.classList.remove("con-foto"); };
    p.prepend(img);
    p.classList.add("con-foto");
  }
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
