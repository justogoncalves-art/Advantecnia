const { handleUpload } = require('@vercel/blob/client');
const { authed, json, parseBody, hasModule, PRES_FORMATS, presExt } = require('./_lib');

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
// Tipos que el navegador puede declarar para los formatos admitidos (el panel envía el del formato).
const TYPES = Array.from(new Set(Object.values(PRES_FORMATS).map(f => f.type).concat(['application/octet-stream'])));

// El navegador sube el archivo directamente a Vercel Blob (las funciones no admiten
// cuerpos de más de unos 4,5 MB). Este endpoint solo emite el permiso de subida.
// El almacén es privado: los archivos solo se sirven a través de /p/<enlace>.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  const who = await authed(req);
  if (!who || who === 'cron') return json(res, 401, { error: 'Inicia sesión para subir presentaciones.' });
  if (!hasModule(who, 'presentaciones')) return json(res, 403, { error: 'Tu cuenta no tiene habilitadas las presentaciones.' });
  if (!who.email) return json(res, 403, { error: 'Para subir presentaciones necesitas una cuenta de usuario.' });

  try {
    const result = await handleUpload({
      body: parseBody(req),
      request: new Request('https://' + (req.headers.host || 'localhost') + (req.url || '/'), { method: 'POST', headers: req.headers }),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('presentations/' + who.folder + '/') || !presExt(pathname)) {
          throw new Error('Formato no admitido. Sube una presentación (PowerPoint, Keynote, OpenDocument o PDF).');
        }
        return {
          allowedContentTypes: TYPES,
          maximumSizeInBytes: MAX_BYTES,
          tokenPayload: JSON.stringify({ email: who.email })
        };
      }
    });
    return json(res, 200, result);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
};
