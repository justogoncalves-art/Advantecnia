const { redis, json, parseBody, normEmail, getUser, verifyPassword, publicUser, setSessionCookie, clearSessionCookie, authed, MODULES } = require('./_lib');

// Entrada, salida y "quién soy" en una sola función: el plan Hobby de Vercel admite 12 por despliegue.
// vercel.json mantiene las rutas de siempre:
//   POST /api/login  {email,password} → /api/session?action=login
//   POST /api/logout                  → /api/session?action=logout
//   GET  /api/me                      → /api/session?action=me

const MAX_FAILS = 10;     // intentos fallidos por email
const WINDOW_S = 900;     // ventana de 15 minutos

// La acción llega por la reescritura (?action=); si no, se deduce del final de la ruta original.
function actionOf(req) {
  const q = req.query && req.query.action;
  if (q) return String(q);
  const path = String(req.url || '').split('?')[0];
  return path.slice(path.lastIndexOf('/') + 1);
}

async function login(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
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
}

function logout(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}

// Devuelve quién está conectado (sesión de usuario o clave de administración).
async function me(req, res) {
  const who = await authed(req);
  if (!who || who === 'cron') return json(res, 401, { error: 'No autorizado' });
  return json(res, 200, { user: who, modules: MODULES });
}

module.exports = async (req, res) => {
  try {
    const a = actionOf(req);
    if (a === 'login') return await login(req, res);
    if (a === 'logout') return logout(req, res);
    if (a === 'me') return await me(req, res);
    return json(res, 404, { error: 'No encontrado' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
