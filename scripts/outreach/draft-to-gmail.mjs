// 선별된 리드 id 목록 → AI 초안 생성(+DB 저장) → Gmail 임시보관함(draft)에 저장.
// 발송은 하지 않는다. 지난 69건과 동일한 흐름(수동 검수 후 Gmail에서 직접 발송).
//
//   node scripts/outreach/draft-to-gmail.mjs <ids.json> [--owner wsj] [--round 1] [--limit N]
//
// 사전: .env.local 에 OPENAI_API_KEY / GMAIL_CLIENT_ID·SECRET, DB gmail_oauth_tokens(발신자) 필요.
import { readFileSync } from 'node:fs'
import { google } from 'googleapis'
import { sb, resolveOwner } from './lib.mjs' // ← 먼저 import: .env.local → process.env 주입
import { generateDraft } from '../../lib/outreachDraft.js'
import { createOutreachDraft } from '../../lib/gmailSend.js'
import supabaseAdmin from '../../lib/supabaseAdmin.js'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const retry = async (fn, n = 3) => {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) { if (i >= n - 1) throw e; await sleep(1500 * (i + 1)) }
  }
}
// Gmail 임시보관함에 이미 있는 수신자 이메일 집합(재실행 시 건너뛰기용)
async function existingDraftEmails(owner) {
  const { data: tok } = await supabaseAdmin.from('gmail_oauth_tokens').select('refresh_token').eq('email', owner.sender).maybeSingle()
  if (!tok?.refresh_token) throw new Error(`${owner.sender} 미연동`)
  const c = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET)
  c.setCredentials({ refresh_token: tok.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: c })
  const set = new Set(); let pageToken
  do {
    const { data } = await retry(() => gmail.users.drafts.list({ userId: 'me', maxResults: 100, pageToken }))
    for (const d of (data.drafts || [])) {
      const { data: full } = await retry(() => gmail.users.drafts.get({ userId: 'me', id: d.id, format: 'metadata', metadataHeaders: ['To'] }))
      const to = (full.message?.payload?.headers || []).find(h => h.name === 'To')?.value || ''
      const email = (to.match(/[\w.+-]+@[\w.-]+/) || [''])[0].toLowerCase()
      if (email) set.add(email)
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  return set
}

const [idsPath, ...rest] = process.argv.slice(2)
if (!idsPath) { console.error('✗ ids.json 경로를 넣으세요.'); process.exit(1) }
const argv = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d }
const owner = resolveOwner(argv('--owner', 'wsj'))
const round = parseInt(argv('--round', '1'), 10)
const limit = parseInt(argv('--limit', '0'), 10)

let ids = JSON.parse(readFileSync(idsPath, 'utf8'))
if (limit > 0) ids = ids.slice(0, limit)

const leads = await retry(() => sb.from('cold_outreach')
  .select('id, company_name, contact_name, email, industry, industry_detail, business_desc, campaign')
  .in('id', ids)
  .then(({ data, error }) => { if (error) throw error; return data }))
console.log(`[${owner.name}] 대상 ${leads.length}건 (요청 ${ids.length})`)

// 1) 이미 임시보관함에 초안이 있는 수신자는 건너뛴다(재실행 안전)
const have = await existingDraftEmails(owner)
const todo = leads.filter(l => l.email && !have.has(l.email.toLowerCase()))
console.log(`기존 초안 ${have.size}건 확인 → 신규 처리 대상 ${todo.length}건 (스킵 ${leads.length - todo.length})`)

// 2) 초안 생성 → DB 저장 → Gmail 임시보관함 저장 (동시 3, 건별 재시도)
let ok = 0, fail = 0
const failed = []
const chunk = (a, n) => a.reduce((r, x, i) => (i % n ? r[r.length - 1].push(x) : r.push([x]), r), [])
for (const batch of chunk(todo, 3)) {
  await Promise.all(batch.map(async (l) => {
    try {
      const { subject, body } = await retry(() => generateDraft(l, owner.key, round))
      await retry(() => sb.from('cold_outreach')
        .update({ email_subject: subject, email_body: body, generated_at: new Date().toISOString() })
        .eq('id', l.id).then(({ error }) => { if (error) throw error }))
      await retry(() => createOutreachDraft(owner.key, { to: l.email, subject, body }))
      ok++
      console.log(`  ✓ ${l.company_name} → ${l.email}`)
    } catch (e) {
      fail++; failed.push(l.company_name)
      console.log(`  ✗ ${l.company_name}: ${e.message}`)
    }
  }))
}
console.log(`\n완료: 신규 초안 ${ok}건 생성${fail ? `, 실패 ${fail}건 (재실행하면 이어서 처리)` : ''}`)
if (fail) console.log('실패:', failed.join(', '))
