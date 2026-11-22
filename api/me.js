const { authed, json } = require('./_lib');

// Devuelve quién está conectado (sesión de usuario o clave de administración).
module.exports = async (req, res) => {
  const who = await authed(req);
  if (!who || who === 'cron') return json(res, 401, { error: 'No autorizado' });
  return json(res, 200, { user: who });
};
