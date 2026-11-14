// Cómo se ve la web (paso 53): el modo claro u oscuro, el color, el fondo, el vidrio, las esquinas y la letra.
// Paso 55: también la barra lateral: su estilo, qué botones muestra y en qué orden (los arma carcasa.js).
// Lo que eliges en Ajustes se aplica al tiro poniendo encima las variables de estilos.css (en el <html>),
// se guarda en este navegador (para que la web abra ya con tu estilo) y en la base, en la tabla
// preferencias (para que te siga al celular u otro computador). Si la base dice otra cosa, gana la base.
import { db, avisar, el } from "./base.js";
import { icono } from "./dibujos.js";

// Lo de siempre: cómo se ve si nunca tocaste nada. null = lo decide el modo (ej. cuánto se oscurece la foto).
export const DE_SIEMPRE = { tema: "auto", tono: null, fondo: "paisaje", oscurecer: null, mover: true, opacidad: 1, desenfoque: 28, radio: 16, letra: "Inter",
  barra: "iconos", ocultos: [], orden: [], retraida: false };

export const TEMAS = { auto: "Automático", claro: "Claro", oscuro: "Oscuro" };
// Los colores de acento (todos se leen bien con letra blanca encima). También se puede elegir cualquier otro.
export const TONOS = { "#2f7a4c": "Verde", "#2563a8": "Azul", "#0f7a7a": "Turquesa", "#6d4bb8": "Violeta",
  "#b83a7a": "Rosa", "#b8571d": "Naranja", "#8a6a12": "Mostaza", "#3f4a56": "Grafito" };
// Los estilos de la barra lateral del computador (estilos.css, :root[data-barra]). En el teléfono el dock no cambia.
export const BARRAS = {
  clasica:  { nombre: "Clásica", detalle: "Ícono y nombre debajo" },
  iconos:   { nombre: "Solo íconos", detalle: "Angosta y limpia; el nombre y su atajo (Alt + número) al pasar el mouse" },
  ancha:    { nombre: "Ancha", detalle: "Ícono y nombre en una fila" },
  flotante: { nombre: "Flotante", detalle: "Una tarjeta de vidrio separada del borde" },
  isla:     { nombre: "Isla", detalle: "Una píldora corta al centro, solo íconos" },
};
// Los fondos: tu foto de siempre, unos degradados y la foto que subas (propia).
export const FONDOS = {
  paisaje:   { nombre: "Paisaje", css: "url(fondo.jpg)" },
  aurora:    { nombre: "Aurora", css: "radial-gradient(at 18% 22%, #3fbf9b 0, transparent 46%), radial-gradient(at 82% 28%, #6b5bd6 0, transparent 50%), linear-gradient(160deg, #0e1a2b, #16324a)" },
  atardecer: { nombre: "Atardecer", css: "linear-gradient(165deg, #ffb27a, #e0607e 48%, #4b2c6b)" },
  oceano:    { nombre: "Océano", css: "linear-gradient(165deg, #0b3d5c, #1d6f8f 52%, #7fc1c9)" },
  bruma:     { nombre: "Bruma", css: "linear-gradient(165deg, #e4ece6, #b9cfc4 52%, #8fa9a0)" },
  noche:     { nombre: "Noche", css: "radial-gradient(at 70% 20%, #2a3550 0, transparent 55%), linear-gradient(170deg, #0b0f14, #1b2430)" },
  propia:    { nombre: "Tu foto" },
};
// Las letras. Inter viene siempre; las otras se bajan de Google Fonts recién cuando las eliges.
export const LETRAS = {
  "Inter": "Inter", "Nunito": "Nunito", "IBM Plex Sans": "IBM Plex Sans",
  "Atkinson Hyperlegible": "Atkinson Hyperlegible", "Del sistema": null,
};

// Dónde queda cada cosa: en este navegador (local) y en la tabla preferencias (base).
const VISUAL = { local: "apariencia", base: "visual" };
// Tus fotos: la del fondo (paso 53) y la de perfil, que sale al pie de la barra (paso 93).
const FOTOS = { fondo: { local: "apariencia-foto", base: "foto-de-fondo" }, perfil: { local: "apariencia-perfil", base: "foto-de-perfil" } };

