// El panel lateral: el formulario para crear o editar (ver un nodo es su ficha, ficha.js), y las propiedades de los tipos.
// Lee de los datos cargados (no del mapa), así funciona igual desde el Inicio.
import { db, $, el, avisar, datos, colorDe, recargar, dia, hora, fijas, FIJA } from "./base.js";
import { enfocar, desenfocar, ajustarMapa } from "./mapa.js";
import { crear, conectar, dentroDeCaja, cambiar, cambiarProps } from "./acciones.js";
import { abrirFicha, refrescarFicha } from "./ficha.js";

const ESTADOS = ["Inbox", "Por hacer", "En curso", "Esperando", "Hecho"]; // los mismos del paso 3

// ---------- Propiedades (paso 23) ----------
// Cada tipo dice qué propiedades tiene. "estado" y "fecha" viven en su columna del nodo; el resto, en props.
const EN_COLUMNA = ["estado", "fecha"];
// Las del tipo, menos las marcadas "oculta" (las maneja otra parte, como "excepto" el calendario).
const todasDe = (clave) => datos.tipo.get(clave)?.propiedades ?? [];
const propiedadesDe = (clave) => todasDe(clave).filter((p) => !p.oculta);
const valorDe = (n, p) => (EN_COLUMNA.includes(p.clave) ? n[p.clave] : n.props?.[p.clave]);

