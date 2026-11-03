"""Ajustes SEO/GEO/AEO sobre index.html (app DC): enlaces reales a las páginas estáticas,
quita las páginas que ahora son estáticas, FAQ con schema, title/description y entidad."""
import json, re, sys
SITE = sys.argv[1]
f = SITE + '/index.html'
s = open(f).read()
FAQ = json.load(open(SITE + '/_tools/faq.json'))

def rep(old, new, n=1):
    global s
    assert s.count(old) >= 1, old[:90]
    s = s.replace(old, new, n)

# 1) Botones de navegación -> enlaces rastreables
HREF = {'nav.proyectos': 'proyHref', 'nav.empresa': 'empHref', 'goSoluciones': 'solHref'}
def conv(m):
    tgt = HREF[m.group(2)]
    return f'<a href="{{{{ {tgt} }}}}" style="{m.group(3)};text-decoration:none"{m.group(4)}>{m.group(5)}</a>'
s, n = re.subn(r'<button( type="button")? onClick="\{\{ (nav\.proyectos|nav\.empresa|goSoluciones) \}\}" style="([^"]*)"([^>]*)>(.*?)</button>', conv, s)
print('botones convertidos', n)
s, n = re.subn(r'<div role="link" tabIndex="0" onClick="\{\{ goFam\.(\w+) \}\}" style="([^"]*)"([^>]*)>(.*?Descúbrelo.*?</span>\s*)</div>',
               lambda m: f'<a href="{{{{ famHref.{m.group(1)} }}}}" style="{m.group(2)};text-decoration:none;color:inherit"{m.group(3)}>{m.group(4)}</a>', s, flags=re.S)
print('tarjetas de familia convertidas', n)

# 2) Quitar de la app las páginas que ahora son estáticas (Empresa, Soluciones, Proyectos, Ficha)
a = s.index('<sc-if value="{{ isEmpresa }}"'); b = s.index('<sc-if value="{{ isLegal }}">')
s = s[:a] + s[b:]

# 3) Lógica: rutas a páginas estáticas
rep("  go(p) {\n", "  go(p) {\n    const st = Component.STATIC_URL[p];\n    if (st && typeof window !== 'undefined') { window.location.href = (this.state.lang === 'en' ? '/en' : '') + st; return; }\n")
rep("      } else if (['soluciones', 'proyectos', 'empresa'].indexOf(pg) > -1) this.setState({ page: pg });",
    "      } else if (Component.STATIC_URL[pg]) { window.location.replace((L === 'en' ? '/en' : '') + Component.STATIC_URL[pg] + u.hash); return; }")
rep("      blogHref: en ? '/en/blog' : '/blog',",
    "      blogHref: en ? '/en/blog' : '/blog',\n"
    "      solHref: (en ? '/en' : '') + '/soluciones',\n"
    "      proyHref: (en ? '/en' : '') + '/proyectos',\n"
    "      empHref: (en ? '/en' : '') + '/empresa',\n"
    "      faqHref: en ? '/en/faq' : '/preguntas-frecuentes',\n"
    "      famHref: { room: (en ? '/en' : '') + '/soluciones#smartroom', sense: (en ? '/en' : '') + '/soluciones#smartsense', flow: (en ? '/en' : '') + '/soluciones#smartflow', core: (en ? '/en' : '') + '/soluciones#smartcore' },")
rep("Component.BLOG = ", "Component.STATIC_URL = { soluciones: '/soluciones', proyectos: '/proyectos', empresa: '/empresa', ficha: '/proyectos' };\n\nComponent.BLOG = ")

# 4) Title y description dentro de los límites (<=60 / <=160)
rep('<title>Advantecnia | Sistemas de llamada paciente-enfermera y Smart Hospital con IA</title>',
    '<title>Sistemas de llamada paciente-enfermera con IA | Advantecnia</title>')
desc = 'Llamada paciente-enfermera, monitorización sin cámaras y Smart Hospital con Connect.IA, nuestra IA propia. Más de 400 hospitales confían en Advantecnia.'
assert len(desc) <= 160, len(desc)
s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', s, count=1)
s = s.replace('<meta property="og:title" content="Advantecnia - Impulsado por Connect.IA">', '<meta property="og:title" content="Sistemas de llamada paciente-enfermera con IA | Advantecnia">')
s = s.replace('<meta property="og:description" content="La inteligencia que lleva tu hospital al siguiente nivel">', f'<meta property="og:description" content="{desc}">')
s = s.replace('<meta name="twitter:description" content="La inteligencia que lleva tu hospital al siguiente nivel">', f'<meta name="twitter:description" content="{desc}">')
s = s.replace('<meta property="og:url"', '<meta property="og:url"')
if 'og:url' not in s:
    s = s.replace('<meta property="og:locale" content="es_ES">', '<meta property="og:locale" content="es_ES">\n<meta property="og:locale:alternate" content="en_US">\n<meta property="og:url" content="https://advantecnia.com/">')

