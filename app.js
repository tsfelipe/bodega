/* Bodega — versión web.
   Toda la lógica y la seguridad viven en Supabase (funciones bod_*); esta página solo muestra
   y envía datos. No guarda contraseñas: solo el token de la sesión. */
"use strict";

const CFG = window.BODEGA || {};
const BASE = (CFG.url || "").replace(/\/$/, "") + (CFG.directo ? "" : "/rest/v1");
const E = {               // estado de la página
  sesion: null, usuario: null, config: {}, cambios: null, conectado: true, lenta: false,
  ahora: null, vista: null, ui: {}, datos: {},
};

// ------------------------------------------------------------------ utilidades
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const h = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-CO");
const num = (n) => (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });
const puede = (p) => !!E.usuario && E.usuario.permisos.includes(p);
const dosDig = (n) => String(n).padStart(2, "0");
function ahoraLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())} ${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`;
}
const aInput = (f) => (f ? f.replace(" ", "T") : "");
const deInput = (f) => (f ? f.replace("T", " ").slice(0, 16) : "");
const guardado = {
  leer(k) { try { return localStorage.getItem(k); } catch { return null; } },
  escribir(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};
function telefonoLinks(tel) {
  const digitos = String(tel || "").replace(/\D/g, "");
  if (digitos.length < 7) return "";
  const wa = digitos.length === 10 ? "57" + digitos : digitos;
  return `<a class="btn claro" href="tel:${h(digitos)}">${ICONOS.tel} Llamar</a>
          <a class="btn claro" href="https://wa.me/${h(wa)}" target="_blank" rel="noopener">${ICONOS.chat} WhatsApp</a>`;
}

const ICONOS = {
  inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  inventario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/></svg>',
  papelera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  registro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  mas3: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  alquiler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17h2l2-6h7l3 6h4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M14 11V6h3l2 5"/></svg>',
  cotizacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>',
  factura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.2-6.5 8-6.5s7 2 8 6.5"/></svg>',
  config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
};

// -------------------------------------------------------------- conexión con Supabase
class ErrorApi extends Error {
  constructor(mensaje, codigo) { super(mensaje); this.codigo = codigo; }
}

async function api(nombre, args = {}, conToken = true) {
  const cuerpo = conToken ? { p_token: E.sesion, ...args } : args;
  const inicio = performance.now();
  let r;
  try {
    r = await fetch(`${BASE}/rpc/${nombre}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.clave || "" },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    marcarRed(false);
    throw new ErrorApi("No hay conexión con el servidor. Revise el internet e intente de nuevo.", "RED");
  }
  marcarRed(true, performance.now() - inicio);
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { message: texto }; }
  if (!r.ok) {
    const codigo = datos && datos.code;
    const mensaje = (datos && datos.message) || `Error ${r.status}`;
    if (codigo === "BS401") { cerrarSesion(mensaje); throw new ErrorApi(mensaje, codigo); }
    if (codigo === "P0001") throw new ErrorApi(mensaje, codigo);
    console.error(nombre, r.status, datos);
    if (r.status === 401 || r.status === 403) {
      throw new ErrorApi("Supabase rechazó la clave de la página. Revise la clave publishable en config.js.", "CLAVE");
    }
    if (r.status === 404) {
      throw new ErrorApi("La base de datos no tiene las funciones de la página. Ejecute instalar.sql en Supabase.", "SQL");
    }
    throw new ErrorApi("Ocurrió un error inesperado. Intente de nuevo; si se repite, avise al administrador.", codigo || "X");
  }
  return datos;
}

function marcarRed(ok, ms = 0) {
  const antes = E.conectado;
  E.conectado = ok;
  if (ok) E.lenta = ms > 1500;
  pintarLuz();
  if (ok && !antes) refrescar();   // volvió la conexión: se trae lo último
}

function pintarLuz() {
  const luz = $("#luz");
  const aviso = $("#aviso-red");
  if (!luz) return;
  const [color, texto] = !E.conectado ? ["rojo", "Sin conexión"] : E.lenta ? ["amarillo", "Internet lento"] : ["verde", "En línea"];
  luz.className = "luz " + color;
  luz.innerHTML = `<i></i><span>${texto}</span>`;
  luz.title = texto;
  aviso.classList.toggle("oculto", E.conectado);
}

// ------------------------------------------------------------------- avisos
function avisar(texto, mal = false) {
  const t = document.createElement("div");
  t.className = "toast" + (mal ? " mal" : "");
  t.textContent = texto;
  $("#avisos").appendChild(t);
  setTimeout(() => t.remove(), mal ? 6000 : 3200);
}

// --------------------------------------------------------- ventanas y formularios
// Las ventanas se apilan: una ventana puede abrir otra (p. ej. «Cliente nuevo» dentro de un alquiler).
function cerrarVentana() { const c = $("#modal-raiz").lastElementChild; if (c) c.remove(); }
function cerrarTodas() { $("#modal-raiz").innerHTML = ""; }

function abrirVentana({ titulo, cuerpo, pie = "", ancha = false }) {
  const capa = document.createElement("div");
  capa.className = "fondo";
  capa.innerHTML = `<section class="ventana${ancha ? " ancha" : ""}" role="dialog" aria-modal="true">
      <header><h3>${titulo}</h3><button class="cerrar" aria-label="Cerrar">×</button></header>
      <div class="cuerpo">${cuerpo}</div>${pie ? `<footer>${pie}</footer>` : ""}
    </section>`;
  $("#modal-raiz").appendChild(capa);
  const v = $(".ventana", capa);
  v.cerrar = () => capa.remove();
  $(".cerrar", capa).onclick = v.cerrar;
  capa.addEventListener("mousedown", (ev) => { if (ev.target === capa) v.cerrar(); });
  return v;
}
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") cerrarVentana(); });

/* campos: [{k, e (etiqueta), t: texto|numero|dinero|fecha|select|nota|clave, v, op:[[valor,texto]], nota, req, lista}] */
function formulario({ titulo, intro = "", campos, textoGuardar = "Guardar", clase = "", guardar }) {
  const html = campos.map((c) => {
    const id = "c_" + c.k;
    const v = c.v ?? "";
    let control;
    if (c.t === "select") {
      control = `<select id="${id}">${c.op.map(([val, txt]) => `<option value="${h(val)}" ${String(val) === String(v) ? "selected" : ""}>${h(txt)}</option>`).join("")}</select>`;
    } else if (c.t === "nota") {
      control = `<textarea id="${id}">${h(v)}</textarea>`;
    } else {
      const tipo = { numero: "number", dinero: "number", fecha: "datetime-local", clave: "password" }[c.t] || "text";
      const extra = c.t === "dinero" ? 'min="0" step="1000" inputmode="numeric"' : c.t === "numero" ? `min="${c.min ?? 0}" step="${c.paso ?? 1}" inputmode="decimal"` : "";
      const valor = c.t === "fecha" ? aInput(v) : v;
      control = `<input id="${id}" type="${tipo}" ${extra} value="${h(valor)}" ${c.lista ? `list="${id}_l"` : ""} autocomplete="${c.t === "clave" ? "new-password" : "off"}">`
        + (c.lista ? `<datalist id="${id}_l">${c.lista.map((x) => `<option value="${h(x)}">`).join("")}</datalist>` : "");
    }
    return `<div class="campo" data-k="${c.k}"><label for="${id}">${h(c.e)}${c.req ? " *" : ""}</label>${control}${c.nota ? `<div class="nota">${h(c.nota)}</div>` : ""}</div>`;
  }).join("");
  const v = abrirVentana({
    titulo,
    cuerpo: `${intro}<div class="error-campo oculto" role="alert"></div><form id="form-v" novalidate>${html}<button type="submit" class="oculto"></button></form>`,
    pie: `<button class="btn claro" data-cancelar>Cancelar</button><button class="btn ${clase}" data-guardar>${h(textoGuardar)}</button>`,
  });
  const leer = () => Object.fromEntries(campos.map((c) => {
    const el = $("#c_" + c.k, v);
    let val = el.value;
    if (c.t === "fecha") val = deInput(val);
    if (c.t === "numero" || c.t === "dinero") val = val === "" ? null : Number(val);
    if (typeof val === "string" && c.t !== "clave") val = val.trim();
    return [c.k, val];
  }));
  const enviar = async () => {
    const valores = leer();
    const vacio = campos.find((c) => c.req && (valores[c.k] === null || valores[c.k] === ""));
    const err = $(".error-campo", v);
    if (vacio) { err.textContent = `Falta: ${vacio.e}.`; err.classList.remove("oculto"); $("#c_" + vacio.k, v).focus(); return; }
    const btn = $("[data-guardar]", v);
    btn.disabled = true;
    try {
      await guardar(valores);
      v.cerrar();
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove("oculto");
      err.scrollIntoView({ block: "nearest" });
    } finally { btn.disabled = false; }
  };
  $("[data-cancelar]", v).onclick = v.cerrar;
  $("[data-guardar]", v).onclick = enviar;
  $("#form-v", v).onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  const primero = $("input, select, textarea", v);
  if (primero) primero.focus();   // de una vez: con retraso podía robarle el foco a lo que la persona ya escribía
  return v;
}

function pedirMotivo({ titulo, mensaje, textoBoton, clase = "peligro", accion }) {
  formulario({
    titulo, intro: `<p>${mensaje}</p>`, textoGuardar: textoBoton, clase,
    campos: [{ k: "motivo", e: "Motivo", t: "nota", req: true, nota: "Queda guardado en el registro, con su nombre y la hora." }],
    guardar: (v) => accion(v.motivo),
  });
}

// ----------------------------------------------------------------- semáforo
const SEM_EQUIPO = {
  bodega: ["En bodega", "verde"], parte: ["Parte afuera", "amarillo"], fuera: ["Alquilado", "naranja"],
  vencido: ["Afuera y vencido", "rojo"], baja: ["De baja", "gris"],
};
const chip = ([texto, color]) => `<span class="estado ${color}">${h(texto)}</span>`;

function enriquecerEquipo(e) {
  const ahora = E.ahora || ahoraLocal();
  const vencido = e.afuera.some((a) => a.fecha_prevista && a.fecha_prevista < ahora);
  e.semaforo = e.estado === "baja" ? "baja" : !e.afuera.length ? "bodega"
    : vencido ? "vencido" : e.disponible <= 0 ? "fuera" : "parte";
  const grupos = new Map();
  for (const a of e.afuera) {
    const g = grupos.get(a.numero) || { ...a, cantidad: 0 };
    g.cantidad += a.cantidad;
    grupos.set(a.numero, g);
  }
  e.donde = [...grupos.values()];
  return e;
}
const textoDonde = (e) => (e.semaforo === "baja" ? "Dado de baja" : !e.donde.length ? "En bodega"
  : e.donde.map((g) => `${e.control === "cantidad" ? g.cantidad + " con " : "Con "}${g.cliente} (${g.numero})${g.fecha_prevista ? ", vuelve " + g.fecha_prevista : ""}`).join("; "));

// ------------------------------------------------------------------- sesión
async function entrar(usuario, clave) {
  const r = await api("bod_login", { p_usuario: usuario, p_clave: clave }, false);
  if (!r.ok) throw new ErrorApi(r.error, "LOGIN");
  E.sesion = r.token;
  guardado.escribir("bodega_sesion", r.token);
  await cargarYo();
}

async function cargarYo() {
  const r = await api("bod_yo");
  E.usuario = r.usuario;
  E.config = r.config || {};
  E.cambios = null;
}

function cerrarSesion(mensaje) {
  if (E.sesion) api("bod_logout").catch(() => {});
  E.sesion = null; E.usuario = null;
  guardado.escribir("bodega_sesion", null);
  cerrarTodas();
  pantallaIngreso(mensaje);
}

function pantallaIngreso(mensaje = "") {
  document.title = "Bodega — Ingreso";
  const sinClave = !CFG.clave || CFG.clave.startsWith("PEGUE");
  $("#app").innerHTML = `
    <div class="ingreso"><div class="tarjeta"><div class="franja"></div>
      <form id="f-ingreso" autocomplete="on">
        <h1>Bodega</h1>
        <p>Ingrese con su usuario y contraseña.</p>
        <div class="error-campo ${mensaje || sinClave ? "" : "oculto"}" role="alert">${sinClave
          ? "Falta configurar la página: ponga la clave publishable de Supabase en config.js." : h(mensaje)}</div>
        <div class="campo"><label for="i-usuario">Usuario</label>
          <input id="i-usuario" type="text" autocapitalize="none" autocomplete="username" required></div>
        <div class="campo"><label for="i-clave">Contraseña</label>
          <input id="i-clave" type="password" autocomplete="current-password" required></div>
        <button class="btn" type="submit">Ingresar</button>
      </form></div></div>`;
  $("#i-usuario").focus();
  $("#f-ingreso").onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("#f-ingreso .btn");
    const err = $("#f-ingreso .error-campo");
    btn.disabled = true;
    try {
      await entrar($("#i-usuario").value, $("#i-clave").value);
      iniciarApp();
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove("oculto");
      $("#i-clave").select();
    } finally { btn.disabled = false; }
  };
}

// ------------------------------------------------------------ estructura y rutas
// movil: true = va en la barra de abajo del celular; las demás quedan en «Más»
const VISTAS = {
  inicio: { titulo: "Inicio", icono: ICONOS.inicio, ver: () => true, movil: true },
  alquileres: { titulo: "Alquileres", icono: ICONOS.alquiler, ver: () => true, movil: true },
  inventario: { titulo: "Inventario", icono: ICONOS.inventario, ver: () => true, movil: true },
  clientes: { titulo: "Clientes", icono: ICONOS.clientes, ver: () => true, movil: true },
  cotizaciones: { titulo: "Cotizaciones", icono: ICONOS.cotizacion, ver: () => puede("cotizaciones") || puede("alq_crear") },
  facturas: { titulo: "Facturas", icono: ICONOS.factura, ver: () => puede("fac_ver") },
  usuarios: { titulo: "Usuarios", icono: ICONOS.usuarios, ver: () => puede("usuarios") },
  config: { titulo: "Configuración", icono: ICONOS.config, ver: () => puede("config") },
  papelera: { titulo: "Papelera", icono: ICONOS.papelera, ver: () => puede("super") || puede("eliminar") },
  registro: { titulo: "Registro", icono: ICONOS.registro, ver: () => puede("super") || puede("usuarios") || puede("eliminar") },
  mas: { titulo: "Más", icono: ICONOS.mas3, ver: () => true, soloMovil: true },
  cuenta: { titulo: "Mi cuenta", ver: () => true, sinMenu: true },
};

