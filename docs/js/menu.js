// Paso 103: el menú del clic derecho (o de dejar el dedo apretado en el celular), para cualquier parte de la web.
// opciones = [{ texto, atajo?, hacer }, "-", ...]: "-" es una rayita; lo que sea falso (ej. una opción que no aplica) se salta.
// Sale donde se hizo clic, sin salirse de la pantalla. Se maneja con las flechas y Enter, y se cierra al elegir,
// con Esc o tocando fuera; al cerrarse, el foco vuelve a donde estaba.
import { el } from "./base.js";

export function menuEn(e, opciones) {
  e.preventDefault();
  document.querySelector(".menu-contextual")?.remove();
  const antes = document.activeElement;
  // Sin rayitas al principio, al final ni dos seguidas.
  const items = opciones.filter(Boolean).filter((o, i, xs) => o !== "-" || (i > 0 && i < xs.length - 1 && xs[i + 1] !== "-"));
  const m = el("div", { className: "menu-contextual vidrio", role: "menu" }, ...items.map((o) => o === "-" ? el("hr") :
    el("button", { role: "menuitem", onclick: () => { cerrar(); o.hacer(); } }, el("span", { textContent: o.texto }), o.atajo ? el("kbd", { textContent: o.atajo }) : "")));
  m.dataset.teclas = "";
  document.body.append(m);

  // Con el teclado (tecla Menú o Shift+F10) no hay mouse: sale junto a lo que tiene el foco.
  const r = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : (({ left, bottom }) => ({ x: left + 16, y: bottom }))(e.target.getBoundingClientRect());
  const { width, height } = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.x, innerWidth - width - 8)) + "px";
  m.style.top = Math.max(8, Math.min(r.y, innerHeight - height - 8)) + "px";

  const botones = [...m.querySelectorAll("button")];
  botones[0]?.focus();
  m.onkeydown = (k) => {
    const paso = { ArrowDown: 1, ArrowUp: -1 }[k.key];
    if (paso) { k.preventDefault(); botones[(botones.indexOf(document.activeElement) + paso + botones.length) % botones.length].focus(); }
    if (k.key === "Escape" || k.key === "Tab") { k.preventDefault(); k.stopPropagation(); cerrar(); antes?.focus?.(); }
  };
  const fuera = (x) => { if (!m.contains(x.target)) cerrar(); };
  setTimeout(() => addEventListener("pointerdown", fuera, true));
  function cerrar() { m.remove(); removeEventListener("pointerdown", fuera, true); }
}
