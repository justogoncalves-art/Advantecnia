"""Construye la web estática completa: blog (vía build_blog), Soluciones, Proyectos, Empresa, FAQ,
sitemap con imágenes y hreflang, robots.txt y llms.txt / llms-full.txt.
Uso: python3 -I build_pages.py <carpeta_datos_blog> <carpeta_web> <snapshots.json>
"""
import sys, os, re, json, html, importlib.util
from datetime import date

SRC, SITE, SNAP = sys.argv[1], sys.argv[2], sys.argv[3]
spec = importlib.util.spec_from_file_location('bb', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_blog.py'))
bb = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0], SRC, SITE]
spec.loader.exec_module(bb)          # genera el blog completo

DOMAIN, esc, S, P, ICON = bb.DOMAIN, bb.esc, bb.S, bb.P, bb.ICON
snap = json.load(open(SNAP))
TODAY = date.today().isoformat()

# ---------- CSS de la app original para las páginas que reutilizan su maquetación ----------
app = open(os.path.join(SITE, '_tools', 'app_full.html')).read()
dc_css = re.search(r'<style>(.*?)</style>', app, re.S).group(1)
dc_css = dc_css.replace('body{padding-bottom:76px}', '')
open(os.path.join(SITE, 'assets', 'dc.css'), 'w').write('/* Estilos base de la web principal (extraídos de index.html) */' + dc_css)

# ---------- Entidad de empresa (GEO) ----------
ORG_ID = DOMAIN + '/#organization'
ORG_FULL = {
    "@type": "Organization", "@id": ORG_ID, "name": "Advantecnia", "url": DOMAIN + '/',
    "logo": {"@type": "ImageObject", "url": f"{DOMAIN}/assets/adv-logo-color.svg"},
    "image": f"{DOMAIN}/assets/img/og-preview.jpg",
    "description": "Fabricante español de sistemas de llamada paciente-enfermera, monitorización sin cámaras y soluciones Smart Hospital impulsadas por Connect.IA, su inteligencia artificial propia.",
    "email": "info@advantecnia.com", "telephone": "+34 637 49 57 57",
    "address": {"@type": "PostalAddress", "streetAddress": "C/ Colada de Pozuelo 20", "postalCode": "28925", "addressLocality": "Alcorcón", "addressRegion": "Madrid", "addressCountry": "ES"},
    "parentOrganization": {"@type": "Organization", "name": "ACE Business Group International SA", "taxID": "A83706721"},
    "areaServed": ["Europa", "Estados Unidos", "Latinoamérica", "Oriente Medio"],
    "knowsAbout": ["Sistemas de llamada paciente-enfermera", "Nurse call systems", "DIN VDE 0834", "Monitorización de pacientes sin cámaras",
                   "Detección de caídas", "Smart Hospital", "Inteligencia artificial hospitalaria", "MQTT", "Megafonía IP", "Gestión de turnos",
                   "Seguridad hospitalaria", "Baños accesibles"],
    "hasCertification": [
        {"@type": "Certification", "name": "ISO 9001:2015 Sistema de Gestión de Calidad"},
        {"@type": "Certification", "name": "UL Hospital Signaling and Nurse Call Equipment (E480716)"},
        {"@type": "Certification", "name": "Marcado CE"}],
    "sameAs": ["https://www.linkedin.com/company/advantecnia/"],
    "contactPoint": {"@type": "ContactPoint", "telephone": "+34 637 49 57 57", "email": "info@advantecnia.com", "contactType": "sales", "availableLanguage": ["es", "en"]},
}

