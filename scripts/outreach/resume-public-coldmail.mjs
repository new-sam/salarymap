// 비공개 이력서 보유자 → "공개하면 축하금 이벤트 참여 가능" 콜드메일 대상 추출 + 원클릭 링크 CSV.
// 발송은 하지 않는다(메일머지 CSV만 생성). --commit 시에만 coldmail_public_sent 이벤트를 스탬프한다.
//
//   node scripts/outreach/resume-public-coldmail.mjs            # dry-run: 대상 수/샘플만
//   node scripts/outreach/resume-public-coldmail.mjs --out ~/Desktop/rp.csv --commit
//   옵션: --source cv (resume_source=cv=이벤트 유입만) · --platform web|app · --limit N · --campaign coldmail1
//
// ⚠️ 링크 토큰 시크릿(RESUME_PUBLIC_TOKEN_SECRET, 없으면 GOAL_METRICS_PASSWORD)은
//    .env.local 과 Vercel(prod)에 동일하게 있어야 prod에서 링크가 검증된다.
import { writeFileSync } from 'node:fs'
import { sb, env } from './lib.mjs' // .env.local → process.env 주입 포함
import { makeToken } from '../../lib/campaignToken.js'

const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const EXCLUDED = ['likelion.net']
const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const commit = args.includes('--commit')
const campaign = flag('campaign', 'coldmail1')
const source = flag('source', null)
const platform = flag('platform', null)
const limit = flag('limit', null)
const out = flag('out', `./resume-public-${campaign}.csv`)

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

async function fetchAll(build) {
  const PAGE = 1000; let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data); if (data.length < PAGE) break; from += PAGE
  }
  return all
}

;(async () => {
  let q = () => sb.from('user_profiles')
    .select('id, email, full_name, resume_platform, resume_source, updated_at')
    .not('resume_url', 'is', null).eq('is_resume_public', false).not('email', 'is', null)
    .order('updated_at', { ascending: false })
  if (source) { const base = q; q = () => base().eq('resume_source', source) }
  if (platform) { const base = q; q = () => base().eq('resume_platform', platform) }

  let rows = (await fetchAll(q)).filter(r => r.email && !EXCLUDED.some(d => r.email.toLowerCase().endsWith('@' + d)))

  // 이미 이 캠페인으로 발송된 유저는 제외(재실행 idempotent)
  const sentEvts = await fetchAll(() => sb.from('events').select('user_id, meta').eq('event', 'coldmail_public_sent'))
  const alreadySent = new Set(sentEvts.filter(e => (e.meta?.campaign || 'coldmail1') === campaign).map(e => e.user_id))
  rows = rows.filter(r => !alreadySent.has(r.id))
  if (limit) rows = rows.slice(0, parseInt(limit))

  console.log(`캠페인: ${campaign} | 대상: ${rows.length}명${source ? ` (source=${source})` : ''}${platform ? ` (platform=${platform})` : ''}${alreadySent.size ? ` | 이미 발송 제외: ${alreadySent.size}` : ''}`)
  console.log(`샘플:`, rows.slice(0, 3).map(r => ({ email: r.email, name: r.full_name, platform: r.resume_platform })))

  const header = ['email', 'name', 'platform', 'public_link']
  const lines = [header.join(',')]
  for (const r of rows) {
    const link = `${SITE}/api/resume/go-public?t=${makeToken(r.id, campaign)}`
    lines.push([r.email, r.full_name || '', r.resume_platform || '', link].map(csvCell).join(','))
  }
  const outPath = out.replace(/^~/, process.env.HOME || '')
  writeFileSync(outPath, lines.join('\n'))
  console.log(`CSV 저장: ${outPath} (${rows.length}행)`)

  if (!commit) {
    console.log('\n[dry-run] 발송 이벤트 스탬프 안 함. 실제 발송 직전 --commit 으로 다시 실행하면 coldmail_public_sent 를 기록해 rate 분모가 잡힘.')
    return
  }
  // --commit: 발송 코호트를 events 에 스탬프(측정 분모). 실제 이메일 발송은 별도(수동/메일머지).
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map(r => ({
      event: 'coldmail_public_sent', page: '/campaign/resume-public',
      meta: { campaign, email: r.email, platform: r.resume_platform || null }, user_id: r.id,
    }))
    const { error } = await sb.from('events').insert(batch)
    if (error) throw error
  }
  console.log(`✅ coldmail_public_sent ${rows.length}건 스탬프 완료(캠페인 ${campaign}). 이제 CSV로 실제 발송하세요.`)
})().catch(e => { console.error(e); process.exit(1) })
