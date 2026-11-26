# CLAUDE.md · Advantecnia Web

Contexto para Claude Code al trabajar en este repositorio.

## Qué es
Web corporativa de Advantecnia (sistemas hospitalarios, ecosistema SmartHospital impulsado por Connect.IA) desplegada en Vercel como sitio estático + funciones Node en /api. Sin build. Única dependencia npm: `@vercel/blob` (almacén de presentaciones). El cliente del navegador está ya empaquetado en `assets/vendor/blob-client-2.9.0.js`; si cambias la versión, vuelve a generarlo y renombra el archivo.

## Cómo está hecha
- `index.html` y `dashboard.dc.html` son "Design Components": plantilla HTML con huecos `{{ ruta }}` dentro de `<x-dc>` y una clase `class Component extends DCLogic` en `<script type="text/x-dc" data-dc-script>`. `support.js` los renderiza (React por debajo). No editar `support.js`.
- Plantilla: solo estilos inline, `<sc-if value="{{ x }}">`, `<sc-for list="{{ xs }}" as="x">`. Los huecos solo admiten rutas, nunca expresiones; todo cálculo va en `renderVals()`.
- Idiomas: el texto en la plantilla está en español; `Component.DICT` traduce al inglés por coincidencia exacta de texto. Al cambiar un texto en español, actualiza su clave en DICT.
- Navegación interna por estado (`this.go('soluciones')`), sin URLs por página.

## Marca y estilo de la web
Manrope; navy #16374D; teal #0E8C99 (acción); texto secundario #55636E; bordes #E3E9EA / #CBD9DE. Logo `assets/adv-logo-color.svg` (fondo claro) y `assets/adv-logo-reverse.svg` (fondo azul de la home). Productos: Connect.IA + Servidor MQTT, NurIA, SmartRoom, SmartSense (SmartBlanket, SmartEye), SmartFlow, SmartCore, AdvantCare.
Copy: tú en marketing, nosotros como empresa, sin guiones largos, sin exclamaciones salvo la burbuja de WhatsApp.

## Contacto
Teléfono web: +34 637 49 57 57. WhatsApp: +34 607 55 27 33. Formulario vía formsubmit.co a info@advantecnia.com.

## Analítica
Ver README.md (tabla de eventos, variables de entorno, cron). Para añadir un evento: `this.trk('nombre', { ... })` en index.html, luego agrégalo en `aggregate()` de `api/_lib.js` y, si debe verse, en `tableList()` de `dashboard.dc.html`.

## Acceso y presentaciones
- Sesiones: cookie `adv_sess` firmada con HMAC (`SESSION_SECRET`). Contraseñas con scrypt en Redis (`user:<email>`). Administradores: `ADMIN_EMAILS` o rol `admin`. La clave `DASHBOARD_PASSWORD` sigue valiendo como administración.
- `authed(req)` en `api/_lib.js` es asíncrono y devuelve `'cron'`, un objeto de usuario o `null`. Todos los endpoints protegidos hacen `await authed(req)`.
- Presentaciones: el navegador sube a Vercel Blob con `/api/blob-upload` (no pasa por la función) con `access: 'private'`: **el almacén es privado** y una subida pública falla. Después registra la subida en `/api/presentations`, que comprueba que la ruta sea de la carpeta del usuario. Formatos en `PRES_FORMATS` de `_lib.js` (y su copia `Component.PRES_TYPES` en el panel).
- Enlace público: `/p/<token>` → `api/view.js` (página; caduca según `expires`, AAAA-MM-DD, hora de Madrid). `/p/<token>/archivo` → redirige a una URL firmada (`issueSignedToken` + `presignUrl`, 2 h); si falla, entrega el archivo por la función con `get`. La página avisa de la apertura con `sendBeacon` a `POST /api/view?token=…&ev=open`, que descarta robots, escáneres de correo, recargas en 30 min y sesiones del panel.
- Redis: `pres:<token>`, `presby:<email>`, `presall`, `presblob:<pathname>` (enlaces que comparten archivo), `presopens:<token>` (contador), `presopen:<token>` (últimas 100 aperturas), `presseen:<token>:<hash>` (30 min).
- Límite de Vercel Hobby: 12 funciones por despliegue (cada archivo de `api/` sin `_` delante es una). Hay 11. `/api/login`, `/api/logout` y `/api/me` son una sola función, `api/session.js`, mediante reescrituras en `vercel.json`. Antes de añadir un endpoint, agrúpalo con otro si se supera el límite.
- Pruebas: no hay suite en el repositorio. Los endpoints de acceso se probaron con un Redis simulado y el panel en Chromium; no se ha probado contra Vercel real.