PRODUCTS = {
    'es': [
        ('smartroom', 'SmartRoom', 'Product', 'La habitación que cuida: llamada paciente-enfermera, comunicación, experiencia y acompañamiento del paciente.'),
        ('smartsense', 'SmartSense', 'Product', 'Monitorización sin cámaras y sin contacto: caídas, salidas de cama, respiración y latido, con aviso inmediato al personal.'),
        ('smartflow', 'SmartFlow', 'Product', 'Operación, seguridad y gestión de todas las áreas del hospital: turnos, megafonía, accesos y edificio.'),
        ('smartcore', 'SmartCore', 'Product', 'La plataforma que integra todos los sistemas (Servidor MQTT, más de 200 interfaces) y la red que lo sostiene.'),
        ('connectia', 'Connect.IA', 'SoftwareApplication', 'Inteligencia artificial de Advantecnia que escucha, entiende, actúa y mejora sobre todo el ecosistema SmartHospital.'),
        ('nuria', 'NurIA', 'SoftwareApplication', 'Asistente de voz con IA que atiende las peticiones del paciente las 24 horas sin pulsar nada.'),
    ],
    'en': [
        ('smartroom', 'SmartRoom', 'Product', 'The room that cares: nurse call, communication, patient experience and companionship.'),
        ('smartsense', 'SmartSense', 'Product', 'Camera-free, contactless monitoring: falls, bed exits, breathing and heart rate, with instant alerts to staff.'),
        ('smartflow', 'SmartFlow', 'Product', 'Operations, security and management across the hospital: queues, public address, access and building.'),
        ('smartcore', 'SmartCore', 'Product', 'The platform that integrates every system (MQTT Server, 200+ interfaces) and the network that supports it.'),
        ('connectia', 'Connect.IA', 'SoftwareApplication', 'Advantecnia artificial intelligence that listens, understands, acts and improves across the whole SmartHospital ecosystem.'),
        ('nuria', 'NurIA', 'SoftwareApplication', 'AI voice assistant that handles patient requests 24 hours a day, hands-free.'),
    ]}