function iniciarApp() {
  const nombre = E.config.empresa_nombre || "Bodega";
  document.title = nombre;
  $("#app").innerHTML = `
    <header class="cabecera">
      <div class="marca">${h(nombre)}<small>Inventario y alquileres</small></div>
      <div id="luz" class="luz" role="status"></div>
      <button class="usuario-btn" id="b-cuenta" title="Mi cuenta">${h(E.usuario.nombre)}</button>
    </header>
    <div class="franja"></div>
    <div id="aviso-red" class="aviso-red oculto">Sin conexión a internet. No se puede guardar ni ver cambios hasta que vuelva; la página sigue intentando sola.</div>
    <nav class="nav" id="nav" aria-label="Secciones"></nav>
    <main id="vista"></main>`;
  $("#b-cuenta").onclick = () => { location.hash = "#cuenta"; };
  $("#nav").innerHTML = Object.entries(VISTAS).filter(([, v]) => v.ver() && !v.sinMenu)
    .map(([k, v]) => `<a href="#${k}" data-v="${k}" class="${v.movil ? "en-movil" : v.soloMovil ? "solo-movil" : ""}">${v.icono}<span>${v.titulo}</span></a>`).join("");
  pintarLuz();
  irA();
}

window.addEventListener("hashchange", () => { if (E.usuario) irA(); });

function irA() {
  let k = location.hash.slice(1) || "inicio";
  if (!VISTAS[k] || !VISTAS[k].ver()) k = "inicio";
  if (E.usuario.debe_cambiar_clave) k = "cuenta";
  E.vista = k;
  document.querySelectorAll("#nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.v === k ? "page" : "false"));
  $("#nav").classList.toggle("oculto", !!E.usuario.debe_cambiar_clave);
  cerrarTodas();
  PAGINAS[k].montar($("#vista"));
  refrescar();
}

async function refrescar() {
  if (!E.usuario || !E.vista) return;
  const p = PAGINAS[E.vista];
  if (!p.actualizar) return;
  try { await p.actualizar(); } catch (e) { if (e.codigo !== "RED" && e.codigo !== "BS401") avisar(e.message, true); }
  document.querySelectorAll("#modal-raiz .ventana").forEach((v) => { if (v.refrescar) v.refrescar().catch(() => {}); });
}

// latido: cada 5 s revisa la conexión y si otro computador guardó algo
setInterval(async () => {
  if (!E.sesion || !E.usuario || document.hidden) return;
  try {
    const r = await api("bod_latido");
    E.ahora = r.hora;
    if (E.cambios !== null && r.cambios !== E.cambios) refrescar();
    E.cambios = r.cambios;
  } catch { /* la luz ya muestra el problema */ }
}, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && E.usuario) refrescar(); });

// ================================================================== páginas
const PAGINAS = {};

// ------------------------------------------------------------------- Inicio
PAGINAS.inicio = {
  montar(raiz) {
    raiz.innerHTML = `<h1>Hoy en la bodega</h1><div class="placas" id="placas"></div>
      <h2 id="t-afuera"></h2><div id="lista"></div>`;
  },
  async actualizar() {
    const r = await api("bod_resumen");
    E.ahora = r.ahora;
    const sem = (a) => (a.fecha_prevista && a.fecha_prevista < r.ahora ? "vencido"
      : a.fecha_prevista && a.fecha_prevista.slice(0, 10) === r.ahora.slice(0, 10) ? "hoy" : "fuera");
    r.abiertos.forEach((a) => { a.sem = sem(a); });
    const orden = { vencido: 0, hoy: 1, fuera: 2 };
    r.abiertos.sort((a, b) => orden[a.sem] - orden[b.sem] || String(a.fecha_prevista || "9").localeCompare(String(b.fecha_prevista || "9")));
    const vencidos = r.abiertos.filter((a) => a.sem === "vencido").length;
    const placas = [
      ["verde", r.en_bodega, "Unidades en bodega"],
      ["naranja", r.afuera, "Unidades alquiladas"],
      ["rojo", vencidos, vencidos === 1 ? "Alquiler vencido" : "Alquileres vencidos"],
      ["amarillo", r.por_facturar, "Devueltos sin facturar"],
    ];
    if (r.por_cobrar) placas.push(["amarillo", r.por_cobrar.n, "Facturas por cobrar", pesos(r.por_cobrar.total)]);
    $("#placas").innerHTML = placas.map(([c, n, t, extra]) => `<div class="placa ${c}"><b>${num(n)}</b><span>${t}</span>${extra ? `<small>${extra}</small>` : ""}</div>`).join("");
    $("#t-afuera").textContent = r.abiertos.length ? "Equipos que están con clientes" : "Todo está en bodega";
    if (!r.abiertos.length) {
      $("#lista").innerHTML = '<div class="vacio">No hay equipos afuera en este momento.</div>';
      return;
    }
    const ETQ = { vencido: ["Vencido: llamar", "rojo"], hoy: ["Vuelve hoy", "amarillo"], fuera: ["Afuera, en plazo", "naranja"] };
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Estado</th><th>Cliente</th><th>Qué tiene</th><th>Salió</th><th>Debe volver</th></tr></thead><tbody>
      ${r.abiertos.map((a, i) => `<tr data-i="${i}">
        <td class="sin-titulo">${chip(ETQ[a.sem])}</td>
        <td data-t="Cliente"><span><span class="principal">${h(a.cliente)}</span><br><span class="sec">${h(a.numero)}${a.telefono ? ", tel. " + h(a.telefono) : ""}</span></span></td>
        <td data-t="Qué tiene">${h(a.equipos)}</td><td data-t="Salió">${h(a.fecha_salida)}</td>
        <td data-t="Debe volver">${h(a.fecha_prevista || "Sin fecha")}</td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => {
      tr.onclick = () => abrirAlquiler(r.abiertos[tr.dataset.i].id);
    });
  },
};

// --------------------------------------------------------------- Inventario
PAGINAS.inventario = {
  montar(raiz) {
    const ui = (E.ui.inventario ||= { buscar: "", filtro: "todos", bajas: false });
    raiz.innerHTML = `<h1>Inventario</h1>
      <div class="barra">
        <input class="buscar" type="search" id="buscar" placeholder="Buscar por nombre, código o categoría" value="${h(ui.buscar)}">
        <label><input type="checkbox" id="bajas" ${ui.bajas ? "checked" : ""}> Ver dados de baja</label>
        ${puede("inv_editar") ? `<button class="btn" id="b-nuevo">${ICONOS.mas} Nuevo equipo</button>` : ""}
      </div>
      <div class="filtros" id="filtros" role="group" aria-label="Mostrar"></div>
      <div id="lista"></div>`;
    $("#buscar").oninput = (ev) => { ui.buscar = ev.target.value; this.pintar(); };
    $("#bajas").onchange = (ev) => { ui.bajas = ev.target.checked; if (!ui.bajas && ui.filtro === "baja") ui.filtro = "todos"; refrescar(); };
    if ($("#b-nuevo")) $("#b-nuevo").onclick = () => formEquipo();
  },
  async actualizar() {
    const ui = E.ui.inventario;
    E.datos.equipos = (await api("bod_equipos", { p_bajas: ui.bajas })).map(enriquecerEquipo);
    this.pintar();
  },
  pintar() {
    const ui = E.ui.inventario;
    const todos = E.datos.equipos || [];
    const q = ui.buscar.toLowerCase();
    const coinciden = todos.filter((e) => !q || [e.nombre, e.codigo, e.categoria, e.serial].some((x) => String(x || "").toLowerCase().includes(q)));
    const cuenta = (k) => coinciden.filter((e) => e.semaforo === k).length;
    $("#filtros").innerHTML = `<button class="estado todos" data-f="todos" aria-pressed="${ui.filtro === "todos"}">Todos (${coinciden.length})</button>`
      + Object.entries(SEM_EQUIPO).filter(([k]) => k !== "baja" || ui.bajas)
        .map(([k, [t, c]]) => `<button class="estado ${c}" data-f="${k}" aria-pressed="${ui.filtro === k}">${t} (${cuenta(k)})</button>`).join("");
    document.querySelectorAll("#filtros button").forEach((b) => { b.onclick = () => { ui.filtro = b.dataset.f; this.pintar(); }; });
    const filas = coinciden.filter((e) => ui.filtro === "todos" || e.semaforo === ui.filtro);
    if (!filas.length) {
      $("#lista").innerHTML = `<div class="vacio">${todos.length ? "Ningún equipo coincide con la búsqueda." : "Todavía no hay equipos. Use «Nuevo equipo» para registrar el primero."}</div>`;
      return;
    }
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Estado</th><th>Equipo</th><th>¿Dónde está?</th>
      <th class="num">En bodega</th><th class="num">Afuera</th><th class="num">Por hora</th><th class="num">Por día</th></tr></thead><tbody>
      ${filas.map((e) => `<tr data-id="${e.id}">
        <td class="sin-titulo">${chip(SEM_EQUIPO[e.semaforo])}</td>
        <td data-t="Equipo"><span><span class="principal">${h(e.nombre)}</span><br><span class="sec">${h(e.codigo)}${e.categoria ? ", " + h(e.categoria) : ""}</span></span></td>
        <td data-t="¿Dónde está?">${h(textoDonde(e))}</td>
        <td data-t="En bodega" class="num">${e.disponible}${e.control === "cantidad" ? ` de ${e.cantidad_total}` : ""}</td>
        <td data-t="Afuera" class="num">${e.alquilado}</td>
        <td data-t="Por hora" class="num">${e.tarifa_hora ? pesos(e.tarifa_hora) : "—"}</td>
        <td data-t="Por día" class="num">${e.tarifa_dia ? pesos(e.tarifa_dia) : "—"}</td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => {
      tr.onclick = () => fichaEquipo(E.datos.equipos.find((e) => e.id === Number(tr.dataset.id)));
    });
  },
};

const categorias = () => [...new Set((E.datos.equipos || []).map((e) => e.categoria).filter(Boolean))].sort();

async function fichaEquipo(e) {
  const unidad = e.control === "unidad";
  const acciones = [];
  if (puede("inv_editar")) acciones.push('<button class="btn" data-a="editar">Editar datos y tarifas</button>');
  if (puede("inv_ingresar") && (!unidad || e.estado === "baja")) {
    acciones.push(`<button class="btn claro" data-a="ingresar">${unidad ? "Reactivar" : "Ingresar unidades"}</button>`);
  }
  if (puede("inv_baja") && e.estado === "activo") acciones.push('<button class="btn claro" data-a="baja">Dar de baja</button>');
  if (puede("eliminar") || puede("super")) acciones.push('<button class="btn peligro" data-a="eliminar">Eliminar</button>');
  const v = abrirVentana({
    titulo: h(e.nombre),
    cuerpo: `${chip(SEM_EQUIPO[e.semaforo])}
      <dl class="ficha" style="margin-top:12px">
        <dt>Código</dt><dd>${h(e.codigo)}</dd>
        <dt>Categoría</dt><dd>${h(e.categoria || "—")}</dd>
        <dt>Se controla</dt><dd>${unidad ? "Por unidad" : "Por cantidad"}</dd>
        ${e.serial ? `<dt>Serial o placa</dt><dd>${h(e.serial)}</dd>` : ""}
        <dt>En bodega</dt><dd>${e.disponible} de ${e.cantidad_total}</dd>
        <dt>Por hora</dt><dd>${e.tarifa_hora ? pesos(e.tarifa_hora) : "Sin tarifa"}</dd>
        <dt>Por día</dt><dd>${e.tarifa_dia ? pesos(e.tarifa_dia) : "Sin tarifa"}</dd>
        <dt>Ingresó</dt><dd>${h(e.fecha_ingreso)}</dd>
        ${e.fecha_baja ? `<dt>De baja desde</dt><dd>${h(e.fecha_baja)}</dd>` : ""}
        ${e.notas ? `<dt>Notas</dt><dd>${h(e.notas)}</dd>` : ""}
        <dt>¿Dónde está?</dt><dd>${h(textoDonde(e))}</dd>
      </dl>
      <div class="acciones">${acciones.join("")}</div>
      ${puede("super") ? `<div class="zona-super"><p>Superusuario: corrige cualquier dato, incluida la cantidad total, el estado y las fechas. Queda en el registro.</p>
        <button class="btn super" data-a="total">Edición total</button></div>` : ""}
      <h2>Historial de ingresos y bajas</h2><ul class="historial" id="historial"><li>Cargando…</li></ul>`,
  });
  v.querySelectorAll("[data-a]").forEach((b) => {
    b.onclick = () => (v.cerrar(), {
      editar: () => formEquipo(e), ingresar: () => formIngreso(e), baja: () => formBaja(e), total: () => formEquipoTotal(e),
      eliminar: () => pedirMotivo({
        titulo: `Eliminar ${h(e.nombre)}`,
        mensaje: "El equipo se va a la papelera; desde ahí se puede restaurar. Si ya se usó en cotizaciones o alquileres no se puede eliminar: en ese caso dele de baja.",
        textoBoton: "Eliminar", accion: async (motivo) => {
          await api("bod_eliminar", { p_tipo: "equipo", p_id: e.id, p_motivo: motivo });
          avisar("Equipo enviado a la papelera."); refrescar();
        },
      }),
    })[b.dataset.a]();
  });
  try {
    const movs = await api("bod_movimientos", { p_equipo: e.id });
    const lista = $("#historial", v);
    if (lista) {
      lista.innerHTML = movs.map((m) => `<li><span class="${m.tipo}">${m.tipo === "baja" ? "Baja" : "Ingreso"} de ${m.cantidad}</span>
        <span>${h(m.motivo || "")}<br><span class="sec" style="color:var(--suave)">${h(m.usuario || "")}</span></span><span>${h(m.fecha)}</span></li>`).join("")
        || "<li>Sin movimientos.</li>";
    }
  } catch { /* la ventana pudo cerrarse */ }
}

function formEquipo(e = null) {
  const nuevo = !e;
  const campos = [
    { k: "codigo", e: "Código", v: e?.codigo, req: true },
    { k: "nombre", e: "Nombre", v: e?.nombre, req: true },
    { k: "categoria", e: "Categoría", v: e?.categoria, lista: categorias(), nota: "Por ejemplo: Maquinaria pesada, Formaletas, Concreto." },
  ];
  if (nuevo) {
    campos.push({ k: "control", e: "¿Cómo se controla?", t: "select", v: "unidad",
      op: [["unidad", "Por unidad: una máquina con su serial"], ["cantidad", "Por cantidad: formaletas, herramienta menor"]] });
    campos.push({ k: "cantidad", e: "Cantidad inicial", t: "numero", v: 1, min: 1, nota: "Solo cuenta para equipos por cantidad." });
    campos.push({ k: "fecha_ingreso", e: "Fecha de ingreso", t: "fecha", v: ahoraLocal() });
  }
  campos.push({ k: "serial", e: "Serial o placa", v: e?.serial },
    { k: "tarifa_hora", e: "Valor por hora", t: "dinero", v: e?.tarifa_hora ?? 0 },
    { k: "tarifa_dia", e: "Valor por día", t: "dinero", v: e?.tarifa_dia ?? 0 },
    { k: "notas", e: "Notas", t: "nota", v: e?.notas });
  formulario({
    titulo: nuevo ? "Nuevo equipo" : `Editar ${h(e.nombre)}`, campos,
    textoGuardar: nuevo ? "Registrar equipo" : "Guardar cambios",
    guardar: async (d) => {
      await api("bod_equipo_guardar", { p_id: e?.id ?? null, p_datos: d });
      avisar(nuevo ? "Equipo registrado." : "Cambios guardados."); refrescar();
    },
  });
}

function formIngreso(e) {
  const unidad = e.control === "unidad";
  formulario({
    titulo: unidad ? `Reactivar ${h(e.nombre)}` : `Ingresar unidades de ${h(e.nombre)}`,
    textoGuardar: unidad ? "Reactivar" : "Ingresar",
    campos: [
      ...(unidad ? [] : [{ k: "cantidad", e: "Cantidad que entra", t: "numero", v: 1, min: 1, req: true }]),
      { k: "fecha", e: "Fecha", t: "fecha", v: ahoraLocal() },
      { k: "motivo", e: "Detalle", v: "", nota: unidad ? "Por ejemplo: reparada, apareció." : "Por ejemplo: compra, devolución de un préstamo." },
    ],
    guardar: async (d) => {
      await api("bod_equipo_ingresar", { p_id: e.id, p_cantidad: unidad ? 1 : d.cantidad, p_fecha: d.fecha, p_motivo: d.motivo });
      avisar(unidad ? "Equipo reactivado." : "Unidades ingresadas."); refrescar();
    },
  });
}

function formBaja(e) {
  const unidad = e.control === "unidad";
  formulario({
    titulo: `Dar de baja ${h(e.nombre)}`, textoGuardar: "Dar de baja", clase: "peligro",
    intro: `<p>Hay ${e.disponible} en bodega. Lo que está alquilado se da de baja al recibirlo, marcándolo como dañado.</p>`,
    campos: [
      ...(unidad ? [] : [{ k: "cantidad", e: "Cantidad", t: "numero", v: 1, min: 1, req: true }]),
      { k: "fecha", e: "Fecha", t: "fecha", v: ahoraLocal() },
      { k: "motivo", e: "Motivo", t: "nota", req: true, nota: "Daño, pérdida, robo, venta…" },
    ],
    guardar: async (d) => {
      await api("bod_equipo_baja", { p_id: e.id, p_cantidad: unidad ? 1 : d.cantidad, p_fecha: d.fecha, p_motivo: d.motivo });
      avisar("Baja registrada."); refrescar();
    },
  });
}

function formEquipoTotal(e) {
  const campos = [
    { k: "codigo", e: "Código", v: e.codigo, req: true }, { k: "nombre", e: "Nombre", v: e.nombre, req: true },
    { k: "categoria", e: "Categoría", v: e.categoria, lista: categorias() }, { k: "serial", e: "Serial o placa", v: e.serial },
    { k: "cantidad_total", e: "Cantidad total", t: "numero", v: e.cantidad_total, nota: `Ahora hay ${e.alquilado} afuera; no puede quedar por debajo de eso.` },
    { k: "tarifa_hora", e: "Valor por hora", t: "dinero", v: e.tarifa_hora }, { k: "tarifa_dia", e: "Valor por día", t: "dinero", v: e.tarifa_dia },
    { k: "estado", e: "Estado", t: "select", v: e.estado, op: [["activo", "Activo"], ["baja", "De baja"]] },
    { k: "fecha_ingreso", e: "Fecha de ingreso", t: "fecha", v: e.fecha_ingreso },
    { k: "fecha_baja", e: "Fecha de baja", t: "fecha", v: e.fecha_baja },
    { k: "notas", e: "Notas", t: "nota", v: e.notas },
    { k: "motivo", e: "Motivo del cambio", t: "nota", req: true },
  ];
  formulario({
    titulo: `Edición total: ${h(e.nombre)}`, textoGuardar: "Guardar con mi firma", clase: "super",
    intro: "<p>Solo se guardan los campos que cambie. Queda anotado qué tenía antes, qué quedó y su motivo.</p>",
    campos,
    guardar: async (d) => {
      const cambios = {};
      for (const c of campos) {
        if (c.k === "motivo") continue;
        const antes = e[c.k] ?? (c.t === "numero" || c.t === "dinero" ? 0 : "");
        let ahora = d[c.k];
        if (c.k === "codigo") ahora = String(ahora).toUpperCase();
        if (c.k === "fecha_baja" && !ahora) ahora = null;
        if (String(ahora ?? "") !== String(antes ?? "")) cambios[c.k] = ahora;
      }
      if (!Object.keys(cambios).length) throw new ErrorApi("No cambió ningún dato.", "X");
      await api("bod_super_editar", { p_tabla: "equipos", p_id: e.id, p_cambios: cambios, p_motivo: d.motivo });
      avisar("Cambio guardado y anotado en el registro."); refrescar();
    },
  });
}

// ------------------------------------------------------------------ Clientes
PAGINAS.clientes = {
  montar(raiz) {
    const ui = (E.ui.clientes ||= { buscar: "" });
    raiz.innerHTML = `<h1>Clientes</h1>
      <div class="barra">
        <input class="buscar" type="search" id="buscar" placeholder="Buscar por nombre, documento o teléfono" value="${h(ui.buscar)}">
        ${puede("clientes") ? `<button class="btn" id="b-nuevo">${ICONOS.mas} Nuevo cliente</button>` : ""}
      </div><div id="lista"></div>`;
    $("#buscar").oninput = (ev) => { ui.buscar = ev.target.value; this.pintar(); };
    if ($("#b-nuevo")) $("#b-nuevo").onclick = () => formCliente();
  },
  async actualizar() {
    E.datos.clientes = await api("bod_clientes");
    this.pintar();
  },
  pintar() {
    const q = E.ui.clientes.buscar.toLowerCase();
    const todos = E.datos.clientes || [];
    const filas = todos.filter((c) => !q || [c.nombre, c.documento, c.telefono].some((x) => String(x || "").toLowerCase().includes(q)));
    if (!filas.length) {
      $("#lista").innerHTML = `<div class="vacio">${todos.length ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes. Use «Nuevo cliente» para registrar el primero."}</div>`;
      return;
    }
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Dirección</th><th>Ahora</th></tr></thead><tbody>
      ${filas.map((c) => `<tr data-id="${c.id}">
        <td class="sin-titulo"><span><span class="principal">${h(c.nombre)}</span><br><span class="sec">${h(c.tipo_doc)} ${h(c.documento)}</span></span></td>
        <td data-t="Teléfono">${h(c.telefono || "—")}</td><td data-t="Dirección">${h(c.direccion || "—")}</td>
        <td data-t="Ahora">${c.abiertos ? chip([`${c.abiertos} alquiler${c.abiertos > 1 ? "es" : ""} abierto${c.abiertos > 1 ? "s" : ""}`, "naranja"]) : chip(["Sin equipos", "gris"])}</td></tr>`).join("")}
      </tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => {
      tr.onclick = () => fichaCliente(E.datos.clientes.find((c) => c.id === Number(tr.dataset.id)));
    });
  },
};

