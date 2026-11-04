// Qué cambiar en el centro de datos según las entregas de EV@ (paso 56). No sabe de internet ni de la base:
// recibe listas y devuelve listas, así se puede probar solo (tests/eva.test.ts).
//
// Cada entrega de EV@ con fecha es una tarea dentro de su ramo, marcada con props.eva = "assign:<id>":
//   nueva     se crea solo si vence de ahora en adelante (las viejas no se rellenan) — «Por hacer» o «Hecho» si ya la entregaste
//   existente se mueve si EV@ le cambió la fecha, y pasa a «Hecho» cuando EV@ dice que la entregaste.
//             Nunca se devuelve a «Por hacer»: si la marcaste hecha a mano, queda así. El título y las notas son tuyos.

export type Entrega = { id: number; curso: number; nombre: string; vence: string | null; entregada: boolean; enlace: string };
export type Ramo = { id: string; owner_id: string; eva: number };
export type TareaEva = { id: string; fecha: string | null; estado: string | null; eva: string };

export type Plan = {
  crear: { owner_id: string; ramo_id: string; titulo: string; fecha: string; estado: string; contenido: string; props: { eva: string } }[];
  cambiar: { id: string; fecha?: string; estado?: string }[];
};

export const claveEva = (e: Entrega) => `assign:${e.id}`;

export function plan(entregas: Entrega[], ramos: Ramo[], tareas: TareaEva[], ahora = new Date().toISOString()): Plan {
  const p: Plan = { crear: [], cambiar: [] };
  for (const e of entregas) {
    if (!e.vence) continue; // sin fecha no hay nada que agendar
    const t = tareas.find((x) => x.eva === claveEva(e));
    if (t) {
      const cambio: Plan["cambiar"][number] = { id: t.id };
      if (!t.fecha || Date.parse(t.fecha) !== Date.parse(e.vence)) cambio.fecha = e.vence;
      if (e.entregada && t.estado !== "Hecho") cambio.estado = "Hecho";
      if (Object.keys(cambio).length > 1) p.cambiar.push(cambio);
      continue;
    }
    if (e.vence < ahora) continue;
    for (const r of ramos.filter((x) => x.eva === e.curso)) {
      p.crear.push({
        owner_id: r.owner_id, ramo_id: r.id, titulo: `Entregar ${e.nombre}`, fecha: e.vence,
        estado: e.entregada ? "Hecho" : "Por hacer", contenido: `Entrega en EV@: ${e.enlace}`, props: { eva: claveEva(e) },
      });
    }
  }
  return p;
}
