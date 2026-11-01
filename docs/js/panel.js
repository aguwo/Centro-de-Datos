// El panel lateral: los datos de un nodo con sus conexiones, y el formulario para crear o editar.
// Lee de los datos cargados (no del mapa), así funciona igual desde el Inicio.
import { db, $, el, avisar, datos, colorDe, recargar } from "./base.js";
import { enfocar, desenfocar, ajustarMapa } from "./mapa.js";

const ESTADOS = ["Inbox", "Por hacer", "En curso", "Esperando", "Hecho"]; // los mismos del paso 3

function abrir(...contenido) {
  $("panel").replaceChildren(...contenido);
  $("panel").classList.remove("oculto");
  ajustarMapa(); // el mapa se achica para dejarle espacio al panel
}

export function cerrarPanel() {
  $("panel").classList.add("oculto");
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
  fila("Estado", n.estado);
  // La fecha se muestra tal como está guardada (sin convertir de zona horaria, que la correría un día).
  fila("Fecha", n.fecha && n.fecha.slice(0, 10).split("-").reverse().join("-"));
  for (const [k, v] of Object.entries(n.props ?? {})) fila(k, typeof v === "object" ? JSON.stringify(v) : v);

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
    recargar();
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
  const estado = el("select");
  estado.append(el("option", { value: "", textContent: "—" }), ...ESTADOS.map((e) => el("option", { value: e, textContent: e })));
  estado.value = n?.estado ?? (editando ? "" : "Inbox");
  const fecha = el("input", { type: "date", value: n?.fecha ? n.fecha.slice(0, 10) : "" });
  const contenido = el("textarea", { value: n?.contenido ?? "", placeholder: "Notas, detalles…" });

  // Primera conexión (solo al crear): relación + nodo de destino, según lo que permite el tipo.
  const relacion = el("select");
  const destino = el("select");
  const tipoElegido = () => datos.tipo.get(tipo.value);
  function ajustarCampos() {
    const t = tipoElegido();
    const usa = (...clases) => (t?.propiedades ?? []).some((p) => clases.includes(p.tipo));
    bloqueEstado.classList.toggle("oculto", !usa("estado"));
    bloqueFecha.classList.toggle("oculto", !usa("fecha", "fecha_hora"));
    relacion.replaceChildren(el("option", { value: "", textContent: "(sin conexión)" }),
      ...(t?.conexiones ?? []).map((c) => el("option", { value: c.relacion, textContent: c.relacion.replaceAll("_", " ") })));
    ajustarDestinos();
  }
  function ajustarDestinos() {
    const regla = (tipoElegido()?.conexiones ?? []).find((c) => c.relacion === relacion.value);
    const candidatos = regla ? datos.nodos.filter((x) => regla.hacia.includes(x.tipos.clave)) : [];
    destino.replaceChildren(...candidatos.map((x) => el("option", { value: x.id, textContent: `${x.titulo} (${x.tipos.nombre})` })));
    destino.disabled = !candidatos.length;
  }
  const bloqueEstado = el("div", {}, ...campo("Estado", estado));
  const bloqueFecha = el("div", {}, ...campo("Fecha", fecha));
  const bloqueConexion = el("div", {}, ...campo("Conectar a", relacion), destino);
  destino.style.marginTop = "6px";
  tipo.onchange = ajustarCampos;
  relacion.onchange = ajustarDestinos;

  const guardar = el("button", { className: "principal", textContent: editando ? "Guardar" : "Crear", type: "submit" });
  const cancelar = el("button", { textContent: "Cancelar", type: "button" });
  cancelar.onclick = () => (editando ? enfocar(n.id) : desenfocar());

  const form = el("form", { className: "nodo" },
    el("h2", { textContent: editando ? "Editar nodo" : "Nuevo nodo" }),
    ...campo("Tipo", tipo), ...campo("Título", titulo), bloqueEstado, bloqueFecha,
    ...campo("Contenido", contenido),
    ...(editando ? [] : [bloqueConexion]),
    el("div", { className: "acciones" }, guardar, cancelar));

  form.onsubmit = async (e) => {
    e.preventDefault();
    const cambios = {
      titulo: titulo.value.trim(),
      contenido: contenido.value.trim() || null,
      estado: bloqueEstado.classList.contains("oculto") ? null : (estado.value || null),
      fecha: bloqueFecha.classList.contains("oculto") || !fecha.value ? null : fecha.value,
    };
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
