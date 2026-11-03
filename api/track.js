const { redis, dayOf, BOT, parseUA, sha, DAY_TTL } = require('./_lib');

const str = (v, n) => String(v == null ? '' : v).slice(0, n);
function cleanProps(p) {
  const o = {};
  if (!p || typeof p !== 'object') return o;
  Object.keys(p).slice(0, 14).forEach(k => {
    const v = p[k];
    if (typeof v === 'number' && isFinite(v)) o[str(k, 24)] = v;
    else if (typeof v === 'string' || typeof v === 'boolean') o[str(k, 24)] = str(v, 200);
  });
  return o;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin) {
    let oh = '';
    try { oh = new URL(origin).hostname; } catch (e) {}
    const host = String(req.headers.host || '').split(':')[0];
    if (oh !== host && !allowed.some(a => origin === a || oh === a)) { res.statusCode = 403; return res.end(); }
  }
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT.test(ua)) { res.statusCode = 204; return res.end(); }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (Buffer.isBuffer(b)) { try { b = JSON.parse(b.toString('utf8')); } catch (e) { b = null; } }
  if (!b || !Array.isArray(b.e) || !b.e.length) { res.statusCode = 400; return res.end(); }

  const now = Date.now(), day = dayOf(now);
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const vid = sha((process.env.ANALYTICS_SALT || 'advantecnia') + '|' + day + '|' + ip + '|' + ua).slice(0, 16);
  const cc = str(req.headers['x-vercel-ip-country'], 4);
  let ci = '';
  try { ci = decodeURIComponent(str(req.headers['x-vercel-ip-city'], 80)); } catch (e) {}
  const dev = parseUA(ua);
  const skew = typeof b.now === 'number' ? now - b.now : 0;

  const lines = b.e.slice(0, 40).map(e => JSON.stringify({
    n: str(e.n, 40), p: cleanProps(e.p), pg: str(e.pg, 30), sid: str(e.sid, 24),
    l: e.l === 'en' ? 'en' : 'es',
    t: typeof e.t === 'number' ? Math.min(now, Math.max(now - 3600000, e.t + skew)) : now,
    v: vid, cc, ci, d: dev.d, b: dev.b, o: dev.o
  }));

  try {
    await redis([['RPUSH', 'ev:' + day, ...lines], ['EXPIRE', 'ev:' + day, DAY_TTL]]);
    res.statusCode = 204; res.end();
  } catch (e) {
    res.statusCode = 503; res.end();
  }
};
