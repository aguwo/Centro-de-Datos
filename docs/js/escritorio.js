// El escritorio movible (paso 28): los apartados que tienen "lugar" (apartados.js) quedan juntos en un
// lienzo más grande que la pantalla. Se arrastra para moverse, la rueda con Ctrl acerca o aleja,
// y el minimapa de la esquina salta de una sección a otra.
// Paso 35c: el escritorio se recorre con lo suyo, no con el dock: las flechas pasan de una sección
// a la de al lado (paso 82: ← → ↑ ↓ según el plano), Esc aleja para ver todo (o vuelve) y, de lejos, un clic en una sección te lleva a ella.
// Paso 35d: sin nada más en pantalla que el minimapa.
// Paso 91: la cámara se mueve sola, con un resorte (ver «La cámara viaja», abajo): viajes, rueda y zoom suaves,
// y al soltar un arrastre sigue deslizándose un poco. Con «reducir movimiento» del sistema, salta directo.
// En pantallas angostas no hay lienzo: cada apartado se ve a pantalla completa, como los demás.
import { $, el, enLaWeb } from "./base.js";
import { APARTADOS } from "./apartados.js";
import { resorte } from "./dibujos.js";

// Cada sección mide lo mismo (16:10) y se ubican en una grilla; lugar [columna, fila].
const SECCION = { ancho: 1280, alto: 800, espacio: 160 };
const MARGEN = 40;            // aire entre la sección enfocada y el borde de la pantalla
const ZOOM = { min: 0.3, max: 1.4 };
const pantallaAncha = matchMedia("(min-width: 900px)");
const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)");

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
// limitar() la deja dentro del mundo: se sale un poco del borde, sin perderse.
function limitar(c, { izq, W, H } = libre(), m = 200) {
  return { z: c.z, x: Math.min(izq + m, Math.max(izq + W - mundo.w * c.z - m, c.x)), y: Math.min(m, Math.max(H - mundo.h * c.z - m, c.y)) };
}
function aplicar() {
  cam = limitar(cam);
  $("mundo").style.transform = `translate(${px(cam.x)}px, ${px(cam.y)}px) scale(${cam.z})`;
  // El fondo acompaña un poco (parallax): parece que la foto está más lejos que las ventanas.
  const fondo = document.querySelector(".fondo");
  fondo?.style.setProperty("--px", (cam.x / mundo.w) * 24 + "px");
  fondo?.style.setProperty("--py", (cam.y / mundo.h) * 24 + "px");
  dibujarMinimapa();
  $("escritorio").classList.toggle("lejos", lejos);
}

// ---------- La cámara viaja (paso 91) ----------
// En vez de saltar, la cámara va hacia una meta empujada por un resorte (amortiguado justo para no pasarse ni
// rebotar): parte suave, frena suave, y si le cambias la meta a medio camino sigue desde donde iba, sin tirones.
// Lo que viaja no es x, y, z sino el punto del mundo que queda al centro y el logaritmo del acercamiento: así, al
// alejarse o acercarse, el centro va derecho a su destino y el zoom se siente parejo (cada paso multiplica igual).
// Cada movimiento elige su resorte: más rígido = llega más rápido.
const RESORTE = { viaje: 9, rueda: 26, deslizar: 5 };
let meta = null, vel = { cx: 0, cy: 0, lz: 0 }, rigidez = RESORTE.viaje, cuadro = 0, ultimo = 0;

const aCentro = (c, { izq, W, H } = libre()) => ({ cx: (izq + W / 2 - c.x) / c.z, cy: (H / 2 - c.y) / c.z, lz: Math.log(c.z) });
const aCamara = (p, { izq, W, H } = libre()) => { const z = Math.exp(p.lz); return { x: izq + W / 2 - p.cx * z, y: H / 2 - p.cy * z, z }; };

// Lleva la cámara a «destino» (x, y, z). Sin animar (o con «reducir movimiento»), llega de inmediato.
function viajar(destino, animar = true, fuerza = RESORTE.viaje) {
  const l = libre();
  meta = aCentro(limitar(destino, l), l);
  rigidez = fuerza;
  if (animar && !sinMovimiento.matches) { if (!cuadro) { ultimo = performance.now(); cuadro = requestAnimationFrame(avanzar); } return; }
  detener();
  cam = aCamara(meta, l);
  aplicar();
}
// A dónde va la cámara ahora (la meta si está viajando): la rueda suma a eso, para que los giros rápidos se acumulen.
const rumbo = () => (cuadro ? aCamara(meta) : cam);
function detener() {
  cancelAnimationFrame(cuadro);
  cuadro = 0; vel = { cx: 0, cy: 0, lz: 0 };
}

