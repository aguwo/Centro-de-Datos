// Paso 104: la ficha de cualquier cosa. Una ventana grande, encima de todo, que reemplaza al panel viejo en toda la web.
//   arriba     su ícono, su nombre (se cambia escribiendo encima), su categoría y dónde está; lo típico (marcarla hecha),
//              abrirla en Archivos y «⋯» (cambiar categoría, archivar)
//   izquierda  sus propiedades y sus notas. Todo se guarda solo al cambiarlo, sin botón Guardar.
//   derecha    su grafo: ella al centro, lo conectado directo alrededor (con flecha y relación) y, más suave, lo conectado
//              a eso. Tocar algo abre su ficha (con «‹» se vuelve); clic derecho, quitar la conexión. «+ Conectar» agrega una.
// Se abre con abrirFicha(id) (panel.js la usa en mostrarPanel, así todos los botones de la web la abren igual).
import { el, datos, colorDe, colorDeProyecto, cajasDe, irA, escribible, escribiendoEn, avisar, pedirRecarga, sinTildes } from "./base.js";
import { editorDePropiedades, tienePropiedad, formulario } from "./panel.js";
import { cambiar, completar, reabrir, conectar, desconectar } from "./acciones.js";
import { icono, insignia } from "./dibujos.js";
import { iconoDe } from "./formas.js";
import { menuEn } from "./menu.js";

let dialogo, actual = null, antes = []; // la ventana, el id que muestra y las fichas por las que pasaste (para «‹»)
let conectando = null; // con «+ Conectar» abierto: { relacion, texto }

// Lo que contiene cosas usa el color de su proyecto o ramo; lo demás, el de su categoría.
const colorDeNodo = (n) => (datos.tipo.get(n.tipos.clave)?.nivel != null ? colorDeProyecto(n.id) : colorDe(n.tipos.clave));
const relacion = (r) => r.replaceAll("_", " ");

// Abre la ficha de un nodo. adentro = se llegó desde otra ficha (tocando su grafo): queda para volver con «‹».
export function abrirFicha(id, adentro = false) {
  if (!datos.nodo.has(id)) return;
  dialogo ??= crear();
  if (adentro && actual && actual !== id) antes.push(actual);
  else if (!adentro) antes = [];
  actual = id;
  conectando = null;
  dibujar();
  // Abre con el foco en la ventana (no en el nombre: así no queda escribiendo sin querer).
  if (!dialogo.open) { dialogo.showModal(); dialogo.focus(); }
}
// Cuando cambian los datos: se vuelve a dibujar (o se cierra si ya no está). Escribiendo, no se pisa.
export function refrescarFicha() {
  if (!dialogo?.open) return;
  if (!datos.nodo.has(actual)) return dialogo.close();
  if (!escribiendoEn(dialogo)) dibujar();
}
const cerrar = () => dialogo?.close();

function crear() {
  const d = el("dialog", { className: "ficha vidrio", tabIndex: -1, onclose: () => { actual = null; antes = []; },
    onclick: (e) => { if (e.target === d) d.close(); } }); // tocar fuera la cierra; Esc también (lo hace el dialog)
  d.dataset.teclas = "";
  document.body.append(d);
  return d;
}

