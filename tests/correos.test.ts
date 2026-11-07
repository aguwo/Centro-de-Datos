// Paso 88: lo que se entiende de cada aviso de BancoEstado (textos como los que llegaron en octubre).
import { test } from "node:test";
import assert from "node:assert/strict";
import { leer } from "../supabase/functions/correos/leer.ts";

const COMPRA = "Notificación de compra - BancoEstado";
test("compras: el comercio sin prefijos, teléfono ni país, y el monto sin puntos", () => {
  assert.deepEqual(leer(COMPRA, "Compra internacional en NOTION GQWSFGFA-0003 +14154004291 US por $12.256, realizada el 24/10/2026 a las 07:49 hrs. Tarjeta terminada en 0147."),
    { clase: "gasto", titulo: "Compra Notion Gqwsfgfa-0003", valor: 12256 });
  assert.deepEqual(leer(COMPRA, "Compra e-commerce en DL*GOOGLE YOUTUBE SANTIAGO CL por $50, realizada el 21/10/2026 a las 13:44 hrs."),
    { clase: "gasto", titulo: "Compra Google Youtube Santiago", valor: 50 });
  assert.deepEqual(leer(COMPRA, "Compra por $27.160 en EXPRESS CONCEPCION PAI CONCEPCION CL, asociada a tarjeta de débito terminada en 0147."),
    { clase: "gasto", titulo: "Compra Express Concepcion Pai Concepcion", valor: 27160 });
  assert.deepEqual(leer(COMPRA, "Compra internacional por $20.336 en ANTHROPIC* CLAUDE SUB (+14152360599 US), realizada el 15/10/2026"),
    { clase: "gasto", titulo: "Compra Anthropic Claude Sub", valor: 20336 });
});
test("transferencias: enviada es gasto y recibida es ingreso, con el nombre", () => {
  const AVISO = "Aviso de envío o recepción de dinero";
  assert.deepEqual(leer(AVISO, "Transferencia electrónica saliente (TEF) por $4.500 realizada el 24/10/2026 a las 20:18:40 desde CuentaRUT, a Moises Nicolas Aedo (BancoEstado)."),
    { clase: "gasto", titulo: "Transferencia a Moises Nicolas Aedo", valor: 4500 });
  assert.deepEqual(leer(AVISO, "Has recibido una transferencia de Juan Perez Soto por $50.000 en tu CuentaRUT."),
    { clase: "ingreso", titulo: "Transferencia de Juan Perez Soto", valor: 50000 });
});
test("lo que no es un movimiento no se anota", () => {
  assert.equal(leer("Actualiza tus datos", "Ingresa a tu banca en línea."), null);
  assert.equal(leer(COMPRA, "Compra sin monto"), null);
});
