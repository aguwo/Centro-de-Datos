// El escritorio movible (paso 28): los apartados que tienen "lugar" (apartados.js) quedan juntos en un
// lienzo más grande que la pantalla. Se arrastra para moverse, la rueda con Ctrl acerca o aleja,
// y el minimapa de la esquina salta de una sección a otra.
// Paso 35c: el escritorio se recorre con lo suyo, no con el dock: las flechas pasan de una sección
// a la de al lado (paso 82: ← → ↑ ↓ según el plano), Esc aleja para ver todo (o vuelve) y, de lejos, un clic en una sección te lleva a ella.
// Paso 35d: sin nada más en pantalla que el minimapa.
// En pantallas angostas no hay lienzo: cada apartado se ve a pantalla completa, como los demás.
import { $, el } from "./base.js";
import { APARTADOS } from "./apartados.js";

// Cada sección mide lo mismo (16:10) y se ubican en una grilla; lugar [columna, fila].
const SECCION = { ancho: 1280, alto: 800, espacio: 160 };
const MARGEN = 40;            // aire entre la sección enfocada y el borde de la pantalla
const ZOOM = { min: 0.3, max: 1.4 };
const pantallaAncha = matchMedia("(min-width: 900px)");

export const escritorioActivo = () => pantallaAncha.matches;
export const enEscritorio = (a) => !!a.lugar && escritorioActivo();
// Para lo que se dibuja distinto con y sin escritorio (los post-its): avisa cuando cambia.
export const alCambiarDeModo = (fn) => pantallaAncha.addEventListener("change", fn);

const enLienzo = APARTADOS.filter((a) => a.lugar);
const esquina = new Map(); // id de la sección -> { x, y } de su esquina en el mundo
let cam = { x: 0, y: 0, z: 1 }, mundo = { w: 0, h: 0 }, mirando = null, lejos = false;

// El escritorio pasa por debajo de la barra lateral (así nada se corta en seco junto a ella), pero lo que se mira
// se centra en lo que queda libre a su derecha: izq = el ancho de la barra (--barra), W = el ancho libre.
function libre() {
  const vista = $("escritorio"), izq = parseFloat(getComputedStyle(vista).getPropertyValue("--barra")) || 0;
  return { izq, W: vista.clientWidth - izq, H: vista.clientHeight };
}

// Para pegar cosas en el mundo (los post-its): cuánto está acercado y qué punto queda al medio de la pantalla.
export const zoom = () => cam.z;
export function centro() {
  const { izq, W, H } = libre();
  return { x: (izq + W / 2 - cam.x) / cam.z, y: (H / 2 - cam.y) / cam.z };
}
// Lugares alrededor de las secciones para una caja de ancho × alto, montada "monta" px sobre el borde:
// primero a los costados de cada sección (derecha e izquierda, de arriba abajo) y después abajo.
export function alrededor(ancho, alto, monta = 24, aire = 24) {
  const lugares = [];
  for (const { x, y } of esquina.values()) {
    for (let yy = y + 48; yy + alto <= y + SECCION.alto; yy += alto + aire)
      lugares.push({ x: x + SECCION.ancho - monta, y: yy }, { x: x - ancho + monta, y: yy });
    for (let xx = x + 48; xx + ancho <= x + SECCION.ancho; xx += ancho + aire)
      lugares.push({ x: xx, y: y + SECCION.alto - monta });
  }
  return lugares;
}

// Redondea a un píxel entero de la pantalla (en una pantalla al 125 %, un píxel CSS son 1,25). Si el mundo queda
// corrido medio píxel, el navegador dibuja mal el vidrio de las ventanas (una franja oscura junto a su borde).
const px = (v) => Math.round(v * devicePixelRatio) / devicePixelRatio;

// La cámara: x, y = dónde queda la esquina del mundo en la pantalla; z = acercamiento.
function aplicar(animar = false) {
  const { izq, W, H } = libre(), m = 200; // se sale un poco del borde, sin perderse
  cam.x = Math.min(izq + m, Math.max(izq + W - mundo.w * cam.z - m, cam.x));
  cam.y = Math.min(m, Math.max(H - mundo.h * cam.z - m, cam.y));
  $("mundo").classList.toggle("animar", animar);
  $("mundo").style.transform = `translate(${px(cam.x)}px, ${px(cam.y)}px) scale(${cam.z})`;
  // El fondo acompaña un poco (parallax): parece que la foto está más lejos que las ventanas.
  document.body.style.setProperty("--px", (cam.x / mundo.w) * 24 + "px");
  document.body.style.setProperty("--py", (cam.y / mundo.h) * 24 + "px");
  dibujarMinimapa();
  $("escritorio").classList.toggle("lejos", lejos);
}

