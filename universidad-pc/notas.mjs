// Lee la página «Sistema académico - Notas» de intranet7 (paso 49) y la convierte en datos.
// No sabe de internet ni de archivos: recibe el HTML y devuelve una lista de ramos, así se puede probar solo.
//
// Cada ramo de la página es un bloque con data-id_curso y tres pestañas:
//   #eval_N        tabla Evaluación | Fecha | Nota   (sin nota = «-»)
//   #infor_curso_N horario y ponderaciones (no se usa: eso ya vino del syllabus)
//   #asistencia_N  «Asistencia del X%» y tabla Fecha-hora | Descripción | Estado («REGISTRA ASISTENCIA» o «-»)

const texto = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const celdas = (fila) => [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => texto(m[1]));
const filas = (html) => [...(html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "").matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => celdas(m[1]));
const entre = (html, desde, hasta) => { const i = html.indexOf(desde); if (i < 0) return ""; const j = html.indexOf(hasta, i); return html.slice(i, j < 0 ? undefined : j); };
const numero = (t) => (/^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(",", ".")) : null);

// "06/08/2026 10:10" -> "2026-08-06T10:10" (hora de Chile, sin zona)
const fecha = (t) => { const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2}))?/); return m ? `${m[3]}-${m[2]}-${m[1]}` + (m[4] ? `T${m[4]}` : "") : null; };

export function leerNotas(html) {
  const bloques = html.split(/(?=<div[^>]*data-id_curso=")/).slice(1);
  return bloques.map((b, n) => {
    const asignatura = texto(entre(b, "ASIGNATURA:", "</li>").replace("ASIGNATURA:", ""));
    const [, codigo = null, seccion = null] = asignatura.match(/\s([A-Z]{2,4}\d{4}[A-Z]?)\s+Sec\.\s*(\d+)/) ?? [];
    const evaluacion = entre(b, `id="eval_${n}"`, `id="infor_curso_${n}"`);
    const asistencia = entre(b, `id="asistencia_${n}"`, "end tab asistencia");
    const porcentaje = asistencia.match(/Asistencia del ([\d.,]+)%/)?.[1];
    return {
      id_curso: b.match(/data-id_curso="(\d+)"/)[1],
      nombre: texto(b.match(/<strong>([\s\S]*?)<\/strong><!-- titulo curso -->/)?.[1] ?? ""),
      codigo,
      seccion: seccion && Number(seccion),
      profesor: texto(entre(evaluacion, "PROFESOR RESPONSABLE:", "</li>").replace("PROFESOR RESPONSABLE:", "")) || null,
      evaluaciones: filas(evaluacion).filter((c) => c.length === 3).map(([nombre, , nota]) => ({ nombre, nota: numero(nota) })),
      asistencia: {
        porcentaje: porcentaje ? numero(porcentaje) : null, // null = el ramo no registra asistencia
        clases: filas(asistencia).filter((c) => c.length === 3 && fecha(c[0]))
          .map(([f, descripcion, estado]) => ({ fecha: fecha(f), descripcion, fui: estado === "REGISTRA ASISTENCIA" })),
      },
    };
  });
}
