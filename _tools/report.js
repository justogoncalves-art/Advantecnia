const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak, TabStopType } = require('docx');
const fs = require('fs');
const OUT = process.argv[2];

const C = { navy: '1B2A4A', blue: '2563EB', green: '16A34A', amber: 'D97706', red: 'DC2626', orange: 'EA580C', gray: 'F8F9FA', border: 'E2E8F0', text: '1E293B', light: 'EFF6FF', lightBlue: '93C5FD', muted: '94A3B8', greenBg: 'F0FDF4' };
const W = 9360;
const scoreColor = s => s >= 8 ? C.green : s >= 5 ? C.amber : C.red;
const scoreStatus = s => s >= 8 ? 'Sólido' : s >= 5 ? 'En camino' : 'Necesita trabajo';
const b = { style: BorderStyle.SINGLE, size: 4, color: C.border };
const borders = { top: b, bottom: b, left: b, right: b };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

const run = (t, o = {}) => new TextRun({ text: t, font: 'Arial', size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color || C.text });
const para = (t, o = {}) => new Paragraph({ alignment: o.align, spacing: { before: o.before || 0, after: o.after ?? 120, line: o.line || 276 }, children: Array.isArray(t) ? t : [run(t, o)] });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 160 }, children: [new TextRun({ text: t, font: 'Arial', size: 48, bold: true, color: C.navy })] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun({ text: t, font: 'Arial', size: 36, bold: true, color: C.navy })] });
const h3 = t => new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: t, font: 'Arial', size: 28, bold: true, color: C.blue })] });

function cell(content, w, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map(c => typeof c === 'string'
    ? new Paragraph({ alignment: o.align, spacing: { after: 40 }, children: [run(c, { size: o.size || 20, bold: o.bold, color: o.color, italics: o.italics })] }) : c);
  return new TableCell({ width: { size: w, type: WidthType.DXA }, borders: o.noBorder ? noBorders : borders, verticalAlign: o.valign || VerticalAlign.TOP,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: o.mt || 90, bottom: o.mb || 90, left: 120, right: 120 }, children: paras });
}
function table(headers, rows, widths, o = {}) {
  const hr = new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { fill: C.navy, color: 'FFFFFF', bold: true })) });
  const rr = rows.map((r, ri) => new TableRow({ children: r.map((c, i) => {
    if (c && typeof c === 'object' && c.fill) return cell(c.text, widths[i], { fill: c.fill, color: 'FFFFFF', bold: true, align: AlignmentType.CENTER, valign: VerticalAlign.CENTER });
    return cell(c, widths[i], { fill: o.fill || (ri % 2 ? C.gray : undefined), bold: i === 0 && o.boldFirst });
  }) }));
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: [hr, ...rr] });
}
const ST = { ok: { text: 'Bien', fill: C.green }, warn: { text: 'Mejorable', fill: C.amber }, miss: { text: 'Falta', fill: C.red } };
const signals = rows => table(['Señal', 'Hallazgo', 'Estado'], rows.map(r => [r[0], r[1], ST[r[2]]]), [2200, 5760, 1400], { boldFirst: true });
function box(text) {
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [cell((Array.isArray(text) ? text : [text]).map(t => para(t, { after: 100 })), W, { fill: C.light, mt: 200, mb: 200 })] })] });
}

const SC = { SEO: [3, 8], GEO: [3, 8], AEO: [2, 8] };
const DATE = '2 de noviembre de 2026';

