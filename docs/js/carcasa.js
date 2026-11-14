// La carcasa del escritorio: el dock con un botón por apartado, el cambio de apartado,
// el dock que se esconde solo. (Paso 53: sin barra arriba; cada apartado dice su nombre en su título.)
// Paso 35c: en el computador el dock es una barra lateral fija (estilos.css), y los apartados del
// escritorio (los que tienen "lugar") van juntos en un solo botón, "Escritorio". No sabe nada de ningún apartado en particular:
// todo lo lee de APARTADOS (apartados.js). El lienzo movible está en escritorio.js.
import { $, el } from "./base.js";
import { APARTADOS, CAJONES } from "./apartados.js";
import { iniciarEscritorio, enEscritorio, mirar } from "./escritorio.js";
import { montar } from "./widgets.js";
import { preferencia, cambiar, tuCara } from "./apariencia.js";
import { conResorte, curvaDeResorte } from "./dibujos.js";

let actual = APARTADOS[0];
let enElEscritorio = APARTADOS.find((a) => a.lugar); // la última sección del escritorio que viste: "Escritorio" vuelve ahí
// El botón "Escritorio" de la barra lateral (en el teléfono no se ve: ahí cada sección tiene el suyo).
const ESCRITORIO = { id: "escritorio", nombre: "Escritorio",
  icono: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>' };
export const apartadoActual = () => actual.id;

// Muestra un apartado y esconde los demás. Queda en la dirección (#mapa) para volver con atrás o recargar.
// Si está en el escritorio, se ven todos los del escritorio y la cámara va hasta él.
export function ir(id) {
  actual = APARTADOS.find((a) => a.id === id) ?? APARTADOS[0];
  const juntos = enEscritorio(actual);
  for (const a of APARTADOS) $(a.id).classList.toggle("oculto", a !== actual && !(juntos && enEscritorio(a)));
  $("escritorio").classList.toggle("oculto", !actual.lugar);
  if (actual.lugar) enElEscritorio = actual;
  marcar();
  document.title = actual.nombre + " · Martita";
  // La dirección no se toca si trae la respuesta del inicio de sesión (#access_token=...): la lee Supabase.
  if (location.hash.slice(1) !== actual.id && !location.hash.includes("=")) history.replaceState(null, "", "#" + actual.id);
  for (const a of APARTADOS) if (atrasados.has(a.id) && !$(a.id).classList.contains("oculto")) dibujarApartado(a);
  if (juntos) mirar(actual.id);
  actual.alMostrar?.();
}

// En la barra: cuál es el apartado donde estás y qué cajón está abierto.
function marcar() {
  for (const b of $("dock").querySelectorAll("[data-apartado]")) b.setAttribute("aria-current", b.dataset.apartado === actual.id ? "page" : "false");
  $("dock").querySelector("[data-escritorio]")?.setAttribute("aria-current", actual.lugar ? "page" : "false");
  for (const b of $("dock").querySelectorAll("[data-cajon]")) b.setAttribute("aria-expanded", $(b.dataset.cajon).classList.contains("abierto"));
  moverMarca();
}
// Paso 93: el fondo del elegido es una sola pieza (.marca) que viaja de un botón al otro en vez de apagarse
// en uno y prenderse en otro. Se pone sobre el botón elegido que se ve (offsetParent es null si está escondido).
// Si no se usa en este estilo, estilos.css la esconde.
// Paso 98: viaja con el mismo resorte de la cámara del escritorio. Cada borde tiene su resorte, y el borde que va
// adelante es más rígido que el de atrás: así, al viajar, la marca se estira un poco hacia donde va y al llegar
// se recoge, como una gota. La primera vez llega sin viajar.
const RESORTE = { adelante: 26, atras: 20, barra: 14 }; // más rígido = llega más rápido; «barra» es el de las transiciones de CSS
let marca = null; // la marca de la barra que se ve ahora y su ir() (conResorte); se rehace al rearmar la barra
function moverMarca() {
  const dock = $("dock"), b = [...dock.querySelectorAll('[aria-current="page"]')].find((b) => b.offsetParent);
  if (!marca || marca.el !== dock.querySelector(".marca")) marca = nuevaMarca(dock.querySelector(".marca"));
  if (!marca.el) return;
  marca.el.classList.toggle("sin-elegido", !b);
  if (!b) return;
  const meta = { izq: b.offsetLeft, der: b.offsetLeft + b.offsetWidth, arriba: b.offsetTop, abajo: b.offsetTop + b.offsetHeight };
  // En cada eje, hacia donde va el centro: el borde de adelante tira (rígido) y el de atrás lo sigue (blando).
  const ahora = marca.ahora ?? meta, fuerza = {};
  for (const [inicio, fin] of [["izq", "der"], ["arriba", "abajo"]]) {
    const va = Math.sign(meta[inicio] + meta[fin] - ahora[inicio] - ahora[fin]); // +1 hacia la derecha o abajo, -1 al revés, 0 quieto
    fuerza[fin] = va < 0 ? RESORTE.atras : RESORTE.adelante;
    fuerza[inicio] = va > 0 ? RESORTE.atras : RESORTE.adelante;
  }
  marca.ir(meta, fuerza, !!marca.ahora);
}
// La marca y cómo se mueve: dibuja sus cuatro bordes como --x, --y, --w, --h (estilos.css los usa).
function nuevaMarca(pieza) {
  const m = { el: pieza, ahora: null };
  m.ir = conResorte((v) => {
    m.ahora = { ...v };
    for (const [k, n] of Object.entries({ x: v.izq, y: v.arriba, w: v.der - v.izq, h: v.abajo - v.arriba })) pieza.style.setProperty("--" + k, n + "px");
  });
  return m;
}

// Los apartados con widgets se arman aquí (widgets.js) y se ponen en la página.
const redibujar = new Map(); // id del apartado -> cómo se redibuja
const contextos = new Map(); // id del apartado -> lo que comparten sus ventanas (ctx)
function montarApartados() {
  for (const a of APARTADOS.filter((a) => a.columnas || a.vistas)) {
    const { seccion, dibujar, ctx } = montar(a);
    $("panel").before(seccion);
    redibujar.set(a.id, dibujar);
    contextos.set(a.id, ctx);
  }
  // irA("proyectos", { caja }) desde cualquier parte: cambia lo que muestra ese apartado y va a él.
  document.addEventListener("ir", ({ detail: { apartado, ctx } }) => {
    if (ctx) contextos.get(apartado)?.cambiar(ctx);
    ir(apartado);
  });
}
// Cuando llegan datos se dibuja lo que se ve; los cajones cerrados no hacen nada. Paso 89: lo escondido (el mapa,
// otro apartado) queda "atrasado" y se dibuja al ir a él, así marcar una tarea no rearma el mapa entero por detrás.
const atrasados = new Set();
function dibujarApartado(a) {
  atrasados.delete(a.id);
  (redibujar.get(a.id) ?? a.dibujar)();
}
export function dibujarTodo() {
  for (const a of APARTADOS) $(a.id).classList.contains("oculto") ? atrasados.add(a.id) : dibujarApartado(a);
  for (const c of CAJONES) c.dibujar();
}

// Lo que va en la barra: Escritorio, los apartados y los cajones, en tu orden (Ajustes) o el de siempre.
// Lo nuevo que no está en tu orden va al final, y lo que va "abajo" (Ajustes), después de todo. Cada uno: { x (el apartado o cajón), clase, accion }.
export function entradasDeLaBarra() {
  const lista = APARTADOS.map((a) => ({ x: a, clase: "apartado", accion: () => ir(a.id) }));
  const conLugar = APARTADOS.findIndex((a) => a.lugar);
  if (conLugar >= 0) lista.splice(conLugar, 0, { x: ESCRITORIO, clase: "escritorio", accion: () => ir(enElEscritorio.id) });
  lista.push(...CAJONES.map((c) => ({ x: c, clase: "cajon", accion: () => cajon(c.id) })));
  const { orden } = preferencia(), puesto = (e, i) => (orden.includes(e.x.id) ? orden.indexOf(e.x.id) : orden.length + i);
  return lista.map((e, i) => [puesto(e, i), e]).sort((a, b) => !!a[1].x.abajo - !!b[1].x.abajo || a[0] - b[0]).map(([, e]) => e);
}

// Paso 93: atajos de teclado. Alt + número (en Mac, ⌥ + número) aprieta el botón de ese puesto en la barra.
const EN_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const atajo = (n) => (EN_MAC ? "⌥" : "Alt ") + n; // cómo se lee en el globo

// El dock: un botón por entrada, con su ícono y su nombre (y su atajo, que se ve en el globo). Los que escondiste en
// Ajustes no salen; el que tiene "abajo" (Ajustes) va al pie de la barra, con tu foto y el botón para retraerla.
function armarDock() {
  const { ocultos } = preferencia();
  let puesto = 0; // los atajos cuentan lo que se ve en el computador: sin lo escondido ni lo que va junto en "Escritorio"
  const botones = entradasDeLaBarra().map(({ x, clase, accion }, i) => {
    const escondido = !x.abajo && ocultos.includes(x.id);
    const numero = !escondido && !x.lugar && puesto < 9 ? ++puesto : null;
    const b = boton(x.nombre, x.icono, accion, numero && atajo(numero));
    b.dataset[clase] = x.id;
    if (numero) { b.dataset.atajo = numero; b.setAttribute("aria-keyshortcuts", "Alt+" + numero); }
    if (x.lugar) b.classList.add("en-lienzo"); // en el computador se juntan en "Escritorio"
    b.hidden = escondido;
    b.style.setProperty("--i", i); // su turno al aparecer (estilos.css: aparecen uno tras otro)
    b.abajo = x.abajo;
    return b;
  });
  const perfil = boton("Tu cuenta", null, () => ir("ajustes"));
  perfil.classList.add("perfil");
  perfil.prepend(tuCara());
  const retraer = el("button", { className: "retraer", textContent: "‹", title: "Retraer la barra", ariaLabel: "Retraer la barra", onclick: () => cambiar({ retraida: true }) });
  $("dock").replaceChildren(el("div", { className: "marca", ariaHidden: "true" }),
    ...botones.filter((b) => !b.abajo), el("div", { className: "pie" }, ...botones.filter((b) => b.abajo), perfil, retraer));
  marcar();
}
// Un botón de la barra: su ícono (trazos SVG) y el globo con su nombre y, si tiene, su atajo.
function boton(nombre, icono, accion, tecla) {
  const b = el("button", { ariaLabel: nombre, onclick: accion },
    el("span", { className: "etiqueta" }, nombre, tecla ? el("kbd", { textContent: tecla }) : ""));
  if (icono) b.insertAdjacentHTML("afterbegin", `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${icono}</svg>`);
  return b;
}
// Paso 98: el primer globo espera un momento (pasar el mouse de camino a otra cosa no lo enciende); mientras sigas
// en la barra, los siguientes salen al tiro y sin deslizarse, como en las barras de los sistemas operativos.
function globos() {
  const dock = $("dock");
  let espera;
  dock.addEventListener("pointerover", (e) => {
    if (e.pointerType === "mouse" && e.target.closest("button")) { clearTimeout(espera); espera = setTimeout(() => dock.classList.add("globos"), 450); }
  });
  dock.addEventListener("pointerleave", () => { clearTimeout(espera); dock.classList.remove("globos"); });
}
// Alt + 1…9 (e.code dice la tecla de verdad: sirve con el teclado numérico y en Mac, donde ⌥ cambia la letra).
function atajos() {
  addEventListener("keydown", (e) => {
    const n = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
    const b = n && $("dock").querySelector(`[data-atajo="${n}"]`);
    if (b) { e.preventDefault(); b.click(); }
  });
}

// Abre o cierra un cajón (si = true / false; sin decir, lo alterna). Se ve uno a la vez.
export function cajon(id, si) {
  for (const c of CAJONES) {
    const abrir = c.id === id && (si ?? !$(c.id).classList.contains("abierto"));
    $(c.id).classList.toggle("abierto", abrir);
    $("dock").querySelector(`[data-cajon="${c.id}"]`).setAttribute("aria-expanded", abrir);
    if (abrir) c.dibujar?.();
  }
}
function cajones() {
  for (const c of CAJONES) {
    c.iniciar?.();
    for (const b of $(c.id).querySelectorAll("[data-cerrar]")) b.onclick = () => cajon(c.id, false);
  }
  // Escape cierra el cajón abierto (si no hay un diálogo encima, que se cierra primero).
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) cajon(null, false); });
}

