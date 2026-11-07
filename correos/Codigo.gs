// Paso 88: los avisos de BancoEstado de este Gmail se anotan solos en el centro de datos.
// Se pega en script.google.com (un proyecto en cada Gmail tuyo). Cada 15 minutos busca los avisos nuevos
// y se los manda a la función "correos" de Supabase, que los lee y los anota. A los ya mandados les pone
// la etiqueta «centro-de-datos», así no se mandan dos veces (y la función igual ignora los repetidos).
// Cómo instalarlo (una vez por cada Gmail):
//   1. script.google.com → Nuevo proyecto → borra lo que trae y pega este archivo.
//   2. Cambia CLAVE por tu clave (la de CORREOS_CLAVE en Supabase).
//   3. Arriba elige la función «instalar» → Ejecutar → acepta los permisos (leer Gmail y conectarse a internet).

const FUNCION = "https://fugvincuaakcnvujtqlt.supabase.co/functions/v1/correos";
const CLAVE = "PEGA_AQUI_LA_CLAVE";             // la misma que guardaste con: supabase secrets set CORREOS_CLAVE=...
const DESDE = "2026/10/25";                     // lo de antes ya estaba en el centro de datos (venía de Notion)
const BUSCAR = `from:correo.bancoestado.cl after:${DESDE} -label:centro-de-datos`;

function revisar() {
  const hecha = GmailApp.getUserLabelByName("centro-de-datos") || GmailApp.createLabel("centro-de-datos");
  for (const hilo of GmailApp.search(BUSCAR, 0, 50)) {
    const todos = hilo.getMessages().every((m) => {
      const r = UrlFetchApp.fetch(FUNCION, { method: "post", contentType: "application/json", headers: { "x-clave": CLAVE }, muteHttpExceptions: true,
        payload: JSON.stringify({ id: m.getId(), asunto: m.getSubject(), texto: m.getPlainBody().slice(0, 4000), fecha: m.getDate().toISOString() }) });
      if (r.getResponseCode() !== 200) console.log("No se pudo mandar", m.getSubject(), r.getResponseCode(), r.getContentText());
      return r.getResponseCode() === 200;
    });
    if (todos) hilo.addLabel(hecha); // si algo falló, se reintenta en 15 minutos
  }
}

// Corre esta una vez: deja revisar() programada cada 15 minutos y hace la primera pasada.
function instalar() {
  for (const t of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger("revisar").timeBased().everyMinutes(15).create();
  revisar();
}