function fichaCliente(c) {
  const v = abrirVentana({
    titulo: h(c.nombre),
    cuerpo: `<dl class="ficha">
        <dt>Documento</dt><dd>${h(c.tipo_doc)} ${h(c.documento)}</dd>
        <dt>Teléfono</dt><dd>${h(c.telefono || "—")}</dd><dt>Dirección</dt><dd>${h(c.direccion || "—")}</dd>
        <dt>Correo</dt><dd>${h(c.email || "—")}</dd><dt>Cliente desde</dt><dd>${h(c.creado)}</dd>
        <dt>Alquileres abiertos</dt><dd>${c.abiertos}</dd></dl>
      <div class="acciones">${telefonoLinks(c.telefono)}
        ${puede("clientes") ? '<button class="btn" data-a="editar">Editar datos</button>' : ""}
        ${puede("eliminar") || puede("super") ? '<button class="btn peligro" data-a="eliminar">Eliminar</button>' : ""}</div>`,
  });
  const b = (a) => $(`[data-a="${a}"]`, v);
  if (b("editar")) b("editar").onclick = () => formCliente(c);
  if (b("eliminar")) {
    b("eliminar").onclick = () => pedirMotivo({
      titulo: `Eliminar ${h(c.nombre)}`,
      mensaje: "El cliente se va a la papelera. Si tiene cotizaciones, alquileres o facturas no se puede eliminar; sus datos sí se pueden corregir.",
      textoBoton: "Eliminar", accion: async (motivo) => {
        await api("bod_eliminar", { p_tipo: "cliente", p_id: c.id, p_motivo: motivo });
        avisar("Cliente enviado a la papelera."); refrescar();
      },
    });
  }
}

function formCliente(c = null, alGuardar = null) {
  formulario({
    titulo: c ? `Editar ${h(c.nombre)}` : "Nuevo cliente", textoGuardar: c ? "Guardar cambios" : "Registrar cliente",
    campos: [
      { k: "tipo_doc", e: "Tipo de documento", t: "select", v: c?.tipo_doc || "CC",
        op: [["CC", "Cédula de ciudadanía"], ["NIT", "NIT"], ["CE", "Cédula de extranjería"]] },
      { k: "documento", e: "Número de documento", v: c?.documento, req: true },
      { k: "nombre", e: "Nombre o razón social", v: c?.nombre, req: true },
      { k: "telefono", e: "Teléfono", v: c?.telefono, nota: "Con este número se le puede llamar o escribir por WhatsApp desde la página." },
      { k: "direccion", e: "Dirección", v: c?.direccion }, { k: "email", e: "Correo", v: c?.email },
    ],
    guardar: async (d) => {
      const r = await api("bod_cliente_guardar", { p_id: c?.id ?? null, p_datos: d });
      avisar(c ? "Cambios guardados." : "Cliente registrado."); refrescar();
      if (alGuardar) await alGuardar(r.id);
    },
  });
}

