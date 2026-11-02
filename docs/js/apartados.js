// Los apartados de la web: cada uno es una sección del escritorio con su botón en el dock.
// Para agregar uno: escribir su <section id="..." class="apartado"> en index.html y sumarlo a esta lista.
// La carcasa (carcasa.js) arma el dock y cambia de apartado sola; no hay que tocarla.
//
//   id        el id de su <section> (y lo que aparece en la dirección: ...#mapa)
//   nombre    lo que dice la barra de arriba y la etiqueta del dock
//   icono     los trazos del ícono (SVG de 24 × 24, una sola línea)
//   dibujar   se llama cada vez que llegan datos nuevos
//   alMostrar (opcional) se llama al entrar al apartado
//   lugar     (opcional) [columna, fila] en el escritorio movible (escritorio.js). Los que tienen lugar se ven
//             juntos en el lienzo; los demás, a pantalla completa. El plan del escritorio:
//                            [1,0] Esta semana
//             [0,1] Productividad   [1,1] Hoy   [2,1] Salud
//                            [1,2] Finanzas
import { dibujarHoy } from "./hoy.js";
import { dibujarInicio } from "./inicio.js";
import { dibujar as dibujarMapa, ajustarMapa } from "./mapa.js";

export const APARTADOS = [
  {
    id: "hoy", nombre: "Hoy", dibujar: dibujarHoy, lugar: [1, 1],
    icono: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
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
