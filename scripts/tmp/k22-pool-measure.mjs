// K22 코스모스소프트 Full-stack Junior(한국 근무) — 발송 가능 풀 실측 (읽기 전용)
// JD 필수: Java/Spring, HTML/JS/React, SQL/DBMS, 한국어 커뮤니케이션 가능. 영문 CV 제출.
import { sb, fetchAll } from '/Users/wiseungju/salarymap/scripts/outreach/lib.mjs'

const [pool, unsubs] = await Promise.all([
  fetchAll(() => sb.from('user_profiles')
    .select('id,email,full_name,position,desired_roles,yoe_months,graduation_year,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,headline,experiences')
    .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
  fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
])
const unsubSet = new Set(unsubs.map((r) => r.user_id))
const seen = new Set()
const base = []
for (const p of pool) {
  if (!p.email || /likelion/i.test(p.email)) continue
  const e = p.email.toLowerCase()
  if (seen.has(e) || unsubSet.has(p.id)) continue
  seen.add(e)
  base.push(p)
}

const norm = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''))
const txt = (p) => {
  const exp = Array.isArray(p.experiences) ? p.experiences.map((e) => `${e.title || e.position || ''} ${e.company || ''}`).join(' ') : ''
  return [p.position, p.headline, norm(p.desired_roles), norm(p.skills), exp, JSON.stringify(p.resume_summary || '')].join(' ').toLowerCase()
}
for (const p of base) p.__t = txt(p)

const roles = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean)
const CORE = ['Fullstack', 'Full-stack', 'Full Stack']
const ADJ = ['Backend', 'Frontend', 'Web Developer']
const coreRole = (p) => roles(p).some((r) => CORE.some((c) => String(r).toLowerCase() === c.toLowerCase()))
const adjRole = (p) => roles(p).some((r) => ADJ.some((c) => String(r).toLowerCase() === c.toLowerCase()))

const koSig = (p) => !!p.korean_cert || /(korean|tiếng hàn|topik|한국어)/i.test(p.__t)
const javaSig = (p) => /\b(java|spring)\b/i.test(p.__t) && !/javascript only/i.test(p.__t)
const feSig = (p) => /(react|javascript|html|frontend|front-end)/i.test(p.__t)
const sqlSig = (p) => /(sql|oracle|mysql|postgres|dbms)/i.test(p.__t)
const y = (p) => p.yoe_months ?? 0
const yb = (p) => (y(p) < 12 ? '1y미만' : y(p) < 36 ? '1-3y' : y(p) < 60 ? '3-5y' : '5y+')

const devAll = base.filter((p) => coreRole(p) || adjRole(p))
console.log(`기준 풀 ${base.length} · 개발직군(FS/BE/FE) ${devAll.length}`)

const show = (label, arr) => {
  const d = {}
  for (const p of arr) d[yb(p)] = (d[yb(p)] || 0) + 1
  const pub = arr.filter((p) => p.is_resume_public).length
  console.log(`${label}: ${arr.length}명 · 경력 ${JSON.stringify(d)} · 공개 ${pub}`)
}

const ko = devAll.filter(koSig)
show('개발직군 × 한국어 시그널(인증 or 텍스트)', ko)
show('  └ 한국어 인증만', devAll.filter((p) => p.korean_cert))
show('  └ +Java/Spring 근거', ko.filter(javaSig))
show('  └ +Java/Spring+FE(react/js)', ko.filter((p) => javaSig(p) && feSig(p)))
show('  └ +SQL 근거', ko.filter(sqlSig))

const strict = ko.filter((p) => javaSig(p))
console.log('\n── 한국어×Java/Spring 상위 후보 (전원) ──')
for (const p of strict.sort((a, b) => y(b) - y(a)))
  console.log(`  ${p.full_name} <${p.email}> · ${p.position || '?'} · ${Math.round(y(p) / 12 * 10) / 10}y · 한국어인증 ${p.korean_cert ? 'Y' : 'n'} · 영어 ${p.english_cert ? 'Y' : 'n'} · ${p.location || '?'}`)

// 코어(Fullstack 직군)만 한국어 게이트 별도
show('\n코어 Fullstack 직군만 × 한국어', devAll.filter((p) => coreRole(p) && koSig(p)))