// Centra una sección y la acerca hasta que quepa entera.
export function mirar(id, animar = true) {
  const s = $(id), { izq, W, H } = libre();
  mirando = id; lejos = false;
  if (!H) return; // todavía no se ve (antes de entrar); se enfoca cuando aparezca
  cam.z = Math.min(1, (W - 2 * MARGEN) / SECCION.ancho, (H - 2 * MARGEN) / SECCION.alto);
  cam.x = izq + W / 2 - (s.offsetLeft + SECCION.ancho / 2) * cam.z;
  cam.y = H / 2 - (s.offsetTop + SECCION.alto / 2) * cam.z;
  aplicar(animar);
}

// Todo el mundo a la vista (Esc o doble clic en el fondo). Tocar una sección te lleva a ella.
function verTodo() {
  const { izq, W, H } = libre();
  lejos = true;
  cam.z = Math.max(ZOOM.min, Math.min(1, (W - 2 * MARGEN) / mundo.w, (H - 2 * MARGEN) / mundo.h));
  cam.x = izq + (W - mundo.w * cam.z) / 2;
  cam.y = (H - mundo.h * cam.z) / 2;
  aplicar(true);
}

// Ubica cada sección en su lugar. La grilla parte en la sección de más arriba a la izquierda.
function armarMundo() {
  const col0 = Math.min(...enLienzo.map((a) => a.lugar[0])), fila0 = Math.min(...enLienzo.map((a) => a.lugar[1]));
  const paso = (n, medida) => n * (medida + SECCION.espacio) + SECCION.espacio;
  for (const a of enLienzo) {
    const s = $(a.id);
    $("mundo").append(s);
    esquina.set(a.id, { x: paso(a.lugar[0] - col0, SECCION.ancho), y: paso(a.lugar[1] - fila0, SECCION.alto) });
    s.style.setProperty("--x", esquina.get(a.id).x + "px");
    s.style.setProperty("--y", esquina.get(a.id).y + "px");
  }
  const cols = Math.max(...enLienzo.map((a) => a.lugar[0])) - col0 + 1, filas = Math.max(...enLienzo.map((a) => a.lugar[1])) - fila0 + 1;
  mundo = { w: paso(cols, SECCION.ancho), h: paso(filas, SECCION.alto) };
  Object.assign($("mundo").style, { width: mundo.w + "px", height: mundo.h + "px" });
  $("mundo").style.setProperty("--ancho", SECCION.ancho + "px");
  $("mundo").style.setProperty("--alto", SECCION.alto + "px");
}

// Minimapa: el mundo en chico. Cada sección es un rectángulo (clic = ir ahí) y el marco es lo que estás viendo.
function armarMinimapa(ir) {
  $("minimapa").replaceChildren(...enLienzo.map((a) => {
    const b = el("button", { title: a.nombre, onclick: () => ir(a.id) });
    b.dataset.id = a.id;
    return b;
  }), el("i", { className: "vista" }));
}
function dibujarMinimapa() {
  const mini = $("minimapa"), k = Math.min(mini.clientWidth / mundo.w, mini.clientHeight / mundo.h);
  const caja = (x, y, w, h) => ({ left: x * k + "px", top: y * k + "px", width: w * k + "px", height: h * k + "px" });
  for (const b of mini.querySelectorAll("button")) {
    const s = $(b.dataset.id);
    Object.assign(b.style, caja(s.offsetLeft, s.offsetTop, SECCION.ancho, SECCION.alto));
  }
  const { izq, W, H } = libre();
  Object.assign(mini.querySelector(".vista").style, caja((izq - cam.x) / cam.z, -cam.y / cam.z, W / cam.z, H / cam.z));
}

// Lo que tiene su propio desplazamiento (una lista larga, la agenda) y todavía tiene para dónde moverse.
function desplazable(t) {
  for (let n = t; n && n.id !== "mundo"; n = n.parentElement)
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
}

