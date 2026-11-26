const crypto = require('crypto');
const { del } = require('@vercel/blob');
const { redis, authed, json, parseBody, hasModule, dayOf, presExt } = require('./_lib');

// Redis:
//   pres:<token>          JSON del enlace (archivo, título, destinatario, comentarios, vencimiento)
//   presby:<email>        lista de enlaces del usuario · presall: set de todos
//   presblob:<pathname>   set de enlaces que usan ese archivo (se borra el archivo con el último)
//   presopens:<token>     número de aperturas · presopen:<token>: últimas 100 aperturas (JSON)
const HOST_RE = /\.blob\.vercel-storage\.com$/;
const TITLE_MAX = 120;
const OPEN_LOG = 100;

const safeToken = t => String(t || '').replace(/[^A-Za-z0-9_-]/g, '');
const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const isExpired = p => !!p.expires && dayOf(Date.now()) > p.expires;
const canTouch = (who, p) => who.role === 'admin' || (!!who.email && who.email === p.owner);

// Fecha de vencimiento: '' (sin vencimiento) o AAAA-MM-DD válida. Devuelve null si no es válida.
function expiryOf(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00Z');
  return isNaN(d) || d.toISOString().slice(0, 10) !== s ? null : s;
}

// Campos que se pueden escribir al crear o editar un enlace.
function editable(b, base) {
  const out = {};
  if ('title' in b || !base) out.title = txt(b.title, TITLE_MAX);
  if ('recipient' in b || !base) out.recipient = txt(b.recipient, 120);
  if ('notes' in b || !base) out.notes = String(b.notes == null ? '' : b.notes).replace(/\r\n?/g, '\n').trim().slice(0, 2000);
  if ('expires' in b || !base) {
    const e = expiryOf(b.expires);
    if (e === null) return { error: 'La fecha de vencimiento no es válida.' };
    out.expires = e;
  }
  return out;
}

const pub = (p, opens, last) => ({
  token: p.token, title: p.title, name: p.name, size: p.size, ext: p.ext || presExt(p.name) || '',
  created: p.created, owner: p.owner, ownerName: p.ownerName,
  recipient: p.recipient || '', notes: p.notes || '', expires: p.expires || '', expired: isExpired(p),
  opens: parseInt(opens || '0', 10) || 0, lastOpen: last ? JSON.parse(last) : null
});

async function load(tokens) {
  if (!tokens.length) return [];
  const raw = await redis(tokens.flatMap(t => [['GET', 'pres:' + t], ['GET', 'presopens:' + t], ['LINDEX', 'presopen:' + t, 0]]));
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const v = raw[i * 3];
    if (v) out.push(pub(JSON.parse(v), raw[i * 3 + 1], raw[i * 3 + 2]));
  }
  return out.sort((a, b) => (a.created < b.created ? 1 : -1));
}

async function saveNew(rec, who) {
  await redis([
    ['SET', 'pres:' + rec.token, JSON.stringify(rec)],
    ['LPUSH', 'presby:' + rec.owner, rec.token],
    ['SADD', 'presall', rec.token],
    ['SADD', 'presblob:' + rec.pathname, rec.token]
  ]);
  return pub(rec, 0, null);
}

