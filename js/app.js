/* Agenda — Rinze Studio */
(function () {
'use strict';

const VERSION = 'V.10';
const CHANGELOG = [
  ['V.10', '2026-11-25', 'Al programar rutas, los camiones se listan de mayor a menor capacidad de parrillas.'],
  ['V.9', '2026-11-25', 'Traslados Z18 en orden fijo: GMC, AXEL, GRANDE (otros camiones de Z18 después).'],
  ['V.8', '2026-11-25', 'Selector de camión en columnas (camión y matrícula, chofer asignado, parrillas) con buscador al programar rutas.'],
  ['V.7', '2026-11-25', 'Plantillas de mensajes de WhatsApp por tipo de ausencia, con variables y vista previa (Ajustes).'],
  ['V.6', '2026-11-25', 'GRANDE (Z18) = 205BDM Poison. Camiones: buscador, filtros y casilla “En agenda”. Colaboradores: buscador y control de duplicados por tarjeta y nombre.'],
  ['V.5', '2026-11-25', 'Carga inicial desde Excel: 86 colaboradores con tarjeta y puesto, y 45 camiones con matrícula, capacidad y chofer. Puesto visible para todos los roles.'],
  ['V.4', '2026-11-25', 'Aviso por WhatsApp al autorizar permisos y vacaciones; número de tarjeta del colaborador; rol “Otro” con puesto (empacadores, verificadoras…) y filtro “Otros”.'],
  ['V.3', '2026-11-25', 'Sincronización compatible con el almacenamiento Blob conectado por OIDC.'],
  ['V.2', '2026-11-25', 'Logo oficial de Rinze Studio y registro de versiones en Ajustes.'],
  ['V.1', '2026-11-25', 'Primera versión: día tipo libreta, rutas, empaques, Z18, ausencias, semana, calendario, consultas, parámetros, PDF, respaldo y sincronización.'],
];
const LS_STATE = 'agenda.state.v1';
const LS_KEY = 'agenda.syncKey';
const LS_PENDING = 'agenda.pending';
const LS_LASTSYNC = 'agenda.lastSync';
const COLS = ['people', 'trucks', 'clients', 'products', 'holidays', 'absences', 'days', 'templates'];

/* ---------------- Utilidades ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TIPOS = {
  falta: { label: 'Falta', cls: 'falta' },
  permiso: { label: 'Permiso', cls: 'permiso' },
  vacaciones: { label: 'Vacaciones', cls: 'vacaciones' },
  igss: { label: 'Suspensión IGSS', cls: 'igss' },
};
const ROLES = { chofer: 'Chofer', ayudante: 'Ayudante', ambos: 'Chofer y ayudante', otro: 'Otro' };
const PUESTOS = ['Empacador', 'Empacadora', 'Verificador', 'Verificadora', 'Bodeguero', 'Auxiliar', 'Supervisor'];
const isChofer = (p) => p.rol === 'chofer' || p.rol === 'ambos';
const isAyud = (p) => p.rol === 'ayudante' || p.rol === 'ambos';
const roleLabel = (p) => (p.rol === 'otro' ? (p.puesto || 'Otro') : ROLES[p.rol] || '');
const puestoOf = (p) => p.puesto || roleLabel(p);
const tarjeta = (p) => (p && p.tarjeta ? ' · #' + p.tarjeta : '');

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parse(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function addDays(iso, n) { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); }
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
function todayISO() { return toISO(new Date()); }
function dow(iso) { return parse(iso).getDay(); }
function fmtLong(iso) { const d = parse(iso); return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear(); }
function fmtShort(iso) { const d = parse(iso); return d.getDate() + ' ' + MES_C[d.getMonth()]; }
function fmtRange(a, b) {
  if (!b || a === b) return fmtShort(a);
  const da = parse(a), db = parse(b);
  if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) return da.getDate() + ' – ' + db.getDate() + ' ' + MES_C[db.getMonth()];
  return fmtShort(a) + ' – ' + fmtShort(b);
}
function mondayOf(iso) { const w = dow(iso); return addDays(iso, w === 0 ? -6 : 1 - w); }

/* Semana Walmart: el año fiscal inicia el sábado más cercano al 1 de febrero */
function wmStart(y) {
  const f = new Date(y, 1, 1, 12);
  let diff = 6 - f.getDay();
  if (diff > 3) diff -= 7;
  return toISO(new Date(y, 1, 1 + diff, 12));
}
function wmWeek(iso) {
  let y = parse(iso).getFullYear();
  if (iso < wmStart(y)) y--;
  const w = Math.floor(diffDays(wmStart(y), iso) / 7) + 1;
  return String(y) + pad(w);
}

/* ---------------- Íconos ---------------- */
const I = {
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  book: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M9 8h6M9 12h6"/>',
  week: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M21 20c0-2-1-4-3-4.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 13h7M9 17h5"/>',
  wa: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.9z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const appIcon = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="11" fill="#1B2A4A"/><rect x="14" y="9" width="23" height="30" rx="3" fill="#F3EAD6"/><path d="M19 17h13M19 22h13M19 27h9" stroke="#1B2A4A" stroke-width="2" stroke-linecap="round"/><path d="M11 14h6M11 20h6M11 26h6M11 32h6" stroke="#C9B98F" stroke-width="2.4" stroke-linecap="round"/></svg>`;
let rzN = 0;
/* Logo oficial Rinze Studio (icons/rinze-studio.svg) */
const rinze = (h = 22) => {
  const g = 'rzg' + rzN, t = 'rzt' + rzN, f = 'rzf' + (rzN++);
  const st = `fill="none" stroke="url(#${g})" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"`;
  return `<span class="rinze" title="Rinze Studio"><svg role="img" aria-label="Rinze Studio" height="${h}" width="${Math.round(h * 920 / 320)}" viewBox="0 0 920 320"><defs>
<linearGradient id="${g}" x1="10%" y1="10%" x2="90%" y2="90%"><stop offset="0%" stop-color="#68FF6B"/><stop offset="45%" stop-color="#00FF88"/><stop offset="100%" stop-color="#00C4FF"/></linearGradient>
<linearGradient id="${t}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#68FF6B"/><stop offset="100%" stop-color="#4ADE80"/></linearGradient>
<filter id="${f}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter></defs>
<g transform="translate(55,45)" filter="url(#${f})"><path d="M35 25L135 25A68 68 0 0 1 135 161L122 161L195 235L152 235L88 168L58 168L58 235L35 235L35 142L85 142" ${st}/><path d="M85 68L132 68A26 26 0 0 1 132 120L95 120" ${st}/><path d="M35 102L35 25L85 142" ${st}/>
<g fill="url(#${g})"><circle cx="35" cy="25" r="13"/><circle cx="85" cy="68" r="12"/><circle cx="85" cy="142" r="12"/><circle cx="122" cy="161" r="12"/><circle cx="35" cy="235" r="13"/><circle cx="195" cy="235" r="13"/></g></g>
<g transform="translate(315,45)" font-family="Inter,-apple-system,'Segoe UI',Roboto,sans-serif"><text x="0" y="138" font-size="136" font-weight="600" fill="#FFFFFF" letter-spacing="-2">Rinze</text><text x="6" y="218" font-size="52" font-weight="500" fill="url(#${t})" letter-spacing="22">STUDIO</text></g></svg></span>`;
};

/* ---------------- Estado ---------------- */
function emptyState() { const c = {}; COLS.forEach((k) => (c[k] = {})); return { v: 1, col: c }; }
let S = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (raw) { const s = JSON.parse(raw); COLS.forEach((k) => (s.col[k] = s.col[k] || {})); return s; }
  } catch (e) { console.error(e); }
  return emptyState();
}
function persist(push = true) {
  localStorage.setItem(LS_STATE, JSON.stringify(S));
  if (push) { localStorage.setItem(LS_PENDING, '1'); schedulePush(); updateSyncUI(); }
}
function all(col) { return Object.values(S.col[col]).filter((r) => !r._d); }
function get(col, id) { const r = S.col[col][id]; return r && !r._d ? r : null; }
function put(col, rec, push = true) { rec._u = Date.now(); S.col[col][rec.id] = rec; persist(push); }
function del(col, id) { S.col[col][id] = { id, _d: 1, _u: Date.now() }; persist(); }

function mergeCols(a, b) {
  const out = {};
  COLS.forEach((c) => {
    out[c] = Object.assign({}, (a && a[c]) || {});
    const src = (b && b[c]) || {};
    Object.keys(src).forEach((id) => {
      const r = src[id], cur = out[c][id];
      if (!cur || (r._u || 0) > (cur._u || 0)) out[c][id] = r;
    });
  });
  return out;
}

const byName = (a, b) => String(a.nombre || a.codigo).localeCompare(String(b.nombre || b.codigo), 'es');
const people = () => all('people').sort(byName);
const activePeople = () => people().filter((p) => p.activo !== false);
const trucks = () => all('trucks').sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true }));
const truckOn = (t) => t.activo !== false;
const Z18_ORDEN = ['GMC', 'AXEL', 'GRANDE'];
const z18Rank = (t) => { const i = Z18_ORDEN.indexOf(String(t.nombre || '').toUpperCase()); return i < 0 ? 99 : i; };
const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clients = () => all('clients').filter((c) => c.activo !== false).sort(byName);
const products = () => all('products').sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || byName(a, b));
const pname = (id) => (get('people', id) || {}).nombre || '—';
const tname = (id) => (get('trucks', id) || {}).nombre || '—';
const cname = (id) => (get('clients', id) || {}).nombre || '—';
const prodName = (id) => (get('products', id) || {}).codigo || '—';

/* Semilla inicial: ids fijos para que dos equipos no dupliquen registros al sincronizar */
function seed() {
  if (all('people').length || all('trucks').length || all('clients').length) return;
  const T = 1;
  const add = (col, rec) => { rec._u = T; S.col[col][rec.id] = rec; };
  [['Alfredo', 'chofer'], ['Yenner', 'ayudante'], ['Pineda', 'chofer'], ['Bryan', 'ayudante'], ['Adolfo', 'ayudante'], ['Boris', 'ambos'],
   ['Kevin', 'ayudante'], ['Mynor', 'chofer'], ['René', 'ayudante'], ['Sergio', 'ambos'], ['Edwin', 'ayudante'], ['Estrada', 'chofer'],
   ['Estuardo', 'ayudante'], ['Julio', 'ayudante'], ['Pedroza', 'chofer'], ['Gilmar', 'ayudante'], ['Rodolfo', 'ayudante'], ['Otoniel', 'chofer'],
   ['Eulalio', 'chofer'], ['Tyron', 'ayudante'], ['Wer', 'chofer'], ['Jorge', 'chofer'], ['Juan Alberto', 'chofer'], ['Felipe', 'chofer'],
   ['Natividad', 'ayudante'], ['Fernanda', 'ayudante']]
    .forEach(([n, r]) => add('people', { id: 'p-' + n.toLowerCase().replace(/[^a-z]/g, ''), nombre: n, rol: r, area: 'Despacho', activo: true }));
  [['GMC', ['z18']], ['AXEL', ['z18']], ['GRANDE', ['z18']]]
    .forEach(([n, u]) => add('trucks', { id: 't-' + n.toLowerCase(), nombre: n, matricula: '', capacidad: '', choferModo: 'varios', chofer: '', choferes: [], uso: u }));
  [['FRAGUA (CEDI)', false], ['BELCA', true], ['LAI LAI', false], ['FU LAI', false], ['MYNOR', false], ['ESTUARDO', false], ['XELA', false]]
    .forEach(([n, p]) => add('clients', { id: 'c-' + n.toLowerCase().replace(/[^a-z]/g, ''), nombre: n, usaParrillas: p, activo: true }));
  ['SR16', 'S16', 'S19M', 'S25 Olid', 'S25M', 'PL1U', 'PL1U pm', 'CZ5', '20CZ4']
    .forEach((c, i) => add('products', { id: 'pr-' + c.toLowerCase().replace(/[^a-z0-9]/g, ''), codigo: c, orden: i }));
  [['2026-01-01', 'Año Nuevo'], ['2026-04-02', 'Jueves Santo'], ['2026-04-03', 'Viernes Santo'], ['2026-04-04', 'Sábado Santo'], ['2026-05-01', 'Día del Trabajo'],
   ['2026-06-30', 'Día del Ejército'], ['2026-09-15', 'Independencia'], ['2026-10-20', 'Revolución de 1944'], ['2026-11-01', 'Todos los Santos'],
   ['2026-12-24', 'Nochebuena', true], ['2026-12-25', 'Navidad'], ['2026-12-31', 'Fin de año', true],
   ['2027-01-01', 'Año Nuevo'], ['2027-03-25', 'Jueves Santo'], ['2027-03-26', 'Viernes Santo'], ['2027-03-27', 'Sábado Santo'], ['2027-05-01', 'Día del Trabajo'],
   ['2027-06-30', 'Día del Ejército'], ['2027-09-15', 'Independencia'], ['2027-10-20', 'Revolución de 1944'], ['2027-11-01', 'Todos los Santos'],
   ['2027-12-24', 'Nochebuena', true], ['2027-12-25', 'Navidad'], ['2027-12-31', 'Fin de año', true]]
    .forEach(([f, n, m]) => add('holidays', { id: 'h-' + f, fecha: f, nombre: n, medio: !!m }));
  persist(false);
}

