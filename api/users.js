const { redis, authed, json, parseBody, normEmail, hashPassword, getUser, publicUser } = require('./_lib');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 10;

// Gestión de cuentas: solo administradores.
//   GET    /api/users                       → lista
//   POST   /api/users {email,name,password,role}   → crear
//   PATCH  /api/users {email,name?,password?,role?} → cambiar datos o contraseña
//   DELETE /api/users?email=...             → eliminar
module.exports = async (req, res) => {
  const who = await authed(req);
  if (!who) return json(res, 401, { error: 'No autorizado' });
  if (who === 'cron' || who.role !== 'admin') return json(res, 403, { error: 'Solo el administrador puede gestionar usuarios.' });

  try {
    if (req.method === 'GET') {
      const [emails] = await redis([['SMEMBERS', 'users']]);
      const raw = emails.length ? await redis(emails.map(e => ['GET', 'user:' + e])) : [];
      const items = raw.filter(Boolean).map(v => {
        const u = JSON.parse(v);
        return Object.assign(publicUser(u), { created: u.created || null });
      }).sort((a, b) => (a.created || '') < (b.created || '') ? -1 : 1);
      return json(res, 200, { items });
    }

    if (req.method === 'POST') {
      const b = parseBody(req);
      const email = normEmail(b.email);
      const name = String(b.name || '').trim().slice(0, 80);
      const password = String(b.password || '');
      const role = b.role === 'admin' ? 'admin' : 'user';
      if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'El email no es válido.' });
      if (password.length < MIN_PW) return json(res, 400, { error: 'La contraseña debe tener al menos ' + MIN_PW + ' caracteres.' });
      if (await getUser(email)) return json(res, 409, { error: 'Ya existe una cuenta con ese email.' });
      const u = { email, name: name || email, role, hash: await hashPassword(password), created: new Date().toISOString() };
      await redis([['SET', 'user:' + email, JSON.stringify(u)], ['SADD', 'users', email]]);
      return json(res, 201, { user: Object.assign(publicUser(u), { created: u.created }) });
    }

    if (req.method === 'PATCH') {
      const b = parseBody(req);
      const email = normEmail(b.email);
      const u = await getUser(email);
      if (!u) return json(res, 404, { error: 'No existe esa cuenta.' });
      if (b.name !== undefined) u.name = String(b.name || '').trim().slice(0, 80) || u.email;
      if (b.role !== undefined) u.role = b.role === 'admin' ? 'admin' : 'user';
      if (b.password) {
        if (String(b.password).length < MIN_PW) return json(res, 400, { error: 'La contraseña debe tener al menos ' + MIN_PW + ' caracteres.' });
        u.hash = await hashPassword(b.password);
      }
      const cmds = [['SET', 'user:' + email, JSON.stringify(u)]];
      if (b.password) cmds.push(['DEL', 'loginfail:' + email]); // un cambio de contraseña desbloquea la cuenta
      await redis(cmds);
      return json(res, 200, { user: Object.assign(publicUser(u), { created: u.created }) });
    }

    if (req.method === 'DELETE') {
      const email = normEmail(req.query && req.query.email);
      if (!email) return json(res, 400, { error: 'Falta el email.' });
      if (email === who.email) return json(res, 400, { error: 'No puedes eliminar tu propia cuenta.' });
      await redis([['DEL', 'user:' + email], ['SREM', 'users', email]]);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Método no permitido' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
};
