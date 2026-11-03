/* Advantecnia · Blog: menú móvil, aparición al hacer scroll, filtros, índice activo y copiar enlace. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Menú móvil
  var mb = document.querySelector('.menu-btn'), mn = document.getElementById('mnav');
  if (mb && mn) {
    mb.addEventListener('click', function () {
      var open = mn.classList.toggle('open');
      mb.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mn.classList.contains('open')) { mn.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); mb.focus(); }
    });
  }

  // Aparición escalonada: solo las tarjetas, una vez, al entrar en pantalla
  var io = null;
  if (!reduce && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      var i = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.transitionDelay = Math.min(i++ * 70, 280) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }
  function reveal(els) {
    els.forEach(function (el) {
      if (!io) { el.classList.add('in'); return; }
      if (el.getBoundingClientRect().top < window.innerHeight) { el.classList.add('in'); return; }
      io.observe(el);
    });
  }
  reveal(Array.prototype.slice.call(document.querySelectorAll('[data-reveal]')));

  // Índice del blog: filtros, búsqueda y "cargar más"
  var grid = document.getElementById('grid');
  if (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
    var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
    var q = document.getElementById('q'), more = document.getElementById('more'), empty = document.getElementById('empty');
    var count = document.querySelector('.count');
    var PAGE = 12, shown = PAGE, cat = 'all';
    var valid = chips.map(function (c) { return c.getAttribute('data-filter'); });
    var h = (location.hash || '').slice(1);
    if (valid.indexOf(h) > -1) cat = h;

    var norm = function (s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    cards.forEach(function (c) { c._q = norm(c.getAttribute('data-q')); });

    function apply() {
      var term = norm(q && q.value.trim());
      var match = cards.filter(function (c) {
        return (cat === 'all' || c.getAttribute('data-cat') === cat) && (!term || c._q.indexOf(term) > -1);
      });
      cards.forEach(function (c) { c.hidden = true; });
      var fresh = [];
      match.forEach(function (c, i) {
        if (i < shown) { if (c.hidden && !c.classList.contains('in')) fresh.push(c); c.hidden = false; }
      });
      reveal(fresh);
      more.hidden = match.length <= shown;
      empty.hidden = match.length > 0;
      if (count) count.innerHTML = '<span>' + match.length + '</span> ' + count.getAttribute(match.length === 1 ? 'data-one' : 'data-many');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-filter') === cat ? 'true' : 'false'); });
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        cat = c.getAttribute('data-filter'); shown = PAGE;
        history.replaceState(null, '', cat === 'all' ? location.pathname : '#' + cat);
        apply();
        if (window.advTrack) window.advTrack('blog_filter', { cat: cat });
      });
    });
    var t;
    if (q) q.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { shown = PAGE; apply(); }, 120);
    });
    more.addEventListener('click', function () { shown += PAGE; apply(); });
    document.getElementById('reset').addEventListener('click', function () { cat = 'all'; if (q) q.value = ''; shown = PAGE; history.replaceState(null, '', location.pathname); apply(); q && q.focus(); });
    apply();
  }

  // Entrada: índice con la sección activa
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[decodeURIComponent(a.getAttribute('href').slice(1))] = a; });
    var heads = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    // Se recalcula solo cuando un encabezado cruza la franja superior: la sección activa es el último encabezado ya pasado
    var tio = new IntersectionObserver(function () {
      var current = null;
      heads.forEach(function (hd) { if (hd.getBoundingClientRect().top < 140) current = hd.id; });
      tocLinks.forEach(function (a) { a.classList.toggle('active', !!current && a === map[current]); });
    }, { rootMargin: '0px', threshold: [0, 1] });
    heads.forEach(function (hd) { tio.observe(hd); });
  }
  document.querySelectorAll('.toc-mobile a').forEach(function (a) {
    a.addEventListener('click', function () { var d = a.closest('details'); if (d) d.open = false; });
  });

  // Copiar enlace
  var cp = document.querySelector('[data-copy]');
  if (cp) cp.addEventListener('click', function () {
    var msg = document.querySelector('.share .copied');
    var done = function () { msg.textContent = msg.getAttribute('data-msg'); msg.classList.add('on'); setTimeout(function () { msg.classList.remove('on'); }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(cp.getAttribute('data-copy')).then(done, function () {});
  });
})();
