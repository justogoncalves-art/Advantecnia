# Advantecnia Web

Web corporativa de Advantecnia con medición propia sin cookies y un panel de analítica en `/dashboard`.

## Estructura

```
index.html            Web (una sola página con navegación interna)
dashboard.dc.html     Central de la empresa: inicio, desarrollos, analítica y herramientas (se sirve en /dashboard)
support.js            Motor que pinta index.html y dashboard.dc.html
assets/at.js          Etiquetado: envía los eventos a /api/track
api/track.js          Recibe eventos y los guarda en Redis
api/refresh.js        Recalcula los totales por día (cron diario y botón manual)
api/stats.js          Devuelve los datos al panel
api/session.js        Entrada (/api/login), salida (/api/logout) y quién está conectado (/api/me), en una sola función
api/users.js          Cuentas de usuario (solo administración)
api/presentations.js  Lista, registra y borra presentaciones
api/blob-upload.js    Permiso para que el navegador suba el PowerPoint a Vercel Blob
api/view.js           Página pública de cada presentación (/p/<enlace>)
api/desarrollos.js    Registro de desarrollos de la empresa (central del panel)
api/_lib.js           Funciones comunes: Redis, sesiones, contraseñas (no es un endpoint)
assets/vendor/        Cliente de Vercel Blob para el navegador (versión fija en el nombre)
vercel.json           Rutas, cron diario y cabeceras
robots.txt            Excluye /dashboard, /p y /api de buscadores
```

## Publicar en Vercel

