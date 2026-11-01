// El mapa: dibuja tus nodos como cajas dentro de cajas (paso 14), con filtros en la leyenda (paso 13).
// Qué contiene a qué, los colores y las subcajas vienen de la base (paso 19), no de listas escritas aquí.
import cytoscape from "https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/+esm";
import { $, el, datos, colorDe } from "./base.js";
import { mostrarPanel, cerrarPanel } from "./panel.js";

let cy; // el grafo dibujado

// Filtros. Viven solo en memoria: al recargar la página vuelven a lo normal.
let verHechos = false;          // ¿mostrar lo que ya está Hecho?
const tiposOcultos = new Set(); // tipos escondidos desde la leyenda

// ---------- Acomodo ----------
// Cada caja se mide de adentro hacia afuera: primero sus cajas hijas, después sus puntos sueltos en grilla.
// Luego se colocan de afuera hacia adentro. Como cada caja reserva su propio rectángulo, nada se tapa.
const CELDA = { w: 130, h: 80 };  // espacio para cada punto con su nombre
const ESPACIO = 50;               // separación entre cajas hermanas
const CABECERA = 40;              // lugar para el nombre de la caja, arriba del borde

// Recibe los nodos que van juntos en un mismo nivel y devuelve su tamaño
// y una función colocar(x, y) que los ubica con la esquina superior izquierda en (x, y).
function medir(hermanos) {
  const hojas = hermanos.filter((n) => n.isChildless());
  const cajas = hermanos.filter((n) => n.isParent()).map(medirCaja)
    .sort((a, b) => !!a.nodo.data("modulo") - !!b.nodo.data("modulo") || b.w * b.h - a.w * a.h); // grandes primero, las de módulo al final

  // Los puntos van en una grilla más ancha que alta.
  const columnas = Math.max(1, Math.ceil(Math.sqrt(hojas.length * 2)));
  const grilla = { w: hojas.length ? columnas * CELDA.w : 0, h: Math.ceil(hojas.length / columnas) * CELDA.h };

  // Las cajas se reparten en filas, como libros en un estante, sin pasarse de un ancho razonable.
  const superficie = cajas.reduce((s, c) => s + (c.w + ESPACIO) * (c.h + ESPACIO), 0);
  const tope = Math.max(grilla.w, ...cajas.map((c) => c.w), Math.sqrt(superficie) * 1.5);
  let x = 0, y = 0, altoFila = 0, ancho = grilla.w;
  const ubicadas = [];
  for (const c of cajas) {
    if (x > 0 && x + c.w > tope) { x = 0; y += altoFila + ESPACIO; altoFila = 0; }
    ubicadas.push({ c, x, y });
    x += c.w + ESPACIO;
    altoFila = Math.max(altoFila, c.h);
    ancho = Math.max(ancho, x - ESPACIO);
  }
  const altoCajas = cajas.length ? y + altoFila : 0;
  const arribaGrilla = altoCajas + (cajas.length && hojas.length ? ESPACIO : 0);

  return {
    w: ancho, h: arribaGrilla + grilla.h,
    colocar(x0, y0) {
      for (const u of ubicadas) u.c.colocar(x0 + u.x, y0 + u.y);
      hojas.forEach((n, i) => n.position({
        x: x0 + (i % columnas) * CELDA.w + CELDA.w / 2,
        y: y0 + arribaGrilla + Math.floor(i / columnas) * CELDA.h + CELDA.h / 3,
      }));
    },
  };
}

// Una caja mide lo que miden sus hijos, más su borde interior y el lugar para su nombre.
function medirCaja(caja) {
  const relleno = caja.data("nivel") === 0 ? 28 : 18;
  const adentro = medir(caja.children().not(".escondido"));
  return {
    nodo: caja, w: adentro.w + 2 * relleno, h: adentro.h + 2 * relleno + CABECERA,
    colocar: (x, y) => adentro.colocar(x + relleno, y + CABECERA + relleno),
  };
}

// ---------- Cajas ----------
// La caja de cada nodo la calcula la base (vista "arbol"). Aquí se agregan dos cajas que no existen
// en la base, solo para dibujar:
//   * subcajas: un tipo puede pedir juntarse dentro de ciertas cajas (ej. eventos de un tópico -> "Evaluaciones").
//   * módulos: lo que no está dentro de nada va a la caja de su módulo ("Dieta", "Biblioteca"...).
//     Lo de nivel 0 (las áreas) queda suelto: ellas son las cajas grandes.
function cajasVirtuales() {
  const padres = new Map(datos.padre);
  const virtuales = new Map();   // id -> { label, color, padre, modulo }
  for (const n of datos.nodos) {
    const t = datos.tipo.get(n.tipos.clave);
    const caja = padres.get(n.id);
    const nombre = caja ? t?.subcaja?.[datos.nodo.get(caja)?.tipos.clave] : null;
    let id = null;
    if (nombre) {
      id = `_sub:${caja}:${t.clave}`;
      virtuales.set(id, { label: nombre, color: t.color, padre: caja });
    } else if (!caja && t?.nivel !== 0) {
      id = `_mod:${t?.modulo ?? "Otros"}`;
      virtuales.set(id, { label: t?.modulo ?? "Otros", color: "#78716c", modulo: true });
    }
    if (id) padres.set(n.id, id);
  }
  return { padres, virtuales };
}

