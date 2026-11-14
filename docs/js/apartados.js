// Los apartados de la web: cada uno es una sección del escritorio con su botón en el dock.
// Hay dos formas de armar uno:
//   con widgets  se anota aquí con sus "columnas" y listo: la sección se arma sola (widgets.js).
//   a mano       se escribe su <section id="..." class="apartado"> en index.html y se le da "dibujar".
// La carcasa (carcasa.js) arma el dock y cambia de apartado sola; no hay que tocarla.
//
//   id        el id de su <section> (y lo que aparece en la dirección: ...#mapa)
//   nombre    lo que dice la barra de arriba y la etiqueta del dock
//   icono     el nombre de su ícono en dibujos.js (ej. "salud")
//   columnas  (con widgets) [{ ancho, widgets: [...] }, ...]: las columnas de izquierda a derecha, cada una con
//             los widgets de arriba abajo. ancho es la proporción (3 y 2 = la primera un poco más ancha)
//   vistas    (con widgets, en vez de columnas) [{ nombre, columnas }, ...]: formas de ver el apartado entre las que
//             eliges arriba (paso 62). La primera es la de siempre. En el escritorio infinito (con lugar) se elige
//             en Ajustes (paso 81). En una columna, una lista de widgets va en una fila: ["a", ["b", "c"]]
//   titulo    (con widgets, opcional) qué dice arriba de la sección; sin esto, su nombre
//   dibujar   (a mano) se llama cada vez que llegan datos nuevos
//   alMostrar (opcional) se llama al entrar al apartado
//   iniciar   (opcional) se llama una vez, al empezar (para conectar sus botones y formularios)
//   nuevo     (opcional) qué tipos se crean desde aquí con "+ Nuevo" (claves, ej. ["tarea", "evento"]). Sin lista: todos
//   abajo     (opcional) true: su botón va pegado al fondo de la barra lateral y no se puede esconder (Ajustes)
//   lugar     (opcional) [columna, fila] en el escritorio movible (escritorio.js). Los que tienen lugar se ven
//             juntos en el lienzo (en el teléfono, uno a la vez, deslizando de lado); los demás, a pantalla completa.
//             Paso 99: el escritorio muestra lo de ahora y lo rápido; el apartado guarda todo lo demás. El plan del escritorio:
//                            [1,0] Esta semana
//             [0,1] Productividad   [1,1] Hoy   [2,1] Salud hoy
//                            [1,2] Finanzas
//   momento   (opcional, con lugar) de cuándo habla la sección («Hoy», «Esta semana»): va chico sobre su título
//   abre      (opcional, con lugar) el apartado completo de esta sección: sale «Abrir Finanzas ›» junto al título
import { dibujar as dibujarMapa, ajustarMapa } from "./mapa.js";
import { dibujarCalendario, iniciarCalendario } from "./calendario.js";
import { semestreActual } from "./universidad.js";
import { BLOQUES } from "./salud.js";
import { BLOQUES as FINANZAS } from "./finanzas.js";

