// Paso 107: lo que se mueve solo, para cualquier parte de la web.
//
// iman(caja): la barra de navegación como un «imán». Al pasar el mouse, el ícono más cerca se estira hacia el
// puntero; al apretar, se infla y los de al lado se corren para hacerle lugar. Todo con resortes (conResorte), así
// nada salta. Sirve para cualquier fila o columna de botones, en cualquier dirección: se calcula con la posición real
// de cada uno.
//
// marcaQueViaja(caja): el fondo del botón elegido es una sola pieza que se desliza de uno al otro (paso 128).
//
// Las barras de opciones (.segmento, ej. Íconos | Lista | Detalles): el fondo de la elegida se desliza a la nueva
// en vez de apagarse en una y prenderse en otra. Lo hace solo, para todas las que hay y las que se armen después.
import { conResorte } from "./dibujos.js";
import { enLaWeb, zoomDeLaWeb } from "./base.js";

const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- El imán ----------
// Lo de siempre (la barra); otro imán puede pedir lo suyo (cuánto crece, empuja y hasta dónde llega).
const CRECE = { cerca: 1.08, apretado: 1.4 }; // cuánto se infla cada uno
const EMPUJA = 11; // cuántos px corre el apretado a sus vecinos (a los que están pegados; más lejos, menos)
const ALCANCE = 110; // hasta qué distancia (px) llega el empujón
const TIRA = 0.22, TIRA_MAX = 6; // cuánto se estira hacia el puntero el que está debajo
const RIGIDEZ = { s: 22, x: 18, y: 18 }; // más rígido = llega más rápido

export function iman(caja, { botones = () => [...caja.querySelectorAll("button")].filter((b) => b.offsetParent),
  crece = CRECE, empuja = EMPUJA, alcance = ALCANCE } = {}) {
  const resortes = new WeakMap(); // botón -> su ir() (cada uno con sus resortes)
  let puntero = null, apretado = null;
  const resorteDe = (b) => resortes.get(b) ?? resortes.set(b, conResorte((v) => {
    b.style.setProperty("--iman-x", v.x + "px"); b.style.setProperty("--iman-y", v.y + "px"); b.style.setProperty("--iman-s", v.s);
  })).get(b);

  function mover() {
    const lista = botones(), centros = new Map(lista.map((b) => { const r = b.getBoundingClientRect(); return [b, { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; }));
    const cerca = puntero && lista.find((b) => { const r = b.getBoundingClientRect(); return puntero.x >= r.left && puntero.x <= r.right && puntero.y >= r.top && puntero.y <= r.bottom; });
    const o = apretado && lista.includes(apretado) && centros.get(apretado); // el que empuja a sus vecinos
    for (const b of lista) {
      const c = centros.get(b);
      let x = 0, y = 0;
      if (o && b !== apretado) {
        const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1;
        const k = empuja * Math.max(0, 1 - d / alcance) * 1.6; // pegado empuja casi entero; lejos, nada
        x += dx / d * k; y += dy / d * k;
      }
      if (b === cerca) {
        x += Math.max(-TIRA_MAX, Math.min(TIRA_MAX, (puntero.x - c.x) * TIRA));
        y += Math.max(-TIRA_MAX, Math.min(TIRA_MAX, (puntero.y - c.y) * TIRA));
      }
      const s = b === apretado ? crece.apretado : b === cerca ? crece.cerca : 1;
      resorteDe(b)({ x: enLaWeb(x), y: enLaWeb(y), s }, RIGIDEZ, !sinMovimiento.matches);
    }
  }
  caja.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { puntero = { x: e.clientX, y: e.clientY }; mover(); } });
  caja.addEventListener("pointerleave", () => { puntero = null; apretado = null; mover(); });
  caja.addEventListener("pointerdown", (e) => { apretado = e.target.closest("button"); mover(); });
  addEventListener("pointerup", () => { if (apretado) { apretado = null; mover(); } });
  addEventListener("pointercancel", () => { if (apretado) { apretado = null; mover(); } });
}

