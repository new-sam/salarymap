# -*- coding: utf-8 -*-
# Stage 2+3: company_id -> homepage (Wanted detail) -> scrape email
import urllib.request, json, re, time, csv, sys, ssl

UA = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Accept':'*/*'}
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
BAD = ('example.','sentry','wixpress','wix.com','schema.org','w3.org','.png','.jpg','.jpeg','.gif',
       'godaddy','cloudflare','your','email@','test@','noreply','no-reply','domain.com','sample',
       'react','vue','angular','jquery','googleapis','gstatic','adobe','font')

def fetch(url, timeout=8, asjson=False):
    req = urllib.request.Request(url, headers=UA)
    r = urllib.request.urlopen(req, timeout=timeout, context=ctx)
    raw = r.read()
    return json.loads(raw) if asjson else raw.decode('utf-8','ignore')

def homepage_of(cid):
    for u in (f'https://www.wanted.co.kr/api/chaos/companies/v1/{cid}',
              f'https://www.wanted.co.kr/api/v4/companies/{cid}'):
        try:
            d = fetch(u, asjson=True)
            s = json.dumps(d, ensure_ascii=False)
            m = re.search(r'"link"\s*:\s*"([^"]+)"', s)
            if m and '.' in m.group(1):
                link = m.group(1)
                if not link.startswith('http'): link = 'http://'+link
                return link
        except Exception:
            continue
    return ''

def clean_emails(text, domain=''):
    found = set()
    for e in EMAIL_RE.findall(text):
        el = e.lower()
        if any(b in el for b in BAD): continue
        if len(el) > 60: continue
        found.add(el)
    if not found: return ''
    # prefer email matching company domain
    if domain:
        dom = domain.replace('www.','')
        for e in found:
            if e.split('@')[1].replace('www.','') in dom or dom in e.split('@')[1]:
                return e
    # prefer info/contact/hr/sales/help
    for pref in ('contact','info','hello','hr','recruit','sales','help','support','master','admin'):
        for e in found:
            if e.split('@')[0].startswith(pref): return e
    return sorted(found, key=len)[0]

def email_for(homepage):
    if not homepage: return '',''
    base = homepage.rstrip('/')
    domain = re.sub(r'^https?://','',base).split('/')[0]
    paths = ['', '/contact']
    for p in paths:
        try:
            html = fetch(base+p, timeout=5)
            em = clean_emails(html, domain)
            if em: return em, domain
        except Exception:
            continue
    return '', domain

import os
def run(infile, outfile, chunk=None):
    allrows = list(csv.DictReader(open(infile, encoding='utf-8-sig')))
    done = set()
    header = True
    if os.path.exists(outfile):
        ex = list(csv.reader(open(outfile, encoding='utf-8-sig')))
        if ex:
            header = False
            for r in ex[1:]:
                if r: done.add(r[0])
    todo = [c for c in allrows if c['company_id'] not in done]
    remaining_total = len(todo)
    if chunk: todo = todo[:chunk]
    out = open(outfile, 'a', newline='', encoding='utf-8-sig')
    w = csv.writer(out)
    if header:
        w.writerow(['company_id','회사명','직무군','대표포지션','지역','연차','도메인','이메일'])
    got_dom=got_mail=0
    for i,c in enumerate(todo,1):
        hp = homepage_of(c['company_id'])
        em, dom = email_for(hp) if hp else ('','')
        if dom: got_dom+=1
        if em: got_mail+=1
        w.writerow([c['company_id'],c['회사명'],c['직무군'],c['대표포지션'],c['지역'],c['연차'],dom,em])
        if i % 25 == 0:
            out.flush(); print(f'{i}/{len(todo)} (이번청크)  +도메인 {got_dom}  +이메일 {got_mail}', flush=True)
        time.sleep(0.1)
    out.close()
    print(f'CHUNK DONE: 처리 {len(todo)}  +이메일 {got_mail}  | 이미완료 {len(done)}  남은 전체 {remaining_total-len(todo)}', flush=True)

if __name__=='__main__':
    chunk = int(sys.argv[1]) if len(sys.argv)>1 else None
    out = sys.argv[2] if len(sys.argv)>2 else 'wanted_enriched.csv'
    run('wanted_companies_stage1.csv', out, chunk)
