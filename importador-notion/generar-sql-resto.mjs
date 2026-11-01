// Paso 17 (parte 2): el SQL para el resto de tu Notion.
// Uso: node importador-notion/generar-sql-resto.mjs notion-resto.json notion.json > importar-resto.sql
//   notion-resto.json = finanzas, hábitos, plantas, dieta, biblioteca y rutinas
//   notion.json       = el export del paso 12 (se usa para conectar con tus áreas y objetivos)
// Antes hay que haber corrido la migración 0006 (tipos nuevos y tabla registros).

import { readFileSync } from "node:fs";
import { traducirResto } from "./traducir-resto.mjs";
import { armarSql } from "./generar-sql.mjs";

const [resto, previo] = process.argv.slice(2);
if (!resto || !previo) throw new Error("Uso: node importador-notion/generar-sql-resto.mjs notion-resto.json notion.json > importar-resto.sql");
const leer = (f) => JSON.parse(readFileSync(f, "utf8"));
const t = traducirResto(leer(resto), leer(previo));
for (const s of t.saltados) console.error("saltado:", s);   // va a la pantalla, no al archivo SQL
process.stdout.write(armarSql(t, "Resto de Notion (finanzas, hábitos, plantas, dieta, biblioteca)"));