# ---------- Preguntas frecuentes (AEO): respuestas directas de 40-70 palabras basadas en el contenido de la web ----------
FAQ = {'es': [
    ('¿Qué es Advantecnia?', 'Advantecnia es una empresa española de ACE Business Group que diseña y fabrica tecnología para hospitales y residencias: sistemas de llamada paciente-enfermera, monitorización sin cámaras, gestión de la operación y red hospitalaria. Su ecosistema SmartHospital está gobernado por Connect.IA, su inteligencia artificial propia, y ya funciona en más de 400 hospitales.'),
    ('¿Qué es Connect.IA?', 'Connect.IA es la inteligencia artificial desarrollada por Advantecnia. A través del Servidor MQTT recoge en tiempo real las señales de habitaciones, sensores, dispositivos y sistemas del hospital, las interpreta con el contexto del paciente y los protocolos del centro, y lleva cada aviso a la persona adecuada en el momento adecuado.'),
    ('¿Qué es un sistema de llamada paciente-enfermera?', 'Es el sistema que permite al paciente pedir ayuda desde la cama, el baño o la habitación y que el aviso llegue al personal de enfermería con su ubicación y prioridad. La familia AdvantCare incluye pulsadores de cama y pera, llamada de emergencia, consola de enfermería VoIP, app móvil y pantallas de pasillo, con alimentación PoE o inalámbrica.'),
    ('¿Se integra con los sistemas que ya tiene el hospital?', 'Sí. Connect.IA y el Servidor MQTT ofrecen más de 200 interfaces: control de accesos, cámaras, localización RTLS, detección de caídas, alarmas de incendio, BMS, domótica y otros sistemas de llamada enfermera como Tunstall, Televic o Austco. No hace falta sustituir lo que ya funciona ni parar el hospital.'),
    ('¿Cómo se monitoriza a los pacientes sin cámaras?', 'Con AdvantSense, que combina sensores de nano-movimiento e inteligencia artificial para detectar caídas, salidas de cama, frecuencia cardíaca y respiratoria y calidad del sueño sin contacto y sin cámaras. Cuando detecta un riesgo avisa automáticamente al personal, respetando la intimidad del paciente y de su familia.'),
    ('¿Qué es NurIA?', 'NurIA es el asistente de voz con inteligencia artificial de Advantecnia. Acompaña al paciente las 24 horas: puede pedir por voz agua, comida, medicación, limpieza, información o una emergencia sin pulsar nada, lo que libera al personal de enfermería de tareas repetitivas para que dedique su tiempo a cuidar.'),
    ('¿Qué certificaciones tiene Advantecnia?', 'Advantecnia está certificada en gestión de la calidad según la norma ISO 9001:2015 y cuenta con certificación UL para equipos de señalización hospitalaria y llamada enfermera (expediente E480716). Sus productos llevan marcado CE y, según el equipo, cumplen CE-EMC, IEC 60601 y FCC. Fabrica en España.'),
    ('¿En qué hospitales trabaja Advantecnia?', 'Advantecnia está presente en más de 400 hospitales, con más de 30.000 habitaciones digitalizadas y más de 10 millones de usuarios al año. Entre sus proyectos están el Hospital Gregorio Marañón y el Hospital Enfermera Isabel Zendal en Madrid, el Hospital de Salamanca y el Nuevo Hospital Cedimat en República Dominicana, además de centros en Latinoamérica e Israel.'),
    ('¿Cómo se implanta un Smart Hospital?', 'Por fases. Primero se hace un diagnóstico del entorno, los procesos y la red; después se diseña la arquitectura; se despliegan SmartRoom y la red; se integra todo con SmartCore y el Servidor MQTT; y en la fase de operación Connect.IA monitoriza y mejora con soporte del equipo de Advantecnia. Se puede empezar por una sola habitación.'),
    ('¿Por dónde empiezo?', 'Solicita una auditoría gratuita. Un asesor experto analiza tu hospital y te muestra qué soluciones pueden llevarlo al siguiente nivel, con prioridades claras y sin compromiso. Respondemos en menos de 24 horas laborables. También puedes escribir a info@advantecnia.com o llamar al +34 637 49 57 57.'),
], 'en': [
    ('What is Advantecnia?', 'Advantecnia is a Spanish company within ACE Business Group that designs and manufactures technology for hospitals and care homes: nurse call systems, camera-free monitoring, operations management and hospital networks. Its SmartHospital ecosystem is governed by Connect.IA, its own artificial intelligence, and already runs in more than 400 hospitals.'),
    ('What is Connect.IA?', 'Connect.IA is the artificial intelligence developed by Advantecnia. Through the MQTT Server it collects real-time signals from rooms, sensors, devices and hospital systems, interprets them with the patient context and the facility protocols, and routes every alert to the right person at the right moment.'),
    ('What is a nurse call system?', 'It is the system that lets a patient ask for help from the bed, the bathroom or the room, so the alert reaches nursing staff with its location and priority. The AdvantCare family includes bed and pear push buttons, emergency call, VoIP nurse console, mobile app and corridor displays, with PoE or wireless power.'),
    ('Does it integrate with the systems the hospital already has?', 'Yes. Connect.IA and the MQTT Server offer more than 200 interfaces: access control, cameras, RTLS location, fall detection, fire alarms, BMS, home automation and other nurse call systems such as Tunstall, Televic or Austco. There is no need to replace what already works or to stop the hospital.'),
    ('How can patients be monitored without cameras?', 'With AdvantSense, which combines nano-movement sensors and artificial intelligence to detect falls, bed exits, heart and breathing rate and sleep quality with no contact and no cameras. When it detects a risk it alerts staff automatically, respecting the privacy of patients and their families.'),
    ('What is NurIA?', 'NurIA is the Advantecnia AI voice assistant. It supports the patient 24 hours a day: they can ask by voice for water, food, medication, cleaning, information or an emergency without pressing anything, which frees nursing staff from repetitive tasks so they can spend their time caring.'),
    ('Which certifications does Advantecnia hold?', 'Advantecnia is certified for quality management under ISO 9001:2015 and holds UL certification for hospital signaling and nurse call equipment (file E480716). Its products carry CE marking and, depending on the device, meet CE-EMC, IEC 60601 and FCC. It manufactures in Spain.'),
    ('Which hospitals does Advantecnia work with?', 'Advantecnia is present in more than 400 hospitals, with more than 30,000 digitised rooms and over 10 million users a year. Projects include Gregorio Marañón Hospital and Isabel Zendal Hospital in Madrid, Salamanca Hospital and the New Cedimat Hospital in the Dominican Republic, plus facilities in Latin America and Israel.'),
    ('How is a Smart Hospital rolled out?', 'In phases. First a diagnosis of the environment, processes and network; then the architecture design; SmartRoom and the network are deployed; everything is integrated with SmartCore and the MQTT Server; and during operation Connect.IA monitors and improves with support from the Advantecnia team. You can start with a single room.'),
    ('Where do I start?', 'Request a free audit. An expert advisor analyses your hospital and shows you which solutions can take it to the next level, with clear priorities and no commitment. We reply within 24 business hours. You can also email info@advantecnia.com or call +34 637 49 57 57.'),
]}
json.dump(FAQ, open(os.path.join(SITE, '_tools', 'faq.json'), 'w'), ensure_ascii=False, indent=1)

def faq_ld(lang, items):
    return {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}

def faq_html(items, open_first=True):
    return '<div class="faq-list">' + ''.join(
        f'<details{" open" if (i == 0 and open_first) else ""}><summary>{esc(q)}{ICON["caret"]}</summary><p>{esc(a)}</p></details>' for i, (q, a) in enumerate(items)) + '</div>'

def crumbs(lang, items):
    home = '/?lang=en' if lang == 'en' else '/'
    li = f'<li><a href="{home}">{S[lang]["home"]}</a></li>' + ''.join(f'<li><a href="{u}">{esc(t)}</a></li>' if u else f'<li aria-current="page">{esc(t)}</li>' for t, u in items)
    return f'<nav aria-label="Breadcrumb"><ol class="crumbs">{li}</ol></nav>'