// ---------- Portada ----------
const coverCells = Object.entries(SC).map(([k, v]) => cell([
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run(k, { size: 20, bold: true, color: 'FFFFFF' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run(String(v[1]), { size: 72, bold: true, color: 'FFFFFF' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run(scoreStatus(v[1]), { size: 18, italics: true, color: 'FFFFFF' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`antes: ${v[0]}/10`, { size: 16, color: 'FFFFFF' })] }),
], (W - 480) / 3, { fill: scoreColor(v[1]), mt: 240, mb: 240, noBorder: true }));
const cp = (children, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: o.before || 0, after: o.after || 0 }, children });
const coverInner = [
  cp([run(' ')], { before: 2600 }),
  cp([run('advantecnia.com', { size: 72, bold: true, color: 'FFFFFF' })], { after: 160 }),
  cp([run('Informe de auditoría SEO / GEO / AEO', { size: 36, color: C.lightBlue })], { after: 120 }),
  cp([run('AUDITORÍA COMPLETA · ANTES Y DESPUÉS DE LA OPTIMIZACIÓN', { size: 22, color: 'FFFFFF' })], { after: 400 }),
  new Table({ width: { size: W - 480, type: WidthType.DXA }, columnWidths: [(W - 480) / 3, (W - 480) / 3, (W - 480) / 3], rows: [new TableRow({ children: coverCells.map(c => c) })] }),
  cp([run(' ')], { before: 2400 }),
  cp([run(DATE, { size: 18, color: C.muted })]),
  cp([run('Claude Skill and Plugin by Alex Labat', { size: 18, color: C.muted })]),
];
const cover = [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ height: { value: 12900, rule: 'exact' },
  children: [new TableCell({ width: { size: W, type: WidthType.DXA }, borders: noBorders, shading: { fill: C.navy, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 0, bottom: 0, left: 240, right: 240 }, children: coverInner })] })] })];