// Un cuadro de la animación: la fórmula exacta del resorte amortiguado (no se descontrola aunque un cuadro tarde).
function avanzar(t) {
  const dt = Math.min(0.064, Math.max(0, t - ultimo) / 1000), l = libre(), p = aCentro(cam, l);
  ultimo = t;
  let falta = false;
  for (const k of ["cx", "cy", "lz"]) {
    [p[k], vel[k]] = resorte(p[k], vel[k], meta[k], rigidez, dt);
    // Llegó cuando le falta menos de un cuarto de píxel en pantalla (o una milésima de zoom) y casi no se mueve.
    const casi = k === "lz" ? 1e-3 : 0.25 / cam.z;
    if (Math.abs(p[k] - meta[k]) > casi || Math.abs(vel[k]) > casi * 4) falta = true;
  }
  cam = aCamara(falta ? p : meta, l);
  aplicar();
  if (falta) cuadro = requestAnimationFrame(avanzar);
  else detener();
}

// Centra una sección y la acerca hasta que quepa entera.
export function mirar(id, animar = true) {
  const s = $(id), { izq, W, H } = libre();
  mirando = id; lejos = false;
  if (!H) return; // todavía no se ve (antes de entrar); se enfoca cuando aparezca
  const z = Math.min(1, (W - 2 * MARGEN) / SECCION.ancho, (H - 2 * MARGEN) / SECCION.alto);
  viajar({ z, x: izq + W / 2 - (s.offsetLeft + SECCION.ancho / 2) * z, y: H / 2 - (s.offsetTop + SECCION.alto / 2) * z }, animar);
}

