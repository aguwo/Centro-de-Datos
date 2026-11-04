// Paso 47: la regla de repetición del conector (dias.ts) y la de la web (fechas.js) tienen que decir lo mismo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ocurreEl as delConector, diaDe, hoy, sumarDias } from "../supabase/functions/mcp/dias.ts";
import { ocurreEl as deLaWeb } from "../docs/js/fechas.js";

const REPITE = [undefined, "Cada día", "Cada semana", "Días hábiles", "Cada mes", "Cada año"];
const PRIMERO = "2026-01-31"; // fin de mes y sábado: las reglas difíciles

test("el conector y la web dicen lo mismo para cada regla, durante un año", () => {
  for (const repite of REPITE) {
    for (const props of [{ repite }, { repite, repite_hasta: "2026-06-30" }, { repite, excepto: "2026-02-07,2026-03-31" }]) {
      for (let i = -3; i < 400; i++) {
        const d = sumarDias(PRIMERO, i);
        assert.equal(delConector(PRIMERO, props, d), deLaWeb(PRIMERO, props, d), `${JSON.stringify(props)} el ${d}`);
      }
    }
  }
});

test("los días se cuentan en la hora de Chile", () => {
  assert.equal(diaDe("2026-11-05T01:30:00+00:00"), "2026-11-04"); // 22:30 del 4 en Concepción
  assert.equal(diaDe("2026-11-05T00:00:00+00:00"), "2026-11-05"); // sin hora: ese día
  assert.equal(hoy(new Date("2026-11-05T01:30:00Z")), "2026-11-04");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});