# 5) Entidad con @id + FAQPage en la cabecera
m = re.search(r'<script type="application/ld\+json">(\{"@context": "https://schema.org", "@type": "Organization".*?)</script>', s)
org = json.loads(m.group(1))
org["@id"] = "https://advantecnia.com/#organization"
org["hasCertification"] = [{"@type": "Certification", "name": "ISO 9001:2015 Sistema de Gestión de Calidad"},
                           {"@type": "Certification", "name": "UL Hospital Signaling and Nurse Call Equipment (E480716)"},
                           {"@type": "Certification", "name": "Marcado CE"}]
org["knowsAbout"] = ["Sistemas de llamada paciente-enfermera", "Monitorización de pacientes sin cámaras", "Smart Hospital", "Inteligencia artificial hospitalaria", "DIN VDE 0834", "MQTT"]
org["areaServed"] = ["Europa", "Estados Unidos", "Latinoamérica", "Oriente Medio"]
faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "es",
          "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ['es'][:6]]}
s = s.replace(m.group(0), f'<script type="application/ld+json">{json.dumps(org, ensure_ascii=False)}</script>\n<script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>')
rep('<meta name="theme-color" content="#16374D">', '<meta name="theme-color" content="#16374D">\n<meta name="robots" content="index, follow, max-image-preview:large">\n<link rel="alternate" type="text/plain" title="LLMs" href="/llms.txt">')

# 6) Sección de preguntas frecuentes en la home (texto en el HTML de origen: visible para rastreadores sin JS)
chev = '<svg width="18" height="18" viewBox="0 0 256 256" fill="#0E8C99" aria-hidden="true" style="flex:none;transition:transform 200ms cubic-bezier(.23,1,.32,1)"><path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z"></path></svg>'
items = ''.join(
    f'''          <details{' open=""' if i == 0 else ''} style="border-bottom:1px solid #E3E9EA">
            <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;font-size:18px;font-weight:700;line-height:1.4;color:#16374D">{q}{chev}</summary>
            <p style="padding:0 0 22px;font-size:17px;line-height:1.7;color:#55636E;max-width:70ch">{a}</p>
          </details>
''' for i, (q, a) in enumerate(FAQ['es'][:6]))
section = f'''  <section id="adv2-faq" data-rise="" style="background:#fff">
    <div id="adv-faq-grid" style="max-width:1240px;margin:0 auto;padding:104px 24px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr);gap:56px">
      <div>
        <h2 style="font-size:clamp(28px,3.2vw,40px);line-height:1.15;letter-spacing:-.02em;font-weight:800;color:#16374D;text-wrap:balance">Preguntas frecuentes</h2>
        <p style="margin-top:14px;font-size:18px;line-height:1.6;color:#55636E">Lo que más nos preguntan los equipos de dirección, ingeniería y enfermería.</p>
        <a href="{{{{ faqHref }}}}" data-track="Home: ver FAQ" style="margin-top:22px;display:inline-flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#0E8C99;text-decoration:none" style-hover="color:#0A6B75">Ver todas las preguntas</a>
      </div>
      <div>
{items}      </div>
    </div>
  </section>

'''
rep('  <section id="adv2-auditoria"', section + '  <section id="adv2-auditoria"')
rep('  ::selection{background:#BDEAEE;color:#0F2A3C}',
    '  ::selection{background:#BDEAEE;color:#0F2A3C}\n'
    '  #adv2-faq summary::-webkit-details-marker{display:none}\n'
    '  #adv2-faq details[open] summary svg{transform:rotate(180deg)}\n'
    '  @media (max-width:900px){ #adv-faq-grid{grid-template-columns:1fr !important;gap:24px !important} }')

# 7) Traducciones EN de los textos nuevos
dict_add = {'Preguntas frecuentes': 'Frequently asked questions',
            'Lo que más nos preguntan los equipos de dirección, ingeniería y enfermería.': 'What hospital management, engineering and nursing teams ask us most.',
            'Ver todas las preguntas': 'See all questions'}
for (qe, ae), (qn, an) in zip(FAQ['es'][:6], FAQ['en'][:6]):
    dict_add[qe] = qn; dict_add[ae] = an
add = ''.join(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},\n' for k, v in dict_add.items())
rep('Component.DICT = {\n', 'Component.DICT = {\n' + add)
open(f, 'w').write(s)
print('ok', len(s))