/* Migración V.5: carga inicial de colaboradores y camiones desde Excel */
const LS_MIG = 'agenda.migracion';
function migrateV5() {
  const C = window.AGENDA_CARGA;
  if (!C || +(localStorage.getItem(LS_MIG) || 0) >= 5) return;
  const now = Date.now();
  const live = (col, id) => { const r = S.col[col][id]; return r && !r._d; };
  C.people.forEach((p) => { if (!S.col.people[p.id]) S.col.people[p.id] = Object.assign({}, p, { _u: 2 }); });
  C.trucks.forEach((t) => { if (!S.col.trucks[t.id]) S.col.trucks[t.id] = Object.assign({}, t, { _u: 2 }); });
  const mapP = (id) => C.remapP[id] || id, mapT = (id) => C.remapT[id] || id;
  const touch = (col, r, fn) => { const before = JSON.stringify(r); fn(r); if (JSON.stringify(r) !== before) r._u = now; };
  const fixDay = (d) => {
    (d.rutas || []).forEach((r) => (r.camiones || []).forEach((c) => { c.truck = mapT(c.truck); c.chofer = mapP(c.chofer); c.ayudantes = [...new Set((c.ayudantes || []).map(mapP))]; }));
    if (d.z18) {
      const v = {}; Object.entries(d.z18.viajes || {}).forEach(([k, n]) => (v[mapT(k)] = n)); d.z18.viajes = v;
      (d.z18.apoyo || []).forEach((a) => { a.truck = mapT(a.truck); a.chofer = mapP(a.chofer); });
    }
  };
  Object.values(S.col.days).forEach((d) => { if (!d._d) touch('days', d, fixDay); });
  Object.values(S.col.templates).forEach((d) => { if (!d._d) touch('templates', d, fixDay); });
  Object.values(S.col.absences).forEach((a) => { if (!a._d) touch('absences', a, (x) => (x.personId = mapP(x.personId))); });
  Object.values(S.col.trucks).forEach((t) => { if (!t._d) touch('trucks', t, (x) => { x.chofer = mapP(x.chofer); x.choferes = [...new Set((x.choferes || []).map(mapP))]; }); });
  // Retira los registros de ejemplo que ya tienen su equivalente del Excel
  Object.keys(C.remapP).forEach((id) => { if (live('people', id)) S.col.people[id] = { id, _d: 1, _u: now }; });
  Object.keys(C.remapT).forEach((id) => { if (live('trucks', id)) S.col.trucks[id] = { id, _d: 1, _u: now }; });
  // Ejemplos sin equivalente: se retiran solo si no se usan en ningún día ni ausencia
  const used = new Set();
  Object.values(S.col.days).concat(Object.values(S.col.templates)).forEach((d) => { if (!d._d) { (d.rutas || []).forEach((r) => (r.camiones || []).forEach((c) => { used.add(c.chofer); (c.ayudantes || []).forEach((a) => used.add(a)); })); ((d.z18 || {}).apoyo || []).forEach((a) => used.add(a.chofer)); } });
  Object.values(S.col.absences).forEach((a) => { if (!a._d) used.add(a.personId); });
  C.dropP.forEach((id) => { if (live('people', id) && !used.has(id)) S.col.people[id] = { id, _d: 1, _u: now }; });
  if (live('people', 'p-eulalio')) { const e = S.col.people['p-eulalio']; if (!e.puesto) { e.puesto = 'Chofer'; e._u = now; } }
  localStorage.setItem(LS_MIG, '5');
  persist();
}

/* Migración V.6: GRANDE (Z18) es el 205BDM Poison */
function migrateV6() {
  if (+(localStorage.getItem(LS_MIG) || 0) >= 6) return;
  const now = Date.now(), NEW = 't-205bdm', OLD = 't-grande';
  const g = S.col.trucks[NEW];
  if (g && !g._d) { g.nombre = 'GRANDE'; g.nota = 'POISON'; g.uso = [...new Set([...(g.uso || []).filter((u) => u !== 'rutas'), 'z18', 'apoyo'])]; g._u = now; }
  const fix = (d) => {
    let ch = false;
    (d.rutas || []).forEach((r) => (r.camiones || []).forEach((c) => { if (c.truck === OLD) { c.truck = NEW; ch = true; } }));
    if (d.z18) {
      if (d.z18.viajes && OLD in d.z18.viajes) { d.z18.viajes[NEW] = d.z18.viajes[OLD]; delete d.z18.viajes[OLD]; ch = true; }
      (d.z18.apoyo || []).forEach((a) => { if (a.truck === OLD) { a.truck = NEW; ch = true; } });
    }
    if (ch) d._u = now;
  };
  Object.values(S.col.days).concat(Object.values(S.col.templates)).forEach((d) => { if (!d._d) fix(d); });
  if (S.col.trucks[OLD] && !S.col.trucks[OLD]._d) S.col.trucks[OLD] = { id: OLD, _d: 1, _u: now };
  localStorage.setItem(LS_MIG, '6');
  persist();
}

/* ---------------- Días ---------------- */
function emptyDay(iso) { return { id: iso, rutas: [], empaques: [], z18: { viajes: {}, apoyo: [] }, notas: [] }; }
function getDay(iso) { const d = get('days', iso); return d ? clone(d) : emptyDay(iso); }
function saveDay(day) { put('days', day); }
function dayHasContent(d) { return d && (d.rutas.length || d.empaques.length || d.notas.length || d.z18.apoyo.length || Object.values(d.z18.viajes || {}).some((v) => +v)); }
function holidayOf(iso) { return all('holidays').find((h) => h.fecha === iso); }
function absencesOn(iso) { return all('absences').filter((a) => a.desde <= iso && iso <= (a.hasta || a.desde)); }
function isOff(iso) { const d = get('days', iso); return dow(iso) === 0 && !(d && d.abierto); }

function dayPeople(day) {
  const ids = new Set();
  day.rutas.forEach((r) => r.camiones.forEach((c) => { if (c.chofer) ids.add(c.chofer); (c.ayudantes || []).forEach((a) => ids.add(a)); }));
  (day.z18.apoyo || []).forEach((a) => a.chofer && ids.add(a.chofer));
  return ids;
}
function conflicts(day) {
  const abs = absencesOn(day.id).filter((a) => a.tipo !== 'vacaciones' || a.estado !== 'solicitada');
  const ids = dayPeople(day);
  return abs.filter((a) => ids.has(a.personId));
}
function absentIds(iso) { return new Set(absencesOn(iso).filter((a) => a.tipo !== 'vacaciones' || a.estado !== 'solicitada').map((a) => a.personId)); }

/* ---------------- UI estado ---------------- */
const ui = {
  view: 'dia',
  date: todayISO(),
  tlStart: addDays(mondayOf(todayISO()), -7),
  paramTab: 'camiones',
  q: { tipo: 'colaborador', person: '', client: '', text: '', desde: addDays(todayISO(), -30), hasta: todayISO(), year: String(new Date().getFullYear()) },
  peopleFilter: 'todos',
  truckFilter: 'todos',
  truckQ: '',
  peopleQ: '',
};

const NAV = [
  ['dia', 'Hoy', 'book'], ['semana', 'Semana', 'week'], ['ausencias', 'Ausencias', 'cal'],
  ['consultas', 'Consultas', 'search'], ['parametros', 'Parámetros', 'people'], ['ajustes', 'Ajustes y PDF', 'gear'],
];

function renderShell() {
  $('#sidebar').innerHTML = `
    <div class="brand">${appIcon(36)}<b>Agenda</b></div>
    ${NAV.map(([k, l, i]) => `<button class="nav-item ${ui.view === k ? 'active' : ''}" data-nav="${k}">${ic(i)}${l}</button>`).join('')}
    <div class="side-foot">${rinze(30)}<button class="sync" data-act="sync-now"><span class="dot" data-syncdot></span><span data-synctext></span></button><span class="version">Agenda ${VERSION}</span></div>`;
  $('#topbar').innerHTML = `<div class="brand">${appIcon(26)}<b>Agenda</b><span class="version">${VERSION}</span><button class="sync" data-act="sync-now" aria-label="Estado de sincronización"><span class="dot" data-syncdot></span></button></div>${rinze(22)}`;
  const bn = [['dia', 'Hoy', 'book'], ['semana', 'Semana', 'week'], ['ausencias', 'Ausencias', 'cal'], ['consultas', 'Consultas', 'search'], ['mas', 'Más', 'more']];
  $('#bottomnav').innerHTML = bn.map(([k, l, i]) => `<button class="bn-item ${ui.view === k || (k === 'mas' && ['parametros', 'ajustes'].includes(ui.view)) ? 'active' : ''}" data-nav="${k}">${ic(i)}${l}</button>`).join('');
  updateSyncUI();
}

function render() {
  renderShell();
  const v = $('#view');
  const fn = { dia: viewDay, semana: viewWeek, ausencias: viewAbsences, consultas: viewQueries, parametros: viewParams, ajustes: viewSettings }[ui.view];
  v.innerHTML = fn();
  applyFilters();
  if (ui.view === 'dia') document.title = 'Agenda · ' + DIAS[dow(ui.date)] + ' ' + fmtShort(ui.date);
  else document.title = 'Agenda';
}

function applyFilters() {
  [['trucks', '#trucks-tbl tr[data-s]', ui.truckQ], ['people', '#people-grid [data-s]', ui.peopleQ]].forEach(([k, sel, q]) => {
    const els = document.querySelectorAll(sel); if (!els.length && !document.querySelector(`[data-noresult="${k}"]`)) return;
    const words = norm(q).split(' ').filter(Boolean); let shown = 0;
    els.forEach((el) => { const ok = words.every((w) => el.dataset.s.includes(w)); el.style.display = ok ? '' : 'none'; if (ok) shown++; });
    const nr = document.querySelector(`[data-noresult="${k}"]`); if (nr) nr.classList.toggle('hidden', shown > 0);
  });
}
document.addEventListener('input', (ev) => {
  if (ev.target.dataset && 'tpick' in ev.target.dataset) {
    const words = norm(ev.target.value).split(' ').filter(Boolean);
    ev.target.closest('.tpick').querySelectorAll('.tpick-row').forEach((b) => { b.style.display = words.every((w) => b.dataset.s.includes(w)) ? '' : 'none'; });
    return;
  }
  if (ev.target.dataset && 'waTpl' in ev.target.dataset) { ui.waDraft = ev.target.value; const pv = $('#wa-preview'); if (pv) pv.textContent = fillTemplate(ui.waDraft, waSampleVars(ui.waKind || 'permiso')); return; }
  const k = ev.target.dataset && ev.target.dataset.filter; if (!k) return;
  if (k === 'trucks') ui.truckQ = ev.target.value; else ui.peopleQ = ev.target.value;
  applyFilters();
});

function go(view, opts = {}) {
  if (view === 'mas') return openMoreMenu();
  ui.view = view;
  Object.assign(ui, opts);
  render();
  window.scrollTo(0, 0);
}