1. Sube el contenido de esta carpeta a la raíz del repositorio de GitHub.
2. En Vercel: **Add New → Project**, importa el repositorio. Framework: **Other**. Sin comando de build. Output: `/`.
3. Base de datos: en el proyecto de Vercel, **Storage → Create** una base Redis y conéctala al proyecto. Sirven las dos opciones: **Redis** (Vercel añade `REDIS_URL`) o **Upstash for Redis** (añade `KV_REST_API_URL` y `KV_REST_API_TOKEN`). Si existen las dos, se usa Upstash.
4. Almacén de archivos: **Storage → Create → Blob**, y conéctalo al proyecto. Vercel añade `BLOB_READ_WRITE_TOKEN`. Las presentaciones se guardan ahí.
5. **Settings → Environment Variables**, añade:
   - `DASHBOARD_PASSWORD`: clave de administración (sirve también para entrar con la opción «Acceso de administración con clave»).
   - `SESSION_SECRET`: texto aleatorio de al menos 32 caracteres. Firma las sesiones; si cambia, todos tienen que volver a entrar.
   - `ADMIN_EMAILS`: emails de los administradores, separados por comas. Tienen acceso a la pestaña Usuarios.
   - `CRON_SECRET`: cualquier texto largo aleatorio. Vercel lo usa para autorizar el cron.
   - `ANALYTICS_SALT`: otro texto aleatorio (anonimiza a los visitantes).
   - `ALLOWED_ORIGINS` (opcional): `https://advantecnia.com,https://www.advantecnia.com` si la web y la API están en dominios distintos.
   - `RESEND_API_KEY` (para los mailings): clave de [Resend](https://resend.com). Antes verifica el dominio `advantecnia.com` en Resend (registros SPF y DKIM en el DNS) para poder enviar desde `news@advantecnia.com`.
   - `MAIL_FROM` (opcional): remitente. Por defecto `Advantecnia <news@advantecnia.com>`.
   - `MAIL_REPLY_TO` (opcional): respuesta. Por defecto `info@advantecnia.com`.
   - `PUBLIC_URL` (opcional): dominio público para los enlaces de baja. Por defecto `https://advantecnia.com`.
6. **Redeploy** para que tome las variables.
7. Dominio: **Settings → Domains**, añade `advantecnia.com`. El panel queda en `https://advantecnia.com/dashboard`.

## Usuarios y presentaciones

- Entrar: `/dashboard` pide email y contraseña. La sesión dura 7 días.
- Crear cuentas: un administrador entra, abre la pestaña **Usuarios** y crea la cuenta con una contraseña inicial de al menos 10 caracteres. Compártela por un canal seguro.
- Cambiar una contraseña o eliminar una cuenta: también desde **Usuarios**. Cambiar la contraseña desbloquea la cuenta si se bloqueó por intentos fallidos (10 errores en 15 minutos).
- Presentaciones: cualquier usuario sube un `.pptx` o `.ppt` de hasta 100 MB en la pestaña **Presentaciones**. Cada una tiene un enlace `https://advantecnia.com/p/<código>` que abre la presentación en el visor de Microsoft Office. Quien tenga el enlace puede verla; el código es aleatorio y no se puede adivinar.
- Botón **Enviar por email**: abre el cliente de correo con el enlace listo para enviar.
- Las presentaciones de cada usuario se listan solo para él; el administrador las ve todas.
- Al subir, el archivo queda en Vercel Blob con acceso público por URL. Borrar una presentación borra el archivo y el enlace.

## Central de desarrollos

- Al entrar en `/dashboard` se abre **Inicio**: un resumen con una tarjeta por cada herramienta que tienes habilitada y los últimos desarrollos actualizados.
- **Desarrollos** es el registro común de proyectos, apps y herramientas de la empresa: nombre, estado (Idea, En desarrollo, En pruebas, En producción, Pausado), área, responsable, enlace, repositorio, próximo paso y descripción. Se filtra por estado y se busca por texto.
- Lo ve y lo edita cualquiera con la parte **Desarrollos** habilitada (los administradores la tienen siempre; las cuentas nuevas la traen marcada). Borrar solo puede quien lo creó o un administrador.
- Las cuentas que ya existían no la tienen: actívala en **Usuarios** para cada persona.

## Mailings

- Solo lo ve quien tenga habilitada la parte **Mailings** (los administradores la tienen siempre). Se activa por usuario en la pestaña **Usuarios**.
- Enviar: en **Mailings** se escribe el asunto y el contenido HTML, se sube el Excel o CSV de destinatarios (una columna de email y otra de nombre; la primera fila puede ser de encabezados) y se pulsa **Enviar**. Se envía desde `news@advantecnia.com` en lotes de 100.
- Variables en el HTML y en el asunto: `{{nombre}}`, `{{email}}` y `{{baja}}`. El pie con el enlace de baja se añade solo a cada correo.
- Antes de enviar a todos, usa **Enviar prueba** con tu propio email y revisa la vista previa.
- Bajas: el enlace `https://advantecnia.com/baja` pide confirmación y deja a la persona fuera de todos los envíos futuros. Las cabeceras de baja de un clic (Gmail y Outlook) funcionan igual.
- Límites: 5.000 destinatarios por envío y 400 KB de HTML. Los duplicados, las direcciones no válidas y las dadas de baja se excluyen y se cuentan al crear el envío.
- Si un envío se corta (se cierra la pestaña o falla la conexión), aparece en el historial como pendiente y se puede **reanudar** sin volver a enviar a quien ya recibió el correo.

## Actualización de datos

- Automática: todos los días a las 06:00 UTC (07:00 en invierno y 08:00 en verano, hora de Madrid). Recalcula hoy, ayer y anteayer.
- Manual: botón **Actualizar ahora** del panel.
- El contador de personas en la web ahora se lee en directo cada 2 minutos.
- Recalcular todo el histórico: `curl -X POST -H "x-dash-key: TU_CONTRASEÑA" "https://advantecnia.com/api/refresh?days=90"`

## Etiquetas (eventos)

Automáticas (assets/at.js):

| Evento | Cuándo | Datos |
| --- | --- | --- |
| session_start | Primera visita o tras 30 min sin actividad | origen, UTM, gclid/fbclid/li_fat_id, pantalla, idioma del navegador |
| page_view | Cada cambio de página interna | página, proyecto (fichas), pestaña legal |
| engage | Al salir de una página o cerrar la pestaña | tiempo activo en ms (solo con la pestaña visible) |
| scroll | Al pasar 25, 50, 75 y 100 % | profundidad |
| section_view | Cuando un titular (h1/h2) o el formulario entra en pantalla | texto del titular |
| click | Cualquier botón o enlace | texto o data-track, sección |
| tel_click / mail_click / whatsapp_click | Enlaces tel:, mailto: y wa.me | destino |
| outbound / download | Enlaces a otros dominios / archivos | dominio, archivo |
| form_start | Primer campo tocado de un formulario | formulario |
| rage_click | 3 clics seguidos en el mismo elemento | elemento |
| js_error | Errores JavaScript (máx. 5 por página) | mensaje |
| vitals | Al salir | LCP, INP, CLS, TTFB |

Desde la web (index.html, `this.trk(...)`):

| Evento | Cuándo |
| --- | --- |
| form_submit / form_error | Envío del formulario «Hablar con un asesor experto» (éxito, validación o fallo) |
| wa_open / wa_close | Burbuja de WhatsApp (auto al hacer scroll o manual) |
| solution_view | Pestaña SmartRoom / SmartSense / SmartFlow / SmartCore |
| eco_open | Ficha del ecosistema (Connect.IA + Servidor MQTT, NurIA, AdvantCare, AdvantSense) |
| project_open / projects_tab | Ficha de proyecto y pestaña España / Internacional |
| lang_change | Cambio ES / EN |

Conversiones del panel: form_submit + whatsapp_click + tel_click + mail_click.

Para etiquetar un botón nuevo con un nombre fijo en ambos idiomas, añade `data-track="Nombre"`.

## Privacidad

No usa cookies. No guarda IP: cada visitante se identifica con un hash de IP + navegador + día + sal que cambia cada día. Usa `sessionStorage` para agrupar la sesión. Los datos se borran a los 400 días. Revisa con vuestro asesor legal si la Política de Cookies debe mencionarlo.

## Probar el panel sin datos

`/dashboard?demo=1` muestra el panel con datos ficticios.