// Todo el mundo a la vista (Esc o doble clic en el fondo). Tocar una sección te lleva a ella.
function verTodo(animar = true) {
  const { izq, W, H } = libre();
  lejos = true;
  const z = Math.max(ZOOM.min, Math.min(1, (W - 2 * MARGEN) / mundo.w, (H - 2 * MARGEN) / mundo.h));
  viajar({ z, x: izq + (W - mundo.w * z) / 2, y: (H - mundo.h * z) / 2 }, animar);
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

// Minimapa (paso 113): cada sección es un botón con su lugar y su tamaño en el escritorio a escala; la que estás
// mirando queda marcada. Clic en una y la cámara viaja ahí. Cómo se ve lo eliges en Ajustes (estilos.css,
// :root[data-minimapa]): Miniatura (rectángulos), Puntos, Punto con nombre o Lista (los nombres en columna).
let enMinimapa = null;
function armarMinimapa(ir) {
  $("minimapa").replaceChildren(...enLienzo.map((a) => {
    const b = el("button", { title: a.nombre, onclick: () => ir(a.id) }, el("span", { textContent: a.nombre }));
    b.dataset.id = a.id;
    return b;
  }));
}
function dibujarMinimapa() {
  // El mundo entero a escala, centrado en el minimapa; cada sección deja 1,5 px de aire con sus vecinas.
  const mini = $("minimapa"), ancho = mini.clientWidth, alto = mini.clientHeight, AIRE = 1.5;
  const k = Math.min(ancho / mundo.w, alto / mundo.h), ox = (ancho - mundo.w * k) / 2, oy = (alto - mundo.h * k) / 2;
  // La que estás mirando: la sección más cerca del centro de lo que ves (de lejos, ninguna).
  const { izq, W, H } = libre(), cx = (izq + W / 2 - cam.x) / cam.z, cy = (H / 2 - cam.y) / cam.z;
  let cerca = null, mejor = Infinity;
  for (const b of mini.querySelectorAll("button")) {
    const s = $(b.dataset.id);
    Object.assign(b.style, { left: ox + s.offsetLeft * k + AIRE + "px", top: oy + s.offsetTop * k + AIRE + "px",
      width: SECCION.ancho * k - 2 * AIRE + "px", height: SECCION.alto * k - 2 * AIRE + "px" });
    const d = Math.hypot(s.offsetLeft + SECCION.ancho / 2 - cx, s.offsetTop + SECCION.alto / 2 - cy);
    if (d < mejor) { mejor = d; cerca = b; }
  }
  const actual = lejos ? null : cerca;
  if (actual === enMinimapa) return; // solo cuando cambia (esto corre en cada cuadro de la cámara)
  enMinimapa = actual;
  const botones = [...mini.querySelectorAll("button")];
  for (const b of botones) b.setAttribute("aria-current", b === actual ? "page" : "false");
  mini.dataset.actual = actual?.title ?? ""; // el nombre que muestra «Punto con nombre»
  mini.style.setProperty("--fila", botones.indexOf(actual)); // hasta dónde baja la rayita de «Lista» (-1 = ninguna)
}

// Lo que tiene su propio desplazamiento (una lista larga, la agenda) y todavía tiene para dónde moverse.
function desplazable(t) {
  for (let n = t; n && n.id !== "mundo"; n = n.parentElement)
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
}

// Moverse: arrastrar el fondo, los títulos o la barra de una ventana; rueda; Ctrl + rueda (o pellizco) acerca; flechas.
// Al arrastrar, el escritorio va pegado al puntero; al soltar sigue con la velocidad que llevaba y frena solo.
function controles(ir) {
  const vista = $("escritorio");
  const seArrastra = (t) => !t.closest("#minimapa, .postit, button, a, input, select, textarea, [draggable='true']") && (!t.closest(".ventana") || t.closest(".ventana > h3"));
  let tomado = null;
  vista.addEventListener("pointerdown", (e) => {
    if (!escritorioActivo() || e.button !== 0 || !seArrastra(e.target)) return;
    e.preventDefault(); // que no seleccione texto
    detener(); // agarrarlo a medio viaje lo frena donde está
    tomado = { x: enLaWeb(e.clientX) - cam.x, y: enLaWeb(e.clientY) - cam.y, t: e.timeStamp, vx: 0, vy: 0 };
    vista.classList.add("arrastrando");
    vista.setPointerCapture(e.pointerId);
  });
  vista.addEventListener("pointermove", (e) => {
    if (!tomado) return;
    // La velocidad (px por segundo), suavizada entre los últimos movimientos para que un temblón no la cambie.
    const dt = Math.max(1, e.timeStamp - tomado.t) / 1000, x = enLaWeb(e.clientX) - tomado.x, y = enLaWeb(e.clientY) - tomado.y;
    tomado.vx = 0.2 * tomado.vx + 0.8 * (x - cam.x) / dt; tomado.vy = 0.2 * tomado.vy + 0.8 * (y - cam.y) / dt; tomado.t = e.timeStamp;
    cam.x = x; cam.y = y;
    aplicar();
  });
  const soltar = (e) => {
    if (!tomado) return;
    const { vx, vy, t } = tomado;
    tomado = null; vista.classList.remove("arrastrando");
    if (e.type !== "pointerup" || e.timeStamp - t > 80) return; // si ya lo habías detenido antes de soltar, se queda ahí
    // Deslizar: con la meta a velocidad ÷ rigidez, el resorte arranca justo a la velocidad del arrastre y frena parejo.
    viajar({ z: cam.z, x: cam.x + vx / RESORTE.deslizar, y: cam.y + vy / RESORTE.deslizar }, true, RESORTE.deslizar);
    if (cuadro) { vel = { cx: -vx / cam.z, cy: -vy / cam.z, lz: 0 }; }
  };
  vista.addEventListener("pointerup", soltar);
  vista.addEventListener("pointercancel", soltar);

  vista.addEventListener("wheel", (e) => {
    if (!escritorioActivo()) return;
    if (!e.ctrlKey && desplazable(e.target)) return; // deja desplazar la lista o la agenda de adentro
    e.preventDefault();
    // Cada giro mueve la meta (no la cámara) y la cámara la sigue con un resorte rápido: suave, pero sin quedarse atrás.
    const c = rumbo();
    if (e.ctrlKey) {
      const z = Math.min(ZOOM.max, Math.max(ZOOM.min, c.z * Math.exp(-e.deltaY * 0.002)));
      const r = vista.getBoundingClientRect(), px = enLaWeb(e.clientX - r.left), py = enLaWeb(e.clientY - r.top); // el punto bajo el puntero se queda quieto
      viajar({ x: px - (px - c.x) * (z / c.z), y: py - (py - c.y) * (z / c.z), z }, true, RESORTE.rueda);
    } else viajar({ x: c.x - e.deltaX, y: c.y - e.deltaY, z: c.z }, true, RESORTE.rueda);
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
  // Lo que usa las teclas por su cuenta (data-teclas, como la carpeta de Archivos o un menú) las recibe sin que se vayan al plano.
  addEventListener("keydown", (e) => {
    if (!escritorioActivo() || vista.classList.contains("oculto") || e.target.closest("input, textarea, select, [contenteditable], [data-teclas]")) return;
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
  const enfocar = (animar) => { if (escritorioActivo() && mirando) lejos ? verTodo(animar) : mirar(mirando, animar); };
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
