// La dona (paso 92): un total repartido en segmentos separados con puntas redondas, cada uno de su color, más
// grueso mientras más pesa, con su ícono y su monto adentro, y al centro un texto con una cifra grande.
// Se arma una vez y después se le cambian los datos con poner(): cada segmento viaja de su forma vieja a la nueva
// empujado por el mismo resorte de la cámara del escritorio, así que entrar, cambiar de datos o elegir uno se ve
// fluido. Con «reducir movimiento» del sistema, todo salta directo.
//
//   const d = dona(centro, formato)   centro(elegida) devuelve [arriba, cifra, abajo], con elegida = la parte tocada
//                                     o null; formato(cifra) la escribe (ej. plata). La cifra sube y baja contando.
//   d.caja                            el elemento, para ponerlo en la página
//   d.poner(partes)                   partes: [{ id, valor, color, icono, nombre, corto }], en el orden en que van
//                                     (corto = el monto chico que va adentro, ej. "$12k")
// Tocar un segmento (o Enter sobre él) lo elige y el centro cuenta lo suyo; tocarlo de nuevo, o el centro, lo suelta.
import { el } from "./base.js";
import { icono, resorte } from "./dibujos.js";

// El dibujo mide 240×240: centro y radio del anillo. Grosor de la parte más chica y de la más grande, lo que crece
// la elegida y el espacio entre segmentos (todo en las mismas unidades del dibujo).
const C = 120, R = 92, GROSOR = [26, 38], CRECE = 6, HUECO = 7;
const RIGIDEZ = 11, INICIO = -Math.PI / 2; // el primer segmento parte arriba y van en el sentido del reloj
const quieto = matchMedia("(prefers-reduced-motion: reduce)");
const svg = (tag, attrs = {}) => {
  const x = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) x.setAttribute(k, attrs[k]);
  return x;
};
const punto = (ang) => [C + R * Math.cos(ang), C + R * Math.sin(ang)];
// Letra oscura sobre colores claros y blanca sobre los oscuros (la luminancia del color).
const tinta = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#1c1917" : "#fff";
};

// Dónde va cada parte: su ángulo de partida, cuánto recorre su tramo recto (sin las puntas) y su grosor.
// Las puntas redondas y los huecos ocupan su lugar en la vuelta; lo que sobra se reparte según el valor de cada una,
// así una parte muy chica queda como un círculo (solo sus dos puntas).
function repartir(partes) {
  const total = partes.reduce((s, p) => s + p.valor, 0), mayor = Math.max(...partes.map((p) => p.valor));
  const grosor = partes.map((p) => GROSOR[0] + (GROSOR[1] - GROSOR[0]) * Math.sqrt(p.valor / mayor));
  const sobra = Math.max(0, 2 * Math.PI - grosor.reduce((s, w) => s + (w + HUECO) / R, 0));
  let ang = INICIO + HUECO / 2 / R;
  return partes.map((p, i) => {
    const w = grosor[i], forma = { desde: ang + w / 2 / R, arco: (sobra * p.valor) / total, w };
    ang += forma.arco + (w + HUECO) / R;
    return forma;
  });
}

