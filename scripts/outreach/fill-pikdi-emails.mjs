// 픽디 타겟 브랜드에 웹검색으로 확보한 이메일을 채운다.
// 실행: node scripts/outreach/fill-pikdi-emails.mjs [--commit]
import { sb } from './lib.mjs'

const commit = process.argv.includes('--commit')

// company_name → { email, type, conf } (웹검색 확인된 공식 출처 기반. 추측 없음)
const MAP = {
  "d'Alba":          { email: 'biz_asean@dalba.com',        type: 'ASEAN 비즈/제휴',   conf: 'high' },
  'MEDIPEEL':        { email: 'export@medipeel.com',        type: '해외사업',          conf: 'high' },
  'CELLFUSION:C':    { email: 'cellfusionc_mkt@wonik.com',  type: '마케팅/제휴',       conf: 'high' },
  'Sungboon Editor': { email: 'biz@sungboon.com',           type: '비즈/제휴',         conf: 'high' },
  'MADUP':           { email: 'hr@madup.com',               type: '채용/HR',           conf: 'high' },
  'Pharma Bros':     { email: 'management@pharma-bros.com', type: '채용/일반',         conf: 'high' },
  'JFUN':            { email: 'kcy91@jfun.co.kr',           type: '일반(개인정보책임자)', conf: 'low' },
  'ExoCo Bio':       { email: 'sales@exocobio.com',         type: '영업/비즈',         conf: 'med' },
  'SRC COMPANY':     { email: 'srcmd@srccompany.co.kr',     type: '대표문의',          conf: 'high' },
  // '10X BLITZ': 공개 이메일 미발견 → null 유지
}

const { data: rows, error } = await sb.from('cold_outreach')
  .select('id, company_name, memo').eq('campaign', 'pikdi_targets')
if (error) { console.log('조회 오류:', error.message); process.exit(1) }

let n = 0
for (const r of rows) {
  const m = MAP[r.company_name]
  if (!m) { console.log(`  – ${r.company_name}: 이메일 없음(유지)`); continue }
  const memo = `${r.memo} · email:${m.type}(${m.conf})`
  console.log(`  ✓ ${r.company_name} → ${m.email} [${m.type}/${m.conf}]`)
  if (commit) {
    const { error: e } = await sb.from('cold_outreach')
      .update({ email: m.email, memo }).eq('id', r.id)
    if (e) console.log(`     ✗ 업데이트 실패: ${e.message}`); else n++
  }
}
console.log(commit ? `\n✅ ${n}건 이메일 채움` : '\n(미리보기. 실제 반영은 --commit)')
