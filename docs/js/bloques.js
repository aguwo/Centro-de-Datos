// Los bloques de un apartado (paso 70): se ve uno a la vez y se cambia con un selector de tarjetas.
// Cada tarjeta muestra el nombre del bloque, un dato de hoy y un anillo de avance; la marcada lleva un fondo que se desliza.
// Al cambiar, el bloque viejo se va hacia un lado y el nuevo entra desde el otro, con sus ventanas una tras otra.
// En el teléfono también se cambia deslizando el dedo. El que elegiste queda guardado (en este navegador).
//
// Se usa desde widgets.js con los grupos de un apartado: [{ b: la marca del bloque, grilla: su elemento }].
// La marca (apartados.js) es { bloque, icono, color, resumen }; resumen() devuelve { dato, detalle, avance (0 a 1) }.
import { el } from "./base.js";
import { icono, anillo } from "./dibujos.js";

const SUAVE = "cubic-bezier(.22, 1, .36, 1)";
const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function selectorDeBloques(id, grupos) {
  const guardado = "bloque:" + id;
  const leer = () => { try { return localStorage.getItem(guardado); } catch { return null; } };
  let actual = Math.max(0, grupos.findIndex((g) => g.b.bloque === leer()));

  const tarjetas = grupos.map((g, i) => {
    const t = el("button", { className: "tarjeta-bloque", role: "tab", onclick: () => ir(i) });
    t.style.setProperty("--c", g.b.color ?? "var(--acento)");
    return t;
  });
  const fondo = el("span", { className: "fondo-bloque", ariaHidden: "true" });
  const selector = el("div", { className: "selector-bloques", role: "tablist", ariaLabel: "Bloques",
    onkeydown: (e) => { const n = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (n) { e.preventDefault(); ir((actual + n + grupos.length) % grupos.length, true); } } },
  fondo, ...tarjetas);
  const escena = el("div", { className: "escena-bloques" }, ...grupos.map((g) => g.grilla));
  grupos.forEach((g, i) => { g.grilla.hidden = i !== actual; });

  // El fondo de la tarjeta marcada viaja hasta la nueva (se mide al dibujar, porque el ancho cambia con la ventana).
  const moverFondo = () => {
    const t = tarjetas[actual];
    if (!t.offsetWidth) return;
    fondo.style.width = t.offsetWidth + "px";
    fondo.style.height = t.offsetHeight + "px";
    fondo.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`;
    fondo.style.setProperty("--c", grupos[actual].b.color ?? "var(--acento)");
  };
  new ResizeObserver(moverFondo).observe(selector);

  function ir(i, enfocar) {
    if (i === actual) return;
    const viejo = grupos[actual].grilla, nuevo = grupos[i].grilla, lado = i > actual ? 1 : -1;
    actual = i;
    try { localStorage.setItem(guardado, grupos[i].b.bloque); } catch {}
    marcar();
    if (enfocar) tarjetas[i].focus();
    if (quieto()) { viejo.hidden = true; nuevo.hidden = false; return; }
    // El viejo sale rápido hacia el lado contrario; el nuevo entra deslizándose y sus ventanas suben una tras otra.
    viejo.getAnimations().forEach((x) => x.finish());
    viejo.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-lado * 32}px)` }], { duration: 140, easing: "ease-in" })
      .finished.then(() => { if (grupos[actual].grilla !== viejo) viejo.hidden = true; });
    setTimeout(() => {
      if (grupos[actual].grilla !== nuevo) return;
      grupos.forEach((g) => { g.grilla.hidden = g.grilla !== nuevo; });
      nuevo.animate([{ opacity: 0, transform: `translateX(${lado * 48}px)` }, { opacity: 1, transform: "none" }], { duration: 420, easing: SUAVE });
      nuevo.querySelectorAll(".ventana").forEach((v, n) =>
        v.animate([{ opacity: 0, transform: "translateY(14px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 460, delay: 40 + n * 45, easing: SUAVE, fill: "backwards" }));
    }, 130);
  }

  // Deslizar el dedo de lado (en el teléfono) pasa al bloque de al lado.
  let x0 = null, y0 = null;
  escena.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  escena.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(Math.min(grupos.length - 1, Math.max(0, actual - Math.sign(dx))));
  });

  function marcar() {
    tarjetas.forEach((t, i) => { t.ariaSelected = String(i === actual); t.tabIndex = i === actual ? 0 : -1; });
    moverFondo();
  }

  // Al llegar datos: cada tarjeta con su dato de hoy y su anillo.
  function redibujar() {
    grupos.forEach((g, i) => {
      const r = g.b.resumen?.() ?? {};
      tarjetas[i].replaceChildren(
        el("span", { className: "marca-agua", ariaHidden: "true" }, icono(g.b.icono)),
        el("span", { className: "insignia" }, icono(g.b.icono)),
        el("span", { className: "texto-bloque" }, el("b", { textContent: g.b.bloque }),
          el("span", { className: "dato-bloque", textContent: r.dato ?? "" }), el("small", { textContent: r.detalle ?? "" })),
        r.avance === undefined ? "" : anillo(r.avance));
    });
    marcar();
  }
  return { selector, escena, redibujar };
}
