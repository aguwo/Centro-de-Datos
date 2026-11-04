// El apartado Ajustes (paso 53): sus widgets. Cada control cambia una preferencia de apariencia.js
// y la web cambia al tiro (este mismo apartado, con sus ventanas de vidrio, sirve de vista previa).
//   modo      claro, oscuro o automático (como tu equipo) y el color de acento
//   fondo     el fondo de pantalla: tu paisaje, un degradado o una foto tuya; cuánto se oscurece y si se mueve
//   ventanas  qué tan transparente y difuminado es el vidrio, las esquinas y la letra
//   cuenta    con qué correo entraste y el botón para salir
import { db, el } from "./base.js";
import { preferencia, cambiar, TEMAS, TONOS, FONDOS, LETRAS, cssDelFondo, tuFoto, ponerFoto, achicar, volverALoDeSiempre } from "./apariencia.js";

// Las ventanas de Ajustes se ponen al día juntas: un cambio en una (ej. el modo) se ve en las otras.
const ponerAlDia = new Set();
const elegir = (campos) => { cambiar(campos); for (const f of ponerAlDia) f(); };
const conPonerAlDia = (f) => { ponerAlDia.add(f); return f; };

// Un grupo de botones donde se elige uno (aria-pressed marca el elegido).
function opciones(campo, lista, contenido, clase) {
  const caja = el("div", { className: clase, role: "group" });
  const botones = Object.entries(lista).map(([valor, nombre]) => {
    const b = el("button", { type: "button", title: nombre, onclick: () => elegir({ [campo]: valor }) }, ...contenido(valor, nombre));
    b.dataset.valor = valor;
    return b;
  });
  caja.append(...botones);
  caja.marcar = (actual) => { for (const b of botones) b.ariaPressed = String(b.dataset.valor === String(actual)); };
  return caja;
}

// Un control deslizante con su nombre y su valor al lado. mostrar(v) escribe el valor como se lee (ej. "40 %").
function deslizador(nombre, campo, { min, max, paso, mostrar, extremos }) {
  const entrada = el("input", { type: "range", min, max, step: paso, oninput: () => elegir({ [campo]: Number(entrada.value) }) });
  const valor = el("output");
  const fila = el("label", { className: "deslizador" }, el("span", {}, nombre, valor), entrada,
    extremos ? el("small", { className: "extremos" }, el("span", { textContent: extremos[0] }), el("span", { textContent: extremos[1] })) : "");
  fila.poner = (v) => { entrada.value = v; valor.textContent = mostrar(v); };
  return fila;
}
const titulo = (texto) => el("h4", { className: "ajuste", textContent: texto });

export function modo(v) {
  const temas = opciones("tema", TEMAS, (valor, nombre) => [el("i", { className: "muestra-tema " + valor }), el("span", { textContent: nombre })], "temas");
  const tonos = opciones("tono", TONOS, (valor) => [el("i", { style: `background:${valor}` })], "tonos");
  const otro = el("input", { type: "color", title: "Otro color", oninput: () => elegir({ tono: otro.value }) });
  tonos.append(el("label", { className: "otro-tono", title: "Otro color" }, otro));
  v.append(titulo("Modo"), temas, el("p", { className: "pista", textContent: "Automático sigue a tu equipo: claro de día, oscuro de noche si lo tienes así." }),
    titulo("Color"), tonos);
  return conPonerAlDia(() => {
    const p = preferencia();
    temas.marcar(p.tema);
    tonos.marcar(p.tono ?? "#2f7a4c");
    otro.value = p.tono ?? "#2f7a4c";
    otro.parentElement.ariaPressed = String(!!p.tono && !TONOS[p.tono]);
  });
}

