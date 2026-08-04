// KTC 클레임 캠페인 사전 파싱 — 발송 대상(미발송·미가입·CV 직링크 보유)의 CV 를 미리
// 구조화 파싱해 ktc_claim_profiles 에 적재한다. 랜딩(/ktc/claim)이 "깔끔하게 정리된 프로필"을
// 로그인 전에 보여주고, 가입 콜백이 이 결과를 user_profiles 에 통째로 복사하는 소스.
// shape 은 lib/parseResume parseResumeBuffer(= parseResumeForUser 의 update)와 동일.
//
//   node scripts/outreach/ktc-claim-parse.mjs            # dry-run: 대상 수만
//   node scripts/outreach/ktc-claim-parse.mjs --run      # 실행(이미 파싱된 이메일은 스킵 — idempotent)
//   node scripts/outreach/ktc-claim-parse.mjs --run --max 5   # 소량 검증
//
// 비용: 인당 gpt-4o-mini 1콜 + 호칭보정 gpt-4o 1콜(이름만) ≈ $0.003. 1,300명 ≈ $4.
// 스캔 이미지 PDF(~5%)는 텍스트 추출 실패 → 로그만 남기고 스킵(발송은 기본 카드로 폴백).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { sb, env } from './lib.mjs' // .env.local → process.env 주입(OPENAI_API_KEY 포함) — parseResume 보다 먼저 로드돼야 함
import { leadId } from '../../lib/ktcMailToken.js'

const LEADS = new URL('../../data/ktc-leads-not-in-fyi.csv', import.meta.url)
const args = process.argv.slice(2)
const flag = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d }
const doRun = args.includes('--run')
const revive = args.includes('--revive') // 구 앵글(coldmail-ktc/-2/-3) 수신 무반응자 재발송 준비 — CV 캠페인 수신자만 제외
const max = parseInt(flag('max', '0')) || 0
const CONCURRENCY = 5

const IMPORTABLE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  const head = rows.shift()
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])))
}

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
  // env 주입(lib.mjs) 이후에 로드해야 OPENAI_API_KEY 가 잡힌다 → 동적 import.
  const { parseResumeBuffer } = await import('../../lib/parseResume.js')

  // ── 대상: 발송 스크립트와 같은 규칙 ──
  let leads = parseCsv(readFileSync(LEADS, 'utf8')).map(r => ({
    email: r['이메일'].toLowerCase(),
    name: r['이름'],
  })).filter(r => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(r.email))
  for (const l of leads) l.lead = leadId(l.email)

  const profs = await fetchAll(() => sb.from('user_profiles').select('email').not('email', 'is', null))
  const members = new Set(profs.map(p => p.email.trim().toLowerCase()))
  const evts = await fetchAll(() => sb.from('events').select('event, meta').in('event', ['coldmail_public_sent', 'coldmail_unsub']))
  const sentRe = revive ? /^coldmail-ktc-cv/ : /^coldmail-ktc/
  const sentLeads = new Set(evts.filter(e => e.event === 'coldmail_public_sent' && sentRe.test(e.meta?.campaign || '') && e.meta?.lead).map(e => e.meta.lead))
  const unsubLeads = new Set(evts.filter(e => e.event === 'coldmail_unsub' && e.meta?.lead).map(e => e.meta.lead))
  leads = leads.filter(l => !members.has(l.email) && !sentLeads.has(l.lead) && !unsubLeads.has(l.lead))

  if (!env.KTC_SUPABASE_URL || !env.KTC_SUPABASE_SERVICE_ROLE_KEY) throw new Error('KTC_SUPABASE_URL / KTC_SUPABASE_SERVICE_ROLE_KEY 필요(.env.local)')
  const ktc = createClient(env.KTC_SUPABASE_URL, env.KTC_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const kc = await fetchAll(() => ktc.from('candidates').select('email, cv_url'))
  const cvBy = new Map()
  for (const c of kc) {
    const e = (c.email || '').trim().toLowerCase(); const u = (c.cv_url || '').trim()
    if (e && u && !cvBy.has(e)) cvBy.set(e, u)
  }
  for (const l of leads) l.cvUrl = cvBy.get(l.email) || ''
  leads = leads.filter(l => IMPORTABLE.test(l.cvUrl))

  // 이미 파싱된 이메일 스킵 — 재실행 idempotent
  const done = await fetchAll(() => sb.from('ktc_claim_profiles').select('email'))
  const doneSet = new Set(done.map(d => d.email))
  const targets = leads.filter(l => !doneSet.has(l.email))
  console.log(`파싱 대상 ${targets.length}명 (발송대상 ${leads.length} - 기파싱 ${leads.length - targets.length})`)

  if (!doRun) { console.log('[dry-run] --run 으로 실행.'); return }

  const queue = max ? targets.slice(0, max) : targets
  let ok = 0, fail = 0, i = 0
  const failures = []
  async function worker() {
    while (i < queue.length) {
      const l = queue[i++]
      try {
        const r = await fetch(l.cvUrl)
        if (!r.ok) throw new Error(`download ${r.status}`)
        const buf = Buffer.from(await r.arrayBuffer())
        const summary = await parseResumeBuffer(buf, l.name)
        const { error } = await sb.from('ktc_claim_profiles').upsert({
          email: l.email, summary, cv_url: l.cvUrl, parsed_at: new Date().toISOString(),
        }, { onConflict: 'email' })
        if (error) throw new Error(`db: ${error.message}`)
        ok++
      } catch (e) {
        fail++
        failures.push(`${l.email}: ${e.message}`)
      }
      if ((ok + fail) % 50 === 0) console.log(`  ${ok + fail}/${queue.length} (성공 ${ok} / 실패 ${fail})`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`\n✅ 완료: 성공 ${ok} / 실패 ${fail}`)
  if (failures.length) {
    console.log('실패 목록(상위 20):')
    for (const f of failures.slice(0, 20)) console.log('  ', f)
  }
})().catch(e => { console.error(e); process.exit(1) })
