// El apartado Ajustes (paso 53): sus widgets. Cada control cambia una preferencia de apariencia.js
// y la web cambia al tiro (este mismo apartado, con sus ventanas de vidrio, sirve de vista previa).
//   modo      claro, oscuro o automático (como tu equipo) y el color de acento
//   fondo     el fondo de pantalla: tu paisaje, un degradado o una foto tuya; cuánto se oscurece y si se mueve
//   barra     la barra lateral (paso 55): uno de cinco estilos, qué botones muestra y en qué orden
//   vistas    cómo se ve cada sección del escritorio infinito que tiene varias vistas (paso 81, ej. Salud)
//   ventanas  qué tan transparente y difuminado es el vidrio, las esquinas y la letra
//   cuenta    con qué correo entraste y el botón para salir
import { db, el } from "./base.js";
import { entradasDeLaBarra, dibujarTodo } from "./carcasa.js";
import { APARTADOS } from "./apartados.js";
import { selectorDeVistas, disposicionDe } from "./widgets.js";
import { preferencia, cambiar, TEMAS, TONOS, FONDOS, BARRAS, LETRAS, cssDelFondo, tuFoto, tuCara, ponerFoto, achicar, volverALoDeSiempre } from "./apariencia.js";

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
    if (archivo) ponerFoto("fondo", await achicar(archivo));
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
    const quitar = el("i", { className: "quitar", title: "Quitar tu foto", textContent: "×", onclick: (e) => { e.stopPropagation(); ponerFoto("fondo", null); for (const f of ponerAlDia) f(); } });
    tiles.replaceChildren(
      ...Object.entries(FONDOS).filter(([id]) => id !== "propia").map(([id, f]) => tile(id, f.nombre)),
      tuFoto("fondo") ? tile("propia", FONDOS.propia.nombre, quitar) : "",
      el("button", { type: "button", className: "fondo-tile subir", onclick: () => subir.click() },
        el("b", { textContent: "+" }), el("span", { textContent: tuFoto("fondo") ? "Cambiar tu foto" : "Subir una foto" })));
    const efectivo = p.oscurecer ?? (document.documentElement.dataset.tema === "oscuro" ? 0.45 : 0);
    oscurecer.poner(efectivo);
    auto.hidden = p.oscurecer === null;
    mover.checked = p.mover;
  });
}

// La barra lateral: el estilo (cada opción con un dibujito de cómo queda) y sus botones.
// Los botones se esconden con su casilla y se ordenan arrastrándolos de su asa (⋮⋮). Lo del escritorio infinito va junto en «Escritorio».
export function barra(v) {
  const estilos = opciones("barra", Object.fromEntries(Object.entries(BARRAS).map(([k, b]) => [k, b.nombre])), (valor) => [
    el("i", { className: "muestra-barra " + valor }, el("b"), el("b"), el("b")), el("span", { textContent: BARRAS[valor].nombre })], "barras");
  const detalle = el("p", { className: "pista" }), lista = el("ol", { className: "botones-barra" });
  v.append(titulo("Estilo"), estilos, detalle, titulo("Botones"), lista,
    el("p", { className: "pista", textContent: "Se ve en el computador. En el teléfono la barra es la de abajo, con el mismo orden." }));
  const dibujo = (x) => { const i = el("span", { className: "icono-barra" }); i.innerHTML = `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${x.icono}</svg>`; return i; };
  return conPonerAlDia(() => {
    const p = preferencia(), todos = entradasDeLaBarra().map((e) => e.x);
    estilos.marcar(p.barra);
    detalle.textContent = BARRAS[p.barra].detalle;
    const movibles = todos.filter((x) => !x.lugar && !x.abajo);
    lista.replaceChildren(...movibles.map((x) => {
      const ver = el("input", { type: "checkbox", checked: !p.ocultos.includes(x.id),
        onchange: () => elegir({ ocultos: ver.checked ? p.ocultos.filter((id) => id !== x.id) : [...p.ocultos, x.id] }) });
      const li = el("li", {}, el("span", { className: "asa-mover", textContent: "⋮⋮", title: "Arrastra para ordenar" }),
        el("label", { className: "casilla" }, ver, dibujo(x), el("span", { textContent: x.nombre })));
      li.dataset.id = x.id;
      arrastrable(li, lista, (ids) => {
        // El orden nuevo de los movibles, puesto en sus mismos puestos de la lista completa (así lo del escritorio no se mueve).
        const orden = todos.map((t) => t.id), puestos = movibles.map((m) => orden.indexOf(m.id));
        puestos.forEach((p, i) => { orden[p] = ids[i]; });
        elegir({ orden });
      });
      return li;
    }), ...todos.filter((x) => x.abajo).map((x) => el("li", { className: "fija" }, el("span", { className: "casilla" }, dibujo(x), el("span", { textContent: x.nombre })),
      el("small", { textContent: "siempre abajo" }))));
  });
}