/* ---------------- Vista: Día ---------------- */
function viewDay() {
  const iso = ui.date, day = getDay(iso), hol = holidayOf(iso);
  const prevSame = addDays(iso, -7);
  const conf = conflicts(day);
  const absIds = absentIds(iso);
  const sunday = dow(iso) === 0;
  const tpl = get('templates', 'w' + dow(iso));
  let h = `
  <div class="dayhead">
    <div class="dnav">
      <button class="btn icon" data-act="day-prev" aria-label="Día anterior">${ic('left')}</button>
      <label class="datepick"><div class="dtitle">${DIAS[dow(iso)]} ${fmtLong(iso)}</div>
        <div class="dsub">Semana Walmart <b>${wmWeek(iso)}</b>${iso === todayISO() ? ' · Hoy' : ''}</div>
        <input type="date" value="${iso}" data-change="day-pick" aria-label="Elegir fecha"></label>
      <button class="btn icon" data-act="day-next" aria-label="Día siguiente">${ic('right')}</button>
    </div>
    <div class="row acts">
      ${iso !== todayISO() ? '<button class="btn" data-act="day-today">Hoy</button>' : ''}
      <button class="btn" data-nav="semana">Ver semana</button>
      ${tpl ? `<button class="btn" data-act="tpl-apply">Plantilla ${DIAS[dow(iso)].toLowerCase()}</button>` : ''}
      <button class="btn dark" data-act="copy-from" data-from="${prevSame}">Copiar del ${DIAS[dow(prevSame)].toLowerCase()} ${parse(prevSame).getDate()}</button>
    </div>
  </div>`;
  if (hol) h += `<div class="alert hol">${ic('cal')}<span><b>Feriado:</b> ${esc(hol.nombre)}${hol.medio ? ' (medio día)' : ''}</span></div>`;
  if (sunday) h += `<div class="alert info">${ic('cal')}<span>Domingo: ${day.abierto ? '<b>despacho abierto</b>.' : 'sin despacho.'}</span><span class="spacer"></span><button class="btn sm" data-act="toggle-open">${day.abierto ? 'Cerrar despacho' : 'Abrir despacho'}</button></div>`;
  conf.forEach((a) => {
    h += `<div class="alert">${ic('warn')}<span><b>${esc(pname(a.personId))}</b> tiene ${TIPOS[a.tipo].label.toLowerCase()} (${fmtRange(a.desde, a.hasta)}) y está asignado hoy.</span></div>`;
  });

  // Rutas
  const rutas = day.rutas.map((r, i) => {
    const bad = r.camiones.some((c) => absIds.has(c.chofer) || (c.ayudantes || []).some((a) => absIds.has(a)));
    const need = trucksNeeded(r);
    const tags = [];
    if (r.parrillas) tags.push(`${esc(r.parrillas)} parrillas${r.camiones.length > 1 ? ' · ' + r.camiones.length + ' camiones' : ''}`);
    const lines = r.camiones.map((c) => {
      const pn = (id) => absIds.has(id) ? `<span class="strike">${esc(pname(id))}</span>` : esc(pname(id));
      const ay = (c.ayudantes || []).map(pn).join(', ');
      return `<div>${c.truck ? `<span class="muted">${esc(tname(c.truck))}:</span> ` : ''}${c.chofer ? pn(c.chofer) : '<span class="muted">sin chofer</span>'}${ay ? ' · <span class="muted">' + ay + '</span>' : ''}</div>`;
    }).join('');
    return `<button class="card ruta ${bad ? 'conflict' : ''}" data-act="ruta-edit" data-i="${i}">
      <div class="top"><b>${esc(r.clientes.map(cname).join(' + ') || 'Ruta sin cliente')}</b>${tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      ${lines}${need && need > r.camiones.length ? `<div class="hint warn">Por capacidad se necesitan ${need} camiones</div>` : ''}</button>`;
  }).join('');

  const prods = products();
  const emp = day.empaques.map((e, i) => `<div class="emp-row">
      <select class="sel" data-change="emp-prod" data-i="${i}" aria-label="Producto">${prods.map((p) => `<option value="${p.id}" ${p.id === e.prod ? 'selected' : ''}>${esc(p.codigo)}</option>`).join('')}</select>
      <input class="inp" value="${esc(e.cant)}" placeholder="Cantidad" data-change="emp-cant" data-i="${i}" aria-label="Cantidad" inputmode="text">
      <button class="icon-btn" data-act="emp-del" data-i="${i}" aria-label="Quitar">${ic('x')}</button></div>`).join('');

  const z18t = trucks().filter((t) => truckOn(t) && (t.uso || []).includes('z18')).sort((a, b) => z18Rank(a) - z18Rank(b));
  const z18 = z18t.map((t) => `<div class="z18box"><label for="z-${t.id}">${esc(t.nombre)}</label>
      <input id="z-${t.id}" class="inp num" type="number" min="0" inputmode="numeric" value="${day.z18.viajes[t.id] ?? ''}" placeholder="0" data-change="z18-v" data-t="${t.id}"></div>`).join('');
  const apoyoTrucks = trucks().filter((t) => truckOn(t) || (day.z18.apoyo || []).some((a) => a.truck === t.id));
  const choferes = activePeople().filter(isChofer);
  const apo = (day.z18.apoyo || []).map((a, i) => `<div class="apo-row">
      <select class="sel" data-change="apo-truck" data-i="${i}" aria-label="Camión de apoyo"><option value="">Camión…</option>${apoyoTrucks.map((t) => `<option value="${t.id}" ${t.id === a.truck ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select>
      <select class="sel" data-change="apo-chofer" data-i="${i}" aria-label="Chofer de apoyo"><option value="">Chofer…</option>${choferes.map((p) => `<option value="${p.id}" ${p.id === a.chofer ? 'selected' : ''}>${esc(p.nombre)}${absIds.has(p.id) ? ' (ausente)' : ''}</option>`).join('')}</select>
      <input class="inp num" type="number" min="0" value="${a.viajes ?? ''}" placeholder="0" data-change="apo-v" data-i="${i}" aria-label="Viajes">
      <button class="icon-btn" data-act="apo-del" data-i="${i}" aria-label="Quitar apoyo">${ic('x')}</button></div>`).join('');

  const notas = day.notas.map((n, i) => `<div class="card nota">${esc(n.texto)}<button class="icon-btn" data-act="nota-del" data-i="${i}" aria-label="Borrar nota">${ic('x')}</button></div>`).join('');

  const abs = absencesOn(iso).sort((a, b) => Object.keys(TIPOS).indexOf(a.tipo) - Object.keys(TIPOS).indexOf(b.tipo));
  const absH = abs.map((a) => `<button class="abs t-${a.tipo}" data-act="abs-edit" data-id="${a.id}"><span class="dot bg-${a.tipo}"></span><span><b>${esc(pname(a.personId))}</b> · ${TIPOS[a.tipo].label}${a.motivo ? ' · ' + esc(a.motivo) : (a.tipo === 'falta' ? ' · sin reportarse' : '')} · ${fmtRange(a.desde, a.hasta)}${a.tipo === 'vacaciones' ? (a.estado === 'solicitada' ? ' <span class="muted">(solicitadas, aprox.)</span>' : ' <span class="t-permiso">(confirmadas RRHH)</span>') : ''}${a.comunicado ? ' <span class="muted small">· enviado</span>' : ''}</span></button>`).join('');

  h += `<div class="paper">
    <div class="col">
      <section class="sec"><div class="sec-h"><h2>Rutas</h2><button class="btn sm" data-act="ruta-new">+ Ruta</button></div>
        ${rutas || '<div class="empty">Sin rutas. Usa “Copiar del ' + DIAS[dow(prevSame)].toLowerCase() + ' ' + parse(prevSame).getDate() + '” o agrega una ruta.</div>'}</section>
      <section class="sec"><div class="sec-h"><h2>Empaques</h2><button class="btn sm" data-act="emp-add">+ Producto</button></div>
        ${emp || '<div class="empty">Sin empaques registrados.</div>'}</section>
      <section class="sec"><div class="sec-h"><h2>Notas importantes</h2></div>
        ${notas}
        <textarea class="inp" id="nota-new" placeholder="Pruebas de producto, fechas, pendientes…" aria-label="Nueva nota"></textarea>
        <div class="row"><button class="btn" data-act="nota-add">Agregar nota</button></div></section>
    </div>
    <div class="col">
      <section class="sec"><div class="sec-h"><h2>Z18 · traslados Z2 ↔ Z18</h2></div>
        ${z18 ? `<div class="z18grid">${z18}</div>` : '<div class="empty">Marca camiones con uso “Z18” en Parámetros.</div>'}
        <div class="sec-h"><span class="flabel">APOYO</span><button class="btn sm" data-act="apo-add">+ Apoyo</button></div>
        ${apo || '<div class="empty">Sin apoyo.</div>'}</section>
      <section class="sec"><div class="sec-h"><h2>Faltas · Permisos · Vacaciones</h2></div>
        ${absH || '<div class="empty">Nadie ausente.</div>'}
        <div class="abs-btns">
          <button class="btn sm b-falta" data-act="abs-new" data-tipo="falta">+ Falta</button>
          <button class="btn sm b-permiso" data-act="abs-new" data-tipo="permiso">+ Permiso</button>
          <button class="btn sm" data-act="abs-new" data-tipo="vacaciones">+ Vacaciones</button>
          <button class="btn sm b-igss" data-act="abs-new" data-tipo="igss">+ IGSS</button>
        </div></section>
      <section class="sec"><div class="sec-h"><h2>Día</h2></div>
        <div class="row">
          <button class="btn sm" data-act="copy-from" data-from="${prevOperating(iso)}">Copiar de ${fmtShort(prevOperating(iso))}</button>
          <button class="btn sm" data-act="tpl-save">Guardar como plantilla del ${DIAS[dow(iso)].toLowerCase()}</button>
          <button class="btn sm danger" data-act="day-clear">Limpiar día</button>
        </div></section>
    </div>
  </div>`;
  return h;
}
function prevOperating(iso) { let d = addDays(iso, -1); for (let i = 0; i < 7 && isOff(d); i++) d = addDays(d, -1); return d; }
function trucksNeeded(r) {
  const p = parseInt(r.parrillas, 10);
  if (!p) return 0;
  const cap = r.camiones.map((c) => +((get('trucks', c.truck) || {}).capacidad || 0)).find((x) => x > 0);
  return cap ? Math.ceil(p / cap) : 0;
}

/* ---------------- Vista: Semana ---------------- */
function viewWeek() {
  const mon = mondayOf(ui.date);
  const days = [...Array(7)].map((_, i) => addDays(mon, i));
  const cells = days.map((iso) => {
    const d = get('days', iso), hol = holidayOf(iso), abs = absencesOn(iso), off = isOff(iso);
    const rutas = d ? d.rutas.map((r) => `<div>• ${esc(r.clientes.map(cname).join(' + '))}</div>`).join('') : '';
    const emp = d && d.empaques.length ? d.empaques.map((e) => `${esc(prodName(e.prod))} ${esc(e.cant)}`).join(', ') : '';
    const z = d ? Object.entries(d.z18.viajes || {}).filter(([, v]) => +v).sort(([a], [b]) => z18Rank(get('trucks', a) || {}) - z18Rank(get('trucks', b) || {})).map(([t, v]) => `${esc(tname(t))} ${v}`).join(' · ') : '';
    return `<button class="wday ${iso === todayISO() ? 'today' : ''} ${off ? 'off' : ''}" data-act="goto-day" data-d="${iso}">
      <h3>${DIAS_C[dow(iso)]} ${parse(iso).getDate()}</h3>
      ${hol ? `<span class="tag">${esc(hol.nombre)}</span>` : ''}
      ${rutas ? '<span class="lbl">RUTAS</span>' + rutas : (off ? '<span>Sin despacho</span>' : '<span class="muted">Sin rutas</span>')}
      ${emp ? '<span class="lbl">EMPAQUES</span><div>' + emp + '</div>' : ''}
      ${z ? '<span class="lbl">Z18</span><div>' + z + '</div>' : ''}
      ${abs.length ? '<span class="lbl">AUSENCIAS</span>' + abs.map((a) => `<div class="t-${a.tipo}">${esc(pname(a.personId))} · ${TIPOS[a.tipo].label}</div>`).join('') : ''}
    </button>`;
  }).join('');
  return `<div class="dayhead"><div class="dnav">
      <button class="btn icon" data-act="week-prev" aria-label="Semana anterior">${ic('left')}</button>
      <div><div class="dtitle">Semana ${wmWeek(addDays(mon, 0))}${wmWeek(mon) !== wmWeek(addDays(mon, 6)) ? ' / ' + wmWeek(addDays(mon, 6)) : ''}</div><div class="dsub">${fmtRange(mon, addDays(mon, 6))} · semana Walmart (sábado a viernes)</div></div>
      <button class="btn icon" data-act="week-next" aria-label="Semana siguiente">${ic('right')}</button></div>
      <div class="row acts"><button class="btn" data-act="day-today">Hoy</button></div></div>
    <div class="week">${cells}</div>`;
}

/* ---------------- Vista: Ausencias (línea de tiempo) ---------------- */
function viewAbsences() {
  const N = 42, start = ui.tlStart, end = addDays(start, N - 1);
  const days = [...Array(N)].map((_, i) => addDays(start, i));
  const abs = all('absences').filter((a) => a.desde <= end && (a.hasta || a.desde) >= start);
  const pids = [...new Set(abs.map((a) => a.personId))].sort((a, b) => pname(a).localeCompare(pname(b), 'es'));
  const holSet = new Set(all('holidays').map((h) => h.fecha));
  const cls = (iso) => (iso === todayISO() ? 'tod' : dow(iso) === 0 ? 'sun' : holSet.has(iso) ? 'hol' : '');
  const cols = `grid-template-columns:150px repeat(${N}, minmax(22px,1fr))`;
  let head = `<div class="tl" style="${cols}"><div></div>`;
  days.forEach((iso, i) => { head += `<div class="dh ${cls(iso)}" style="grid-column:${i + 2}"><span>${DIAS_C[dow(iso)][0]}</span><b>${parse(iso).getDate()}</b>${parse(iso).getDate() === 1 || i === 0 ? `<span>${MES_C[parse(iso).getMonth()]}</span>` : ''}</div>`; });
  head += '</div>';
  const rows = pids.map((pid) => {
    let r = `<div class="tl" style="${cols}"><div class="name" style="grid-row:1;grid-column:1"><b>${esc(pname(pid))}</b></div>`;
    days.forEach((iso, i) => { r += `<div class="cell ${cls(iso)}" style="grid-row:1;grid-column:${i + 2}"></div>`; });
    abs.filter((a) => a.personId === pid).forEach((a) => {
      const s = Math.max(0, diffDays(start, a.desde)), e = Math.min(N - 1, diffDays(start, a.hasta || a.desde));
      const sol = a.tipo === 'vacaciones' && a.estado === 'solicitada';
      r += `<button class="bar bg-${a.tipo} ${sol ? 'sol' : ''}" style="grid-row:1;grid-column:${s + 2} / span ${e - s + 1}" data-act="abs-edit" data-id="${a.id}" title="${esc(TIPOS[a.tipo].label + ' ' + fmtRange(a.desde, a.hasta))}">${e - s >= 2 ? esc(TIPOS[a.tipo].label + (sol ? ' (aprox.)' : '')) : ''}</button>`;
    });
    return r + '</div>';
  }).join('');
  const pend = all('absences').filter((a) => a.tipo === 'vacaciones' && a.estado === 'solicitada').sort((a, b) => a.desde.localeCompare(b.desde));
  return `<div class="dayhead"><div class="dnav">
      <button class="btn icon" data-act="tl-prev" aria-label="Anterior">${ic('left')}</button>
      <div><div class="dtitle">Calendario de ausencias</div><div class="dsub">${fmtShort(start)} – ${fmtLong(end)}</div></div>
      <button class="btn icon" data-act="tl-next" aria-label="Siguiente">${ic('right')}</button></div>
      <div class="row acts"><button class="btn" data-act="tl-today">Hoy</button><button class="btn dark" data-act="abs-new" data-tipo="vacaciones">+ Solicitud de vacaciones</button><button class="btn" data-act="abs-new" data-tipo="falta">+ Otra ausencia</button></div></div>
    <div class="legend"><span><i class="bg-vacaciones"></i>Vacaciones confirmadas</span><span><i style="border:2px dashed #2B2A26"></i>Vacaciones solicitadas (aprox.)</span><span><i class="bg-permiso"></i>Permiso</span><span><i class="bg-falta"></i>Falta</span><span><i class="bg-igss"></i>Suspensión IGSS</span><span><i style="background:#E3D7BE"></i>Domingo</span><span><i style="background:#EAD9C0"></i>Feriado</span></div>
    <div class="tl-wrap">${head}${rows || '<div class="empty" style="padding:16px">Sin ausencias en este período.</div>'}</div>
    <div class="panel" style="margin-top:16px"><h2 style="font-size:16px">Vacaciones pendientes de confirmar por RRHH</h2>
      ${pend.length ? pend.map((a) => `<div class="row"><span><b>${esc(pname(a.personId))}</b> · ${fmtRange(a.desde, a.hasta)}</span><span class="spacer"></span><button class="btn sm" data-act="abs-edit" data-id="${a.id}">Confirmar fechas</button></div>`).join('') : '<div class="empty">Ninguna.</div>'}</div>`;
}

/* ---------------- Vista: Consultas ---------------- */
function viewQueries() {
  const q = ui.q;
  const tabs = [['colaborador', 'Por colaborador'], ['cliente', 'Por cliente'], ['ausencias', 'Ausencias por fecha'], ['notas', 'Buscar en notas']];
  let body = '';
  if (q.tipo === 'colaborador') {
    const years = yearsAvailable();
    body = `<div class="row"><select class="sel" style="max-width:260px" data-change="q-person" aria-label="Colaborador"><option value="">Elige colaborador…</option>${people().map((p) => `<option value="${p.id}" ${p.id === q.person ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
      <select class="sel" style="max-width:120px" data-change="q-year" aria-label="Año">${years.map((y) => `<option ${y === q.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>`;
    if (q.person) {
      const abs = all('absences').filter((a) => a.personId === q.person && (a.desde.startsWith(q.year) || (a.hasta || '').startsWith(q.year))).sort((a, b) => a.desde.localeCompare(b.desde));
      const cnt = {}; Object.keys(TIPOS).forEach((t) => (cnt[t] = 0));
      abs.forEach((a) => (cnt[a.tipo] += diffDays(a.desde, a.hasta || a.desde) + 1));
      const asg = all('days').filter((d) => d.id.startsWith(q.year)).sort((a, b) => b.id.localeCompare(a.id)).map((d) => {
        const roles = [];
        d.rutas.forEach((r) => r.camiones.forEach((c) => { if (c.chofer === q.person) roles.push('Chofer · ' + r.clientes.map(cname).join(' + ')); if ((c.ayudantes || []).includes(q.person)) roles.push('Ayudante · ' + r.clientes.map(cname).join(' + ')); }));
        (d.z18.apoyo || []).forEach((a) => { if (a.chofer === q.person) roles.push('Apoyo Z18 · ' + tname(a.truck) + ' · ' + (a.viajes || 0) + ' viajes'); });
        return roles.length ? { d: d.id, roles } : null;
      }).filter(Boolean);
      body += `<div class="stat">${Object.keys(TIPOS).map((t) => `<div><b class="t-${t}">${cnt[t]}</b>días de ${TIPOS[t].label.toLowerCase()}</div>`).join('')}<div><b>${asg.length}</b>días asignado</div></div>
        <h3 style="font-size:15px">Ausencias ${q.year}</h3>
        ${abs.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Tipo</th><th>Fechas</th><th>Días</th><th>Motivo</th></tr>${abs.map((a) => `<tr class="click" data-act="abs-edit" data-id="${a.id}"><td class="t-${a.tipo}"><b>${TIPOS[a.tipo].label}</b>${a.tipo === 'vacaciones' && a.estado === 'solicitada' ? ' (aprox.)' : ''}</td><td>${fmtRange(a.desde, a.hasta)}</td><td>${diffDays(a.desde, a.hasta || a.desde) + 1}</td><td>${esc(a.motivo || '')}</td></tr>`).join('')}</table></div>` : '<div class="empty">Sin ausencias.</div>'}
        <h3 style="font-size:15px">Asignaciones ${q.year}</h3>
        ${asg.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Fecha</th><th>Asignación</th></tr>${asg.slice(0, 200).map((x) => `<tr class="click" data-act="goto-day" data-d="${x.d}"><td>${DIAS_C[dow(x.d)]} ${fmtShort(x.d)}</td><td>${x.roles.map(esc).join('<br>')}</td></tr>`).join('')}</table></div>` : '<div class="empty">Sin asignaciones.</div>'}`;
    }
  } else if (q.tipo === 'cliente') {
    body = `<div class="row"><select class="sel" style="max-width:260px" data-change="q-client" aria-label="Cliente"><option value="">Elige cliente…</option>${all('clients').sort(byName).map((c) => `<option value="${c.id}" ${c.id === q.client ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>${rangeInputs()}</div>`;
    if (q.client) {
      const res = all('days').filter((d) => d.id >= q.desde && d.id <= q.hasta).sort((a, b) => b.id.localeCompare(a.id)).flatMap((d) => d.rutas.filter((r) => r.clientes.includes(q.client)).map((r) => ({ d: d.id, r })));
      body += `<div class="stat"><div><b>${res.length}</b>entregas</div></div>${res.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Fecha</th><th>Ruta</th><th>Parrillas</th><th>Camión · chofer · ayudantes</th></tr>${res.map(({ d, r }) => `<tr class="click" data-act="goto-day" data-d="${d}"><td>${DIAS_C[dow(d)]} ${fmtShort(d)}</td><td>${esc(r.clientes.map(cname).join(' + '))}</td><td>${esc(r.parrillas || '')}</td><td>${r.camiones.map((c) => esc(tname(c.truck) + ' · ' + pname(c.chofer) + ((c.ayudantes || []).length ? ' · ' + c.ayudantes.map(pname).join(', ') : ''))).join('<br>')}</td></tr>`).join('')}</table></div>` : '<div class="empty">Sin entregas en el rango.</div>'}`;
    }
  } else if (q.tipo === 'ausencias') {
    const res = all('absences').filter((a) => a.desde <= q.hasta && (a.hasta || a.desde) >= q.desde).sort((a, b) => a.desde.localeCompare(b.desde));
    body = `<div class="row">${rangeInputs()}</div>${res.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Colaborador</th><th>Tipo</th><th>Fechas</th><th>Motivo</th></tr>${res.map((a) => `<tr class="click" data-act="abs-edit" data-id="${a.id}"><td><b>${esc(pname(a.personId))}</b></td><td class="t-${a.tipo}">${TIPOS[a.tipo].label}${a.tipo === 'vacaciones' && a.estado === 'solicitada' ? ' (aprox.)' : ''}</td><td>${fmtRange(a.desde, a.hasta)}</td><td>${esc(a.motivo || '')}</td></tr>`).join('')}</table></div>` : '<div class="empty">Sin ausencias en el rango.</div>'}`;
  } else {
    const t = q.text.trim().toLowerCase();
    const res = t ? all('days').flatMap((d) => d.notas.filter((n) => n.texto.toLowerCase().includes(t)).map((n) => ({ d: d.id, n }))).sort((a, b) => b.d.localeCompare(a.d)) : [];
    body = `<div class="row"><input class="inp" style="max-width:360px" placeholder="Ej. vainilla, prueba, molde…" value="${esc(q.text)}" data-change="q-text" aria-label="Buscar texto"><button class="btn">Buscar</button></div>
      ${t ? (res.length ? res.map(({ d, n }) => `<button class="card nota" style="text-align:left;cursor:pointer" data-act="goto-day" data-d="${d}"><b>${DIAS_C[dow(d)]} ${fmtLong(d)}</b>\n${esc(n.texto)}</button>`).join('') : '<div class="empty">Sin resultados.</div>') : ''}`;
  }
  return `<div class="dayhead"><div><div class="dtitle">Consultas</div></div></div>
    <div class="panel"><div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${q.tipo === k ? 'on' : ''}" data-act="q-tab" data-k="${k}">${l}</button>`).join('')}</div>${body}</div>`;
}
function rangeInputs() {
  return `<label class="small muted">Desde <input class="inp" style="width:160px" type="date" value="${ui.q.desde}" data-change="q-desde"></label><label class="small muted">Hasta <input class="inp" style="width:160px" type="date" value="${ui.q.hasta}" data-change="q-hasta"></label>`;
}
function yearsAvailable() {
  const ys = new Set([String(new Date().getFullYear())]);
  all('days').forEach((d) => ys.add(d.id.slice(0, 4)));
  all('absences').forEach((a) => ys.add(a.desde.slice(0, 4)));
  return [...ys].sort().reverse();
}

/* ---------------- Vista: Parámetros ---------------- */
function viewParams() {
  const tabs = [['camiones', 'Camiones'], ['personal', 'Colaboradores'], ['clientes', 'Clientes'], ['productos', 'Productos de empaque'], ['feriados', 'Feriados']];
  let body = '';
  const t = ui.paramTab;
  if (t === 'camiones') {
    const tf = ui.truckFilter;
    const all_ = trucks();
    const list = all_.filter((x) => tf === 'todos' || (tf === 'on' ? truckOn(x) : tf === 'off' ? !truckOn(x) : tf === 'z18' ? (x.uso || []).includes('z18') : x.choferModo === 'varios'));
    body = `<div class="sec-h"><h2>Camiones <span class="small muted">· ${all_.filter(truckOn).length} en agenda de ${all_.length}</span></h2><button class="btn sm dark" data-act="truck-new">+ Camión</button></div>
    <div class="row"><input class="inp" style="max-width:340px" type="search" placeholder="Buscar matrícula, nombre o chofer…" value="${esc(ui.truckQ)}" data-filter="trucks" aria-label="Buscar camión">
      ${[['todos', 'Todos'], ['on', 'En agenda'], ['off', 'Fuera de agenda'], ['z18', 'Z18'], ['varios', 'Chofer varios']].map(([k, l]) => `<button class="tab ${tf === k ? 'on' : ''}" data-act="tf" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="tbl-wrap"><table class="tbl" id="trucks-tbl"><tr><th style="width:70px">En agenda</th><th>Número / nombre</th><th>Matrícula</th><th style="text-align:right">Capacidad máx. (parrillas)</th><th>Chofer asignado</th><th>Uso</th></tr>
    ${list.map((x) => { const chofer = x.choferModo === 'varios' ? 'varios ' + (x.choferes || []).map(pname).join(' ') : (x.chofer ? pname(x.chofer) : ''); return `<tr class="click ${truckOn(x) ? '' : 'off'}" data-act="truck-edit" data-id="${x.id}" data-s="${esc(norm([x.nombre, x.matricula, chofer, x.nota].join(' ')))}">
      <td><label class="chk" title="Mostrar en la agenda"><input type="checkbox" data-act="truck-toggle" data-id="${x.id}" ${truckOn(x) ? 'checked' : ''} aria-label="${esc(x.nombre)} en agenda"></label></td>
      <td><b>${esc(x.nombre)}</b>${x.nota ? `<div class="small muted">${esc(x.nota)}</div>` : ''}</td><td class="mono">${esc(x.matricula || '—')}</td><td style="text-align:right"><b>${esc(x.capacidad || '—')}</b></td>
      <td>${x.choferModo === 'varios' ? `<span class="tag navy">VARIOS</span> <span class="muted">${esc((x.choferes || []).map(pname).join(', '))}</span>` : esc(x.chofer ? pname(x.chofer) : '—')}</td>
      <td class="muted">${esc((x.uso || []).map((u) => ({ rutas: 'Rutas', z18: 'Z18', apoyo: 'Apoyo' }[u])).join(' · '))}</td></tr>`; }).join('')}</table>
    <div class="empty hidden" data-noresult="trucks">Sin coincidencias.</div></div>`;
  } else if (t === 'personal') {
    const f = ui.peopleFilter;
    const list = people().filter((p) => f === 'todos' || (f === 'chofer' ? isChofer(p) : f === 'ayudante' ? isAyud(p) : p.rol === 'otro'));
    const absT = absentIds(todayISO());
    body = `<div class="sec-h"><h2>Colaboradores <span class="small muted">· ${activePeople().length} activos</span></h2>
      <div class="row">${[['todos', 'Todos'], ['chofer', 'Choferes'], ['ayudante', 'Ayudantes'], ['otro', 'Otros']].map(([k, l]) => `<button class="tab ${f === k ? 'on' : ''}" data-act="pf" data-k="${k}">${l}</button>`).join('')}<button class="btn sm dark" data-act="person-new">+ Colaborador</button></div></div>
      <input class="inp" style="max-width:340px" type="search" placeholder="Buscar nombre, tarjeta o puesto…" value="${esc(ui.peopleQ)}" data-filter="people" aria-label="Buscar colaborador">
      <div class="pgrid" id="people-grid">${list.map((p) => { const a = absencesOn(todayISO()).find((x) => x.personId === p.id && absT.has(p.id)); return `<button class="pcard ${p.activo === false ? 'inactive' : ''}" data-act="person-edit" data-id="${p.id}" data-s="${esc(norm([p.nombre, p.tarjeta, p.puesto, roleLabel(p), p.area].join(' ')))}"><div class="row" style="justify-content:space-between;width:100%"><b>${esc(p.nombre)}</b>${a ? `<span class="pill t-${a.tipo}">${TIPOS[a.tipo].label}</span>` : ''}</div><span class="role ${p.rol}">${esc(roleLabel(p))}</span><span class="small muted">${p.tarjeta ? 'Tarjeta ' + esc(p.tarjeta) : 'Sin tarjeta'}${p.rol !== 'otro' && p.puesto && p.puesto !== ROLES[p.rol] ? ' · ' + esc(p.puesto) : ''}${p.area ? ' · ' + esc(p.area) : ''}</span></button>`; }).join('')}</div><div class="empty hidden" data-noresult="people">Sin coincidencias. Revisa la ortografía o búscalo por número de tarjeta.</div>`;
  } else if (t === 'clientes') {
    body = `<div class="sec-h"><h2>Clientes</h2><button class="btn sm dark" data-act="client-new">+ Cliente</button></div>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Cliente</th><th>Registra parrillas</th><th>Estado</th></tr>${all('clients').sort(byName).map((c) => `<tr class="click" data-act="client-edit" data-id="${c.id}"><td><b>${esc(c.nombre)}</b></td><td>${c.usaParrillas ? 'Sí' : '—'}</td><td>${c.activo === false ? 'Inactivo' : 'Activo'}</td></tr>`).join('')}</table></div>`;
  } else if (t === 'productos') {
    body = `<div class="sec-h"><h2>Productos de empaque</h2><button class="btn sm dark" data-act="prod-new">+ Producto</button></div>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Código</th><th>Descripción</th><th>Orden</th></tr>${products().map((p) => `<tr class="click" data-act="prod-edit" data-id="${p.id}"><td><b>${esc(p.codigo)}</b></td><td>${esc(p.desc || '')}</td><td>${p.orden ?? ''}</td></tr>`).join('')}</table></div>`;
  } else {
    const hs = all('holidays').sort((a, b) => a.fecha.localeCompare(b.fecha));
    body = `<div class="sec-h"><h2>Feriados</h2><button class="btn sm dark" data-act="hol-new">+ Feriado</button></div>
      <div class="hint">Precargué los feriados nacionales de 2026 y 2027 (Semana Santa calculada). Revísalos y agrega los que falten.</div>
      <div class="tbl-wrap"><table class="tbl"><tr><th>Fecha</th><th>Feriado</th><th>Tipo</th></tr>${hs.map((h) => `<tr class="click" data-act="hol-edit" data-id="${h.id}"><td>${DIAS_C[dow(h.fecha)]} ${fmtLong(h.fecha)}</td><td><b>${esc(h.nombre)}</b></td><td>${h.medio ? 'Medio día' : 'Día completo'}</td></tr>`).join('')}</table></div>`;
  }
  return `<div class="dayhead"><div><div class="dtitle">Parámetros</div><div class="dsub">Se cargan una vez y se eligen de listas en la agenda</div></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${t === k ? 'on' : ''}" data-act="ptab" data-k="${k}">${l}</button>`).join('')}</div></div>
    <div class="panel">${body}</div>`;
}

/* ---------------- Vista: Ajustes ---------------- */
function waSettings() {
  const k = ui.waKind || 'permiso';
  const tpl = ui.waDraft != null ? ui.waDraft : waTemplate(k);
  const custom = !!get('templates', 'wa-' + k);
  return `<div class="panel" id="wa-settings"><h2 style="font-size:16px">Mensajes de WhatsApp</h2>
    <div class="hint">Escribe el mensaje una vez por tipo. Toca una variable para insertarla donde está el cursor. Si una variable queda vacía (por ejemplo, sin tarjeta), esa línea no se envía. Usa *texto* para negrita.</div>
    <div class="tabs">${WA_KINDS.map(([kk, l]) => `<button class="tab ${kk === k ? 'on' : ''}" data-act="wa-kind" data-k="${kk}">${l}</button>`).join('')}</div>
    <div class="grid2" style="align-items:start">
      <div class="field"><label for="wa-tpl">Plantilla${custom ? '' : ' (predeterminada)'}</label><textarea id="wa-tpl" class="inp" style="min-height:190px;font-family:ui-monospace,Menlo,monospace;font-size:13px" data-wa-tpl>${esc(tpl)}</textarea>
        <div class="chips">${WA_VARS.map(([v, l]) => `<button type="button" class="chip" data-act="wa-var" data-v="${v}" title="${l}">{${v}}</button>`).join('')}</div></div>
      <div class="field"><span class="flabel">Vista previa (ejemplo)</span><div class="card" id="wa-preview" style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:#E7F6EC;border-color:#BFE3CB">${esc(fillTemplate(tpl, waSampleVars(k)))}</div></div>
    </div>
    <div class="row"><button class="btn dark" data-act="wa-save">Guardar plantilla</button>${custom ? '<button class="btn" data-act="wa-reset">Restaurar predeterminada</button>' : ''}</div>
  </div>`;
}

function viewSettings() {
  const key = localStorage.getItem(LS_KEY) || '';
  const last = localStorage.getItem(LS_LASTSYNC);
  const y = String(new Date().getFullYear());
  return `<div class="dayhead"><div><div class="dtitle">Ajustes y PDF</div><div class="dsub">Agenda <b>${VERSION}</b></div></div></div>
  <div class="panel"><h2 style="font-size:16px">Sincronización entre laptop y celular</h2>
    <div class="hint">Usa la <b>misma clave</b> en cada equipo. Los datos se guardan en tu equipo y se copian a la nube de tu proyecto en Vercel. Mínimo 8 caracteres; no la compartas.</div>
    <div class="row"><input class="inp" id="sync-key" type="password" style="max-width:320px" placeholder="Clave de sincronización" value="${esc(key)}" autocomplete="new-password" aria-label="Clave de sincronización">
      <button class="btn dark" data-act="sync-save">${key ? 'Cambiar clave' : 'Activar sincronización'}</button>
      ${key ? '<button class="btn" data-act="sync-now">Sincronizar ahora</button><button class="btn danger" data-act="sync-off">Desactivar</button>' : ''}</div>
    <div class="small muted">${key ? (last ? 'Última sincronización: ' + new Date(+last).toLocaleString('es-GT') : 'Aún no se sincroniza.') : 'Sincronización desactivada: los datos quedan solo en este equipo.'}</div>
  </div>
  ${waSettings()}
  <div class="panel"><h2 style="font-size:16px">Exportar agenda a PDF</h2>
    <div class="hint">Se abre la vista de impresión: elige “Guardar como PDF”.</div>
    <div class="row">
      <select class="sel" id="pdf-year" style="max-width:120px" aria-label="Año">${yearsAvailable().map((yy) => `<option ${yy === y ? 'selected' : ''}>${yy}</option>`).join('')}</select>
      <select class="sel" id="pdf-month" style="max-width:180px" aria-label="Mes"><option value="">Año completo</option>${MESES.map((m, i) => `<option value="${i}">${m[0].toUpperCase() + m.slice(1)}</option>`).join('')}</select>
      <button class="btn dark" data-act="pdf">${ic('pdf')}Generar PDF</button></div>
  </div>
  <div class="panel"><h2 style="font-size:16px">Respaldo</h2>
    <div class="row"><button class="btn" data-act="backup">Descargar respaldo (.json)</button>
    <label class="btn">Restaurar respaldo<input type="file" accept="application/json,.json" data-change="restore" class="hidden"></label></div>
    <div class="hint">Restaurar combina el archivo con lo que ya tienes (gana el cambio más reciente).</div>
  </div>
  <div class="panel"><h2 style="font-size:16px">Empezar de nuevo</h2>
    <div class="hint">Borra los datos guardados en este equipo. Si la sincronización está activa, los datos en la nube no se borran y vuelven a descargarse.</div>
    <div class="row"><button class="btn danger" data-act="reset">Borrar datos de este equipo</button></div>
  </div>
  <div class="panel"><h2 style="font-size:16px">Versiones</h2>
    <div class="tbl-wrap"><table class="tbl"><tr><th>Versión</th><th>Fecha</th><th>Cambios</th></tr>${CHANGELOG.map(([v, f, t]) => `<tr><td><b>${v}</b>${v === VERSION ? ' <span class="pill t-permiso">actual</span>' : ''}</td><td>${fmtShort(f)} ${f.slice(0, 4)}</td><td>${esc(t)}</td></tr>`).join('')}</table></div></div>
  <div class="row small muted" style="gap:10px">${rinze(28)} Agenda ${VERSION}</div>`;
}

function openMoreMenu() {
  modal(`<h2>Más</h2>
    <button class="btn" data-nav="parametros" data-close>${ic('people')} Parámetros</button>
    <button class="btn" data-nav="ajustes" data-close>${ic('gear')} Ajustes, respaldo y PDF</button>
    <div class="modal-foot"><button class="btn" data-close>Cerrar</button></div>`);
}

/* ---------------- Modales ---------------- */
let modalCtx = null;
function modal(html, ctx = null) {
  const prev = $('#modal-root .modal'), keep = prev && ctx && modalCtx === ctx ? prev.scrollTop : 0;
  modalCtx = ctx;
  $('#modal-root').innerHTML = `<div class="modal-bg" data-bg><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  if (keep) { $('#modal-root .modal').scrollTop = keep; return; }
  const f = $('#modal-root .modal input:not([type=hidden]):not([type=checkbox]), #modal-root .modal select');
  if (f && window.matchMedia('(min-width: 900px)').matches) f.focus();
}
function closeModal() { $('#modal-root').innerHTML = ''; modalCtx = null; }
function confirmBox(msg, okLabel = 'Aceptar', danger = false) {
  return new Promise((res) => {
    modal(`<h2>Confirmar</h2><div style="line-height:1.5">${msg}</div><div class="modal-foot"><button class="btn" data-cf="0">Cancelar</button><button class="btn ${danger ? 'warn' : 'dark'}" data-cf="1">${okLabel}</button></div>`, { confirm: res });
  });
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); }

/* Editor de ruta */
function rutaModal(idx) {
  const day = getDay(ui.date);
  const r = idx == null ? { id: uid(), clientes: [], parrillas: '', camiones: [{ truck: '', chofer: '', ayudantes: [] }] } : clone(day.rutas[idx]);
  modalCtx = { kind: 'ruta', idx, r, pick: null };
  drawRuta();
}
function drawRuta() {
  const { r, idx } = modalCtx;
  const abs = absentIds(ui.date);
  const cl = clients();
  const needParr = r.clientes.some((c) => (get('clients', c) || {}).usaParrillas) || r.parrillas;
  const need = trucksNeeded(r);
  const choferes = activePeople().filter(isChofer);
  const ayud = activePeople().filter(isAyud);
  const tr = trucks().sort((a, b) => (+b.capacidad || 0) - (+a.capacidad || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true })).filter((t) => (truckOn(t) && (!(t.uso || []).length || (t.uso || []).includes('rutas') || (t.uso || []).includes('apoyo'))) || r.camiones.some((c) => c.truck === t.id));
  const used = assignedElsewhere(idx);
  const usedT = trucksElsewhere(idx);
  const camH = r.camiones.map((c, ci) => {
    const t = get('trucks', c.truck);
    let chOpts = choferes;
    if (t && t.choferModo === 'varios' && (t.choferes || []).length) chOpts = [...choferes.filter((p) => t.choferes.includes(p.id)), ...choferes.filter((p) => !t.choferes.includes(p.id))];
    return `<div class="truckrow">
      <div class="field"><span class="flabel">Camión ${r.camiones.length > 1 ? ci + 1 : ''}</span><button type="button" class="tpick-btn ${t ? '' : 'empty'}" data-ract="pick" data-ci="${ci}" aria-expanded="${modalCtx.pick === ci}">${t ? truckCols(t, usedT) : '<span class="muted">Elegir camión…</span>'}<span class="tpick-caret" aria-hidden="true">▾</span></button></div>
      ${modalCtx.pick === ci ? truckPicker(ci, tr, c.truck, usedT) : ''}
      <div class="field"><label>Chofer del día</label><select class="sel" data-rchange="chofer" data-ci="${ci}"><option value="">Sin chofer</option>${chOpts.map((p) => `<option value="${p.id}" ${p.id === c.chofer ? 'selected' : ''}>${esc(p.nombre)}${abs.has(p.id) ? ' (ausente)' : ''}${used.has(p.id) ? ' (en otra ruta)' : ''}</option>`).join('')}</select></div>
      <div class="field"><span class="flabel">Ayudantes</span><div class="chips">${ayud.map((p) => `<button type="button" class="chip ${(c.ayudantes || []).includes(p.id) ? 'on' : ''} ${abs.has(p.id) ? 'off' : ''}" data-ract="ayu" data-ci="${ci}" data-id="${p.id}" title="${abs.has(p.id) ? 'Ausente hoy' : used.has(p.id) ? 'En otra ruta' : ''}">${esc(p.nombre)}${used.has(p.id) ? ' ·' : ''}</button>`).join('')}</div></div>
      ${r.camiones.length > 1 ? `<div class="row"><button class="btn sm danger" data-ract="truck-del" data-ci="${ci}">Quitar camión</button></div>` : ''}
    </div>`;
  }).join('');
  modal(`<h2>${idx == null ? 'Nueva ruta' : 'Editar ruta'}</h2>
    <div class="field"><span class="flabel">Clientes de la ruta (puedes unir varios)</span><div class="chips">${cl.map((c) => `<button type="button" class="chip ${r.clientes.includes(c.id) ? 'on' : ''}" data-ract="cli" data-id="${c.id}">${esc(c.nombre)}</button>`).join('')}<button type="button" class="chip" data-ract="cli-new">+ Nuevo cliente</button></div></div>
    ${`<div class="field"><label for="r-parr">Parrillas del pedido ${needParr ? '' : '(opcional)'}</label><input id="r-parr" class="inp" style="max-width:160px" inputmode="numeric" value="${esc(r.parrillas)}" data-rchange="parr"></div>`}
    ${need ? `<div class="hint ${need > r.camiones.length ? 'warn' : ''}">Con la capacidad del camión se necesitan ${need} camión(es).</div>` : ''}
    ${camH}
    <div class="row"><button class="btn sm" data-ract="truck-add">+ Otro camión</button></div>
    <div class="modal-foot">${idx != null ? '<button class="btn danger left" data-ract="del">Borrar ruta</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn dark" data-ract="save">Guardar</button></div>`, modalCtx);
}
function trucksElsewhere(idx) {
  const s = new Set();
  getDay(ui.date).rutas.forEach((r, i) => { if (i !== idx) r.camiones.forEach((c) => c.truck && s.add(c.truck)); });
  return s;
}
function truckChofer(t) {
  if (t.choferModo === 'varios') return '<span class="tag navy">VARIOS</span>' + ((t.choferes || []).length ? ' <span class="muted small">' + esc(t.choferes.map(pname).join(', ')) + '</span>' : '');
  return t.chofer ? esc(pname(t.chofer)) : '<span class="muted">—</span>';
}
function truckCols(t, usedT) {
  return `<span class="tc-name"><b>${esc(t.nombre)}</b>${t.matricula && !String(t.nombre).includes(t.matricula) ? `<small class="mono">${esc(t.matricula)}</small>` : ''}${usedT && usedT.has(t.id) ? '<small class="t-falta">en otra ruta</small>' : ''}</span><span class="tc-chofer">${truckChofer(t)}</span><span class="tc-parr">${t.capacidad ? '<b>' + esc(t.capacidad) + '</b><small>parr.</small>' : '<span class="muted">—</span>'}</span>`;
}
function truckPicker(ci, tr, current, usedT) {
  return `<div class="tpick" role="listbox" aria-label="Camiones">
    <input class="inp" type="search" placeholder="Buscar camión, matrícula o chofer…" data-tpick aria-label="Buscar camión">
    <div class="tpick-head"><span>Camión / matrícula</span><span>Chofer asignado</span><span style="text-align:right">Parrillas</span></div>
    <div class="tpick-list">
      ${tr.map((t) => `<button type="button" class="tpick-row ${t.id === current ? 'on' : ''}" data-ract="pickset" data-ci="${ci}" data-id="${t.id}" data-s="${esc(norm([t.nombre, t.matricula, t.choferModo === 'varios' ? 'varios' : pname(t.chofer), (t.choferes || []).map(pname).join(' ')].join(' ')))}">${truckCols(t, usedT)}</button>`).join('')}
      <button type="button" class="tpick-row" data-ract="pickset" data-ci="${ci}" data-id="" data-s="sin camion"><span class="muted">Sin camión</span></button>
    </div></div>`;
}
function assignedElsewhere(idx) {
  const day = getDay(ui.date); const s = new Set();
  day.rutas.forEach((r, i) => { if (i === idx) return; r.camiones.forEach((c) => { if (c.chofer) s.add(c.chofer); (c.ayudantes || []).forEach((a) => s.add(a)); }); });
  return s;
}
function rutaAction(act, el) {
  const { r } = modalCtx;
  const ci = +el.dataset.ci;
  if (act === 'cli') { const id = el.dataset.id; r.clientes = r.clientes.includes(id) ? r.clientes.filter((x) => x !== id) : [...r.clientes, id]; }
  else if (act === 'cli-new') { const n = prompt('Nombre del nuevo cliente'); if (n && n.trim()) { const c = { id: uid(), nombre: n.trim().toUpperCase(), usaParrillas: false, activo: true }; put('clients', c); r.clientes.push(c.id); } }
  else if (act === 'ayu') { const id = el.dataset.id, c = r.camiones[ci]; c.ayudantes = (c.ayudantes || []).includes(id) ? c.ayudantes.filter((x) => x !== id) : [...(c.ayudantes || []), id]; }
  else if (act === 'pick') modalCtx.pick = modalCtx.pick === ci ? null : ci;
  else if (act === 'pickset') {
    const c = r.camiones[ci]; c.truck = el.dataset.id; modalCtx.pick = null;
    const t = get('trucks', c.truck);
    if (t && t.choferModo !== 'varios' && t.chofer) c.chofer = t.chofer;
  }
  else if (act === 'truck-add') { r.camiones.push({ truck: '', chofer: '', ayudantes: [] }); modalCtx.pick = r.camiones.length - 1; }
  else if (act === 'truck-del') r.camiones.splice(ci, 1);
  else if (act === 'save') {
    if (!r.clientes.length) return toast('Elige al menos un cliente');
    const day = getDay(ui.date);
    if (modalCtx.idx == null) day.rutas.push(r); else day.rutas[modalCtx.idx] = r;
    saveDay(day); closeModal(); render(); return;
  } else if (act === 'del') {
    const rIdx = modalCtx.idx;
    confirmBox('¿Borrar esta ruta del día?', 'Borrar', true).then((ok) => { if (ok) { const day = getDay(ui.date); day.rutas.splice(rIdx, 1); saveDay(day); } render(); });
    return;
  }
  drawRuta();
}
function rutaChange(field, el) {
  const { r } = modalCtx; const ci = +el.dataset.ci;
  if (field === 'parr') { r.parrillas = el.value.trim(); drawRuta(); const i = $('#r-parr'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
  if (field === 'truck') {
    r.camiones[ci].truck = el.value;
    const t = get('trucks', el.value);
    if (t && t.choferModo !== 'varios' && t.chofer && !r.camiones[ci].chofer) r.camiones[ci].chofer = t.chofer;
  }
  if (field === 'chofer') r.camiones[ci].chofer = el.value;
  drawRuta();
}

/* Editor de ausencia */
function absModal(id, tipo) {
  const a = id ? clone(get('absences', id)) : { id: uid(), personId: '', tipo: tipo || 'falta', desde: ui.view === 'dia' ? ui.date : todayISO(), hasta: '', motivo: '', estado: 'solicitada' };
  if (!a.hasta) a.hasta = a.tipo === 'vacaciones' ? addDays(a.desde, 14) : a.desde;
  modalCtx = { kind: 'abs', a, isNew: !id };
  drawAbs();
}
function drawAbs() {
  const { a, isNew } = modalCtx;
  const dias = diffDays(a.desde, a.hasta) + 1;
  modal(`<h2>${isNew ? 'Registrar ausencia' : 'Editar ausencia'}</h2>
    <div class="field"><span class="flabel">Tipo</span><div class="chips">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" class="chip ${a.tipo === k ? 'on' : ''}" data-aact="tipo" data-k="${k}"><span class="dot bg-${k}"></span>${t.label}</button>`).join('')}</div></div>
    <div class="field"><label for="a-p">Colaborador</label><select id="a-p" class="sel" data-achange="personId"><option value="">Elige…</option>${people().map((p) => `<option value="${p.id}" ${p.id === a.personId ? 'selected' : ''}>${esc(p.nombre)}${esc(tarjeta(p))} · ${esc(roleLabel(p))}</option>`).join('')}</select></div>
    <div class="grid2"><div class="field"><label for="a-d">Desde</label><input id="a-d" class="inp" type="date" value="${a.desde}" data-achange="desde"></div>
    <div class="field"><label for="a-h">Hasta</label><input id="a-h" class="inp" type="date" value="${a.hasta}" data-achange="hasta"></div></div>
    <div class="hint">${dias} día(s) calendario${a.tipo === 'vacaciones' ? ' · normalmente 15' : ''}</div>
    ${a.tipo === 'vacaciones' ? `<div class="field"><span class="flabel">Estado</span><div class="seg"><button type="button" class="btn ${a.estado === 'solicitada' ? 'navy' : ''}" data-aact="estado" data-k="solicitada">Solicitadas (aprox.)</button><button type="button" class="btn ${a.estado === 'confirmada' ? 'navy' : ''}" data-aact="estado" data-k="confirmada">Confirmadas por RRHH</button></div></div>` : ''}
    <div class="field"><label for="a-m">${a.tipo === 'falta' ? 'Motivo (vacío si no se reportó)' : a.tipo === 'igss' ? 'Detalle (opcional)' : 'Motivo'}</label><input id="a-m" class="inp" value="${esc(a.motivo)}" data-achange="motivo"></div>
    ${!isNew ? `<div class="row"><button type="button" class="btn sm wa" data-act="wa" data-id="${a.id}">${ic('wa')}Enviar por WhatsApp</button>${a.comunicado ? '<span class="small t-permiso">Enviado ' + new Date(a.comunicado).toLocaleDateString('es-GT') + '</span>' : ''}</div>` : ''}
    <div class="modal-foot">${!isNew ? '<button class="btn danger left" data-aact="del">Borrar</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn dark" data-aact="save">Guardar</button></div>`, modalCtx);
}
function absAction(act, el) {
  const { a } = modalCtx;
  if (act === 'tipo') { const old = a.tipo; a.tipo = el.dataset.k; if (a.tipo === 'vacaciones' && old !== 'vacaciones' && a.hasta === a.desde) a.hasta = addDays(a.desde, 14); drawAbs(); }
  else if (act === 'estado') { a.estado = el.dataset.k; drawAbs(); }
  else if (act === 'del') { const id = a.id; confirmBox('¿Borrar esta ausencia?', 'Borrar', true).then((ok) => { if (ok) del('absences', id); render(); }); }
  else if (act === 'save') {
    if (!a.personId) return toast('Elige el colaborador');
    if (a.hasta < a.desde) return toast('La fecha final es antes de la inicial');
    if (a.tipo !== 'vacaciones') delete a.estado;
    const before = get('absences', a.id);
    const after = (rec) => { if (shouldNotify(rec, before)) waModal(rec.id, true); };
    const doSave = () => { put('absences', a); closeModal(); render(); toast('Ausencia guardada'); after(a); };
    if (a.tipo === 'vacaciones') {
      const over = all('absences').filter((x) => x.tipo === 'vacaciones' && x.id !== a.id && x.personId !== a.personId && x.desde <= a.hasta && (x.hasta || x.desde) >= a.desde);
      if (over.length) {
        const saved = clone(a);
        const msg = `<div class="alert" style="margin:0">${ic('warn')}<span>Estas vacaciones se traslapan con:<br>${over.map((x) => `<b>${esc(pname(x.personId))}</b> · ${fmtRange(x.desde, x.hasta)} ${x.estado === 'solicitada' ? '(aprox.)' : '(confirmadas)'} · ${diffDays(saved.desde > x.desde ? saved.desde : x.desde, saved.hasta < (x.hasta || x.desde) ? saved.hasta : (x.hasta || x.desde)) + 1} día(s) en común`).join('<br>')}</span></div><p>Si son de áreas que no se afectan, puedes guardarlas igual.</p>`;
        confirmBox(msg, 'Guardar de todos modos', true).then((ok) => { if (ok) { put('absences', saved); toast('Ausencia guardada'); render(); after(saved); } else { modalCtx = { kind: 'abs', a: saved, isNew: !get('absences', saved.id) }; drawAbs(); } });
        return;
      }
    }
    doSave();
  }
}

/* Aviso por WhatsApp */
function waTitle(a) {
  if (a.tipo === 'permiso') return 'Permiso autorizado';
  if (a.tipo === 'vacaciones') return a.estado === 'solicitada' ? 'Solicitud de vacaciones' : 'Vacaciones autorizadas';
  if (a.tipo === 'igss') return 'Suspensión IGSS';
  return 'Falta registrada';
}
/* Plantillas de WhatsApp: se guardan en "templates" con id wa-<clave> para sincronizarse */
const WA_KINDS = [
  ['permiso', 'Permiso autorizado'], ['vacaciones', 'Vacaciones autorizadas'], ['solicitud', 'Solicitud de vacaciones'],
  ['falta', 'Falta'], ['igss', 'Suspensión IGSS'],
];
const WA_DEFAULT = {
  permiso: '*Permiso autorizado*\nColaborador: {nombre}\nTarjeta: {tarjeta}\nPuesto: {puesto}\n{fechas}\nMotivo: {motivo}',
  vacaciones: '*Vacaciones autorizadas*\nColaborador: {nombre}\nTarjeta: {tarjeta}\nPuesto: {puesto}\n{fechas}\nObservaciones: {motivo}',
  solicitud: '*Solicitud de vacaciones*\nColaborador: {nombre}\nTarjeta: {tarjeta}\nPuesto: {puesto}\n{fechas}\nFechas aproximadas, pendientes de confirmar por RRHH',
  falta: '*Falta registrada*\nColaborador: {nombre}\nTarjeta: {tarjeta}\nPuesto: {puesto}\n{fechas}\nMotivo: {motivo}',
  igss: '*Suspensión IGSS*\nColaborador: {nombre}\nTarjeta: {tarjeta}\nPuesto: {puesto}\n{fechas}\nDetalle: {motivo}',
};
const WA_VARS = [
  ['nombre', 'Nombre'], ['tarjeta', 'Tarjeta'], ['puesto', 'Puesto'], ['area', 'Área'], ['fechas', 'Fechas (frase completa)'],
  ['desde', 'Fecha inicio'], ['hasta', 'Fecha fin'], ['dias', 'Días'], ['motivo', 'Motivo'], ['tipo', 'Tipo'], ['hoy', 'Fecha de hoy'],
];
function waKind(a) { return a.tipo === 'vacaciones' ? (a.estado === 'solicitada' ? 'solicitud' : 'vacaciones') : a.tipo; }
function waTemplate(kind) { const t = get('templates', 'wa-' + kind); return t && typeof t.texto === 'string' ? t.texto : WA_DEFAULT[kind]; }
function waVars(a) {
  const p = get('people', a.personId) || {};
  const h = a.hasta || a.desde, n = diffDays(a.desde, h) + 1;
  const largo = (iso) => DIAS[dow(iso)].toLowerCase() + ' ' + fmtLong(iso);
  return {
    nombre: p.nombre || '', tarjeta: p.tarjeta || '', puesto: p.rol ? puestoOf(p) : '', area: p.area || '',
    fechas: n === 1 ? 'Fecha: ' + largo(a.desde) : 'Del ' + largo(a.desde) + ' al ' + largo(h) + ' (' + n + ' días)',
    desde: largo(a.desde), hasta: largo(h), dias: String(n),
    motivo: a.motivo || (a.tipo === 'falta' ? 'no se reportó' : ''), tipo: TIPOS[a.tipo].label, hoy: fmtLong(todayISO()),
  };
}
/* Reemplaza {variables}; una línea cuyas variables quedan todas vacías se omite */
function fillTemplate(tpl, vars) {
  return tpl.split('\n').map((line) => {
    const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k in vars);
    if (keys.length && keys.every((k) => !vars[k])) return null;
    return line.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }).filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function waTitle(a) { return (WA_KINDS.find(([k]) => k === waKind(a)) || [, ''])[1]; }
function waText(a) { return fillTemplate(waTemplate(waKind(a)), waVars(a)); }
const WA_SAMPLE = { personId: '', tipo: 'permiso', desde: todayISO(), hasta: todayISO(), motivo: 'Cita médica', estado: 'confirmada' };
function waSampleVars(kind) {
  const tipo = kind === 'solicitud' || kind === 'vacaciones' ? 'vacaciones' : kind;
  const a = Object.assign({}, WA_SAMPLE, { tipo, estado: kind === 'solicitud' ? 'solicitada' : 'confirmada', hasta: tipo === 'vacaciones' ? addDays(todayISO(), 14) : todayISO(), motivo: tipo === 'vacaciones' ? '' : WA_SAMPLE.motivo });
  return Object.assign(waVars(a), { nombre: 'María López', tarjeta: '10452', puesto: 'Verificadora', area: 'Despacho' });
}
function shouldNotify(a, before) {
  if (a.tipo === 'permiso') return !before || before.tipo !== 'permiso' || !a.comunicado;
  if (a.tipo === 'vacaciones' && a.estado === 'confirmada') return !before || before.estado !== 'confirmada' || before.tipo !== 'vacaciones';
  return false;
}
function waModal(id, auto) {
  const a = get('absences', id); if (!a) return;
  modalCtx = { kind: 'wa', id };
  modal(`<h2>${auto ? 'Comunicar por WhatsApp' : 'Enviar por WhatsApp'}</h2>
    <div class="hint">Mensaje armado con la plantilla “${esc(waTitle(a))}”. Luego elige WhatsApp y marca los dos chats; puedes seleccionar ambos a la vez. <a href="#" data-act="wa-edit-tpl" data-id="${a.id}">Editar plantilla</a></div>
    <textarea id="wa-text" class="inp" style="min-height:170px">${esc(waText(a))}</textarea>
    ${a.comunicado ? `<div class="small t-permiso">Ya enviado el ${new Date(a.comunicado).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}</div>` : ''}
    <div class="modal-foot"><button class="btn" data-close>${auto ? 'Ahora no' : 'Cerrar'}</button><button class="btn" data-wact="copy">Copiar</button><button class="btn wa" data-wact="send">${ic('wa')}Enviar por WhatsApp</button></div>`, modalCtx);
}
async function waAction(act) {
  const id = modalCtx.id, text = $('#wa-text').value.trim();
  if (!text) return;
  if (act === 'copy') {
    try { await navigator.clipboard.writeText(text); toast('Mensaje copiado'); } catch (e) { $('#wa-text').select(); toast('Selecciona y copia el texto'); }
    return;
  }
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  let ok = false;
  if (mobile && navigator.share) {
    try { await navigator.share({ text }); ok = true; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (!ok) {
    try { await navigator.clipboard.writeText(text); } catch (e) { /* sin permiso de portapapeles */ }
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }
  const a = get('absences', id);
  if (a) { const c = clone(a); c.comunicado = Date.now(); put('absences', c); }
  closeModal(); render(); toast(ok ? 'Mensaje compartido' : 'WhatsApp abierto · el mensaje también quedó copiado');
}

/* Editores de parámetros */
function truckModal(id) {
  const t = id ? clone(get('trucks', id)) : { id: uid(), nombre: '', matricula: '', capacidad: '', choferModo: 'fijo', chofer: '', choferes: [], uso: ['rutas'] };
  modalCtx = { kind: 'truck', t, isNew: !id }; drawTruck();
}
function drawTruck() {
  const { t, isNew } = modalCtx;
  const ch = activePeople().filter(isChofer);
  modal(`<h2>${isNew ? 'Nuevo camión' : 'Editar camión: ' + esc(t.nombre)}</h2>
    <div class="grid2"><div class="field"><label for="t-n">Número o nombre</label><input id="t-n" class="inp" value="${esc(t.nombre)}" data-tchange="nombre"></div>
    <div class="field"><label for="t-m">Matrícula</label><input id="t-m" class="inp" value="${esc(t.matricula)}" data-tchange="matricula" style="text-transform:uppercase"></div></div>
    <div class="field"><label for="t-o">Nota</label><input id="t-o" class="inp" value="${esc(t.nota || '')}" data-tchange="nota"></div>
    <div class="field"><label for="t-c">Capacidad máxima (parrillas)</label><input id="t-c" class="inp" inputmode="numeric" style="max-width:160px" value="${esc(t.capacidad)}" data-tchange="capacidad"></div>
    <div class="field"><span class="flabel">En agenda</span><div class="seg"><button type="button" class="btn ${t.activo !== false ? 'navy' : ''}" data-tact="act" data-k="1">Visible al asignar</button><button type="button" class="btn ${t.activo === false ? 'navy' : ''}" data-tact="act" data-k="">Oculto</button></div></div>
    <div class="field"><span class="flabel">Uso</span><div class="chips">${[['rutas', 'Rutas'], ['z18', 'Z18 (viajes fijos)'], ['apoyo', 'Apoyo']].map(([k, l]) => `<button type="button" class="chip ${(t.uso || []).includes(k) ? 'on' : ''}" data-tact="uso" data-k="${k}">${l}</button>`).join('')}</div></div>
    <div class="field"><span class="flabel">Chofer asignado</span><div class="seg"><button type="button" class="btn ${t.choferModo !== 'varios' ? 'navy' : ''}" data-tact="modo" data-k="fijo">Chofer fijo</button><button type="button" class="btn ${t.choferModo === 'varios' ? 'navy' : ''}" data-tact="modo" data-k="varios">Varios</button></div></div>
    ${t.choferModo === 'varios' ? `<div class="chips">${ch.map((p) => `<button type="button" class="chip ${(t.choferes || []).includes(p.id) ? 'on' : ''}" data-tact="ch" data-id="${p.id}">${esc(p.nombre)}</button>`).join('')}</div><div class="hint">Al usar este camión eliges el chofer del día; los marcados aparecen primero.</div>`
      : `<select class="sel" data-tchange="chofer" aria-label="Chofer fijo"><option value="">Sin chofer fijo</option>${ch.map((p) => `<option value="${p.id}" ${p.id === t.chofer ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>`}
    <div class="modal-foot">${!isNew ? '<button class="btn danger left" data-tact="del">Borrar</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn dark" data-tact="save">Guardar</button></div>`, modalCtx);
}
function truckAction(act, el) {
  const { t } = modalCtx;
  if (act === 'uso') { const k = el.dataset.k; t.uso = (t.uso || []).includes(k) ? t.uso.filter((x) => x !== k) : [...(t.uso || []), k]; }
  else if (act === 'modo') t.choferModo = el.dataset.k;
  else if (act === 'act') t.activo = !!el.dataset.k;
  else if (act === 'ch') { const id = el.dataset.id; t.choferes = (t.choferes || []).includes(id) ? t.choferes.filter((x) => x !== id) : [...(t.choferes || []), id]; }
  else if (act === 'del') { const id = t.id; return confirmBox('¿Borrar este camión? Los días ya registrados lo mostrarán como “—”.', 'Borrar', true).then((ok) => { if (ok) del('trucks', id); render(); }); }
  else if (act === 'save') { if (!t.nombre.trim()) return toast('Escribe el número o nombre'); t.nombre = t.nombre.trim(); t.matricula = (t.matricula || '').toUpperCase().trim(); put('trucks', t); closeModal(); render(); return; }
  drawTruck();
}
function simpleModal(kind, id) {
  const defs = {
    person: { col: 'people', title: 'colaborador', blank: { nombre: '', tarjeta: '', rol: 'ayudante', puesto: '', area: 'Despacho', activo: true } },
    client: { col: 'clients', title: 'cliente', blank: { nombre: '', usaParrillas: false, activo: true } },
    prod: { col: 'products', title: 'producto', blank: { codigo: '', desc: '', orden: products().length } },
    hol: { col: 'holidays', title: 'feriado', blank: { fecha: todayISO(), nombre: '', medio: false } },
  }[kind];
  const r = id ? clone(get(defs.col, id)) : Object.assign({ id: uid() }, defs.blank);
  modalCtx = { kind: 'simple', sk: kind, def: defs, r, isNew: !id };
  drawSimple();
}
function drawSimple() {
  const { sk, def, r, isNew } = modalCtx;
  let f = '';
  const inp = (k, l, type = 'text', extra = '') => `<div class="field"><label for="s-${k}">${l}</label><input id="s-${k}" class="inp" type="${type}" value="${esc(r[k] ?? '')}" data-schange="${k}" ${extra}></div>`;
  const tog = (k, l, a, b) => `<div class="field"><span class="flabel">${l}</span><div class="seg"><button type="button" class="btn ${r[k] ? 'navy' : ''}" data-sact="set" data-k="${k}" data-v="1">${a}</button><button type="button" class="btn ${!r[k] ? 'navy' : ''}" data-sact="set" data-k="${k}" data-v="">${b}</button></div></div>`;
  if (sk === 'person') f = inp('nombre', 'Nombre') + inp('tarjeta', 'Número de tarjeta', 'text', 'inputmode="numeric" autocomplete="off"')
    + `<div class="field"><span class="flabel">Rol</span><div class="chips">${Object.entries(ROLES).map(([k, l]) => `<button type="button" class="chip ${r.rol === k ? 'on' : ''}" data-sact="rol" data-k="${k}">${l}</button>`).join('')}</div></div>`
    + inp('puesto', r.rol === 'otro' ? 'Puesto (empacador, verificadora…)' : 'Puesto (opcional)', 'text', 'list="puestos"') + `<datalist id="puestos">${[...new Set([...PUESTOS, ...all('people').map((x) => x.puesto).filter(Boolean)])].sort().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`
    + inp('area', 'Área') + tog('activo', 'Estado', 'Activo', 'Inactivo');
  if (sk === 'client') f = inp('nombre', 'Nombre') + tog('usaParrillas', 'Registra parrillas del pedido', 'Sí', 'No') + tog('activo', 'Estado', 'Activo', 'Inactivo');
  if (sk === 'prod') f = inp('codigo', 'Código') + inp('desc', 'Descripción (opcional)') + inp('orden', 'Orden en la lista', 'number');
  if (sk === 'hol') f = inp('fecha', 'Fecha', 'date') + inp('nombre', 'Nombre') + tog('medio', 'Duración', 'Medio día', 'Día completo');
  modal(`<h2>${isNew ? 'Nuevo ' + def.title : 'Editar ' + def.title}</h2>${f}
    <div class="modal-foot">${!isNew ? '<button class="btn danger left" data-sact="del">Borrar</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn dark" data-sact="save">Guardar</button></div>`, modalCtx);
}
function simpleAction(act, el) {
  const { r, def, sk } = modalCtx;
  if (act === 'set') r[el.dataset.k] = !!el.dataset.v;
  else if (act === 'rol') { r.rol = el.dataset.k; if (r.rol === 'otro' && r.area === 'Despacho') r.area = ''; }
  else if (act === 'del') { const id = r.id; return confirmBox('¿Borrar este registro?', 'Borrar', true).then((ok) => { if (ok) del(def.col, id); render(); }); }
  else if (act === 'save') {
    if (sk === 'prod') { if (!String(r.codigo).trim()) return toast('Escribe el código'); r.orden = +r.orden || 0; }
    else if (!String(r.nombre).trim()) return toast('Escribe el nombre');
    if (sk === 'hol' && !r.fecha) return toast('Elige la fecha');
    if (r.nombre) r.nombre = r.nombre.trim();
    if (sk === 'person') {
      r.tarjeta = String(r.tarjeta || '').trim(); r.puesto = String(r.puesto || '').trim();
      const others = people().filter((x) => x.id !== r.id);
      const sameT = r.tarjeta && others.find((x) => String(x.tarjeta || '') === r.tarjeta);
      if (sameT) return toast('La tarjeta ' + r.tarjeta + ' ya es de ' + sameT.nombre);
      const sameN = others.filter((x) => norm(x.nombre) === norm(r.nombre));
      if (sameN.length) {
        const rec = clone(r);
        confirmBox(`Ya existe <b>${esc(sameN.map((x) => x.nombre + (x.tarjeta ? ' (tarjeta ' + x.tarjeta + ')' : '')).join(', '))}</b>. ¿Es otra persona con el mismo nombre?`, 'Sí, guardar', true)
          .then((ok) => { if (ok) { put(def.col, rec); render(); } else { modalCtx = { kind: 'simple', sk, def, r: rec, isNew: !get(def.col, rec.id) }; drawSimple(); } });
        return;
      }
    }
    put(def.col, r); closeModal(); render(); return;
  }
  drawSimple();
}

/* ---------------- Acciones del día ---------------- */
async function copyFrom(src) {
  const s = get('days', src);
  if (!s || !dayHasContent(s)) return toast('El ' + DIAS[dow(src)].toLowerCase() + ' ' + fmtShort(src) + ' no tiene datos');
  const day = getDay(ui.date);
  if (dayHasContent(day) && !(await confirmBox('Este día ya tiene datos. ¿Reemplazar rutas, empaques y Z18 con los del ' + DIAS[dow(src)].toLowerCase() + ' ' + fmtShort(src) + '? Las notas se conservan.', 'Reemplazar', true))) { render(); return; }
  closeModal();
  const c = clone(s);
  day.rutas = c.rutas.map((r) => Object.assign(r, { id: uid() }));
  day.empaques = c.empaques.map((e) => Object.assign(e, { id: uid() }));
  day.z18 = { viajes: c.z18.viajes || {}, apoyo: (c.z18.apoyo || []).map((a) => Object.assign(a, { id: uid() })) };
  saveDay(day); render(); toast('Copiado. Revisa los cambios del día.');
}
async function applyTemplate() {
  const t = get('templates', 'w' + dow(ui.date)); if (!t) return;
  const day = getDay(ui.date);
  if (dayHasContent(day) && !(await confirmBox('¿Reemplazar rutas, empaques y Z18 con la plantilla?', 'Reemplazar', true))) { render(); return; }
  closeModal();
  const c = clone(t);
  day.rutas = c.rutas.map((r) => Object.assign(r, { id: uid() }));
  day.empaques = c.empaques.map((e) => Object.assign(e, { id: uid() }));
  day.z18 = { viajes: c.z18.viajes || {}, apoyo: (c.z18.apoyo || []).map((a) => Object.assign(a, { id: uid() })) };
  saveDay(day); render(); toast('Plantilla aplicada');
}

/* ---------------- Eventos ---------------- */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-nav],[data-act],[data-close],[data-cf],[data-ract],[data-aact],[data-tact],[data-sact],[data-wact],[data-bg]');
  if (!el) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') ev.preventDefault();
  if (el.hasAttribute('data-bg')) { if (ev.target === el) { if (modalCtx && modalCtx.confirm) { modalCtx.confirm(false); } closeModal(); } return; }
  if (el.dataset.cf != null) { const cb = modalCtx && modalCtx.confirm; closeModal(); cb && cb(el.dataset.cf === '1'); return; }
  if (el.dataset.ract) return rutaAction(el.dataset.ract, el);
  if (el.dataset.aact) return absAction(el.dataset.aact, el);
  if (el.dataset.tact) return truckAction(el.dataset.tact, el);
  if (el.dataset.sact) return simpleAction(el.dataset.sact, el);
  if (el.dataset.wact) return waAction(el.dataset.wact);
  if (el.hasAttribute('data-close') && !el.dataset.nav) return closeModal();
  if (el.dataset.nav) { if (el.hasAttribute('data-close')) closeModal(); return go(el.dataset.nav); }
  const a = el.dataset.act, i = +el.dataset.i;
  const day = () => getDay(ui.date);
  switch (a) {
    case 'day-prev': ui.date = addDays(ui.date, -1); render(); break;
    case 'day-next': ui.date = addDays(ui.date, 1); render(); break;
    case 'day-today': ui.date = todayISO(); render(); break;
    case 'week-prev': ui.date = addDays(ui.date, -7); render(); break;
    case 'week-next': ui.date = addDays(ui.date, 7); render(); break;
    case 'goto-day': ui.date = el.dataset.d; go('dia'); break;
    case 'copy-from': copyFrom(el.dataset.from); break;
    case 'tpl-apply': applyTemplate(); break;
    case 'tpl-save': { const d = day(); if (!dayHasContent(d)) return toast('El día está vacío'); put('templates', { id: 'w' + dow(ui.date), rutas: d.rutas, empaques: d.empaques, z18: d.z18 }); toast('Plantilla del ' + DIAS[dow(ui.date)].toLowerCase() + ' guardada'); render(); break; }
    case 'day-clear': if (await confirmBox('¿Borrar rutas, empaques, Z18 y notas de este día?', 'Limpiar', true)) { const d = emptyDay(ui.date); d.abierto = day().abierto; saveDay(d); } render(); break;
    case 'toggle-open': { const d = day(); d.abierto = !d.abierto; saveDay(d); render(); break; }
    case 'ruta-new': rutaModal(null); break;
    case 'ruta-edit': rutaModal(i); break;
    case 'emp-add': { const d = day(); const used = new Set(d.empaques.map((e) => e.prod)); const p = products().find((x) => !used.has(x.id)) || products()[0]; if (!p) return toast('Agrega productos en Parámetros'); d.empaques.push({ id: uid(), prod: p.id, cant: '' }); saveDay(d); render(); const ins = document.querySelectorAll('[data-change="emp-cant"]'); ins.length && ins[ins.length - 1].focus(); break; }
    case 'emp-del': { const d = day(); d.empaques.splice(i, 1); saveDay(d); render(); break; }
    case 'apo-add': { const d = day(); d.z18.apoyo = d.z18.apoyo || []; d.z18.apoyo.push({ id: uid(), truck: '', chofer: '', viajes: '' }); saveDay(d); render(); break; }
    case 'apo-del': { const d = day(); d.z18.apoyo.splice(i, 1); saveDay(d); render(); break; }
    case 'nota-add': { const t = $('#nota-new').value.trim(); if (!t) return; const d = day(); d.notas.push({ id: uid(), texto: t }); saveDay(d); render(); break; }
    case 'nota-del': if (await confirmBox('¿Borrar esta nota?', 'Borrar', true)) { const d = day(); d.notas.splice(i, 1); saveDay(d); } render(); break;
    case 'abs-new': absModal(null, el.dataset.tipo); break;
    case 'abs-edit': absModal(el.dataset.id); break;
    case 'wa': waModal(el.dataset.id, false); break;
    case 'wa-kind': ui.waKind = el.dataset.k; ui.waDraft = null; render(); document.getElementById('wa-settings').scrollIntoView({ block: 'start' }); break;
    case 'wa-var': { const ta = $('#wa-tpl'); const ins = '{' + el.dataset.v + '}'; const a0 = ta.selectionStart ?? ta.value.length, b0 = ta.selectionEnd ?? ta.value.length; ta.value = ta.value.slice(0, a0) + ins + ta.value.slice(b0); ta.focus(); ta.setSelectionRange(a0 + ins.length, a0 + ins.length); ta.dispatchEvent(new Event('input', { bubbles: true })); break; }
    case 'wa-save': { const k = ui.waKind || 'permiso'; const v = $('#wa-tpl').value.trim(); if (!v) return toast('La plantilla está vacía'); put('templates', { id: 'wa-' + k, texto: v }); ui.waDraft = null; toast('Plantilla guardada'); render(); document.getElementById('wa-settings').scrollIntoView({ block: 'start' }); break; }
    case 'wa-reset': if (await confirmBox('¿Volver a la plantilla predeterminada de este tipo?', 'Restaurar', true)) { del('templates', 'wa-' + (ui.waKind || 'permiso')); ui.waDraft = null; } render(); document.getElementById('wa-settings').scrollIntoView({ block: 'start' }); break;
    case 'wa-edit-tpl': { const a = get('absences', el.dataset.id); closeModal(); ui.waKind = a ? waKind(a) : 'permiso'; ui.waDraft = null; go('ajustes'); setTimeout(() => { const w = document.getElementById('wa-settings'); w && w.scrollIntoView({ block: 'start' }); }, 50); break; }
    case 'tl-prev': ui.tlStart = addDays(ui.tlStart, -28); render(); break;
    case 'tl-next': ui.tlStart = addDays(ui.tlStart, 28); render(); break;
    case 'tl-today': ui.tlStart = addDays(mondayOf(todayISO()), -7); render(); break;
    case 'q-tab': ui.q.tipo = el.dataset.k; render(); break;
    case 'ptab': ui.paramTab = el.dataset.k; render(); break;
    case 'pf': ui.peopleFilter = el.dataset.k; render(); break;
    case 'tf': ui.truckFilter = el.dataset.k; render(); break;
    case 'truck-toggle': { ev.stopPropagation(); const t = get('trucks', el.dataset.id); if (t) { const c = clone(t); c.activo = el.checked; put('trucks', c); toast(c.nombre + (c.activo ? ' visible en la agenda' : ' oculto en la agenda')); render(); } break; }
    case 'truck-new': truckModal(null); break;
    case 'truck-edit': if (ev.target.closest('.chk')) break; truckModal(el.dataset.id); break;
    case 'person-new': simpleModal('person'); break;
    case 'person-edit': simpleModal('person', el.dataset.id); break;
    case 'client-new': simpleModal('client'); break;
    case 'client-edit': simpleModal('client', el.dataset.id); break;
    case 'prod-new': simpleModal('prod'); break;
    case 'prod-edit': simpleModal('prod', el.dataset.id); break;
    case 'hol-new': simpleModal('hol'); break;
    case 'hol-edit': simpleModal('hol', el.dataset.id); break;
    case 'sync-save': { const k = $('#sync-key').value.trim(); if (k.length < 8) return toast('La clave debe tener al menos 8 caracteres'); localStorage.setItem(LS_KEY, k); localStorage.setItem(LS_PENDING, '1'); await syncNow(); render(); break; }
    case 'sync-off': localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_LASTSYNC); render(); toast('Sincronización desactivada'); break;
    case 'sync-now': if (!localStorage.getItem(LS_KEY)) { go('ajustes'); toast('Activa la sincronización con tu clave'); } else { await syncNow(true); if (ui.view === 'ajustes') render(); } break;
    case 'backup': downloadBackup(); break;
    case 'reset': if (await confirmBox('Se borrarán los datos guardados en este equipo. ¿Continuar?', 'Borrar', true)) { localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_PENDING); S = emptyState(); if (localStorage.getItem(LS_KEY)) await syncNow(); else seed(); } render(); break;
    case 'pdf': printAgenda($('#pdf-year').value, $('#pdf-month').value); break;
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.rchange) return rutaChange(el.dataset.rchange, el);
  if (el.dataset.achange) { modalCtx.a[el.dataset.achange] = el.value; if (el.dataset.achange === 'desde' && modalCtx.a.hasta < el.value) modalCtx.a.hasta = modalCtx.a.tipo === 'vacaciones' ? addDays(el.value, 14) : el.value; if (el.dataset.achange !== 'motivo') drawAbs(); return; }
  if (el.dataset.tchange) { modalCtx.t[el.dataset.tchange] = el.value; return; }
  if (el.dataset.schange) { modalCtx.r[el.dataset.schange] = el.value; return; }
  const c = el.dataset.change; if (!c) return;
  const i = +el.dataset.i;
  const d = getDay(ui.date);
  switch (c) {
    case 'day-pick': if (el.value) { ui.date = el.value; render(); } break;
    case 'emp-prod': d.empaques[i].prod = el.value; saveDay(d); break;
    case 'emp-cant': d.empaques[i].cant = el.value.trim(); saveDay(d); break;
    case 'z18-v': d.z18.viajes[el.dataset.t] = el.value === '' ? '' : +el.value; saveDay(d); break;
    case 'apo-truck': d.z18.apoyo[i].truck = el.value; { const t = get('trucks', el.value); if (t && t.choferModo !== 'varios' && t.chofer && !d.z18.apoyo[i].chofer) d.z18.apoyo[i].chofer = t.chofer; } saveDay(d); render(); break;
    case 'apo-chofer': d.z18.apoyo[i].chofer = el.value; saveDay(d); render(); break;
    case 'apo-v': d.z18.apoyo[i].viajes = el.value === '' ? '' : +el.value; saveDay(d); break;
    case 'q-person': ui.q.person = el.value; render(); break;
    case 'q-client': ui.q.client = el.value; render(); break;
    case 'q-year': ui.q.year = el.value; render(); break;
    case 'q-desde': ui.q.desde = el.value; render(); break;
    case 'q-hasta': ui.q.hasta = el.value; render(); break;
    case 'q-text': ui.q.text = el.value; render(); break;
    case 'restore': restoreBackup(el.files[0]); break;
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $('#modal-root').innerHTML) { if (modalCtx && modalCtx.confirm) modalCtx.confirm(false); closeModal(); }
  if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.change === 'q-text') { ui.q.text = ev.target.value; render(); }
});

/* ---------------- Respaldo ---------------- */
function downloadBackup() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'agenda-respaldo-' + todayISO() + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function restoreBackup(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try { const s = JSON.parse(fr.result); if (!s.col) throw new Error('formato'); S.col = mergeCols(S.col, s.col); persist(); render(); toast('Respaldo restaurado'); }
    catch (e) { toast('El archivo no es un respaldo válido'); }
  };
  fr.readAsText(file);
}

/* ---------------- Sincronización ---------------- */
let pushTimer = null, syncing = false, syncErr = false;
function schedulePush() { if (!localStorage.getItem(LS_KEY)) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => syncNow(), 1500); }
async function syncNow(manual) {
  const key = localStorage.getItem(LS_KEY);
  if (!key || syncing) return;
  if (!navigator.onLine) { syncErr = true; updateSyncUI(); return; }
  syncing = true; updateSyncUI();
  try {
    const pending = localStorage.getItem(LS_PENDING) === '1';
    const res = await fetch('/api/sync', pending
      ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-agenda-key': key }, body: JSON.stringify({ col: S.col }) }
      : { method: 'GET', headers: { 'x-agenda-key': key }, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.data && j.data.col) {
      const before = JSON.stringify(S.col);
      S.col = mergeCols(S.col, j.data.col);
      COLS.forEach((k) => (S.col[k] = S.col[k] || {}));
      localStorage.setItem(LS_STATE, JSON.stringify(S));
      if (JSON.stringify(S.col) !== before && !$('#modal-root').innerHTML && !isTyping()) render();
    }
    if (pending) localStorage.removeItem(LS_PENDING);
    else if (!j.data) { localStorage.setItem(LS_PENDING, '1'); syncing = false; return syncNow(manual); }
    localStorage.setItem(LS_LASTSYNC, String(Date.now()));
    syncErr = false;
    if (manual) toast('Sincronizado');
  } catch (e) {
    console.warn('sync', e); syncErr = true;
    if (manual) toast('No se pudo sincronizar. Se reintentará.');
  } finally { syncing = false; updateSyncUI(); }
}
function isTyping() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
function updateSyncUI() {
  const key = localStorage.getItem(LS_KEY), pend = localStorage.getItem(LS_PENDING) === '1', last = localStorage.getItem(LS_LASTSYNC);
  let cls = '', txt = 'Solo en este equipo';
  if (key) {
    if (syncing) { cls = 'pend'; txt = 'Sincronizando…'; }
    else if (syncErr) { cls = 'err'; txt = 'Sin conexión · pendiente'; }
    else if (pend) { cls = 'pend'; txt = 'Cambios pendientes'; }
    else { cls = 'ok'; txt = 'Sincronizado' + (last ? ' · ' + new Date(+last).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : ''); }
  }
  document.querySelectorAll('[data-syncdot]').forEach((d) => (d.className = 'dot ' + cls));
  document.querySelectorAll('[data-synctext]').forEach((d) => (d.textContent = txt));
}
window.addEventListener('online', () => { syncErr = false; syncNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });

/* ---------------- PDF (vista de impresión) ---------------- */
function printAgenda(year, month) {
  const m = month === '' ? null : +month;
  const from = m == null ? year + '-01-01' : year + '-' + pad(m + 1) + '-01';
  const to = m == null ? year + '-12-31' : toISO(new Date(+year, m + 1, 0, 12));
  const days = all('days').filter((d) => d.id >= from && d.id <= to && dayHasContent(d)).sort((a, b) => a.id.localeCompare(b.id));
  const absIn = all('absences').filter((a) => a.desde <= to && (a.hasta || a.desde) >= from).sort((a, b) => a.desde.localeCompare(b.desde));
  let h = `<div class="p-cover"><h1>Agenda ${m == null ? year : MESES[m] + ' ' + year}</h1><p>${days.length} días registrados · ${absIn.length} ausencias</p><p style="margin-top:20mm;color:#666">Generado el ${fmtLong(todayISO())} · Agenda ${VERSION} · Rinze Studio</p></div>`;
  let curM = -1;
  days.forEach((d) => {
    const mm = parse(d.id).getMonth();
    if (mm !== curM) { h += `<div class="p-month ${curM !== -1 ? 'p-break' : ''}">${MESES[mm][0].toUpperCase() + MESES[mm].slice(1)} ${year}</div>`; curM = mm; }
    const hol = holidayOf(d.id), abs = absencesOn(d.id);
    const z = Object.entries(d.z18.viajes || {}).filter(([, v]) => +v).sort(([a], [b]) => z18Rank(get('trucks', a) || {}) - z18Rank(get('trucks', b) || {})).map(([t, v]) => esc(tname(t)) + ' ' + v);
    h += `<div class="p-day"><h3><span>${DIAS[dow(d.id)]} ${fmtLong(d.id)}${hol ? ' · ' + esc(hol.nombre) : ''}</span><span>Semana ${wmWeek(d.id)}</span></h3><div class="p-grid"><div>
      <h4>Rutas</h4>${d.rutas.length ? '<ul>' + d.rutas.map((r) => `<li><b>${esc(r.clientes.map(cname).join(' + '))}</b>${r.parrillas ? ' (' + esc(r.parrillas) + ' parr.)' : ''} — ${r.camiones.map((c) => esc((c.truck ? tname(c.truck) + ': ' : '') + pname(c.chofer) + ((c.ayudantes || []).length ? ', ' + c.ayudantes.map(pname).join(', ') : ''))).join(' / ')}</li>`).join('') + '</ul>' : '<p>—</p>'}
      ${d.notas.length ? '<h4>Notas</h4>' + d.notas.map((n) => `<p>${esc(n.texto)}</p>`).join('') : ''}</div><div>
      <h4>Empaques</h4><p>${d.empaques.map((e) => esc(prodName(e.prod) + ' ' + e.cant)).join(' · ') || '—'}</p>
      <h4>Z18</h4><p>${z.join(' · ') || '—'}${(d.z18.apoyo || []).length ? '<br>Apoyo: ' + d.z18.apoyo.map((a) => esc(pname(a.chofer) + ' (' + tname(a.truck) + ') ' + (a.viajes || 0))).join(', ') : ''}</p>
      <h4>Faltas / Permisos / Vacaciones</h4><p>${abs.map((a) => esc(pname(a.personId) + ' – ' + TIPOS[a.tipo].label + (a.motivo ? ' (' + a.motivo + ')' : ''))).join('<br>') || '—'}</p></div></div></div>`;
  });
  h += `<div class="p-break p-sum"><div class="p-month">Resumen de ausencias</div><table><tr><th>Colaborador</th><th>Tipo</th><th>Fechas</th><th>Días</th><th>Motivo</th></tr>${absIn.map((a) => `<tr><td>${esc(pname(a.personId))}</td><td>${TIPOS[a.tipo].label}${a.tipo === 'vacaciones' && a.estado === 'solicitada' ? ' (aprox.)' : ''}</td><td>${fmtRange(a.desde, a.hasta)}</td><td>${diffDays(a.desde, a.hasta || a.desde) + 1}</td><td>${esc(a.motivo || '')}</td></tr>`).join('')}</table></div>`;
  $('#print-root').innerHTML = h;
  setTimeout(() => window.print(), 50);
}

/* ---------------- Inicio ---------------- */
function start() {
  seed();
  migrateV5();
  migrateV6();
  render();
  if (localStorage.getItem(LS_KEY)) syncNow();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
}
window.__agenda = { wmWeek, mergeCols, get S() { return S; } };
start();
})();
