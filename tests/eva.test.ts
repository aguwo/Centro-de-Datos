// Pasos 56 y 115: qué hace la copia de EV@ con cada entrega o cuestionario, y con el material.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, material, type Pendiente } from "../supabase/functions/eva/plan.ts";

const AHORA = "2026-11-04T23:00:00.000Z";
const ramos = [{ id: "arq", owner_id: "yo", eva: 91904 }];
const entrega = (id: number, vence: string | null, hecha = false): Pendiente =>
  ({ clave: `assign:${id}`, curso: 91904, titulo: `Entregar LABORATORIO ${id}`, vence, hecha, enlace: `https://ev/${id}` });

test("una entrega que viene se vuelve tarea del ramo; las viejas y las sin fecha no", () => {
  const p = plan([entrega(3, "2026-11-05T02:59:00.000Z"), entrega(2, "2026-10-05T02:59:00.000Z", true), entrega(9, null)], ramos, [], AHORA);
  assert.deepEqual(p.crear, [{ owner_id: "yo", ramo_id: "arq", titulo: "Entregar LABORATORIO 3", fecha: "2026-11-05T02:59:00.000Z",
    estado: "Por hacer", contenido: "En EV@: https://ev/3", props: { eva: "assign:3" } }]);
  assert.deepEqual(p.cambiar, []);
});

test("una tarea que ya existe: se mueve si cambió la fecha y pasa a Hecho al entregarla, nunca vuelve atrás", () => {
  const tareas = [
    { id: "t3", fecha: "2026-11-05T02:59:00+00:00", estado: "Por hacer", eva: "assign:3" },
    { id: "t4", fecha: "2026-11-12T02:59:00+00:00", estado: "Hecho", eva: "assign:4" },   // la marcaste a mano
  ];
  const p = plan([entrega(3, "2026-11-05T02:59:00.000Z", true), entrega(4, "2026-11-19T02:59:00.000Z")], ramos, tareas, AHORA);
  assert.deepEqual(p.crear, []);
  assert.deepEqual(p.cambiar, [{ id: "t3", estado: "Hecho" }, { id: "t4", fecha: "2026-11-19T02:59:00.000Z" }]);
  assert.deepEqual(plan([entrega(3, "2026-11-05T02:59:00.000Z", true)], ramos, [{ ...tareas[0], estado: "Hecho" }], AHORA).cambiar, []);
});

test("un cuestionario con la misma id que una entrega es otra tarea (la clave dice qué es)", () => {
  const quiz: Pendiente = { clave: "quiz:3", curso: 91904, titulo: "Responder Test 3", vence: "2026-11-06T02:59:00.000Z", hecha: true, enlace: "https://ev/q3" };
  const p = plan([quiz], ramos, [{ id: "t3", fecha: "2026-11-05T02:59:00+00:00", estado: "Por hacer", eva: "assign:3" }], AHORA);
  assert.deepEqual(p.crear.map((t) => [t.titulo, t.estado, t.props.eva]), [["Responder Test 3", "Hecho", "quiz:3"]]);
});

test("el material: solo lo que ves, solo archivos, carpetas, enlaces y páginas, sin secciones vacías", () => {
  const m = (id: number, modname: string, uservisible = true) => ({ id, modname, name: ` Cosa ${id} `, uservisible, url: `https://ev/mod/${modname}/view.php?id=${id}` });
  const secciones = [
    { name: "General", visible: 1, uservisible: true, modules: [m(1, "forum"), m(2, "resource"), m(3, "url", false)] },
    { name: "Evaluaciones", visible: 1, uservisible: true, modules: [m(4, "quiz"), m(5, "assign")] },
    { name: "Escondida", visible: 0, uservisible: false, modules: [m(6, "resource")] },
    { name: "Capítulo 1", visible: 1, uservisible: true, modules: [m(7, "folder"), m(8, "label"), m(9, "page")] },
  ];
  assert.deepEqual(material(secciones), [
    { seccion: "General", cosas: [{ nombre: "Cosa 2", tipo: "resource", enlace: "https://ev/mod/resource/view.php?id=2" }] },
    { seccion: "Capítulo 1", cosas: [{ nombre: "Cosa 7", tipo: "folder", enlace: "https://ev/mod/folder/view.php?id=7" },
      { nombre: "Cosa 9", tipo: "page", enlace: "https://ev/mod/page/view.php?id=9" }] },
  ]);
});
