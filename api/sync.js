// Sincronización de la Agenda: guarda el estado en Vercel Blob.
// Cada clave de sincronización tiene su propio espacio (hash SHA-256 de la clave).
// Credenciales: OIDC de Vercel + BLOB_STORE_ID (o BLOB_READ_WRITE_TOKEN), resueltas por @vercel/blob.
import { put, list, del } from '@vercel/blob';
import { createHash } from 'node:crypto';

const COLS = ['people', 'trucks', 'clients', 'products', 'holidays', 'absences', 'days', 'templates', 'meetings', 'abstypes'];

function mergeCols(a, b) {
  const out = {};
  for (const c of COLS) {
    out[c] = Object.assign({}, (a && a[c]) || {});
    const src = (b && b[c]) || {};
    for (const id of Object.keys(src)) {
      const r = src[id], cur = out[c][id];
      if (!cur || (r._u || 0) > (cur._u || 0)) out[c][id] = r;
    }
  }
  return out;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = String(req.headers['x-agenda-key'] || '');
  if (key.length < 8) return res.status(401).json({ error: 'Clave inválida' });
  const ns = createHash('sha256').update('agenda:' + key).digest('hex');
  const prefix = `agenda/${ns}/`;
  try {
    const { blobs } = await list({ prefix, limit: 100 });
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    let current = null;
    if (blobs[0]) {
      const r = await fetch(blobs[0].url, { cache: 'no-store' });
      if (r.ok) current = await r.json();
    }
    if (req.method === 'GET') return res.status(200).json({ data: current });
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body.col !== 'object') return res.status(400).json({ error: 'Datos inválidos' });
      const merged = { v: 1, col: mergeCols(current && current.col, body.col), savedAt: Date.now() };
      await put(prefix + 'agenda.json', JSON.stringify(merged), {
        access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60,
      });
      // Conserva las 5 versiones más recientes como respaldo
      const old = blobs.slice(4).map((b) => b.url);
      if (old.length) await del(old);
      return res.status(200).json({ data: merged });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error de almacenamiento', detalle: String(e && e.message || e).slice(0, 200) });
  }
}
