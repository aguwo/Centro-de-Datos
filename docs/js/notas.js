// Las cuentas de un ramo (paso 46a), en la escala chilena: notas de 1 a 7, se aprueba con 4.
// No sabe nada de la base ni de la página: recibe números y devuelve números (por eso se puede probar solo).
//
// Una evaluación es { nota, peso }: la nota (si ya la tienes) y cuánto vale, en % (si lo sabes).
//   con todas las ponderaciones   tu nota hasta ahora es el promedio ponderado de lo que ya tiene nota,
//                                 y "necesitas" es el promedio que te falta sacar en lo que queda para llegar a 4
//   si falta alguna ponderación   la nota es el promedio simple y no se puede saber cuánto necesitas
//   ponderación 0                 es formativa (un diagnóstico, una guía): se ve en la tabla pero no cuenta (paso 48)
export const APRUEBA = 4, MINIMA = 1, MAXIMA = 7;

const esNumero = (x) => typeof x === "number" && Number.isFinite(x);
const suma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);

export const formativa = (e) => e.peso === 0;

export function calcular(todas) {
  const evaluaciones = todas.filter((e) => !formativa(e));
  const conNota = evaluaciones.filter((e) => esNumero(e.nota));
  const sinPeso = evaluaciones.filter((e) => !(esNumero(e.peso) && e.peso > 0)).length;
  if (sinPeso) {
    const actual = conNota.length ? suma(conNota, (e) => e.nota) / conNota.length : null;
    return { actual, necesitas: null, falta: null, evaluado: null, sinPeso };
  }
  const pesoConNota = suma(conNota, (e) => e.peso), total = suma(evaluaciones, (e) => e.peso);
  const puntos = suma(conNota, (e) => e.nota * e.peso), falta = total - pesoConNota;
  return {
    actual: pesoConNota ? puntos / pesoConNota : null,
    necesitas: falta > 0 ? (APRUEBA * total - puntos) / falta : null,
    falta, // cuánto % del ramo queda por evaluar
    evaluado: total ? pesoConNota / total : null, // qué parte del ramo ya tiene nota, de 0 a 1 (paso 52)
    sinPeso: 0,
  };
}

// Cómo va el ramo, en una palabra:
//   Seguro      ya apruebas aunque te saques la mínima en lo que falta (o ya terminó con 4 o más)
//   Va bien     te basta con seguir como vas
//   En riesgo   necesitas más de lo que llevas
//   No alcanza  ni con un 7 en todo lo que falta llegas a 4 (o terminó bajo 4)
//   Sin notas   todavía no hay con qué medir
export function estado({ actual, necesitas, falta }) {
  if (actual === null) return "Sin notas";
  if (necesitas === null) return falta === 0 ? (actual >= APRUEBA ? "Seguro" : "No alcanza") : actual >= APRUEBA ? "Va bien" : "En riesgo";
  if (necesitas > MAXIMA) return "No alcanza";
  if (necesitas <= MINIMA) return "Seguro";
  return necesitas <= actual ? "Va bien" : "En riesgo";
}

// Tu asistencia: registros con valor 1 (fuiste) o 0 (faltaste). porcentaje es null si no hay ninguno.
export function asistencia(registros) {
  const fui = registros.filter((r) => Number(r.valor) === 1).length, total = registros.length;
  return { fui, total, porcentaje: total ? fui / total : null };
}

// Una nota como se escribe en Chile: 6,9 (con coma). Sin nota, una raya.
export const nota = (x) => (esNumero(x) ? x.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—");