// El dock vive escondido para dejarle la pantalla al contenido. Aparece al llevar el mouse
// al borde de abajo (o al tocar la manilla en el teléfono) y se esconde al alejarse.
function dockEscondido() {
  const dock = $("dock");
  let espera;
  const ver = (si) => {
    clearTimeout(espera);
    if (si) dock.classList.add("visible");
    else espera = setTimeout(() => dock.classList.remove("visible"), 600);
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") ver(innerHeight - e.clientY < 90 || !!e.target.closest(".dock"));
  });
  $("asa").onclick = () => ver(!dock.classList.contains("visible"));
  // En el teléfono se va al elegir (paso 98: soltando el foco, que si no lo deja fijo por :focus-within).
  dock.addEventListener("click", () => { if (matchMedia("(hover: none)").matches) { document.activeElement.blur(); ver(false); } });
}

export function iniciarCarcasa() {
  // Paso 98: las transiciones de CSS de la barra usan el mismo resorte que la marca y la cámara (estilos.css: --resorte).
  if (CSS.supports("transition-timing-function", "linear(0, 1)")) {
    const { curva, tiempo } = curvaDeResorte(RESORTE.barra);
    document.documentElement.style.setProperty("--resorte", curva);
    document.documentElement.style.setProperty("--resorte-t", tiempo);
  }
  montarApartados();
  armarDock();
  document.addEventListener("barra", armarDock); // cambiaste la barra en Ajustes (apariencia.js avisa)
  new ResizeObserver(moverMarca).observe($("dock")); // cambió el estilo o el tamaño: la marca se acomoda
  atajos();
  globos();
  // Con la barra retraída queda esta pestaña en el borde izquierdo para volver a sacarla.
  document.body.append(el("button", { className: "sacar-barra", textContent: "›", title: "Mostrar la barra", ariaLabel: "Mostrar la barra", onclick: () => cambiar({ retraida: false }) }));
  for (const a of APARTADOS) a.iniciar?.();
  cajones();
  dockEscondido();
  iniciarEscritorio(ir, apartadoActual);
  addEventListener("hashchange", () => ir(location.hash.slice(1)));
  ir(location.hash.slice(1));
}
