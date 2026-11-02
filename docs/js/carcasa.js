// La carcasa del escritorio: el dock con un botón por apartado, el cambio de apartado,
// el dock que se esconde solo y el reloj de la barra. No sabe nada de ningún apartado en particular:
// todo lo lee de APARTADOS (apartados.js).
import { $, el } from "./base.js";
import { APARTADOS } from "./apartados.js";

let actual = APARTADOS[0];
export const apartadoActual = () => actual.id;

// Muestra un apartado y esconde los demás. Queda en la dirección (#mapa) para volver con atrás o recargar.
export function ir(id) {
  actual = APARTADOS.find((a) => a.id === id) ?? APARTADOS[0];
  for (const a of APARTADOS) $(a.id).classList.toggle("oculto", a !== actual);
  for (const b of $("dock").children) b.setAttribute("aria-current", b.dataset.id === actual.id ? "page" : "false");
  $("app-actual").textContent = actual.nombre;
  if (location.hash.slice(1) !== actual.id) history.replaceState(null, "", "#" + actual.id);
  actual.alMostrar?.();
}

// El dock: un botón por apartado, con su ícono y su nombre (que aparece al pasar el mouse).
function armarDock() {
  $("dock").replaceChildren(...APARTADOS.map((a) => {
    const b = el("button", { title: a.nombre, onclick: () => ir(a.id) }, el("span", { className: "etiqueta", textContent: a.nombre }));
    b.dataset.id = a.id;
    b.insertAdjacentHTML("afterbegin", `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${a.icono}</svg>`);
    b.setAttribute("aria-label", a.nombre);
    return b;
  }));
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
  dock.addEventListener("click", () => { if (matchMedia("(hover: none)").matches) ver(false); }); // en el teléfono, se va al elegir
}

function reloj() {
  const poner = () => ($("reloj").textContent = new Date().toLocaleString("es-CL",
    { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
  poner();
  setInterval(poner, 30_000);
}

export function iniciarCarcasa() {
  armarDock();
  dockEscondido();
  reloj();
  addEventListener("hashchange", () => ir(location.hash.slice(1)));
  ir(location.hash.slice(1));
}
