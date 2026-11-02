// El botón "+ Nuevo" de la barra (paso 29). Qué ofrece depende de dónde estás:
//   en el escritorio  un menú con lo que se crea en sus secciones; al elegir, se abre el formulario
//   en otro apartado  directo el formulario, con botones para lo que se crea en ese apartado
// Cada apartado dice qué se crea en él con "nuevo" (apartados.js); sin lista, se puede crear cualquier tipo.
// Los campos de cada formulario salen de las propiedades del tipo en la base: un tipo nuevo no pide código.
import { $, el, datos, colorDe } from "./base.js";
import { APARTADOS } from "./apartados.js";
import { apartadoActual } from "./carcasa.js";
import { enEscritorio } from "./escritorio.js";
import { formulario } from "./panel.js";

const menu = () => $("menu-nuevo");
const cerrarMenu = () => { menu().hidden = true; $("nuevo").setAttribute("aria-expanded", "false"); };

function abrirMenu(tipos) {
  const opcion = (texto, accion, color) => {
    const b = el("button", { role: "menuitem", textContent: texto, onclick: () => { cerrarMenu(); accion(); } });
    if (color) b.style.setProperty("--c", color);
    return b;
  };
  menu().replaceChildren(
    ...tipos.map((c) => opcion(datos.tipo.get(c).nombre, () => formulario(null, { tipos, tipo: c }), colorDe(c))),
    el("hr"),
    opcion("Otra cosa…", () => formulario(null)));
  menu().style.setProperty("--derecha", innerWidth - $("nuevo").getBoundingClientRect().right + "px"); // bajo el botón
  menu().hidden = false;
  $("nuevo").setAttribute("aria-expanded", "true");
  menu().querySelector("button").focus();
}

export function iniciarNuevo() {
  $("nuevo").onclick = () => {
    if (!menu().hidden) return cerrarMenu();
    const actual = APARTADOS.find((a) => a.id === apartadoActual());
    if (!enEscritorio(actual)) return formulario(null, { tipos: actual.nuevo });
    // En el escritorio: lo de todas sus secciones, sin repetir, y que exista en la base.
    const tipos = [...new Set(APARTADOS.filter(enEscritorio).flatMap((a) => a.nuevo ?? []))].filter((c) => datos.tipo.has(c));
    tipos.length ? abrirMenu(tipos) : formulario(null);
  };
  addEventListener("pointerdown", (e) => { if (!menu().hidden && !e.target.closest("#menu-nuevo, #nuevo")) cerrarMenu(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu().hidden) { cerrarMenu(); $("nuevo").focus(); } });
}
