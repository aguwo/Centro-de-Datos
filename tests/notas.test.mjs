// Paso 46a: las cuentas de un ramo (nota hasta ahora, cuánto necesitas, cómo va, asistencia).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcular, estado, asistencia, nota } from "../docs/js/notas.js";

const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} no es ${b}`);

test("con ponderaciones: promedio ponderado y cuánto falta", () => {
  // 6,9 en algo que vale 30%; queda el 70%. Para llegar a 4: (4·100 − 6,9·30) / 70 = 2,757…
  const c = calcular([{ nota: 6.9, peso: 30 }, { peso: 20 }, { peso: 50 }]);
  cerca(c.actual, 6.9);
  cerca(c.necesitas, (400 - 207) / 70);
  assert.equal(c.falta, 70);
  assert.equal(estado(c), "Va bien");
});

test("cómo va: seguro, en riesgo y no alcanza", () => {
  assert.equal(estado(calcular([{ nota: 7, peso: 60 }, { peso: 40 }])), "Seguro");       // necesita 1
  assert.equal(estado(calcular([{ nota: 3.5, peso: 50 }, { peso: 50 }])), "En riesgo"); // necesita 4,5
  assert.equal(estado(calcular([{ nota: 1, peso: 70 }, { peso: 30 }])), "No alcanza"); // necesitaría 11
  assert.equal(estado(calcular([{ nota: 4.2, peso: 50 }, { nota: 3.9, peso: 50 }])), "Seguro"); // terminó con 4,05
  assert.equal(estado(calcular([{ nota: 3, peso: 50 }, { nota: 4, peso: 50 }])), "No alcanza");
  assert.equal(estado(calcular([{ peso: 50 }, { peso: 50 }])), "Sin notas");
});

test("sin todas las ponderaciones: promedio simple y no se sabe cuánto necesitas", () => {
  const c = calcular([{ nota: 5 }, { nota: 6, peso: 20 }, {}]);
  cerca(c.actual, 5.5);
  assert.equal(c.necesitas, null);
  assert.equal(c.sinPeso, 2);
  assert.equal(estado(c), "Va bien");
  assert.equal(estado(calcular([{ nota: 3 }, {}])), "En riesgo");
});

test("asistencia y notas escritas con coma", () => {
  assert.deepEqual(asistencia([{ valor: 1 }, { valor: 1 }, { valor: 0 }, { valor: "1" }]), { fui: 3, total: 4, porcentaje: 0.75 });
  assert.equal(asistencia([]).porcentaje, null);
  assert.equal(nota(6.9), "6,9");
  assert.equal(nota(4), "4,0");
  assert.equal(nota(undefined), "—");
});
