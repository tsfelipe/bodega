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
function cerrarVentana() { $("#modal-raiz").innerHTML = ""; }

function abrirVentana({ titulo, cuerpo, pie = "" }) {
  $("#modal-raiz").innerHTML = `
    <div class="fondo"><section class="ventana" role="dialog" aria-modal="true" aria-label="${h(titulo)}">
      <header><h3>${titulo}</h3><button class="cerrar" aria-label="Cerrar">×</button></header>
      <div class="cuerpo">${cuerpo}</div>${pie ? `<footer>${pie}</footer>` : ""}
    </section></div>`;
  const raiz = $("#modal-raiz");
  $(".cerrar", raiz).onclick = cerrarVentana;
  $(".fondo", raiz).addEventListener("mousedown", (ev) => { if (ev.target.classList.contains("fondo")) cerrarVentana(); });
  return $(".ventana", raiz);
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
      cerrarVentana();
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove("oculto");
      err.scrollIntoView({ block: "nearest" });
    } finally { btn.disabled = false; }
  };
  $("[data-cancelar]", v).onclick = cerrarVentana;
  $("[data-guardar]", v).onclick = enviar;
  $("#form-v", v).onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  const primero = $("input, select, textarea", v);
  if (primero) setTimeout(() => primero.focus(), 30);
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
  cerrarVentana();
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
const VISTAS = {
  inicio: { titulo: "Inicio", icono: ICONOS.inicio, ver: () => true },
  inventario: { titulo: "Inventario", icono: ICONOS.inventario, ver: () => true },
  clientes: { titulo: "Clientes", icono: ICONOS.clientes, ver: () => true },
  papelera: { titulo: "Papelera", icono: ICONOS.papelera, ver: () => puede("super") || puede("eliminar") },
  registro: { titulo: "Registro", icono: ICONOS.registro, ver: () => puede("super") || puede("usuarios") || puede("eliminar") },
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
    .map(([k, v]) => `<a href="#${k}" data-v="${k}">${v.icono}<span>${v.titulo}</span></a>`).join("");
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
  cerrarVentana();
  PAGINAS[k].montar($("#vista"));
  refrescar();
}

async function refrescar() {
  if (!E.usuario || !E.vista) return;
  const p = PAGINAS[E.vista];
  if (!p.actualizar) return;
  try { await p.actualizar(); } catch (e) { if (e.codigo !== "RED" && e.codigo !== "BS401") avisar(e.message, true); }
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
      tr.onclick = () => {
        const a = r.abiertos[tr.dataset.i];
        abrirVentana({
          titulo: `${h(a.numero)}: ${h(a.cliente)}`,
          cuerpo: `${chip(ETQ[a.sem])}<dl class="ficha" style="margin-top:12px">
              <dt>Qué tiene</dt><dd>${h(a.equipos)}</dd><dt>Salió</dt><dd>${h(a.fecha_salida)}</dd>
              <dt>Debe volver</dt><dd>${h(a.fecha_prevista || "Sin fecha")}</dd><dt>Teléfono</dt><dd>${h(a.telefono || "No registrado")}</dd></dl>
            <div class="acciones">${telefonoLinks(a.telefono)}</div>`,
        });
      };
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
    b.onclick = () => ({
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

function formCliente(c = null) {
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
      await api("bod_cliente_guardar", { p_id: c?.id ?? null, p_datos: d });
      avisar(c ? "Cambios guardados." : "Cliente registrado."); refrescar();
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