def crumbs_ld(lang, items):
    el = [{"@type": "ListItem", "position": 1, "name": S[lang]['home'], "item": DOMAIN + '/'}]
    el += [{"@type": "ListItem", "position": i + 2, "name": t, "item": DOMAIN + u} for i, (t, u) in enumerate(items)]
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": el}

SITEMAP = []   # (url, lastmod, priority, {lang: url} alternates, [images])
def write(url, html_text):
    out = os.path.join(SITE, url.strip('/'), 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w').write(html_text)

def page(lang, url, urls, active, title, desc, body, ld, og=None, dc=False, priority='0.8', images=()):
    other = urls['en' if lang == 'es' else 'es']
    alt = [('es', DOMAIN + urls['es']), ('en', DOMAIN + urls['en']), ('x-default', DOMAIN + urls['es'])]
    extra = '<link rel="stylesheet" href="/assets/dc.css">' if dc else ''
    h = bb.head(lang, title, desc, DOMAIN + url, og_img=og, jsonld=ld, alt=alt, extra=extra) + bb.header(lang, other, active, url)
    write(url, h + f'<main id="contenido">\n{body}\n</main>\n' + bb.footer(lang))
    SITEMAP.append((DOMAIN + url, TODAY, priority, {k: DOMAIN + v for k, v in urls.items()}, list(images)))

T = {
    'es': dict(sol_t='Llamada paciente-enfermera y Smart Hospital | Advantecnia',
               sol_d='SmartRoom, SmartSense, SmartFlow y SmartCore: llamada paciente-enfermera, monitorización sin cámaras y operación hospitalaria con la IA Connect.IA.',
               emp_t='Quiénes somos: fabricante de sistemas hospitalarios | Advantecnia',
               emp_d='Advantecnia, de ACE Business Group: más de 20 años fabricando sistemas para hospitales. ISO 9001:2015, certificación UL y presencia en Europa, EEUU y LATAM.',
               pro_t='Proyectos en hospitales y residencias | Advantecnia',
               pro_d='Gregorio Marañón, Isabel Zendal, Salamanca, Cedimat y más: hospitales y residencias que ya usan los sistemas de llamada y Smart Hospital de Advantecnia.',
               pro_es='España', pro_int='Internacional', pro_int_sub='Hospitales y centros médicos en Latinoamérica e Israel.',
               pro_es_sub='Hospitales públicos, privados y residencias.', sist='Sistemas instalados', loc='Ubicación', see='Ver proyecto',
               more_pro='Otros proyectos', faq_t='Preguntas frecuentes sobre Smart Hospital | Advantecnia',
               faq_d='Respuestas sobre sistemas de llamada paciente-enfermera, Connect.IA, NurIA, monitorización sin cámaras, integración, certificaciones y cómo empezar.',
               faq_h1='Preguntas frecuentes', faq_sub='Lo que más nos preguntan los equipos de dirección, ingeniería y enfermería.',
               faq_sec='Preguntas frecuentes', guides='Guías del blog por solución', proj_desc_t='{n}: sistemas instalados por Advantecnia'),
    'en': dict(sol_t='Smart Hospital solutions: nurse call and AI | Advantecnia',
               sol_d='SmartRoom, SmartSense, SmartFlow and SmartCore: nurse call, camera-free patient monitoring and hospital operations powered by Connect.IA.',
               emp_t='About us: hospital systems manufacturer | Advantecnia',
               emp_d='Advantecnia, part of ACE Business Group: over 20 years building hospital systems. ISO 9001:2015, UL certified, present in Europe, USA and LATAM.',
               pro_t='Hospital and care home projects | Advantecnia',
               pro_d='Gregorio Marañón, Isabel Zendal, Salamanca, Cedimat and more: hospitals and care homes already using Advantecnia nurse call and Smart Hospital systems.',
               pro_es='Spain', pro_int='International', pro_int_sub='Hospitals and medical centres in Latin America and Israel.',
               pro_es_sub='Public and private hospitals and care homes.', sist='Installed systems', loc='Location', see='See project',
               more_pro='Other projects', faq_t='FAQ about Advantecnia and Smart Hospital | Advantecnia',
               faq_d='Answers about nurse call systems, Connect.IA, NurIA, camera-free monitoring, integration, certifications and how to get started.',
               faq_h1='Frequently asked questions', faq_sub='What hospital management, engineering and nursing teams ask us most.',
               faq_sec='Frequently asked questions', guides='Blog guides by solution', proj_desc_t='{n}: systems installed by Advantecnia'),
}

def insert_before_last_section(html_text, extra):
    i = html_text.rfind('<section')
    return html_text[:i] + extra + html_text[i:] if i > -1 else html_text + extra

URLS = {
    'sol': {'es': '/soluciones', 'en': '/en/soluciones'},
    'emp': {'es': '/empresa', 'en': '/en/empresa'},
    'pro': {'es': '/proyectos', 'en': '/en/proyectos'},
    'faq': {'es': bb.FAQ_PATH['es'], 'en': bb.FAQ_PATH['en']},
}

for lang in ('es', 'en'):
    t = T[lang]; s = S[lang]
    # ---------- Soluciones ----------
    guides = {k: [p for p in bb.posts if p['lang'] == (lang if bb.EN_BLOG else 'es') and bb.sol_for(p) == k][:4] for k in ('smartroom', 'smartsense', 'smartflow', 'smartcore')}
    guide_html = f'<section class="section" style="background:#fff;padding-top:24px"><div class="wrap"><h2 class="sec">{t["guides"]}</h2><div class="int-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))">' + ''.join(
        f'<div><h3 style="font-size:18px"><a href="#{k}" style="color:#16374D">{bb.SOLS[k][lang][0]}</a></h3><ul style="margin-top:12px;display:grid;gap:10px">' +
        ''.join(f'<li><a href="{p["path"]}" style="font-size:15px;line-height:1.45">{esc(p["titulo"])}</a></li>' for p in guides[k]) + '</ul></div>' for k in guides) + '</div></div></section>'
    faq_sol = FAQ[lang][1:6]
    sol_body = snap[lang]['soluciones']['html'].replace('src="/assets/img/soluciones-hero.webp" alt=""', 'src="/assets/img/soluciones-hero.webp" alt="' + ('Habitación de hospital conectada con el ecosistema SmartHospital' if lang == 'es' else 'Hospital room connected to the SmartHospital ecosystem') + '"')
    sol_body = insert_before_last_section(sol_body,
        f'<section class="section" style="background:#F5F8F9"><div class="wrap faq-wrap"><div><h2 class="sec">{t["faq_sec"]}</h2><p class="sec-sub"><a href="{URLS["faq"][lang]}">{S[lang]["faq"]}</a></p></div>{faq_html(faq_sol)}</div></section>' + guide_html)
    prods = [{"@type": ty, "@id": DOMAIN + URLS['sol'][lang] + '#' + k, "name": n, "description": d, "brand": {"@id": ORG_ID}, "manufacturer": {"@id": ORG_ID},
              "category": "Hospital technology" if lang == 'en' else "Tecnología hospitalaria", "url": DOMAIN + URLS['sol'][lang] + '#' + k}
             | ({"applicationCategory": "HealthApplication", "operatingSystem": "Web, iOS, Android"} if ty == 'SoftwareApplication' else {}) for k, n, ty, d in PRODUCTS[lang]]
    ld = [{"@context": "https://schema.org", "@type": "WebPage", "name": snap[lang]['soluciones']['h1'], "url": DOMAIN + URLS['sol'][lang], "inLanguage": lang,
           "about": {"@id": ORG_ID}, "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": x} for i, x in enumerate(prods)]}},
          faq_ld(lang, faq_sol), crumbs_ld(lang, [(s['sol'], URLS['sol'][lang])])]
    page(lang, URLS['sol'][lang], URLS['sol'], 'sol', t['sol_t'], t['sol_d'], sol_body, ld, dc=True, priority='0.9',
         images=[DOMAIN + '/assets/img/soluciones-hero.webp'])

    # ---------- Empresa ----------
    org = dict(ORG_FULL); org["@context"] = "https://schema.org"
    ld = [{"@context": "https://schema.org", "@type": "AboutPage", "name": snap[lang]['empresa']['h1'], "url": DOMAIN + URLS['emp'][lang], "inLanguage": lang, "mainEntity": {"@id": ORG_ID}},
          org, crumbs_ld(lang, [(s['emp'], URLS['emp'][lang])])]
    page(lang, URLS['emp'][lang], URLS['emp'], 'emp', t['emp_t'], t['emp_d'], snap[lang]['empresa']['html'], ld, dc=True, priority='0.7')

    # ---------- Proyectos ----------
    cards = snap[lang]['proyectos']['cards']
    def pimg(c): return '/' + c['img'] if c['img'] and not c['img'].startswith('/') else c['img']
    def card_es(c):
        img = f'<div class="card-media"><img src="{pimg(c)}" alt="{esc(c["alt"] or c["nombre"])}" loading="lazy"></div>'
        tags = '<ul class="tags">' + ''.join(f'<li>{esc(x)}</li>' for x in c['sist']) + '</ul>' if c['sist'] else ''
        inner = f'{img}<div class="body"><h3>{esc(c["nombre"])}</h3><p class="loc">{esc(c["lugar"])}</p><p>{esc(c["desc"])}</p>{tags}</div>'
        return f'<a class="proj" href="{URLS["pro"][lang]}/{c["slug"]}" data-reveal>{inner}</a>' if c['desc'] else f'<div class="proj" data-reveal>{inner}</div>'
    es_cards = [c for c in cards if c['region'] == 'es']; int_cards = [c for c in cards if c['region'] == 'int']
    body = f'''<section class="page-hero"><div class="wrap">{crumbs(lang, [(s['proy'], None)])}<h1>{esc(snap[lang]['proyectos']['h1'])}</h1><p>{esc(snap[lang]['proyectos']['sub'] or t['pro_d'])}</p></div></section>
<section class="section"><div class="wrap"><h2 class="sec">{t['pro_es']}</h2><p class="sec-sub">{t['pro_es_sub']}</p><div class="proj-grid">{''.join(card_es(c) for c in es_cards)}</div></div></section>
<section class="section" style="background:#F5F8F9"><div class="wrap"><h2 class="sec">{t['pro_int']}</h2><p class="sec-sub">{t['pro_int_sub']}</p><div class="int-grid">{''.join(f'<div data-reveal><div class="card-media"><img src="{pimg(c)}" alt="{esc(c["alt"] or c["nombre"])}" loading="lazy"></div><h3>{esc(c["nombre"])}</h3><p>{esc(c["lugar"])}</p></div>' for c in int_cards)}</div></div></section>
''' + bb.cta_band(lang)
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": snap[lang]['proyectos']['h1'], "url": DOMAIN + URLS['pro'][lang], "inLanguage": lang, "about": {"@id": ORG_ID},
           "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": {"@type": "MedicalOrganization", "name": c['nombre'],
                          "address": {"@type": "PostalAddress", "addressLocality": c['lugar'].split('·')[0].strip()}} | ({"url": f"{DOMAIN}{URLS['pro'][lang]}/{c['slug']}"} if c['desc'] else {})} for i, c in enumerate(cards)]}},
          crumbs_ld(lang, [(s['proy'], URLS['pro'][lang])])]
    page(lang, URLS['pro'][lang], URLS['pro'], 'proy', t['pro_t'], t['pro_d'], body, ld, priority='0.8', images=[DOMAIN + pimg(c) for c in cards if c['img']])
    # fichas con datos reales
    for c in es_cards:
        if not c['desc']: continue
        url = f"{URLS['pro'][lang]}/{c['slug']}"
        urls = {k: f"{URLS['pro'][k]}/{c['slug']}" for k in ('es', 'en')}
        others = [o for o in es_cards if o['desc'] and o['slug'] != c['slug']][:4]
        facts = f'<dl class="facts"><div><dt>{t["loc"]}</dt><dd>{esc(c["lugar"])}</dd></div>' + (f'<div><dt>{t["sist"]}</dt><dd>{"<br>".join(esc(x) for x in c["sist"])}</dd></div>' if c['sist'] else '') + '</dl>'
        body = f'''<section class="page-hero"><div class="wrap">{crumbs(lang, [(s['proy'], URLS['pro'][lang]), (c['nombre'], None)])}<h1>{esc(c['nombre'])}</h1><p>{esc(c['lugar'])}</p></div></section>
<div class="wrap proj-detail"><div class="card-media"><img src="{pimg(c)}" alt="{esc(c['alt'] or c['nombre'])}" fetchpriority="high"></div>
<div><div class="prose"><p>{esc(c['desc'])}</p></div>{facts}<a class="btn" style="margin-top:32px" href="/{'?lang=en' if lang == 'en' else ''}#auditoria">{s['cta_btn']}</a></div></div>
<section class="section" style="background:#F5F8F9"><div class="wrap"><h2 class="sec">{t['more_pro']}</h2><div class="proj-grid">{''.join(card_es(o) for o in others)}</div></div></section>
''' + bb.cta_band(lang)
        desc = bb.trunc(f"{c['nombre']} ({c['lugar']}). {c['desc']}", 158)
        ld = [{"@context": "https://schema.org", "@type": "WebPage", "name": t['proj_desc_t'].format(n=c['nombre']), "url": DOMAIN + url, "inLanguage": lang, "description": desc,
               "about": {"@type": "MedicalOrganization", "name": c['nombre'], "address": {"@type": "PostalAddress", "addressLocality": c['lugar'].split('·')[0].strip()}},
               "mentions": [{"@type": "Product", "name": x, "manufacturer": {"@id": ORG_ID}} for x in c['sist']], "publisher": {"@id": ORG_ID},
               "primaryImageOfPage": DOMAIN + pimg(c)},
              crumbs_ld(lang, [(s['proy'], URLS['pro'][lang]), (c['nombre'], url)])]
        page(lang, url, urls, 'proy', bb.page_title(c['nombre'] if lang == 'es' else c['nombre'] + ' project'), desc, body, ld, og=DOMAIN + pimg(c), priority='0.6', images=[DOMAIN + pimg(c)])

    # ---------- Preguntas frecuentes ----------
    body = f'''<section class="page-hero"><div class="wrap">{crumbs(lang, [(s['faq'], None)])}<h1>{t['faq_h1']}</h1><p>{t['faq_sub']}</p></div></section>
<section class="section"><div class="wrap">{faq_html(FAQ[lang], open_first=False).replace('<details>', '<details open>')}</div></section>
''' + bb.cta_band(lang)
    ld = [faq_ld(lang, FAQ[lang]), crumbs_ld(lang, [(s['faq'], URLS['faq'][lang])])]
    page(lang, URLS['faq'][lang], URLS['faq'], 'faq', t['faq_t'], t['faq_d'], body, ld, priority='0.7')

