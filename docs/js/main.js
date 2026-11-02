// Punto de partida de la web: la sesión y qué se dibuja cuando llegan los datos.
// Cada parte vive en su archivo:
//   base.js      conexión a Supabase, atajos, los datos cargados y el tiempo real
//   carcasa.js   la barra, el dock y el cambio de apartado (no sabe de ningún apartado en particular)
//   escritorio.js el lienzo movible: junta los apartados que tienen "lugar"
//   apartados.js la lista de apartados: agregar uno = agregarlo ahí
//   mapa.js      el mapa de cajas, la leyenda y los filtros
//   panel.js     el panel de un nodo y el formulario para crear o editar
//   nuevo.js     el botón "+ Nuevo": qué se crea según el apartado donde estás
//   hoy.js       el apartado Hoy (usa agenda.js, clima.js y acciones.js)
//   inicio.js    el Resumen: dibuja las señales y las tarjetas (qué muestra cada una: tarjetas.js)
import { db, $, avisar, recargar, escucharCambios, dejarDeEscuchar } from "./base.js";
import { APARTADOS } from "./apartados.js";
import { iniciarCarcasa, apartadoActual } from "./carcasa.js";
import { enfocar } from "./mapa.js";
import { mostrarPanel, refrescarPanel } from "./panel.js";
import { iniciarNuevo } from "./nuevo.js";

iniciarCarcasa();

// Cada vez que se cargan los datos se dibujan todos los apartados (así cambiar de uno a otro
// es instantáneo y lo que cambió en otro lado aparece solo).
document.addEventListener("datos", ({ detail }) => {
  for (const a of APARTADOS) a.dibujar();
  if (detail.enfocarId) (apartadoActual() === "mapa" ? enfocar : mostrarPanel)(detail.enfocarId);
  else refrescarPanel();
});

iniciarNuevo();

// Sesión: un enlace al correo (Supabase Auth). Sin sesión se ve solo el formulario de entrada.
const SOLO_CON_SESION = ["barra", "app", "dock", "asa"];
function mostrarApp(conSesion) {
  $("login").classList.toggle("oculto", conSesion);
  for (const id of SOLO_CON_SESION) $(id).classList.toggle("oculto", !conSesion);
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
