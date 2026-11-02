// La carcasa del escritorio: el dock con un botón por apartado, el cambio de apartado,
// el dock que se esconde solo y el reloj de la barra. No sabe nada de ningún apartado en particular:
// todo lo lee de APARTADOS (apartados.js). El lienzo movible está en escritorio.js.
import { $, el } from "./base.js";
import { APARTADOS, CAJONES } from "./apartados.js";
import { iniciarEscritorio, enEscritorio, mirar } from "./escritorio.js";

let actual = APARTADOS[0];
export const apartadoActual = () => actual.id;

// Muestra un apartado y esconde los demás. Queda en la dirección (#mapa) para volver con atrás o recargar.
// Si está en el escritorio, se ven todos los del escritorio y la cámara va hasta él.
export function ir(id) {
  actual = APARTADOS.find((a) => a.id === id) ?? APARTADOS[0];
  const juntos = enEscritorio(actual);
  for (const a of APARTADOS) $(a.id).classList.toggle("oculto", a !== actual && !(juntos && enEscritorio(a)));
  $("escritorio").classList.toggle("oculto", !actual.lugar);
  for (const b of $("dock").querySelectorAll("[data-apartado]")) b.setAttribute("aria-current", b.dataset.apartado === actual.id ? "page" : "false");
  $("app-actual").textContent = actual.nombre;
  // La dirección no se toca si trae la respuesta del inicio de sesión (#access_token=...): la lee Supabase.
  if (location.hash.slice(1) !== actual.id && !location.hash.includes("=")) history.replaceState(null, "", "#" + actual.id);
  if (juntos) mirar(actual.id);
  actual.alMostrar?.();
}

// El dock: un botón por apartado, con su ícono y su nombre (que aparece al pasar el mouse),
// y al final, separados, los cajones.
function armarDock() {
  const boton = (x, clase, accion) => {
    const b = el("button", { title: x.nombre, onclick: accion }, el("span", { className: "etiqueta", textContent: x.nombre }));
    b.dataset[clase] = x.id;
    b.insertAdjacentHTML("afterbegin", `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${x.icono}</svg>`);
    b.setAttribute("aria-label", x.nombre);
    return b;
  };
  $("dock").replaceChildren(...APARTADOS.map((a) => boton(a, "apartado", () => ir(a.id))),
    ...(CAJONES.length ? [el("i", { className: "separador" })] : []),
    ...CAJONES.map((c) => boton(c, "cajon", () => cajon(c.id))));
}

// Abre o cierra un cajón (si = true / false; sin decir, lo alterna). Se ve uno a la vez.
export function cajon(id, si) {
  for (const c of CAJONES) {
    const abrir = c.id === id && (si ?? !$(c.id).classList.contains("abierto"));
    $(c.id).classList.toggle("abierto", abrir);
    $("dock").querySelector(`[data-cajon="${c.id}"]`).setAttribute("aria-expanded", abrir);
    if (abrir) c.dibujar?.();
  }
}
function cajones() {
  for (const c of CAJONES) {
    c.iniciar?.();
    for (const b of $(c.id).querySelectorAll("[data-cerrar]")) b.onclick = () => cajon(c.id, false);
  }
  // Escape cierra el cajón abierto (si no hay un diálogo encima, que se cierra primero).
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) cajon(null, false); });
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
  for (const a of APARTADOS) a.iniciar?.();
  cajones();
  dockEscondido();
  reloj();
  iniciarEscritorio(ir, apartadoActual);
  addEventListener("hashchange", () => ir(location.hash.slice(1)));
  ir(location.hash.slice(1));
}
