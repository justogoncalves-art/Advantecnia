import json, sys, re
SITE = sys.argv[1]
f = SITE + '/index.html'
s = open(f).read()
latest = json.load(open(SITE + '/blog/latest.json'))

def rep(old, new, count=1):
    global s
    assert s.count(old) >= 1, old[:80]
    s = s.replace(old, new, count)

# A) SEO de la cabecera
rep('<html>', '<html lang="es">')
rep('<title>Advantecnia - Impulsado por Connect.IA</title>\n<meta name="description" content="La inteligencia que lleva tu hospital al siguiente nivel">',
    '<title>Advantecnia | Sistemas de llamada paciente-enfermera y Smart Hospital con IA</title>\n'
    '<meta name="description" content="Sistemas de llamada paciente-enfermera, monitorización sin cámaras y gestión hospitalaria con Connect.IA, nuestra inteligencia artificial. Más de 400 hospitales y 30.000 habitaciones conectadas.">\n'
    '<link rel="canonical" href="https://advantecnia.com/">\n'
    '<link rel="alternate" hreflang="es" href="https://advantecnia.com/">\n'
    '<link rel="alternate" hreflang="en" href="https://advantecnia.com/?lang=en">\n'
    '<link rel="alternate" hreflang="x-default" href="https://advantecnia.com/">\n'
    '<meta name="theme-color" content="#16374D">\n'
    '<link rel="icon" href="assets/adv-logo-color.svg" type="image/svg+xml">')
org = {
  "@context": "https://schema.org", "@type": "Organization", "name": "Advantecnia", "url": "https://advantecnia.com/",
  "logo": "https://advantecnia.com/assets/adv-logo-color.svg",
  "description": "Fabricante español de sistemas de llamada paciente-enfermera, monitorización sin cámaras y soluciones Smart Hospital impulsadas por la inteligencia artificial Connect.IA.",
  "email": "info@advantecnia.com", "telephone": "+34 637 49 57 57",
  "address": {"@type": "PostalAddress", "streetAddress": "C/ Colada de Pozuelo 20", "postalCode": "28925", "addressLocality": "Alcorcón", "addressRegion": "Madrid", "addressCountry": "ES"},
  "parentOrganization": {"@type": "Organization", "name": "ACE Business Group International SA"},
  "sameAs": ["https://www.linkedin.com/company/advantecnia/"],
  "contactPoint": {"@type": "ContactPoint", "telephone": "+34 637 49 57 57", "contactType": "sales", "availableLanguage": ["es", "en"]}
}
site = {"@context": "https://schema.org", "@type": "WebSite", "name": "Advantecnia", "url": "https://advantecnia.com/", "inLanguage": ["es", "en"]}
rep('<meta name="twitter:image" content="https://advantecnia.com/assets/img/og-preview.jpg">',
    '<meta name="twitter:image" content="https://advantecnia.com/assets/img/og-preview.jpg">\n'
    f'<script type="application/ld+json">{json.dumps(org, ensure_ascii=False)}</script>\n'
    f'<script type="application/ld+json">{json.dumps(site, ensure_ascii=False)}</script>')

# Estilos: superficies del navegador y bloque del blog en móvil
rep('  @media (max-width:1059px){ #adv-mainnav{display:none !important}',
    '  ::selection{background:#BDEAEE;color:#0F2A3C}\n'
    '  :focus-visible{outline:2px solid #0E8C99;outline-offset:3px}\n'
    '  .adv-blog-img img{transition:transform 700ms var(--ease-out)}\n'
    '  .adv-blog-card:hover .adv-blog-img img{transform:scale(1.045)}\n'
    '  .adv-blog-card:hover h3{color:#0A6B75 !important}\n'
    '  @media (max-width:900px){ #adv-blog-grid{grid-template-columns:1fr !important} }\n'
    '  @media (max-width:520px){ .adv-blog-side{grid-template-columns:112px minmax(0,1fr) !important;gap:16px !important} }\n'
    '  @media (prefers-reduced-motion: reduce){ .adv-blog-img img{transition:none} }\n'
    '  @media (max-width:1059px){ #adv-mainnav{display:none !important}')

# B) Menú principal: enlace al blog
emp_btn = re.search(r'      <button onClick="\{\{ nav\.empresa \}\}"[^\n]*</button>\n', s).group(0)
rep(emp_btn, emp_btn + '      <a href="{{ blogHref }}" data-track="Nav: Blog" style="position:relative;padding:8px 0;font-size:15px;font-weight:600;color:{{ barInk }};text-decoration:none" style-hover="opacity:.72">Blog</a>\n')

# C) Pie: enlace al blog
foot_emp = re.search(r'        <li><button onClick="\{\{ nav\.empresa \}\}"[^\n]*</li>\n', s).group(0)
rep(foot_emp, foot_emp + '        <li><a href="{{ blogHref }}" style="font-size:15px;color:#C4D6DF" style-hover="color:#fff">Blog</a></li>\n')

