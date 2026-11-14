// Qué cambiar en el centro de datos según lo que dice EV@ (pasos 56 y 115). No sabe de internet ni de la base:
// recibe listas y devuelve listas, así se puede probar solo (tests/eva.test.ts).
//
// Cada entrega o cuestionario de EV@ con fecha es una tarea dentro de su ramo, marcada con props.eva = su clave
// ("assign:<id>" o "quiz:<id>"):
//   nueva     se crea solo si vence de ahora en adelante (las viejas no se rellenan) — «Por hacer» o «Hecho» si ya está
//   existente se mueve si EV@ le cambió la fecha, y pasa a «Hecho» cuando EV@ dice que ya la hiciste.
//             Nunca se devuelve a «Por hacer»: si la marcaste hecha a mano, queda así. El título y las notas son tuyos.

// Algo de EV@ que se hace hasta una fecha: una entrega (assign) o un cuestionario (quiz).
//   clave   "assign:123" o "quiz:456": no se repite entre cursos y es lo que se guarda en props.eva
//   titulo  cómo se llama la tarea («Entregar Lab 3», «Responder Test 2»)
//   hecha   si EV@ dice que ya la entregaste o respondiste
export type Pendiente = { clave: string; curso: number; titulo: string; vence: string | null; hecha: boolean; enlace: string };
export type Ramo = { id: string; owner_id: string; eva: number };
export type TareaEva = { id: string; fecha: string | null; estado: string | null; eva: string };

export type Plan = {
  crear: { owner_id: string; ramo_id: string; titulo: string; fecha: string; estado: string; contenido: string; props: { eva: string } }[];
  cambiar: { id: string; fecha?: string; estado?: string }[];
};

export function plan(pendientes: Pendiente[], ramos: Ramo[], tareas: TareaEva[], ahora = new Date().toISOString()): Plan {
  const p: Plan = { crear: [], cambiar: [] };
  for (const e of pendientes) {
    if (!e.vence) continue; // sin fecha no hay nada que agendar
    const t = tareas.find((x) => x.eva === e.clave);
    if (t) {
      const cambio: Plan["cambiar"][number] = { id: t.id };
      if (!t.fecha || Date.parse(t.fecha) !== Date.parse(e.vence)) cambio.fecha = e.vence;
      if (e.hecha && t.estado !== "Hecho") cambio.estado = "Hecho";
      if (Object.keys(cambio).length > 1) p.cambiar.push(cambio);
      continue;
    }
    if (e.vence < ahora) continue;
    for (const r of ramos.filter((x) => x.eva === e.curso)) {
      p.crear.push({
        owner_id: r.owner_id, ramo_id: r.id, titulo: e.titulo, fecha: e.vence,
        estado: e.hecha ? "Hecho" : "Por hacer", contenido: `En EV@: ${e.enlace}`, props: { eva: e.clave },
      });
    }
  }
  return p;
}

// El material de un curso (paso 115), sacado de core_course_get_contents: por cada sección que ves, sus archivos,
// carpetas, enlaces y páginas, con el enlace a EV@ (se abre con tu sesión del navegador; no se copia nada).
// Lo que EV@ no te deja ver (ej. lo de la otra sección del ramo) no entra. Secciones sin material, tampoco.
export type Material = { seccion: string; cosas: { nombre: string; tipo: string; enlace: string }[] }[];
const ES_MATERIAL = new Set(["resource", "folder", "url", "page", "book"]);
export function material(secciones: any[]): Material {
  return secciones.filter((s) => s.uservisible !== false && s.visible !== 0).map((s) => ({
    seccion: String(s.name ?? "").trim(),
    cosas: (s.modules ?? []).filter((m: any) => ES_MATERIAL.has(m.modname) && m.uservisible !== false && m.url)
      .map((m: any) => ({ nombre: String(m.name).trim(), tipo: m.modname, enlace: m.url })),
  })).filter((s) => s.cosas.length);
}
