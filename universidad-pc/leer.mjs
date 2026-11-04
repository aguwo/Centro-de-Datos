// Lee tus notas y tu asistencia de la U (paso 49). Se corre con correr.ps1, que pone tu RUT y tu clave.
// Deja el resultado en %LOCALAPPDATA%\centro-de-datos\universidad.json (fuera del repo: son tus datos).
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { paginaDeNotas } from "./portal.mjs";
import { leerNotas } from "./notas.mjs";

const { UCSC_RUT, UCSC_CLAVE, LOCALAPPDATA = "." } = process.env;
if (!UCSC_RUT || !UCSC_CLAVE) throw new Error("Falta tu RUT o tu clave: córrelo con correr.ps1 (y guárdala antes con guardar-clave.ps1).");

const ramos = leerNotas(await paginaDeNotas(UCSC_RUT, UCSC_CLAVE));
if (!ramos.length) throw new Error("La página de notas no trajo ningún ramo: puede que haya cambiado su formato.");

const carpeta = join(LOCALAPPDATA, "centro-de-datos");
await mkdir(carpeta, { recursive: true });
const archivo = join(carpeta, "universidad.json");
await writeFile(archivo, JSON.stringify({ leido: new Date().toISOString(), ramos }, null, 2));
for (const r of ramos) {
  const conNota = r.evaluaciones.filter((e) => e.nota !== null).length;
  console.log(`${r.nombre}: ${conNota}/${r.evaluaciones.length} notas, asistencia ${r.asistencia.porcentaje ?? "sin registro"}%`);
}
console.log("Guardado en", archivo);
