const { redis, authed, json, parseBody, normEmail, hasModule, sendBatch, buildMail, EMAIL_OK } = require('./_lib');

const BATCH = 100;      // límite por petición de la API por lotes de Resend
const MAX_RCPT = 5000;  // destinatarios por envío
const MAX_HTML = 400000;
const BUSY_MS = 90000;  // un envío marcado como "en curso" más de 90 s se considera abandonado

const clean = s => String(s || '').replace(/[^a-z0-9]/gi, '');
const summary = c => ({
  id: c.id, subject: c.subject, status: c.status, total: c.total, next: c.next,
  sent: c.sent, failed: c.failed, skipped: c.skipped || 0, stats: c.stats || {}, created: c.created, by: c.by || ''
});

// Mailings: solo con la parte "Mailings" habilitada.
//   GET    /api/mailings                    → historial
//   GET    /api/mailings?id=...             → un envío con sus errores
//   POST   /api/mailings                    → crear {subject, html, recipients:[{email,name}]}
//   POST   /api/mailings?action=send&id=... → envía el siguiente lote de 100
//   POST   /api/mailings?action=test        → prueba {subject, html, to}
module.exports = async (req, res) => {
  const who = await authed(req);
  if (!who) return json(res, 401, { error: 'No autorizado' });
  if (!hasModule(who, 'mailings')) return json(res, 403, { error: 'Esta parte no está habilitada para tu cuenta.' });
  const q = req.query || {};
  try {
    if (req.method === 'GET') return q.id ? detail(q.id, res) : list(res);
    if (req.method === 'POST' && q.action === 'test') return test(req, res);
    if (req.method === 'POST' && q.action === 'send') return sendNext(q.id, res);
    if (req.method === 'POST') return create(who, req, res);
    return json(res, 405, { error: 'Método no permitido' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};

async function list(res) {
  const [ids] = await redis([['SMEMBERS', 'camps']]);
  const raw = ids && ids.length ? await redis(ids.map(id => ['GET', 'camp:' + id])) : [];
  const items = raw.filter(Boolean).map(v => summary(JSON.parse(v))).sort((a, b) => (a.created < b.created ? 1 : -1));
  return json(res, 200, { items });
}

async function detail(id, res) {
  const cid = clean(id);
  const [v] = await redis([['GET', 'camp:' + cid]]);
  if (!v) return json(res, 404, { error: 'No existe ese envío.' });
  const [fails] = await redis([['LRANGE', 'camp:' + cid + ':fail', 0, 499]]);
  return json(res, 200, { camp: summary(JSON.parse(v)), failed: (fails || []).map(s => JSON.parse(s)) });
}

async function create(who, req, res) {
  const b = parseBody(req);
  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const html = String(b.html || '');
  const list = Array.isArray(b.recipients) ? b.recipients : [];
  if (!subject) return json(res, 400, { error: 'Escribe el asunto.' });
  if (!html.trim()) return json(res, 400, { error: 'Escribe el contenido HTML.' });
  if (html.length > MAX_HTML) return json(res, 400, { error: 'El HTML supera el máximo de 400 KB.' });
  if (!list.length) return json(res, 400, { error: 'No hay destinatarios.' });
  if (list.length > MAX_RCPT) return json(res, 400, { error: 'Máximo ' + MAX_RCPT + ' destinatarios por envío. Divide la lista en varios envíos.' });

  const [sup] = await redis([['SMEMBERS', 'suppressed']]);
  const S = new Set(sup || []);
  const seen = new Set(), rcpt = [];
  const stats = { invalid: 0, duplicates: 0, unsubscribed: 0 };
  for (const r of list) {
    const email = normEmail(r && (r.email || r.mail));
    if (!EMAIL_OK(email)) { stats.invalid++; continue; }
    if (seen.has(email)) { stats.duplicates++; continue; }
    seen.add(email);
    if (S.has(email)) { stats.unsubscribed++; continue; }
    rcpt.push({ e: email, n: String((r && r.name) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80) });
  }
  if (!rcpt.length) return json(res, 400, { error: 'Ningún destinatario es válido o todos están dados de baja.', stats });

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const camp = {
    id, subject, html, total: rcpt.length, next: 0, sent: 0, failed: 0, skipped: 0,
    status: 'pending', busy: 0, stats, created: new Date().toISOString(), by: who.email || who.name || ''
  };
  const cmds = [['SET', 'camp:' + id, JSON.stringify(camp)], ['SADD', 'camps', id]];
  for (let i = 0; i < rcpt.length; i += 500) {
    cmds.push(['RPUSH', 'camp:' + id + ':q'].concat(rcpt.slice(i, i + 500).map(x => JSON.stringify(x))));
  }
  await redis(cmds);
  return json(res, 201, { camp: summary(camp) });
}

async function sendNext(rawId, res) {
  const id = clean(rawId);
  const key = 'camp:' + id;
  const [v] = id ? await redis([['GET', key]]) : [null];
  if (!v) return json(res, 404, { error: 'No existe ese envío.' });
  const c = JSON.parse(v);
  if (c.status === 'done') return json(res, 200, { camp: summary(c), done: true, sentNow: 0, failedNow: 0 });
  if (c.busy && Date.now() - c.busy < BUSY_MS) {
    return json(res, 409, { error: 'Este envío ya se está enviando desde otra pestaña. Espera un momento.' });
  }
  c.busy = Date.now();
  await redis([['SET', key, JSON.stringify(c)]]);

  try {
    const [rows] = await redis([['LRANGE', key + ':q', c.next, c.next + BATCH - 1]]);
    const items = (rows || []).map(s => JSON.parse(s));
    const [sup] = await redis([['SMEMBERS', 'suppressed']]);
    const S = new Set(sup || []);
    const live = items.filter(x => !S.has(x.e)); // por si alguien se dio de baja después de crear el envío
    const results = live.length ? await sendBatch(live.map(x => buildMail(c, x.e, x.n))) : [];

    let okN = 0;
    const fails = [];
    live.forEach((x, i) => {
      if (results[i] && results[i].ok) okN++;
      else fails.push({ e: x.e, m: (results[i] && results[i].error) || 'sin respuesta' });
    });
    c.next += items.length;
    c.sent += okN;
    c.failed += fails.length;
    c.skipped = (c.skipped || 0) + (items.length - live.length);
    c.busy = 0;
    c.status = items.length === 0 || c.next >= c.total ? 'done' : 'sending';
    if (c.status === 'done') c.sentAt = new Date().toISOString();

    const cmds = [['SET', key, JSON.stringify(c)]];
    if (fails.length) cmds.push(['RPUSH', key + ':fail'].concat(fails.map(x => JSON.stringify(x))));
    await redis(cmds);
    return json(res, 200, { camp: summary(c), done: c.status === 'done', sentNow: okN, failedNow: fails.length });
  } catch (e) {
    c.busy = 0;
    c.status = c.next ? 'sending' : 'pending';
    await redis([['SET', key, JSON.stringify(c)]]).catch(() => {});
    return json(res, 502, { error: e.message, camp: summary(c) });
  }
}

async function test(req, res) {
  const b = parseBody(req);
  const to = normEmail(b.to);
  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const html = String(b.html || '');
  if (!EMAIL_OK(to)) return json(res, 400, { error: 'Escribe un email válido para la prueba.' });
  if (!subject || !html.trim()) return json(res, 400, { error: 'Falta el asunto o el contenido HTML.' });
  if (html.length > MAX_HTML) return json(res, 400, { error: 'El HTML supera el máximo de 400 KB.' });
  const [m] = await sendBatch([buildMail({ subject, html }, to, 'Prueba')]);
  if (!m.ok) return json(res, 502, { error: 'No se ha podido enviar la prueba: ' + m.error });
  return json(res, 200, { ok: true });
}
