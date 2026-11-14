// Pruebas del servidor MCP con un repositorio falso en memoria.
// Ejecutar: node --test tests/servidor.test.ts   (Node 22.18 o superior)
import { test } from "node:test";
import assert from "node:assert/strict";
import { atenderPost, dibujarArbol, resumirRegistros, revisarProps, type Nodo, type Registro, type Repositorio } from "../supabase/functions/mcp/servidor.ts";

function repoFalso(): Repositorio & { nodos: Nodo[]; conexiones: string[]; anotados: Registro[] } {
  const nodos: Nodo[] = [];
  const conexiones: string[] = [];
  const anotados: Registro[] = [];
  return {
    nodos,
    conexiones,
    anotados,
    async anotarRegistro(r) {
      anotados.push(r);
      return { ...r, id: "r1" };
    },
    async registros({ clase }) {
      return anotados.filter((r) => !clase || r.clase === clase);
    },
    async editarRegistro(id, cambios) {
      return { id, clase: "gasto", ...cambios };
    },
    async borrarRegistro() {
      return true;
    },
    async borrarNodo(id) {
      const i = nodos.findIndex((n) => n.id === id && n.archivado);
      if (i < 0) return false;
      nodos.splice(i, 1);
      return true;
    },
    async desconectar(o, r, d) {
      const antes = conexiones.length;
      conexiones.splice(0, conexiones.length, ...conexiones.filter((c) => !c.startsWith(`${o}-${r}->${d ?? ""}`)));
      return antes - conexiones.length;
    },
    async guardarTipo(t) {
      return t;
    },
    async listarTipos() {
      return [{
        clave: "tarea", nombre: "Tarea", modulo: "Productividad", conexiones: [],
        propiedades: [
          { clave: "estado", nombre: "Estado", tipo: "estado" },
          { clave: "repeticion", nombre: "Repetición", tipo: "seleccion", opciones: ["Ninguna", "Semanal"] },
          { clave: "minutos", nombre: "Minutos", tipo: "numero" },
        ],
      }];
    },
    async tipoDeNodo(id) {
      return nodos.find((n) => n.id === id)?.tipo ?? null;
    },
    async arbol() {
      return [];
    },
    async buscarNodos({ texto, tipo }) {
      return nodos.filter((n) => (!texto || n.titulo.includes(texto)) && (!tipo || n.tipo === tipo));
    },
    async verNodo(id) {
      const nodo = nodos.find((n) => n.id === id);
      return nodo ? { nodo, vecinos: [] } : null;
    },
    async crearNodo(n) {
      const nodo = { ...n, id: `n${nodos.length + 1}` };
      nodos.push(nodo);
      return nodo;
    },
    async actualizarNodo(id, cambios) {
      const nodo = nodos.find((n) => n.id === id)!;
      Object.assign(nodo, cambios);
      return nodo;
    },
    async conectar(o, r, d) {
      conexiones.push(`${o}-${r}->${d}`);
    },
    async conFechaHasta() {
      return nodos;
    },
  };
}

async function llamar(repo: Repositorio, cuerpo: unknown) {
  const res = await atenderPost(
    new Request("http://x/mcp", { method: "POST", body: JSON.stringify(cuerpo) }),
    repo,
  );
  return { status: res.status, json: res.status === 202 ? null : await res.json() };
}

test("initialize acepta la versión pedida y anuncia herramientas", async () => {
  const { json } = await llamar(repoFalso(), {
    jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" },
  });
  assert.equal(json.result.protocolVersion, "2025-06-18");
  assert.ok(json.result.capabilities.tools);
});

