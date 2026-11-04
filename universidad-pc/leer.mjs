// Lee tus notas y tu asistencia de la U (paso 49). Se corre con correr.ps1, que pone tu RUT y tu clave.
// Deja el resultado en %LOCALAPPDATA%\centro-de-datos\universidad.json (fuera del repo: son tus datos)
// y, si correr.ps1 le pasó tu sesión del centro de datos (paso 50), lo sube con subir.mjs.
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { paginaDeNotas } from "./portal.mjs";
import { leerNotas } from "./notas.mjs";
import { subir } from "./subir.mjs";
import { SUPABASE_URL, SUPABASE_KEY } from "../docs/config.js";

const { UCSC_RUT, UCSC_CLAVE, CENTRO_TOKEN, LOCALAPPDATA = "." } = process.env;
if (!UCSC_RUT || !UCSC_CLAVE) throw new Error("Falta tu RUT o tu clave: córrelo con correr.ps1 (y guárdala antes con guardar-clave.ps1).");

const ramos = leerNotas(await paginaDeNotas(UCSC_RUT, UCSC_CLAVE));
if (!ramos.length) throw new Error("La página de notas no trajo ningún ramo: puede que haya cambiado su formato.");

const carpeta = join(LOCALAPPDATA, "centro-de-datos");
await mkdir(carpeta, { recursive: true });
const archivo = join(carpeta, "universidad.json");
await writeFile(archivo, JSON.stringify({ leido: new Date().toISOString(), ramos }, null, 2));
for (const r of ramos) {
  const conNota = r.evaluaciones.filter((e) => e.nota !== null).length;
  const asis = r.asistencia.porcentaje === null ? "sin registro" : r.asistencia.porcentaje + "%";
  console.log(`${r.nombre}: ${conNota}/${r.evaluaciones.length} notas, asistencia ${asis}`);
}
console.log("Guardado en", archivo);

if (!CENTRO_TOKEN) console.log("No se subió al centro de datos: conecta este PC una vez con conectar.ps1.");
else {
  const p = await subir(ramos, { url: SUPABASE_URL, llave: SUPABASE_KEY, token: CENTRO_TOKEN });
  console.log(`Centro de datos: ${p.notas.length} notas nuevas, ${p.nuevas.length} clases nuevas, ${p.cambios.length} clases corregidas, ${p.borrar.length} borradas.`);
  for (const n of p.sinRamo) console.log(`  Sin pareja: el ramo «${n}» (¿cómo se llama en el centro de datos?)`);
  for (const e of p.sinEvaluacion) console.log(`  Sin pareja: «${e.nombre}» (${e.nota}) de ${e.ramo}. Cámbiale el nombre a su evento para que se parezca.`);
}
