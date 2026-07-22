# -*- coding: utf-8 -*-
# Turn enriched CSV -> sheet-ready master CSV (classify, tag, dedupe, filter large)
import csv, re, sys

VN = ('베트남','동남아','글로벌','해외','태국','대만','인도네시아','overseas','global','vietnam')
CONSUMER = ('화장품','뷰티','코스메','패션','의류','뷰티','식품','푸드','리빙','커머스','쇼핑','d2c',
            '브랜드','리테일','consumer','cosmetic','beauty','fashion','commerce')
# big/well-known -> low fit (our ICP = cost-pressured SME). down-rank to 버림.
BIG = ('롯데','삼성','현대','LG','SK','네이버','카카오','쿠팡','배달의민족','우아한','토스','비바리퍼블리카',
       '이베이','지마켓','11번가','야놀자','당근','버즈빌','무신사','컬리','직방','토스플레이스','한국평가정보',
       'naver','kakao','coupang','toss')

def primary_jik(j):
    # collapse combined labels like '개발/마케팅/운영·CS' -> one primary bucket
    for k in ('개발','마케팅','디자인'):
        if k in j: return k
    return '운영·CS'

def seg(position, name):
    t = (position + ' ' + name).lower()
    if any(k.lower() in t for k in VN): return '베트남'
    if any(k.lower() in t for k in CONSUMER): return '소비재'
    return '일반'

def score_bucket(seg_tag, is_big):
    if is_big: return '버림', 0
    fit = 2  # SME default (startup/mid)
    if seg_tag in ('베트남','소비재'): fit += 1
    return ('2순위' if fit >= 3 else '3순위'), fit

def main(infile, outfile, existing=None):
    seen_names = set()
    if existing:
        for r in csv.DictReader(open(existing, encoding='utf-8-sig')):
            seen_names.add(r['회사명'].strip())
    rows = list(csv.DictReader(open(infile, encoding='utf-8-sig')))
    out = []
    n_mail=n_skipbig=n_dup=0; uniq=set(); seen_pairs=set()
    for c in rows:
        name = c['회사명'].strip()
        email = (c.get('이메일') or '').strip()
        if not email: continue            # cold-email ready only
        n_mail += 1
        if name in seen_names:             # already a seed company
            n_dup += 1; continue
        is_big = any(b.lower() in name.lower() for b in BIG)
        s = seg(c.get('대표포지션',''), name)
        bucket, fit = score_bucket(s, is_big)
        # place company into EVERY 직무군 tab it hires for (multi-role -> multi-tab)
        jiks = [b for b in ('개발','마케팅','디자인','운영·CS') if b in c.get('직무군','')] or ['운영·CS']
        uniq.add(name)
        if is_big: n_skipbig += 1
        for jik in jiks:
          if (name,jik) in seen_pairs: continue
          seen_pairs.add((name,jik))
          out.append({
            '직무군': jik, '버킷': bucket, '회사명': name,
            '업종':'', '기업구분':'스타트업', '직원수':'', '설립일':'', '매출액':'',
            '주소': c.get('지역',''), '채용 포지션': c.get('대표포지션',''),
            '담당자':'담당자', '직위':'-', '이메일': email, '전화':'',
            '채용링크': 'wanted.co.kr/company/'+c['company_id'],
            '세그먼트태그': s, '베트남신호': 'Y' if s=='베트남' else 'N',
            '채용소외신호':'', '적합도점수': fit, '시급성점수':'',
            '메시지(후크)':'', 'D+0 발송':'','D+1':'','D+3':'','D+4 종료':'',
            '회신':'','회신온도':'','미팅':'','LOI':'',
            '비고': ('⚠️대기업-적합도낮음' if is_big else '🆕 원티드 자동수집·이메일검증'),
        })
    cols = ['직무군','버킷','회사명','업종','기업구분','직원수','설립일','매출액','주소','채용 포지션',
            '담당자','직위','이메일','전화','채용링크','세그먼트태그','베트남신호','채용소외신호',
            '적합도점수','시급성점수','메시지(후크)','D+0 발송','D+1','D+3','D+4 종료',
            '회신','회신온도','미팅','LOI','비고']
    w = csv.DictWriter(open(outfile,'w',newline='',encoding='utf-8-sig'), fieldnames=cols)
    w.writeheader()
    for r in out: w.writerow(r)
    print(f'이메일보유 {n_mail} | 중복제외 {n_dup} | 대기업표시 {n_skipbig} | 최종적재 {len(out)}')
    # quick segment/jik breakdown
    from collections import Counter
    print('직무군:', dict(Counter(r['직무군'] for r in out)))
    print('세그먼트:', dict(Counter(r['세그먼트태그'] for r in out)))

if __name__=='__main__':
    main('wanted_enriched.csv', 'sheet_ready.csv', existing=None)