// Lo guardado se revisa antes de usarlo: lo que no se entiende vuelve a lo de siempre.
// Así un dato raro (o de una versión vieja) nunca deja la web rota.
function limpiar(x) {
  const p = Object.fromEntries(Object.entries(DE_SIEMPRE).map(([k, d]) =>
    [k, x?.[k] !== undefined && (d === null ? ["string", "number"].includes(typeof x[k]) : typeof x[k] === typeof d) ? x[k] : d]));
  if (!TEMAS[p.tema]) p.tema = DE_SIEMPRE.tema;
  if (!FONDOS[p.fondo]) p.fondo = DE_SIEMPRE.fondo;
  if (!(p.letra in LETRAS)) p.letra = DE_SIEMPRE.letra;
  if (p.tono !== null && !/^#[0-9a-f]{6}$/i.test(p.tono)) p.tono = null;
  if (!BARRAS[p.barra]) p.barra = DE_SIEMPRE.barra;
  for (const k of ["ocultos", "orden"]) p[k] = Array.isArray(p[k]) ? p[k].filter((x) => typeof x === "string") : [];
  return p;
}
const leer = (llave) => { try { return localStorage.getItem(llave); } catch { return null; } };
const anotar = (llave, valor) => { try { valor == null ? localStorage.removeItem(llave) : localStorage.setItem(llave, valor); } catch {} };

let elegido = limpiar(JSON.parse(leer(VISUAL.local) || "null"));
const fotos = Object.fromEntries(Object.entries(FOTOS).map(([cual, f]) => [cual, leer(f.local)])); // como texto data:image/jpeg;base64,...

export const preferencia = () => elegido;
export const tuFoto = (cual) => fotos[cual];
export const cssDelFondo = (id) => (id === "propia" ? (fotos.fondo ? `url("${fotos.fondo}")` : null) : FONDOS[id]?.css);
// Tu cara para la barra y Ajustes: tu foto de perfil o, si no hay, un monito.
export function tuCara() {
  if (fotos.perfil) return el("img", { className: "cara", src: fotos.perfil, alt: "" });
  return el("span", { className: "cara sin-foto" }, icono("persona"));
}

// Pone en el <html> lo que elegiste. Lo que está como siempre se quita, y vale lo de estilos.css.
const sistemaOscuro = matchMedia("(prefers-color-scheme: dark)");
function aplicar() {
  const r = document.documentElement, p = elegido;
  const poner = (variable, valor, siempre) => (valor == null || valor === siempre ? r.style.removeProperty(variable) : r.style.setProperty(variable, valor));
  const tema = p.tema === "oscuro" || (p.tema === "auto" && sistemaOscuro.matches) ? "oscuro" : "claro";
  const cambioElTema = r.dataset.tema !== tema;
  r.dataset.tema = tema;
  poner("--tono", p.tono);
  poner("--foto", cssDelFondo(p.fondo) ?? FONDOS.paisaje.css, FONDOS.paisaje.css);
  poner("--oscurecer", p.oscurecer);
  poner("--opacidad", p.opacidad, 1);
  poner("--desenfoque", p.desenfoque + "px", "28px");
  poner("--radio", p.radio + "px", "16px");
  poner("--sans", p.letra === "Inter" ? null : LETRAS[p.letra] ? `"${LETRAS[p.letra]}", system-ui, sans-serif` : "system-ui, sans-serif");
  r.classList.toggle("fondo-quieto", !p.mover);
  r.dataset.barra = p.barra;
  r.classList.toggle("barra-retraida", p.retraida);
  bajarLetra(LETRAS[p.letra]);
  // El mapa lee los colores al dibujarse: si cambió el modo, que se vuelva a dibujar todo (lo atiende main.js).
  if (cambioElTema) document.dispatchEvent(new Event("apariencia"));
  document.dispatchEvent(new Event("barra")); // carcasa.js vuelve a armar la barra (botones y orden)
}
function bajarLetra(nombre) {
  if (!nombre || nombre === "Inter" || document.querySelector(`link[data-letra="${nombre}"]`)) return;
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", dataset: { letra: nombre },
    href: `https://fonts.googleapis.com/css2?family=${nombre.replaceAll(" ", "+")}:wght@400;500;600;700&display=swap` }));
}
sistemaOscuro.addEventListener("change", aplicar); // en Automático, sigue a tu equipo cuando cambia
aplicar();

