// Paso 103: el menú del clic derecho (o de dejar el dedo apretado en el celular), para cualquier parte de la web.
// opciones = [{ texto, atajo?, marcado?, hacer }, "-", ...]: "-" es una rayita; marcado (true/false) la vuelve una opción
// con ✓ (la elegida); lo que sea falso (ej. una opción que no aplica) se salta.
// Sale donde se hizo clic, sin salirse de la pantalla. Se maneja con las flechas y Enter, y se cierra al elegir,
// con Esc o tocando fuera; al cerrarse, el foco vuelve a donde estaba.
import { el, enLaWeb } from "./base.js";
import { preferencia, cambiar, ZOOMS } from "./apariencia.js";

export function menuEn(e, opciones) {
  e.preventDefault();
  document.querySelector(".menu-contextual")?.remove();
  const antes = document.activeElement;
  // Sin rayitas al principio, al final ni dos seguidas.
  const items = opciones.filter(Boolean).filter((o, i, xs) => o !== "-" || (i > 0 && i < xs.length - 1 && xs[i + 1] !== "-"));
  const m = el("div", { className: "menu-contextual vidrio", role: "menu" }, ...items.map((o) => o === "-" ? el("hr") :
    el("button", { role: o.marcado === undefined ? "menuitem" : "menuitemradio", ariaChecked: o.marcado === undefined ? null : String(!!o.marcado), onclick: () => { cerrar(); o.hacer(); } }, el("span", { textContent: o.texto }), o.atajo ? el("kbd", { textContent: o.atajo }) : "")));
  m.dataset.teclas = "";
  document.body.append(m);

  // Con el teclado (tecla Menú o Shift+F10) no hay mouse: sale junto a lo que tiene el foco.
  const r = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : (({ left, bottom }) => ({ x: left + 16, y: bottom }))(e.target.getBoundingClientRect());
  const { width, height } = m.getBoundingClientRect();
  m.style.left = enLaWeb(Math.max(8, Math.min(r.x, innerWidth - width - 8))) + "px"; // con zoom, se mide en pantalla y se escribe en la web
  m.style.top = enLaWeb(Math.max(8, Math.min(r.y, innerHeight - height - 8))) + "px";

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

// Paso 106: clic derecho en cualquier parte que no tenga su propio menú: el zoom de toda la web.
// Donde sirve el menú del navegador (escribir, un enlace, una imagen o con texto pintado para copiar) se deja ese.
const zoomA = (z) => `${Math.round(z * 100)} %`;
addEventListener("contextmenu", (e) => {
  if (e.defaultPrevented || e.target.closest("input, textarea, select, a, img, [contenteditable]") || String(getSelection())) return;
  const z = preferencia().zoom, i = ZOOMS.indexOf(z), mas = ZOOMS[i + 1], menos = ZOOMS[i - 1];
  menuEn(e, [
    mas && { texto: `Acercar la web (${zoomA(mas)})`, hacer: () => cambiar({ zoom: mas }) },
    menos && { texto: `Alejar la web (${zoomA(menos)})`, hacer: () => cambiar({ zoom: menos }) },
    ![z, mas, menos].includes(1) && { texto: `Tamaño normal (100 %)`, hacer: () => cambiar({ zoom: 1 }) },
  ]);
});
