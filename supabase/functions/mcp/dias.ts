// Días para el conector (paso 47). Los días se manejan como texto "2026-11-04", igual que en la web.
// El servidor corre en otra zona horaria, así que "hoy" y "qué día es esta fecha" se calculan en la hora de Chile:
// a las 22:00 de Concepción en el servidor ya es mañana.
export const ZONA = "America/Santiago";

type Props = { repite?: string; repite_hasta?: string; excepto?: string } & Record<string, unknown>;

export const hoy = (ahora = new Date()) => ahora.toLocaleDateString("sv-SE", { timeZone: ZONA }); // "sv-SE" escribe AAAA-MM-DD
export const sumarDias = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** El día de una fecha guardada. Sin hora (medianoche UTC, como las de Notion) es ese día; con hora, el día en Chile. */
export function diaDe(fecha: string): string {
  const f = new Date(fecha);
  return f.getUTCHours() === 0 && f.getUTCMinutes() === 0 ? fecha.slice(0, 10) : f.toLocaleDateString("sv-SE", { timeZone: ZONA });
}

// ¿Un evento que ocurre por primera vez el día "primero" ocurre también el día d? (migración 0011)
// Es la misma regla que ocurreEl en docs/js/fechas.js; tests/dias.test.ts revisa que digan lo mismo.
const MEDIODIA = (d: string) => new Date(d + "T12:00:00Z");
const REGLAS: Record<string, (a: Date, b: Date) => boolean> = {
  "Cada día": () => true,
  "Cada semana": (a, b) => a.getUTCDay() === b.getUTCDay(),
  "Días hábiles": (_a, b) => b.getUTCDay() % 6 !== 0, // ni sábado (6) ni domingo (0)
  "Cada mes": (a, b) => a.getUTCDate() === b.getUTCDate(),
  "Cada año": (a, b) => a.getUTCDate() === b.getUTCDate() && a.getUTCMonth() === b.getUTCMonth(),
};
export function ocurreEl(primero: string | null, p: Props | null | undefined, d: string): boolean {
  p ??= {};
  if (!primero || d < primero || p.excepto?.split(",").includes(d)) return false;
  if (d === primero) return true;
  const regla = REGLAS[p.repite ?? ""];
  return !!regla && !(p.repite_hasta && d > p.repite_hasta) && regla(MEDIODIA(primero), MEDIODIA(d));
}
