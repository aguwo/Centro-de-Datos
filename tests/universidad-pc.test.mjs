// Paso 49: leer la página de notas de intranet7 (con una muestra inventada de la misma forma).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerNotas } from "../universidad-pc/notas.mjs";

const html = readFileSync(new URL("./muestras/notas-intranet7.html", import.meta.url), "utf8");
const [arq, bd] = leerNotas(html);

test("un ramo por bloque, con su código, sección y profesor", () => {
  assert.equal(leerNotas(html).length, 2);
  assert.deepEqual({ ...arq, evaluaciones: undefined, asistencia: undefined },
    { id_curso: "573416", nombre: "ARQUITECTURA DE COMPUTADORES", codigo: "IN1074C", seccion: 1,
      profesor: "PAREDES GRANDÓN, LORENZO STEPHANO", evaluaciones: undefined, asistencia: undefined });
  assert.equal(bd.seccion, 2);
});

test("las notas: número con punto, «-» es sin nota", () => {
  assert.deepEqual(arq.evaluaciones, [{ nombre: "Certamen 1", nota: 5.8 }, { nombre: "Certamen 2", nota: null }]);
});

test("la asistencia: porcentaje y cada clase con su día y hora", () => {
  assert.deepEqual(arq.asistencia, {
    porcentaje: 52.38,
    clases: [
      { fecha: "2026-08-06T10:10", descripcion: "Clase 1", fui: true },
      { fecha: "2026-08-11T10:10", descripcion: "Ayudantia 1: Sistemas numericos y compuertas logicas", fui: false },
    ],
  });
  assert.deepEqual(bd.asistencia, { porcentaje: null, clases: [] }); // «Curso no registra asistencia»
});

// Paso 50: qué se sube al centro de datos.
import { plan, clave, instante } from "../universidad-pc/subir.mjs";

test("el portal y el centro de datos escriben distinto lo mismo", () => {
  assert.equal(clave("BASES DE DATOS"), clave("Base de Datos"));
  assert.equal(clave("Certamen 1 — Base de Datos"), clave("Certamen 1"));
  assert.equal(clave("test de entrada 1"), clave("Test Entrada 1"));
  assert.notEqual(clave("Certamen 1"), clave("Certamen 2"));
});

test("una hora de Chile pasa a UTC con su horario (invierno -4, verano -3)", () => {
  assert.equal(instante("2026-08-06T10:10"), "2026-08-06T14:10:00.000Z");
  assert.equal(instante("2026-11-05T10:10"), "2026-11-05T13:10:00.000Z");
});

test("plan: solo lo que cambió, sin duplicar, y avisa lo que no tiene pareja", () => {
  const base = {
    ramos: [{ id: "arq", titulo: "Arquitectura de Computadores", props: { semestre: "2026-2" } }],
    eventos: [
      { id: "c1", titulo: "Certamen 1", padre_id: "arq", props: { peso: 21, nota: 5.8, portal: "Certamen 1" } },  // ya subida
      { id: "c2", titulo: "Certamen 2", padre_id: "arq", props: { peso: 21 } },
      { id: "cl", titulo: "Certamen 2", padre_id: "otro", props: {} },                      // de otro ramo
    ],
    asistencias: [{ id: "a1", nodo_id: "arq", fecha: "2026-08-06T20:00:00Z", valor: 1, props: {} }], // anotada a mano ese día
  };
  const portal = [...leerNotas(html), { nombre: "RAMO NUEVO", evaluaciones: [], asistencia: { clases: [] } }];
  portal[0].evaluaciones.push({ nombre: "Certamen 2", nota: 6 }, { nombre: "Tareas 1", nota: 7 });

  portal[0].asistencia.clases.push({ fecha: "2026-11-05T10:10", descripcion: "Clase 39", fui: false }); // todavía no pasa
  const p = plan(portal, base, "2026-11-04");
  assert.deepEqual(p.notas, [{ id: "c2", titulo: "Certamen 2", props: { peso: 21, nota: 6, portal: "Certamen 2" } }]);
  // Una nota que ya estaba bien pero escrita a mano se marca como del portal (y desde ahí no se edita).
  const aMano = plan(portal, { ...base, eventos: [{ ...base.eventos[0], props: { peso: 21, nota: 5.8 } }] }, "2026-11-04");
  assert.deepEqual(aMano.notas, [{ id: "c1", titulo: "Certamen 1", props: { peso: 21, nota: 5.8, portal: "Certamen 1" } }]);
  assert.deepEqual(p.cambios, [{ id: "a1", fecha: "2026-08-06T14:10:00.000Z", valor: 1, props: { portal: "Clase 1" } }]);
  assert.deepEqual(p.nuevas, [{ clase: "asistencia", nodo_id: "arq", fecha: "2026-08-11T14:10:00.000Z", valor: 0,
    props: { portal: "Ayudantia 1: Sistemas numericos y compuertas logicas" } }]);
  assert.deepEqual(p.sinEvaluacion, [{ ramo: "Arquitectura de Computadores", nombre: "Tareas 1", nota: 7 }]);
  assert.deepEqual(p.sinRamo, ["BASES DE DATOS", "RAMO NUEVO"]);

  // La segunda vez, con lo ya subido, no hay nada que hacer.
  const despues = { ...base, eventos: base.eventos.map((e) => (e.id === "c2" ? { ...e, props: p.notas[0].props } : e)),
    asistencias: [{ ...base.asistencias[0], ...p.cambios[0] }, { id: "a2", ...p.nuevas[0] }] };
  const otra = plan(portal, despues, "2026-11-04");
  assert.deepEqual([otra.notas, otra.nuevas, otra.cambios, otra.borrar], [[], [], [], []]);

  // Una clase que se subió antes y el portal ya no lista (o todavía no pasa) se borra; una anotada a mano, no.
  const viejas = [...despues.asistencias, { id: "a3", nodo_id: "arq", fecha: "2026-11-05T13:10:00Z", valor: 0, props: { portal: "Clase 39" } },
    { id: "a4", nodo_id: "arq", fecha: "2026-11-05T13:10:00Z", valor: 1, props: {} }];
  assert.deepEqual(plan(portal, { ...despues, asistencias: viejas }, "2026-11-04").borrar, ["a3"]);
});
