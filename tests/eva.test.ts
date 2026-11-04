// Paso 56: qué hace la copia de EV@ con cada entrega.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, type Entrega } from "../supabase/functions/eva/plan.ts";

const AHORA = "2026-11-04T23:00:00.000Z";
const ramos = [{ id: "arq", owner_id: "yo", eva: 91904 }];
const entrega = (id: number, vence: string | null, entregada = false): Entrega =>
  ({ id, curso: 91904, nombre: `LABORATORIO ${id}`, vence, entregada, enlace: `https://ev/${id}` });

test("una entrega que viene se vuelve tarea del ramo; las viejas y las sin fecha no", () => {
  const p = plan([entrega(3, "2026-11-05T02:59:00.000Z"), entrega(2, "2026-10-05T02:59:00.000Z", true), entrega(9, null)], ramos, [], AHORA);
  assert.deepEqual(p.crear, [{ owner_id: "yo", ramo_id: "arq", titulo: "Entregar LABORATORIO 3", fecha: "2026-11-05T02:59:00.000Z",
    estado: "Por hacer", contenido: "Entrega en EV@: https://ev/3", props: { eva: "assign:3" } }]);
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
