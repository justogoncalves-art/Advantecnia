const { Readable } = require('stream');
const { issueSignedToken, presignUrl, get } = require('@vercel/blob');
const { redis, dayOf, BOT, parseUA, sha, readSession, PRES_FORMATS, presExt } = require('./_lib');

// Enlace público de una presentación. vercel.json lo reescribe aquí:
//   GET  /p/<token>          → página con el visor        (/api/view?token=…)
//   GET  /p/<token>/archivo  → el archivo (enlace firmado) (/api/view?token=…&f=1)
//   POST /api/view?token=…&ev=open → la página avisa de que se ha abierto (seguimiento)
// El almacén de Vercel Blob es privado: el archivo solo se entrega mientras el enlace no ha caducado.

const SIGNED_MS = 2 * 60 * 60 * 1000; // validez de cada enlace firmado al archivo
const OPEN_LOG = 100;
const REPEAT_S = 30 * 60;             // la misma persona recargando en 30 min cuenta una vez
// Escáneres de correo y previsualizadores que abren enlaces sin que nadie los mire.
const SCANNER = /safelinks|proofpoint|mimecast|barracuda|bingpreview|skypeuripreview|teams|outlook|microsoftpreview|google-?read-?aloud|googleimageproxy|yahoo.*slurp|slackbot|discordbot|telegrambot|linkedinbot|twitterbot|embedly|quora link preview|vkshare|w3c_validator/i;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isExpired = p => !!p.expires && dayOf(Date.now()) > p.expires;
const fmtDay = s => { const [y, m, d] = s.split('-'); return d + '/' + m + '/' + y; };
function teamViewer(req) { try { return !!readSession(req); } catch (e) { return false; } }

function page(res, code, title, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end('<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>' + esc(title) + ' · Advantecnia</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' +
    'html,body{margin:0;height:100%;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;color:#16374D;background:#F4F7F8}' +
    'body{display:flex;flex-direction:column}' +
    '.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px clamp(16px,3vw,32px);background:#FFFFFF;border-bottom:1px solid #E3E9EA}' +
    '.who{display:flex;align-items:center;gap:14px;min-width:0}.who img{width:132px;height:auto}' +
    '.sep{width:1px;height:28px;background:#CBD9DE}' +
    'h1{margin:0;font-size:17px;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}' +
    '.btn{display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:999px;background:#0E8C99;color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none}' +
    '.btn:hover{background:#0B6F79}' +
    '.team{padding:8px clamp(16px,3vw,32px);background:#FFF6E5;border-bottom:1px solid #F1D9A6;font-size:13px;color:#6B4A0E}' +
    '.frame{flex:1;width:100%;border:0;min-height:0;background:#FFFFFF}' +
    '.card{max-width:520px;margin:16vh auto;padding:28px;background:#FFFFFF;border:1px solid #E3E9EA;border-radius:16px;display:grid;gap:14px}' +
    '.card img{width:150px;height:auto}.card h1{font-size:20px}.card p{margin:0;font-size:15px;line-height:1.6;color:#55636E}' +
    '@media (max-width:560px){.sep{display:none}.who{flex-wrap:wrap}}' +
    '</style></head><body>' + body + '</body></html>');
}

const card = (title, text, extra) => '<div class="card"><img src="/assets/adv-logo-color.svg" alt="Advantecnia"><h1>' + esc(title) + '</h1><p>' + text + '</p>' + (extra || '') + '</div>';

async function getRec(token) {
  if (!token) return null;
  const [v] = await redis([['GET', 'pres:' + token]]);
  return v ? JSON.parse(v) : null;
}

