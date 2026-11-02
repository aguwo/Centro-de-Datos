// Los apartados de la web: cada uno es una sección del escritorio con su botón en el dock.
// Hay dos formas de armar uno:
//   con widgets  se anota aquí con sus "columnas" y listo: la sección se arma sola (widgets.js).
//   a mano       se escribe su <section id="..." class="apartado"> en index.html y se le da "dibujar".
// La carcasa (carcasa.js) arma el dock y cambia de apartado sola; no hay que tocarla.
//
//   id        el id de su <section> (y lo que aparece en la dirección: ...#mapa)
//   nombre    lo que dice la barra de arriba y la etiqueta del dock
//   icono     los trazos del ícono (SVG de 24 × 24, una sola línea)
//   columnas  (con widgets) [{ ancho, widgets: [...] }, ...]: las columnas de izquierda a derecha, cada una con
//             los widgets de arriba abajo. ancho es la proporción (3 y 2 = la primera un poco más ancha)
//   titulo    (con widgets, opcional) qué dice arriba de la sección; sin esto, su nombre
//   dibujar   (a mano) se llama cada vez que llegan datos nuevos
//   alMostrar (opcional) se llama al entrar al apartado
//   iniciar   (opcional) se llama una vez, al empezar (para conectar sus botones y formularios)
//   nuevo     (opcional) qué tipos se crean desde aquí con "+ Nuevo" (claves, ej. ["tarea", "evento"]). Sin lista: todos
//   lugar     (opcional) [columna, fila] en el escritorio movible (escritorio.js). Los que tienen lugar se ven
//             juntos en el lienzo; los demás, a pantalla completa. El plan del escritorio:
//                            [1,0] Esta semana
//             [0,1] Productividad   [1,1] Hoy   [2,1] Salud
//                            [1,2] Finanzas
import { dibujarInicio } from "./inicio.js";
import { dibujar as dibujarMapa, ajustarMapa } from "./mapa.js";
import { dibujarCalendario, iniciarCalendario } from "./calendario.js";

export const APARTADOS = [
  {
    id: "hoy", nombre: "Hoy", lugar: [1, 1], nuevo: ["tarea", "evento"],
    titulo: () => new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
    columnas: [{ ancho: 3, widgets: ["tareas-de-hoy"] }, { ancho: 2, widgets: ["el-tiempo", "tu-dia"] }],
    icono: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  },
  {
    id: "productividad", nombre: "Productividad", lugar: [0, 1], nuevo: ["tarea", "proyecto"],
    columnas: [{ widgets: ["tareas"] }, { widgets: ["proyectos"] }],
    icono: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 12.2l2.6 2.6 4.6-5.4"/>',
  },
  // Las tarjetas de antes (hábitos, gastos, plantas...). Se quedan hasta que cada una tenga su apartado (paso 32).
  {
    id: "inicio", nombre: "Resumen", dibujar: dibujarInicio,
    icono: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  },
  {
    id: "mapa", nombre: "Mapa", dibujar: dibujarMapa, alMostrar: () => ajustarMapa(true),
    icono: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8.3 7l7.3.8M7 8.3l2.2 7.3M16.3 10l-4.6 6"/>',
  },
];

// Los cajones: paneles que salen desde la derecha sin dejar el apartado donde estás (el calendario,
// más adelante el chat). Van al final del dock, separados. Cada uno es un <aside id="..." class="cajon">.
//   iniciar   se llama una vez, al empezar
//   dibujar   se llama al abrirlo y cada vez que llegan datos nuevos (si está cerrado, no hace nada)
export const CAJONES = [
  {
    id: "calendario", nombre: "Calendario", iniciar: iniciarCalendario, dibujar: dibujarCalendario,
    icono: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  },
];
