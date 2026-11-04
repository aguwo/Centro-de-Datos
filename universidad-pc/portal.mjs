// Entrar al portal de la UCSC y abrir la página de notas (paso 49).
// Corre en el PC de Agustin: el portal solo deja entrar desde Chile, así que no puede correr en la nube.
// Usa fetch de Node (22 o más) y lleva las cookies a mano, como lo haría el navegador.

const PORTAL = "https://portal.ucsc.cl";
const FICHA_DEL_CURSO = "/services/apps/open/1"; // el botón «Ficha del curso»: abre las notas en intranet7

/** Un frasco de cookies mínimo: guarda las que mandan los servidores *.ucsc.cl y las devuelve en cada pedido. */
function frasco() {
  const cookies = new Map();
  return {
    guardar(res) {
      for (const c of res.headers.getSetCookie()) {
        const [par] = c.split(";");
        const i = par.indexOf("=");
        cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
      }
    },
    cabecera: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

/** Pide una URL con las cookies y sigue las redirecciones a mano (fetch no guarda cookies entre saltos). */
async function pedir(jar, url, opciones = {}) {
  for (let saltos = 0; saltos < 6; saltos++) {
    const res = await fetch(url, { ...opciones, redirect: "manual", headers: { ...opciones.headers, cookie: jar.cabecera() } });
    jar.guardar(res);
    const destino = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !destino) return res;
    url = new URL(destino, url).href;
    opciones = {}; // después de una redirección se sigue con GET
  }
  throw new Error("Demasiadas redirecciones");
}

/** El texto de una respuesta con su codificación (los sistemas viejos de la U a veces usan latin-1, no UTF-8). */
async function texto(res) {
  const charset = res.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1] ?? "utf-8";
  return new TextDecoder(charset).decode(await res.arrayBuffer());
}

/**
 * Entra con tu RUT (sin puntos ni dígito verificador) y tu clave, y devuelve el HTML de «Sistema académico - Notas»
 * del semestre actual. La clave solo viaja al portal de la U.
 */
export async function paginaDeNotas(rut, clave) {
  const jar = frasco();
  await pedir(jar, PORTAL + "/"); // la primera visita entrega la cookie de sesión
  const login = await pedir(jar, PORTAL + "/usuario/autenticar", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest" },
    body: new URLSearchParams({ username: rut, password: clave }),
  });
  const r = await login.json();
  if (!r.status) throw new Error(`El portal no te dejó entrar: ${r.message ?? "sin mensaje"}`);
  if (r.data?.cambiar_pass == 1) throw new Error("El portal pide cambiar la clave: entra una vez a mano y cámbiala.");

  const notas = await pedir(jar, PORTAL + FICHA_DEL_CURSO);
  const html = await texto(notas);
  if (!html.includes("Notas")) throw new Error(`No llegué a la página de notas (terminé en ${notas.url || "otra página"}).`);
  return html;
}