// Cambiar una o varias preferencias (ej. cambiar({ tema: "oscuro" })): se ve, se anota aquí y, al rato, en la base.
export function cambiar(campos) {
  elegido = limpiar({ ...elegido, ...campos });
  aplicar();
  anotar(VISUAL.local, JSON.stringify(elegido));
  guardarEnLaBase(VISUAL.base, elegido);
}
// Poner una de tus fotos (cual = "fondo" o "perfil"), o null para quitarla. La del fondo se usa al tiro;
// si la quitas estando en uso, vuelve el paisaje. La de perfil se ve al volver a armar la barra.
export function ponerFoto(cual, dataUrl) {
  fotos[cual] = dataUrl;
  anotar(FOTOS[cual].local, dataUrl);
  guardarEnLaBase(FOTOS[cual].base, dataUrl);
  if (cual === "fondo") cambiar({ fondo: dataUrl ? "propia" : elegido.fondo === "propia" ? "paisaje" : elegido.fondo });
  else aplicar();
}
export const volverALoDeSiempre = () => cambiar(DE_SIEMPRE);

// Achica una imagen elegida a 2560 px de ancho como máximo y la devuelve como JPEG en texto (data:...).
// Así una foto del celular de 8 MB queda en unos 300 KB, que caben en el navegador y en la base.
export async function achicar(archivo, ancho = 2560) {
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, ancho / img.width);
  const lienzo = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * escala), height: Math.round(img.height * escala) });
  lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL("image/jpeg", 0.82);
}

// La base: se escribe un momento después del último cambio (mover un control manda una sola vez, no cien).
const pendientes = new Map();
let espera, avisado = false;
function guardarEnLaBase(clave, valor) {
  pendientes.set(clave, valor);
  clearTimeout(espera);
  espera = setTimeout(async () => {
    const { data } = await db.auth.getSession();
    if (!data.session) return;
    const lote = [...pendientes];
    pendientes.clear();
    const borrar = lote.filter(([, v]) => v == null).map(([c]) => c);
    const filas = lote.filter(([, v]) => v != null).map(([clave, valor]) => ({ owner_id: data.session.user.id, clave, valor }));
    const errores = await Promise.all([
      filas.length && db.from("preferencias").upsert(filas),
      borrar.length && db.from("preferencias").delete().in("clave", borrar),
    ]);
    // Si la tabla todavía no existe (falta pegar el SQL 13), queda guardado solo en este navegador.
    if (errores.some((r) => r?.error) && !avisado) {
      avisado = true;
      avisar("Tus ajustes quedaron en este navegador. Para que te sigan a otros equipos falta pegar el SQL 13.");
    }
  }, 700);
}
// Al entrar: trae lo guardado en la base (si hay) y lo aplica. Se llama una vez por inicio de sesión.
export async function traerDeLaBase() {
  const { data, error } = await db.from("preferencias").select("clave, valor").in("clave", [VISUAL.base, ...Object.values(FOTOS).map((f) => f.base)]);
  if (error || !data.length) return;
  const de = Object.fromEntries(data.map((f) => [f.clave, f.valor]));
  for (const [cual, f] of Object.entries(FOTOS)) if (typeof de[f.base] === "string") { fotos[cual] = de[f.base]; anotar(f.local, fotos[cual]); }
  if (de[VISUAL.base]) { elegido = limpiar(de[VISUAL.base]); anotar(VISUAL.local, JSON.stringify(elegido)); }
  aplicar();
  document.dispatchEvent(new Event("apariencia"));
}
