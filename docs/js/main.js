// Punto de partida de la web: la sesión y qué se dibuja cuando llegan los datos.
// Cada parte vive en su archivo:
//   base.js      conexión a Supabase, atajos, los datos cargados y el tiempo real
//   carcasa.js   la barra, el dock y el cambio de apartado (no sabe de ningún apartado en particular)
//   escritorio.js el lienzo movible: junta los apartados que tienen "lugar"
//   apartados.js la lista de apartados: agregar uno = agregarlo ahí
//   widgets.js   las ventanas sueltas con que se arman los apartados (Hoy, Productividad...)
//   mapa.js      el mapa de cajas, la leyenda y los filtros
//   panel.js     el panel de un nodo y el formulario para crear o editar
//   nuevo.js     el botón "+ Nuevo": qué se crea según el apartado donde estás
//   calendario.js el cajón del calendario (día, semana, mes) y su editor de eventos
//   postits.js   lo del Inbox como post-its pegados alrededor de las secciones del escritorio
//   hoy.js       los widgets de Hoy (usan agenda.js, clima.js y acciones.js)
//   productividad.js los widgets de Productividad: tus proyectos y sus tareas
//   tareas.js    la lista de tareas que comparten Hoy y Productividad
//   apariencia.js cómo se ve la web (modo, color, fondo, vidrio, letra): se aplica y se guarda
//   ajustes.js   los widgets del apartado Ajustes, que la cambian
//   revision.js  la revisión de la noche: una ventana que te guía paso a paso para dejar todo al día
//   inicio.js    el Resumen: dibuja las señales y las tarjetas (qué muestra cada una: tarjetas.js)
import { traerDeLaBase } from "./apariencia.js"; // primero: así la web se pinta con tu estilo desde el comienzo
import { db, $, avisar, recargar, escucharCambios, dejarDeEscuchar } from "./base.js";
import { iniciarCarcasa, apartadoActual, dibujarTodo } from "./carcasa.js";
import { enfocar } from "./mapa.js";
import { mostrarPanel, refrescarPanel } from "./panel.js";
import { iniciarNuevo } from "./nuevo.js";
import { dibujarPostits, iniciarPostits } from "./postits.js";
import { iniciarRevision } from "./revision.js";

iniciarCarcasa();

// Cada vez que se cargan los datos se dibujan todos los apartados (así cambiar de uno a otro
// es instantáneo y lo que cambió en otro lado aparece solo).
document.addEventListener("datos", ({ detail }) => {
  dibujarTodo();
  dibujarPostits();
  if (detail.enfocarId) (apartadoActual() === "mapa" ? enfocar : mostrarPanel)(detail.enfocarId);
  else refrescarPanel();
});

// Si cambió el modo (claro u oscuro) o llegaron tus ajustes de la base, se redibuja (el mapa lee los colores al dibujarse).
document.addEventListener("apariencia", () => dibujarTodo());

iniciarNuevo();
iniciarPostits();
iniciarRevision();

// Sesión: un enlace al correo (Supabase Auth). Sin sesión se ve solo el formulario de entrada.
const SOLO_CON_SESION = ["nuevo", "revisar", "app", "dock", "asa"];
function mostrarApp(conSesion) {
  $("login").classList.toggle("oculto", conSesion);
  for (const id of SOLO_CON_SESION) $(id).classList.toggle("oculto", !conSesion);
}
$("form-login").onsubmit = async (e) => {
  e.preventDefault();
  // El enlace vuelve a la web sin el #apartado: Supabase usa la parte después del # para entregar la sesión.
  const { error } = await db.auth.signInWithOtp({ email: $("correo").value, options: { emailRedirectTo: location.origin + location.pathname } });
  avisar(error ? error.message : "Revisa tu correo y abre el enlace desde este navegador.");
};
// Si el enlace del correo venció o ya se usó, Supabase vuelve con #error_description=...; se muestra en vez de nada.
const errorDeEntrada = () => {
  const e = new URLSearchParams(location.hash.slice(1)).get("error_description");
  return e ? `No pude entrar: ${e}. Pide un enlace nuevo.` : "";
};
db.auth.onAuthStateChange((_evento, sesion) => {
  mostrarApp(!!sesion);
  if (sesion) { recargar(); escucharCambios(); traerDeLaBase(); }
  else { dejarDeEscuchar(); avisar(errorDeEntrada()); }
});
