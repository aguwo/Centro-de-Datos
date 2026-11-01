// Pruebas del servidor MCP con un repositorio falso en memoria.
// Ejecutar: node --test tests/servidor.test.ts   (Node 22.18 o superior)
import { test } from "node:test";
import assert from "node:assert/strict";
import { atenderPost, dibujarArbol, type Nodo, type Repositorio } from "../supabase/functions/mcp/servidor.ts";

function repoFalso(): Repositorio & { nodos: Nodo[]; conexiones: string[] } {
  const nodos: Nodo[] = [];
  const conexiones: string[] = [];
  return {
    nodos,
    conexiones,
    async listarTipos() {
      return [{ clave: "tarea", nombre: "Tarea", modulo: "Productividad", propiedades: [], conexiones: [] }];
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
    async agendaDelDia() {
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

test("tools/list incluye las 8 herramientas", async () => {
  const { json } = await llamar(repoFalso(), { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.deepEqual(
    json.result.tools.map((t: any) => t.name).sort(),
    ["actualizar_nodo", "agenda_de_hoy", "buscar_nodos", "conectar_nodos", "crear_nodo", "listar_tipos", "ver_arbol", "ver_nodo"],
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
