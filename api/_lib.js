const crypto = require('crypto');

const net = require('net');
const tls = require('tls');

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_URL = process.env.REDIS_URL;
const TZ = 'Europe/Madrid';
const DAY_TTL = 60 * 60 * 24 * 400;

// Ejecuta una lista de comandos y devuelve sus resultados en orden.
// Admite Upstash (API REST: KV_REST_API_URL + KV_REST_API_TOKEN) o un Redis normal (REDIS_URL, redis:// o rediss://).
async function redis(cmds) {
  if (RURL && RTOK) return redisRest(cmds);
  if (REDIS_URL) return redisTcp(cmds);
  throw new Error('Base de datos no configurada (falta REDIS_URL o KV_REST_API_URL / KV_REST_API_TOKEN)');
}

// Redis por TCP con el protocolo RESP, sin dependencias: una conexión por petición (funciones serverless).
function redisTcp(cmds) {
  const u = new URL(REDIS_URL);
  const pre = [];
  const user = decodeURIComponent(u.username || ''), pass = decodeURIComponent(u.password || '');
  if (pass) pre.push(user && user !== 'default' ? ['AUTH', user, pass] : ['AUTH', pass]);
  const db = parseInt((u.pathname || '').slice(1), 10);
  if (db > 0) pre.push(['SELECT', db]);
  const all = pre.concat(cmds);
  const enc = cmd => {
    const parts = [Buffer.from('*' + cmd.length + '\r\n')];
    for (const a of cmd) { const b = Buffer.from(String(a)); parts.push(Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n')); }
    return Buffer.concat(parts);
  };
  const port = parseInt(u.port, 10) || 6379;
  return new Promise((resolve, reject) => {
    const sock = u.protocol === 'rediss:' ? tls.connect({ host: u.hostname, port, servername: u.hostname }) : net.connect({ host: u.hostname, port });
    let buf = Buffer.alloc(0), pos = 0, done = false;
    const out = [];
    const finish = (err, val) => { if (done) return; done = true; sock.destroy(); err ? reject(err) : resolve(val); };
    sock.setTimeout(8000, () => finish(new Error('Redis: tiempo de espera agotado')));
    sock.on('error', e => finish(new Error('Redis: ' + e.message)));
    sock.on('close', () => finish(new Error('Redis: conexión cerrada')));
    sock.once(u.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => sock.write(Buffer.concat(all.map(enc))));
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      let r;
      while (out.length < all.length && (r = respParse(buf, pos))) { out.push(r[0]); pos = r[1]; }
      if (out.length < all.length) return;
      const errs = out.filter(x => x && x.error);
      if (errs.length) return finish(new Error(errs[0].error));
      finish(null, out.slice(pre.length));
    });
  });
}

// Lee una respuesta RESP desde buf[i]. Devuelve [valor, siguienteÍndice] o null si aún no ha llegado completa.
function respParse(buf, i) {
  if (i >= buf.length) return null;
  const e = buf.indexOf('\r\n', i);
  if (e < 0) return null;
  const t = String.fromCharCode(buf[i]), line = buf.toString('utf8', i + 1, e);
  if (t === '+') return [line, e + 2];
  if (t === '-') return [{ error: line }, e + 2];
  if (t === ':') return [parseInt(line, 10), e + 2];
  if (t === '$') {
    const n = parseInt(line, 10);
    if (n < 0) return [null, e + 2];
    if (buf.length < e + 4 + n) return null;
    return [buf.toString('utf8', e + 2, e + 2 + n), e + 4 + n];
  }
  if (t === '*') {
    const n = parseInt(line, 10);
    if (n < 0) return [null, e + 2];
    const arr = []; let j = e + 2;
    for (let k = 0; k < n; k++) { const r = respParse(buf, j); if (!r) return null; arr.push(r[0]); j = r[1]; }
    return [arr, j];
  }
  throw new Error('Redis: respuesta no reconocida');
}

