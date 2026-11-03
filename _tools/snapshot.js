// Renderiza la app DC y guarda el HTML de Soluciones/Empresa y los datos de proyectos, en ES y EN.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8765/_app_full.html';
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function transform(opts) {
  const m = document.querySelector('main').cloneNode(true);
  m.querySelectorAll('[data-rise],[data-stagger]').forEach(e => { e.removeAttribute('data-rise'); e.removeAttribute('data-stagger'); });
  const abs = u => u && !/^(https?:|\/|data:|#|mailto:|tel:)/.test(u) ? '/' + u : u;
  m.querySelectorAll('img,video,source').forEach(e => { if (e.getAttribute('src')) e.setAttribute('src', abs(e.getAttribute('src'))); });
  m.querySelectorAll('[style*="url("]').forEach(e => e.setAttribute('style', e.getAttribute('style').replace(/url\((["']?)(?!\/|https?:|data:)/g, 'url($1/')));
  m.querySelectorAll('video').forEach(v => { v.setAttribute('autoplay', ''); v.setAttribute('muted', ''); v.setAttribute('loop', ''); v.setAttribute('playsinline', ''); v.setAttribute('preload', 'metadata'); });
  // Secciones de familia: ancla por nombre
  const famIds = { 'SmartRoom': 'smartroom', 'SmartSense': 'smartsense', 'SmartFlow': 'smartflow', 'SmartCore': 'smartcore' };
  // Botones -> enlaces
  m.querySelectorAll('button,[role="link"],[role="button"]').forEach(btn => {
    const t = btn.innerText.replace(/\s+/g, ' ').trim();
    let href = opts.cta;
    if (famIds[t]) href = '#' + famIds[t];
    const a = document.createElement('a');
    a.innerHTML = btn.innerHTML;
    let st = btn.getAttribute('style') || '';
    if (!/display\s*:/.test(st)) st += ';display:inline-flex;align-items:center';
    if (!/color\s*:/.test(st)) st += ';color:inherit';
    st += ';text-decoration:none';
    a.setAttribute('style', st);
    a.setAttribute('href', href);
    if (href === opts.cta) a.setAttribute('data-track', 'CTA: ' + t.slice(0, 40));
    btn.replaceWith(a);
  });
  // ids de familia en las secciones de Soluciones
  [...m.querySelectorAll('section')].forEach(sec => {
    const txt = sec.innerText || '';
    for (const [name, id] of Object.entries(famIds)) {
      const lab = sec.querySelector('p,span');
      if (!m.querySelector('#' + id) && sec.querySelector('h2') && new RegExp('\\b' + name + '\\b').test(txt.slice(0, 400)) && !/Una inteligencia, cuatro familias/.test(txt.slice(0, 200))) { sec.id = id; break; }
    }
  });
  return m.innerHTML;
}

(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const out = {};
  for (const lang of ['es', 'en']) {
    const q = lang === 'en' ? '&lang=en' : '';
    const cta = lang === 'en' ? '/?lang=en#auditoria' : '/#auditoria';
    out[lang] = {};
    for (const pg of ['soluciones', 'empresa']) {
      await p.goto(`${BASE}?p=${pg}${q}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      out[lang][pg] = { html: await p.evaluate(transform, { cta }), h1: await p.evaluate(() => document.querySelector('main h1').innerText) };
    }
    // Proyectos: datos de tarjetas en las dos pestañas
    const projects = [];
    for (const tab of ['es', 'int']) {
      await p.goto(`${BASE}?p=proyectos${q}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
      if (tab === 'int') { await p.locator('main button').nth(1).click(); await p.waitForTimeout(500); }
      const cards = await p.evaluate(() => [...document.querySelectorAll('main button')].filter(b => b.querySelector('h3')).map(b => {
        const ps = [...b.querySelectorAll('p')].map(x => x.innerText.trim());
        const bg = b.querySelector('[role="img"]');
        const url = bg ? (bg.getAttribute('style').match(/url\(["']?([^"')]+)/) || [])[1] : '';
        return { nombre: b.querySelector('h3').innerText.trim(), lugar: ps[0] || '', desc: ps[1] || '', sist: [...b.querySelectorAll('li')].map(l => l.innerText.trim()), img: url, alt: bg ? bg.getAttribute('aria-label') : '' };
      }));
      cards.forEach(c => { c.region = tab; projects.push(c); });
    }
    out[lang].proyectos = { cards: projects, h1: await p.evaluate(() => document.querySelector('main h1').innerText), sub: await p.evaluate(() => { const h = document.querySelector('main h1'); const n = h.parentElement.querySelector('p'); return n ? n.innerText : ''; }) };
  }
  // slugs a partir del nombre en español (mismo orden en EN)
  out.es.proyectos.cards.forEach((c, i) => { c.slug = slug(c.nombre); if (out.en.proyectos.cards[i]) out.en.proyectos.cards[i].slug = c.slug; });
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log('soluciones', out.es.soluciones.html.length, 'empresa', out.es.empresa.html.length, 'proyectos', out.es.proyectos.cards.length, out.en.proyectos.cards.length);
  console.log(out.es.proyectos.cards.map(c => c.slug + (c.desc ? '' : '(sin desc)')).join(', '));
  console.log('ids', (out.es.soluciones.html.match(/id="smart\w+"/g) || []).join(' '));
  console.log('sub', out.es.proyectos.sub, '|', out.en.proyectos.h1);
  await b.close();
})();
