const crypto = require('crypto');
const { del } = require('@vercel/blob');
const { redis, authed, json, parseBody, hasModule } = require('./_lib');

const HOST_RE = /\.blob\.vercel-storage\.com$/;
const TITLE_MAX = 120;

const pub = p => ({ token: p.token, title: p.title, name: p.name, size: p.size, created: p.created, owner: p.owner, ownerName: p.ownerName });
const safeToken = t => String(t || '').replace(/[^A-Za-z0-9_-]/g, '');

// GET    /api/presentations               → presentaciones del usuario (el administrador ve todas)
// POST   /api/presentations {url,pathname,name,size,title} → registrar una subida terminada
// DELETE /api/presentations?token=...     → borrar (dueño o administrador)
module.exports = async (req, res) => {
  const who = await authed(req);
  if (!who || who === 'cron') return json(res, 401, { error: 'No autorizado' });
  if (!hasModule(who, 'presentaciones')) return json(res, 403, { error: 'Tu cuenta no tiene habilitadas las presentaciones.' });

  try {
    if (req.method === 'GET') {
      let tokens = [];
      if (who.role === 'admin') {
        [tokens] = await redis([['SMEMBERS', 'presall']]);
      } else if (who.email) {
        [tokens] = await redis([['LRANGE', 'presby:' + who.email, 0, 199]]);
      }
      if (!tokens.length) return json(res, 200, { items: [] });
      const raw = await redis(tokens.map(t => ['GET', 'pres:' + t]));
      const items = raw.filter(Boolean).map(s => pub(JSON.parse(s)))
        .sort((a, b) => (a.created < b.created ? 1 : -1));
      return json(res, 200, { items });
    }

    if (req.method === 'POST') {
      if (!who.email) return json(res, 403, { error: 'Para subir presentaciones necesitas una cuenta de usuario.' });
      const b = parseBody(req);
      let url = null;
      try { url = new URL(String(b.url || '')); } catch (e) {}
      const pathname = String(b.pathname || '');
      // El archivo debe estar en la carpeta de este usuario y en el almacén de Vercel Blob.
      if (!url || url.protocol !== 'https:' || !HOST_RE.test(url.hostname) || url.pathname !== '/' + pathname) {
        return json(res, 400, { error: 'Enlace de archivo no válido.' });
      }
      if (!pathname.startsWith('presentations/' + who.folder + '/') || !/\.(pptx|ppt)$/i.test(pathname)) {
        return json(res, 400, { error: 'Archivo no válido. Sube un .pptx o .ppt.' });
      }
      const name = String(b.name || pathname.split('/').pop()).slice(0, 200);
      const title = (String(b.title || '').trim() || name.replace(/\.(pptx?)$/i, '')).slice(0, TITLE_MAX);
      const token = crypto.randomBytes(18).toString('base64url');
      const rec = {
        token, title, name, size: Math.max(0, parseInt(b.size, 10) || 0),
        created: new Date().toISOString(), owner: who.email, ownerName: who.name,
        url: url.toString(), pathname
      };
      await redis([
        ['SET', 'pres:' + token, JSON.stringify(rec)],
        ['LPUSH', 'presby:' + who.email, token],
        ['SADD', 'presall', token]
      ]);
      return json(res, 201, { item: pub(rec) });
    }

    if (req.method === 'DELETE') {
      const token = safeToken(req.query && req.query.token);
      const [v] = token ? await redis([['GET', 'pres:' + token]]) : [null];
      if (!v) return json(res, 404, { error: 'Presentación no encontrada.' });
      const rec = JSON.parse(v);
      if (who.role !== 'admin' && who.email !== rec.owner) return json(res, 403, { error: 'No puedes borrar esta presentación.' });
      try { await del(rec.url); } catch (e) { /* si el archivo ya no existe, seguimos limpiando */ }
      await redis([
        ['DEL', 'pres:' + token],
        ['LREM', 'presby:' + rec.owner, 0, token],
        ['SREM', 'presall', token]
      ]);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Método no permitido' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