function dibujar() {
  const n = datos.nodo.get(actual), color = colorDeNodo(n);
  const hecha = n.estado === "Hecho";
  // Dónde está: Universidad › Base de Datos. Cada parte abre su ficha.
  const donde = cajasDe(n.id).reverse().flatMap((id, i) => [i ? " › " : "", el("button", { className: "lugar", textContent: datos.nodo.get(id).titulo, onclick: () => abrirFicha(id, true) })]);
  const caja = datos.padre.get(n.id);
  const cabeza = el("header", { className: "cabeza-ficha" },
    antes.length ? el("button", { className: "volver", title: "Volver a " + datos.nodo.get(antes.at(-1))?.titulo, ariaLabel: "Volver", textContent: "‹",
      onclick: () => { actual = antes.pop(); dibujar(); } }) : "",
    insignia(iconoDe(n), color, "grande"),
    el("div", { className: "nombre-ficha" },
      escribible("h2", n.titulo, (t) => t && t !== n.titulo && cambiar(n, { titulo: t })),
      el("p", {}, el("span", { className: "chip", textContent: n.tipos.nombre }), donde.length ? " en " : "", ...donde)),
    el("div", { className: "acciones-ficha" },
      tienePropiedad(n, "estado") ? el("button", { className: hecha ? "" : "principal", textContent: hecha ? "Volver a abrir" : "✓ Marcar hecha",
        onclick: () => (hecha ? reabrir(n) : completar(n)) }) : "",
      el("button", { textContent: "Abrir en Archivos", onclick: () => {
        cerrar();
        irA("archivos", { carpeta: caja ?? null, buscar: "", elegidos: new Set([n.id]), ancla: n.id, desde: n.id });
      } }),
      el("button", { textContent: "⋯", title: "Más", ariaLabel: "Más", onclick: (e) => menuEn(e, [
        { texto: "Cambiar categoría o conexiones…", hacer: () => { cerrar(); formulario(n, { tipos: datos.tipos.map((t) => t.clave) }); } },
        { texto: "Archivar", hacer: () => archivarla(n) },
      ]) }),
      el("button", { className: "cerrar", textContent: "×", title: "Cerrar (Esc)", ariaLabel: "Cerrar", onclick: cerrar })));
  cabeza.querySelector(".chip").style.setProperty("--c", colorDe(n.tipos.clave));

  // Las notas se guardan al salir del cuadro.
  const notas = el("textarea", { className: "notas-ficha", value: n.contenido ?? "", placeholder: "Notas, ideas, enlaces…", ariaLabel: "Notas",
    onchange: () => cambiar(n, { contenido: notas.value.trim() || null }) });
  const izquierda = el("section", { className: "datos-ficha" },
    el("h3", { textContent: "Propiedades" }), editorDePropiedades([n]),
    el("h3", { textContent: "Notas" }), notas,
    el("small", { className: "vacio", textContent: "Todo se guarda solo al cambiarlo · Esc cierra" }));

  const directas = datos.conexiones.filter((c) => c.origen_id === n.id || c.destino_id === n.id);
  const derecha = el("section", { className: "conexiones-ficha" },
    el("div", { className: "titulo-conexiones" }, el("h3", { textContent: `Conexiones · ${directas.length} ${directas.length === 1 ? "directa" : "directas"}` }),
      el("button", { textContent: conectando ? "Listo" : "+ Conectar", ariaExpanded: String(!!conectando),
        onclick: () => { conectando = conectando ? null : { relacion: datos.tipo.get(n.tipos.clave)?.conexiones?.[0]?.relacion, texto: "" }; dibujar(); } })),
    conectando ? formularioConectar(n) : "",
    grafo(n, directas),
    el("small", { className: "vacio", textContent: "Toca algo para abrir su ficha · arrástralo para moverlo · rueda o + − para acercar · clic derecho para quitar la conexión" }));

  dialogo.replaceChildren(cabeza, el("div", { className: "cuerpo-ficha" }, izquierda, derecha));
}

// Archivar no borra: deja de verse y se puede recuperar. Igual sale «Deshacer» un rato.
function archivarla(n) {
  cambiar(n, { archivado: true });
  cerrar();
  avisar(`«${n.titulo}» archivado`, { texto: "Deshacer", hacer: () => cambiar(n, { archivado: false }) });
}

