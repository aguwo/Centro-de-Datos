// Paso 107: lo que se mueve solo, para cualquier parte de la web.
//
// iman(caja): la barra de navegación como un «imán». El botón elegido se infla y los de al lado se corren para
// hacerle lugar; al pasar el mouse, el ícono más cerca se estira hacia el puntero; al apretar, se infla más y empuja
// más fuerte. Todo con resortes (conResorte), así nada salta. Sirve para cualquier fila o columna de botones, en
// cualquier dirección: se calcula con la posición real de cada uno.
//
// Las barras de opciones (.segmento, ej. Íconos | Lista | Detalles): el fondo de la elegida se desliza a la nueva
// en vez de apagarse en una y prenderse en otra. Lo hace solo, para todas las que hay y las que se armen después.
import { conResorte } from "./dibujos.js";
import { enLaWeb, zoomDeLaWeb } from "./base.js";

const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- El imán ----------
// Lo de siempre (la barra); otro imán puede pedir lo suyo (cuánto crece, empuja y hasta dónde llega).
const CRECE = { elegido: 1.18, cerca: 1.08, apretado: 1.4 }; // cuánto se infla cada uno
const EMPUJA = { elegido: 5, apretado: 11 }; // cuántos px corre a los vecinos (los que están pegados; más lejos, menos)
const ALCANCE = 110; // hasta qué distancia (px) llega el empujón
const TIRA = 0.22, TIRA_MAX = 6; // cuánto se estira hacia el puntero el que está debajo
const RIGIDEZ = { s: 22, x: 18, y: 18 }; // más rígido = llega más rápido

export function iman(caja, { botones = () => [...caja.querySelectorAll("button")].filter((b) => b.offsetParent),
  elegido = (b) => b.getAttribute("aria-current") === "page", crece = CRECE, empuja = EMPUJA, alcance = ALCANCE } = {}) {
  const resortes = new WeakMap(); // botón -> su ir() (cada uno con sus resortes)
  let puntero = null, apretado = null;
  const resorteDe = (b) => resortes.get(b) ?? resortes.set(b, conResorte((v) => {
    b.style.setProperty("--iman-x", v.x + "px"); b.style.setProperty("--iman-y", v.y + "px"); b.style.setProperty("--iman-s", v.s);
  })).get(b);

  function mover() {
    const lista = botones(), centros = new Map(lista.map((b) => { const r = b.getBoundingClientRect(); return [b, { x: r.left + r.width / 2, y: r.top + r.height / 2 }]; }));
    const cerca = puntero && lista.find((b) => { const r = b.getBoundingClientRect(); return puntero.x >= r.left && puntero.x <= r.right && puntero.y >= r.top && puntero.y <= r.bottom; });
    // Quién empuja: el apretado (fuerte) y el elegido (suave).
    const fuentes = [...lista.filter(elegido).map((b) => [b, empuja.elegido]), ...(apretado && lista.includes(apretado) ? [[apretado, empuja.apretado]] : [])];
    for (const b of lista) {
      const c = centros.get(b);
      let x = 0, y = 0;
      for (const [f, fuerza] of fuentes) {
        if (f === b) continue;
        const o = centros.get(f), dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1;
        const k = fuerza * Math.max(0, 1 - d / alcance) * 1.6; // pegado empuja casi entero; lejos, nada
        x += dx / d * k; y += dy / d * k;
      }
      if (b === cerca) {
        x += Math.max(-TIRA_MAX, Math.min(TIRA_MAX, (puntero.x - c.x) * TIRA));
        y += Math.max(-TIRA_MAX, Math.min(TIRA_MAX, (puntero.y - c.y) * TIRA));
      }
      const s = b === apretado ? crece.apretado : elegido(b) ? crece.elegido : b === cerca ? crece.cerca : 1;
      resorteDe(b)({ x: enLaWeb(x), y: enLaWeb(y), s }, RIGIDEZ, !sinMovimiento.matches);
    }
  }
  caja.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { puntero = { x: e.clientX, y: e.clientY }; mover(); } });
  caja.addEventListener("pointerleave", () => { puntero = null; apretado = null; mover(); });
  caja.addEventListener("pointerdown", (e) => { apretado = e.target.closest("button"); mover(); });
  addEventListener("pointerup", () => { if (apretado) { apretado = null; mover(); } });
  addEventListener("pointercancel", () => { if (apretado) { apretado = null; mover(); } });
  return mover; // llamarlo cuando cambia el elegido o se rearma la barra
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