// ---------- Contenido ----------
const body = [];
body.push(h1('Resumen ejecutivo'));
body.push(box([
  'La web original de Advantecnia era una aplicación de una sola URL: Soluciones, Proyectos y Empresa solo existían al ejecutar JavaScript, sin títulos propios, sin datos estructurados, sin sitemap y con el blog alojado en un WordPress que va a desaparecer. Para Google eran páginas difíciles de posicionar y para los buscadores con IA (ChatGPT, Perplexity, Gemini, Claude), que no ejecutan JavaScript, prácticamente invisibles.',
  'Tras la optimización el sitio tiene 182 páginas indexables en HTML estático, en español e inglés, con title, description, canonical, Open Graph y datos estructurados en todas, 102 páginas con preguntas frecuentes marcadas con FAQPage, un llms.txt para modelos de lenguaje y 147 redirecciones 301 que conservan el posicionamiento del blog antiguo.',
  'La mayor oportunidad pendiente ya no es técnica sino de contenido: crear landings comerciales para las keywords de mayor intención (sistema de llamada paciente-enfermera, detector de caídas en residencias), sumar firmas con credenciales y casos con datos de resultado.',
]));
body.push(para('', { after: 120 }));
body.push(table(['Dimensión', 'Antes', 'Después', 'Estado', 'Conclusión'], [
  ['SEO', `${SC.SEO[0]}/10`, { text: `${SC.SEO[1]}/10`, fill: scoreColor(SC.SEO[1]) }, scoreStatus(SC.SEO[1]), '182 URLs indexables con metadatos completos, sitemap con hreflang e imágenes y redirecciones 301.'],
  ['GEO', `${SC.GEO[0]}/10`, { text: `${SC.GEO[1]}/10`, fill: scoreColor(SC.GEO[1]) }, scoreStatus(SC.GEO[1]), 'Contenido legible sin JavaScript, entidad de empresa con certificaciones, llms.txt y rastreadores de IA permitidos.'],
  ['AEO', `${SC.AEO[0]}/10`, { text: `${SC.AEO[1]}/10`, fill: scoreColor(SC.AEO[1]) }, scoreStatus(SC.AEO[1]), 'Respuestas directas de 40-70 palabras, FAQPage en 102 páginas y Speakable en los 145 artículos.'],
  ['Total', `${SC.SEO[0] + SC.GEO[0] + SC.AEO[0]}/30`, `${SC.SEO[1] + SC.GEO[1] + SC.AEO[1]}/30`, '', ''],
], [1300, 1000, 1200, 1500, 4360], { boldFirst: true }));
body.push(para('Las puntuaciones "Antes" corresponden a la web entregada (app de una sola página) más el blog en WordPress. Las de "Después", al sitio generado y rastreado completo en local antes de publicarlo.', { size: 18, italics: true, before: 120, color: '64748B' }));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(h1('Páginas auditadas'));
body.push(para('Se han rastreado las 182 páginas HTML del sitio generado (todas, sin muestreo), más robots.txt, sitemap.xml, llms.txt y vercel.json.'));
body.push(table(['URL', 'Tipo de página', 'Notas'], [
  ['/', 'Home (app interactiva)', 'Title de 59 caracteres, FAQ visible en el HTML de origen, Organization + FAQPage'],
  ['/soluciones · /en/soluciones', 'Soluciones', 'HTML estático, anclas por familia, ItemList de 6 productos, FAQPage, guías del blog enlazadas'],
  ['/proyectos · /en/proyectos', 'Casos de éxito', '24 centros (10 en España con ficha, 14 internacionales), ItemList de MedicalOrganization'],
  ['/proyectos/<centro> (×20)', 'Ficha de proyecto', 'Descripción, ubicación y sistemas instalados; solo centros con datos reales'],
  ['/empresa · /en/empresa', 'Quiénes somos', 'AboutPage + Organization con ISO 9001:2015, UL E480716 y marcado CE'],
  ['/preguntas-frecuentes · /en/faq', 'FAQ', '10 preguntas con respuesta directa, FAQPage'],
  ['/blog · /en/blog', 'Índices del blog', 'Blog schema, buscador, filtros enlazados a páginas de categoría'],
  ['/blog/categoria/… (×6)', 'Categorías', 'CollectionPage con ItemList, rastreables'],
  ['/blog/<post> (×145)', 'Artículos', 'BlogPosting + Speakable + BreadcrumbList; FAQPage en 97; og:image JPG 1200×630'],
], [3000, 2100, 4260]));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(h1('Análisis SEO'));
body.push(para(`Puntuación: ${SC.SEO[1]}/10 (antes ${SC.SEO[0]}/10)`, { bold: true, color: scoreColor(SC.SEO[1]) }));
body.push(h2('SEO técnico on-page'));
body.push(signals([
  ['Title', 'Único en las 182 páginas, ninguno por encima de 65 caracteres. Antes la home usaba "Advantecnia - Impulsado por Connect.IA" para todo el sitio y los posts en inglés repetían el title en español de Yoast.', 'ok'],
  ['Meta description', '182 de 182 entre 70 y 160 caracteres. La home tenía 56 caracteres ("La inteligencia que lleva tu hospital al siguiente nivel").', 'ok'],
  ['Encabezados', 'Un único H1 por página (182/182). La home tenía dos H1 en el HTML de origen (el de la página legal); corregido.', 'ok'],
  ['URLs', 'Limpias y descriptivas: /soluciones, /proyectos/hospital-de-salamanca, /blog/que-es-la-din-vde-0834. Antes no existían URLs para las secciones.', 'ok'],
  ['Canonical y hreflang', 'Canonical en todas las páginas; hreflang es/en/x-default en home, secciones, fichas, categorías e índices. Los posts no tienen pareja ES/EN porque WordPress no exponía la relación.', 'warn'],
  ['Robots e indexación', 'index,follow con max-image-preview:large. robots.txt apunta al sitemap y excluye /dashboard y /api.', 'ok'],
  ['Imágenes', '1.807 imágenes, todas con alt (16 vacías corregidas con el encabezado anterior). Convertidas a WebP: de 63 MB a 26 MB. Muchas destacadas llevan texto incrustado.', 'warn'],
  ['Enlazado interno', 'Menú y pie con enlaces reales (antes eran botones), migas de pan, categorías, artículos relacionados y caja de solución relacionada en cada post. 0 enlaces internos rotos.', 'ok'],
  ['Open Graph / Twitter', 'og:image en las 182 páginas; 145 imágenes JPG 1200×630 generadas para los posts (WebP no lo leen todas las redes).', 'ok'],
  ['Migración', '147 redirecciones 301 desde las URLs de WordPress y 6 desde los parámetros antiguos de la app (?p=soluciones…).', 'ok'],
]));
body.push(h2('Calidad del contenido'));
body.push(signals([
  ['Extensión', 'Media de 1.455 palabras por página. Los artículos superan las 500 palabras; las fichas de proyecto son cortas (60-120 palabras de descripción).', 'warn'],
  ['Frescura', 'Fecha de publicación visible y "Actualizado el" cuando el post se modificó más de 30 días después; dateModified en el schema.', 'ok'],
  ['Legibilidad', 'Índice de contenidos, párrafos cortos, listas y tablas con estilo; 18 px y 70 caracteres por línea.', 'ok'],
  ['Canibalización', '8 grupos de artículos compiten por la misma búsqueda (baños accesibles, gestión de turnos, PROFIBUS…). Detallados en SEO_keywords_advantecnia.xlsx.', 'warn'],
  ['Landings comerciales', 'No hay página específica para "sistema de llamada paciente-enfermera" ni "detector de caídas residencias"; hoy posicionan con artículos informativos.', 'miss'],
]));
body.push(h2('Datos estructurados'));
body.push(signals([
  ['Cobertura', '0 errores de sintaxis en 466 bloques JSON-LD: Organization, WebSite, WebPage, AboutPage, CollectionPage, Blog, BlogPosting, FAQPage y BreadcrumbList.', 'ok'],
  ['Producto', 'SmartRoom, SmartSense, SmartFlow y SmartCore como Product y Connect.IA y NurIA como SoftwareApplication, con brand y manufacturer enlazados a la entidad.', 'ok'],
  ['Proyectos', 'Cada centro como MedicalOrganization con localidad y los sistemas instalados como Product mencionados.', 'ok'],
  ['Pendiente', 'Sin Review/AggregateRating (no hay reseñas publicadas) ni HowTo en las guías paso a paso.', 'warn'],
]));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(h1('Análisis GEO'));
body.push(para(`Puntuación: ${SC.GEO[1]}/10 (antes ${SC.GEO[0]}/10)`, { bold: true, color: scoreColor(SC.GEO[1]) }));
body.push(h2('E-E-A-T'));
body.push(signals([
  ['Entidad de empresa', 'Organization con @id único, dirección de Alcorcón, teléfono, email, matriz ACE Business Group (NIF), áreas de servicio, knowsAbout y LinkedIn en sameAs.', 'ok'],
  ['Certificaciones', 'ISO 9001:2015, UL Hospital Signaling and Nurse Call Equipment (E480716) y marcado CE declaradas en la página Empresa, la FAQ y el schema.', 'ok'],
  ['Pruebas sociales', '24 centros con nombre propio (Gregorio Marañón, Isabel Zendal, Salamanca, Cedimat, Wolfson…). Las fichas originales tenían textos sin rellenar ("[dato a validar]") y no se han publicado.', 'warn'],
  ['Autores', 'Albert Neira, Anthony Mayorca y Redacción Advantecnia firman los posts, pero sin biografía, cargo ni credenciales.', 'miss'],
  ['Contacto', 'Teléfono, email y dirección accesibles en pie, FAQ, llms.txt y schema.', 'ok'],
]));
body.push(h2('Contenido para síntesis por IA'));
body.push(signals([
  ['Afirmación central', 'Cada página abre con su propuesta en una frase y la FAQ define la empresa, Connect.IA y NurIA en formato "X es…".', 'ok'],
  ['Densidad de datos', 'Cifras citables: +400 hospitales, +30.000 habitaciones, +20 años, +10 M usuarios/año, +200 interfaces de integración.', 'ok'],
  ['Fuentes externas', 'Los artículos citan normativa (DIN VDE 0834, CTE, IEC 60601) pero rara vez enlazan a fuentes oficiales.', 'warn'],
  ['Datos propios', 'Sin resultados medidos en casos (tiempos de respuesta, incidentes evitados). Es lo que más citan los motores de IA.', 'miss'],
  ['llms.txt', 'llms.txt (índice curado) y llms-full.txt (43 KB con FAQ, soluciones, proyectos y los 145 artículos resumidos).', 'ok'],
]));
body.push(h2('GEO técnico'));
body.push(signals([
  ['Renderizado', 'Soluciones, Proyectos, Empresa, FAQ y blog son HTML estático. La home sigue siendo una app JS, aunque su texto y su FAQ están en el HTML de origen.', 'ok'],
  ['Rastreadores de IA', 'robots.txt permite de forma explícita a GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended y otros.', 'ok'],
  ['HTTPS y cabeceras', 'HSTS, X-Content-Type-Options y Referrer-Policy en vercel.json.', 'ok'],
  ['Menciones externas', 'No evaluable desde el código: perfil de enlaces, menciones en prensa y Wikipedia/Wikidata. Revisar con Ahrefs o Semrush.', 'warn'],
]));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(h1('Análisis AEO'));
body.push(para(`Puntuación: ${SC.AEO[1]}/10 (antes ${SC.AEO[0]}/10)`, { bold: true, color: scoreColor(SC.AEO[1]) }));
body.push(h2('Elegibilidad para fragmentos destacados'));
body.push(signals([
  ['Respuestas directas', '10 preguntas con respuesta de 40-70 palabras en /preguntas-frecuentes, 6 en la home y 5 en Soluciones.', 'ok'],
  ['Definiciones', 'Patrón "X es…" en la FAQ y en muchos artículos ("¿Qué es la DIN VDE 0834?", "¿Qué es la comunicación asistencial?").', 'ok'],
  ['Listas y tablas', 'Listas numeradas y con viñetas en la mayoría de posts; 8 tablas comparativas conservadas y estilizadas.', 'ok'],
]));
body.push(h2('Formatos de respuesta estructurada'));
body.push(signals([
  ['FAQPage', '102 páginas: home, Soluciones, FAQ (ES y EN) y 97 artículos cuyas preguntas salen de sus encabezados en forma de pregunta, con la respuesta tomada del texto que los sigue.', 'ok'],
  ['Encabezados en pregunta', 'Presentes en 97 artículos. 48 artículos no tienen ninguno y se beneficiarían de reescribir 2-3 H2 en forma de pregunta.', 'warn'],
  ['Speakable', 'SpeakableSpecification (H1 y entradilla) en los 145 artículos.', 'ok'],
  ['HowTo', 'No implementado: las guías de normativa e instalación podrían marcarse como pasos.', 'miss'],
]));
body.push(h2('Búsqueda por voz'));
body.push(signals([
  ['Lenguaje conversacional', 'Preguntas redactadas como las haría un director de hospital ("¿Por dónde empiezo?", "¿Se integra con lo que ya tengo?").', 'ok'],
  ['Preguntas long-tail', 'Cubiertas en el blog (baños accesibles, residencias, PoE, turnos) y en la FAQ.', 'ok'],
  ['Señales locales', 'NAP completo (Alcorcón, Madrid) en schema y pie. Falta un perfil de Google Business verificado enlazado desde la web.', 'warn'],
]));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(h1('Recomendaciones prioritarias'));
body.push(para('Lo que queda por hacer después de esta optimización, ordenado por impacto.'));
const PR = { c: { text: 'Crítica', fill: C.red }, h: { text: 'Alta', fill: C.orange }, m: { text: 'Media', fill: C.amber }, q: { text: 'Victoria rápida', fill: C.green } };
body.push(table(['Prioridad', 'Acción', 'Dimensión', 'Esfuerzo', 'Impacto'], [
  [PR.h, 'Crear landings comerciales: sistema de llamada paciente-enfermera, llamador para residencias y detector de caídas sin cámaras.', 'SEO', 'Medio', 'Alto'],
  [PR.h, 'Publicar resultados medidos en 3-5 casos (tiempos de respuesta, incidentes evitados, habitaciones) y rellenar las fichas que quedaron sin datos.', 'GEO', 'Medio', 'Alto'],
  [PR.h, 'Añadir biografía, cargo y LinkedIn de cada autor, y una página de autor con Person schema.', 'GEO', 'Bajo', 'Alto'],
  [PR.m, 'Resolver las 8 canibalizaciones: fusionar posts duplicados y redirigir con 301.', 'SEO', 'Medio', 'Medio'],
  [PR.m, 'Reescribir 2-3 H2 en forma de pregunta en los 48 posts que no tienen ninguno, con respuesta en el primer párrafo.', 'AEO', 'Medio', 'Medio'],
  [PR.m, 'Emparejar los posts ES/EN y añadir hreflang por artículo.', 'SEO', 'Bajo', 'Medio'],
  [PR.m, 'Marcar como HowTo las guías de normativa e instalación y enlazar a las fuentes oficiales (DIN, CTE, IEC).', 'AEO', 'Medio', 'Medio'],
  [PR.q, 'Enviar sitemap.xml en Google Search Console y Bing Webmaster Tools y vigilar las 301 durante 4 semanas.', 'SEO', 'Bajo', 'Alto'],
  [PR.q, 'Comprimir el vídeo de la home (10,6 MB) y medir Core Web Vitals en pagespeed.web.dev tras publicar.', 'SEO', 'Bajo', 'Medio'],
  [PR.q, 'Crear o reclamar la ficha de Google Business y la entrada de Wikidata de Advantecnia, y añadirlas a sameAs.', 'GEO', 'Bajo', 'Medio'],
], [1400, 4160, 1400, 1100, 1300]));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(h1('Cambios aplicados'));
body.push(table(['Área', 'Qué se ha hecho'], [
  ['Arquitectura', 'Soluciones, Proyectos (con 20 fichas), Empresa y FAQ convertidas en páginas HTML estáticas con URL propia, en español e inglés. La home enlaza a ellas con <a href> reales.'],
  ['Blog', '145 artículos, 6 páginas de categoría, índice de contenidos, FAQ automática, solución relacionada, fecha de actualización y og:image JPG.'],
  ['Metadatos', 'Title y description revisados en las 182 páginas, sin duplicados ni excesos de longitud. Canonical, Open Graph y hreflang.'],
  ['Datos estructurados', 'Organization (con certificaciones), WebSite, WebPage, AboutPage, CollectionPage, Blog, BlogPosting, Speakable, FAQPage, Product, SoftwareApplication, MedicalOrganization y BreadcrumbList.'],
  ['IA (GEO)', 'llms.txt y llms-full.txt, robots.txt que permite a 17 rastreadores, enlace al llms.txt desde la home.'],
  ['Rastreo', 'sitemap.xml con 182 URLs, alternativas hreflang e imágenes; 153 redirecciones 301; 0 enlaces internos rotos.'],
  ['Rendimiento', 'Imágenes del blog a WebP (63 MB a 26 MB), carga diferida, preload de la imagen principal y caché inmutable para /blog/img.'],
], [2000, 7360], { boldFirst: true }));