# ---------- Sitemap completo (hreflang + imágenes) ----------
SITEMAP.insert(0, (DOMAIN + '/', TODAY, '1.0', {'es': DOMAIN + '/', 'en': DOMAIN + '/?lang=en'}, [DOMAIN + '/assets/img/pasted-1790001338829-0.webp']))
for l in bb.BLOG_LANGS:
    SITEMAP.append((DOMAIN + P(l) + '/blog', bb.posts[0]['fecha'][:10], '0.8', {'es': DOMAIN + '/blog', 'en': DOMAIN + '/en/blog'} if bb.EN_BLOG else {}, []))
    for k in bb.CAT_NAMES[l]:
        SITEMAP.append((DOMAIN + bb.cat_url(l, k), TODAY, '0.6', {'es': DOMAIN + bb.cat_url('es', k), 'en': DOMAIN + bb.cat_url('en', k)} if bb.EN_BLOG else {}, []))
for p in bb.posts:
    imgs = ([DOMAIN + p['hero'][0]] if p['hero'] else [])
    SITEMAP.append((DOMAIN + p['path'], p['modificado'][:10], '0.7' if p['lang'] == 'es' else '0.5', {}, imgs))
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
for u, d, pr, alts, imgs in SITEMAP:
    x = f'  <url><loc>{html.escape(u)}</loc><lastmod>{d}</lastmod><priority>{pr}</priority>'
    x += ''.join(f'<xhtml:link rel="alternate" hreflang="{k}" href="{html.escape(v)}"/>' for k, v in alts.items())
    x += ''.join(f'<image:image><image:loc>{html.escape(i)}</image:loc></image:image>' for i in imgs)
    sm.append(x + '</url>')