export function dona(centro, formato) {
  const anillo = svg("svg", { viewBox: "0 0 240 240", "aria-hidden": "true" });
  anillo.append(svg("circle", { cx: C, cy: C, r: R, class: "pista" }));
  const [arriba, cifra, abajo] = [el("small"), el("b"), el("small")];
  const caja = el("div", { className: "dona" }, anillo, el("button", { className: "dona-centro", type: "button", onclick: () => elegir(null) }, arriba, cifra, abajo));
  const segmentos = new Map(); // id -> { parte, g, trazo, texto, dibujo, ahora, vel, meta, sale }
  let partes = [], elegida = null, cuadro = 0, ultimo = 0;
  const numero = { ahora: { n: 0 }, vel: { n: 0 }, meta: { n: 0 } }; // la cifra del centro también va con resorte

  // Un segmento nuevo: su trazo, su monto y su ícono, que se pueden tocar. Nace en lo alto, sin largo ni grosor,
  // y desde ahí se abre a su lugar (así, al entrar, la dona se despliega en el sentido del reloj).
  function crear(p) {
    const g = svg("g", { class: "parte", tabindex: "0", role: "button" });
    const s = { parte: p, g, trazo: svg("path"), texto: svg("text"), dibujo: icono(p.icono),
      ahora: { desde: INICIO, arco: 0, w: 0 }, vel: { desde: 0, arco: 0, w: 0 } };
    g.append(s.trazo, s.texto, s.dibujo);
    g.onclick = (e) => { e.stopPropagation(); elegir(elegida === s.parte.id ? null : s.parte.id); };
    g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); g.onclick(e); } };
    anillo.append(g);
    return s;
  }

  // Dibuja un segmento con su forma de ahora: el arco (un punto si no tiene largo: con la punta redonda queda un
  // círculo), el monto al comienzo si cabe y el ícono en la punta final.
  function dibujar(s) {
    const { desde, arco, w } = s.ahora, [x1, y1] = punto(desde), [x2, y2] = punto(desde + arco);
    s.trazo.setAttribute("d", arco < 1e-3 ? `M${x1} ${y1}L${x1} ${y1}` : `M${x1} ${y1}A${R} ${R} 0 ${arco > Math.PI ? 1 : 0} 1 ${x2} ${y2}`);
    s.trazo.style.strokeWidth = Math.max(0, w);
    const ancho = s.parte.corto.length * 7, cabe = arco * R + w >= ancho + 26;
    const [tx, ty] = punto(desde + Math.max(0, ancho / 2 - w / 2 + 7) / R);
    s.texto.textContent = cabe ? s.parte.corto : "";
    s.texto.setAttribute("x", tx); s.texto.setAttribute("y", ty);
    const lado = Math.min(17, w * 0.58);
    for (const [k, v] of [["x", x2 - lado / 2], ["y", y2 - lado / 2], ["width", lado], ["height", lado]]) s.dibujo.setAttribute(k, Math.max(0, v));
  }

  // Lo que debería pasar ahora: la forma de cada parte (la elegida, más gruesa) y la cifra del centro.
  function apuntar() {
    const formas = repartir(partes), quien = partes.find((p) => p.id === elegida) ?? null;
    partes.forEach((p, i) => { const s = segmentos.get(p.id); s.meta = { ...formas[i], w: formas[i].w + (p.id === elegida ? CRECE : 0) }; });
    caja.classList.toggle("con-elegida", !!quien);
    caja.classList.toggle("vacia", !partes.length);
    for (const s of segmentos.values()) {
      s.g.classList.toggle("elegida", s.parte.id === elegida);
      s.g.setAttribute("aria-pressed", String(s.parte.id === elegida));
    }
    const [a, n, b] = centro(quien);
    if (arriba.textContent !== a || abajo.textContent !== b) {
      arriba.textContent = a; abajo.textContent = b;
      if (!quieto.matches) caja.lastChild.animate([{ opacity: 0.2, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 280, easing: "cubic-bezier(.22,.8,.24,1)" });
    }
    numero.meta.n = n;
    if (quieto.matches) llegar(); // sin animación: todo llega de una
    else if (!cuadro) { ultimo = performance.now(); cuadro = requestAnimationFrame(avanzar); }
  }

  // Un cuadro: cada número (forma de cada segmento y la cifra) da un paso de resorte hacia su meta.
  function avanzar(t) {
    const dt = Math.min(0.064, Math.max(0, t - ultimo) / 1000);
    ultimo = t;
    let falta = false;
    // Llegó cuando le falta casi nada (una milésima de vuelta, un poco de grosor, medio peso) y casi no se mueve.
    const paso = (o, k, casi) => {
      [o.ahora[k], o.vel[k]] = resorte(o.ahora[k], o.vel[k], o.meta[k], RIGIDEZ, dt);
      if (Math.abs(o.ahora[k] - o.meta[k]) > casi || Math.abs(o.vel[k]) > casi * 4) falta = true;
    };
    for (const s of segmentos.values()) { for (const k of ["desde", "arco", "w"]) paso(s, k, k === "w" ? 0.05 : 1e-3); dibujar(s); }
    paso(numero, "n", 0.5);
    cifra.textContent = formato(numero.ahora.n);
    if (falta) cuadro = requestAnimationFrame(avanzar);
    else llegar();
  }

  // Deja todo justo en su meta y borra los segmentos que salieron (su parte ya no está).
  function llegar() {
    cuadro = 0;
    for (const [id, s] of segmentos) {
      if (s.sale) { s.g.remove(); segmentos.delete(id); continue; }
      s.ahora = { ...s.meta }; s.vel = { desde: 0, arco: 0, w: 0 };
      dibujar(s);
    }
    numero.ahora.n = numero.meta.n; numero.vel.n = 0;
    cifra.textContent = formato(numero.meta.n);
  }

  const elegir = (id) => { elegida = id; apuntar(); };

  function poner(nuevas) {
    partes = nuevas.filter((p) => p.valor > 0);
    if (!partes.some((p) => p.id === elegida)) elegida = null;
    for (const p of partes) {
      const s = segmentos.get(p.id) ?? crear(p);
      if (s.parte.icono !== p.icono) s.dibujo.replaceWith((s.dibujo = icono(p.icono)));
      s.parte = p;
      s.g.style.setProperty("--color", p.color);
      s.g.style.setProperty("--tinta", tinta(p.color));
      s.g.setAttribute("aria-label", `${p.nombre}: ${formato(p.valor)}`);
      segmentos.set(p.id, s);
    }
    // Las que ya no están se achican donde estaban hasta desaparecer.
    for (const s of segmentos.values()) {
      s.sale = !partes.includes(s.parte);
      if (s.sale) s.meta = { ...s.ahora, arco: 0, w: 0 };
      s.g.classList.toggle("sale", s.sale);
    }
    apuntar();
  }

  return { caja, poner };
}