// ---------- La marca del elegido se desliza (paso 128) ----------
// marcaQueViaja(caja, { elegido }): en una caja con una pieza .marca adentro, la pone detrás del botón elegido que se
// ve; al cambiar de elegido, se desliza hasta el nuevo. Aquí solo se dice dónde va y cuánto mide (--x, --y, --w, --h);
// el viaje lo hace CSS (estilos.css, .marca) con una sola curva suave, así un cambio a medio camino sigue desde donde
// iba, sin tirones. La primera vez (o una marca nueva, al rearmarse la caja) aparece ya en su lugar.
// Devuelve mover(): llamarlo cuando cambia el elegido o la caja cambia de tamaño.
export function marcaQueViaja(caja, { elegido = (b) => b.getAttribute("aria-current") === "page" } = {}) {
  return () => {
    const m = caja.querySelector(":scope > .marca"), b = [...caja.querySelectorAll("button")].find((b) => elegido(b) && b.offsetParent);
    if (!m) return;
    m.classList.toggle("sin-elegido", !b);
    if (!b) return;
    const primera = !m.style.getPropertyValue("--w");
    if (primera) m.style.transition = "none";
    for (const [k, n] of Object.entries({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight })) m.style.setProperty("--" + k, n + "px");
    if (primera) { m.offsetWidth; m.style.transition = ""; } // se dibuja en su lugar y desde ahí ya viaja
  };
}

// ---------- El fondo de la opción elegida se desliza ----------
// Cuando en una .segmento un botón pasa a aria-pressed="true" y otro lo deja, una «píldora» con el mismo fondo
// viaja de uno al otro; mientras viaja, el botón nuevo no pinta su fondo (lo pinta la píldora) y al llegar se va.
// Si la barra se rearma entera (botones nuevos), se recuerda dónde estaba la elegida por su nombre (aria-label).
const antes = new Map(); // aria-label de la barra -> dónde estaba su elegido (relativo a la barra)
// Dónde está un botón dentro de su barra, en px de pantalla, desde adentro del borde de la barra (ahí parte la píldora).
const caja = (b, g) => {
  const r = b.getBoundingClientRect(), o = g.getBoundingClientRect(), z = zoomDeLaWeb();
  return { x: r.left - o.left - g.clientLeft * z, y: r.top - o.top - g.clientTop * z, w: r.width, h: r.height };
};

function deslizar(g, desde, b) {
  if (sinMovimiento.matches || !b.offsetParent) return;
  const hasta = caja(b, g), estilo = getComputedStyle(b);
  if (Math.abs(desde.x - hasta.x) < 1 && Math.abs(desde.y - hasta.y) < 1) return;
  g.querySelector(":scope > .pildora")?.remove();
  const p = document.createElement("i");
  p.className = "pildora";
  Object.assign(p.style, { background: estilo.backgroundColor, boxShadow: estilo.boxShadow, borderRadius: estilo.borderRadius, height: enLaWeb(hasta.h) + "px" });
  g.prepend(p);
  b.classList.add("llegando");
  const en = (c) => ({ transform: `translate(${enLaWeb(c.x)}px, ${enLaWeb(c.y)}px)`, width: enLaWeb(c.w) + "px" });
  const a = p.animate([en(desde), en(hasta)],
    { duration: 380, easing: "cubic-bezier(.3, 1.3, .5, 1)" }); // se pasa apenas y vuelve, como un resorte
  a.onfinish = a.oncancel = () => { p.remove(); b.classList.remove("llegando"); };
}

