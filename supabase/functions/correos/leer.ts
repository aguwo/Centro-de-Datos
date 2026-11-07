// Paso 88: qué dice un aviso de BancoEstado. Recibe el asunto y el texto del correo y devuelve el movimiento,
// o null si no es una compra ni una transferencia. Solo lee: guardar es cosa de index.ts.
export type Movimiento = { clase: "gasto" | "ingreso"; titulo: string; valor: number };

const capitalizar = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase().replace(/(^|[\s(])\p{L}/gu, (x) => x.toUpperCase());
// «DL*GOOGLE YOUTUBE SANTIAGO CL» → «Google Youtube Santiago»: sin prefijos de pasarelas, teléfonos ni país.
export function comercio(t: string) {
  return capitalizar(t.replace(/^[A-Z]{1,3}\s?\*\s?/, "").replace(/\*/g, " ").replace(/\+?\d[\d\s-]{6,}/g, " ").replace(/\b(CL|US|SG|IE|GB)\b\)?\s*$/, "").replace(/[(),]+/g, " "));
}

export function leer(asunto: string, texto: string): Movimiento | null {
  const todo = `${asunto}\n${texto}`.replace(/\s+/g, " ");
  const plata = todo.match(/\$\s?(\d{1,3}(?:\.\d{3})+|\d+)/);
  if (!plata) return null;
  const valor = Number(plata[1].replaceAll(".", ""));
  if (/compra/i.test(asunto) || /\bcompra\b/i.test(todo)) {
    // «Compra internacional en NOTION GQW… por $12.256» o «Compra por $27.160 en EXPRESS CONCEPCION PAI CONCEPCION CL, …»
    const m = todo.match(/\ben\s+(.+?)(?=\s+por\s+\$|,|;|\s+con\s+tarjeta|\s+asociad|\s+realizad|\.\s|$)/i);
    const nombre = m && !/^(tu|su|el|la)\b/i.test(m[1]) ? comercio(m[1]) : "";
    return { clase: "gasto", titulo: nombre ? "Compra " + nombre : "Compra", valor };
  }
  if (/transferencia|env[ií]o o recepci[oó]n de dinero|\bTEF\b/i.test(todo)) {
    const recibida = /recib|abono|te (ha )?transferid|entrante/i.test(todo);
    const quien = todo.match(recibida ? /\bde\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/ : /\ba\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/);
    return { clase: recibida ? "ingreso" : "gasto", titulo: `Transferencia ${recibida ? "de" : "a"}${quien ? " " + quien[1] : ""}`, valor };
  }
  return null;
}