// Moverse: arrastrar el fondo, los títulos o la barra de una ventana; rueda; Ctrl + rueda (o pellizco) acerca; flechas.
function controles(ir) {
  const vista = $("escritorio");
  const seArrastra = (t) => !t.closest("#minimapa, .postit, button, a, input, select, textarea, [draggable='true']") && (!t.closest(".ventana") || t.closest(".ventana > h3"));
  let tomado = null;
  vista.addEventListener("pointerdown", (e) => {
    if (!escritorioActivo() || e.button !== 0 || !seArrastra(e.target)) return;
    e.preventDefault(); // que no seleccione texto
    tomado = { x: e.clientX - cam.x, y: e.clientY - cam.y };
    vista.classList.add("arrastrando");
    vista.setPointerCapture(e.pointerId);
  });
  vista.addEventListener("pointermove", (e) => {
    if (!tomado) return;
    cam.x = e.clientX - tomado.x; cam.y = e.clientY - tomado.y;
    aplicar();
  });
  const soltar = () => { tomado = null; vista.classList.remove("arrastrando"); };
  vista.addEventListener("pointerup", soltar);
  vista.addEventListener("pointercancel", soltar);

  vista.addEventListener("wheel", (e) => {
    if (!escritorioActivo()) return;
    if (!e.ctrlKey && desplazable(e.target)) return; // deja desplazar la lista o la agenda de adentro
    e.preventDefault();
    if (e.ctrlKey) {
      const z = Math.min(ZOOM.max, Math.max(ZOOM.min, cam.z * Math.exp(-e.deltaY * 0.002)));
      const r = vista.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      cam.x = px - (px - cam.x) * (z / cam.z); cam.y = py - (py - cam.y) * (z / cam.z); cam.z = z;
    } else { cam.x -= e.deltaX; cam.y -= e.deltaY; }
    aplicar();
  }, { passive: false });

  vista.addEventListener("dblclick", (e) => {
    if (!escritorioActivo() || !seArrastra(e.target)) return;
    const s = e.target.closest("#mundo > .apartado");
    s ? ir(s.id) : verTodo();
  });
  // De lejos, un clic en una sección te lleva a ella.
  vista.addEventListener("click", (e) => {
    const s = lejos && e.target.closest("#mundo > .apartado");
    if (s) { e.preventDefault(); e.stopPropagation(); ir(s.id); }
  }, true);

  // Teclado: las flechas llevan a la sección de al lado en el plano (paso 82); Esc ver todo (o volver).
  // Va antes que los demás (captura) para saber si había algo abierto que Esc deba cerrar primero.
  addEventListener("keydown", (e) => {
    if (!escritorioActivo() || vista.classList.contains("oculto") || e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "Escape") {
      if (document.querySelector(".cajon.abierto, dialog[open], #panel:not(.oculto), #menu-nuevo:not([hidden])")) return;
      return lejos ? ir(mirando) : verTodo();
    }
    const hacia = FLECHAS[e.key];
    if (!hacia) return;
    e.preventDefault();
    const otra = vecina(enLienzo.find((a) => a.id === mirando), hacia);
    if (otra) ir(otra.id);
  }, true);
}

// Paso 82: las flechas se mueven por el plano del escritorio (el lugar [columna, fila] de cada sección).
// La vecina es la más cercana hacia ese lado: primero la que está más derecho, después la más cerca.
// Si hacia ese lado no hay nada, no pasa nada (no da la vuelta).
const FLECHAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
function vecina(desde, [dx, dy]) {
  if (!desde) return enLienzo[0];
  const [x, y] = desde.lugar, eje = dx ? 0 : 1, signo = dx || dy;
  const distancia = (a) => { const d = [a.lugar[0] - x, a.lugar[1] - y]; return [Math.abs(d[1 - eje]), d[eje] * signo]; };
  return enLienzo.filter((a) => (a.lugar[eje] - desde.lugar[eje]) * signo > 0)
    .sort((a, b) => { const [ca, la] = distancia(a), [cb, lb] = distancia(b); return ca - cb || la - lb; })[0];
}

// ir(id) es el de la carcasa: cambia de apartado (y la cámara viaja si está en el escritorio).
// Al pasar de pantalla ancha a angosta (o al revés) se llama de nuevo, para que decida qué se ve.
export function iniciarEscritorio(ir, actual) {
  if (!enLienzo.length) return;
  armarMundo();
  armarMinimapa(ir);
  controles(ir);
  const modo = () => document.body.classList.toggle("con-escritorio", escritorioActivo());
  modo();
  pantallaAncha.addEventListener("change", () => { modo(); ir(actual()); });
  // Cuando cambia el tamaño de la ventana (o el escritorio aparece por primera vez), se vuelve a enfocar.
  // Esconderlo y volver a mostrarlo (ir a Proyectos y volver) no cuenta: de eso ya se encarga ir(), con su viaje.
  const enfocar = (animar) => { if (escritorioActivo() && mirando) lejos ? verTodo() : mirar(mirando, animar); };
  let tamano = "";
  new ResizeObserver(([r]) => {
    const { width, height } = r.contentRect, nuevo = width + "×" + height;
    if (!height || nuevo === tamano) return;
    tamano = nuevo;
    enfocar(false);
  }).observe($("escritorio"));
  // Al retraer, sacar o cambiar la barra, lo que miras se corre con ella (suave) para seguir al centro de lo libre.
  let antes = libre().izq;
  document.addEventListener("barra", () => requestAnimationFrame(() => { const izq = libre().izq; if (izq !== antes) { antes = izq; enfocar(true); } }));
}