// ------------------------------------------------------------------ Papelera
const TIPOS = { equipo: "Equipo", cliente: "Cliente", cotizacion: "Cotización", alquiler: "Alquiler", factura: "Factura", usuario: "Usuario" };
PAGINAS.papelera = {
  montar(raiz) {
    raiz.innerHTML = `<h1>Papelera</h1>
      <p class="ayuda">Lo que se elimina queda aquí y se puede restaurar tal como estaba.${puede("super") ? " Solo el superusuario puede borrarlo para siempre." : ""}</p>
      <div class="barra">${puede("super") ? '<button class="btn peligro" id="b-vaciar">Vaciar papelera</button>' : ""}</div>
      <div id="lista"></div>`;
    if ($("#b-vaciar")) {
      $("#b-vaciar").onclick = () => {
        const v = abrirVentana({
          titulo: "Vaciar papelera",
          cuerpo: "<p>Todo lo que está en la papelera se borra para siempre y ya no se podrá restaurar.</p>",
          pie: '<button class="btn claro" data-no>Cancelar</button><button class="btn peligro" data-si>Borrar todo para siempre</button>',
        });
        $("[data-no]", v).onclick = cerrarVentana;
        $("[data-si]", v).onclick = async () => {
          try { await api("bod_vaciar_papelera", { p_id: null }); cerrarVentana(); avisar("Papelera vacía."); refrescar(); } catch (e) { avisar(e.message, true); }
        };
      };
    }
  },
  async actualizar() {
    const filas = await api("bod_papelera");
    if (!filas.length) { $("#lista").innerHTML = '<div class="vacio">La papelera está vacía.</div>'; return; }
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Qué</th><th>Eliminado</th><th>Motivo</th><th></th></tr></thead><tbody>
      ${filas.map((p) => `<tr data-id="${p.id}">
        <td class="sin-titulo"><span><span class="principal">${h(TIPOS[p.tipo] || p.tipo)}: ${h(p.titulo)}</span></span></td>
        <td data-t="Eliminado"><span>${h(p.fecha)}<br><span class="sec">${h(p.usuario)}</span></span></td>
        <td data-t="Motivo">${h(p.motivo)}</td>
        <td class="sin-titulo"><span class="acciones" style="margin:0"><button class="btn claro" data-r="${p.id}">Restaurar</button>
          ${puede("super") ? `<button class="btn peligro" data-b="${p.id}">Borrar</button>` : ""}</span></td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-r]").forEach((b) => {
      b.onclick = async (ev) => {
        ev.stopPropagation();
        try { await api("bod_restaurar", { p_id: Number(b.dataset.r) }); avisar("Restaurado."); refrescar(); } catch (e) { avisar(e.message, true); }
      };
    });
    document.querySelectorAll("[data-b]").forEach((b) => {
      b.onclick = async (ev) => {
        ev.stopPropagation();
        if (!confirm("¿Borrar para siempre? Ya no se podrá restaurar.")) return;
        try { await api("bod_vaciar_papelera", { p_id: Number(b.dataset.b) }); avisar("Borrado para siempre."); refrescar(); } catch (e) { avisar(e.message, true); }
      };
    });
  },
};

// ------------------------------------------------------------------ Registro
PAGINAS.registro = {
  montar(raiz) {
    const ui = (E.ui.registro ||= { buscar: "" });
    raiz.innerHTML = `<h1>Registro de cambios</h1>
      <p class="ayuda">Quién eliminó, restauró o corrigió algo con edición total, cuándo y por qué.</p>
      <div class="barra"><input class="buscar" type="search" id="buscar" placeholder="Buscar por persona, acción o dato" value="${h(ui.buscar)}"></div>
      <div id="lista"></div>`;
    $("#buscar").oninput = (ev) => { ui.buscar = ev.target.value; this.pintar(); };
  },
  async actualizar() { E.datos.registro = await api("bod_auditoria"); this.pintar(); },
  pintar() {
    const q = E.ui.registro.buscar.toLowerCase();
    const filas = (E.datos.registro || []).filter((r) => !q || `${r.usuario} ${r.accion} ${r.detalle}`.toLowerCase().includes(q));
    $("#lista").innerHTML = filas.length ? `<table class="tabla"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué hizo</th><th>Detalle</th></tr></thead><tbody>
      ${filas.map((r) => `<tr><td data-t="Cuándo">${h(r.fecha)}</td><td data-t="Quién">${h(r.usuario)}</td>
        <td data-t="Qué hizo"><b>${h(r.accion)}</b></td><td data-t="Detalle">${h(r.detalle)}</td></tr>`).join("")}</tbody></table>`
      : '<div class="vacio">Todavía no hay nada en el registro.</div>';
  },
};

// ----------------------------------------------------------------- Mi cuenta
PAGINAS.cuenta = {
  montar(raiz) {
    const obligado = E.usuario.debe_cambiar_clave;
    raiz.innerHTML = `<h1>${obligado ? "Cree su contraseña" : "Mi cuenta"}</h1>
      ${obligado ? '<p class="ayuda">Está usando una contraseña temporal. Cree una propia para continuar; nadie más la conocerá.</p>' : ""}
      <dl class="ficha"><dt>Nombre</dt><dd>${h(E.usuario.nombre)}</dd><dt>Usuario</dt><dd>${h(E.usuario.usuario)}</dd></dl>
      <form id="f-clave" style="max-width:420px">
        <div class="error-campo oculto" role="alert"></div>
        <div class="campo"><label for="k-actual">Contraseña actual</label><input id="k-actual" type="password" autocomplete="current-password"></div>
        <div class="campo"><label for="k-nueva">Contraseña nueva</label><input id="k-nueva" type="password" autocomplete="new-password">
          <div class="nota">Mínimo 6 caracteres.</div></div>
        <div class="campo"><label for="k-repetir">Repita la contraseña nueva</label><input id="k-repetir" type="password" autocomplete="new-password"></div>
        <div class="acciones"><button class="btn" type="submit">Cambiar contraseña</button>
          <button class="btn claro" type="button" id="b-salir">Salir</button></div>
      </form>`;
    $("#b-salir").onclick = () => cerrarSesion("");
    $("#f-clave").onsubmit = async (ev) => {
      ev.preventDefault();
      const err = $("#f-clave .error-campo");
      err.classList.add("oculto");
      if ($("#k-nueva").value !== $("#k-repetir").value) {
        err.textContent = "Las dos contraseñas nuevas no coinciden."; err.classList.remove("oculto"); return;
      }
      try {
        await api("bod_cambiar_mi_clave", { p_actual: $("#k-actual").value, p_nueva: $("#k-nueva").value });
        E.usuario.debe_cambiar_clave = false;
        avisar("Contraseña cambiada.");
        location.hash = "#inicio";
        irA();
      } catch (e) { err.textContent = e.message; err.classList.remove("oculto"); }
    };
  },
};

// ============================================================ piezas comunes
function confirmar(titulo, mensaje, textoSi = "Sí", clase = "") {
  return new Promise((resolver) => {
    const v = abrirVentana({
      titulo, cuerpo: `<p style="white-space:pre-line">${mensaje}</p>`,
      pie: `<button class="btn claro" data-no>Cancelar</button><button class="btn ${clase}" data-si>${h(textoSi)}</button>`,
    });
    $("[data-no]", v).onclick = () => { v.cerrar(); resolver(false); };
    $("[data-si]", v).onclick = () => { v.cerrar(); resolver(true); };
    $(".cerrar", v).onclick = () => { v.cerrar(); resolver(false); };
  });
}

const UNIDAD = { hora: "hora", dia: "día" };
const unidades = (t, m) => `${num(t)} ${UNIDAD[m]}${Number(t) === 1 ? "" : "s"}`;
const aFecha = (s) => new Date(String(s).replace(" ", "T"));

// lo mismo que calcula Supabase: lo que pase de una unidad completa cuenta como otra, salvo la gracia
function calcularTiempo(modalidad, salida, devolucion) {
  const seg = (aFecha(devolucion) - aFecha(salida)) / 1000;
  if (!(seg >= 0)) return null;
  const unidad = modalidad === "hora" ? 3600 : 86400;
  const completas = Math.floor(seg / unidad);
  const gracia = Number(E.config[`gracia_${modalidad}_min`] || 0) * 60;
  return Math.max(1, completas + (seg - completas * unidad > gracia ? 1 : 0));
}
function duracion(desde, hasta) {
  const seg = (aFecha(hasta) - aFecha(desde)) / 1000;
  if (!(seg >= 0)) return "fecha anterior a la salida";
  const d = Math.floor(seg / 86400), hh = Math.floor((seg % 86400) / 3600), mm = Math.floor((seg % 3600) / 60);
  return [d ? `${d} día${d > 1 ? "s" : ""}` : "", hh ? `${hh} h` : "", `${mm} min`].filter(Boolean).join(" ");
}
const ivaPct = () => Number(E.config.iva_pct || 0);
const conIva = (sub) => { const iva = Math.round(sub * ivaPct() / 100); return { sub, iva, total: sub + iva }; };

function semaforoAlquiler(a, ahora = E.ahora || ahoraLocal()) {
  if (a.anulado) return ["Anulado", "gris"];
  if (a.estado === "abierto") {
    if (a.fecha_prevista && a.fecha_prevista < ahora) return ["Vencido: no han devuelto", "rojo"];
    if (a.fecha_prevista && a.fecha_prevista.slice(0, 10) === ahora.slice(0, 10)) return ["Afuera: vuelve hoy", "amarillo"];
    return ["Equipos afuera", "naranja"];
  }
  if (a.estado === "devuelto") return ["Devuelto: falta facturar", "amarillo"];
  return ["Terminado", "verde"];
}

// ======================================================== documento nuevo
/* tipo: "alquiler" | "cotizacion" | "agregar" (más equipos a un alquiler abierto) */
async function abrirDocumento(tipo, alquiler = null) {
  const [equipos, clientes] = await Promise.all([api("bod_equipos"), api("bod_clientes")]);
  const items = [];
  const etiquetaCliente = (c) => `${c.nombre} (${c.tipo_doc} ${c.documento})`;
  const titulo = { alquiler: "Nuevo alquiler", cotizacion: "Nueva cotización", agregar: `Agregar equipos a ${h(alquiler?.numero)}` }[tipo];
  const v = abrirVentana({
    titulo, ancha: true,
    cuerpo: `<div class="error-campo oculto" role="alert"></div>
      ${tipo === "agregar" ? `<p>Cliente: <b>${h(alquiler.cliente)}</b></p>` : `
      <div class="campo"><label for="d-cliente">Cliente *</label>
        <div style="display:flex;gap:8px"><input id="d-cliente" type="text" list="d-clientes" placeholder="Escriba el nombre o el documento" autocomplete="off">
        ${puede("clientes") ? '<button class="btn claro" type="button" id="d-cli-nuevo">Cliente nuevo</button>' : ""}</div>
        <datalist id="d-clientes"></datalist></div>`}
      ${tipo !== "cotizacion" ? `<div class="dos">
        <div class="campo"><label for="d-salida">Sale de bodega</label><input id="d-salida" type="datetime-local" value="${aInput(ahoraLocal())}"></div>
        ${tipo === "alquiler" ? '<div class="campo"><label for="d-prevista">Debe volver</label><input id="d-prevista" type="datetime-local"></div>' : ""}</div>` : ""}
      <div class="agregar-renglon">
        <div class="ancho"><label for="d-equipo">Equipo</label><select id="d-equipo"></select></div>
        <div><label for="d-cant">Cantidad</label><input id="d-cant" type="number" min="1" value="1" inputmode="numeric"></div>
        <div><label for="d-mod">Cobro</label><select id="d-mod"><option value="dia">Por día</option><option value="hora">Por hora</option></select></div>
        <div><label for="d-tiempo">${tipo === "cotizacion" ? "Tiempo" : "Tiempo estimado"}</label><input id="d-tiempo" type="number" min="0.5" step="0.5" value="1" inputmode="decimal"></div>
        <div><label for="d-tarifa">Tarifa</label><input id="d-tarifa" type="number" min="0" step="1000" inputmode="numeric" ${puede("precios") ? "" : "disabled"}></div>
        <div><button class="btn" type="button" id="d-agregar">Agregar</button></div>
      </div>
      <table class="renglones"><thead><tr><th>Equipo</th><th class="num">Cant.</th><th>Cobro</th><th class="num">Tiempo</th><th class="num">Tarifa</th><th class="num">Subtotal</th><th></th></tr></thead><tbody id="d-items"></tbody></table>
      <p class="totales" id="d-totales"></p>
      ${tipo !== "agregar" ? '<div class="campo"><label for="d-obs">Observaciones</label><textarea id="d-obs" placeholder="Obra, dirección de entrega, condiciones…"></textarea></div>' : ""}`,
    pie: `<button class="btn claro" data-no>Cancelar</button><button class="btn" data-si>${{ alquiler: "Entregar equipos", cotizacion: "Crear cotización", agregar: "Agregar al alquiler" }[tipo]}</button>`,
  });
  const err = $(".error-campo", v);
  const fallo = (m) => { err.textContent = m; err.classList.remove("oculto"); err.scrollIntoView({ block: "nearest" }); };
  const pintarClientes = () => { if ($("#d-clientes", v)) $("#d-clientes", v).innerHTML = clientes.map((c) => `<option value="${h(etiquetaCliente(c))}">`).join(""); };
  pintarClientes();
  const activos = equipos.filter((e) => e.estado === "activo");
  $("#d-equipo", v).innerHTML = activos.map((e) => `<option value="${e.id}">${h(e.codigo)}: ${h(e.nombre)} (hay ${e.disponible})</option>`).join("")
    || '<option value="">No hay equipos activos</option>';
  const equipoSel = () => activos.find((e) => e.id === Number($("#d-equipo", v).value));
  const sugerirTarifa = () => { const e = equipoSel(); if (e) $("#d-tarifa", v).value = e["tarifa_" + $("#d-mod", v).value] || ""; };
  $("#d-equipo", v).onchange = () => {
    const e = equipoSel();
    if (e) $("#d-mod", v).value = !e.tarifa_dia && e.tarifa_hora ? "hora" : "dia";
    $("#d-cant", v).value = 1;
    sugerirTarifa();
  };
  $("#d-mod", v).onchange = sugerirTarifa;
  $("#d-equipo", v).onchange();
  const pintarItems = () => {
    let sub = 0;
    $("#d-items", v).innerHTML = items.map((i, n) => {
      const st = Math.round(i.cantidad * i.tiempo * i.tarifa);
      sub += st;
      return `<tr><td>${h(i.nombre)}</td><td class="num">${i.cantidad}</td><td>${UNIDAD[i.modalidad]}</td><td class="num">${num(i.tiempo)}</td>
        <td class="num">${pesos(i.tarifa)}</td><td class="num">${pesos(st)}</td><td><button class="quitar" data-n="${n}" aria-label="Quitar">×</button></td></tr>`;
    }).join("") || '<tr><td colspan="7" style="color:var(--suave)">Agregue los equipos uno por uno.</td></tr>';
    v.querySelectorAll(".quitar").forEach((b) => { b.onclick = () => { items.splice(Number(b.dataset.n), 1); pintarItems(); }; });
    const t = conIva(sub);
    $("#d-totales", v).innerHTML = `Subtotal ${pesos(t.sub)}<span>IVA ${pesos(t.iva)}</span><span>Total${tipo === "cotizacion" ? "" : " estimado"} ${pesos(t.total)}</span>`;
  };
  pintarItems();
  $("#d-agregar", v).onclick = () => {
    err.classList.add("oculto");
    const e = equipoSel();
    if (!e) return fallo("No hay equipos activos en el inventario.");
    const i = { equipo_id: e.id, nombre: `${e.nombre} (${e.codigo})`, cantidad: Number($("#d-cant", v).value), modalidad: $("#d-mod", v).value,
      tiempo: Number($("#d-tiempo", v).value), tarifa: Number($("#d-tarifa", v).value) };
    if (!(i.cantidad >= 1) || !(i.tiempo > 0)) return fallo("Revise la cantidad y el tiempo.");
    if (!(i.tarifa > 0)) return fallo(`«${e.nombre}» no tiene tarifa por ${UNIDAD[i.modalidad]}. ${puede("precios") ? "Escríbala." : "Pídale a alguien con permiso de precios que la defina en el inventario."}`);
    const pedido = i.cantidad + items.filter((x) => x.equipo_id === e.id).reduce((s, x) => s + x.cantidad, 0);
    if (tipo !== "cotizacion" && pedido > e.disponible) return fallo(`Solo hay ${e.disponible} disponible(s) de «${e.nombre}».`);
    items.push(i);
    pintarItems();
  };
  if ($("#d-cli-nuevo", v)) {
    $("#d-cli-nuevo", v).onclick = () => formCliente(null, async (nuevo) => {
      clientes.splice(0, clientes.length, ...(await api("bod_clientes")));
      pintarClientes();
      const c = clientes.find((x) => x.id === nuevo);
      if (c) $("#d-cliente", v).value = etiquetaCliente(c);
    });
  }
  $("[data-no]", v).onclick = v.cerrar;
  $("[data-si]", v).onclick = async () => {
    err.classList.add("oculto");
    const cliente = tipo === "agregar" ? null : clientes.find((c) => etiquetaCliente(c) === $("#d-cliente", v).value.trim());
    if (tipo !== "agregar" && !cliente) return fallo("Elija un cliente de la lista (o regístrelo con «Cliente nuevo»).");
    if (!items.length) return fallo("Agregue al menos un equipo.");
    const renglones = items.map(({ equipo_id, cantidad, modalidad, tiempo, tarifa }) => ({ equipo_id, cantidad, modalidad, tiempo, tarifa }));
    const btn = $("[data-si]", v);
    btn.disabled = true;
    try {
      if (tipo === "cotizacion") {
        const r = await api("bod_cotizacion_crear", { p_cliente: cliente.id, p_items: renglones, p_observaciones: $("#d-obs", v).value });
        v.cerrar(); avisar("Cotización creada."); refrescar(); fichaCotizacion(r.id);
      } else if (tipo === "agregar") {
        await api("bod_alquiler_agregar", { p_alquiler: alquiler.id, p_items: renglones, p_fecha_salida: deInput($("#d-salida", v).value) });
        v.cerrar(); avisar("Equipos agregados al alquiler."); refrescar();
      } else {
        const alertas = await api("bod_alertas_cliente", { p_cliente: cliente.id });
        if (alertas.length && !(await confirmar("Atención con este cliente", alertas.join("\n") + "\n\n¿Entregarle los equipos de todas formas?", "Entregar de todas formas"))) return;
        const r = await api("bod_alquiler_crear", {
          p_cliente: cliente.id, p_items: renglones, p_fecha_salida: deInput($("#d-salida", v).value),
          p_fecha_prevista: deInput($("#d-prevista", v).value) || null, p_observaciones: $("#d-obs", v).value,
        });
        v.cerrar(); avisar("Alquiler registrado. Los equipos salieron del disponible."); refrescar(); abrirAlquiler(r.id);
      }
    } catch (e) { fallo(e.message); } finally { btn.disabled = false; }
  };
}

// ============================================================== Alquileres
PAGINAS.alquileres = {
  montar(raiz) {
    const ui = (E.ui.alquileres ||= { buscar: "", afuera: false });
    raiz.innerHTML = `<h1>Alquileres</h1>
      <div class="barra">
        <input class="buscar" type="search" id="buscar" placeholder="Buscar por número o cliente" value="${h(ui.buscar)}">
        <label><input type="checkbox" id="afuera" ${ui.afuera ? "checked" : ""}> Solo con equipos afuera</label>
        ${puede("alq_crear") ? `<button class="btn" id="b-nuevo">${ICONOS.mas} Nuevo alquiler</button>` : ""}
      </div><div id="lista"></div>`;
    $("#buscar").oninput = (ev) => { ui.buscar = ev.target.value; this.pintar(); };
    $("#afuera").onchange = (ev) => { ui.afuera = ev.target.checked; this.pintar(); };
    if ($("#b-nuevo")) $("#b-nuevo").onclick = () => abrirDocumento("alquiler").catch((e) => avisar(e.message, true));
  },
  async actualizar() { E.datos.alquileres = await api("bod_alquileres"); this.pintar(); },
  pintar() {
    const ui = E.ui.alquileres;
    const q = ui.buscar.toLowerCase();
    const todos = E.datos.alquileres || [];
    const filas = todos.filter((a) => (!ui.afuera || (a.estado === "abierto" && !a.anulado))
      && (!q || `${a.numero} ${a.cliente}`.toLowerCase().includes(q)));
    if (!filas.length) {
      $("#lista").innerHTML = `<div class="vacio">${todos.length ? "Ningún alquiler coincide." : "Todavía no hay alquileres. Use «Nuevo alquiler» para registrar la primera salida de equipos."}</div>`;
      return;
    }
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Estado</th><th>Alquiler</th><th>Salió</th><th>Debe volver</th><th class="num">Unidades afuera</th><th>Observaciones</th></tr></thead><tbody>
      ${filas.map((a) => `<tr data-id="${a.id}"><td class="sin-titulo">${chip(semaforoAlquiler(a))}</td>
        <td data-t="Alquiler"><span><span class="principal">${h(a.cliente)}</span><br><span class="sec">${h(a.numero)}</span></span></td>
        <td data-t="Salió">${h(a.fecha_salida)}</td><td data-t="Debe volver">${h(a.fecha_prevista || "Sin fecha")}</td>
        <td data-t="Unidades afuera" class="num">${a.pendientes || "—"}</td>
        <td data-t="Observaciones">${h((a.observaciones || "").split("\n")[0])}</td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => { tr.onclick = () => abrirAlquiler(Number(tr.dataset.id)); });
  },
};

async function abrirAlquiler(id) {
  const v = abrirVentana({ titulo: "Alquiler", ancha: true, cuerpo: "<p>Cargando…</p>" });
  v.refrescar = async () => {
    const d = await api("bod_alquiler", { p_id: id });
    if (!document.body.contains(v)) return;
    pintarAlquiler(v, d);
  };
  try { await v.refrescar(); } catch (e) { v.cerrar(); avisar(e.message, true); }
}

function pintarAlquiler(v, d) {
  const a = d.alquiler, c = d.cliente, ahora = d.ahora;
  E.ahora = ahora;
  a.cliente = c.nombre;
  const vivo = !a.anulado;
  const vencido = a.fecha_prevista && a.fecha_prevista < ahora;
  $("header h3", v).textContent = `${a.numero}: ${c.nombre}`;
  let pendiente = d.cargos.filter((x) => !x.factura).reduce((s, x) => s + x.valor, 0);
  const filas = d.items.map((i) => {
    const dev = i.fecha_devolucion;
    if (dev && !i.factura) pendiente += (i.subtotal || 0) + i.cargo_dano;
    const estado = dev ? (i.es_corte ? ["Corte de cobro", "azul"] : ["Devuelto", "verde"])
      : [`Con el cliente (${duracion(i.fecha_salida, ahora)})`, vencido ? "rojo" : "naranja"];
    return `<tr data-item="${i.id}" style="cursor:pointer"><td>${chip(estado)}</td>
      <td><b>${h(i.nombre)}</b><br><span class="sec" style="color:var(--suave)">${h(i.codigo)}, salió ${h(i.fecha_salida)}</span></td>
      <td class="num">${i.cantidad}</td><td>${UNIDAD[i.modalidad]}</td><td class="num">${pesos(i.tarifa)}</td>
      <td>${dev ? h(dev) : ""}</td><td class="num">${dev ? num(i.tiempo_cobrado) : ""}</td><td class="num">${dev ? pesos(i.subtotal) : ""}</td>
      <td>${i.danadas ? `${i.danadas} und.${i.cargo_dano ? ", " + pesos(i.cargo_dano) : ""}` : ""}</td><td>${h(i.factura || "")}</td></tr>`;
  }).join("");
  const fuera = d.items.some((i) => !i.fecha_devolucion);
  const btn = (k, texto, permiso, clase = "claro") => (vivo && (!permiso || puede(permiso)) ? `<button class="btn ${clase}" data-a="${k}">${texto}</button>` : "");
  $(".cuerpo", v).innerHTML = `
    <div class="cabeza-alquiler">${chip(semaforoAlquiler(a, ahora))}
      <div><small>Salió</small>${h(a.fecha_salida)}</div><div><small>Debe volver</small>${h(a.fecha_prevista || "Sin fecha")}</div>
      <div><small>Teléfono</small>${h(c.telefono || "No registrado")}</div></div>
    ${a.observaciones ? `<p style="white-space:pre-line;color:var(--suave);margin:6px 0">${h(a.observaciones)}</p>` : ""}
    <div class="acciones">${telefonoLinks(c.telefono)}</div>
    <h2>Equipos</h2><p class="ayuda" style="margin:0 0 4px">Toque un renglón para recibirlo, corregir su cobro o hacer un corte.</p>
    <div style="overflow-x:auto"><table class="renglones"><thead><tr><th>Estado</th><th>Equipo</th><th class="num">Cant.</th><th>Cobro</th><th class="num">Tarifa</th>
      <th>Devuelto</th><th class="num">Tiempo</th><th class="num">Subtotal</th><th>Daño</th><th>Factura</th></tr></thead><tbody>${filas}</tbody></table></div>
    <h2>Cargos adicionales</h2>
    ${d.cargos.length ? `<table class="renglones"><tbody>${d.cargos.map((x) => `<tr><td>${h(x.concepto)}</td><td class="num">${pesos(x.valor)}</td><td>${h(x.factura || "")}</td>
      <td>${vivo && !x.factura && puede("alq_crear") ? `<button class="quitar" data-cargo="${x.id}" aria-label="Quitar cargo">×</button>` : ""}</td></tr>`).join("")}</tbody></table>`
      : '<p class="ayuda" style="margin:0">Transporte, operario, combustible… se agregan con «Agregar cargo».</p>'}
    <p class="totales">${vivo ? `Pendiente de facturar: ${pesos(pendiente)} + IVA` : "Alquiler anulado"}</p>
    <div class="grupo-botones">
      ${fuera ? btn("todo", "Recibir todo", "alq_devolver", "") : ""}
      ${btn("facturar", "Facturar lo pendiente", "fac_emitir", fuera ? "claro" : "")}
      ${btn("agregar", "Agregar equipos", "alq_crear")}${btn("cargo", "Agregar cargo", "alq_crear")}
      ${btn("prorroga", "Prórroga y observaciones", "alq_crear")}
      <button class="btn claro" data-a="pdf">Remisión PDF</button>
      ${btn("anular", "Anular alquiler", "alq_anular", "peligro")}
    </div>
    ${puede("super") ? `<div class="zona-super"><p>Superusuario: cambia cliente o fechas del alquiler, o lo elimina (va a la papelera; los equipos vuelven al disponible).</p>
      <div class="acciones"><button class="btn super" data-a="total">Edición total del alquiler</button><button class="btn peligro" data-a="eliminar">Eliminar alquiler</button></div></div>` : ""}`;
  const accion = (fn) => async () => { try { await fn(); } catch (e) { avisar(e.message, true); } };
  v.querySelectorAll("[data-item]").forEach((tr) => {
    tr.onclick = () => menuRenglon(v, a, d.items.find((i) => i.id === Number(tr.dataset.item)), ahora);
  });
  v.querySelectorAll("[data-cargo]").forEach((b) => {
    b.onclick = accion(async () => { await api("bod_cargo_quitar", { p_cargo: Number(b.dataset.cargo) }); refrescar(); });
  });
  const acciones = {
    todo: () => formulario({
      titulo: "Recibir todo en buen estado", textoGuardar: "Recibir todo",
      intro: "<p>Se recibe todo lo que el cliente tiene, en buen estado, y el tiempo se calcula con las fechas. Si algo vino dañado, recíbalo renglón por renglón.</p>",
      campos: [{ k: "fecha", e: "Fecha y hora de devolución", t: "fecha", v: ahoraLocal() }],
      guardar: async (x) => { await api("bod_devolver_todo", { p_alquiler: a.id, p_fecha: x.fecha }); avisar("Equipos recibidos."); refrescar(); },
    }),
    facturar: accion(async () => {
      if (!(await confirmar("Facturar", `Se factura lo devuelto, los cortes de cobro y los cargos por ${pesos(pendiente)} más IVA.${fuera ? "\nLo que sigue con el cliente se factura cuando vuelva." : ""}`, "Emitir factura"))) return;
      const r = await api("bod_facturar", { p_alquiler: a.id });
      avisar("Factura emitida."); refrescar(); pdfFactura(r.id);
    }),
    agregar: accion(() => abrirDocumento("agregar", a)),
    cargo: () => formulario({
      titulo: "Agregar cargo", textoGuardar: "Agregar cargo",
      campos: [{ k: "concepto", e: "Concepto", v: "Transporte", req: true }, { k: "valor", e: "Valor (sin IVA)", t: "dinero", req: true }],
      guardar: async (x) => { await api("bod_cargo_agregar", { p_alquiler: a.id, p_concepto: x.concepto, p_valor: x.valor }); refrescar(); },
    }),
    prorroga: () => formulario({
      titulo: "Prórroga y observaciones",
      campos: [{ k: "prevista", e: "Debe volver", t: "fecha", v: a.fecha_prevista }, { k: "obs", e: "Observaciones", t: "nota", v: a.observaciones }],
      guardar: async (x) => { await api("bod_alquiler_editar", { p_alquiler: a.id, p_fecha_prevista: x.prevista || null, p_observaciones: x.obs }); avisar("Guardado."); refrescar(); },
    }),
    pdf: accion(() => pdfRemision(a.id)),
    anular: () => pedirMotivo({
      titulo: `Anular ${h(a.numero)}`, textoBoton: "Anular alquiler",
      mensaje: "Úselo cuando el alquiler no se llevó a cabo. Los equipos vuelven al disponible y el alquiler queda en gris con el motivo.",
      accion: async (m) => { await api("bod_alquiler_anular", { p_alquiler: a.id, p_motivo: m }); avisar("Alquiler anulado."); refrescar(); },
    }),
    total: accion(async () => formTotal("alquileres", a.id, `Edición total: ${h(a.numero)}`, [
      { k: "cliente_id", e: "Cliente", t: "select", v: a.cliente_id, op: (await api("bod_clientes")).map((x) => [x.id, x.nombre]) },
      { k: "fecha_salida", e: "Salió de bodega", t: "fecha", v: a.fecha_salida },
      { k: "fecha_prevista", e: "Debe volver", t: "fecha", v: a.fecha_prevista },
      { k: "observaciones", e: "Observaciones", t: "nota", v: a.observaciones },
    ], a)),
    eliminar: () => pedirMotivo({
      titulo: `Eliminar ${h(a.numero)}`, textoBoton: "Eliminar alquiler",
      mensaje: "Va a la papelera, de donde se puede restaurar. Los equipos que estaban afuera vuelven al disponible. Si tiene facturas, elimínelas primero.",
      accion: async (m) => { await api("bod_eliminar", { p_tipo: "alquiler", p_id: a.id, p_motivo: m }); v.cerrar(); avisar("Alquiler enviado a la papelera."); refrescar(); },
    }),
  };
  v.querySelectorAll("[data-a]").forEach((b) => { b.onclick = () => acciones[b.dataset.a](); });
}

function menuRenglon(vAlq, a, i, ahora) {
  if (a.anulado) return;
  const dev = !!i.fecha_devolucion;
  const ops = [];
  if (!dev && puede("alq_devolver")) ops.push(["devolver", "Recibir este equipo", ""], ["corte", "Corte de cobro (sigue con el cliente)", "claro"]);
  if (!dev && puede("alq_corregir")) ops.push(["quitar", "Quitar renglón (se digitó por error)", "peligro"]);
  if (dev && !i.factura && puede("alq_corregir")) {
    ops.push(["corregir", "Corregir el cobro", ""]);
    if (!i.es_corte && !i.danadas) ops.push(["deshacer", "Deshacer la devolución", "claro"]);
  }
  if (puede("super")) ops.push(["total", "Edición total del renglón", "super"]);
  if (!ops.length) return avisar(dev && i.factura ? `Este renglón ya está en la factura ${i.factura}.` : "Su usuario no tiene acciones para este renglón.");
  const v = abrirVentana({
    titulo: h(i.nombre),
    cuerpo: `<p>${i.cantidad} ${i.cantidad > 1 ? "unidades" : "unidad"}, cobro por ${UNIDAD[i.modalidad]} a ${pesos(i.tarifa)}. Salió ${h(i.fecha_salida)}${dev ? `, devuelto ${h(i.fecha_devolucion)}` : ""}.</p>
      <div style="display:grid;gap:10px">${ops.map(([k, t, c]) => `<button class="btn ${c}" data-o="${k}">${t}</button>`).join("")}</div>`,
  });
  v.querySelectorAll("[data-o]").forEach((b) => {
    b.onclick = async () => {
      v.cerrar();
      const k = b.dataset.o;
      try {
        if (k === "devolver" || k === "corte" || k === "corregir") return dialogoDevolucion(i, k, ahora);
        if (k === "quitar") {
          if (await confirmar("Quitar renglón", `¿Quitar «${i.nombre}» del alquiler? Úselo solo si se digitó por error y el equipo no salió.`, "Quitar", "peligro")) {
            await api("bod_quitar_item", { p_item: i.id }); refrescar();
          }
        }
        if (k === "deshacer") {
          if (await confirmar("Deshacer la devolución", `«${i.nombre}» volverá a figurar en poder del cliente.`, "Deshacer")) {
            await api("bod_deshacer", { p_item: i.id }); refrescar();
          }
        }
        if (k === "total") {
          formTotal("alquiler_items", i.id, `Edición total: ${h(i.nombre)}`, [
            { k: "cantidad", e: "Cantidad", t: "numero", v: i.cantidad, min: 1 },
            { k: "modalidad", e: "Cobro", t: "select", v: i.modalidad, op: [["dia", "Por día"], ["hora", "Por hora"]] },
            { k: "tarifa", e: "Tarifa", t: "dinero", v: i.tarifa },
            { k: "fecha_salida", e: "Salió", t: "fecha", v: i.fecha_salida },
            { k: "fecha_devolucion", e: "Devuelto", t: "fecha", v: i.fecha_devolucion, nota: "Vacío = sigue con el cliente." },
            { k: "tiempo_cobrado", e: "Tiempo cobrado", t: "numero", v: i.tiempo_cobrado, paso: 0.25 },
            { k: "danadas", e: "Unidades dañadas", t: "numero", v: i.danadas },
            { k: "cargo_dano", e: "Cargo por daño", t: "dinero", v: i.cargo_dano },
          ], i, "El subtotal se recalcula solo con cantidad × tiempo × tarifa.");
        }
      } catch (e) { avisar(e.message, true); }
    };
  });
}

/* modo: devolver | corte | corregir — con el valor a cobrar calculado en vivo */
function dialogoDevolucion(i, modo, ahora) {
  const dev = !!i.fecha_devolucion;
  const libre = modo === "corregir" || puede("precios");   // ¿puede cobrar distinto a lo pactado?
  const titulos = { devolver: "Recibir", corte: "Corte de cobro", corregir: "Corregir cobro" };
  const v = abrirVentana({
    titulo: `${titulos[modo]}: ${h(i.nombre)}`,
    cuerpo: `<div class="error-campo oculto" role="alert"></div>
      ${modo === "corte" ? "<p>Se liquida hasta la fecha indicada para poder facturar ese periodo. El equipo sigue con el cliente y el tiempo vuelve a correr desde ahí.</p>" : ""}
      <p>Salió de bodega: <b>${h(i.fecha_salida)}</b></p>
      <div class="dos">
        ${modo === "devolver" && i.cantidad > 1 ? `<div class="campo"><label for="r-cant">Cantidad que recibe (de ${i.cantidad})</label><input id="r-cant" type="number" min="1" max="${i.cantidad}" value="${i.cantidad}"></div>` : ""}
        <div class="campo"><label for="r-fecha">${modo === "corte" ? "Cobrar hasta" : "Fecha y hora de devolución"}</label>
          <input id="r-fecha" type="datetime-local" value="${aInput(dev ? i.fecha_devolucion : ahoraLocal())}" ${modo === "corregir" && i.es_corte ? "disabled" : ""}></div>
        <div class="campo"><label for="r-mod">Cobrar</label><select id="r-mod" ${libre ? "" : "disabled"}><option value="dia">Por día</option><option value="hora">Por hora</option></select></div>
        <div class="campo"><label for="r-tarifa">Tarifa</label><input id="r-tarifa" type="number" min="0" step="1000" value="${i.tarifa}" ${libre ? "" : "disabled"}></div>
      </div>
      <label class="check"><input type="checkbox" id="r-auto" ${dev ? "" : "checked"} ${libre ? "" : "disabled"}> Calcular el tiempo con las fechas</label>
      <div class="campo" style="margin-top:8px"><label for="r-tiempo">Tiempo a cobrar</label><input id="r-tiempo" type="number" min="0.25" step="0.5" value="${i.tiempo_cobrado || 1}"></div>
      ${!libre ? '<p class="ayuda">Su usuario cobra lo pactado: el tiempo sale de las fechas.</p>' : ""}
      ${modo === "devolver" ? `<h2>¿Vino algo dañado o se perdió?</h2><div class="dos">
        <div class="campo"><label for="r-danadas">Unidades dañadas o perdidas</label><input id="r-danadas" type="number" min="0" max="${i.cantidad}" value="0"></div>
        <div class="campo"><label for="r-cargo">Cobrar al cliente por el daño</label><input id="r-cargo" type="number" min="0" step="10000" value="0"></div></div>
        <div class="campo"><label for="r-motivo">Qué pasó</label><input id="r-motivo" type="text" placeholder="Se dan de baja del inventario con esta nota"></div>` : ""}
      ${modo === "corregir" && i.danadas ? `<div class="campo"><label for="r-cargo">Cargo por daño (${i.danadas} und.)</label><input id="r-cargo" type="number" min="0" step="10000" value="${i.cargo_dano}"></div>` : ""}
      <div class="calculo" id="r-calculo"></div>`,
    pie: `<button class="btn claro" data-no>Cancelar</button><button class="btn" data-si>${{ devolver: "Recibir", corte: "Hacer corte", corregir: "Guardar corrección" }[modo]}</button>`,
  });
  const el = (id) => $("#" + id, v);
  el("r-mod").value = i.modalidad;
  const equipo = { hora: i.tarifa_hora_equipo, dia: i.tarifa_dia_equipo };
  el("r-mod").onchange = () => { el("r-tarifa").value = el("r-mod").value === i.modalidad ? i.tarifa : equipo[el("r-mod").value] || 0; calcular(); };
  const calcular = () => {
    const mod = el("r-mod").value, fecha = deInput(el("r-fecha").value);
    const auto = el("r-auto").checked;
    el("r-tiempo").disabled = auto || !libre;
    if (auto) { const t = calcularTiempo(mod, i.fecha_salida, fecha); if (t) el("r-tiempo").value = t; }
    const cant = el("r-cant") ? Number(el("r-cant").value) : i.cantidad;
    const t = Number(el("r-tiempo").value), tarifa = Number(el("r-tarifa").value);
    const cargo = el("r-cargo") ? Number(el("r-cargo").value) : 0;
    el("r-calculo").innerHTML = !(tarifa > 0) ? `Este equipo no tiene tarifa por ${UNIDAD[mod]}: escriba el valor.`
      : `A cobrar: ${cant} × ${unidades(t, mod)} × ${pesos(tarifa)} = ${pesos(cant * t * tarifa)}${cargo ? ` + daño ${pesos(cargo)}` : ""}
         <small>Tiempo real fuera de bodega: ${duracion(i.fecha_salida, fecha)}</small>`;
  };
  v.querySelectorAll("input, select").forEach((x) => { x.addEventListener("input", calcular); x.addEventListener("change", calcular); });
  calcular();
  $("[data-no]", v).onclick = v.cerrar;
  $("[data-si]", v).onclick = async () => {
    const err = $(".error-campo", v);
    err.classList.add("oculto");
    const comunes = {
      p_item: i.id, p_fecha: deInput(el("r-fecha").value), p_modalidad: el("r-mod").value, p_tarifa: Number(el("r-tarifa").value),
      p_tiempo: el("r-auto").checked ? null : Number(el("r-tiempo").value),
    };
    try {
      if (modo === "corregir") {
        await api("bod_corregir", { ...comunes, p_cargo_dano: el("r-cargo") ? Number(el("r-cargo").value) : null });
      } else {
        await api("bod_devolver", {
          ...comunes, p_corte: modo === "corte", p_cantidad: el("r-cant") ? Number(el("r-cant").value) : null,
          p_danadas: el("r-danadas") ? Number(el("r-danadas").value) : 0, p_cargo_dano: el("r-cargo") ? Number(el("r-cargo").value) : 0,
          p_motivo_dano: el("r-motivo") ? el("r-motivo").value : "",
        });
      }
      v.cerrar();
      avisar({ devolver: "Equipo recibido.", corte: "Corte registrado.", corregir: "Cobro corregido." }[modo]);
      refrescar();
    } catch (e) { err.textContent = e.message; err.classList.remove("oculto"); }
  };
}

// edición total genérica del superusuario: solo envía lo que cambió, con motivo
function formTotal(tabla, id, titulo, campos, actual, nota = "") {
  formulario({
    titulo, textoGuardar: "Guardar con mi firma", clase: "super",
    intro: `<p>Solo se guardan los campos que cambie. Queda anotado qué tenía antes, qué quedó y su motivo.${nota ? " " + nota : ""}</p>`,
    campos: [...campos, { k: "motivo", e: "Motivo del cambio", t: "nota", req: true }],
    guardar: async (d) => {
      const cambios = {};
      for (const c of campos) {
        let nuevo = d[c.k];
        if (c.t === "fecha" && !nuevo) nuevo = null;
        if (c.t === "select" && typeof actual[c.k] === "number") nuevo = Number(nuevo);
        if (String(nuevo ?? "") !== String(actual[c.k] ?? "")) cambios[c.k] = nuevo;
      }
      if (!Object.keys(cambios).length) throw new ErrorApi("No cambió ningún dato.", "X");
      await api("bod_super_editar", { p_tabla: tabla, p_id: id, p_cambios: cambios, p_motivo: d.motivo });
      avisar("Cambio guardado y anotado en el registro."); refrescar();
    },
  });
}

// ============================================================ Cotizaciones
function semaforoCotizacion(c) {
  if (c.estado === "vigente" && c.valida_hasta < (E.ahora || ahoraLocal()).slice(0, 10)) return ["Vencida", "amarillo"];
  return { vigente: ["Vigente", "verde"], convertida: ["Ya es alquiler", "azul"], anulada: ["Anulada", "gris"] }[c.estado];
}
PAGINAS.cotizaciones = {
  montar(raiz) {
    const ui = (E.ui.cotizaciones ||= { buscar: "" });
    raiz.innerHTML = `<h1>Cotizaciones</h1>
      <div class="barra"><input class="buscar" type="search" id="buscar" placeholder="Buscar por número o cliente" value="${h(ui.buscar)}">
        ${puede("cotizaciones") ? `<button class="btn" id="b-nuevo">${ICONOS.mas} Nueva cotización</button>` : ""}</div><div id="lista"></div>`;
    $("#buscar").oninput = (ev) => { ui.buscar = ev.target.value; this.pintar(); };
    if ($("#b-nuevo")) $("#b-nuevo").onclick = () => abrirDocumento("cotizacion").catch((e) => avisar(e.message, true));
  },
  async actualizar() { E.datos.cotizaciones = await api("bod_cotizaciones"); this.pintar(); },
  pintar() {
    const q = E.ui.cotizaciones.buscar.toLowerCase();
    const todos = E.datos.cotizaciones || [];
    const filas = todos.filter((c) => !q || `${c.numero} ${c.cliente}`.toLowerCase().includes(q));
    if (!filas.length) { $("#lista").innerHTML = `<div class="vacio">${todos.length ? "Ninguna cotización coincide." : "Todavía no hay cotizaciones."}</div>`; return; }
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Estado</th><th>Cotización</th><th>Fecha</th><th>Válida hasta</th><th class="num">Total</th></tr></thead><tbody>
      ${filas.map((c) => `<tr data-id="${c.id}"><td class="sin-titulo">${chip(semaforoCotizacion(c))}</td>
        <td data-t="Cotización"><span><span class="principal">${h(c.cliente)}</span><br><span class="sec">${h(c.numero)}</span></span></td>
        <td data-t="Fecha">${h(c.fecha)}</td><td data-t="Válida hasta">${h(c.valida_hasta)}</td><td data-t="Total" class="num">${pesos(c.total)}</td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => { tr.onclick = () => fichaCotizacion(Number(tr.dataset.id)); });
  },
};

async function fichaCotizacion(id) {
  let d;
  try { d = await api("bod_cotizacion", { p_id: id }); } catch (e) { return avisar(e.message, true); }
  const c = d.cotizacion;
  const sem = semaforoCotizacion(c);
  const vigente = c.estado === "vigente";
  const v = abrirVentana({
    titulo: `${h(c.numero)}: ${h(d.cliente.nombre)}`, ancha: true,
    cuerpo: `${chip(sem)} <span style="margin-left:8px;color:var(--suave)">Hecha ${h(c.fecha)}, válida hasta ${h(c.valida_hasta)}</span>
      <table class="renglones"><thead><tr><th>Equipo</th><th class="num">Cant.</th><th>Cobro</th><th class="num">Tiempo</th><th class="num">Tarifa</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${d.items.map((i) => `<tr><td>${h(i.descripcion)}</td><td class="num">${i.cantidad}</td><td>${UNIDAD[i.modalidad]}</td><td class="num">${num(i.tiempo)}</td>
        <td class="num">${pesos(i.tarifa)}</td><td class="num">${pesos(i.subtotal)}</td></tr>`).join("")}</tbody></table>
      <p class="totales">Subtotal ${pesos(c.subtotal)}<span>IVA ${pesos(c.iva)}</span><span>Total ${pesos(c.total)}</span></p>
      ${c.observaciones ? `<p style="white-space:pre-line">${h(c.observaciones)}</p>` : ""}
      <div class="grupo-botones"><button class="btn" data-a="pdf">Descargar PDF</button>
        ${vigente && puede("alq_crear") ? '<button class="btn claro" data-a="convertir">Convertir en alquiler</button>' : ""}
        ${vigente && puede("cotizaciones") ? '<button class="btn peligro" data-a="anular">Anular</button>' : ""}
        ${puede("eliminar") || puede("super") ? '<button class="btn peligro" data-a="eliminar">Eliminar</button>' : ""}</div>`,
  });
  const acc = {
    pdf: () => pdfCotizacion(id),
    convertir: async () => {
      const alertas = await api("bod_alertas_cliente", { p_cliente: c.cliente_id });
      const vencida = sem[0] === "Vencida" ? "La cotización está vencida; se respetarán sus tarifas.\n" : "";
      if (!(await confirmar("Convertir en alquiler", `${vencida}${alertas.join("\n")}${alertas.length ? "\n" : ""}Los equipos salen de bodega con la fecha y hora de este momento.`, "Entregar equipos"))) return;
      const r = await api("bod_alquiler_crear", { p_cliente: null, p_items: null, p_cotizacion: id });
      v.cerrar(); avisar("Alquiler registrado."); refrescar(); abrirAlquiler(r.id);
    },
    anular: async () => {
      if (!(await confirmar("Anular cotización", `¿Anular la cotización ${c.numero}?`, "Anular", "peligro"))) return;
      await api("bod_cotizacion_anular", { p_id: id }); v.cerrar(); refrescar();
    },
    eliminar: () => pedirMotivo({
      titulo: `Eliminar ${h(c.numero)}`, textoBoton: "Eliminar",
      mensaje: "La cotización va a la papelera, de donde se puede restaurar.",
      accion: async (m) => { await api("bod_eliminar", { p_tipo: "cotizacion", p_id: id, p_motivo: m }); v.cerrar(); avisar("Cotización enviada a la papelera."); refrescar(); },
    }),
  };
  v.querySelectorAll("[data-a]").forEach((b) => { b.onclick = async () => { try { await acc[b.dataset.a](); } catch (e) { avisar(e.message, true); } }; });
}

// ================================================================ Facturas
const semaforoFactura = (f) => (f.estado === "anulada" ? ["Anulada", "gris"] : f.pagada_el ? ["Pagada", "verde"] : ["Por cobrar", "amarillo"]);
PAGINAS.facturas = {
  montar(raiz) {
    const ui = (E.ui.facturas ||= { buscar: "", porCobrar: false });
    raiz.innerHTML = `<h1>Facturas</h1>
      <div class="barra"><input class="buscar" type="search" id="buscar" placeholder="Buscar por número o cliente" value="${h(ui.buscar)}">
        <label><input type="checkbox" id="porcobrar" ${ui.porCobrar ? "checked" : ""}> Solo por cobrar</label></div>
      <p class="ayuda">Las facturas se emiten desde cada alquiler, con «Facturar lo pendiente».</p><div id="lista"></div>`;
    $("#buscar").oninput = (ev) => { ui.buscar = ev.target.value; this.pintar(); };
    $("#porcobrar").onchange = (ev) => { ui.porCobrar = ev.target.checked; this.pintar(); };
  },
  async actualizar() { E.datos.facturas = await api("bod_facturas"); this.pintar(); },
  pintar() {
    const ui = E.ui.facturas, q = ui.buscar.toLowerCase();
    const todos = E.datos.facturas || [];
    const filas = todos.filter((f) => (!ui.porCobrar || (f.estado === "emitida" && !f.pagada_el)) && (!q || `${f.numero} ${f.cliente}`.toLowerCase().includes(q)));
    const deuda = todos.filter((f) => f.estado === "emitida" && !f.pagada_el).reduce((s, f) => s + f.total, 0);
    if (!filas.length) { $("#lista").innerHTML = `<div class="vacio">${todos.length ? "Ninguna factura coincide." : "Todavía no hay facturas."}</div>`; return; }
    $("#lista").innerHTML = `<p class="totales" style="text-align:left;margin:0 0 10px">Por cobrar en total: ${pesos(deuda)}</p>
      <table class="tabla"><thead><tr><th>Estado</th><th>Factura</th><th>Fecha</th><th>Alquiler</th><th class="num">Total</th><th>Pago</th></tr></thead><tbody>
      ${filas.map((f) => `<tr data-id="${f.id}"><td class="sin-titulo">${chip(semaforoFactura(f))}</td>
        <td data-t="Factura"><span><span class="principal">${h(f.cliente)}</span><br><span class="sec">${h(f.numero)}</span></span></td>
        <td data-t="Fecha">${h(f.fecha)}</td><td data-t="Alquiler">${h(f.alquiler || "")}</td><td data-t="Total" class="num">${pesos(f.total)}</td>
        <td data-t="Pago">${f.pagada_el ? `${h(f.pagada_el)}${f.medio_pago ? ", " + h(f.medio_pago) : ""}` : "—"}</td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => { tr.onclick = () => fichaFactura(Number(tr.dataset.id)); });
  },
};

async function fichaFactura(id) {
  let d;
  try { d = await api("bod_factura", { p_id: id }); } catch (e) { return avisar(e.message, true); }
  const f = d.factura, emitida = f.estado === "emitida";
  const v = abrirVentana({
    titulo: `${h(f.numero)}: ${h(d.cliente.nombre)}`, ancha: true,
    cuerpo: `${chip(semaforoFactura(f))} <span style="margin-left:8px;color:var(--suave)">${h(f.fecha)}${d.alquiler ? `, alquiler ${h(d.alquiler)}` : ""}${f.pagada_el ? `. Pagada ${h(f.pagada_el)} ${h(f.medio_pago || "")}` : ""}</span>
      <table class="renglones"><thead><tr><th>Descripción</th><th class="num">Cant.</th><th>Cobro</th><th class="num">Tiempo</th><th class="num">Tarifa</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${d.items.map((i) => `<tr data-linea="${i.id}" ${puede("super") ? 'style="cursor:pointer"' : ""}><td style="white-space:pre-line">${h(i.descripcion)}</td><td class="num">${i.cantidad}</td><td>${h(i.unidad)}</td>
        <td class="num">${i.unidad ? num(i.tiempo) : ""}</td><td class="num">${i.tarifa ? pesos(i.tarifa) : ""}</td><td class="num">${pesos(i.subtotal)}</td></tr>`).join("")}</tbody></table>
      <p class="totales">Subtotal ${pesos(f.subtotal)}<span>IVA (${num(f.iva_pct)} %) ${pesos(f.iva)}</span><span>Total ${pesos(f.total)}</span></p>
      ${puede("super") ? '<p class="ayuda">Superusuario: toque un renglón para corregirlo; los totales se recalculan solos.</p>' : ""}
      <div class="grupo-botones"><button class="btn" data-a="pdf">Descargar PDF</button>
        ${emitida && !f.pagada_el && puede("fac_pago") ? '<button class="btn claro" data-a="pago">Registrar pago</button>' : ""}
        ${emitida && f.pagada_el && puede("fac_anular") ? '<button class="btn claro" data-a="quitarpago">Quitar pago</button>' : ""}
        ${emitida && puede("fac_anular") ? '<button class="btn peligro" data-a="anular">Anular</button>' : ""}
        ${puede("super") ? '<button class="btn peligro" data-a="eliminar">Eliminar</button>' : ""}</div>`,
  });
  const acc = {
    pdf: () => pdfFactura(id),
    pago: () => formulario({
      titulo: `Pago de ${h(f.numero)}`, textoGuardar: "Registrar pago",
      intro: `<p>Total: <b>${pesos(f.total)}</b></p>`,
      campos: [{ k: "fecha", e: "Fecha del pago", t: "fecha", v: ahoraLocal() },
        { k: "medio", e: "Medio de pago", t: "select", v: "Efectivo", op: ["Efectivo", "Transferencia", "Nequi / Daviplata", "Tarjeta", "Otro"].map((m) => [m, m]) }],
      guardar: async (x) => { await api("bod_pago", { p_factura: id, p_fecha: x.fecha, p_medio: x.medio }); v.cerrar(); avisar("Pago registrado."); refrescar(); },
    }),
    quitarpago: async () => {
      if (!(await confirmar("Quitar pago", "La factura volverá a quedar por cobrar.", "Quitar pago"))) return;
      await api("bod_quitar_pago", { p_factura: id }); v.cerrar(); refrescar();
    },
    anular: async () => {
      if (!(await confirmar("Anular factura", "Sus renglones quedan listos para facturarse de nuevo desde el alquiler.", "Anular", "peligro"))) return;
      await api("bod_factura_anular", { p_factura: id }); v.cerrar(); avisar("Factura anulada."); refrescar();
    },
    eliminar: () => pedirMotivo({
      titulo: `Eliminar ${h(f.numero)}`, textoBoton: "Eliminar factura",
      mensaje: "Va a la papelera, de donde se puede restaurar. Lo que cobraba queda pendiente de facturar en su alquiler.",
      accion: async (m) => { await api("bod_eliminar", { p_tipo: "factura", p_id: id, p_motivo: m }); v.cerrar(); avisar("Factura enviada a la papelera."); refrescar(); },
    }),
  };
  v.querySelectorAll("[data-a]").forEach((b) => { b.onclick = async () => { try { await acc[b.dataset.a](); } catch (e) { avisar(e.message, true); } }; });
  if (puede("super")) {
    v.querySelectorAll("[data-linea]").forEach((tr) => {
      tr.onclick = () => {
        const i = d.items.find((x) => x.id === Number(tr.dataset.linea));
        v.cerrar();
        formTotal("factura_items", i.id, "Corregir renglón de la factura", [
          { k: "descripcion", e: "Descripción", t: "nota", v: i.descripcion }, { k: "cantidad", e: "Cantidad", t: "numero", v: i.cantidad },
          { k: "tiempo", e: "Tiempo", t: "numero", v: i.tiempo, paso: 0.25 }, { k: "tarifa", e: "Tarifa", t: "dinero", v: i.tarifa },
          { k: "subtotal", e: "Subtotal", t: "dinero", v: i.subtotal, nota: "Si no lo cambia, se recalcula con cantidad × tiempo × tarifa." },
        ], i);
      };
    });
  }
}

// ======================================================================= PDF
let pdfListo = null;
function cargarPdf() {
  const cargar = (src) => new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => mal(new ErrorApi("No se pudo cargar el generador de PDF. Revise el internet.", "PDF"));
    document.head.appendChild(s);
  });
  pdfListo ||= cargar("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js")
    .then(() => cargar("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"))
    .catch((e) => { pdfListo = null; throw e; });
  return pdfListo;
}

async function generarPdf(doc) {
  await cargarPdf();
  const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });
  const cfg = E.config, M = 15, W = 215.9 - 2 * M;
  const azul = [36, 40, 44];
  pdf.setFillColor(245, 196, 0);
  for (let x = 0; x < 216; x += 8) pdf.triangle(x, 0, x + 4, 0, x, 4, "F");    // franja de obra
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(...azul);
  pdf.text(cfg.empresa_nombre || "Bodega", M, 18);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(90);
  pdf.text([cfg.empresa_nit ? `NIT: ${cfg.empresa_nit}` : "", cfg.empresa_direccion, cfg.empresa_telefono ? `Tel: ${cfg.empresa_telefono}` : ""].filter(Boolean).join("   "), M, 23);
  pdf.setTextColor(...azul); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
  pdf.text(doc.titulo, M + W, 15, { align: "right" });
  pdf.text(`No. ${doc.numero}`, M + W, 20.5, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  let y = 25.5;
  [["Fecha", doc.fecha], ...(doc.extra || [])].filter(([, val]) => val).forEach(([k, val]) => { pdf.text(`${k}: ${val}`, M + W, y, { align: "right" }); y += 4.5; });
  if (doc.anulado) { pdf.setTextColor(200, 30, 20); pdf.setFont("helvetica", "bold"); pdf.text("ANULADO", M + W, y, { align: "right" }); y += 4.5; pdf.setTextColor(...azul); }
  y = Math.max(y, 32) + 2;
  const cl = doc.cliente;
  pdf.setFillColor(241, 244, 248); pdf.rect(M, y, W, 14, "F");
  pdf.setFontSize(9.5);
  pdf.setFont("helvetica", "bold"); pdf.text("Cliente:", M + 3, y + 5.5); pdf.text(`${cl.tipo_doc}:`, M + 3, y + 10.5);
  pdf.text("Teléfono:", M + W / 2, y + 5.5); pdf.text("Dirección:", M + W / 2, y + 10.5);
  pdf.setFont("helvetica", "normal");
  pdf.text(String(cl.nombre), M + 19, y + 5.5); pdf.text(String(cl.documento), M + 19, y + 10.5);
  pdf.text(String(cl.telefono || ""), M + W / 2 + 19, y + 5.5); pdf.text(String(cl.direccion || "").slice(0, 60), M + W / 2 + 19, y + 10.5);
  pdf.autoTable({
    startY: y + 18, margin: { left: M, right: M }, theme: "plain",
    head: [["Descripción", "Cant.", "Cobro por", doc.etiquetaTiempo || "Tiempo", "Tarifa", "Subtotal"]],
    body: doc.items.map((i) => [i.descripcion, i.cantidad, i.unidad || "", i.unidad ? num(i.tiempo) : "", i.tarifa ? pesos(i.tarifa) : "", pesos(i.subtotal)]),
    headStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 246, 248] }, styles: { fontSize: 9, cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 78 }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });
  y = pdf.lastAutoTable.finalY + 6;
  const fila = (k, val, negrita) => {
    pdf.setFont("helvetica", negrita ? "bold" : "normal"); pdf.setFontSize(negrita ? 11.5 : 9.5);
    pdf.text(k, M + W - 70, y); pdf.text(val, M + W, y, { align: "right" }); y += negrita ? 7 : 5;
  };
  fila("Subtotal", pesos(doc.subtotal)); fila(`IVA (${num(doc.iva_pct)} %)`, pesos(doc.iva));
  pdf.setDrawColor(...azul); pdf.line(M + W - 70, y - 3, M + W, y - 3); y += 1.5;
  fila("TOTAL", pesos(doc.total), true);
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  const parrafo = (titulo, texto, gris) => {
    if (!texto) return;
    if (titulo) { pdf.setFont("helvetica", "bold"); pdf.text(titulo, M, y); y += 4.5; pdf.setFont("helvetica", "normal"); }
    pdf.setTextColor(gris ? 110 : 30);
    const lineas = pdf.splitTextToSize(texto, W);
    pdf.text(lineas, M, y); y += lineas.length * 4.2 + 3; pdf.setTextColor(...azul);
  };
  y += 2;
  parrafo("Observaciones", doc.observaciones);
  parrafo("", doc.nota, true);
  parrafo("", cfg.pie_documentos, true);
  if (doc.firmas) {
    y = Math.max(y + 22, 225);
    pdf.line(M + 5, y, M + 75, y); pdf.line(M + W - 75, y, M + W - 5, y);
    pdf.text("Entrega (bodega)", M + 40, y + 5, { align: "center" }); pdf.text("Recibe (cliente)", M + W - 40, y + 5, { align: "center" });
  }
  pdf.save(`${doc.numero}.pdf`);
}

async function pdfCotizacion(id) {
  const d = await api("bod_cotizacion", { p_id: id });
  const c = d.cotizacion;
  await generarPdf({
    titulo: "COTIZACIÓN", numero: c.numero, fecha: c.fecha, extra: [["Válida hasta", c.valida_hasta]], cliente: d.cliente,
    items: d.items.map((i) => ({ ...i, unidad: UNIDAD[i.modalidad] })), subtotal: c.subtotal, iva_pct: c.iva_pct, iva: c.iva, total: c.total,
    observaciones: c.observaciones, anulado: c.estado === "anulada", nota: "Valores sujetos a disponibilidad de los equipos al momento del alquiler.",
  });
}

async function pdfRemision(id) {
  const d = await api("bod_alquiler", { p_id: id });
  const a = d.alquiler;
  const items = d.items.filter((i) => !i.fecha_devolucion && !i.es_corte).map((i) => ({
    descripcion: `${i.nombre} (${i.codigo})\nSale: ${i.fecha_salida}`, cantidad: i.cantidad, unidad: UNIDAD[i.modalidad],
    tiempo: i.tiempo_estimado, tarifa: i.tarifa, subtotal: Math.round(i.cantidad * i.tiempo_estimado * i.tarifa),
  })).concat(d.cargos.filter((x) => !x.factura).map((x) => ({ descripcion: x.concepto, cantidad: 1, unidad: "", tiempo: 1, tarifa: 0, subtotal: x.valor })));
  const t = conIva(items.reduce((s, i) => s + i.subtotal, 0));
  await generarPdf({
    titulo: "REMISIÓN DE ALQUILER", numero: a.numero, fecha: a.fecha_salida, extra: [["Devolución prevista", a.fecha_prevista || "Sin definir"]],
    cliente: d.cliente, items, subtotal: t.sub, iva_pct: ivaPct(), iva: t.iva, total: t.total, observaciones: a.observaciones,
    firmas: true, etiquetaTiempo: "Tiempo est.", anulado: !!a.anulado,
    nota: "Equipos en poder del cliente. Valor estimado: el cobro final se liquida con el tiempo real de uso al devolver los equipos. El cliente los recibe en buen estado y responde por daños o pérdidas.",
  });
}

async function pdfFactura(id) {
  const d = await api("bod_factura", { p_id: id });
  const f = d.factura;
  await generarPdf({
    titulo: "FACTURA", numero: f.numero, fecha: f.fecha,
    extra: [["Alquiler", d.alquiler], ["Pagada", f.pagada_el ? `${f.pagada_el} ${f.medio_pago || ""}`.trim() : ""]],
    cliente: d.cliente, items: d.items, subtotal: f.subtotal, iva_pct: f.iva_pct, iva: f.iva, total: f.total,
    observaciones: f.observaciones, anulado: f.estado === "anulada",
    nota: "Documento interno de control. No es factura electrónica de venta ante la DIAN.",
  });
}

// ================================================================ Usuarios
const PERMISOS = [
  ["inv_editar", "Inventario", "Crear y editar equipos y sus tarifas"], ["inv_ingresar", "Inventario", "Ingresar unidades y reactivar equipos"],
  ["inv_baja", "Inventario", "Dar de baja equipos"], ["clientes", "Clientes", "Crear y editar clientes"],
  ["cotizaciones", "Cotizaciones", "Crear y anular cotizaciones"],
  ["alq_crear", "Alquileres", "Crear alquileres, agregar equipos, prórrogas y cargos"], ["alq_devolver", "Alquileres", "Recibir equipos y hacer cortes de cobro"],
  ["precios", "Alquileres", "Cobrar distinto a lo pactado (tarifa, modalidad, tiempo)"], ["alq_corregir", "Alquileres", "Corregir cobros, deshacer devoluciones y quitar renglones"],
  ["alq_anular", "Alquileres", "Anular alquileres"], ["fac_ver", "Facturas", "Ver las facturas y la cartera"], ["fac_emitir", "Facturas", "Emitir facturas"],
  ["fac_pago", "Facturas", "Registrar pagos"], ["fac_anular", "Facturas", "Anular facturas y quitar pagos"],
  ["eliminar", "Administración", "Eliminar lo creado por error (va a la papelera)"],
  ["super", "Administración", "Superusuario: editar y eliminar todo, con motivo"],
  ["usuarios", "Administración", "Gestionar usuarios y sus permisos"], ["config", "Administración", "Cambiar la configuración"],
];
const PERFILES = { admin: "Administrador", bodeguero: "Bodeguero", vendedor: "Vendedor" };
const PLANTILLAS = {
  admin: PERMISOS.map((p) => p[0]),
  bodeguero: ["inv_editar", "inv_ingresar", "inv_baja", "clientes", "alq_crear", "alq_devolver"],
  vendedor: ["clientes", "cotizaciones", "alq_crear", "alq_devolver", "precios", "fac_ver", "fac_emitir", "fac_pago"],
};
function resumenPermisos(u) {
  if (u.rol === "admin") return "Acceso total";
  const grupos = [...new Set(PERMISOS.map((p) => p[1]))];
  return grupos.map((g) => {
    const claves = PERMISOS.filter((p) => p[1] === g).map((p) => p[0]);
    const n = claves.filter((k) => u.permisos.includes(k)).length;
    return n ? (n === claves.length ? g : `${g} (${n} de ${claves.length})`) : "";
  }).filter(Boolean).join(", ") || "Solo consulta";
}

PAGINAS.usuarios = {
  montar(raiz) {
    raiz.innerHTML = `<h1>Usuarios</h1>
      <p class="ayuda">Cada persona entra con su usuario y su contraseña. Los permisos se marcan uno por uno; el perfil solo sugiere los habituales.</p>
      <div class="barra"><button class="btn" id="b-nuevo">${ICONOS.mas} Nuevo usuario</button></div><div id="lista"></div>`;
    $("#b-nuevo").onclick = () => dialogoUsuario(null);
  },
  async actualizar() {
    E.datos.usuarios = await api("bod_usuarios");
    $("#lista").innerHTML = `<table class="tabla"><thead><tr><th>Estado</th><th>Usuario</th><th>Perfil</th><th>Puede</th></tr></thead><tbody>
      ${E.datos.usuarios.map((u) => `<tr data-id="${u.id}"><td class="sin-titulo">${chip(!u.activo ? ["Sin acceso", "gris"] : u.debe_cambiar_clave ? ["Con clave temporal", "amarillo"] : ["Activo", "verde"])}</td>
        <td data-t="Usuario"><span><span class="principal">${h(u.nombre)}</span><br><span class="sec">${h(u.usuario)}</span></span></td>
        <td data-t="Perfil">${PERFILES[u.rol]}</td><td data-t="Puede">${h(resumenPermisos(u))}</td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("#lista tbody tr").forEach((tr) => {
      tr.onclick = () => fichaUsuario(E.datos.usuarios.find((u) => u.id === Number(tr.dataset.id)));
    });
  },
};

function fichaUsuario(u) {
  const v = abrirVentana({
    titulo: h(u.nombre),
    cuerpo: `<dl class="ficha"><dt>Usuario</dt><dd>${h(u.usuario)}</dd><dt>Perfil</dt><dd>${PERFILES[u.rol]}</dd>
        <dt>Puede</dt><dd>${h(resumenPermisos(u))}</dd><dt>Estado</dt><dd>${!u.activo ? "Sin acceso" : u.debe_cambiar_clave ? "Debe crear su contraseña al entrar" : "Activo"}</dd></dl>
      <div class="acciones"><button class="btn" data-a="editar">Editar y permisos</button><button class="btn claro" data-a="clave">Poner contraseña temporal</button>
        ${puede("eliminar") || puede("super") ? '<button class="btn peligro" data-a="eliminar">Eliminar</button>' : ""}</div>`,
  });
  const acc = {
    editar: () => dialogoUsuario(u),
    clave: () => formulario({
      titulo: `Contraseña temporal para ${h(u.nombre)}`, textoGuardar: "Poner contraseña",
      intro: "<p>Désela a la persona. Al entrar, la página le pedirá crear una propia.</p>",
      campos: [{ k: "clave", e: "Contraseña temporal (mínimo 6)", req: true }],
      guardar: async (x) => { await api("bod_usuario_clave", { p_id: u.id, p_nueva: x.clave }); avisar("Contraseña temporal puesta."); refrescar(); },
    }),
    eliminar: () => pedirMotivo({
      titulo: `Eliminar a ${h(u.nombre)}`, textoBoton: "Eliminar",
      mensaje: "Si ya registró operaciones no se puede eliminar: en ese caso quítele el acceso desde «Editar y permisos».",
      accion: async (m) => { await api("bod_eliminar", { p_tipo: "usuario", p_id: u.id, p_motivo: m }); avisar("Usuario enviado a la papelera."); refrescar(); },
    }),
  };
  v.querySelectorAll("[data-a]").forEach((b) => { b.onclick = () => { v.cerrar(); acc[b.dataset.a](); }; });
}

function dialogoUsuario(u) {
  const soyAdmin = E.usuario.rol === "admin";
  const marcados = new Set(u ? u.permisos : PLANTILLAS.vendedor);
  const grupos = [...new Set(PERMISOS.map((p) => p[1]))];
  const v = abrirVentana({
    titulo: u ? `Editar ${h(u.nombre)}` : "Nuevo usuario", ancha: true,
    cuerpo: `<div class="error-campo oculto" role="alert"></div>
      <div class="dos">
        <div class="campo"><label for="u-usuario">Usuario *</label><input id="u-usuario" type="text" autocapitalize="none" value="${h(u?.usuario || "")}">
          <div class="nota">Sin espacios ni tildes. Por ejemplo: carolina.v</div></div>
        <div class="campo"><label for="u-nombre">Nombre completo *</label><input id="u-nombre" type="text" value="${h(u?.nombre || "")}"></div>
        ${u ? "" : '<div class="campo"><label for="u-clave">Contraseña temporal * (mínimo 6)</label><input id="u-clave" type="text" autocomplete="off"><div class="nota">Al entrar la primera vez, la persona creará la suya.</div></div>'}
        <div class="campo"><label for="u-rol">Perfil</label><select id="u-rol">${Object.entries(PERFILES).filter(([k]) => k !== "admin" || soyAdmin)
          .map(([k, t]) => `<option value="${k}" ${(u?.rol || "vendedor") === k ? "selected" : ""}>${t}${k === "admin" ? " (acceso total)" : ""}</option>`).join("")}</select></div>
      </div>
      <label class="check" style="margin-bottom:12px"><input type="checkbox" id="u-activo" ${!u || u.activo ? "checked" : ""}> Puede entrar a la página</label>
      <div class="casillas">${grupos.map((g) => `<fieldset><legend>${g}</legend>${PERMISOS.filter((p) => p[1] === g).map(([k, , t]) => `
        <label class="${k === "super" ? "super-casilla" : ""}"><input type="checkbox" data-p="${k}" ${marcados.has(k) ? "checked" : ""}
          ${soyAdmin || E.usuario.permisos.includes(k) ? "" : "data-ajeno disabled"}> ${t}</label>`).join("")}</fieldset>`).join("")}</div>`,
    pie: '<button class="btn claro" data-no>Cancelar</button><button class="btn" data-si>Guardar usuario</button>',
  });
  const casillas = [...v.querySelectorAll("[data-p]")];
  const aplicarPerfil = (cambio) => {
    const rol = $("#u-rol", v).value;
    casillas.forEach((c) => {
      if (cambio && !c.hasAttribute("data-ajeno")) c.checked = PLANTILLAS[rol].includes(c.dataset.p);
      if (rol === "admin") c.checked = true;
      c.disabled = rol === "admin" || c.hasAttribute("data-ajeno");
    });
  };
  $("#u-rol", v).onchange = () => aplicarPerfil(true);
  aplicarPerfil(false);
  $("[data-no]", v).onclick = v.cerrar;
  $("[data-si]", v).onclick = async () => {
    const err = $(".error-campo", v);
    err.classList.add("oculto");
    try {
      await api("bod_usuario_guardar", {
        p_id: u?.id ?? null, p_datos: {
          usuario: $("#u-usuario", v).value, nombre: $("#u-nombre", v).value, rol: $("#u-rol", v).value,
          activo: $("#u-activo", v).checked, clave: $("#u-clave", v) ? $("#u-clave", v).value : "",
          permisos: casillas.filter((c) => c.checked).map((c) => c.dataset.p),
        },
      });
      v.cerrar(); avisar(u ? "Usuario actualizado." : "Usuario creado. Entréguele su usuario y la contraseña temporal."); refrescar();
    } catch (e) { err.textContent = e.message; err.classList.remove("oculto"); err.scrollIntoView({ block: "nearest" }); }
  };
}

// =========================================================== Configuración
PAGINAS.config = {
  montar(raiz) {
    const c = E.config;
    const campo = (k, e, nota = "", tipo = "text") => `<div class="campo"><label for="cf-${k}">${e}</label>
      <input id="cf-${k}" type="${tipo}" value="${h(c[k] || "")}">${nota ? `<div class="nota">${nota}</div>` : ""}</div>`;
    raiz.innerHTML = `<h1>Configuración</h1>
      <form id="f-config" style="max-width:640px">
        <div class="error-campo oculto" role="alert"></div>
        <h2>Empresa</h2><p class="ayuda">Sale en el encabezado de cotizaciones, remisiones y facturas.</p>
        ${campo("empresa_nombre", "Nombre")}${campo("empresa_nit", "NIT")}${campo("empresa_direccion", "Dirección")}${campo("empresa_telefono", "Teléfono")}
        <div class="campo"><label for="cf-pie_documentos">Texto al pie de los documentos</label><textarea id="cf-pie_documentos">${h(c.pie_documentos || "")}</textarea></div>
        <h2>Cobros</h2>
        <div class="dos">${campo("iva_pct", "IVA (%)", "Ponga 0 si no cobra IVA.")}${campo("validez_dias", "Días de validez de las cotizaciones")}
        ${campo("gracia_dia_min", "Minutos de gracia por día", "Con 60, si devuelven 40 min después de cumplir el día, no se cobra otro.")}
        ${campo("gracia_hora_min", "Minutos de gracia por hora")}</div>
        <button class="btn" type="submit">Guardar configuración</button>
      </form>`;
    $("#f-config").onsubmit = async (ev) => {
      ev.preventDefault();
      const err = $("#f-config .error-campo");
      err.classList.add("oculto");
      const datos = {};
      ["empresa_nombre", "empresa_nit", "empresa_direccion", "empresa_telefono", "pie_documentos", "iva_pct", "validez_dias", "gracia_dia_min", "gracia_hora_min"]
        .forEach((k) => { datos[k] = $("#cf-" + k).value.trim(); });
      try {
        await api("bod_config_guardar", { p_datos: datos });
        await cargarYo();
        $(".marca").firstChild.textContent = E.config.empresa_nombre || "Bodega";
        avisar("Configuración guardada.");
      } catch (e) { err.textContent = e.message; err.classList.remove("oculto"); }
    };
  },
};

// ============================================================ Más (celular)
PAGINAS.mas = {
  montar(raiz) {
    raiz.innerHTML = `<h1>Más</h1><div class="mas-lista">
      ${Object.entries(VISTAS).filter(([, v]) => v.ver() && !v.movil && !v.soloMovil && !v.sinMenu)
        .map(([k, v]) => `<a href="#${k}">${v.icono}${v.titulo}</a>`).join("")}
      <a href="#cuenta">${ICONOS.usuarios}Mi cuenta</a></div>`;
  },
};

// ------------------------------------------------------------------- arranque
(async function arrancar() {
  E.sesion = guardado.leer("bodega_sesion");
  if (!E.sesion) return pantallaIngreso();
  try {
    await cargarYo();
    iniciarApp();
  } catch (e) {
    if (e.codigo !== "BS401") pantallaIngreso(e.message);
  }
})();
