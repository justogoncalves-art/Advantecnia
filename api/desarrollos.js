const crypto = require('crypto');
const { redis, authed, json, parseBody, hasModule } = require('./_lib');

// Registro de desarrollos de la empresa (proyectos, apps y herramientas internas).
// Redis: 'devs' (set de ids) y 'dev:<id>' (JSON del desarrollo).
const STATUS = ['idea', 'desarrollo', 'pruebas', 'produccion', 'pausado'];
const AREAS = ['web', 'producto', 'interno', 'cliente'];
const MAX_ITEMS = 500;

const safeId = t => String(t || '').replace(/[^A-Za-z0-9_-]/g, '');
const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const longTxt = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim().slice(0, max);
// Solo enlaces http(s); cualquier otra cosa se descarta para no pintar javascript: en el panel.
function link(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.toString().slice(0, 500) : '';
  } catch (e) { return ''; }
}

// Normaliza los campos editables. Devuelve { error } si falta algo obligatorio.
function fields(b) {
  const f = {
    name: txt(b.name, 100),
    summary: longTxt(b.summary, 1200),
    status: STATUS.includes(b.status) ? b.status : 'idea',
    area: AREAS.includes(b.area) ? b.area : 'interno',
    owner: txt(b.owner, 80),
    next: txt(b.next, 240),
    url: link(b.url),
    repo: link(b.repo)
  };
  if (!f.name) return { error: 'Escribe el nombre del desarrollo.' };
  if (String(b.url || '').trim() && !f.url) return { error: 'El enlace no es válido. Usa una dirección que empiece por https://' };
  if (String(b.repo || '').trim() && !f.repo) return { error: 'El enlace del repositorio no es válido.' };
  return f;
}

// GET    /api/desarrollos           → todos los desarrollos (los ve cualquiera con la parte habilitada)
// POST   /api/desarrollos {…}       → crear
// PATCH  /api/desarrollos {id, …}   → editar
// DELETE /api/desarrollos?id=…      → borrar (quien lo creó o un administrador)
module.exports = async (req, res) => {
  const who = await authed(req);
  if (!who || who === 'cron') return json(res, 401, { error: 'No autorizado' });
  if (!hasModule(who, 'desarrollos')) return json(res, 403, { error: 'Tu cuenta no tiene habilitados los desarrollos.' });
  const by = who.name || who.email || 'Administración';

  try {
    if (req.method === 'GET') {
      const [ids] = await redis([['SMEMBERS', 'devs']]);
      if (!ids || !ids.length) return json(res, 200, { items: [] });
      const raw = await redis(ids.map(id => ['GET', 'dev:' + id]));
      const items = raw.filter(Boolean).map(s => JSON.parse(s))
        .sort((a, b) => (a.updated < b.updated ? 1 : -1));
      return json(res, 200, { items });
    }

    if (req.method === 'POST') {
      const f = fields(parseBody(req));
      if (f.error) return json(res, 400, { error: f.error });
      const [n] = await redis([['SCARD', 'devs']]);
      if (n >= MAX_ITEMS) return json(res, 400, { error: 'Se ha llegado al máximo de ' + MAX_ITEMS + ' desarrollos.' });
      const now = new Date().toISOString();
      const rec = Object.assign({ id: crypto.randomBytes(9).toString('base64url') }, f, {
        created: now, createdBy: by, creator: who.email || null, updated: now, updatedBy: by
      });
      await redis([['SET', 'dev:' + rec.id, JSON.stringify(rec)], ['SADD', 'devs', rec.id]]);
      return json(res, 201, { item: rec });
    }

    if (req.method === 'PATCH') {
      const b = parseBody(req);
      const id = safeId(b.id);
      const [v] = id ? await redis([['GET', 'dev:' + id]]) : [null];
      if (!v) return json(res, 404, { error: 'Desarrollo no encontrado.' });
      const old = JSON.parse(v);
      // Los campos que no llegan conservan su valor actual.
      const f = fields(Object.assign({}, old, b));
      if (f.error) return json(res, 400, { error: f.error });
      const rec = Object.assign(old, f, { updated: new Date().toISOString(), updatedBy: by });
      await redis([['SET', 'dev:' + id, JSON.stringify(rec)]]);
      return json(res, 200, { item: rec });
    }

    if (req.method === 'DELETE') {
      const id = safeId(req.query && req.query.id);
      const [v] = id ? await redis([['GET', 'dev:' + id]]) : [null];
      if (!v) return json(res, 404, { error: 'Desarrollo no encontrado.' });
      const rec = JSON.parse(v);
      if (who.role !== 'admin' && (!who.email || who.email !== rec.creator)) return json(res, 403, { error: 'Solo quien lo creó o un administrador puede borrarlo.' });
      await redis([['DEL', 'dev:' + id], ['SREM', 'devs', id]]);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Método no permitido' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
