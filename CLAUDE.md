# CLAUDE.md · Advantecnia Web

Contexto para Claude Code al trabajar en este repositorio.

## Qué es
Web corporativa de Advantecnia (sistemas hospitalarios, ecosistema SmartHospital impulsado por Connect.IA) desplegada en Vercel como sitio estático + funciones Node en /api. Sin build, sin dependencias npm.

## Cómo está hecha
- `index.html` y `dashboard.dc.html` son "Design Components": plantilla HTML con huecos `{{ ruta }}` dentro de `<x-dc>` y una clase `class Component extends DCLogic` en `<script type="text/x-dc" data-dc-script>`. `support.js` los renderiza (React por debajo). No editar `support.js`.
- Plantilla: solo estilos inline, `<sc-if value="{{ x }}">`, `<sc-for list="{{ xs }}" as="x">`. Los huecos solo admiten rutas, nunca expresiones; todo cálculo va en `renderVals()`.
- Idiomas: el texto en la plantilla está en español; `Component.DICT` traduce al inglés por coincidencia exacta de texto. Al cambiar un texto en español, actualiza su clave en DICT.
- La app solo pinta la home y las páginas legales; `go()` envía Soluciones, Proyectos y Empresa a sus páginas estáticas (`Component.STATIC_URL`).

## Marca y estilo de la web
Blog estático en `blog/` y `en/blog/` (ver README). Manrope; navy #16374D; teal #0E8C99 (acción); texto secundario #55636E; bordes #E3E9EA / #CBD9DE. Logo `assets/adv-logo-color.svg` (fondo claro) y `assets/adv-logo-reverse.svg` (fondo azul de la home). Productos: Connect.IA + Servidor MQTT, NurIA, SmartRoom, SmartSense (SmartBlanket, SmartEye), SmartFlow, SmartCore, AdvantCare.
Copy: tú en marketing, nosotros como empresa, sin guiones largos, sin exclamaciones salvo la burbuja de WhatsApp.

## Contacto
Teléfono web: +34 637 49 57 57. WhatsApp: +34 607 55 27 33. Formulario vía formsubmit.co a info@advantecnia.com.

## Analítica
Ver README.md (tabla de eventos, variables de entorno, cron). Para añadir un evento: `this.trk('nombre', { ... })` en index.html, luego agrégalo en `aggregate()` de `api/_lib.js` y, si debe verse, en `tableList()` de `dashboard.dc.html`.

## Pendientes conocidos
- Vídeo de la home 10,6 MB, comprimir a 3–4 MB.
- Confirmar el formulario desde info@advantecnia.com (primer envío de formsubmit).
- og:image apunta a https://advantecnia.com; cambiar si el dominio es otro.
- Soluciones, Proyectos, Empresa y FAQ son páginas estáticas (ver README, sección SEO, GEO y AEO). Pendiente: landings comerciales, bios de autores y datos de resultados en las fichas de proyecto (ver informes/).