export function dibujar() {
  const { padres, virtuales } = cajasVirtuales();
  const elementos = [
    ...[...virtuales].map(([id, v]) => ({ data: { id, ...v, virtual: true } })),
    ...datos.nodos.map((n) => {
      const t = datos.tipo.get(n.tipos.clave);
      return { data: { id: n.id, label: n.titulo, tipo: n.tipos.clave, nivel: t?.nivel, color: colorDe(n.tipos.clave),
                       hecho: n.estado === "Hecho", padre: padres.get(n.id) } }; // aplicarFiltros() lo mete en su "padre"
    }),
    ...datos.conexiones.map((c) => ({ data: { id: c.id, source: c.origen_id, target: c.destino_id, label: c.relacion.replaceAll("_", " ") } })),
  ];

  const estilo = getComputedStyle(document.documentElement);
  const [texto, suave, fondo] = ["--texto", "--suave", "--fondo"].map((v) => estilo.getPropertyValue(v).trim());

  if (cy) cy.destroy(); // al recargar, se reemplaza el mapa anterior
  cy = cytoscape({
    container: $("grafo"),
    elements: elementos,
    layout: { name: "preset" }, // la posición real la calcula aplicarFiltros()
    style: [
      { selector: "node", style: {
          "background-color": "data(color)", label: "data(label)", color: texto,
          "font-size": 12, "text-valign": "bottom", "text-margin-y": 6, width: 22, height: 22,
          "min-zoomed-font-size": 10, // el nombre se esconde si, con el zoom actual, la letra quedaría bajo 10 px
          "text-wrap": "ellipsis", "text-max-width": 160,
      } },
      // Lo más general (nivel 0, las áreas) es más grande; lo que contiene a otros, un poco más.
      { selector: "node[nivel = 0]", style: { width: 40, height: 40, "font-size": 18, "font-weight": "bold" } },
      { selector: "node[nivel > 0]", style: { width: 30, height: 30, "font-size": 14 } },
      { selector: "node[?hecho]", style: { opacity: 0.45 } },
      // Un nodo con hijos se dibuja como caja del color de su tipo, con el nombre arriba.
      { selector: "node:parent", style: {
          shape: "round-rectangle", "background-color": "data(color)", "background-opacity": 0.07,
          "border-width": 1.5, "border-color": "data(color)", "border-opacity": 0.6, padding: 18,
          "text-valign": "top", "text-margin-y": -4, "font-size": 18, "font-weight": "bold", "min-zoomed-font-size": 0,
      } },
      { selector: "node[nivel = 0]:parent", style: { "font-size": 26, padding: 28, "background-opacity": 0.04 } },
      // Cajas de módulo: grises y con borde punteado.
      { selector: "node[?modulo]", style: {
          "background-color": suave, "background-opacity": 0.08, "border-width": 1, "border-color": suave,
          "border-style": "dashed", "font-size": 20, color: suave, padding: 16,
      } },
      // Subcajas (ej. "Evaluaciones"): del color del tipo que agrupan, más chicas.
      { selector: "node[?virtual][!modulo]", style: { "background-opacity": 0.06, color: "data(color)", "font-size": 14, padding: 12 } },
      { selector: "node:childless", style: { "text-max-width": 120 } }, // el nombre cabe en su celda
      { selector: ".escondido", style: { display: "none" } },          // filtros: lo saca del mapa con sus flechas
      // Con el mouse encima, o al enfocar, el nombre se ve siempre.
      { selector: "node.conEtiqueta", style: { "min-zoomed-font-size": 0, "z-index": 10, "text-max-width": 400 } },
      // Modo enfoque: lo que no es vecino del nodo elegido se apaga.
      { selector: ".apagado", style: { opacity: 0.12 } },
      { selector: "node.elegido", style: { "border-width": 3, "border-color": texto } },
      // Flechas hacia la caja que ya te contiene: sobran (estar adentro ya lo dice).
      { selector: "edge.dentro", style: { display: "none" } },
      { selector: "edge", style: {
          width: 1.2, "line-color": suave, "target-arrow-color": suave, "target-arrow-shape": "triangle",
          "curve-style": "bezier", opacity: 0.6,
      } },
      // El nombre de la flecha ("pertenece a") solo aparece en las flechas del nodo enfocado.
      { selector: "edge.conEtiqueta", style: {
          label: "data(label)", "font-size": 9, color: suave, "text-rotation": "autorotate", opacity: 1,
          "text-background-color": fondo, "text-background-opacity": 1, "text-background-padding": 2,
      } },
    ],
  });

  cy.on("tap", "node", (e) => { if (!e.target.data("virtual")) enfocar(e.target.id()); });
  cy.on("tap", (e) => { if (e.target === cy) desenfocar(); });
  cy.on("mouseover", "node", (e) => e.target.addClass("conEtiqueta"));
  cy.on("mouseout", "node", (e) => { if (!e.target.hasClass("vecino")) e.target.removeClass("conEtiqueta"); });

  dibujarLeyenda();
  aplicarFiltros();
}