// Arrastrar un <li> de una lista por su asa (.asa-mover): mientras lo mueves cambia de lugar entre sus hermanos,
// y al soltar, listo(ids) recibe el orden nuevo (los data-id de la lista). Sirve con mouse, lápiz o dedo.
function arrastrable(li, lista, listo) {
  li.querySelector(".asa-mover").onpointerdown = (e) => {
    e.preventDefault();
    li.classList.add("arrastrando");
    lista.classList.add("moviendo");
    // Se escucha en la página (no en el asa): al mover el <li> dentro de la lista, el asa perdería el puntero.
    const mover = (m) => {
      const otro = [...lista.children].find((o) => {
        const r = o.getBoundingClientRect();
        return o !== li && !o.classList.contains("fija") && m.clientY > r.top && m.clientY < r.bottom;
      });
      if (otro) otro.getBoundingClientRect().top > li.getBoundingClientRect().top ? otro.after(li) : otro.before(li);
    };
    const soltar = () => {
      removeEventListener("pointermove", mover);
      removeEventListener("pointerup", soltar);
      removeEventListener("pointercancel", soltar);
      li.classList.remove("arrastrando");
      lista.classList.remove("moviendo");
      listo([...lista.children].filter((o) => o.dataset.id).map((o) => o.dataset.id));
    };
    addEventListener("pointermove", mover);
    addEventListener("pointerup", soltar);
    addEventListener("pointercancel", soltar);
  };
}

// Las secciones del escritorio infinito con más de una vista: cuál ver se elige aquí y no en la sección,
// para que el escritorio quede limpio. Se guarda igual que en los demás apartados (widgets.js, elegirVista).
export function vistas(v) {
  const conVistas = APARTADOS.filter((a) => a.lugar && a.vistas?.length > 1);
  const selectores = conVistas.map((a) => selectorDeVistas(a, dibujarTodo));
  v.append(...conVistas.flatMap((a, i) => [titulo(a.nombre), selectores[i]]));
  return () => conVistas.forEach((a, i) => selectores[i].marcar(disposicionDe(a)));
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

// Paso 93: también tu foto de perfil (la que sale al pie de la barra). Se achica a 256 px: es chica y pesa poco.
export function cuenta(v) {
  const correo = el("p", { className: "correo" });
  const subir = el("input", { type: "file", accept: "image/*", hidden: true, onchange: async () => {
    const archivo = subir.files[0];
    subir.value = "";
    if (archivo) ponerFoto("perfil", await achicar(archivo, 256));
    ponerCara();
  } });
  const cara = el("button", { type: "button", className: "cambiar-cara", title: "Cambiar tu foto de perfil", onclick: () => subir.click() });
  const quitar = el("button", { type: "button", className: "chico", textContent: "Quitar la foto", onclick: () => { ponerFoto("perfil", null); ponerCara(); } });
  const ponerCara = () => { cara.replaceChildren(tuCara()); quitar.hidden = !tuFoto("perfil"); };
  v.append(el("div", { className: "tu-cara" }, cara, el("div", {}, correo, quitar)), subir,
    el("button", { type: "button", className: "peligro", textContent: "Salir de la cuenta", onclick: () => db.auth.signOut() }));
  return async () => {
    ponerCara();
    const { data } = await db.auth.getSession();
    correo.textContent = data.session ? "Entraste como " + data.session.user.email : "";
  };
}
