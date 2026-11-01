// Punto de partida de la web: la sesión, el menú y qué se dibuja cuando llegan los datos.
// Cada parte vive en su archivo:
//   base.js    conexión a Supabase, atajos y los datos cargados
//   mapa.js    el mapa de cajas, la leyenda y los filtros
//   panel.js   el panel de un nodo y el formulario para crear o editar
//   inicio.js  el Inicio: dibuja las señales y las tarjetas
//   tarjetas.js qué muestra cada tarjeta del Inicio
import { db, $, avisar, recargar, escucharCambios, dejarDeEscuchar } from "./base.js";
import { dibujar, enfocar, ajustarMapa } from "./mapa.js";
import { mostrarPanel, formulario, refrescarPanel } from "./panel.js";
import { dibujarInicio } from "./inicio.js";

let vista = "inicio";

// Cada vez que se cargan los datos se dibuja todo (así cambiar de vista es instantáneo
// y lo que cambió en otro lado aparece solo).
document.addEventListener("datos", ({ detail }) => {
  dibujar();
  dibujarInicio();
  if (detail.enfocarId) (vista === "mapa" ? enfocar : mostrarPanel)(detail.enfocarId);
  else refrescarPanel();
});

// Menú: muestra una vista y esconde la otra. La leyenda (filtros) solo tiene sentido en el mapa.
for (const b of $("menu").children) b.onclick = () => cambiarVista(b.dataset.vista);
function cambiarVista(v) {
  vista = v;
  for (const b of $("menu").children) b.classList.toggle("activo", b.dataset.vista === v);
  $("inicio").classList.toggle("oculto", v !== "inicio");
  $("grafo").classList.toggle("oculto", v !== "mapa");
  $("leyenda").classList.toggle("oculto", v !== "mapa");
  if (v === "mapa") ajustarMapa(true);
}

$("nuevo").onclick = () => formulario();

// Sesión: un enlace al correo (Supabase Auth). Sin sesión se ve solo el formulario de entrada.
function mostrarApp(conSesion) {
  $("login").classList.toggle("oculto", conSesion);
  $("barra").classList.toggle("oculto", !conSesion);
  $("app").classList.toggle("oculto", !conSesion);
}
$("form-login").onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await db.auth.signInWithOtp({ email: $("correo").value, options: { emailRedirectTo: location.href } });
  avisar(error ? error.message : "Revisa tu correo y abre el enlace desde este navegador.");
};
$("salir").onclick = () => db.auth.signOut();
db.auth.onAuthStateChange((_evento, sesion) => {
  mostrarApp(!!sesion);
  if (sesion) { recargar(); escucharCambios(); }
  else { dejarDeEscuchar(); avisar(""); }
});
