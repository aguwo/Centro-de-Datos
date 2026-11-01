// Prueba las reglas del paso 17 con un Notion inventado y chico.
import { test } from "node:test";
import assert from "node:assert/strict";
import { traducirResto } from "../importador-notion/traducir-resto.mjs";

const url = (n) => `https://app.notion.com/p/${String(n).padStart(32, "0")}`;
const previo = { areas: [{ url: url(1), Nombre: "Finanzas Personales" }, { url: url(2), Nombre: "<p>\nbotánica \n</p>" }], objetivos: [] };
const vacio = { cuentas: [], categorias: [], suscripciones: [], objetivos_fin: [], gastos: [], ingresos: [], transferencias: [],
  hitos: [], rutinas: [], habitos: [], plantas: [], referencias: [], alimentos: [], compras_mensuales: [], compras_semanales: [],
  ingredientes: [], recetas: [], comidas: [] };
const r = traducirResto({ ...vacio,
  cuentas: [{ url: url(10), Nombre: "Debito" }, { url: url(11), Nombre: "Ahorro" }],
  categorias: [{ url: url(12), Name: "Comida" }],
  gastos: [{ url: url(13), "Gasto específico": "Compra [SHEIN.COM](http://SHEIN.COM)", Cantidad: 100, "date:Fecha:start": "2026-10-01",
             Cuenta: `["${url(10)}"]`, "Categoría": `["${url(12)}"]` },
           { url: url(14), "Gasto específico": "Nuevo gasto", Cantidad: 5 }],
  transferencias: [{ url: url(15), Nombre: "Ahorro semanal", Cantidad: 5000, "date:Fecha:start": "2026-10-02",
                     "De la cuenta": `["${url(10)}"]`, "A la cuenta": `["${url(11)}"]` }],
  habitos: [{ url: url(16), "date:Fecha:start": "2026-10-03", Meditar: "__YES__", Lectura: "__NO__" }],
  plantas: [{ url: url(17), Nombre: "Pilea", Estado: "Q.E.P.D." }],
  alimentos: [{ url: url(18), Nombre: "Salsa", "kcal/100g": 35 }],
  compras_mensuales: [{ url: url(19), Nombre: "Salsa de Tomate", Estado: "Falta", cantidad: "12 sobres" }],
}, previo);
const nodo = (t) => r.nodos.find((n) => n.titulo === t);

test("las cuentas cuelgan del área Finanzas Personales", () => {
  assert.ok(r.conexiones.some((c) => c.origen === nodo("Debito").notion_id && c.destino === "1".padStart(32, "0")));
});

test("un gasto es un registro con cuenta y categoría, y el texto queda limpio", () => {
  const g = r.registros.find((x) => x.clase === "gasto");
  assert.equal(g.titulo, "Compra SHEIN.COM");
  assert.equal(g.nodo, nodo("Debito").notion_id);
  assert.equal(g.otro, nodo("Comida").notion_id);
  assert.ok(r.saltados.includes("gasto sin fecha: Nuevo gasto"));
});

test("la transferencia va de la cuenta de origen a la de destino", () => {
  const t = r.registros.find((x) => x.clase === "transferencia");
  assert.deepEqual([t.nodo, t.otro], [nodo("Debito").notion_id, nodo("Ahorro").notion_id]);
});

test("cada casilla marcada es un registro del hábito", () => {
  const h = r.registros.filter((x) => x.clase === "habito");
  assert.equal(h.length, 1);
  assert.equal(h[0].nodo, "habito:Meditar");
  assert.ok(nodo("Meditar"));
});

test("la planta muerta queda archivada y en botánica", () => {
  assert.equal(nodo("Pilea").archivado, true);
  assert.ok(r.conexiones.some((c) => c.origen === nodo("Pilea").notion_id && c.destino === "2".padStart(32, "0")));
});

test("la lista de compras se fusiona con el alimento", () => {
  assert.equal(r.nodos.filter((n) => n.tipo === "alimento").length, 1);
  assert.equal(nodo("Salsa").props.compra, "Mensual");
  assert.equal(nodo("Salsa").props.cantidad_compra, "12 sobres");
});