async function redisRest(cmds) {
  const r = await fetch(RURL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RTOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('Redis ' + r.status);
  const j = await r.json();
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
const dayOf = ts => dayFmt.format(new Date(ts));
const hourOf = ts => parseInt(hourFmt.format(new Date(ts)), 10) % 24;
function daysBack(n, endDay) {
  const end = new Date((endDay || dayOf(Date.now())) + 'T12:00:00Z');
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(end.getTime() - i * 864e5).toISOString().slice(0, 10));
  return out;
}

function authed(req) {
  const pw = process.env.DASHBOARD_PASSWORD;
  const k = req.headers['x-dash-key'];
  if (pw && k && safeEq(k, pw)) return 'manual';
  const cs = process.env.CRON_SECRET;
  if (cs && req.headers.authorization === 'Bearer ' + cs) return 'cron';
  return null;
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\//i;
function parseUA(u) {
  const d = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(u) ? 'Tablet' : /Mobi|iPhone|Android/i.test(u) ? 'Móvil' : 'Escritorio';
  const b = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Chrome|CriOS/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Otro';
  const o = /Windows/.test(u) ? 'Windows' : /iPhone|iPad|iOS/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : 'Otro';
  return { d, b, o };
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function srcOf(ref) {
  if (!ref) return 'Directo';
  let h;
  try { h = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return 'Otros'; }
  if (/(^|\.)google\./.test(h)) return 'Google';
  if (/(^|\.)bing\./.test(h)) return 'Bing';
  if (/duckduckgo|yahoo|ecosia|yandex|brave/.test(h)) return 'Otros buscadores';
  if (/linkedin|lnkd/.test(h)) return 'LinkedIn';
  if (/facebook|fb\.|messenger/.test(h)) return 'Facebook';
  if (/instagram/.test(h)) return 'Instagram';
  if (/^t\.co$|twitter|(^|\.)x\.com/.test(h)) return 'X (Twitter)';
  if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
  if (/youtube|youtu\.be/.test(h)) return 'YouTube';
  if (/chatgpt|openai|perplexity|claude\.ai|gemini|copilot/.test(h)) return 'Asistentes de IA';
  if (/mail\.|outlook|gmail/.test(h)) return 'Email';
  return h;
}

const MAPS = ['pages', 'sec', 'cta', 'ev', 'src', 'camp', 'land', 'cc', 'ci', 'dev', 'br', 'os', 'lang', 'sol', 'proj', 'eco', 'scroll', 'out', 'err', 'rage', 'wa'];
function empty(day) {
  const A = { day, pv: 0, s: 0, es: 0, ms: 0, v: [], conv: { form: 0, wa: 0, tel: 0, mail: 0 }, funnel: { s: 0, sec: 0, start: 0, submit: 0 }, vit: { lcpS: 0, lcpN: 0, clsS: 0, clsN: 0, inpS: 0, inpN: 0, ttfbS: 0, ttfbN: 0 }, hours: Array(24).fill(0) };
  MAPS.forEach(k => { A[k] = {}; });
  return A;
}
const inc = (o, k, n) => { if (k === undefined || k === null || k === '') return; o[k] = (o[k] || 0) + (n || 1); };

async function readDay(day) {
  const out = [], STEP = 5000;
  for (let start = 0; ; start += STEP) {
    const [chunk] = await redis([['LRANGE', 'ev:' + day, start, start + STEP - 1]]);
    if (!chunk || !chunk.length) break;
    for (const s of chunk) { try { out.push(JSON.parse(s)); } catch (e) {} }
    if (chunk.length < STEP) break;
  }
  return out;
}

function aggregate(day, evs) {
  const A = empty(day), V = new Set(), S = {};
  evs.sort((a, b) => a.t - b.t);
  for (const e of evs) {
    if (!e || !e.sid) continue;
    V.add(e.v);
    const s = S[e.sid] || (S[e.sid] = { pv: 0, ms: 0, eng: false, aud: false, start: false, sub: false, land: null, src: null, first: e, lang: e.l });
    const p = e.p || {};
    inc(A.ev, e.n);
    switch (e.n) {
      case 'session_start':
        s.src = p.utm_source ? 'Campaña: ' + p.utm_source : (p.gclid ? 'Google Ads' : srcOf(p.ref));
        if (p.utm_source || p.utm_campaign) inc(A.camp, [p.utm_source, p.utm_medium, p.utm_campaign].filter(Boolean).join(' / '));
        break;
      case 'page_view':
        A.pv++; s.pv++; s.lang = e.l; inc(A.pages, e.pg); A.hours[hourOf(e.t)]++;
        if (!s.land) s.land = e.pg;
        if (e.pg === 'ficha' && p.proyecto) inc(A.proj, p.proyecto);
        break;
      case 'engage': s.ms += Math.max(0, Math.min(+p.ms || 0, 1800000)); break;
      case 'section_view': inc(A.sec, p.s); if (p.s === 'Formulario de contacto') s.aud = true; break;
      case 'click': inc(A.cta, p.label); break;
      case 'form_start': s.start = true; s.eng = true; break;
      case 'form_submit': A.conv.form++; s.sub = true; s.eng = true; break;
      case 'whatsapp_click': A.conv.wa++; s.eng = true; break;
      case 'tel_click': A.conv.tel++; s.eng = true; break;
      case 'mail_click': A.conv.mail++; s.eng = true; break;
      case 'wa_open': inc(A.wa, p.mode === 'auto' ? 'Burbuja abierta sola al hacer scroll' : 'Burbuja abierta por el usuario'); break;
      case 'wa_close': inc(A.wa, 'Burbuja cerrada'); break;
      case 'solution_view': inc(A.sol, p.sol); break;
      case 'eco_open': inc(A.eco, p.id); break;
      case 'scroll': inc(A.scroll, String(p.d)); break;
      case 'outbound': inc(A.out, p.host); break;
      case 'js_error': inc(A.err, p.m); break;
      case 'rage_click': inc(A.rage, p.label); break;
      case 'vitals':
        if (p.lcp > 0) { A.vit.lcpS += +p.lcp; A.vit.lcpN++; }
        if (p.cls >= 0) { A.vit.clsS += +p.cls; A.vit.clsN++; }
        if (p.inp > 0) { A.vit.inpS += +p.inp; A.vit.inpN++; }
        if (p.ttfb > 0) { A.vit.ttfbS += +p.ttfb; A.vit.ttfbN++; }
        break;
    }
  }
  for (const s of Object.values(S)) {
    if (!s.pv) continue;
    A.s++; A.ms += s.ms;
    if (s.pv > 1 || s.ms >= 10000 || s.eng) A.es++;
    inc(A.land, s.land); inc(A.src, s.src || 'Directo');
    const f = s.first;
    inc(A.cc, f.cc || '—'); if (f.ci) inc(A.ci, f.ci);
    inc(A.dev, f.d); inc(A.br, f.b); inc(A.os, f.o);
    inc(A.lang, s.lang === 'en' ? 'Inglés' : 'Español');
    A.funnel.s++;
    if (s.aud || s.start || s.sub) A.funnel.sec++;
    if (s.start || s.sub) A.funnel.start++;
    if (s.sub) A.funnel.submit++;
  }
  A.v = [...V];
  return A;
}

function merge(list) {
  const M = empty(null), V = new Set();
  for (const a of list) {
    if (!a) continue;
    M.pv += a.pv; M.s += a.s; M.es += a.es; M.ms += a.ms;
    (a.v || []).forEach(x => V.add(x));
    MAPS.forEach(k => { for (const [x, n] of Object.entries(a[k] || {})) M[k][x] = (M[k][x] || 0) + n; });
    ['conv', 'funnel', 'vit'].forEach(g => { for (const k in M[g]) M[g][k] += (a[g] && a[g][k]) || 0; });
    (a.hours || []).forEach((n, i) => { M.hours[i] += n; });
  }
  M.visitors = V.size;
  delete M.v; delete M.day;
  MAPS.forEach(k => { M[k] = Object.fromEntries(Object.entries(M[k]).sort((a, b) => b[1] - a[1]).slice(0, 60)); });
  return M;
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = { redis, dayOf, hourOf, daysBack, authed, BOT, parseUA, sha, aggregate, readDay, merge, json, DAY_TTL };
