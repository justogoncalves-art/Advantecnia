const { redis, normEmail, unsubOk, EMAIL_OK, escHtml } = require('./_lib');

function page(res, code, title, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.end('<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>' + escHtml(title) + ' · Advantecnia</title>' +
    '<style>' +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;background:#F4F7F8;color:#16374D}' +
    '.card{max-width:460px;background:#FFFFFF;border:1px solid #E3E9EA;border-radius:16px;padding:28px;display:grid;gap:14px}' +
    'h1{margin:0;font-size:20px;font-weight:800}p{margin:0;font-size:15px;line-height:1.6;color:#55636E}' +
    'button{height:44px;border:0;border-radius:999px;background:#0E8C99;color:#FFFFFF;font:inherit;font-weight:700;font-size:15px;cursor:pointer}' +
    '</style></head><body><main class="card"><h1>' + escHtml(title) + '</h1>' + body + '</main></body></html>');
}

// Baja de los envíos: /baja?e=<email>&t=<token> (reescrito a /api/unsubscribe).
// GET muestra una confirmación: así los escáneres de enlaces no dan de baja a nadie por error.
// POST la aplica; es también la llamada de un clic (cabecera List-Unsubscribe-Post) de Gmail y Outlook.
module.exports = async (req, res) => {
  const q = req.query || {};
  const email = normEmail(q.e);
  try {
    if (!EMAIL_OK(email) || !unsubOk(email, q.t)) {
      return page(res, 400, 'Enlace no válido',
        '<p>Este enlace de baja no es válido. Escribe a info@advantecnia.com y te damos de baja a mano.</p>');
    }
    if (req.method === 'POST') {
      await redis([['SADD', 'suppressed', email]]);
      return page(res, 200, 'Baja confirmada',
        '<p>Te hemos dado de baja. No recibirás más envíos de Advantecnia por este medio.</p>');
    }
    if (req.method !== 'GET') return page(res, 405, 'Método no permitido', '<p>Usa el enlace del correo.</p>');
    return page(res, 200, 'Darte de baja',
      '<p>Confirma que quieres dejar de recibir correos de Advantecnia en <strong>' + escHtml(email) + '</strong>.</p>' +
      '<form method="post"><button type="submit">Confirmar la baja</button></form>');
  } catch (e) {
    return page(res, 500, 'Error',
      '<p>No se ha podido procesar la baja ahora. Inténtalo más tarde o escribe a info@advantecnia.com.</p>');
  }
};
