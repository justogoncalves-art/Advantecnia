const { redis, json, parseBody, normEmail, getUser, verifyPassword, publicUser, setSessionCookie } = require('./_lib');

const MAX_FAILS = 10;     // intentos fallidos por email
const WINDOW_S = 900;     // ventana de 15 minutos

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  try {
    const body = parseBody(req);
    const email = normEmail(body.email);
    const pw = String(body.password || '');
    if (!email || !pw) return json(res, 400, { error: 'Escribe el email y la contraseña.' });

    const failKey = 'loginfail:' + email;
    const [fails] = await redis([['GET', failKey]]);
    if (parseInt(fails || '0', 10) >= MAX_FAILS) {
      return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' });
    }

    const u = await getUser(email);
    const ok = u ? await verifyPassword(pw, u.hash) : false;
    if (!ok) {
      await redis([['INCR', failKey], ['EXPIRE', failKey, WINDOW_S]]);
      return json(res, 401, { error: 'Email o contraseña incorrectos.' });
    }

    await redis([['DEL', failKey]]);
    setSessionCookie(res, u.email);
    return json(res, 200, { user: publicUser(u) });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
