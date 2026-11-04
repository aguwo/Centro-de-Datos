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