test("las notificaciones responden 202 sin cuerpo", async () => {
  const { status } = await llamar(repoFalso(), { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(status, 202);
});

test("tools/list incluye las 17 herramientas", async () => {
  const { json } = await llamar(repoFalso(), { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.deepEqual(
    json.result.tools.map((t: any) => t.name).sort(),
    ["actualizar_nodo", "agenda_de_hoy", "anotar_registro", "borrar_nodo", "borrar_registro", "buscar_nodos", "cierre_del_dia",
     "conectar_nodos", "consultar_registros", "crear_nodo", "desconectar_nodos", "editar_registro", "guardar_tipo",
     "listar_tipos", "mover_nodos", "ver_arbol", "ver_nodo"],
  );
});

test("crear_nodo crea y conecta", async () => {
  const repo = repoFalso();
  const { json } = await llamar(repo, {
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "crear_nodo", arguments: { tipo: "tarea", titulo: "Probar MCP", conectar_a: [{ relacion: "pertenece_a", destino_id: "p1" }] } },
  });
  assert.equal(json.result.isError, undefined);
  assert.equal(repo.nodos[0].titulo, "Probar MCP");
  assert.deepEqual(repo.conexiones, ["n1-pertenece_a->p1"]);
});

test("un error de herramienta vuelve como isError, no como error de protocolo", async () => {
  const { json } = await llamar(repoFalso(), {
    jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "ver_nodo", arguments: { id: "nada" } },
  });
  assert.equal(json.result.isError, true);
  assert.match(json.result.content[0].text, /No existe/);
});

test("método y herramienta desconocidos dan error JSON-RPC", async () => {
  const a = await llamar(repoFalso(), { jsonrpc: "2.0", id: 5, method: "otra/cosa" });
  assert.equal(a.json.error.code, -32601);
  const b = await llamar(repoFalso(), { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "x" } });
  assert.equal(b.json.error.code, -32602);
});

test("JSON inválido da 400", async () => {
  const res = await atenderPost(new Request("http://x/mcp", { method: "POST", body: "{" }), repoFalso());
  assert.equal(res.status, 400);
});

test("dibujarArbol agrupa por módulo, ordena, sangra y salta lo Hecho", () => {
  const fila = (id: string, titulo: string, tipo: string, modulo: string, orden: number, padre_id: string | null, estado?: string) =>
    ({ id, titulo, tipo, modulo, orden, padre_id, estado });
  const filas = [
    fila("t2", "Tarea hecha", "tarea", "Productividad", 14, "p1", "Hecho"),
    fila("a1", "Universidad", "area", "General", 1, null),
    fila("x1", "Arroz", "alimento", "Dieta", 41, null),
    fila("p1", "Proyecto BD", "proyecto", "Productividad", 13, "a1", "En curso"),
    fila("t1", "Diseñar MER", "tarea", "Productividad", 14, "p1", "Por hacer"),
  ];
  assert.deepEqual(dibujarArbol(filas), [
    "# General",
    "Universidad [area] a1",
    "  Proyecto BD [proyecto, En curso] p1",
    "    Diseñar MER [tarea, Por hacer] t1",
    "# Dieta",
    "Arroz [alimento] x1",
  ]);
  assert.equal(dibujarArbol(filas, true).length, 7);
  // Si el padre no vino (ej. se pidió "desde" un nodo), ese nodo es la raíz.
  assert.deepEqual(dibujarArbol(filas.filter((f) => f.id !== "a1")).slice(0, 2), ["# Productividad", "Proyecto BD [proyecto, En curso] p1"]);
});

test("anotar_registro guarda y rechaza clases inventadas", async () => {
  const repo = repoFalso();
  const llamada = (args: unknown) => llamar(repo, { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "anotar_registro", arguments: args } });
  const ok = await llamada({ clase: "gasto", nodo_id: "debito", otro_id: "comida", valor: 5000, unidad: "CLP" });
  assert.equal(ok.json.result.isError, undefined);
  assert.equal(repo.anotados[0].valor, 5000);
  const mal = await llamada({ clase: "propina", valor: 1 });
  assert.equal(mal.json.result.isError, true);
});

