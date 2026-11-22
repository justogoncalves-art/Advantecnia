const { redis } = require('./_lib');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(res, code, title, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.end('<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>' + esc(title) + ' · Advantecnia</title>' +
    '<style>' +
    'html,body{margin:0;height:100%;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;color:#16374D;background:#F4F7F8}' +
    'body{display:flex;flex-direction:column}' +
    '.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px clamp(16px,3vw,32px);background:#FFFFFF;border-bottom:1px solid #E3E9EA}' +
    'h1{margin:0;font-size:18px;font-weight:800;letter-spacing:-.01em}' +
    'a{color:#0E8C99;font-weight:700;font-size:14px}' +
    '.frame{flex:1;width:100%;border:0;min-height:0}' +
    '.msg{max-width:520px;margin:20vh auto;padding:0 16px;font-size:15px;line-height:1.6;color:#55636E}' +
    '</style></head><body>' + body + '</body></html>');
}

// Enlace público de una presentación: /p/<token> (reescrito a /api/view?token=<token>).
module.exports = async (req, res) => {
  const token = String((req.query && req.query.token) || '').replace(/[^A-Za-z0-9_-]/g, '');
  try {
    const [v] = token ? await redis([['GET', 'pres:' + token]]) : [null];
    if (!v) {
      return page(res, 404, 'Presentación no encontrada',
        '<p class="msg">Este enlace no existe o la presentación se ha eliminado.</p>');
    }
    const p = JSON.parse(v);
    const viewer = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(p.url);
    return page(res, 200, p.title,
      '<div class="bar"><h1>' + esc(p.title) + '</h1>' +
      '<a href="' + esc(p.url) + '" download>Descargar el archivo</a></div>' +
      '<iframe class="frame" src="' + esc(viewer) + '" title="' + esc(p.title) + '" allowfullscreen></iframe>');
  } catch (e) {
    return page(res, 500, 'Error', '<p class="msg">No se ha podido abrir la presentación. Inténtalo más tarde.</p>');
  }
};