// ---------- El grafo ----------
// Se dibuja en un plano de ANCHO × ALTO (se estira al ancho que haya, sin deformarse): ella al centro, lo directo en
// una elipse alrededor y, más afuera y más suave, hasta SEGUNDAS cosas conectadas a cada una (lo que ya está, no se repite).
const ANCHO = 600, ALTO = 520, MAX = 10, SEGUNDAS = 2;
function grafo(n, directas) {
  const cx = ANCHO / 2, cy = ALTO / 2;
  // Una por cosa conectada (si hay dos conexiones con la misma, van juntas en la misma línea).
  const vecinas = [...Map.groupBy(directas, (c) => (c.origen_id === n.id ? c.destino_id : c.origen_id))].map(([id, cs]) => ({ nodo: datos.nodo.get(id), cs }));
  const puestos = new Set([n.id, ...vecinas.map((v) => v.nodo.id)]);
  // Cada cosa sabe dónde está (x, y en el plano de 600 × 520) y qué tan grande es (r, para que la línea llegue a su borde).
  const ella = { nodo: n, x: cx, y: cy, r: 40, ella: true };
  const nodos = [ella], lineas = [];
  vecinas.slice(0, MAX).forEach((v, i, xs) => {
    const ang = -Math.PI / 2 + (i + (xs.length % 2 ? 0 : 0.5)) * (2 * Math.PI / xs.length);
    const p = { ...v, ...punto(cx, cy, ang, 200, 175), r: 26 };
    nodos.push(p);
    for (const c of v.cs) lineas.push(c.origen_id === n.id ? { c, de: ella, a: p } : { c, de: p, a: ella });
    // Lo conectado a esta, más afuera, abriéndose un poco a cada lado.
    const otras = datos.conexiones.filter((c) => (c.origen_id === v.nodo.id || c.destino_id === v.nodo.id))
      .map((c) => (c.origen_id === v.nodo.id ? c.destino_id : c.origen_id)).filter((id) => !puestos.has(id)).slice(0, SEGUNDAS);
    otras.forEach((id, j) => {
      puestos.add(id);
      const q = { nodo: datos.nodo.get(id), ...punto(cx, cy, ang + (j - (otras.length - 1) / 2) * 0.38, 330, 290), r: 17, suave: true };
      nodos.push(q);
      lineas.push({ de: p, a: q, suave: true });
    });
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${ANCHO} ${ALTO}`);
  svg.innerHTML = `<defs><marker id="punta-ficha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>`;
  const trazos = lineas.map((l) => {
    const linea = trazo("line", { class: l.suave ? "suave" : "", "marker-end": l.suave ? "" : "url(#punta-ficha)" });
    const texto = l.c ? Object.assign(trazo("text", {}), { textContent: relacion(l.c.relacion) }) : null;
    svg.append(linea, ...(texto ? [texto] : []));
    return { l, linea, texto };
  });
  // Las líneas se vuelven a trazar cada vez que algo se mueve.
  const dibujarLineas = () => {
    for (const { l, linea, texto } of trazos) {
      const [x1, y1, x2, y2] = acortar(l.de, l.a);
      for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) linea.setAttribute(k, v);
      // El nombre de la relación, más cerca de la otra punta (junto al centro va el nombre de ella).
      const [lx, ly] = l.de.ella ? [x1 + (x2 - x1) * .6, y1 + (y2 - y1) * .6] : [x2 + (x1 - x2) * .6, y2 + (y1 - y2) * .6];
      texto?.setAttribute("x", lx); texto?.setAttribute("y", ly + 4);
    }
  };
  const piezas = new Map(); // el botón (o el centro) -> su cosa
  const ubicarla = (pieza, x) => {
    ubicar(pieza, x.x, x.y);
    // Lo que queda arriba del centro lleva su nombre arriba: así las líneas que llegan desde abajo no lo cruzan.
    if (!x.ella) pieza.classList.toggle("arriba", x.y < ella.y - 10);
  };
  for (const x of nodos) {
    const pieza = x.ella ? el("div", { className: "nodo-grafo ella" }, insignia(iconoDe(n), colorDeNodo(n), "grande"), el("span", { textContent: n.titulo }))
      : el("button", { className: "nodo-grafo" + (x.suave ? " suave" : ""), title: `${x.nodo.titulo} · ${x.nodo.tipos.nombre}`,
        onclick: () => abrirFicha(x.nodo.id, true),
        oncontextmenu: (e) => menuEn(e, [
          { texto: "Abrir su ficha", hacer: () => abrirFicha(x.nodo.id, true) },
          ...(x.cs ?? []).map((c) => ({ texto: `Quitar «${relacion(c.relacion)}»`, hacer: () => desconectar(c) })),
        ]) }, insignia(iconoDe(x.nodo), colorDeNodo(x.nodo), x.suave ? "chica" : ""), el("span", { textContent: x.nodo.titulo }));
    piezas.set(pieza, x);
    ubicarla(pieza, x);
  }
  dibujarLineas();

  // Paso 107: el grafo se recorre. Arrastrar el fondo lo mueve, la rueda (o los botones) acerca y aleja, y cada cosa
  // se puede arrastrar a otro lugar (las líneas la siguen). Un toque sin arrastrar abre su ficha, como antes.
  const mundo = el("div", { className: "mundo-grafo" }, svg, ...piezas.keys());
  let cam = { x: 0, y: 0, z: 1 };
  const ponerCam = (suave = false) => {
    mundo.classList.toggle("viajando", suave);
    mundo.style.transform = `translate(${cam.x / ANCHO * 100}%, ${cam.y / ALTO * 100}%) scale(${cam.z})`;
  };
  const ZOOM = { min: 0.35, max: 2.5 };
  // Acercar o alejar dejando quieto el punto (px, py) del plano.
  const acercar = (z, px = ANCHO / 2, py = ALTO / 2, suave = false) => {
    z = Math.min(ZOOM.max, Math.max(ZOOM.min, z));
    cam = { x: px - (px - cam.x) * (z / cam.z), y: py - (py - cam.y) * (z / cam.z), z };
    ponerCam(suave);
  };
  // Todo a la vista: se centra lo que hay y, si no cabe, se aleja lo justo.
  const verTodo = (suave = false) => {
    const xs = nodos.map((x) => x.x), ys = nodos.map((x) => x.y);
    const izq = Math.min(...xs) - 80, der = Math.max(...xs) + 80, arriba = Math.min(...ys) - 60, abajo = Math.max(...ys) + 65;
    const z = Math.max(ZOOM.min, Math.min(1, ANCHO / (der - izq), ALTO / (abajo - arriba)));
    cam = { z, x: ANCHO / 2 - (izq + der) / 2 * z, y: ALTO / 2 - (arriba + abajo) / 2 * z };
    ponerCam(suave);
  };
  const boton = (texto, titulo, hacer) => el("button", { type: "button", textContent: texto, title: titulo, ariaLabel: titulo, onclick: hacer });
  const plano = el("div", { className: "plano-grafo" }, mundo, nodos.length > 1 ? el("div", { className: "controles-grafo" },
    boton("+", "Acercar", () => acercar(cam.z * 1.3, undefined, undefined, true)),
    boton("−", "Alejar", () => acercar(cam.z / 1.3, undefined, undefined, true)),
    boton("⤢", "Ver todo", () => verTodo(true))) : "");
  verTodo();

  const porPx = () => ANCHO / plano.getBoundingClientRect().width; // cuánto plano es un px de pantalla (sin acercar)
  plano.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest(".controles-grafo")) return;
    const pieza = [...piezas.keys()].find((p) => p.contains(e.target)), x = piezas.get(pieza);
    const k = porPx(), desde = { x: e.clientX, y: e.clientY }, inicio = x ? { x: x.x, y: x.y } : { ...cam };
    let movido = false;
    plano.onpointermove = (m) => {
      const dx = m.clientX - desde.x, dy = m.clientY - desde.y;
      if (!movido) {
        if (Math.hypot(dx, dy) < 4) return; // un temblor del dedo todavía es un toque
        movido = true;
        plano.setPointerCapture(e.pointerId); // desde aquí es arrastre: el clic ya no abre la ficha
        plano.classList.add("moviendo");
      }
      if (x) { x.x = inicio.x + dx * k / cam.z; x.y = inicio.y + dy * k / cam.z; ubicarla(pieza, x); dibujarLineas(); }
      else { cam = { ...cam, x: inicio.x + dx * k, y: inicio.y + dy * k }; ponerCam(); }
    };
    plano.onpointerup = plano.onpointercancel = () => { plano.onpointermove = plano.onpointerup = plano.onpointercancel = null; plano.classList.remove("moviendo"); };
  };
  plano.onwheel = (e) => {
    e.preventDefault();
    const r = plano.getBoundingClientRect(), k = ANCHO / r.width;
    acercar(cam.z * Math.exp(-e.deltaY * 0.0015), (e.clientX - r.left) * k, (e.clientY - r.top) * k);
  };
  plano.ondblclick = (e) => { if (!e.target.closest(".nodo-grafo, .controles-grafo")) verTodo(true); };

  const sobran = vecinas.slice(MAX);
  return el("div", { className: "grafo-ficha" }, plano,
    !vecinas.length ? el("p", { className: "vacio", textContent: "Sin conexiones todavía. Conéctala con «+ Conectar»." }) : "",
    sobran.length ? el("p", { className: "mas-conexiones" }, `Y ${sobran.length} más: `, ...sobran.flatMap((v, i) => [i ? ", " : "",
      el("button", { className: "lugar", textContent: v.nodo.titulo, onclick: () => abrirFicha(v.nodo.id, true) })])) : "");
}
const punto = (cx, cy, ang, rx, ry) => ({ x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
// La línea va de borde a borde (no de centro a centro), para que la flecha se vea.
function acortar(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, largo = Math.hypot(dx, dy) || 1;
  return [a.x + dx * a.r / largo, a.y + dy * a.r / largo, b.x - dx * b.r / largo, b.y - dy * b.r / largo];
}
function trazo(tag, atributos) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(atributos)) if (v !== "") t.setAttribute(k, v);
  return t;
}
function ubicar(x, px, py) { x.style.left = `${px / ANCHO * 100}%`; x.style.top = `${py / ALTO * 100}%`; }