// Cómo se lee un valor: fechas como 22-10-2026 (con hora si tiene), Sí/No, números y textos tal cual.
function legible(p, v) {
  if (v === null || v === undefined || v === "") return null;
  if (p.tipo === "fecha" || p.tipo === "fecha_hora") return [dia(v)?.split("-").reverse().join("-"), hora(v)].filter(Boolean).join(" ");
  if (p.tipo === "booleano") return v ? "Sí" : "No";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

// Los datos de un nodo que tienen valor, ya legibles: [{ nombre: "Prioridad", valor: "Alta" }, ...]
export const camposDe = (n) => propiedadesDe(n.tipos.clave)
  .map((p) => ({ clave: p.clave, nombre: p.nombre, tipo: p.tipo, valor: legible(p, valorDe(n, p)) })).filter((x) => x.valor !== null);
// ¿Su tipo tiene esta propiedad? (ej. "estado": se puede terminar)
export const tienePropiedad = (n, clave) => todasDe(n.tipos.clave).some((p) => p.clave === clave);

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
    case "imagen": return el("input", { type: "url", value: v ?? "", placeholder: "https://… (el enlace a una foto)" });
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

function abrir(...contenido) {
  $("panel").replaceChildren(...contenido);
  $("panel").classList.remove("oculto");
  document.body.classList.add("con-panel"); // el mapa se corre para dejarle espacio al panel
  ajustarMapa();
}

export function cerrarPanel() {
  $("panel").classList.add("oculto");
  document.body.classList.remove("con-panel");
  ajustarMapa();
}

// Ver un nodo: su ficha (ficha.js, paso 104). El panel queda solo para el formulario de crear o editar.
export function mostrarPanel(id) {
  cerrarPanel();
  abrirFicha(id);
}

// Paso 103: las propiedades de uno o varios nodos, para cambiarlas ahí mismo (Archivos las muestra a la derecha).
// Con varios salen las que tienen todos; si sus valores no son iguales, la propiedad dice «varias».
// Cada cambio se guarda al tiro, en todos.
export function editorDePropiedades(nodos) {
  const [primero, ...resto] = nodos;
  const comunes = propiedadesDe(primero.tipos.clave)
    .filter((p) => resto.every((n) => propiedadesDe(n.tipos.clave).some((q) => q.clave === p.clave && q.tipo === p.tipo)));
  return el("dl", { className: "propiedades" }, ...comunes.flatMap((p) => {
    const varias = new Set(nodos.map((n) => JSON.stringify(valorDe(n, p) ?? null))).size > 1;
    const c = control(p, varias ? null : valorDe(primero, p));
    if (nodos.some((n) => fijas(n).includes(p.clave))) Object.assign(c, { disabled: true, title: FIJA });
    c.onchange = () => {
      const v = leer(p, c);
      for (const n of nodos) EN_COLUMNA.includes(p.clave) ? cambiar(n, { [p.clave]: v }) : cambiarProps(n, { [p.clave]: v });
    };
    return [el("dt", {}, p.nombre, varias ? el("small", { textContent: "varias" }) : ""), el("dd", {}, c)];
  }));
}

// Cuando cambian los datos, la ficha abierta se vuelve a dibujar. Un formulario a medio llenar no se toca.
export const refrescarPanel = refrescarFicha;

// Formulario para crear (sin nodo) o editar (con nodo). Se muestra en el mismo panel.
// Al crear: tipos = lo que se puede crear desde aquí (["tarea", "evento"]; sin lista, todos los tipos)
// y tipo = cuál viene elegido. Lo arma "+ Nuevo" (nuevo.js) según el apartado donde estás.
// Al editar con tipos, también se puede cambiar el tipo (un post-it que pasa a proyecto).
// valores = con qué empiezan algunos campos, ej. { estado: "Por hacer" } al ordenar un post-it.
// conexion = con qué conexión empieza "Conectar a", ej. { relacion: "pertenece_a", destino_id } al crear dentro de un proyecto.
// dentro = el id de una caja: "Conectar a" empieza metido en ella, con la relación que pida cada tipo (paso 101, Archivos).
const PRINCIPALES = 3; // cuántas propiedades se ven de entrada; el resto va en "Más detalles"
export function formulario(n, { tipos, tipo: elegido, valores = {}, conexion, dentro } = {}) {
  const editando = !!n;
  const campo = (etiqueta, control) => [el("label", { textContent: etiqueta }), control];
  let tipo = n?.tipos.clave ?? elegido ?? tipos?.[0] ?? "tarea";
  const tipoElegido = () => datos.tipo.get(tipo);
  const inicial = () => (dentro ? dentroDeCaja(tipo, dentro) : conexion);

  // Qué crear: con pocos tipos, botones a la vista; con todos, una lista agrupada por módulo (como la leyenda).
  let selector;
  if (editando && !tipos) selector = el("span");
  else if (tipos) {
    selector = el("div", { className: "tipos" }, ...tipos.filter((c) => datos.tipo.has(c)).map((c) => {
      const b = el("button", { type: "button", textContent: datos.tipo.get(c).nombre, onclick: () => { tipo = c; ajustarCampos(); } });
      b.dataset.clave = c;
      b.style.setProperty("--c", colorDe(c));
      return b;
    }));
  } else {
    selector = el("select", { required: true, onchange: () => { tipo = selector.value; ajustarCampos(); } });
    const grupos = new Map();
    for (const t of datos.tipos) {
      if (!grupos.has(t.modulo)) {
        grupos.set(t.modulo, el("optgroup", { label: t.modulo }));
        selector.append(grupos.get(t.modulo));
      }
      grupos.get(t.modulo).append(el("option", { value: t.clave, textContent: t.nombre }));
    }
    selector.value = tipo;
  }

  const titulo = el("input", { required: true, value: n?.titulo ?? "", placeholder: "¿Qué es?" });
  const contenido = el("textarea", { value: n?.contenido ?? "", placeholder: "Notas, detalles…" });

  // Un campo por cada propiedad del tipo elegido: las primeras a la vista, el resto en "Más detalles".
  // Al editar, también queda a la vista lo que ya tiene un valor. Al cambiar el tipo se vuelven a armar.
  const principales = el("div"), mas = el("div");
  const detalles = el("details", {}, el("summary", { textContent: "Más detalles" }), mas, ...campo("Notas", contenido));
  let campos = []; // [{ p, c }]: la propiedad y su control
  // Una conexión nueva (al crear, la primera): relación + nodo de destino, según lo que permite el tipo.
  const relacion = el("select", { onchange: () => ajustarDestinos() });
  const destino = el("select");
  function ajustarCampos() {
    for (const b of selector.querySelectorAll("button")) b.setAttribute("aria-pressed", b.dataset.clave === tipo);
    const valorInicial = (p) => (p.clave in valores ? valores[p.clave] : n ? valorDe(n, p) : p.tipo === "estado" ? "Por hacer" : null);
    campos = propiedadesDe(tipo).map((p) => ({ p, c: control(p, valorInicial(p)) }));
    for (const { p, c } of campos) if (fijas(n).includes(p.clave)) Object.assign(c, { disabled: true, title: FIJA });
    const aLaVista = (x, i) => i < PRINCIPALES || (n && legible(x.p, valorDe(n, x.p)) !== null);
    principales.replaceChildren(...campos.filter(aLaVista).flatMap(({ p, c }) => campo(p.nombre, c)));
    mas.replaceChildren(...campos.filter((x, i) => !aLaVista(x, i)).flatMap(({ p, c }) => campo(p.nombre, c)));
    detalles.open = !!n?.contenido;
    relacion.replaceChildren(el("option", { value: "", textContent: "(sin conexión)" }),
      ...(tipoElegido()?.conexiones ?? []).map((c) => el("option", { value: c.relacion, textContent: c.relacion.replaceAll("_", " ") })));
    if (inicial()) relacion.value = inicial().relacion;
    if (relacion.selectedIndex < 0) relacion.value = ""; // este tipo no permite esa conexión
    ajustarDestinos();
  }
  function ajustarDestinos() {
    const regla = (tipoElegido()?.conexiones ?? []).find((c) => c.relacion === relacion.value);
    const candidatos = regla ? datos.nodos.filter((x) => regla.hacia.includes(x.tipos.clave)).sort((a, b) => a.titulo.localeCompare(b.titulo, "es")) : [];
    destino.replaceChildren(...candidatos.map((x) => el("option", { value: x.id, textContent: `${x.titulo} (${x.tipos.nombre})` })));
    destino.hidden = !candidatos.length;
    if (inicial()?.relacion === relacion.value) destino.value = inicial().destino_id;
  }

  const guardar = el("button", { className: "principal", textContent: editando ? "Guardar" : "Crear", type: "submit" });
  const cancelar = el("button", { textContent: "Cancelar", type: "button", onclick: () => (editando ? enfocar(n.id) : desenfocar()) });

  const form = el("form", { className: "nodo" },
    el("h2", { textContent: editando ? "Editar " + n.tipos.nombre.toLowerCase() : "Nuevo" }),
    selector, ...campo("Título", titulo), principales,
    el("div", { className: "conexion" }, ...campo("Conectar a", relacion), destino),
    detalles,
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
    const conexion = relacion.value && { relacion: relacion.value, destino_id: destino.value };
    if (!editando) return crear(tipo, cambios, { conexion });
    if (tipo !== n.tipos.clave) cambios.tipo_id = tipoElegido().id;
    const { error } = await db.from("nodos").update(cambios).eq("id", n.id);
    if (error) return avisar(error.message);
    await conectar(n.id, conexion);
    await recargar(n.id);
  };

  abrir(form);
  ajustarCampos();
  titulo.focus();
}