test("resumirRegistros cuenta, suma y agrupa", () => {
  const filas = [
    { clase: "gasto", fecha: "2026-10-01T12:00:00Z", valor: 5000, otro: "Comida" },
    { clase: "gasto", fecha: "2026-10-02T12:00:00Z", valor: 3000, otro: "Comida" },
    { clase: "gasto", fecha: "2026-11-01T12:00:00Z", valor: 9000, otro: "Transporte" },
  ];
  const r = resumirRegistros(filas, "otro");
  assert.equal(r.cantidad, 3);
  assert.equal(r.suma, 17000);
  assert.deepEqual(r.grupos, [
    { grupo: "Transporte", cantidad: 1, suma: 9000 },
    { grupo: "Comida", cantidad: 2, suma: 8000 },
  ]);
  assert.equal(r.ultimos[0].fecha, "2026-11-01T12:00:00Z");
  assert.deepEqual(resumirRegistros(filas, "mes").grupos?.map((g) => g.grupo), ["2026-10", "2026-11"]);
});

test("borrar_nodo solo borra lo archivado", async () => {
  const repo = repoFalso();
  repo.nodos.push({ id: "a", tipo: "tarea", titulo: "Activa" }, { id: "b", tipo: "tarea", titulo: "Vieja", archivado: true });
  const borrar = (id: string) => llamar(repo, { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "borrar_nodo", arguments: { id } } });
  assert.equal((await borrar("a")).json.result.isError, true);
  assert.equal((await borrar("b")).json.result.isError, undefined);
  assert.deepEqual(repo.nodos.map((n) => n.id), ["a"]);
});

test("mover_nodos quita la caja anterior y pone la nueva", async () => {
  const repo = repoFalso();
  repo.conexiones.push("t1-pertenece_a->viejo", "t2-pertenece_a->viejo", "t1-trata_sobre->ramo");
  const { json } = await llamar(repo, {
    jsonrpc: "2.0", id: 11, method: "tools/call",
    params: { name: "mover_nodos", arguments: { ids: ["t1", "t2"], destino_id: "nuevo" } },
  });
  assert.equal(json.result.structuredContent.resultado.movidos, 2);
  assert.deepEqual(repo.conexiones.sort(), ["t1-pertenece_a->nuevo", "t1-trata_sobre->ramo", "t2-pertenece_a->nuevo"]);
});

test("revisarProps acepta lo del tipo y explica lo que no calza", () => {
  const tipo = {
    clave: "tarea",
    propiedades: [
      { clave: "estado", nombre: "Estado", tipo: "estado" },
      { clave: "repeticion", nombre: "Repetición", tipo: "seleccion", opciones: ["Ninguna", "Semanal"] },
      { clave: "minutos", nombre: "Minutos", tipo: "numero" },
    ],
  };
  assert.deepEqual(revisarProps(tipo, { repeticion: "Semanal", minutos: 30, notion_id: "x", postit: { x: 1, y: 2 }, vieja: null }), []);
  const mal = revisarProps(tipo, { Prioridad: "Alta", repeticion: "A veces", minutos: "30", estado: "Hecho" });
  assert.equal(mal.length, 5); // 4 problemas + la lista de propiedades correctas
  assert.match(mal[0], /'Prioridad' no es una propiedad/);
  assert.match(mal[1], /una de: Ninguna, Semanal/);
  assert.match(mal.at(-1)!, /repeticion \(seleccion: Ninguna\/Semanal\)/);
});

test("crear_nodo rechaza props que no son del tipo", async () => {
  const repo = repoFalso();
  const { json } = await llamar(repo, {
    jsonrpc: "2.0", id: 12, method: "tools/call",
    params: { name: "crear_nodo", arguments: { tipo: "tarea", titulo: "X", props: { prioridad: "Alta" } } },
  });
  assert.equal(json.result.isError, true);
  assert.equal(repo.nodos.length, 0);
});

