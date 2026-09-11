// R191 Jinosys AI모바일/웹+IoT·로봇 인턴 — 다낭 한정 실발송 풀 실측 (읽기 전용)
// 풀봇(코어188/확장421) 재현 → 스레드 제약(다낭 거주 · 인턴 적합) 레이어링
import { sb, fetchAll } from '/Users/wiseungju/salarymap/scripts/outreach/lib.mjs'

const [pool, unsubs, job] = await Promise.all([
  fetchAll(() => sb.from('user_profiles')
    .select('id,email,full_name,position,desired_roles,yoe_months,graduation_year,location,english_cert,korean_cert,is_resume_public,skills,resume_summary,university')
    .not('email', 'is', null).not('resume_url', 'is', null).order('created_at', { ascending: false })),
  fetchAll(() => sb.from('events').select('user_id').eq('event', 'coldmail_unsub').not('user_id', 'is', null).order('id')),
  sb.from('jobs').select('id,title,company,location,type,salary_min,salary_max,source,source_id,is_active,logo_url,description').eq('id', '7ed417d4-8300-4814-a6bf-98cfa47091d8').single(),
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

const txt = (p) => (JSON.stringify(p.skills || '') + ' ' + String(p.position || '') + ' ' + String(p.resume_summary || '')).toLowerCase()
for (const p of base) p.__t = txt(p)
const roleSet = (p) => [p.position, ...(p.desired_roles || [])].filter(Boolean)

// 실데이터 직군 어휘에서 봇이 쓴 값 추정 확인
const vocab = {}
for (const p of base) for (const r of roleSet(p)) vocab[r] = (vocab[r] || 0) + 1
console.log('직군 어휘(AI/Mobile/Web/Embedded/Backend 후보):',
  Object.entries(vocab).filter(([r]) => /ai|mobile|web|embed|backend/i.test(r)).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}(${n})`).join(' · '))

const CORE = ['AI Engineer', 'Mobile', 'Web Developer']
const ADJ = ['Embedded', 'Backend']
const KWS = ['php', 'html5', 'css3', 'android', 'kotlin', 'rtsp', 'webrtc'].map((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'i'))
const kwHits = (p) => KWS.filter((re) => re.test(p.__t)).length
const hasAny = (p, arr) => roleSet(p).some((r) => arr.includes(r))
const core = base.filter((p) => hasAny(p, CORE))
const expanded = base.filter((p) => hasAny(p, CORE) || (hasAny(p, ADJ) && kwHits(p) >= 1) || kwHits(p) >= 2)
console.log(`기준 풀 ${base.length} · 봇 재현: 코어 ${core.length} / 확장 ${expanded.length}`)

// ── 스레드 제약: 다낭 거주 × 인턴 적합 ──
const dn = (p) => /(đà nẵng|da ?nang|danang)/i.test(String(p.location || ''))
const y = (p) => p.yoe_months ?? 0
const gy = (p) => Number(p.graduation_year) || 0
const tier = (p) => {
  if (gy(p) >= 2026) return '재학생(2026+졸예)'
  if (gy(p) >= 2024 && gy(p) <= 2025 && y(p) <= 12) return '갓졸업(24-25·≤1y)'
  if (y(p) <= 12) return '기타 신입(≤1y)'
  return '경력 1y+'
}
const TIERS = ['재학생(2026+졸예)', '갓졸업(24-25·≤1y)', '기타 신입(≤1y)', '경력 1y+']
const vku = (p) => /vku|vietnam.korea|việt.hàn|viet.han/i.test(String(p.university || ''))

for (const [label, arr] of [['코어', core.filter(dn)], ['확장 전체', expanded.filter(dn)]]) {
  console.log(`\n■ 다낭 ${label} ${arr.length}명`)
  for (const t of TIERS) {
    const rows = arr.filter((p) => tier(p) === t)
    if (!rows.length) continue
    console.log(`  ${t}: ${rows.length}명 (영어인증 ${rows.filter((p) => p.english_cert).length} · VKU ${rows.filter(vku).length} · 공개 ${rows.filter((p) => p.is_resume_public).length})`)
  }
}

const sendable = expanded.filter((p) => dn(p) && tier(p) !== '경력 1y+')
console.log(`\n인턴 적합(≤1y) × 다낭 × 확장 = ${sendable.length}명 전원:`)
for (const p of sendable.sort((a, b) => kwHits(b) - kwHits(a)))
  console.log(`  [kw${kwHits(p)}] ${p.full_name} <${p.email}> · ${p.position || '?'} · 졸업 ${p.graduation_year || '?'} · ${Math.round(y(p) / 12 * 10) / 10}y · ${String(p.university || '').slice(0, 40)}`)

const j = job.data
console.log('\n공고:', JSON.stringify({ ...j, description: (j?.description || '').slice(0, 300) }, null, 1))
