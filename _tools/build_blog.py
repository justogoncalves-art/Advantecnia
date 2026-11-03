"""Genera el blog estático de Advantecnia a partir de posts.json.
Uso: python3 -I build_blog.py <carpeta_datos_blog> <carpeta_web>
"""
import json, os, re, sys, html, math, glob
from urllib.parse import urlparse, quote
from datetime import datetime
from bs4 import BeautifulSoup, Comment, NavigableString
from PIL import Image

SRC, SITE = sys.argv[1], sys.argv[2]
DOMAIN = 'https://advantecnia.com'
OUT_IMG = os.path.join(SITE, 'blog', 'img')

posts = json.load(open(os.path.join(SRC, 'posts.json')))
# Publicación por fases: BLOG_SELECTION=<archivo con un slug por línea> publica solo esos posts en español.
# Los enlaces a posts no publicados se quitan (queda el texto) y sus URLs antiguas redirigen al blog.
SEL = os.environ.get('BLOG_SELECTION')
EN_BLOG = not SEL
EXCLUDED_OLD = {}
if SEL:
    _keep = set(open(SEL).read().split())
    _all = posts
    posts = [p for p in _all if '/en/' not in p['url'] and p['slug'] in _keep]
    _ids = {p['id'] for p in posts}
    for p in _all:
        if p['id'] in _ids: continue
        o = urlparse(p['url']).path
        EXCLUDED_OLD[o if o.endswith('/') else o + '/'] = '/blog'
BLOG_LANGS = ('es', 'en') if EN_BLOG else ('es',)
def blog_home(lang): return '/en/blog' if (lang == 'en' and EN_BLOG) else '/blog'
yoast_titles = {}
for f in glob.glob(os.path.join(SRC, 'raw', 'posts_*.json')):
    for r in json.load(open(f)):
        yoast_titles[r['id']] = (r.get('yoast_head_json') or {}).get('title')

CATS = {
    'Comunicación Asistencial': 'asistencial', 'Assistance Communication': 'asistencial',
    'Automatización y Seguridad': 'seguridad', 'Automation and Security': 'seguridad',
    'Gestión y Entretenimiento': 'gestion', 'Management and Entertainment': 'gestion',
}
CAT_NAMES = {
    'es': {'asistencial': 'Comunicación asistencial', 'seguridad': 'Automatización y seguridad', 'gestion': 'Gestión y entretenimiento'},
    'en': {'asistencial': 'Assistance communication', 'seguridad': 'Automation and security', 'gestion': 'Management and entertainment'},
}
CAT_SLUGS = {
    'es': {'asistencial': 'comunicacion-asistencial', 'seguridad': 'automatizacion-y-seguridad', 'gestion': 'gestion-y-entretenimiento'},
    'en': {'asistencial': 'assistance-communication', 'seguridad': 'automation-and-security', 'gestion': 'management-and-entertainment'},
}
CAT_INTRO = {
    'es': {'asistencial': 'Sistemas de llamada paciente-enfermera, comunicación con el paciente, monitorización y tecnología asistencial en hospitales y residencias.',
           'seguridad': 'Seguridad hospitalaria, control de accesos, redes, protocolos y automatización de edificios sanitarios.',
           'gestion': 'Gestión de turnos, megafonía, equipamiento de la habitación y entretenimiento del paciente.'},
    'en': {'asistencial': 'Nurse call systems, patient communication, monitoring and care technology in hospitals and care homes.',
           'seguridad': 'Hospital security, access control, networks, protocols and building automation for healthcare.',
           'gestion': 'Queue management, public address, patient room equipment and patient entertainment.'},
}
def cat_url(lang, key): return ('/en/blog/category/' if lang == 'en' else '/blog/categoria/') + CAT_SLUGS[lang][key]

MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

S = {
    'es': dict(
        home='Inicio', sol='Soluciones', proy='Proyectos', emp='Empresa', blog='Blog', cta='Solicita tu auditoría',
        menu='Abrir menú', skip='Saltar al contenido',
        idx_title='Blog de tecnología hospitalaria | Advantecnia',
        idx_desc='Artículos sobre sistemas de llamada paciente-enfermera, seguridad, gestión y transformación digital en hospitales y residencias.',
        h1='Ideas para un hospital que cuida mejor.',
        sub='Comunicación asistencial, seguridad y gestión hospitalaria, explicadas por nuestro equipo.',
        search='Buscar en el blog', search_ph='Llamada paciente-enfermera, PoE, telemedicina…',
        all='Todos', articles='artículos', article='artículo', more='Cargar más artículos', read='Leer artículo',
        empty_h='No hay artículos que coincidan.', empty_p='Prueba con otra palabra o revisa todas las categorías.', reset='Ver todos los artículos',
        min='min de lectura', by='Por', toc='En este artículo', share='Compartir', copy='Copiar enlace', copied='Enlace copiado',
        related='Sigue leyendo', all_posts='Ver todos los artículos',
        cta_h='¿Por dónde empezar? Te lo decimos gratis.',
        cta_p='Un asesor experto analiza tu hospital y te muestra qué soluciones pueden llevarlo al siguiente nivel, sin compromiso.',
        cta_btn='Hablar con un asesor experto',
        aside_h='¿Quieres aplicarlo en tu centro?', aside_p='Un asesor experto analiza tu hospital sin compromiso.',
        author_p='Equipo de Advantecnia, más de 20 años desarrollando sistemas para hospitales y residencias.',
        foot_tag='Tecnología al servicio de las personas. Una marca de ACE Business Group.',
        nav_h='Navegación', contact_h='Contacto', pres_h='Presencia', pres='Europa, EEUU, LATAM y Middle East',
        legal='Aviso Legal', priv='Política de Privacidad', cook='Política de Cookies', made='Fabricado en España',
        other_lang='English', other_lang_code='EN', faq='Preguntas frecuentes',
        updated='Actualizado el', sol_h='Solución relacionada', sol_more='Ver la solución', quick='Preguntas que resuelve este artículo', cats_h='Categorías',
    ),
    'en': dict(
        home='Home', sol='Solutions', proy='Projects', emp='Company', blog='Blog', cta='Request your audit',
        menu='Open menu', skip='Skip to content',
        idx_title='Hospital technology blog | Advantecnia',
        idx_desc='Articles on nurse call systems, security, hospital management and digital transformation in hospitals and care homes.',
        h1='Ideas for a hospital that cares better.',
        sub='Assistance communication, security and hospital management, explained by our team.',
        search='Search the blog', search_ph='Nurse call, PoE, telemedicine…',
        all='All', articles='articles', article='article', more='Load more articles', read='Read article',
        empty_h='No articles match your search.', empty_p='Try another word or browse all categories.', reset='See all articles',
        min='min read', by='By', toc='In this article', share='Share', copy='Copy link', copied='Link copied',
        related='Keep reading', all_posts='See all articles',
        cta_h='Where to start? We will tell you for free.',
        cta_p='An expert advisor analyses your hospital and shows you which solutions can take it to the next level, with no commitment.',
        cta_btn='Talk to an expert advisor',
        aside_h='Want to apply this in your facility?', aside_p='An expert advisor analyses your hospital with no commitment.',
        author_p='The Advantecnia team, with more than 20 years building systems for hospitals and care homes.',
        foot_tag='Technology at the service of people. An ACE Business Group brand.',
        nav_h='Navigation', contact_h='Contact', pres_h='Presence', pres='Europe, USA, LATAM and Middle East',
        legal='Legal Notice', priv='Privacy Policy', cook='Cookie Policy', made='Made in Spain',
        other_lang='Español', other_lang_code='ES', faq='FAQ',
        updated='Updated on', sol_h='Related solution', sol_more='See the solution', quick='Questions this article answers', cats_h='Categories',
    ),
}

