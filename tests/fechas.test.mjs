// Paso 32: leer fechas escritas en "Agregar tarea". Hoy es lunes 2 de noviembre de 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerFecha, esDia } from "../docs/js/fechas.js";

const HOY = "2026-11-02";
const lee = (texto) => leerFecha(texto, HOY);

test("mañana, hoy y pasado mañana", () => {
  assert.deepEqual(lee("llamar al dentista mañana"), { titulo: "llamar al dentista", dia: "2026-11-03", hora: null });
  assert.deepEqual(lee("comprar pan hoy"), { titulo: "comprar pan", dia: HOY, hora: null });
  assert.deepEqual(lee("pagar la luz pasado mañana"), { titulo: "pagar la luz", dia: "2026-11-04", hora: null });
  assert.equal(lee("estudiar para mañana").titulo, "estudiar");
});

test("días de la semana: siempre el próximo", () => {
  assert.equal(lee("entregar informe el viernes").dia, "2026-11-06");
  assert.equal(lee("reunión lunes").dia, "2026-11-09"); // hoy es lunes: el de la otra semana
  assert.equal(lee("feria el sábado").dia, "2026-11-07");
  assert.equal(lee("clase miercoles").dia, "2026-11-04"); // sin tilde también
});

test("fechas con número", () => {
  assert.equal(lee("pagar la luz 15/11").dia, "2026-11-15");
  assert.equal(lee("renovar carnet 5/1").dia, "2027-01-05"); // ya pasó este año: el próximo
  assert.equal(lee("viaje 20-12-2027").dia, "2027-12-20");
  assert.deepEqual(lee("examen 3 de diciembre"), { titulo: "examen", dia: "2026-12-03", hora: null });
  assert.equal(lee("cumple de la Cami 15 nov").dia, "2026-11-15");
});

test("horas", () => {
  assert.deepEqual(lee("dentista mañana 10:00"), { titulo: "dentista", dia: "2026-11-03", hora: 10 });
  assert.deepEqual(lee("entregar informe viernes 18h"), { titulo: "entregar informe", dia: "2026-11-06", hora: 18 });
  assert.equal(lee("certamen 3 de diciembre a las 8:30").hora, 8.5);
  assert.equal(lee("llamar a la profe a las 16").hora, 16);
  assert.equal(lee("cine 9pm").hora, 21);
  assert.deepEqual(lee("llamar a mamá 19:30"), { titulo: "llamar a mamá", dia: HOY, hora: 19.5 }); // hora sin día: hoy
});

test("sin fecha, el texto queda igual", () => {
  assert.deepEqual(lee("leer 3 capítulos del libro"), { titulo: "leer 3 capítulos del libro", dia: null, hora: null });
  assert.deepEqual(lee("hoyo en la pared"), { titulo: "hoyo en la pared", dia: null, hora: null });
});

test("esDia reconoce los días de la semana, con o sin tilde", () => {
  for (const d of ["lunes", "Miércoles", "miercoles", "SÁBADO", "sabado"]) assert.equal(esDia(d), true, d);
  for (const d of ["cátedra", "lunes 3", "", "ayudantía"]) assert.equal(esDia(d), false, d);
});
