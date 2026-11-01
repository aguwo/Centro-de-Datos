// Las tarjetas del Inicio (paso 25). Cada tarjeta es solo una receta: qué datos mira y qué filas muestra.
// El Inicio (inicio.js) las dibuja todas igual, así que agregar una tarjeta nueva es agregar un objeto aquí.
//
// Una tarjeta es { titulo, columna, calcular(c) } y calcular devuelve:
//   filas    la lista a mostrar. Cada fila: { texto, meta?, id?, alerta?, hecho?, marcar?, puntos?, barra? }
//              id      el nodo que se abre al hacer clic en el texto
//              marcar  si viene, la fila tiene casilla y esto es lo que pasa al marcarla
//              puntos  [true, false, ...] los últimos días, para ver la racha
//              barra   0 a 1 (o más, si se pasó): cuánto va de algo
//   resumen  el texto chico a la derecha del título (por defecto, cuántas filas hay)
//   vacio    lo que se muestra si no hay filas
//   senal    { nivel: "alerta" | "aviso", texto }: aparece arriba de todo, para que no se te pase
//
// c es lo que todas comparten, ya calculado una vez: hoy, los nodos por tipo y los registros por nodo.
import { db, datos, dia, hora, escribir } from "./base.js";

export const COLUMNAS = { hacer: "Hacer", cuidarme: "Cuidarme", vida: "Mi vida" };

