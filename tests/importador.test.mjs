// Prueba las reglas de traducción con un Notion inventado y chico.
import { test } from "node:test";
import assert from "node:assert/strict";
import { traducir } from "../importador-notion/traducir.mjs";

const url = (n) => `https://app.notion.com/p/${String(n).padStart(32, "0")}`;
const notion = {
  areas: [{ url: url(1), Nombre: "<p>\nbotánica \n</p>", Tipo: "Personal" }],
  objetivos: [],
  proyectos: [{ url: url(2), Nombre: "Nuevo proyecto", Estado: "Inbox" }],
  tareas: [
    { url: url(3), Nombre: "Regar", Estado: "Completada", "Área": `["${url(1)}"]` },
    { url: url(4), Nombre: "Correr", Tipo: "Repetitiva", Estado: "Repetitiva", "date:Fecha:start": "2026-11-05T11:00:00.000Z" },
    { url: url(5), Nombre: "Correr", Tipo: "Repetitiva", Estado: "Repetitiva", "date:Fecha:start": "2026-11-03T11:00:00.000Z", "Área": `["${url(1)}","${url(99)}"]` },
  ],
  eventos: [], topicos: [{ url: url(6), Nombre: "Plantas" }],
  bloques: [{ url: url(7), Nombre: "plantas" }],
  notas: [{ url: url(8), Nombre: "Riego", "Bloques de notas": `["${url(7)}"]` }],
};
const r = traducir(notion, new Date("2026-11-01"));
const por = (t) => r.nodos.find((n) => n.titulo === t);

test("limpia títulos y traduce estados", () => {
  assert.equal(r.nodos[0].titulo, "botánica");
  assert.equal(por("Regar").estado, "Hecho");
});

test("descarta los 'Nuevo proyecto' vacíos", () => {
  assert.equal(por("Nuevo proyecto"), undefined);
});

test("junta las copias de una tarea repetitiva en una sola", () => {
  const correr = r.nodos.filter((n) => n.titulo === "Correr");
  assert.equal(correr.length, 1);
  assert.equal(correr[0].props.repeticion, "Semanal");
  assert.equal(correr[0].fecha, "2026-11-03T11:00:00.000Z"); // la próxima vez
});

test("un bloque de notas se vuelve el tópico del mismo nombre", () => {
  assert.equal(r.nodos.filter((n) => n.tipo === "topico").length, 1);
  assert.ok(r.conexiones.some((c) => c.origen === por("Riego").notion_id && c.relacion === "trata_sobre" && c.destino === por("Plantas").notion_id));
});

test("descarta conexiones a páginas que no vinieron", () => {
  assert.ok(!r.conexiones.some((c) => c.destino.endsWith("99")));
  assert.equal(r.descartadas, 1);
});
