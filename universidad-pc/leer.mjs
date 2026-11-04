// Lee tus notas y tu asistencia de la U (paso 49). Se corre con correr.ps1, que pone tu RUT y tu clave.
// Por ahora guarda la página tal cual en tu PC, para ver cómo viene y escribir el lector.
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { paginaDeNotas } from "./portal.mjs";

const { UCSC_RUT, UCSC_CLAVE, LOCALAPPDATA = "." } = process.env;
if (!UCSC_RUT || !UCSC_CLAVE) throw new Error("Falta tu RUT o tu clave: córrelo con correr.ps1 (y guárdala antes con guardar-clave.ps1).");

const carpeta = join(LOCALAPPDATA, "centro-de-datos"); // fuera del repo: son tus datos
await mkdir(carpeta, { recursive: true });
const archivo = join(carpeta, "notas-muestra.html");
await writeFile(archivo, await paginaDeNotas(UCSC_RUT, UCSC_CLAVE));
console.log("Listo, guardé la página de notas en", archivo);