def esc(s): return html.escape(s or '', quote=True)

def lang_of(p): return 'en' if '/en/' in p['url'] else 'es'

def new_path(p): return ('/en/blog/' if p['lang'] == 'en' else '/blog/') + p['slug']

def fmt_date(iso, lang):
    d = datetime.fromisoformat(iso)
    return f"{d.day} de {MONTHS_ES[d.month-1]} de {d.year}" if lang == 'es' else f"{MONTHS_EN[d.month-1]} {d.day}, {d.year}"

def author_name(a): return 'Redacción Advantecnia' if (not a or a == 'advjulio') else a

def clean_excerpt(t):
    t = re.sub(r'\s*(\[…\]|\[\.\.\.\]|…|\.\.\.)\s*$', '', (t or '').strip())
    t = re.sub(r'\s+', ' ', t).strip()
    if t and t[-1] not in '.!?»")': t = t.rstrip(',;:') + '…'
    return t

def trunc(t, n=158):
    if len(t) <= n: return t
    return t[:n].rsplit(' ', 1)[0].rstrip(',.;:') + '…'

# ---------- Imágenes ----------
def convert(local_rel, out_rel, maxw):
    """Convierte una imagen guardada a webp con ancho máximo. Devuelve (url, w, h) o None."""
    if not local_rel: return None
    src = os.path.join(SRC, local_rel)
    if not os.path.exists(src): return None
    out = os.path.join(OUT_IMG, out_rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if os.path.exists(out):
        with Image.open(out) as im: w, h = im.size
    else:
        try:
            with Image.open(src) as im:
                im.seek(0)
                im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') else im.convert('RGB')
                if im.width > maxw:
                    im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
                im.save(out, 'WEBP', quality=80, method=6)
                w, h = im.size
        except Exception as e:
            print('IMG FAIL', src, e); return None
    return ('/blog/img/' + out_rel, w, h)

def img_name(local_rel):
    return re.sub(r'[^a-zA-Z0-9_-]+', '-', os.path.splitext(os.path.basename(local_rel))[0]).strip('-').lower()[:80] + '.webp'

# ---------- Preparación ----------
for p in posts:
    p['lang'] = lang_of(p)
    p['path'] = new_path(p)
    keys = [CATS[c] for c in p['categorias'] if c in CATS]
    p['cat'] = keys[0] if keys else 'asistencial'
    p['excerpt'] = clean_excerpt(p['extracto'])
    words = len(re.findall(r'\w+', p['contenido_texto']))
    p['mins'] = max(1, math.ceil(words / 220))
    p['author_n'] = author_name(p['autor'])
    t = yoast_titles.get(p['id']) or p['titulo']
    t = re.sub(r'\s*[-|–]\s*Advantecnia\s*$', '', t).strip()
    p['seo_title'] = t
    p['seo_desc'] = trunc(clean_excerpt(p.get('yoast_meta_descripcion') or p['excerpt']))
    slug = p['slug']
    p['hero'] = convert(p['imagen_destacada_local'], f"{slug}/{img_name(p['imagen_destacada_local'] or 'x')}".replace('.webp', '-1600.webp'), 1600)
    p['thumb'] = convert(p['imagen_destacada_local'], f"{slug}/{img_name(p['imagen_destacada_local'] or 'x')}".replace('.webp', '-720.webp'), 720)
    p['hero_alt'] = p.get('imagen_destacada_alt') or p['titulo']

def og_jpg(p):
    src = p['imagen_destacada_local'] and os.path.join(SRC, p['imagen_destacada_local'])
    if not src or not os.path.exists(src): return None
    rel = f"/blog/og/{p['slug']}.jpg"
    out = os.path.join(SITE, rel.strip('/'))
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with Image.open(src) as im:
            im = im.convert('RGB'); W, H = 1200, 630
            r = max(W / im.width, H / im.height)
            im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
            im.crop((0, (im.height - H) // 2, W, (im.height - H) // 2 + H)).save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    return rel
for p in posts: p['og'] = og_jpg(p)

posts.sort(key=lambda p: p['fecha'], reverse=True)
# títulos SEO únicos y de longitud razonable
_seen = {}
for p in posts:
    t = p['seo_title']
    if p['lang'] == 'en' or (p['lang'], t) in _seen or len(t) > 60: t = p['titulo']  # en EN, Yoast guardaba títulos en español
    if (p['lang'], t) in _seen: t = f"{t} ({CAT_NAMES[p['lang']][p['cat']]})"
    _seen[(p['lang'], t)] = 1
    p['seo_title'] = t
def page_title(t): return f"{t} | Advantecnia" if len(t) <= 51 else t
PATHMAP = {}
for p in posts:
    old = urlparse(p['url']).path
    if not old.endswith('/'): old += '/'
    PATHMAP[old] = p['path']

CONTACT_PATHS = {'/contacto/', '/en/contact/', '/contact/', '/en/contacto/'}

def rewrite_href(href, lang):
    if not href: return href, False
    href = href.strip()
    if href.startswith(('#', 'mailto:', 'tel:')): return href, False
    m = re.match(r'^https?://(?:www\.)?advantecnia\.com(/[^#?]*)?([?#].*)?$', href)
    if m:
        path = m.group(1) or '/'
        frag = m.group(2) or ''
        if '/wp-content/' in path: return href, True
        if not path.endswith('/'): path += '/'
        if path in PATHMAP: return PATHMAP[path] + (frag if frag.startswith('#') else ''), False
        if path in EXCLUDED_OLD: return None, False
        if path in CONTACT_PATHS: return '/#auditoria', False
        if path.rstrip('/') in ('/blog', '/en/blog'): return ('/en/blog' if lang == 'en' else '/blog'), False
        return ('/?lang=en' if lang == 'en' else '/'), False
    if href.startswith('/'):
        return rewrite_href(DOMAIN + href, lang)
    return href, True

def slugify(t):
    t = re.sub(r'[^\w\s-]', '', t, flags=re.U).strip()
    return re.sub(r'\s+', '_', t)[:80] or 'seccion'

KEEP_ATTRS = {'a': {'href', 'rel', 'target'}, 'img': {'src', 'alt', 'width', 'height', 'loading', 'decoding'},
              'td': {'colspan', 'rowspan'}, 'th': {'colspan', 'rowspan'}, 'h2': {'id'}, 'h3': {'id'}, 'h4': {'id'},
              'div': {'class'}, 'figure': set(), 'ol': {'start'}}

def clean_content(p):
    soup = BeautifulSoup(p['contenido_html'], 'html.parser')
    for t in soup.select('#ez-toc-container, script, style, noscript, iframe[src*="googletagmanager"]'): t.decompose()
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)): c.extract()
    # ids de ez-toc: se trasladan al encabezado para que los anclajes antiguos sigan funcionando
    for sp in soup.select('span.ez-toc-section'):
        h = sp.find_parent(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        if h and sp.get('id') and not h.get('id'): h['id'] = sp['id']
        sp.decompose()
    for sp in soup.select('span.ez-toc-section-end'): sp.decompose()
    for t in soup.find_all('h1'): t.name = 'h2'
    for t in soup.find_all(['h5', 'h6']): t.name = 'h4'
    for t in soup.find_all(['span', 'article', 'nav', 'section', 'font', 'header', 'center']): t.unwrap()
    for t in soup.find_all('b'): t.name = 'strong'
    # imágenes
    imgmap = {i['url']: i['local'] for i in p['imagenes_contenido']}
    n = 0
    for img in soup.find_all('img'):
        src = img.get('src', '')
        local = imgmap.get(src)
        conv = convert(local, f"{p['slug']}/{img_name(local)}", 1200) if local else None
        if not conv:
            img.decompose(); continue
        n += 1
        alt = img.get('alt') or ''
        img.attrs = {'src': conv[0], 'alt': alt, 'width': str(conv[1]), 'height': str(conv[2]), 'loading': 'lazy', 'decoding': 'async'}
        par = img.parent
        if par and par.name == 'a':
            par.unwrap(); par = img.parent
        if par and par.name in ('p', 'div') and len([c for c in par.contents if not (isinstance(c, NavigableString) and not c.strip())]) == 1:
            par.name = 'figure'; par.attrs = {}
        elif par and par.name != 'figure':
            fig = soup.new_tag('figure'); img.wrap(fig)
    # tablas
    for tb in soup.find_all('table'):
        par = tb.parent
        if not (par and par.name == 'div' and 'table' in (par.get('class') or [])):
            wrap = soup.new_tag('div', attrs={'class': 'table'}); tb.wrap(wrap)
    for d in soup.find_all('div'):
        if 'table' not in (d.get('class') or []): d.unwrap()
        else: d['class'] = ['table']
    # enlaces
    for a in soup.find_all('a'):
        href, ext = rewrite_href(a.get('href'), p['lang'])
        if not href: a.unwrap(); continue
        a.attrs = {'href': href}
        if ext: a['target'] = '_blank'; a['rel'] = 'noopener'
    # atributos
    for t in soup.find_all(True):
        keep = KEEP_ATTRS.get(t.name, set())
        t.attrs = {k: v for k, v in t.attrs.items() if k in keep}
    # párrafos vacíos
    for t in soup.find_all(['p', 'li', 'h2', 'h3', 'h4', 'strong', 'em']):
        if not t.get_text(strip=True) and not t.find('img'): t.decompose()
    # ids de encabezados y TOC
    seen, toc = set(), []
    for h in soup.find_all(['h2', 'h3', 'h4']):
        hid = h.get('id') or slugify(h.get_text(' ', strip=True))
        base, k = hid, 2
        while hid in seen: hid = f'{base}_{k}'; k += 1
        seen.add(hid); h['id'] = hid
        if h.name == 'h2': toc.append((hid, h.get_text(' ', strip=True)))
    # alt vacío: se usa el encabezado anterior (o el título del post)
    for img in soup.find_all('img'):
        if not img.get('alt', '').strip():
            prev = img.find_previous(['h2', 'h3', 'h4'])
            img['alt'] = (prev.get_text(' ', strip=True) if prev else '') or p['titulo']
    # preguntas y respuestas para FAQPage (AEO): encabezado con "?" + primeros párrafos siguientes
    faqs = []
    for h in soup.find_all(['h2', 'h3']):
        q = h.get_text(' ', strip=True)
        if '?' not in q or len(q) > 140: continue
        ans, words = [], 0
        for sib in h.find_next_siblings():
            if sib.name in ('h2', 'h3', 'h4'): break
            if sib.name in ('p', 'ul', 'ol'):
                t = sib.get_text(' ', strip=True)
                if sib.name != 'p': t = '; '.join(li.get_text(' ', strip=True) for li in sib.find_all('li', recursive=False))
                if not t: continue
                ans.append(t); words += len(t.split())
                if words >= 45: break
        a = ' '.join(ans)
        if len(a.split()) >= 15:
            ws = a.split()
            if len(ws) > 90: a = ' '.join(ws[:90]).rstrip(',;:') + '…'
            faqs.append((q, a))
    p['faqs'] = faqs[:8]
    out = str(soup)
    out = re.sub(r'(&nbsp;| )+', ' ', out)
    out = re.sub(r'\n{2,}', '\n', out)
    return out, toc

# ---------- Plantillas ----------
ICON = {
    'search': '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32ZM40 112a72 72 0 1 1 72 72 72.08 72.08 0 0 1-72-72Z"/></svg>',
    'arrow': '<svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M221.66 133.66l-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32Z"/></svg>',
    'menu': '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8ZM40 72h176a8 8 0 0 0 0-16H40a8 8 0 0 0 0 16Zm176 112H40a8 8 0 0 0 0 16h176a8 8 0 0 0 0-16Z"/></svg>',
    'caret': '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z"/></svg>',
    'linkedin': '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216 24H40a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V40a16 16 0 0 0-16-16Zm0 192H40V40h176v176ZM96 112v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0Zm88 28v36a8 8 0 0 1-16 0v-36a20 20 0 0 0-40 0v36a8 8 0 0 1-16 0v-64a8 8 0 0 1 15.79-1.78A36 36 0 0 1 184 140Zm-84-56a12 12 0 1 1-12-12 12 12 0 0 1 12 12Z"/></svg>',
    'x': '<svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M214.75 211.71l-62.6-98.38 61.77-67.95a8 8 0 0 0-11.84-10.76l-58.84 64.72-40.49-63.63A8 8 0 0 0 96 32H48a8 8 0 0 0-6.75 12.3l62.6 98.37-61.77 68a8 8 0 1 0 11.84 10.76l58.84-64.72 40.49 63.63A8 8 0 0 0 160 224h48a8 8 0 0 0 6.75-12.29ZM164.39 208 62.57 48h29l101.86 160Z"/></svg>',
    'mail': '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224 48H32a8 8 0 0 0-8 8v136a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a8 8 0 0 0-8-8Zm-96 85.15L52.57 64h150.86ZM98.71 128 40 181.81V74.19Zm11.84 10.85 12 11.05a8 8 0 0 0 10.82 0l12-11.05 58 53.15H52.57ZM157.29 128 216 74.18v107.64Z"/></svg>',
    'link': '<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M240 88.23a54.43 54.43 0 0 1-16 37L189.25 160a54.27 54.27 0 0 1-38.63 16h-.05A54.63 54.63 0 0 1 96 119.84a8 8 0 0 1 16 .45A38.62 38.62 0 0 0 150.58 160a38.39 38.39 0 0 0 27.31-11.31l34.75-34.75a38.63 38.63 0 0 0-54.63-54.63l-11 11A8 8 0 0 1 135.7 59l11-11a54.65 54.65 0 0 1 77.3 0 54.86 54.86 0 0 1 16 40.23Zm-131 97.43-11 11A38.4 38.4 0 0 1 70.6 208a38.63 38.63 0 0 1-27.29-65.94L78 107.31A38.63 38.63 0 0 1 144 135.71a8 8 0 0 0 16 .45A54.86 54.86 0 0 0 144 96a54.65 54.65 0 0 0-77.27 0L32 130.75A54.62 54.62 0 0 0 70.56 224a54.28 54.28 0 0 0 38.64-16l11-11a8 8 0 0 0-11.2-11.34Z"/></svg>',
}

def head(lang, title, desc, canonical, og_img=None, og_type='website', jsonld=None, alt=None, extra=''):
    s = S[lang]
    og = og_img or f'{DOMAIN}/assets/img/og-preview.jpg'
    ld = ''.join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>' for j in (jsonld or []))
    alts = ''.join(f'<link rel="alternate" hreflang="{h}" href="{u}">' for h, u in (alt or []))
    return f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
{alts}
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#16374D">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Advantecnia">
<meta property="og:locale" content="{'es_ES' if lang == 'es' else 'en_US'}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{og}">
<link rel="icon" href="/assets/adv-logo-color.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog/blog.css">
{extra}
{ld}
<script>document.documentElement.classList.add('js')</script>
<script src="/assets/at.js" defer></script>
</head>
<body>
<a class="skip" href="#contenido">{s['skip']}</a>
'''

def P(lang): return '/en' if lang == 'en' else ''

FAQ_PATH = {'es': '/preguntas-frecuentes', 'en': '/en/faq'}

def header(lang, other_url, active='blog', self_url=None):
    s = S[lang]
    home = '/?lang=en' if lang == 'en' else '/'
    blog = blog_home(lang)
    links = [(home, s['home'], 'home'), (P(lang) + '/soluciones', s['sol'], 'sol'), (P(lang) + '/proyectos', s['proy'], 'proy'), (P(lang) + '/empresa', s['emp'], 'emp'), (blog, s['blog'], 'blog')]
    cur = ' aria-current="page"'
    nav = ''.join(f'<a href="{u}"{cur if k == active else ""}>{t}</a>' for u, t, k in links)
    es_cur = ' aria-current="true"' if lang == 'es' else ''
    en_cur = ' aria-current="true"' if lang == 'en' else ''
    me = self_url or blog
    es_url = other_url if lang == 'en' else me
    en_url = other_url if lang == 'es' else me
    if not EN_BLOG and en_url.startswith('/en/blog'): en_url = '/?lang=en'
    return f'''<header class="site-head">
  <div class="wrap">
    <a class="logo" href="{home}" aria-label="Advantecnia, {s['home'].lower()}"><img src="/assets/adv-logo-color.svg" alt="Advantecnia" width="176" height="40"></a>
    <nav class="nav" aria-label="Principal">{nav}</nav>
    <div class="head-end">
      <div class="lang"><a href="{es_url}" hreflang="es"{es_cur}>ES</a><span aria-hidden="true">|</span><a href="{en_url}" hreflang="en"{en_cur}>EN</a></div>
      <a class="btn head-cta" href="/{'?lang=en' if lang == 'en' else ''}#auditoria" data-track="Blog: cabecera auditoria">{s['cta']}</a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mnav" aria-label="{s['menu']}">{ICON['menu']}</button>
    </div>
  </div>
  <nav class="mobile-nav" id="mnav" aria-label="Móvil">{nav}<a class="btn" href="/{'?lang=en' if lang == 'en' else ''}#auditoria">{s['cta']}</a></nav>
</header>
<div class="progress" aria-hidden="true"></div>
'''

def cta_band(lang):
    s = S[lang]
    return f'''<section class="cta-band">
  <div class="wrap">
    <div><h2>{s['cta_h']}</h2><p>{s['cta_p']}</p></div>
    <a class="btn btn-light" href="/{'?lang=en' if lang == 'en' else ''}#auditoria" data-track="Blog: banda asesor">{s['cta_btn']}{ICON['arrow']}</a>
  </div>
</section>
'''

def footer(lang):
    s = S[lang]
    q = '?lang=en&' if lang == 'en' else '?'
    home = '/?lang=en' if lang == 'en' else '/'
    blog = blog_home(lang)
    return f'''<div class="foot-rule"></div>
<footer class="site-foot">
  <div class="wrap cols">
    <div class="brand"><img src="/assets/advantecnia-logo-reverse.png" alt="Advantecnia" width="196" height="45" loading="lazy"><p>{s['foot_tag']}</p></div>
    <div><h2>{s['nav_h']}</h2><ul>
      <li><a href="{home}">{s['home']}</a></li><li><a href="{P(lang)}/soluciones">{s['sol']}</a></li><li><a href="{P(lang)}/proyectos">{s['proy']}</a></li><li><a href="{P(lang)}/empresa">{s['emp']}</a></li><li><a href="{blog}">{s['blog']}</a></li><li><a href="{FAQ_PATH[lang]}">{s['faq']}</a></li>
    </ul></div>
    <div><h2>{s['contact_h']}</h2><ul><li><a href="mailto:info@advantecnia.com">info@advantecnia.com</a></li><li><a href="tel:+34637495757">+34 637 49 57 57</a></li></ul></div>
    <div><h2>{s['pres_h']}</h2><ul><li>{s['pres']}</li></ul></div>
  </div>
  <div class="bottom"><div class="wrap">
    <div><span>CE-EMC</span><span>IEC 60601</span><span>FCC</span><span>{s['made']}</span></div>
    <div><a href="https://www.linkedin.com/company/advantecnia/home/" target="_blank" rel="noopener">LinkedIn</a><a href="/{q}p=legal&amp;t=aviso">{s['legal']}</a><a href="/{q}p=legal&amp;t=privacidad">{s['priv']}</a><a href="/{q}p=legal&amp;t=cookies">{s['cook']}</a></div>
  </div></div>
</footer>
<script src="/blog/blog.js" defer></script>
</body>
</html>
'''

def card(p, lang, hidden=False, heading='h3'):
    s = S[lang]
    t = p['thumb']
    img = f'<img src="{t[0]}" alt="{esc(p["hero_alt"])}" width="{t[1]}" height="{t[2]}" loading="lazy" decoding="async">' if t else ''
    search = esc((p['titulo'] + ' ' + p['excerpt']).lower())
    return f'''<a class="card" href="{p['path']}" data-cat="{p['cat']}" data-q="{search}" data-reveal>
  <div class="card-media">{img}</div>
  <span class="cat">{CAT_NAMES[lang][p['cat']]}</span>
  <{heading}>{esc(p['titulo'])}</{heading}>
  <p>{esc(p['excerpt'])}</p>
  <div class="meta"><time datetime="{p['fecha'][:10]}">{fmt_date(p['fecha'], lang)}</time><span>{p['mins']} {s['min']}</span></div>
</a>'''

SOLS = {
    'smartroom': {'es': ('SmartRoom', 'La habitación que cuida. Comunicación, experiencia y acompañamiento del paciente.'),
                  'en': ('SmartRoom', 'The room that cares. Patient communication, experience and companionship.')},
    'smartsense': {'es': ('SmartSense', 'Cuidar sin vigilar. Monitorización sin cámaras y sin contacto.'),
                   'en': ('SmartSense', 'Care without watching. Monitoring with no cameras and no contact.')},
    'smartflow': {'es': ('SmartFlow', 'Todo el hospital en sintonía. Operación, seguridad y gestión de todas las áreas.'),
                  'en': ('SmartFlow', 'The whole hospital in tune. Operations, security and management across every area.')},
    'smartcore': {'es': ('SmartCore', 'El cerebro y la red. La plataforma que integra todo y la red que lo sostiene.'),
                  'en': ('SmartCore', 'The brain and the network. The platform that integrates everything and the network that supports it.')},
}
def sol_for(p):
    t = (p['titulo'] + ' ' + p['slug']).lower()
    if re.search(r'monitori|ca[ií]da|sensor|telecuid|telemedic|telecare|fall|big data|inteligencia artificial|artificial intelligence', t): return 'smartsense'
    if re.search(r'poe|profibus|profinet|can.?bus|ntp|cable|bus|voip|rel[eé]|relay|stand.?alone|mqtt|red |network|blockchain|software|his|pacs', t): return 'smartcore'
    if re.search(r'turno|queue|megafon|public address|seguridad|security|acceso|access|cctv|c[aá]mara|camera|cartel|signage|energ|gesti[oó]n|management|hotel|cerradura|lock|liderazgo|leadership|ingenier|engineering', t): return 'smartflow'
    return 'smartroom'

ORG = {"@type": "Organization", "name": "Advantecnia", "url": DOMAIN, "logo": f"{DOMAIN}/assets/adv-logo-color.svg",
       "parentOrganization": {"@type": "Organization", "name": "ACE Business Group International SA"}}

def build_index(lang):
    s = S[lang]
    items = [p for p in posts if p['lang'] == lang]
    blog = '/en/blog' if lang == 'en' else '/blog'
    other = '/blog' if lang == 'en' else '/en/blog'
    canon = DOMAIN + blog
    feat, rest = items[0], items[1:]
    counts = {k: sum(1 for p in items if p['cat'] == k) for k in CAT_NAMES[lang]}
    chips = f'<a class="chip" href="{blog}" data-filter="all" aria-pressed="true">{s["all"]}<span>{len(items)}</span></a>' + ''.join(
        f'<a class="chip" href="{cat_url(lang, k)}" data-filter="{k}" aria-pressed="false">{CAT_NAMES[lang][k]}<span>{counts[k]}</span></a>' for k in CAT_NAMES[lang] if counts[k])
    fh = feat['hero']
    fimg = f'<img src="{fh[0]}" alt="{esc(feat["hero_alt"])}" width="{fh[1]}" height="{fh[2]}" fetchpriority="high">' if fh else ''
    ld = [{"@context": "https://schema.org", "@type": "Blog", "name": s['idx_title'], "url": canon, "inLanguage": lang, "publisher": ORG,
           "blogPost": [{"@type": "BlogPosting", "headline": p['titulo'], "url": DOMAIN + p['path'], "datePublished": p['fecha']} for p in items[:20]]},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": s['home'], "item": DOMAIN + '/'},
              {"@type": "ListItem", "position": 2, "name": s['blog'], "item": canon}]}]
    alt = [('es', DOMAIN + '/blog'), ('en', DOMAIN + '/en/blog'), ('x-default', DOMAIN + '/blog')] if EN_BLOG else []
    preload = f'<link rel="preload" as="image" href="{fh[0]}">' if fh else ''
    page = head(lang, s['idx_title'], s['idx_desc'], canon, jsonld=ld, alt=alt, extra=preload) + header(lang, other, 'blog', blog)
    page += f'''<main id="contenido">
<section class="blog-hero">
  <div class="wrap">
    <div><h1>{s['h1']}</h1><p>{s['sub']}</p></div>
    <div class="search" role="search"><label for="q">{s['search']}</label><input id="q" type="search" placeholder="{esc(s['search_ph'])}" autocomplete="off">{ICON['search']}</div>
  </div>
</section>
<section class="featured" aria-label="Destacado">
  <div class="wrap">
    <a class="feat-card" href="{feat['path']}">
      <div class="feat-media">{fimg}</div>
      <div class="feat-body">
        <span class="cat">{CAT_NAMES[lang][feat['cat']]}</span>
        <h2>{esc(feat['titulo'])}</h2>
        <p>{esc(feat['excerpt'])}</p>
        <div class="meta"><time datetime="{feat['fecha'][:10]}">{fmt_date(feat['fecha'], lang)}</time><span>{feat['mins']} {s['min']}</span></div>
        <span class="more">{s['read']}{ICON['arrow']}</span>
      </div>
    </a>
  </div>
</section>
<section class="listing" aria-label="{s['articles']}">
  <div class="wrap">
    <div class="filters"><div class="chips" role="group" aria-label="Categorías">{chips}</div><p class="count" aria-live="polite" data-one="{s['article']}" data-many="{s['articles']}"><span>{len(rest)}</span> {s['articles']}</p></div>
    <div class="grid" id="grid">
{chr(10).join(card(p, lang) for p in rest)}
    </div>
    <div class="empty" id="empty" hidden><h3>{s['empty_h']}</h3><p>{s['empty_p']}</p><button class="btn btn-ghost" type="button" id="reset">{s['reset']}</button></div>
    <button class="btn btn-ghost load-more" type="button" id="more" hidden>{s['more']}</button>
  </div>
</section>
</main>
'''
    page += cta_band(lang) + footer(lang)
    out = os.path.join(SITE, blog.strip('/'), 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w').write(page)

def build_post(p):
    lang = p['lang']; s = S[lang]
    blog = '/en/blog' if lang == 'en' else '/blog'
    canon = DOMAIN + p['path']
    content, toc = clean_content(p)
    h = p['hero']
    hero = f'<figure class="hero-img"><img src="{h[0]}" alt="{esc(p["hero_alt"])}" width="{h[1]}" height="{h[2]}" fetchpriority="high"></figure>' if h else ''
    toc_items = ''.join(f'<li><a href="#{hid}">{esc(t)}</a></li>' for hid, t in toc)
    toc_aside = f'<nav class="toc" aria-label="{s["toc"]}"><h2>{s["toc"]}</h2><ol>{toc_items}</ol></nav>' if len(toc) > 1 else ''
    toc_mob = f'<details class="toc-mobile"><summary>{s["toc"]}{ICON["caret"]}</summary><ol>{toc_items}</ol></details>' if len(toc) > 1 else ''
    same = [q for q in posts if q['lang'] == lang and q['cat'] == p['cat'] and q['id'] != p['id']]
    idx = next((i for i, q in enumerate(same) if q['fecha'] < p['fecha']), 0)
    related = (same[idx:] + same[:idx])[:3]
    enc = quote(canon, safe='')
    tit = quote(p['titulo'], safe='')
    initials = ''.join(w[0] for w in p['author_n'].split()[:2]).upper()
    upd = ''
    if p['modificado'][:10] > p['fecha'][:10] and (datetime.fromisoformat(p['modificado']) - datetime.fromisoformat(p['fecha'])).days > 30:
        upd = f'<span>{s["updated"]} <time datetime="{p["modificado"][:10]}">{fmt_date(p["modificado"], lang)}</time></span>'
    sk = sol_for(p); sn, sd = SOLS[sk][lang]
    sol_url = f"{P(lang)}/soluciones#{sk}"
    sol_box = f'<a class="sol-box" href="{sol_url}" data-track="Blog: solución {sn}"><span class="cat">{s["sol_h"]}</span><strong>{sn}</strong><span>{sd}</span><span class="more">{s["sol_more"]}{ICON["arrow"]}</span></a>'
    faq_html = ''
    if p['faqs']:
        faq_html = f'<section class="post-faq" aria-labelledby="faq-h"><h2 id="faq-h">{s["quick"]}</h2>' + ''.join(
            f'<details><summary>{esc(q)}{ICON["caret"]}</summary><p>{esc(a)}</p></details>' for q, a in p['faqs']) + '</section>'
    other = '/blog' if lang == 'en' else '/en/blog'
    ld = [{"@context": "https://schema.org", "@type": "BlogPosting", "headline": p['titulo'][:110], "description": p['seo_desc'],
           "image": [DOMAIN + h[0]] if h else [], "datePublished": p['fecha'], "dateModified": p['modificado'],
           "author": {"@type": "Organization" if p['author_n'] == 'Redacción Advantecnia' else "Person", "name": p['author_n']},
           "publisher": ORG, "mainEntityOfPage": canon, "inLanguage": lang, "articleSection": CAT_NAMES[lang][p['cat']],
           "keywords": ', '.join(p['etiquetas']) if p['etiquetas'] else None, "wordCount": len(re.findall(r'\w+', p['contenido_texto']))},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": s['home'], "item": DOMAIN + '/'},
              {"@type": "ListItem", "position": 2, "name": s['blog'], "item": DOMAIN + blog},
              {"@type": "ListItem", "position": 3, "name": CAT_NAMES[lang][p['cat']], "item": DOMAIN + cat_url(lang, p['cat'])},
              {"@type": "ListItem", "position": 4, "name": p['titulo'], "item": canon}]}]
    ld[0]["speakable"] = {"@type": "SpeakableSpecification", "cssSelector": ["h1", ".lead"]}
    ld[0]["about"] = {"@type": "Thing", "name": CAT_NAMES[lang][p['cat']]}
    ld[0]["isPartOf"] = {"@type": "Blog", "name": "Blog de Advantecnia" if lang == 'es' else "Advantecnia Blog", "url": DOMAIN + blog}
    if p['autor'] and p['author_n'] != 'Redacción Advantecnia':
        ld[0]["author"]["worksFor"] = {"@type": "Organization", "name": "Advantecnia", "url": DOMAIN}
    if p['og']: ld[0]["image"] = [DOMAIN + p['og']] + ld[0].get("image", [])
    ld[0] = {k: v for k, v in ld[0].items() if v}
    if p['faqs']:
        ld.append({"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
                   "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in p['faqs']]})
    extra = (f'<meta property="article:published_time" content="{p["fecha"]}"><meta property="article:modified_time" content="{p["modificado"]}">'
             f'<meta property="article:section" content="{esc(CAT_NAMES[lang][p["cat"]])}">' + (f'<link rel="preload" as="image" href="{h[0]}">' if h else ''))
    page = head(lang, page_title(p['seo_title']), p['seo_desc'], canon, og_img=(DOMAIN + p['og']) if p['og'] else ((DOMAIN + h[0]) if h else None), og_type='article', jsonld=ld, extra=extra) + header(lang, other, 'blog', blog)
    page += f'''<main id="contenido">
<article>
<header class="post-head">
  <div class="wrap">
    <nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="{'/?lang=en' if lang == 'en' else '/'}">{s['home']}</a></li><li><a href="{blog}">{s['blog']}</a></li><li><a href="{cat_url(lang, p['cat'])}">{CAT_NAMES[lang][p['cat']]}</a></li></ol></nav>
    <div class="inner">
      <a class="cat" href="{cat_url(lang, p['cat'])}">{CAT_NAMES[lang][p['cat']]}</a>
      <h1>{esc(p['titulo'])}</h1>
      <p class="lead">{esc(p['seo_desc'])}</p>
      <div class="meta"><span>{s['by']} <span class="who">{esc(p['author_n'])}</span></span><time datetime="{p['fecha'][:10]}">{fmt_date(p['fecha'], lang)}</time>{upd}<span>{p['mins']} {s['min']}</span></div>
    </div>
    {hero}
  </div>
</header>
<div class="wrap post-layout">
  <div>
    {toc_mob}
    <div class="prose">
{content}
    </div>
    {faq_html}
    {sol_box}
    <div class="share"><p>{s['share']}</p>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url={enc}" target="_blank" rel="noopener" aria-label="LinkedIn">{ICON['linkedin']}</a>
      <a href="https://twitter.com/intent/tweet?url={enc}&amp;text={tit}" target="_blank" rel="noopener" aria-label="X">{ICON['x']}</a>
      <a href="mailto:?subject={tit}&amp;body={enc}" aria-label="Email">{ICON['mail']}</a>
      <button type="button" data-copy="{canon}" aria-label="{s['copy']}">{ICON['link']}</button>
      <span class="copied" aria-live="polite" data-msg="{s['copied']}"></span>
    </div>
    <div class="author-box"><span class="av" aria-hidden="true">{initials}</span><p><strong>{esc(p['author_n'])}</strong>{s['author_p']}</p></div>
  </div>
  <aside class="aside"><div class="aside-inner">
    {toc_aside}
    {sol_box.replace('class="sol-box"', 'class="sol-box sol-aside"')}
    <div class="aside-cta"><h2>{s['aside_h']}</h2><p>{s['aside_p']}</p><a class="btn" href="/{'?lang=en' if lang == 'en' else ''}#auditoria" data-track="Blog: lateral asesor">{s['cta_btn']}</a></div>
  </div></aside>
</div>
</article>
<section class="related" aria-labelledby="rel-h">
  <div class="wrap">
    <h2 id="rel-h">{s['related']}</h2>
    <div class="grid">{''.join(card(q, lang) for q in related)}</div>
    <a class="btn btn-ghost all" href="{blog}">{s['all_posts']}</a>
  </div>
</section>
</main>
'''
    page += cta_band(lang) + footer(lang)
    out = os.path.join(SITE, p['path'].strip('/'), 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w').write(page)

def build_category(lang, key):
    s = S[lang]
    items = [p for p in posts if p['lang'] == lang and p['cat'] == key]
    if not items: return
    blog = P(lang) + '/blog'
    url = cat_url(lang, key); canon = DOMAIN + url
    other = cat_url('en' if lang == 'es' else 'es', key)
    name = CAT_NAMES[lang][key]
    title = f"{name}: blog | Advantecnia"
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": name, "url": canon, "inLanguage": lang, "description": CAT_INTRO[lang][key],
           "isPartOf": {"@type": "Blog", "url": DOMAIN + blog}, "mainEntity": {"@type": "ItemList", "numberOfItems": len(items),
           "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": DOMAIN + p['path'], "name": p['titulo']} for i, p in enumerate(items)]}},
          {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
              {"@type": "ListItem", "position": 1, "name": s['home'], "item": DOMAIN + '/'},
              {"@type": "ListItem", "position": 2, "name": s['blog'], "item": DOMAIN + blog},
              {"@type": "ListItem", "position": 3, "name": name, "item": canon}]}]
    alt = [('es', DOMAIN + cat_url('es', key)), ('en', DOMAIN + cat_url('en', key))] if EN_BLOG else []
    others = ''.join(f'<a class="chip" href="{cat_url(lang, k)}"{" aria-pressed=\"true\"" if k == key else ""}>{CAT_NAMES[lang][k]}</a>' for k in CAT_NAMES[lang])
    page = head(lang, title, CAT_INTRO[lang][key], canon, jsonld=ld, alt=alt) + header(lang, other, 'blog', url)
    page += f'''<main id="contenido">
<section class="blog-hero"><div class="wrap">
  <div><nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="{'/?lang=en' if lang == 'en' else '/'}">{s['home']}</a></li><li><a href="{blog}">{s['blog']}</a></li></ol></nav>
  <h1 style="margin-top:18px">{name}</h1><p>{CAT_INTRO[lang][key]}</p></div>
  <div><p class="count" style="margin-bottom:12px">{len(items)} {s['articles']}</p><div class="chips" style="flex-wrap:wrap;margin:0;padding:0">{others}</div></div>
</div></section>
<section class="listing"><div class="wrap"><div class="grid">
{chr(10).join(card(p, lang) for p in items)}
</div></div></section>
</main>
'''
    page += cta_band(lang) + footer(lang)
    out = os.path.join(SITE, url.strip('/'), 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w').write(page)

for p in posts: build_post(p)
for l in BLOG_LANGS:
    for k in CAT_NAMES[l]: build_category(l, k)
for l in BLOG_LANGS: build_index(l)

# Datos para la home (últimos artículos)
latest = {l: [{'t': p['titulo'], 'u': p['path'], 'img': p['thumb'][0] if p['thumb'] else '', 'alt': p['hero_alt'], 'c': CAT_NAMES[l][p['cat']],
               'd': fmt_date(p['fecha'], l), 'm': f"{p['mins']} {S[l]['min']}"} for p in posts if p['lang'] == (l if EN_BLOG else 'es')][:3] for l in ('es', 'en')}
json.dump(latest, open(os.path.join(SITE, 'blog', 'latest.json'), 'w'), ensure_ascii=False, indent=1)

# sitemap
urls = [(DOMAIN + '/', None, '1.0'), (DOMAIN + '/blog', posts[0]['fecha'][:10], '0.8'), (DOMAIN + '/en/blog', posts[0]['fecha'][:10], '0.6')]
urls += [(DOMAIN + p['path'], p['modificado'][:10], '0.7' if p['lang'] == 'es' else '0.5') for p in posts]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{u}</loc>' + (f'<lastmod>{d}</lastmod>' if d else '') + f'<priority>{pr}</priority></url>\n' for u, d, pr in urls) + '</urlset>\n'
open(os.path.join(SITE, 'sitemap.xml'), 'w').write(sm)

# redirecciones 301 desde las URLs de WordPress
redirects = [{"source": old.rstrip('/'), "destination": new, "permanent": True} for old, new in PATHMAP.items()]
redirects += [{"source": old.rstrip('/'), "destination": new, "permanent": False} for old, new in EXCLUDED_OLD.items()]
redirects += [{"source": "/contacto", "destination": "/#auditoria", "permanent": True},
              {"source": "/en/contact", "destination": "/?lang=en#auditoria", "permanent": True}]
json.dump(redirects, open(os.path.join(SITE, 'blog', 'redirects.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(posts), 'posts')