// ---------- Paso 47: agenda con clases que se repiten y cierre del día ----------
const RAMO = { id: "bd", titulo: "Base de Datos", tipo: "ramo" };
function semanaDePrueba() {
  const repo = repoFalso();
  repo.nodos.push(
    // Clase los miércoles 08:10 (11:10 UTC) desde agosto, dentro del ramo.
    { id: "c", tipo: "evento", titulo: "Clase BD", fecha: "2026-08-05T11:10:00+00:00", props: { repite: "Cada semana" }, caja: RAMO },
    { id: "e1", tipo: "evento", titulo: "Certamen 1", fecha: "2026-10-28T11:10:00+00:00", props: {}, caja: RAMO }, // pasó, sin nota
    { id: "e2", tipo: "evento", titulo: "Certamen 2", fecha: "2026-11-06T11:10:00+00:00", props: {}, caja: RAMO }, // viene
    { id: "e3", tipo: "evento", titulo: "Test viejo", fecha: "2026-09-01T11:10:00+00:00", props: { nota: 6 }, caja: RAMO },
    { id: "cumple", tipo: "evento", titulo: "Cumpleaños", fecha: "2026-10-01T00:00:00+00:00", props: {} }, // pasó y no se repite
    { id: "t1", tipo: "tarea", titulo: "Atrasada", estado: "Por hacer", fecha: "2026-11-02T00:00:00+00:00" },
    { id: "t2", tipo: "tarea", titulo: "Hoy en la noche", estado: "Por hacer", fecha: "2026-11-05T01:30:00+00:00" }, // 22:30 del 4 en Chile
    { id: "t3", tipo: "tarea", titulo: "Mañana", estado: "Por hacer", fecha: "2026-11-05T00:00:00+00:00" },
  );
  return repo;
}
const herramienta = async (repo: Repositorio, name: string, args: unknown) =>
  (await llamar(repo, { jsonrpc: "2.0", id: 47, method: "tools/call", params: { name, arguments: args } })).json.result.structuredContent.resultado;

test("agenda_de_hoy pone las clases que se repiten y deja fuera los eventos que ya pasaron", async () => {
  const r = await herramienta(semanaDePrueba(), "agenda_de_hoy", { fecha: "2026-11-04", dias: 3 });
  assert.deepEqual(r.atrasadas.map((n: Nodo) => n.id), ["t1"]);
  assert.deepEqual(r.dias.map((d: any) => [d.dia, d.eventos.map((n: Nodo) => n.id), d.tareas.map((n: Nodo) => n.id)]), [
    ["2026-11-04", ["c"], ["t2"]], // miércoles: la clase, y la tarea de las 22:30 cuenta en Chile, no en UTC
    ["2026-11-05", [], ["t3"]],
    ["2026-11-06", ["e2"], []],
  ]);
});

test("cierre_del_dia junta clases con su asistencia, notas pendientes y mañana", async () => {
  const repo = semanaDePrueba();
  let r = await herramienta(repo, "cierre_del_dia", { fecha: "2026-11-04" });
  assert.deepEqual(r.clases, [{ clase: "Clase BD", ramo: "Base de Datos", ramo_id: "bd", fecha: "2026-08-05T11:10:00+00:00", asistencia: null }]);
  assert.deepEqual(r.tareas_de_hoy.map((n: Nodo) => n.id), ["t2"]);
  assert.deepEqual(r.evaluaciones_sin_nota.map((n: Nodo) => n.id), ["e1"]);
  assert.deepEqual(r.manana.tareas.map((n: Nodo) => n.id), ["t3"]);
  assert.deepEqual(r.proximas_evaluaciones.map((n: Nodo) => n.id), ["e2"]);
  assert.ok(r.pasos.length > 3);

  await herramienta(repo, "anotar_registro", { clase: "asistencia", nodo_id: "bd", valor: 1, fecha: "2026-11-04" });
  r = await herramienta(repo, "cierre_del_dia", { fecha: "2026-11-04" });
  assert.equal(r.clases[0].asistencia, 1);
});