export function fondo(v) {
  const tiles = el("div", { className: "fondos", role: "group" });
  const subir = el("input", { type: "file", accept: "image/*", hidden: true, onchange: async () => {
    const archivo = subir.files[0];
    subir.value = "";
    if (archivo) ponerFoto(await achicar(archivo));
    for (const f of ponerAlDia) f();
  } });
  const oscurecer = deslizador("Oscurecer el fondo", "oscurecer", { min: 0, max: 0.8, paso: 0.05, mostrar: (x) => Math.round(x * 100) + " %" });
  const auto = el("button", { type: "button", className: "chico", textContent: "Como el modo", onclick: () => elegir({ oscurecer: null }) });
  oscurecer.querySelector("span").append(auto);
  const mover = el("input", { type: "checkbox", onchange: () => elegir({ mover: mover.checked }) });
  v.append(tiles, subir, oscurecer,
    el("label", { className: "casilla" }, mover, "Mover el fondo al recorrer el escritorio infinito"));
  return conPonerAlDia(() => {
    const p = preferencia();
    const tile = (id, nombre, extra = "") => {
      const b = el("button", { type: "button", className: "fondo-tile", ariaPressed: String(p.fondo === id), onclick: () => elegir({ fondo: id }) },
        el("span", { textContent: nombre }), extra);
      b.style.backgroundImage = cssDelFondo(id);
      return b;
    };
    const quitar = el("i", { className: "quitar", title: "Quitar tu foto", textContent: "×", onclick: (e) => { e.stopPropagation(); ponerFoto(null); for (const f of ponerAlDia) f(); } });
    tiles.replaceChildren(
      ...Object.entries(FONDOS).filter(([id]) => id !== "propia").map(([id, f]) => tile(id, f.nombre)),
      tuFoto() ? tile("propia", FONDOS.propia.nombre, quitar) : "",
      el("button", { type: "button", className: "fondo-tile subir", onclick: () => subir.click() },
        el("b", { textContent: "+" }), el("span", { textContent: tuFoto() ? "Cambiar tu foto" : "Subir una foto" })));
    const efectivo = p.oscurecer ?? (document.documentElement.dataset.tema === "oscuro" ? 0.45 : 0);
    oscurecer.poner(efectivo);
    auto.hidden = p.oscurecer === null;
    mover.checked = p.mover;
  });
}

export function ventanas(v) {
  const opacidad = deslizador("Vidrio", "opacidad", { min: 0.4, max: 1.3, paso: 0.05, extremos: ["Transparente", "Sólido"],
    mostrar: (x) => (x === 1 ? "como siempre" : x < 1 ? "más transparente" : "más sólido") });
  const desenfoque = deslizador("Desenfoque", "desenfoque", { min: 0, max: 48, paso: 2, mostrar: (x) => x + " px" });
  const radio = deslizador("Esquinas", "radio", { min: 0, max: 28, paso: 2, extremos: ["Rectas", "Redondas"], mostrar: (x) => x + " px" });
  const letras = opciones("letra", Object.fromEntries(Object.keys(LETRAS).map((k) => [k, k])), (valor) => [
    el("b", { textContent: "Aa", style: `font-family:${LETRAS[valor] ? `"${LETRAS[valor]}",` : ""} system-ui` }), el("span", { textContent: valor })], "letras");
  v.append(opacidad, desenfoque, radio, titulo("Letra"), letras,
    el("button", { type: "button", className: "de-siempre", textContent: "Volver a como venía", onclick: () => { volverALoDeSiempre(); for (const f of ponerAlDia) f(); } }));
  return conPonerAlDia(() => {
    const p = preferencia();
    opacidad.poner(p.opacidad);
    desenfoque.poner(p.desenfoque);
    radio.poner(p.radio);
    letras.marcar(p.letra);
  });
}

export function cuenta(v) {
  const correo = el("p", { className: "correo" });
  v.append(correo, el("button", { type: "button", className: "peligro", textContent: "Salir de la cuenta", onclick: () => db.auth.signOut() }));
  return async () => {
    const { data } = await db.auth.getSession();
    correo.textContent = data.session ? "Entraste como " + data.session.user.email : "";
  };
}