new MutationObserver((cambios) => {
  const llegaron = new Map(); // barra -> { desde, b }
  for (const c of cambios) {
    const g = c.type === "attributes" ? c.target.closest?.(".segmento") : null;
    if (!g) continue;
    if (c.oldValue === "true" && c.target.getAttribute("aria-pressed") !== "true") llegaron.set(g, { ...llegaron.get(g), desde: caja(c.target, g) });
    if (c.oldValue !== "true" && c.target.getAttribute("aria-pressed") === "true") llegaron.set(g, { ...llegaron.get(g), b: c.target });
  }
  for (const c of cambios) for (const n of c.addedNodes ?? []) {
    if (!(n instanceof Element)) continue;
    for (const g of [...(n.matches(".segmento") ? [n] : []), ...n.querySelectorAll(".segmento")]) {
      const b = g.querySelector('[aria-pressed="true"]'), viejo = antes.get(g.ariaLabel);
      if (b && viejo && !llegaron.has(g)) llegaron.set(g, { desde: viejo, b });
    }
  }
  for (const [g, { desde, b }] of llegaron) if (desde && b) deslizar(g, desde, b);
  // Anotar dónde queda cada elegida, para cuando su barra se rearme (solo si alguna barra cambió).
  if (llegaron.size || cambios.some((c) => [...(c.addedNodes ?? [])].some((n) => n instanceof Element && (n.matches(".segmento") || n.querySelector(".segmento"))))) requestAnimationFrame(() => { for (const g of document.querySelectorAll(".segmento[aria-label]")) { const b = g.querySelector('[aria-pressed="true"]'); if (b?.offsetParent) antes.set(g.ariaLabel, caja(b, g)); } });
}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed"], attributeOldValue: true });

// ---------- Arrastrar con el mouse o el dedo (paso 126) ----------
// arrastrable(cosa, { mover, soltar, desplaza }): hace que algo se pueda agarrar y llevar a otra parte.
//   Con el mouse empieza al moverlo unos px; con el dedo, al dejarlo apretado un momento (así deslizar sigue siendo
//   desplazar la página). Un toque sin arrastrar sigue siendo un clic normal.
//   mover(p) se llama mientras se arrastra y soltar(p) al soltar. p = { x, y, arriba }: dónde está el puntero y dónde
//   quedaría el borde de arriba de lo agarrado (para que no salte a la punta del puntero).
//   desplaza: la caja con barra que se desplaza sola cuando el puntero se acerca a su borde de arriba o de abajo.
const UMBRAL = 5, ESPERA_DEDO = 350, BORDE = 50; // px para que cuente como arrastre; ms apretando con el dedo; px del borde
export function arrastrable(cosa, { mover, soltar, desplaza }) {
  let arrastrando = false;
  // Mientras se arrastra con el dedo, la página no se desplaza ni sale el menú de mantener apretado.
  cosa.addEventListener("touchmove", (t) => arrastrando && t.preventDefault(), { passive: false });
  cosa.addEventListener("contextmenu", (e) => e.pointerType !== "mouse" && e.preventDefault());
  cosa.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const inicio = { x: e.clientX, y: e.clientY }, dedo = e.pointerType !== "mouse";
    let listo = false; // ¿ya puede desplazar la caja? (ver abajo)
    const agarre = e.clientY - cosa.getBoundingClientRect().top;
    const punto = (m) => ({ x: m.clientX, y: m.clientY, arriba: m.clientY - agarre });
    const empezar = () => { arrastrando = true; cosa.classList.add("moviendo"); document.body.classList.add("arrastrando-algo"); if (dedo) navigator.vibrate?.(12); };
    const espera = dedo && setTimeout(empezar, ESPERA_DEDO);
    const alMover = (m) => {
      const lejos = Math.hypot(m.clientX - inicio.x, m.clientY - inicio.y) > UMBRAL;
      if (!arrastrando) return lejos && (dedo ? terminar() : empezar()); // con el dedo, moverse antes de tiempo es desplazar
      m.preventDefault();
      if (desplaza) {
        // Recién se desplaza después de haber salido de los bordes (si se agarró algo pegado a un borde, no se va solo).
        const r = desplaza.getBoundingClientRect(), arriba = m.clientY < r.top + BORDE, abajo = m.clientY > r.bottom - BORDE;
        if (!arriba && !abajo) listo = true;
        else if (listo) desplaza.scrollTop += arriba ? -12 : 12;
      }
      mover?.(punto(m));
    };
    const terminar = (m) => {
      clearTimeout(espera);
      removeEventListener("pointermove", alMover);
      removeEventListener("pointerup", terminar);
      removeEventListener("pointercancel", terminar);
      if (!arrastrando) return;
      arrastrando = false;
      cosa.classList.remove("moviendo");
      document.body.classList.remove("arrastrando-algo");
      // El clic que viene después de soltar no cuenta (no abre lo que se arrastró).
      const sinClic = (c) => { c.stopPropagation(); c.preventDefault(); };
      addEventListener("click", sinClic, { capture: true, once: true });
      setTimeout(() => removeEventListener("click", sinClic, { capture: true }), 0);
      soltar?.(m?.type === "pointerup" ? punto(m) : null); // null: se canceló
    };
    addEventListener("pointermove", alMover);
    addEventListener("pointerup", terminar);
    addEventListener("pointercancel", terminar);
  });
}