# D) Sección del blog en la home, antes del formulario
arrow = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h13M12.5 6l5.5 6-5.5 6"></path></svg>'
section = f'''  <section id="adv2-blog" data-rise="" style="background:#F5F8F9">
    <div style="max-width:1240px;margin:0 auto;padding:104px 24px">
      <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px 40px">
        <div style="max-width:640px">
          <h2 style="font-size:clamp(28px,3.2vw,40px);line-height:1.15;letter-spacing:-.02em;font-weight:800;color:#16374D;text-wrap:balance">Ideas para un hospital que cuida mejor.</h2>
          <p style="margin-top:14px;font-size:18px;line-height:1.6;color:#55636E;text-wrap:pretty">Comunicación asistencial, seguridad y gestión hospitalaria, explicadas por nuestro equipo.</p>
        </div>
        <a href="{{{{ blogHref }}}}" data-track="Home: ver blog" style="display:inline-flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#0E8C99;text-decoration:none" style-hover="color:#0A6B75">Ver todos los artículos{arrow}</a>
      </div>
      <div id="adv-blog-grid" style="margin-top:44px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:40px">
        <sc-for list="{{{{ blogFeat }}}}" as="b" hint-placeholder-count="1">
          <a class="adv-blog-card" href="{{{{ b.u }}}}" style="display:flex;flex-direction:column;gap:14px;color:inherit;text-decoration:none">
            <div class="adv-blog-img" style="position:relative;aspect-ratio:16/10;border-radius:20px;overflow:hidden;background:#E7F1F2"><img src="{{{{ b.img }}}}" alt="{{{{ b.alt }}}}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
            <p style="margin-top:6px;font-size:13px;font-weight:700;color:#0E8C99">{{{{ b.c }}}}</p>
            <h3 style="font-size:clamp(22px,2.2vw,28px);line-height:1.2;letter-spacing:-.015em;font-weight:800;color:#16374D;text-wrap:balance;transition:color 170ms ease">{{{{ b.t }}}}</h3>
            <p style="font-size:14px;color:#6B7B86">{{{{ b.d }}}} · {{{{ b.m }}}}</p>
          </a>
        </sc-for>
        <div style="display:grid;gap:32px;align-content:start">
          <sc-for list="{{{{ blogRest }}}}" as="b" hint-placeholder-count="2">
            <a class="adv-blog-card adv-blog-side" href="{{{{ b.u }}}}" style="display:grid;grid-template-columns:168px minmax(0,1fr);gap:22px;align-items:start;color:inherit;text-decoration:none;padding-bottom:32px;border-bottom:1px solid #E3E9EA">
              <div class="adv-blog-img" style="position:relative;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:#E7F1F2"><img src="{{{{ b.img }}}}" alt="{{{{ b.alt }}}}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <p style="font-size:13px;font-weight:700;color:#0E8C99">{{{{ b.c }}}}</p>
                <h3 style="font-size:18px;line-height:1.3;font-weight:800;color:#16374D;text-wrap:balance;transition:color 170ms ease">{{{{ b.t }}}}</h3>
                <p style="font-size:14px;color:#6B7B86">{{{{ b.d }}}}</p>
              </div>
            </a>
          </sc-for>
        </div>
      </div>
    </div>
  </section>

'''
rep('  <section id="adv2-auditoria"', section + '  <section id="adv2-auditoria"')

# E) Valores de render
rep("      goSoluciones: () => this.go('soluciones'),",
    "      goSoluciones: () => this.go('soluciones'),\n"
    "      blogHref: en ? '/en/blog' : '/blog',\n"
    "      blogFeat: (Component.BLOG[en ? 'en' : 'es'] || []).slice(0, 1),\n"
    "      blogRest: (Component.BLOG[en ? 'en' : 'es'] || []).slice(1, 3),")

# F) Enlaces directos: ?lang=en, ?p=soluciones|proyectos|empresa|legal&t=..., #auditoria
rep("  componentDidMount() {\n    this.applyLang();",
    "  componentDidMount() {\n"
    "    try {\n"
    "      const u = new URL(window.location.href);\n"
    "      const L = u.searchParams.get('lang');\n"
    "      if (L === 'en' || L === 'es') this.setState({ lang: L });\n"
    "      const pg = u.searchParams.get('p');\n"
    "      if (pg === 'legal') {\n"
    "        const t = u.searchParams.get('t');\n"
    "        this.setState({ page: 'legal', legalTab: ({ privacidad: 'priv', priv: 'priv', cookies: 'cook', cook: 'cook' })[t] || 'aviso' });\n"
    "      } else if (['soluciones', 'proyectos', 'empresa'].indexOf(pg) > -1) this.setState({ page: pg });\n"
    "      if (u.hash === '#auditoria') setTimeout(() => this.jump('adv2-auditoria'), 450);\n"
    "      else if (u.hash === '#blog') setTimeout(() => this.jump('adv2-blog'), 450);\n"
    "    } catch (e) {}\n"
    "    this.applyLang();")

# G) Datos del blog y traducciones
rep('Component.ECO = [', 'Component.BLOG = ' + json.dumps(latest, ensure_ascii=False) + ';\n\nComponent.ECO = [')
rep('  "Ver todos los proyectos →": "See all projects →",',
    '  "Ver todos los proyectos →": "See all projects →",\n'
    '  "Ideas para un hospital que cuida mejor.": "Ideas for a hospital that cares better.",\n'
    '  "Comunicación asistencial, seguridad y gestión hospitalaria, explicadas por nuestro equipo.": "Assistance communication, security and hospital management, explained by our team.",\n'
    '  "Ver todos los artículos": "See all articles",')
open(f, 'w').write(s)
print('patched')