// --- Ayudas de fechas (todas con días como texto "2026-11-01", que se comparan y ordenan solos) ---
export const hoyTexto = () => new Date().toLocaleDateString("sv-SE");
export const sumarDias = (texto, n) => { const d = new Date(texto + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const corto = (texto) => texto.split("-").reverse().slice(0, 2).join("/"); // "2026-11-01" -> "01/11"
const lunes = (texto) => { const d = new Date(texto + "T12:00:00"); return sumarDias(texto, -((d.getDay() + 6) % 7)); };
const plata = (n) => "$" + Math.round(n).toLocaleString("es-CL");

// Lo que todas las tarjetas comparten. Se arma una vez por dibujo.
export function contexto() {
  const hoy = hoyTexto();
  const deTipo = (clave) => datos.nodos.filter((n) => n.tipos.clave === clave);
  // Registros por nodo y clase: registrosDe(id, "riego") -> los riegos de esa planta, del más viejo al más nuevo.
  const indice = new Map();
  for (const r of datos.registros) {
    for (const id of [r.nodo_id, r.otro_id]) if (id) {
      const k = id + r.clase;
      if (!indice.has(k)) indice.set(k, []);
      indice.get(k).push(r);
    }
  }
  const registrosDe = (id, clase) => indice.get(id + clase) ?? [];
  // Dentro de qué proyecto o área está cada nodo (para mostrarlo al lado de una tarea).
  const dentroDe = (id) => datos.nodo.get(datos.padre.get(id))?.titulo;
  return { hoy, deTipo, registrosDe, dentroDe };
}

// --- Acciones: lo que hace marcar una casilla. Todas escriben en la base; el tiempo real redibuja. ---
const SALTO = { Diaria: 1, Semanal: 7, Mensual: 30 };
// Una tarea repetitiva no se cierra: su fecha salta a la próxima vez que toca.
const completar = (n) => {
  const salto = SALTO[n.props?.repeticion];
  const cambios = salto && n.fecha ? { fecha: new Date(new Date(n.fecha).getTime() + salto * 864e5).toISOString() } : { estado: "Hecho" };
  return escribir(db.from("nodos").update(cambios).eq("id", n.id));
};
// Anotar que algo pasó hoy (un hábito cumplido, una planta regada), o borrar esa anotación si ya estaba.
const alternarRegistro = (clase, nodo, deHoy) => deHoy
  ? escribir(db.from("registros").delete().eq("id", deHoy.id))
  : escribir(db.from("registros").insert({ clase, nodo_id: nodo.id }));

// --- Filas que se repiten ---
const abierta = (n) => n.estado !== "Hecho";
const porFecha = (a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "");
function filaTarea(n, c, mostrarDia) {
  const d = dia(n.fecha);
  return {
    id: n.id, texto: n.titulo, alerta: !!d && d < c.hoy,
    meta: [c.dentroDe(n.id), d && (mostrarDia || d < c.hoy) ? corto(d) : "", hora(n.fecha)].filter(Boolean).join(" · "),
    marcar: n.tipos.clave === "tarea" ? () => completar(n) : null,
  };
}

export const TARJETAS = [
  {
    titulo: "Hoy", columna: "hacer",
    calcular(c) {
      const hoy = datos.nodos.filter((n) => ["tarea", "evento"].includes(n.tipos.clave) && abierta(n) && dia(n.fecha) === c.hoy).sort(porFecha);
      return { filas: hoy.map((n) => filaTarea(n, c)), vacio: "Nada agendado para hoy." };
    },
  },
  {
    titulo: "Atrasadas", columna: "hacer",
    calcular(c) {
      // Solo tareas: un evento que ya pasó, pasó.
      const atrasadas = c.deTipo("tarea").filter((n) => abierta(n) && dia(n.fecha) && dia(n.fecha) < c.hoy).sort(porFecha);
      const vieja = atrasadas[0];
      return {
        filas: atrasadas.map((n) => filaTarea(n, c)), vacio: "Nada atrasado. Bien ahí.",
        senal: vieja && { nivel: "alerta", texto: `${atrasadas.length} tareas atrasadas. «${vieja.titulo}» lleva ${diasEntre(dia(vieja.fecha), c.hoy)} días.` },
      };
    },
  },
  {
    titulo: "Próximos 7 días", columna: "hacer",
    calcular(c) {
      const fin = sumarDias(c.hoy, 7);
      const proximos = datos.nodos.filter((n) => ["tarea", "evento"].includes(n.tipos.clave) && abierta(n) && dia(n.fecha) > c.hoy && dia(n.fecha) <= fin).sort(porFecha);
      return { filas: proximos.map((n) => filaTarea(n, c, true)), vacio: "Semana despejada." };
    },
  },
  {
    titulo: "Inbox", columna: "hacer",
    calcular(c) {
      const inbox = c.deTipo("tarea").filter((n) => n.estado === "Inbox");
      return { filas: inbox.map((n) => filaTarea(n, c)), vacio: "Inbox vacío: todo está ordenado." };
    },
  },
  {
    titulo: "Hábitos de hoy", columna: "cuidarme",
    calcular(c) {
      const semana = Array.from({ length: 7 }, (_, i) => sumarDias(c.hoy, i - 6)); // de hace 6 días a hoy
      let ultimo = null;
      const filas = c.deTipo("habito").map((h) => {
        const regs = c.registrosDe(h.id, "habito");
        const dias = new Set(regs.map((r) => dia(r.fecha)));
        const deHoy = regs.find((r) => dia(r.fecha) === c.hoy);
        const u = regs.at(-1) && dia(regs.at(-1).fecha);
        if (u && (!ultimo || u > ultimo)) ultimo = u;
        return { id: h.id, texto: h.titulo, hecho: !!deHoy, puntos: semana.map((d) => dias.has(d)),
                 marcar: () => alternarRegistro("habito", h, deHoy) };
      });
      const sin = ultimo ? diasEntre(ultimo, c.hoy) : null;
      return {
        filas, resumen: `${filas.filter((f) => f.hecho).length}/${filas.length}`, vacio: "Todavía no tienes hábitos.",
        senal: filas.length && (sin === null || sin >= 2) && { nivel: "alerta",
          texto: sin === null ? "No has marcado ningún hábito en los últimos 90 días." : `Llevas ${sin} días sin marcar hábitos.` },
      };
    },
  },
  {
    titulo: "Objetivos", columna: "cuidarme",
    calcular(c) {
      // Todo lo que tenga una meta con número. "Actual" es la última medida anotada, o lo que diga el nodo.
      const conMeta = datos.nodos.filter((n) => ["objetivo", "hito"].includes(n.tipos.clave) && abierta(n) && typeof n.props?.meta === "number");
      const filas = conMeta.map((n) => {
        const { meta, inicio = 0, unidad = "" } = n.props;
        const actual = Number(c.registrosDe(n.id, "medida").at(-1)?.valor ?? n.props.actual ?? inicio);
        return { id: n.id, texto: n.titulo, barra: (actual - inicio) / (meta - inicio || 1),
                 meta: `${actual.toLocaleString("es-CL")} de ${meta.toLocaleString("es-CL")} ${unidad}`.trim() };
      });
      return { filas, vacio: "Ningún objetivo tiene meta con número." };
    },
  },
  {
    titulo: "Gastos de la semana", columna: "vida",
    calcular(c) {
      const desde = lunes(c.hoy);
      const gastos = datos.registros.filter((r) => r.clase === "gasto" && dia(r.fecha) >= desde);
      const suma = new Map(); // categoría (o null) -> total
      for (const g of gastos) suma.set(g.otro_id, (suma.get(g.otro_id) ?? 0) + Number(g.valor ?? 0));
      const filas = c.deTipo("categoria").map((cat) => {
        const gastado = suma.get(cat.id) ?? 0, tope = cat.props?.presupuesto_semanal;
        return { id: cat.id, texto: cat.titulo, alerta: tope && gastado > tope, barra: tope ? gastado / tope : null,
                 meta: plata(gastado) + (tope ? ` de ${plata(tope)}` : "") };
      }).filter((f) => f.barra !== null || f.meta !== "$0");
      const sinCategoria = suma.get(null) ?? 0;
      if (sinCategoria) filas.unshift({ texto: "Sin categoría", meta: plata(sinCategoria), alerta: true });
      const pasadas = filas.filter((f) => f.barra > 1).map((f) => f.texto);
      const total = [...suma.values()].reduce((a, b) => a + b, 0);
      return {
        filas, resumen: plata(total), vacio: "Sin categorías todavía.",
        senal: pasadas.length ? { nivel: "aviso", texto: `Esta semana te pasaste del presupuesto en ${pasadas.join(", ")}.` }
             : sinCategoria ? { nivel: "aviso", texto: `${plata(sinCategoria)} gastados esta semana sin categoría.` } : null,
      };
    },
  },
  {
    titulo: "Plantas con sed", columna: "vida",
    calcular(c) {
      // Le toca agua si ya pasaron más días de los que aguanta desde el último riego (o si nunca la regaste).
      const vivas = c.deTipo("planta").filter((p) => p.props?.aguanta_dias && !["Q.E.P.D.", "Por comprar"].includes(p.props.salud));
      const conSed = vivas.map((p) => {
        const riegos = c.registrosDe(p.id, "riego");
        const deHoy = riegos.find((r) => dia(r.fecha) === c.hoy);
        const ultimo = riegos.at(-1) && dia(riegos.at(-1).fecha);
        const toca = ultimo ? sumarDias(ultimo, p.props.aguanta_dias) : "";
        return { p, deHoy, toca, ultimo };
      }).filter((x) => x.deHoy || x.toca <= c.hoy).sort((a, b) => a.toca.localeCompare(b.toca));
      const filas = conSed.map(({ p, deHoy, ultimo }) => ({
        id: p.id, texto: p.titulo, hecho: !!deHoy, marcar: () => alternarRegistro("riego", p, deHoy),
        meta: deHoy ? "regada hoy" : ultimo ? `regada hace ${diasEntre(ultimo, c.hoy)} días` : "sin riegos anotados",
      }));
      const pendientes = filas.filter((f) => !f.hecho).length;
      return {
        filas, resumen: `${pendientes} de ${vivas.length}`, vacio: "Todas tus plantas están bien regadas.",
        senal: pendientes && { nivel: "aviso", texto: `${pendientes} plantas necesitan agua.` },
      };
    },
  },
  {
    titulo: "Proyectos en curso", columna: "vida",
    calcular(c) {
      const filas = c.deTipo("proyecto").filter((p) => p.estado === "En curso").map((p) => {
        // Las tareas que están dentro del proyecto (según el árbol, igual que en el mapa).
        const tareas = c.deTipo("tarea").filter((t) => abierta(t) && datos.padre.get(t.id) === p.id);
        const atrasadas = tareas.filter((t) => dia(t.fecha) && dia(t.fecha) < c.hoy).length;
        return { id: p.id, texto: p.titulo, alerta: atrasadas > 0,
                 meta: [`${tareas.length} abiertas`, atrasadas && `${atrasadas} atrasadas`].filter(Boolean).join(" · ") };
      });
      return { filas, vacio: "No hay proyectos en curso." };
    },
  },
];