// Enlace temporal firmado al archivo privado.
async function signedUrl(p) {
  const validUntil = Date.now() + SIGNED_MS;
  const tok = await issueSignedToken({ pathname: p.pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(tok, { operation: 'get', pathname: p.pathname, access: 'private', validUntil });
  return presignedUrl;
}

async function serveFile(req, res, p) {
  try {
    const url = await signedUrl(p);
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.end();
  } catch (e) {
    // Si no se puede firmar, se entrega el archivo a través de la función.
    const r = await get(p.pathname, { access: 'private' });
    if (!r || r.statusCode !== 200 || !r.stream) { res.statusCode = 404; return res.end(); }
    const f = PRES_FORMATS[p.ext || presExt(p.name)] || {};
    res.statusCode = 200;
    res.setHeader('Content-Type', f.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', (f.view === 'none' ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(p.name || 'presentacion'));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    Readable.fromWeb(r.stream).pipe(res);
  }
}

// Registra una apertura real: ni robots, ni escáneres de correo, ni el equipo con sesión iniciada.
async function recordOpen(req, res, token) {
  res.setHeader('Cache-Control', 'no-store');
  const done = code => { res.statusCode = code; res.end(); };
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT.test(ua) || SCANNER.test(ua) || teamViewer(req)) return done(204);
  const p = await getRec(token);
  if (!p || isExpired(p)) return done(204);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const who = sha((process.env.ANALYTICS_SALT || '') + '|' + token + '|' + ip + '|' + ua).slice(0, 24);
  const [fresh] = await redis([['SET', 'presseen:' + token + ':' + who, '1', 'NX', 'EX', REPEAT_S]]);
  if (!fresh) return done(204);
  const u = parseUA(ua);
  let city = String(req.headers['x-vercel-ip-city'] || '');
  try { city = decodeURIComponent(city); } catch (e) {}
  const ev = { at: new Date().toISOString(), cc: String(req.headers['x-vercel-ip-country'] || ''), city: city.slice(0, 80), dev: u.d, br: u.b, os: u.o };
  await redis([
    ['INCR', 'presopens:' + token],
    ['LPUSH', 'presopen:' + token, JSON.stringify(ev)],
    ['LTRIM', 'presopen:' + token, 0, OPEN_LOG - 1]
  ]);
  return done(204);
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const token = String(q.token || '').replace(/[^A-Za-z0-9_-]/g, '');
  try {
    if (req.method === 'POST' && q.ev === 'open') return await recordOpen(req, res, token);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }

    const p = await getRec(token);
    if (!p) {
      if (q.f) { res.statusCode = 404; return res.end(); }
      return page(res, 404, 'Presentación no encontrada', card('Presentación no encontrada', 'Este enlace no existe o la presentación se ha eliminado.'));
    }
    if (isExpired(p)) {
      if (q.f) { res.statusCode = 410; return res.end(); }
      return page(res, 410, 'Enlace caducado', card('Este enlace ha caducado', 'La presentación «' + esc(p.title) + '» estaba disponible hasta el ' + fmtDay(p.expires) + '. Si necesitas verla, pide un enlace nuevo a quien te la envió.'));
    }
    if (q.f) return await serveFile(req, res, p);

    const f = PRES_FORMATS[p.ext || presExt(p.name)] || { view: 'none' };
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'advantecnia.com');
    const fileUrl = 'https://' + host + '/p/' + token + '/archivo';
    const team = teamViewer(req);
    const bar = '<div class="bar"><div class="who"><img src="/assets/adv-logo-color.svg" alt="Advantecnia"><span class="sep"></span><h1>' + esc(p.title) + '</h1></div>' +
      '<a class="btn" href="/p/' + token + '/archivo" target="_blank" rel="noopener">Descargar</a></div>' +
      (team ? '<div class="team">Vista del equipo: has iniciado sesión en el panel, así que esta visita no cuenta como apertura.</div>' : '');
    let main;
    if (f.view === 'office') {
      const viewer = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(fileUrl);
      main = '<iframe class="frame" src="' + esc(viewer) + '" title="' + esc(p.title) + '" allowfullscreen></iframe>';
    } else if (f.view === 'pdf') {
      main = '<iframe class="frame" src="/p/' + token + '/archivo" title="' + esc(p.title) + '"></iframe>';
    } else {
      main = card(p.title, 'Esta presentación está en formato ' + esc(String(p.ext || '').toUpperCase()) + ' y no se puede ver en el navegador. Descárgala para abrirla.',
        '<a class="btn" style="justify-self:start" href="/p/' + token + '/archivo">Descargar la presentación</a>');
    }
    // Aviso de apertura cuando la página lleva un momento visible (los escáneres de correo no ejecutan esto).
    const beacon = team ? '' : '<script>(function(){var sent=false,t=null;function send(){if(sent)return;sent=true;try{navigator.sendBeacon("/api/view?token=' + token + '&ev=open")}catch(e){}}' +
      'function arm(){if(document.visibilityState==="visible"&&!t)t=setTimeout(send,1500)}' +
      'document.addEventListener("visibilitychange",arm);arm()})()</script>';
    return page(res, 200, p.title, bar + main + beacon);
  } catch (e) {
    if (q.f) { res.statusCode = 500; return res.end(); }
    return page(res, 500, 'Error', card('No se ha podido abrir la presentación', 'Inténtalo de nuevo en unos minutos.'));
  }
};
