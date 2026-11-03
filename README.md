# Advantecnia Web

Web corporativa de Advantecnia con medición propia sin cookies y un panel de analítica en `/dashboard`.

## Estructura

```
index.html            Web (una sola página con navegación interna)
dashboard.dc.html     Panel de analítica (se sirve en /dashboard)
support.js            Motor que pinta index.html y dashboard.dc.html
assets/at.js          Etiquetado: envía los eventos a /api/track
api/track.js          Recibe eventos y los guarda en Redis
api/refresh.js        Recalcula los totales por día (cron diario y botón manual)
api/stats.js          Devuelve los datos al panel
api/_lib.js           Funciones comunes (no es un endpoint)
vercel.json           Rutas, cron diario y cabeceras
robots.txt            Excluye /dashboard y /api de buscadores
```

## Publicar en Vercel

1. Sube el contenido de esta carpeta a la raíz del repositorio de GitHub.
2. En Vercel: **Add New → Project**, importa el repositorio. Framework: **Other**. Sin comando de build. Output: `/`.
3. Base de datos: en el proyecto de Vercel, **Storage → Create → Upstash (Redis)**, plan gratuito, y conéctala al proyecto. Vercel añade solo `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. **Settings → Environment Variables**, añade:
   - `DASHBOARD_PASSWORD`: contraseña para entrar en /dashboard.
   - `CRON_SECRET`: cualquier texto largo aleatorio. Vercel lo usa para autorizar el cron.
   - `ANALYTICS_SALT`: otro texto aleatorio (anonimiza a los visitantes).
   - `ALLOWED_ORIGINS` (opcional): `https://advantecnia.com,https://www.advantecnia.com` si la web y la API están en dominios distintos.
5. **Redeploy** para que tome las variables.
6. Dominio: **Settings → Domains**, añade `advantecnia.com`. El panel queda en `https://advantecnia.com/dashboard`.

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

## Blog

Blog estático generado a partir de la copia del WordPress antiguo (145 posts: 73 en español y 72 en inglés).

```
blog/index.html          Listado en español (búsqueda, filtros por categoría, "cargar más")
blog/<slug>/index.html   Cada post en español
en/blog/...              Lo mismo en inglés
blog/blog.css, blog.js   Estilos e interacción comunes
blog/img/<slug>/         Imágenes en WebP (destacada a 1600 y 720 px, contenido a 1200 px)
blog/latest.json         Los 3 últimos posts por idioma (los usa la home)
sitemap.xml              Home, índices y los 145 posts
```

- URLs nuevas: `/blog/<slug>` y `/en/blog/<slug>`. Las URLs antiguas de WordPress (`/<slug>/`, `/en/<slug>/`, `/contacto/`) redirigen con 301 desde `vercel.json`.
- Cada post lleva title y descripción de Yoast, canonical, Open Graph, schema BlogPosting + BreadcrumbList, índice de contenidos, compartir y artículos relacionados.
- La home acepta enlaces directos: `/?lang=en`, `/?p=soluciones|proyectos|empresa`, `/?p=legal&t=aviso|priv|cook`, `/#auditoria`, `/#blog`.
- Regenerar (por ejemplo, tras corregir un post en `posts.json`): `python3 _tools/build_blog.py <carpeta con posts.json, raw/ e imagenes/> .` y volver a copiar las redirecciones de `blog/redirects.json` a `vercel.json`. `_tools` no se publica (ver `.vercelignore`).

## Publicación del blog por fases

Esta versión publica 50 de los 145 artículos: los 43 más recientes en español más los 7 anteriores sobre llamada paciente-enfermera y comunicación asistencial. La lista está en `_tools/seleccion_50.txt`.

- El blog en inglés no se publica todavía: el enlace "Blog" de las páginas en inglés lleva a `/blog`.
- Los enlaces dentro de los artículos que apuntaban a posts no publicados se han quitado (queda el texto).
- Las URLs antiguas de los posts no publicados redirigen temporalmente (302) a `/blog`, para poder cambiarlas al publicarlos.
- Para publicar más: añade slugs a `_tools/seleccion_50.txt` (o crea otra lista) y reconstruye con
  `BLOG_SELECTION=_tools/seleccion_50.txt python3 _tools/build_pages.py <carpeta con posts.json, raw/ e imagenes/> . _tools/snapshots.json`.
  Sin `BLOG_SELECTION` se publican los 145 en español e inglés. Después, actualiza `Component.BLOG` en index.html con `blog/latest.json`.

## SEO, GEO y AEO

Las secciones de la web ya no dependen de JavaScript: se sirven como HTML estático con URL propia.

```
soluciones/, en/soluciones/          Soluciones (anclas #smartroom, #smartsense, #smartflow, #smartcore)
proyectos/, en/proyectos/            Proyectos + una ficha por centro con datos reales
empresa/, en/empresa/                Quiénes somos
preguntas-frecuentes/, en/faq/       FAQ (FAQPage)
blog/categoria/, en/blog/category/   Categorías del blog
assets/dc.css                        Estilos base de la web principal, extraídos de index.html
llms.txt, llms-full.txt              Resumen del sitio para modelos de lenguaje (GEO)
sitemap.xml                          182 URLs con hreflang e imágenes
robots.txt                           Permite buscadores y rastreadores de IA
informes/                            Auditoría SEO/GEO/AEO en Word y PDF
```

- `index.html` (la app) mantiene la home y las páginas legales. Sus enlaces a Soluciones, Proyectos y Empresa son `<a href>` reales y `/?p=soluciones` redirige (301 en Vercel y también en el navegador) a la página estática.
- Las páginas de Soluciones y Empresa se generan a partir del render de la app original (`_tools/app_full.html` → `_tools/snapshots.json`, con `snapshot.js`). Si cambias su contenido, edítalo en `_tools/app_full.html`, vuelve a generar el snapshot y reconstruye.
- Reconstruir todo (blog + páginas + sitemap + llms.txt + redirecciones):
  `python3 _tools/build_pages.py <carpeta con posts.json, raw/ e imagenes/> . _tools/snapshots.json`
- Las preguntas frecuentes están en `_tools/build_pages.py` (FAQ) y se copian a `_tools/faq.json`; la home las toma de ahí con `_tools/patch_home_seo.py` (ya aplicado, no volver a ejecutar sobre el mismo index.html).
- Auditoría: `python3 _tools/audit.py . salida.json` revisa titles, descriptions, H1, canonical, alt y schema de todas las páginas.

`SEO_keywords_advantecnia.xlsx`: keywords por cluster con intención, prioridad y página destino, canibalizaciones y plan de acciones.
