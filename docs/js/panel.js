// El panel lateral: los datos de un nodo con sus conexiones, y el formulario para crear o editar.
// Lee de los datos cargados (no del mapa), así funciona igual desde el Inicio.
import { db, $, el, avisar, datos, colorDe, recargar, pedirRecarga, dia, hora } from "./base.js";
import { enfocar, desenfocar, ajustarMapa } from "./mapa.js";

const ESTADOS = ["Inbox", "Por hacer", "En curso", "Esperando", "Hecho"]; // los mismos del paso 3

// ---------- Propiedades (paso 23) ----------
// Cada tipo dice qué propiedades tiene. "estado" y "fecha" viven en su columna del nodo; el resto, en props.
const EN_COLUMNA = ["estado", "fecha"];
const OCULTAS = ["notion_id"]; // las pone el sistema; no se muestran
const propiedadesDe = (clave) => datos.tipo.get(clave)?.propiedades ?? [];
const valorDe = (n, p) => (EN_COLUMNA.includes(p.clave) ? n[p.clave] : n.props?.[p.clave]);

// Cómo se lee un valor: fechas como 22-10-2026 (con hora si tiene), Sí/No, números y textos tal cual.
function legible(p, v) {
  if (v === null || v === undefined || v === "") return null;
  if (p.tipo === "fecha" || p.tipo === "fecha_hora") return [dia(v)?.split("-").reverse().join("-"), hora(v)].filter(Boolean).join(" ");
  if (p.tipo === "booleano") return v ? "Sí" : "No";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

// El control del formulario para una propiedad, según su tipo, ya con el valor actual.
function control(p, v) {
  const lista = (opciones) => {
    const s = el("select", {}, el("option", { value: "", textContent: "—" }), ...opciones.map((o) => el("option", { value: o, textContent: o })));
    s.value = v ?? "";
    return s;
  };
  switch (p.tipo) {
    case "estado": return lista(ESTADOS);
    case "seleccion": return lista(p.opciones ?? []);
    case "booleano": return el("input", { type: "checkbox", checked: !!v, className: "check" });
    case "numero": return el("input", { type: "number", step: "any", value: v ?? "" });
    case "fecha": return el("input", { type: "date", value: dia(v) ?? "" });
    case "fecha_hora": return el("input", { type: "datetime-local", value: v ? `${dia(v)}T${hora(v) || "00:00"}` : "" });
    case "enlace": return el("input", { type: "url", value: v ?? "", placeholder: "https://…" });
    default: return el("input", { value: v ?? "" });
  }
}

// Lo contrario: del control al valor que se guarda (vacío = null, que borra la propiedad).
function leer(p, c) {
  if (p.tipo === "booleano") return c.checked;
  if (!c.value) return null;
  if (p.tipo === "numero") return Number(c.value);
  if (p.tipo === "fecha_hora") return new Date(c.value).toISOString();
  return c.value;
}

// Qué nodo muestra el panel ahora (null si está cerrado o con un formulario abierto).
let mostrando = null;

function abrir(...contenido) {
  mostrando = null;
  $("panel").replaceChildren(...contenido);
  $("panel").classList.remove("oculto");
  document.body.classList.add("con-panel"); // el mapa se corre para dejarle espacio al panel
  ajustarMapa();
}

export function cerrarPanel() {
  mostrando = null;
  $("panel").classList.add("oculto");
  document.body.classList.remove("con-panel");
  ajustarMapa();
}

// La ruta del nodo: "Universidad / Base de Datos / Proyecto BD", subiendo de caja en caja.
function ruta(id) {
  const partes = [];
  for (let p = datos.padre.get(id); p; p = datos.padre.get(p)) partes.unshift(datos.nodo.get(p)?.titulo);
  return partes.join(" / ");
}

// Los datos del nodo y la lista de lo conectado (clic en uno para saltar a él).
export function mostrarPanel(id) {
  const n = datos.nodo.get(id);
  if (!n) return;

  const chip = el("span", { className: "chip", textContent: n.tipos.nombre });
  chip.style.setProperty("--c", colorDe(n.tipos.clave));

  const lista = el("dl");
  const fila = (k, v) => { if (v !== null && v !== undefined && v !== "") lista.append(el("dt", { textContent: k }), el("dd", { textContent: String(v) })); };
  fila("Dentro de", ruta(id));
  const propiedades = propiedadesDe(n.tipos.clave);
  for (const p of propiedades) fila(p.nombre, legible(p, valorDe(n, p)));
  // Lo que el nodo tenga y su tipo no declare (por ejemplo, de antes de cambiarlo de tipo) igual se muestra.
  const declaradas = new Set([...propiedades.map((p) => p.clave), ...OCULTAS]);
  for (const [k, v] of Object.entries(n.props ?? {})) if (!declaradas.has(k)) fila(k, legible({}, v));

  const conexiones = datos.conexiones.filter((c) => c.origen_id === id || c.destino_id === id);
  const vecinos = el("ul", {}, ...conexiones.map((c) => {
    const sale = c.origen_id === id; // ¿la flecha sale de este nodo o llega a él?
    const otro = datos.nodo.get(sale ? c.destino_id : c.origen_id);
    const relacion = c.relacion.replaceAll("_", " ");
    const boton = el("button", {}, el("span", { textContent: otro.titulo }),
      el("span", { className: "rel", textContent: sale ? `${relacion} →` : `← ${relacion}` }));
    boton.onclick = () => enfocar(otro.id);
    return el("li", {}, boton);
  }));

  const editar = el("button", { textContent: "Editar" });
  editar.onclick = () => formulario(n);
  const archivar = el("button", { textContent: "Archivar" });
  archivar.onclick = async () => {
    if (!confirm(`¿Archivar "${n.titulo}"? Desaparece del mapa, pero no se borra.`)) return;
    const { error } = await db.from("nodos").update({ archivado: true }).eq("id", n.id);
    if (error) return avisar(error.message);
    cerrarPanel();
    pedirRecarga();
  };
  const cerrar = el("button", { textContent: "Cerrar" });
  cerrar.onclick = desenfocar;

  abrir(
    chip,
    el("h2", { textContent: n.titulo }),
    el("div", { className: "acciones" }, editar, archivar, cerrar),
    lista,
    ...(n.contenido ? [el("div", { className: "contenido", textContent: n.contenido })] : []),
    el("h3", { textContent: `Conectado con (${conexiones.length})` }),
    conexiones.length ? vecinos : el("p", { className: "rel", textContent: "Sin conexiones todavía." }),
  );
  mostrando = id;
}

// Cuando cambian los datos, el panel abierto se vuelve a dibujar (o se cierra si el nodo ya no está).
// Un formulario a medio llenar no se toca.
export function refrescarPanel() {
  if (mostrando) datos.nodo.has(mostrando) ? mostrarPanel(mostrando) : cerrarPanel();
}

// Formulario para crear (sin nodo) o editar (con nodo). Se muestra en el mismo panel.
export function formulario(n) {
  const editando = !!n;
  const campo = (etiqueta, control) => [el("label", { textContent: etiqueta }), control];

  // Los tipos van agrupados por módulo, igual que en la leyenda.
  const tipo = el("select", { required: true, disabled: editando });
  const grupos = new Map();
  for (const t of datos.tipos) {
    if (!grupos.has(t.modulo)) {
      grupos.set(t.modulo, el("optgroup", { label: t.modulo }));
      tipo.append(grupos.get(t.modulo));
    }
    grupos.get(t.modulo).append(el("option", { value: t.clave, textContent: t.nombre }));
  }
  tipo.value = n?.tipos.clave ?? "tarea";

  const titulo = el("input", { required: true, value: n?.titulo ?? "", placeholder: "Ej: Estudiar cálculo" });
  const contenido = el("textarea", { value: n?.contenido ?? "", placeholder: "Notas, detalles…" });

  // Un campo por cada propiedad del tipo elegido. Al cambiar el tipo se vuelven a armar.
  const bloquePropiedades = el("div");
  let campos = [];   // [{ p, c }]: la propiedad y su control
  // Primera conexión (solo al crear): relación + nodo de destino, según lo que permite el tipo.
  const relacion = el("select");
  const destino = el("select");
  const tipoElegido = () => datos.tipo.get(tipo.value);
  function ajustarCampos() {
    campos = propiedadesDe(tipo.value).map((p) => ({ p, c: control(p, n ? valorDe(n, p) : p.tipo === "estado" ? "Inbox" : null) }));
    bloquePropiedades.replaceChildren(...campos.flatMap(({ p, c }) => campo(p.nombre, c)));
    relacion.replaceChildren(el("option", { value: "", textContent: "(sin conexión)" }),
      ...(tipoElegido()?.conexiones ?? []).map((c) => el("option", { value: c.relacion, textContent: c.relacion.replaceAll("_", " ") })));
    ajustarDestinos();
  }
  function ajustarDestinos() {
    const regla = (tipoElegido()?.conexiones ?? []).find((c) => c.relacion === relacion.value);
    const candidatos = regla ? datos.nodos.filter((x) => regla.hacia.includes(x.tipos.clave)) : [];
    destino.replaceChildren(...candidatos.map((x) => el("option", { value: x.id, textContent: `${x.titulo} (${x.tipos.nombre})` })));
    destino.disabled = !candidatos.length;
  }
  const bloqueConexion = el("div", {}, ...campo("Conectar a", relacion), destino);
  destino.style.marginTop = "6px";
  tipo.onchange = ajustarCampos;
  relacion.onchange = ajustarDestinos;

  const guardar = el("button", { className: "principal", textContent: editando ? "Guardar" : "Crear", type: "submit" });
  const cancelar = el("button", { textContent: "Cancelar", type: "button" });
  cancelar.onclick = () => (editando ? enfocar(n.id) : desenfocar());

  const form = el("form", { className: "nodo" },
    el("h2", { textContent: editando ? "Editar nodo" : "Nuevo nodo" }),
    ...campo("Tipo", tipo), ...campo("Título", titulo), bloquePropiedades,
    ...campo("Contenido", contenido),
    ...(editando ? [] : [bloqueConexion]),
    el("div", { className: "acciones" }, guardar, cancelar));

  form.onsubmit = async (e) => {
    e.preventDefault();
    // Cada propiedad va a su columna o a props. Se parte de las props que ya tenía, para no perder ninguna.
    const cambios = { titulo: titulo.value.trim(), contenido: contenido.value.trim() || null };
    const props = { ...(n?.props ?? {}) };
    for (const { p, c } of campos) {
      const v = leer(p, c);
      if (EN_COLUMNA.includes(p.clave)) cambios[p.clave] = v;
      else if (v === null) delete props[p.clave];
      else props[p.clave] = v;
    }
    cambios.props = props;
    let id = n?.id;
    if (editando) {
      const { error } = await db.from("nodos").update(cambios).eq("id", id);
      if (error) return avisar(error.message);
    } else {
      const { data, error } = await db.from("nodos").insert({ ...cambios, tipo_id: tipoElegido().id }).select("id").single();
      if (error) return avisar(error.message);
      id = data.id;
      if (relacion.value && destino.value) {
        const r = await db.from("conexiones").insert({ origen_id: id, relacion: relacion.value, destino_id: destino.value });
        if (r.error) avisar("El nodo se creó, pero la conexión falló: " + r.error.message);
      }
    }
    await recargar(id);
  };

  abrir(form);
  ajustarCampos();
  titulo.focus();
}