sm.append('</urlset>')
open(os.path.join(SITE, 'sitemap.xml'), 'w').write('\n'.join(sm) + '\n')

# ---------- robots.txt: buscadores y rastreadores de IA permitidos ----------
bots = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User',
        'Google-Extended', 'Applebot', 'Applebot-Extended', 'DuckAssistBot', 'meta-externalagent', 'Amazonbot', 'CCBot']
robots = '# Buscadores y asistentes de IA pueden leer todo el contenido público\n'
robots += ''.join(f'User-agent: {b}\n' for b in bots) + 'Allow: /\nDisallow: /dashboard\nDisallow: /api/\n\n'
robots += 'User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /api/\n\nSitemap: https://advantecnia.com/sitemap.xml\n'
open(os.path.join(SITE, 'robots.txt'), 'w').write(robots)

# ---------- llms.txt y llms-full.txt (GEO) ----------
es_posts = [p for p in bb.posts if p['lang'] == 'es']
L = ['# Advantecnia', '',
     '> Fabricante español (ACE Business Group) de sistemas de llamada paciente-enfermera, monitorización de pacientes sin cámaras y soluciones Smart Hospital gobernadas por Connect.IA, su inteligencia artificial propia. Más de 400 hospitales, más de 30.000 habitaciones digitalizadas, más de 20 años de experiencia.', '',
     'Datos clave:',
     '- Sede: C/ Colada de Pozuelo 20, 28925 Alcorcón (Madrid), España. Contacto: info@advantecnia.com, +34 637 49 57 57.',
     '- Certificaciones: ISO 9001:2015; UL Hospital Signaling and Nurse Call Equipment (E480716); marcado CE; según producto CE-EMC, IEC 60601 y FCC.',
     '- Presencia: Europa, Estados Unidos, Latinoamérica y Oriente Medio.',
     '- Familias de producto: SmartRoom (habitación y llamada paciente-enfermera), SmartSense (monitorización sin cámaras), SmartFlow (operación y seguridad), SmartCore (plataforma de integración y red). IA: Connect.IA y NurIA (asistente de voz).', '',
     '## Páginas principales',
     f'- [Inicio]({DOMAIN}/): propuesta de valor, cifras y auditoría gratuita',
     f'- [Soluciones]({DOMAIN}/soluciones): SmartRoom, SmartSense, SmartFlow, SmartCore, Connect.IA y NurIA',
     f'- [Proyectos]({DOMAIN}/proyectos): hospitales y residencias donde están instalados los sistemas',
     f'- [Empresa]({DOMAIN}/empresa): quiénes somos, certificaciones y áreas de especialidad',
     f'- [Preguntas frecuentes]({DOMAIN}/preguntas-frecuentes): respuestas directas sobre productos, integración y certificaciones',
     f'- [Blog]({DOMAIN}/blog): {len(es_posts)} guías sobre comunicación asistencial, seguridad y gestión hospitalaria',
     f'- [English version]({DOMAIN}/en/soluciones)', '',
     '## Guías destacadas del blog']
