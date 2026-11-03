import glob, re, json, os, sys, html, collections
from bs4 import BeautifulSoup
root = sys.argv[1]
files = [f for f in glob.glob(root + '/**/index.html', recursive=True) if '/_tools/' not in f]
R = []
for f in files:
    s = open(f).read()
    url = '/' + os.path.relpath(os.path.dirname(f), root).replace('.', '').strip('/')
    soup = BeautifulSoup(s, 'html.parser')
    title = (soup.title.string or '').strip() if soup.title else ''
    d = soup.find('meta', attrs={'name': 'description'}); desc = d['content'] if d else ''
    lds = []
    for sc in soup.find_all('script', type='application/ld+json'):
        try:
            j = json.loads(sc.string); lds.append(j.get('@type'))
        except Exception as e: lds.append('ERROR')
    imgs = soup.find_all('img'); noalt = [i for i in imgs if not (i.get('alt') or '').strip()]
    text = soup.get_text(' ', strip=True)
    R.append(dict(url=url.replace('//', '/'), title=title, tl=len(title), dl=len(desc), h1=len(soup.find_all('h1')),
                  canon=bool(soup.find('link', rel='canonical')), hreflang=len(soup.find_all('link', hreflang=True)),
                  og=bool(soup.find('meta', property='og:image')), ld=lds, imgs=len(imgs), noalt=len(noalt), words=len(text.split()),
                  qh=len([h for h in soup.find_all(['h2', 'h3']) if '?' in h.get_text()])))
tot = len(R)
dup = [t for t, c in collections.Counter(r['title'] for r in R).items() if c > 1]
types = collections.Counter(t for r in R for t in r['ld'])
summary = dict(pages=tot, title_ok=sum(30 <= r['tl'] <= 65 for r in R), title_long=sum(r['tl'] > 65 for r in R), desc_ok=sum(70 <= r['dl'] <= 160 for r in R),
               desc_long=sum(r['dl'] > 160 for r in R), desc_short=sum(r['dl'] < 70 for r in R), h1_one=sum(r['h1'] == 1 for r in R), canon=sum(r['canon'] for r in R),
               og=sum(r['og'] for r in R), imgs=sum(r['imgs'] for r in R), noalt=sum(r['noalt'] for r in R), dup_titles=len(dup), schema_types=dict(types),
               ld_errors=types.get('ERROR', 0), avg_words=round(sum(r['words'] for r in R) / tot), faq_pages=sum('FAQPage' in r['ld'] for r in R))
print(json.dumps(summary, ensure_ascii=False, indent=1))
print('h1 !=1:', [(r['url'], r['h1']) for r in R if r['h1'] != 1][:10])
print('title >65:', [(r['url'], r['tl']) for r in R if r['tl'] > 65][:10])
print('desc >160:', [(r['url'], r['dl']) for r in R if r['dl'] > 160][:5])
print('dup titles:', dup[:5])
json.dump(dict(summary=summary, pages=R), open(sys.argv[2], 'w'), ensure_ascii=False)
