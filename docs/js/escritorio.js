// El escritorio movible (paso 28): los apartados que tienen "lugar" (apartados.js) quedan juntos en un
// lienzo más grande que la pantalla. Se arrastra para moverse, la rueda con Ctrl acerca o aleja,
// y el minimapa de la esquina salta de una sección a otra.
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

const enLienzo = APARTADOS.filter((a) => a.lugar);
let cam = { x: 0, y: 0, z: 1 }, mundo = { w: 0, h: 0 }, mirando = null;

// La cámara: x, y = dónde queda la esquina del mundo en la pantalla; z = acercamiento.
function aplicar(animar = false) {
  const vista = $("escritorio"), W = vista.clientWidth, H = vista.clientHeight, m = 200; // se sale un poco del borde, sin perderse
  cam.x = Math.min(m, Math.max(W - mundo.w * cam.z - m, cam.x));
  cam.y = Math.min(m, Math.max(H - mundo.h * cam.z - m, cam.y));
  $("mundo").classList.toggle("animar", animar);
  $("mundo").style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
  // El fondo acompaña un poco (parallax): parece que la foto está más lejos que las ventanas.
  document.body.style.setProperty("--px", (cam.x / mundo.w) * 24 + "px");
  document.body.style.setProperty("--py", (cam.y / mundo.h) * 24 + "px");
  dibujarMinimapa();
}

// Centra una sección y la acerca hasta que quepa entera.
export function mirar(id, animar = true) {
  const s = $(id), vista = $("escritorio"), W = vista.clientWidth, H = vista.clientHeight;
  mirando = id;
  if (!W) return; // todavía no se ve (antes de entrar); se enfoca cuando aparezca
  cam.z = Math.min(1, (W - 2 * MARGEN) / SECCION.ancho, (H - 2 * MARGEN) / SECCION.alto);
  cam.x = W / 2 - (s.offsetLeft + SECCION.ancho / 2) * cam.z;
  cam.y = H / 2 - (s.offsetTop + SECCION.alto / 2) * cam.z;
  aplicar(animar);
}

// Todo el mundo a la vista (doble clic en el fondo).
function verTodo() {
  const vista = $("escritorio");
  cam.z = Math.max(ZOOM.min, Math.min(1, (vista.clientWidth - 2 * MARGEN) / mundo.w, (vista.clientHeight - 2 * MARGEN) / mundo.h));
  cam.x = (vista.clientWidth - mundo.w * cam.z) / 2;
  cam.y = (vista.clientHeight - mundo.h * cam.z) / 2;
  aplicar(true);
}

// Ubica cada sección en su lugar. La grilla parte en la sección de más arriba a la izquierda.
function armarMundo() {
  const col0 = Math.min(...enLienzo.map((a) => a.lugar[0])), fila0 = Math.min(...enLienzo.map((a) => a.lugar[1]));
  const paso = (n, medida) => n * (medida + SECCION.espacio) + SECCION.espacio;
  for (const a of enLienzo) {
    const s = $(a.id);
    $("mundo").append(s);
    s.style.setProperty("--x", paso(a.lugar[0] - col0, SECCION.ancho) + "px");
    s.style.setProperty("--y", paso(a.lugar[1] - fila0, SECCION.alto) + "px");
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
  const vista = $("escritorio");
  Object.assign(mini.querySelector(".vista").style, caja(-cam.x / cam.z, -cam.y / cam.z, vista.clientWidth / cam.z, vista.clientHeight / cam.z));
}

// Lo que tiene su propio desplazamiento (una lista larga, la agenda) y todavía tiene para dónde moverse.
function desplazable(t) {
  for (let n = t; n && n.id !== "mundo"; n = n.parentElement)
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
}

// Moverse: arrastrar el fondo, los títulos o la barra de una ventana; rueda; Ctrl + rueda (o pellizco) acerca; flechas.
function controles() {
  const vista = $("escritorio");
  const seArrastra = (t) => !t.closest("#minimapa, button, a, input, select, textarea, [draggable='true']") && (!t.closest(".ventana") || t.closest(".ventana > h3"));
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
    s ? mirar(s.id) : verTodo();
  });

  addEventListener("keydown", (e) => {
    if (!escritorioActivo() || vista.classList.contains("oculto") || e.target.closest("input, textarea, select")) return;
    const d = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    cam.x += d[0] * 300; cam.y += d[1] * 300;
    aplicar(true);
  });
}

// ir(id) es el de la carcasa: cambia de apartado (y la cámara viaja si está en el escritorio).
// Al pasar de pantalla ancha a angosta (o al revés) se llama de nuevo, para que decida qué se ve.
export function iniciarEscritorio(ir, actual) {
  if (!enLienzo.length) return;
  armarMundo();
  armarMinimapa(ir);
  controles();
  const modo = () => document.body.classList.toggle("con-escritorio", escritorioActivo());
  modo();
  pantallaAncha.addEventListener("change", () => { modo(); ir(actual()); });
  // Cuando cambia el tamaño de la ventana (o el escritorio aparece por primera vez), se vuelve a enfocar.
  new ResizeObserver(() => { if (escritorioActivo() && mirando) mirar(mirando, false); }).observe($("escritorio"));
}
