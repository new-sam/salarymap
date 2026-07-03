// pikdi 리드의 모델 노출 필드 정리: business_desc에서 '픽디' 흔적 제거, industry_detail에 깔끔한 직무명.
// (memo의 [pikdi]·site는 모델에 안 넘어가므로 그대로 둠 — 내부 참조용)
// 실행: node scripts/outreach/clean-pikdi-fields.mjs [--commit]
import { sb } from './lib.mjs'
const commit = process.argv.includes('--commit')

// company_name → 깔끔한 직무명(한국어). 픽디/경쟁사 언급 없음.
const ROLE = {
  'SRC COMPANY':     '인플루언서 마케터',
  '10X BLITZ':       '숏폼 영상 편집자',
  'Pharma Bros':     '영상 편집·글로벌 인플루언서 마케터',
  'MADUP':           '광고 크리에이티브 디자이너',
  'MEDIPEEL':        '글로벌 인플루언서 마케터',
  'Sungboon Editor': '틱톡 마케팅 애널리스트',
  'ExoCo Bio':       '소셜 콘텐츠 디자이너',
  'JFUN':            '광고 크리에이티브 디자이너',
  'CELLFUSION:C':    '글로벌 인플루언서 마케터',
  "d'Alba":          'KOC·인플루언서 마케팅 운영',
}

const { data: rows, error } = await sb.from('cold_outreach')
  .select('id, company_name').eq('campaign', 'pikdi_targets')
if (error) { console.log('조회 오류:', error.message); process.exit(1) }

let n = 0
for (const r of rows) {
  const role = ROLE[r.company_name] || null
  const patch = {
    industry_detail: role,
    // 중립화: 경쟁사/픽디 언급 제거. 모델엔 이 문구가 넘어감.
    business_desc: '뷰티·화장품 브랜드로, 글로벌·틱톡 마케팅 및 영상/디자인 인재를 베트남 현지에서 충원 중',
  }
  console.log(`  ✓ ${r.company_name} → 직무:${role}`)
  if (commit) {
    const { error: e } = await sb.from('cold_outreach').update(patch).eq('id', r.id)
    if (e) console.log(`     ✗ ${e.message}`); else n++
  }
}
console.log(commit ? `\n✅ ${n}건 정리` : '\n(미리보기. 반영은 --commit)')