// ---------- Leyenda y filtros ----------
// La leyenda también es el panel de filtros: cada tipo es un botón que lo esconde o muestra.
// Va agrupada por módulo y en el orden que dice la base.
function dibujarLeyenda() {
  const presentes = new Set(datos.nodos.map((n) => n.tipos.clave));
  const partes = [];
  let modulo = "";
  for (const t of datos.tipos.filter((t) => presentes.has(t.clave))) {
    if (t.modulo !== modulo) partes.push(el("span", { className: "modulo", textContent: (modulo = t.modulo) }));
    const b = el("button", { textContent: t.nombre, className: tiposOcultos.has(t.clave) ? "apagada" : "" });
    b.style.setProperty("--c", t.color);
    b.onclick = () => {
      tiposOcultos.has(t.clave) ? tiposOcultos.delete(t.clave) : tiposOcultos.add(t.clave);
      b.classList.toggle("apagada");
      aplicarFiltros();
    };
    partes.push(b);
  }
  const hechos = datos.nodos.filter((n) => n.estado === "Hecho").length;
  const botonHechos = el("button", { className: "hechos" });
  const rotular = () => (botonHechos.textContent = `${verHechos ? "Ocultar" : "Mostrar"} hechos (${hechos})`);
  botonHechos.onclick = () => { verHechos = !verHechos; rotular(); aplicarFiltros(); };
  rotular();
  $("leyenda").replaceChildren(...partes, ...(hechos ? [botonHechos] : []));
}

// Esconde lo que piden los filtros y vuelve a acomodar solo lo que queda a la vista.
function aplicarFiltros() {
  desenfocar();
  const virtuales = cy.nodes("[?virtual]");
  const nodos = cy.nodes().not(virtuales);
  cy.batch(() => {
    nodos.forEach((n) => {
      const oculto = tiposOcultos.has(n.data("tipo")) || (!verHechos && n.data("hecho"));
      n.toggleClass("escondido", oculto);
      // Lo escondido sale de su caja: así una caja cuyos hijos están todos escondidos vuelve a ser un punto.
      if (oculto && n.parent().nonempty()) n.move({ parent: null });
    });
    // Una caja virtual se esconde si todo lo que tiene adentro está escondido.
    // Primero las subcajas y después las de módulo, porque una subcaja puede estar dentro de un módulo.
    const conAlgo = (v) => cy.nodes().some((n) => n.data("padre") === v.id() && !n.hasClass("escondido"));
    for (const grupo of [virtuales.filter("[!modulo]"), virtuales.filter("[?modulo]")]) {
      grupo.forEach((v) => {
        const vacia = !conAlgo(v);
        v.toggleClass("escondido", vacia);
        if (vacia && v.parent().nonempty()) v.move({ parent: null });
      });
    }
    // Cada nodo visible entra a su caja. Si su caja está escondida, sube a la caja de la caja.
    cy.nodes().not(".escondido").forEach((n) => {
      let p = n.data("padre");
      while (p && cy.getElementById(p).hasClass("escondido")) p = cy.getElementById(p).data("padre");
      if ((n.parent().id() ?? null) !== (p ?? null)) n.move({ parent: p ?? null });
    });
    cy.edges().forEach((e) => e.toggleClass("dentro", e.source().ancestors().contains(e.target())));
  });
  // Se acomoda desde el nivel de más afuera: lo que no está dentro de ninguna caja.
  const visibles = cy.nodes().not(".escondido");
  cy.batch(() => medir(visibles.orphans()).colocar(0, 0));
  cy.fit(visibles, 30);
}

// ---------- Enfoque ----------
// Ilumina el nodo y sus vecinos directos, y muestra el panel.
export function enfocar(id) {
  const nodo = cy?.getElementById(id);
  if (!nodo?.length) return mostrarPanel(id);
  cy.elements().removeClass("elegido conEtiqueta vecino").addClass("apagado");
  nodo.closedNeighborhood().removeClass("apagado").addClass("conEtiqueta vecino"); // los vecinos muestran su nombre
  nodo.addClass("elegido");
  cy.animate({ center: { eles: nodo } }, { duration: 300 });
  mostrarPanel(id);
}

export function desenfocar() {
  cy?.elements().removeClass("apagado elegido conEtiqueta vecino");
  cerrarPanel();
}

// El mapa recupera o cede el ancho del panel. Con mostrarTodo, además encuadra lo visible.
export function ajustarMapa(mostrarTodo = false) {
  if (!cy) return;
  cy.resize();
  if (mostrarTodo) cy.fit(cy.nodes().not(".escondido"), 30);
}