body.push(h1('Lo que funciona bien'));
body.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [2600, 6760], rows: [
  ['Propuesta clara', '"La inteligencia que lleva tu hospital al siguiente nivel" y "Cuidar sin vigilar" son mensajes diferenciales y fáciles de citar.'],
  ['Pruebas reales', 'Nombres de hospitales de referencia (Gregorio Marañón, Isabel Zendal, Salamanca) y cifras concretas de despliegue.'],
  ['Fondo temático', '145 artículos que cubren casi todo el universo de la comunicación asistencial: una base de autoridad temática poco común en el sector.'],
  ['Certificaciones', 'ISO 9001:2015 y UL E480716 son señales de confianza fuertes para compradores públicos y motores de IA.'],
  ['Bilingüe', 'Contenido en español e inglés para licitaciones en LATAM, Oriente Medio e Israel.'],
].map(([a, c]) => new TableRow({ children: [cell(a, 2600, { fill: C.greenBg, bold: true }), cell(c, 6760, { fill: C.greenBg })] })) }));

body.push(h1('Glosario'));
body.push(table(['Término', 'Qué significa'], [
  ['SEO', 'Search Engine Optimization: optimizar la web para aparecer en los resultados de Google y Bing.'],
  ['GEO', 'Generative Engine Optimization: conseguir que ChatGPT, Perplexity, Gemini o Google AI Overviews entiendan la web y la citen como fuente.'],
  ['AEO', 'Answer Engine Optimization: estructurar el contenido para responder directamente preguntas en fragmentos destacados y búsquedas por voz.'],
  ['Schema / JSON-LD', 'Código invisible que describe a los buscadores qué es cada página: empresa, producto, artículo, preguntas frecuentes.'],
  ['llms.txt', 'Archivo de texto en la raíz de la web que resume para los modelos de lenguaje quién es la empresa y cuáles son sus páginas clave.'],
  ['Canibalización', 'Cuando varias páginas del mismo sitio compiten por la misma búsqueda y se restan posiciones entre sí.'],
], [2200, 7160], { boldFirst: true }));

const header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: W }], border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.navy, space: 4 } },
  children: [run('advantecnia.com', { size: 18, bold: true, color: C.navy }), run('\tInforme de auditoría SEO / GEO / AEO', { size: 18, color: '64748B' })] })] });
const footer = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: W }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
  children: [run('Claude Skill and Plugin by Alex Labat', { size: 18, color: '64748B' }), new TextRun({ children: ['\t', PageNumber.CURRENT], font: 'Arial', size: 18, color: '64748B' })] })] });
const page = { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } };
const doc = new Document({
  styles: { default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 48, bold: true, font: 'Arial', color: C.navy }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
                      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, font: 'Arial', color: C.navy }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } }] },
  sections: [{ properties: { page }, children: cover }, { properties: { page }, headers: { default: header }, footers: { default: footer }, children: body }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('DOCX written'); });
