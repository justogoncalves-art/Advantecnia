/* Advantecnia · medición propia sin cookies. Envía eventos a /api/track. */
(function () {
  if (window.advTrack) return;
  var ON = window.ADV_TRACK_FORCE || /(^|\.)advantecnia\.com$|\.vercel\.app$/.test(location.hostname);
  var EP = '/api/track';
  var q = [], timer = null, page = 'home', engMs = 0, visT = document.hidden ? 0 : Date.now();
  var marks = {}, seen = {}, started = {}, errs = 0, last = { el: null, n: 0, t: 0 }, vitalsSent = false;
  var vit = { lcp: 0, cls: 0, inp: 0, ttfb: 0 };

  function rnd() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  var sid, isNew = false;
  try {
    sid = sessionStorage.getItem('adv_sid');
    var lt = +sessionStorage.getItem('adv_last') || 0;
    if (!sid || Date.now() - lt > 1800000) { sid = rnd(); isNew = true; sessionStorage.setItem('adv_sid', sid); }
  } catch (e) { sid = rnd(); isNew = true; }
  function touch() { try { sessionStorage.setItem('adv_last', String(Date.now())); } catch (e) {} }
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'es'; }
  function clean(s, n) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n || 70); }

  function push(n, p) {
    if (!ON) { if (window.ADV_TRACK_DEBUG) console.log('[advTrack]', n, p || {}); return; }
    q.push({ n: n, p: p || {}, pg: page, sid: sid, l: lang(), t: Date.now() });
    touch();
    if (q.length >= 12) flush(); else if (!timer) timer = setTimeout(flush, 2000);
  }
  function flush(beacon) {
    clearTimeout(timer); timer = null;
    while (q.length) {
      var body = JSON.stringify({ now: Date.now(), e: q.splice(0, 40) }), ok = false;
      if (beacon && navigator.sendBeacon) { try { ok = navigator.sendBeacon(EP, new Blob([body], { type: 'text/plain' })); } catch (e) {} }
      if (!ok) { try { fetch(EP, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {}); } catch (e) {} }
    }
  }

  function closePage() {
    var ms = visT ? engMs + (Date.now() - visT) : engMs;
    if (ms > 500) push('engage', { ms: Math.min(ms, 1800000) });
    engMs = 0; visT = document.hidden ? 0 : Date.now();
  }
  function sendVitals() {
    if (vitalsSent || !(vit.lcp || vit.ttfb)) return;
    vitalsSent = true;
    push('vitals', { lcp: Math.round(vit.lcp), cls: Math.round(vit.cls * 1000) / 1000, inp: Math.round(vit.inp), ttfb: Math.round(vit.ttfb) });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { closePage(); sendVitals(); flush(true); } else { visT = Date.now(); }
  });
  window.addEventListener('pagehide', function () { closePage(); sendVitals(); flush(true); });

  var firstPV = true;
  function pageView(p) {
    if (!firstPV) closePage();
    firstPV = false;
    page = clean(p.page || 'home', 30);
    marks = {}; seen = {}; started = {};
    push('page_view', p);
    setTimeout(observe, 700);
  }

  function sectionOf(el) {
    if (!el || !el.closest) return '';
    if (el.closest('#adv-wa')) return 'WhatsApp flotante';
    if (el.closest('#adv-sticky')) return 'Barra fija móvil';
    if (el.closest('#adv2-auditoria')) return 'Formulario de contacto';
    if (el.closest('header')) return 'Cabecera';
    if (el.closest('footer')) return 'Pie de página';
    var s = el.closest('section') || el.closest('[id^="adv"]');
    var h = s && s.querySelector('h1,h2');
    return h ? clean(h.textContent, 60) : '';
  }

  /* Scroll */
  var sT = 0;
  function onScroll() {
    if (Date.now() - sT < 250) return; sT = Date.now();
    var d = document.documentElement, h = Math.max(d.scrollHeight, document.body.scrollHeight) - innerHeight;
    if (h <= 0) return;
    var pc = (window.scrollY || d.scrollTop || 0) / h * 100;
    [25, 50, 75, 100].forEach(function (m) { if (pc >= m - 1 && !marks[m]) { marks[m] = 1; push('scroll', { d: m }); } });
  }
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });

  /* Secciones vistas */
  var io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target, lab = el.id === 'adv2-auditoria' ? 'Formulario de contacto' : clean(el.textContent, 60);
      if (lab && !seen[lab]) { seen[lab] = 1; push('section_view', { s: lab }); }
      io.unobserve(el);
    });
  }, { threshold: 0.5 }) : null;
  function observe() {
    if (!io) return;
    document.querySelectorAll('h1,h2,#adv2-auditoria').forEach(function (el) {
      if (el.closest('#adv2-auditoria') && el.id !== 'adv2-auditoria') return;
      if (!el.__advObs) { el.__advObs = 1; io.observe(el); }
    });
  }
  if (typeof MutationObserver !== 'undefined') {
    var mT = null;
    new MutationObserver(function () { clearTimeout(mT); mT = setTimeout(function () {
      document.querySelectorAll('h1,h2,#adv2-auditoria').forEach(function (el) { if (el.__advObs && !document.body.contains(el)) el.__advObs = 0; });
      observe();
    }, 400); }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* Clics */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-track],a,button,[role="button"]');
    if (!el) return;
    var label = clean(el.getAttribute('data-track') || el.getAttribute('aria-label') || el.textContent || el.getAttribute('title')) || '(sin texto)';
    var sec = sectionOf(el), now = Date.now();
    if (last.el === el && now - last.t < 700) { last.n++; if (last.n === 3) push('rage_click', { label: label, sec: sec }); } else { last = { el: el, n: 1, t: now }; }
    last.t = now;
    push('click', { label: label, sec: sec });
    var href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
    if (/^tel:/i.test(href)) push('tel_click', { to: href.slice(4) });
    else if (/^mailto:/i.test(href)) push('mail_click', { to: href.slice(7).split('?')[0] });
    else if (/wa\.me|whatsapp\.com/i.test(href)) { push('whatsapp_click', { label: label, sec: sec }); flush(true); }
    else if (/^https?:/i.test(href) && el.hostname && el.hostname !== location.hostname) { push('outbound', { host: el.hostname.replace(/^www\./, ''), url: href.slice(0, 140) }); flush(true); }
    if (/\.(pdf|zip|docx?|xlsx?|pptx?)($|\?)/i.test(href)) push('download', { file: href.split('/').pop().slice(0, 80) });
  }, true);

  /* Formularios */
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    var f = sectionOf(el) || 'Formulario';
    if (!started[f]) { started[f] = 1; push('form_start', { form: f }); }
  }, true);

  /* Errores */
  window.addEventListener('error', function (e) {
    if (errs++ >= 5 || !e.message) return;
    push('js_error', { m: clean(e.message, 140), src: clean((e.filename || '').split('/').pop() + ':' + (e.lineno || 0), 60) });
  });

  /* Rendimiento */
  try {
    new PerformanceObserver(function (l) { var es = l.getEntries(); if (es.length) vit.lcp = es[es.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (x) { if (!x.hadRecentInput) vit.cls += x.value; }); }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (x) { if (x.interactionId && x.duration > vit.inp) vit.inp = x.duration; }); }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
    var nav = performance.getEntriesByType('navigation')[0]; if (nav) vit.ttfb = nav.responseStart;
  } catch (e) {}

  /* API pública */
  window.advTrack = function (n, p) { if (n === 'page_view') pageView(p || {}); else push(n, p); };

  if (isNew) {
    var u = new URLSearchParams(location.search), ref = document.referrer, rh = '';
    try { rh = ref ? new URL(ref).hostname : ''; } catch (e) {}
    var sp = { ref: rh && rh !== location.hostname ? ref.slice(0, 200) : '', sw: screen.width, vw: innerWidth, bl: clean(navigator.language, 12) };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'li_fat_id'].forEach(function (k) { var v = u.get(k); if (v) sp[k] = clean(v, 80); });
    push('session_start', sp);
  }
  var pend = window.__advq || [];
  window.__advq = { push: function (a) { window.advTrack(a[0], a[1]); } };
  pend.forEach(function (a) { window.advTrack(a[0], a[1]); });
  if (firstPV) setTimeout(function () { if (firstPV) pageView({ page: 'home' }); }, 1500);
})();
