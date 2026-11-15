// Paso 123: Martita en la barra. Su ícono (el ojo con el anillo de luces del iris) brilla cuando tiene algo que decirte;
// al tocarlo abre un globo con sus avisos, cada uno con su botón para resolverlo. Por ahora los avisos salen de tus
// datos; después aquí mismo llegarán el chat y la voz.
// Un aviso nuevo = una función más en AVISOS: devuelve una lista de { icono, tono, texto, boton, hacer }.
// tono: "alerta" (rojo), "aviso" (amarillo) o "acento"; los más urgentes van primero.
import { el, enLaWeb } from "./base.js";
import { icono } from "./dibujos.js";
import { APARTADOS } from "./apartados.js";
import { ir, pendientesDeApartados } from "./carcasa.js";
import { viejas, explicar } from "./frescura.js";
import { faltaRevisar, abrirRevision } from "./revision.js";

const AVISOS = [
  // Lo que pide cada apartado: lo mismo que dicen sus insignias en la barra (paso 120).
  () => {
    const de = pendientesDeApartados();
    return APARTADOS.filter((a) => de.get(a.id)).map((a) => ({ icono: a.icono, ...de.get(a.id), texto: `${a.nombre}: ${de.get(a.id).texto}`, boton: "Ver", hacer: () => ir(a.id) }));
  },
  // Lo que dejó de llegar solo (paso 114).
  () => viejas().map(({ fuente, ultimo, hace }) => ({ icono: fuente.icono, tono: "aviso", boton: "¿Qué reviso?", hacer: () => explicar(fuente),
    texto: `${fuente.nombre}: ${ultimo ? `lo último llegó hace ${hace} días` : "todavía no llega nada"}` })),
  // De noche, si no has revisado el día (revision.js).
  () => (faltaRevisar() ? [{ icono: "luna", tono: "acento", texto: "Te falta revisar el día", boton: "Revisar", hacer: abrirRevision }] : []),
];
const URGENCIA = ["alerta", "aviso", "acento"];
function avisos() {
  return AVISOS.flatMap((f) => { try { return f(); } catch (e) { console.error(e); return []; } }) // uno que falle no apaga los demás
    .sort((a, b) => URGENCIA.indexOf(a.tono) - URGENCIA.indexOf(b.tono));
}

// El botón de la barra: brilla si hay algo. Lo arma carcasa.js; se mira al llegar datos y cada minuto (la revisión es de noche).
export function botonDeMartita(boton) {
  boton.classList.add("martita");
  mirar(boton);
  return boton;
}
function mirar(boton = document.querySelector(".dock .martita")) {
  if (!boton) return;
  const n = avisos().length;
  boton.classList.toggle("con-avisos", n > 0);
  boton.setAttribute("aria-description", n ? `${n} ${n === 1 ? "aviso" : "avisos"}` : "Sin avisos");
}
document.addEventListener("datos", () => mirar());
setInterval(() => mirar(), 60_000);

// El globo: al lado del botón en el computador, arriba del dock en el teléfono. Se cierra tocando afuera o con Escape.
let globo = null;
export function abrirMartita() {
  if (globo) return cerrar();
  const boton = document.querySelector(".dock .martita"), lista = avisos();
  globo = el("div", { className: "martita-globo", role: "dialog", ariaLabel: "Avisos de Martita" },
    el("header", {}, icono("martita"), el("div", {}, el("b", { textContent: "Martita" }),
      el("small", { textContent: lista.length ? "Esto es lo que te quería decir" : "Todo en orden por ahora" }))),
    lista.length ? el("ul", {}, ...lista.map((a, i) => {
      const li = el("li", {}, icono(a.icono), el("p", { textContent: a.texto }),
        el("button", { type: "button", className: "pildora", textContent: a.boton, onclick: () => { cerrar(); a.hacer(); } }));
      li.style.setProperty("--c", `var(--${a.tono})`);
      li.style.setProperty("--i", i);
      return li;
    })) : "",
    el("p", { className: "pista", textContent: "Pronto también podrás hablarme aquí." }));
  document.body.append(globo);
  const r = boton.getBoundingClientRect(), alto = globo.getBoundingClientRect().height;
  const enLaBarra = document.body.classList.contains("con-escritorio");
  globo.classList.toggle("arriba", !enLaBarra);
  globo.style.setProperty("--x", enLaWeb(enLaBarra ? r.right + 12 : 12) + "px");
  globo.style.setProperty("--y", enLaWeb(enLaBarra ? Math.max(12, Math.min(innerHeight - alto - 12, r.top - 8)) : r.top - alto - 12) + "px");
  boton.setAttribute("aria-expanded", "true");
  setTimeout(() => addEventListener("pointerdown", afuera), 0);
  addEventListener("keydown", escape);
  globo.querySelector("button")?.focus({ preventScroll: true });
}
function cerrar() {
  globo?.remove();
  globo = null;
  document.querySelector(".dock .martita")?.setAttribute("aria-expanded", "false");
  removeEventListener("pointerdown", afuera);
  removeEventListener("keydown", escape);
}
const afuera = (e) => { if (!e.target.closest(".martita-globo, .dock .martita")) cerrar(); };
const escape = (e) => { if (e.key === "Escape") cerrar(); };