export const APARTADOS = [
  {
    id: "hoy", nombre: "Hoy", lugar: [1, 1], nuevo: ["tarea", "evento", "habito"],
    titulo: () => new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
    // Paso 94: dos vistas, que se eligen en Ajustes. Plan: tu semana en anillos y TODO lo de hoy (tareas, hábitos y
    // eventos, paso 96) en tarjetas que, al marcarlas, bajan al final; es la de siempre desde el paso 96. Clásica: solo
    // tareas (prioridades, también hoy y atrasadas). A la derecha, en las dos, el tiempo y tu día.
    vistas: [
      { nombre: "Plan", icono: "lista", columnas: [{ ancho: 3, widgets: ["plan-de-hoy"] }, { ancho: 2, widgets: ["el-tiempo", "tu-dia"] }] },
      { nombre: "Clásica", icono: "bloques", columnas: [{ ancho: 3, widgets: ["tareas-de-hoy"] }, { ancho: 2, widgets: ["el-tiempo", "tu-dia"] }] },
    ],
    icono: "sol",
  },
  // Paso 61: tus 7 días de un vistazo (semana.js), arriba de Hoy en el escritorio infinito.
  {
    id: "semana", nombre: "Esta semana", lugar: [1, 0], nuevo: ["evento", "tarea"],
    columnas: [{ widgets: ["lo-importante", "dias", "plantas"] }], // paso 99: las plantas con sed, que antes iban en el Resumen
    icono: "semana",
  },
  {
    id: "productividad", nombre: "Productividad", lugar: [0, 1], abre: "proyectos", nuevo: ["tarea", "proyecto"],
    columnas: [{ widgets: ["tareas"] }, { widgets: ["proyectos"] }],
    icono: "test",
  },
  // Paso 73: lo de hoy de Salud, a la derecha de Hoy en el escritorio infinito. Tocar una tarjeta abre Salud en ese bloque.
  {
    id: "salud-hoy", nombre: "Salud hoy", lugar: [2, 1], momento: "Hoy", abre: "salud", nuevo: ["habito", "alimento"], titulo: () => "Salud",
    // Paso 81: dos vistas, que se eligen en Ajustes. Bento: Dieta grande a la izquierda; a la derecha el peso y,
    // debajo, Ejercicio y Hábitos lado a lado. Anillos: los cuatro de un vistazo arriba y el detalle abajo.
    vistas: [
      { nombre: "Bento", icono: "bloques", columnas: [{ widgets: ["dieta-hoy"] }, { widgets: ["medidor-peso", ["entreno-hoy", "habitos-rapidos"]] }] },
      { nombre: "Anillos", icono: "objetivo", columnas: [{ widgets: ["anillos-salud", ["habitos-rapidos", "macros-hoy", "entreno-hoy"]] }] },
    ],
    icono: "salud",
  },
  // Paso 87: Finanzas de un vistazo, abajo de Hoy en el escritorio infinito: la semana a la izquierda; a la derecha
  // las categorías y, debajo, el próximo cobro y tu objetivo de ahorro lado a lado.
  {
    id: "finanzas-hoy", nombre: "Finanzas hoy", lugar: [1, 2], momento: "Esta semana", abre: "finanzas", nuevo: ["categoria", "cuenta"], titulo: () => "Finanzas",
    columnas: [{ widgets: ["finanzas-semana"] }, { ancho: 1.15, widgets: ["por-categoria", ["proximo-cobro", "meta-ahorro"]] }],
    icono: "billetera",
  },
  // Paso 35: una caja (área, ramo, proyecto...) completa, para verla entera y editarla. Va a pantalla completa.
  {
    id: "proyectos", nombre: "Proyectos", nuevo: ["proyecto", "tarea", "nota", "evento"],
    columnas: [{ widgets: ["galeria", "caja", "tablero", "dentro"] }], // la galería o, si abriste uno, el proyecto (paso 57)
    icono: "proyecto",
  },
  // Paso 46a: tus ramos del semestre (universidad.js). Las tarjetas; al tocar una, la página de ese ramo.
  {
    id: "universidad", nombre: "Universidad", nuevo: ["evento", "tarea", "nota"],
    titulo: () => ["Universidad", semestreActual()].filter(Boolean).join(" · "),
    columnas: [{ ancho: 3, widgets: ["ramos", "ramo"] }, { ancho: 1.1, widgets: ["lo-que-viene"] }],
    icono: "examen",
  },
  // Paso 63: tu salud completa (salud.js). Va a pantalla completa.
  // Paso 69: tres bloques, Ejercicio, Hábitos y Dieta (paso 67, como Samsung Health); en cada uno, lo de hoy a la
  // izquierda y cómo vas a la derecha. Paso 70: se ve uno a la vez y se cambia con sus tarjetas (bloques.js).
  {
    id: "salud", nombre: "Salud", nuevo: ["habito", "alimento", "ejercicio", "rutina"],
    columnas: [
      BLOQUES.ejercicio,
      { nombre: "Hoy", ancho: 1, widgets: ["rutina", "semana-entreno"] },
      { nombre: "Cómo vas", ancho: 1.5, widgets: ["peso", "constancia-entreno"] },
      BLOQUES.habitos,
      { nombre: "Hoy", ancho: 1, widgets: ["habitos-hoy"] },
      { nombre: "Cómo vas", ancho: 1.5, widgets: ["cada-habito", "por-dia"] },
      BLOQUES.dieta,
      { nombre: "Hoy", ancho: 1, widgets: ["calorias-dia", "comidas-dia"] },
      { nombre: "Cómo vas", ancho: 1.5, widgets: ["equilibrio", "semana-comida", "despensa"] },
    ],
    icono: "salud",
  },
  // Paso 83: tu plata (finanzas.js), como Salud: tres bloques, Gastos, Ahorro y Suscripciones, con lo de ahora a la
  // izquierda y cómo vas a la derecha. Va a pantalla completa.
  {
    id: "finanzas", nombre: "Finanzas", nuevo: ["categoria", "cuenta", "suscripcion"],
    columnas: [
      FINANZAS.gastos,
      { nombre: "Esta semana", ancho: 1, widgets: ["semana-gasto", "movimientos"] },
      { nombre: "Cómo vas", ancho: 1.25, widgets: ["en-que-gastas", "por-categoria", "semanas-gasto", "entra-sale"] }, // paso 99: la dona también aquí
      FINANZAS.ahorro,
      { nombre: "Ahora", ancho: 1, widgets: ["cuentas", "apartar"] },
      { nombre: "Cómo vas", ancho: 1.25, widgets: ["objetivo-ahorro", "historial-ahorro"] },
      FINANZAS.suscripciones,
      { nombre: "Este mes", ancho: 1, widgets: ["este-mes", "suscripciones"] },
      { nombre: "Cómo vas", ancho: 1.25, widgets: ["detectadas", "en-un-ano", "pausadas"] },
    ],
    icono: "billetera",
  },
  // Paso 101: todo tu árbol como carpetas (archivos.js), para llegar a cualquier rama aunque no tenga apartado propio.
  // Una sola ventana partida en tres, como el Explorador de Windows (paso 103): a la izquierda el árbol de carpetas
  // (en el celular se esconde y se navega con la ruta), al centro la carpeta abierta y a la derecha las propiedades de lo elegido.
  {
    id: "archivos", nombre: "Archivos",
    columnas: [{ ancho: 0.95, widgets: ["arbol-carpetas"] }, { ancho: 2.6, widgets: ["carpeta"] }, { ancho: 1.05, widgets: ["propiedades-carpeta"] }],
    icono: "carpeta",
  },
  {
    id: "mapa", nombre: "Mapa", dibujar: dibujarMapa, alMostrar: () => ajustarMapa(true),
    icono: "red",
  },
  // Paso 53: cómo se ve la web (modo, color, fondo, vidrio, letra) y tu cuenta (ajustes.js y apariencia.js).
  {
    id: "ajustes", nombre: "Ajustes", abajo: true,
    columnas: [{ ancho: 3, widgets: ["modo", "fondo"] }, { ancho: 2, widgets: ["barra", "vistas", "ventanas", "cuenta"] }],
    icono: "ajustes",
  },
];

// Los cajones: paneles que salen desde la derecha sin dejar el apartado donde estás (el calendario,
// más adelante el chat). Van al final del dock, separados. Cada uno es un <aside id="..." class="cajon">.
//   iniciar   se llama una vez, al empezar
//   dibujar   se llama al abrirlo y cada vez que llegan datos nuevos (si está cerrado, no hace nada)
export const CAJONES = [
  {
    id: "calendario", nombre: "Calendario", iniciar: iniciarCalendario, dibujar: dibujarCalendario,
    icono: "calendario",
  },
];