## Central de desarrollos (Inicio y Desarrollos)
- El panel (`/dashboard`) es la central de la empresa. Al entrar se abre **Inicio**: una tarjeta por cada parte habilitada (Desarrollos, Analítica, Presentaciones, Mailings, Usuarios y la web) con su cifra clave, y los desarrollos actualizados más recientemente. `loadHome()` carga lo necesario según los módulos del usuario.
- Módulo `desarrollos` (en `MODULES` de `_lib.js`). Endpoint `api/desarrollos.js`: GET lista todo, POST crea, PATCH edita (los campos que no llegan conservan su valor), DELETE `?id=` borra (quien lo creó o un administrador). Cualquiera con el módulo ve y edita todos.
- Campos: nombre (obligatorio), estado (`idea`, `desarrollo`, `pruebas`, `produccion`, `pausado`), área (`interno`, `producto`, `web`, `cliente`), responsable, enlace, repositorio, próximo paso y descripción. Los enlaces solo se aceptan http(s).
- Redis: `devs` (set de ids) y `dev:<id>` (JSON). Etiquetas y colores de los estados en `Component.DEV_STATUS` de `dashboard.dc.html`.
- Para añadir una herramienta nueva a la central: su módulo en `MODULES`, su pestaña en `extraVals()` y su tarjeta en `hubCards`.

## Mailings
- Módulo `mailings` (en `MODULES` de `_lib.js`). Endpoints: `api/mailings.js` (crear, enviar por lotes de 100 con `?action=send&id=`, prueba con `?action=test`, historial) y `api/unsubscribe.js` (ruta `/baja`).
- Envío con la API por lotes de Resend (`sendBatch` en `_lib.js`, requiere `RESEND_API_KEY`). `buildMail` personaliza `{{nombre}}`, `{{email}}`, `{{baja}}` y añade el pie y las cabeceras `List-Unsubscribe`.
- Redis: `camps` (set de ids), `camp:<id>` (datos), `camp:<id>:q` (cola de destinatarios), `camp:<id>:fail` (errores), `suppressed` (bajas, set de emails).
- Token de baja: HMAC del email con `SESSION_SECRET` (`unsubUrl`, `unsubOk`).
- Excel/CSV: se lee en el navegador con SheetJS (`assets/vendor/xlsx-0.18.5.js`, bundle de `xlsx` 0.18.5 generado con esbuild, como el de Blob). Parser `Component.parseRows` en `dashboard.dc.html`.

## Pendientes conocidos
- Presentaciones sin probar en Vercel real: subida privada a Blob, URL firmada (`issueSignedToken`/`presignUrl`) y que el visor de Office y el PDF en iframe sigan la redirección a esa URL. Probado con Redis y Blob simulados y el panel en Chromium.
- Mailings sin probar con Resend real: falta verificar el dominio advantecnia.com y `RESEND_API_KEY`; la prueba de envío real es el primer paso tras desplegar.
- Vídeo de la home 10,6 MB, comprimir a 3–4 MB.
- Confirmar el formulario desde info@advantecnia.com (primer envío de formsubmit).
- og:image apunta a https://advantecnia.com; cambiar si el dominio es otro.
