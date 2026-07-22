# -*- coding: utf-8 -*-
# Stage 1: pull Wanted listings across job groups, dedupe to unique companies
import urllib.request, json, time, csv

UA = {'User-Agent':'Mozilla/5.0','Accept':'application/json'}
GROUPS = {518:'개발', 511:'마케팅', 530:'마케팅', 524:'마케팅', 510:'디자인',
          523:'운영·CS', 522:'운영·CS', 517:'운영·CS', 507:'운영·CS'}
LIMIT = 100
MAX_OFFSET = 2500  # Wanted caps ~offset 2000-2900 per group

def get(url):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=15))

companies = {}   # company_id -> dict
total_posts = 0
for gid, label in GROUPS.items():
    off = 0
    while off <= MAX_OFFSET:
        url = (f'https://www.wanted.co.kr/api/chaos/navigation/v1/results'
               f'?job_group_id={gid}&country=kr&job_sort=job.latest_order'
               f'&years=-1&locations=all&limit={LIMIT}&offset={off}')
        try:
            d = get(url)
        except Exception as e:
            print(' ', label, off, 'ERR', repr(e)[:60]); break
        rows = d.get('data', [])
        if not rows: break
        for j in rows:
            total_posts += 1
            co = j.get('company') or {}
            cid = co.get('id')
            if not cid: continue
            addr = j.get('address') or {}
            rec = companies.setdefault(cid, {
                'company_id': cid, 'name': co.get('name',''),
                'jik': set(), 'positions': set(),
                'location': f"{addr.get('location','')} {addr.get('district','')}".strip(),
                'salary': '', 'job_id_sample': j.get('id'),
            })
            rec['jik'].add(label)
            if j.get('position'): rec['positions'].add(j['position'][:40])
            af, at = j.get('annual_from'), j.get('annual_to')
            if af is not None and not rec['salary']:
                rec['salary'] = f"{af}~{at}년차"
        off += LIMIT
        time.sleep(0.15)
    print(f'{label}(gid {gid}) done. running unique companies = {len(companies)}')

with open('wanted_companies_stage1.csv','w',newline='',encoding='utf-8-sig') as fp:
    w = csv.writer(fp)
    w.writerow(['company_id','회사명','직무군','대표포지션','지역','연차'])
    for c in companies.values():
        w.writerow([c['company_id'], c['name'], '/'.join(sorted(c['jik'])),
                    ' | '.join(list(c['positions'])[:3]), c['location'], c['salary']])

print('=== TOTAL posts scanned:', total_posts, '| UNIQUE companies:', len(companies), '===')