// GET    /api/presentations                       → enlaces del usuario (el administrador ve todos)
// GET    /api/presentations?token=…&opens=1       → aperturas de un enlace
// POST   /api/presentations {url,pathname,name,size,title,recipient,notes,expires} → registrar una subida
// POST   /api/presentations {from,title,recipient,notes,expires}               → otro enlace del mismo archivo
// PATCH  /api/presentations {token,title,recipient,notes,expires}              → editar
// DELETE /api/presentations?token=…               → borrar el enlace (y el archivo si ya no lo usa ninguno)
module.exports = async (req, res) => {
  const who = await authed(req);
  if (!who || who === 'cron') return json(res, 401, { error: 'No autorizado' });
  if (!hasModule(who, 'presentaciones')) return json(res, 403, { error: 'Tu cuenta no tiene habilitadas las presentaciones.' });
  const q = req.query || {};

  try {
    if (req.method === 'GET' && q.opens) {
      const token = safeToken(q.token);
      const [v, list] = token ? await redis([['GET', 'pres:' + token], ['LRANGE', 'presopen:' + token, 0, OPEN_LOG - 1]]) : [null, []];
      if (!v) return json(res, 404, { error: 'Enlace no encontrado.' });
      if (!canTouch(who, JSON.parse(v))) return json(res, 403, { error: 'No puedes ver este enlace.' });
      return json(res, 200, { items: (list || []).map(s => JSON.parse(s)) });
    }

    if (req.method === 'GET') {
      let tokens = [];
      if (who.role === 'admin') [tokens] = await redis([['SMEMBERS', 'presall']]);
      else if (who.email) [tokens] = await redis([['LRANGE', 'presby:' + who.email, 0, 499]]);
      return json(res, 200, { items: await load(tokens || []) });
    }

    if (req.method === 'POST') {
      if (!who.email) return json(res, 403, { error: 'Para crear enlaces necesitas una cuenta de usuario.' });
      const b = parseBody(req);
      const f = editable(b, null);
      if (f.error) return json(res, 400, { error: f.error });
      if (f.expires && f.expires < dayOf(Date.now())) return json(res, 400, { error: 'La fecha de vencimiento ya ha pasado.' });
      const token = crypto.randomBytes(18).toString('base64url');
      const now = new Date().toISOString();

      // Otro enlace para el mismo archivo (para enviarlo a otra persona con su propio seguimiento).
      if (b.from) {
        const [v] = await redis([['GET', 'pres:' + safeToken(b.from)]]);
        if (!v) return json(res, 404, { error: 'Presentación no encontrada.' });
        const src = JSON.parse(v);
        if (!canTouch(who, src)) return json(res, 403, { error: 'No puedes usar esta presentación.' });
        const rec = Object.assign({}, f, {
          token, title: f.title || src.title, name: src.name, size: src.size, ext: src.ext || presExt(src.name),
          url: src.url, pathname: src.pathname, created: now, owner: who.email, ownerName: who.name
        });
        return json(res, 201, { item: await saveNew(rec, who) });
      }

      let url = null;
      try { url = new URL(String(b.url || '')); } catch (e) {}
      const pathname = String(b.pathname || '');
      // El archivo debe estar en la carpeta de este usuario y en el almacén de Vercel Blob.
      if (!url || url.protocol !== 'https:' || !HOST_RE.test(url.hostname) || url.pathname !== '/' + pathname) {
        return json(res, 400, { error: 'Enlace de archivo no válido.' });
      }
      const ext = presExt(pathname);
      if (!pathname.startsWith('presentations/' + who.folder + '/') || !ext) {
        return json(res, 400, { error: 'Formato no admitido. Sube una presentación (PowerPoint, Keynote, OpenDocument o PDF).' });
      }
      const name = String(b.name || pathname.split('/').pop()).slice(0, 200);
      const rec = Object.assign({}, f, {
        token, title: f.title || name.replace(/\.[a-z0-9]+$/i, '').slice(0, TITLE_MAX), name, ext,
        size: Math.max(0, parseInt(b.size, 10) || 0), created: now, owner: who.email, ownerName: who.name,
        url: url.toString(), pathname
      });
      return json(res, 201, { item: await saveNew(rec, who) });
    }

    if (req.method === 'PATCH') {
      const b = parseBody(req);
      const token = safeToken(b.token);
      const [v] = token ? await redis([['GET', 'pres:' + token]]) : [null];
      if (!v) return json(res, 404, { error: 'Enlace no encontrado.' });
      const rec = JSON.parse(v);
      if (!canTouch(who, rec)) return json(res, 403, { error: 'No puedes editar este enlace.' });
      const f = editable(b, rec);
      if (f.error) return json(res, 400, { error: f.error });
      if ('title' in f && !f.title) delete f.title;
      Object.assign(rec, f, { updated: new Date().toISOString() });
      const [, opens, last] = await redis([['SET', 'pres:' + token, JSON.stringify(rec)], ['GET', 'presopens:' + token], ['LINDEX', 'presopen:' + token, 0]]);
      return json(res, 200, { item: pub(rec, opens, last) });
    }

    if (req.method === 'DELETE') {
      const token = safeToken(q.token);
      const [v] = token ? await redis([['GET', 'pres:' + token]]) : [null];
      if (!v) return json(res, 404, { error: 'Enlace no encontrado.' });
      const rec = JSON.parse(v);
      if (!canTouch(who, rec)) return json(res, 403, { error: 'No puedes borrar este enlace.' });
      const [, left] = await redis([['SREM', 'presblob:' + rec.pathname, token], ['SCARD', 'presblob:' + rec.pathname]]);
      // El archivo se borra solo cuando ningún otro enlace lo usa.
      if (!left) { try { await del(rec.url); } catch (e) { /* si el archivo ya no existe, seguimos limpiando */ } }
      await redis([
        ['DEL', 'pres:' + token], ['DEL', 'presopens:' + token], ['DEL', 'presopen:' + token],
        ['LREM', 'presby:' + rec.owner, 0, token], ['SREM', 'presall', token]
      ]);
      return json(res, 200, { ok: true, fileDeleted: !left });
    }

    return json(res, 405, { error: 'Método no permitido' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