for kw in ['sistema-de-llamada-paciente-enfermera', 'din-vde-0834', 'banos-accesibles', 'llamador-de-enfermeria-en-residencias', 'llamador-de-enfermeria-inalambrico',
           'habitacion-inteligente', 'smart-room', 'inteligencia-artificial-en-hospitales', 'monitorizacion-de-pacientes', 'seguridad-hospitalaria', 'sistema-de-gestion-de-turnos', 'que-es-la-comunicacion-asistencial']:
    for p in es_posts:
        if kw in p['slug']:
            L.append(f'- [{p["titulo"]}]({DOMAIN}{p["path"]}): {p["seo_desc"]}'); break
L += ['', '## Optional', f'- [Texto completo para modelos de lenguaje]({DOMAIN}/llms-full.txt)', f'- [Sitemap]({DOMAIN}/sitemap.xml)']
open(os.path.join(SITE, 'llms.txt'), 'w').write('\n'.join(L) + '\n')

F = ['# Advantecnia: información completa', '', L[2], '']
F += ['## Preguntas frecuentes', ''] + [f'### {q}\n{a}\n' for q, a in FAQ['es']]
F += ['## Soluciones', ''] + [f'### {n}\n{d}\n' for k, n, ty, d in PRODUCTS['es']]
F += ['## Proyectos', ''] + [f'- {c["nombre"]} ({c["lugar"]})' + (f': {c["desc"]}' if c['desc'] else '') + (f' Sistemas: {", ".join(c["sist"])}.' if c['sist'] else '') for c in snap['es']['proyectos']['cards']]
F += ['', '## Artículos del blog (español)', ''] + [f'- [{p["titulo"]}]({DOMAIN}{p["path"]}) ({p["fecha"][:10]}): {p["seo_desc"]}' for p in es_posts]
if bb.EN_BLOG: F += ['', '## Blog articles (English)', ''] + [f'- [{p["titulo"]}]({DOMAIN}{p["path"]}) ({p["fecha"][:10]}): {p["seo_desc"]}' for p in bb.posts if p['lang'] == 'en']
open(os.path.join(SITE, 'llms-full.txt'), 'w').write('\n'.join(F) + '\n')

# redirecciones del blog + rutas antiguas de la app a las nuevas páginas
red = json.load(open(os.path.join(SITE, 'blog', 'redirects.json')))
os.remove(os.path.join(SITE, 'blog', 'redirects.json'))
vj = json.load(open(os.path.join(SITE, 'vercel.json')))
vj['redirects'] = [r for r in vj.get('redirects', []) if 'has' in r] + red
json.dump(vj, open(os.path.join(SITE, 'vercel.json'), 'w'), ensure_ascii=False, indent=2)
print('páginas', len(SITEMAP), 'urls en sitemap')