// ---------- «+ Conectar» ----------
// Las conexiones que permite su categoría (ej. una tarea pertenece_a un proyecto o trata_sobre un tópico):
// eliges la relación y buscas con qué. Lo que ya está conectado así no sale.
function formularioConectar(n) {
  const reglas = datos.tipo.get(n.tipos.clave)?.conexiones ?? [];
  if (!reglas.length) return el("p", { className: "vacio", textContent: `«${n.tipos.nombre}» no tiene conexiones definidas.` });
  const regla = reglas.find((r) => r.relacion === conectando.relacion) ?? reglas[0];
  const relaciones = el("select", { ariaLabel: "Relación", onchange: () => { conectando.relacion = relaciones.value; dibujar(); } },
    ...reglas.map((r) => el("option", { value: r.relacion, textContent: relacion(r.relacion) })));
  relaciones.value = regla.relacion;
  const ya = new Set(datos.conexiones.filter((c) => c.origen_id === n.id && c.relacion === regla.relacion).map((c) => c.destino_id));
  const lista = el("ul", { className: "candidatos" });
  const buscar = el("input", { type: "search", value: conectando.texto, placeholder: "Buscar con qué…", ariaLabel: "Buscar con qué conectar",
    oninput: () => { conectando.texto = buscar.value; llenar(); } });
  function llenar() {
    const texto = sinTildes(conectando.texto.trim());
    const candidatos = datos.nodos.filter((x) => regla.hacia.includes(x.tipos.clave) && x.id !== n.id && !ya.has(x.id) && sinTildes(x.titulo).includes(texto))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "es")).slice(0, 8);
    lista.replaceChildren(...candidatos.map((x) => el("li", {}, el("button", { onclick: async () => {
      conectando = null;
      await conectar(n.id, { relacion: regla.relacion, destino_id: x.id });
      pedirRecarga();
    } }, insignia(iconoDe(x), colorDeNodo(x), "chica"), el("span", { textContent: x.titulo }), el("small", { textContent: x.tipos.nombre })))),
    candidatos.length ? "" : el("li", { className: "vacio", textContent: "Nada que calce." }));
  }
  llenar();
  setTimeout(() => buscar.focus());
  return el("div", { className: "conectar-ficha" }, el("div", { className: "fila" }, relaciones, buscar), lista);
}
