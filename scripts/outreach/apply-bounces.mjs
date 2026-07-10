// Gmail 전 영역(스팸/휴지통 포함)에서 mailer-daemon 반송을 훑어 실패 수신주소를 모으고,
// cold_outreach 에서 해당 주소 중 status='sent' 인 건을 'bounced' 로 교정한다.
// (회신/미팅/계약 등은 덮어쓰지 않음). 실행: node scripts/outreach/apply-bounces.mjs [--dry]
import { google } from 'googleapis'
import { ownerClient, OWNERS, sb } from './lib.mjs'

const DRY = process.argv.includes('--dry')
const QUERY = '(from:mailer-daemon OR from:postmaster OR from:"Mail Delivery System" OR from:"Mail Delivery Subsystem" OR subject:("Delivery Status Notification" OR "Undelivered" OR "Address not found" OR "delivery failed" OR "Undeliverable" OR "failure notice" OR "Returned mail" OR "could not be delivered" OR "Delivery incomplete" OR "Mail delivery failed" OR "Delivery has failed")) in:anywhere newer_than:25d'

async function listAll(gmail, q) {
  let out = [], pageToken
  do {
    const { data } = await gmail.users.messages.list({ userId: 'me', q, maxResults: 500, pageToken })
    out = out.concat(data.messages || [])
    pageToken = data.nextPageToken
  } while (pageToken)
  return out
}

const allFailed = new Set()
for (const owner of [OWNERS.wsj, OWNERS.younghun]) {
  const gmail = google.gmail({ version: 'v1', auth: await ownerClient(owner) })
  let msgs = []
  try { msgs = await listAll(gmail, QUERY) } catch (e) { console.log(`[${owner.name}] 검색실패: ${e.message}`); continue }
  for (const m of msgs) {
    try {
      const { data } = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['X-Failed-Recipients'] })
      const rcpt = (data.payload?.headers || []).find(x => x.name === 'X-Failed-Recipients')?.value
      let addrs = rcpt ? rcpt.split(',').map(s => s.trim().toLowerCase())
        : (data.snippet || '').match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)?.map(a => a.toLowerCase())
            .filter(a => !/mailer-daemon|postmaster|googlemail|google\.com/.test(a)) || []
      addrs.forEach(a => allFailed.add(a))
    } catch {}
    await new Promise(s => setTimeout(s, 50))
  }
  console.log(`[${owner.name}] mailer-daemon ${msgs.length}건 훑음`)
}

// 발송된 리드 중 이 주소이면서 아직 sent 인 것만 대상 (2158행 → 페이지네이션 필수)
let leads = [], from = 0, size = 1000
while (true) {
  const { data } = await sb.from('cold_outreach').select('id,email,status').order('id').range(from, from + size - 1)
  leads = leads.concat(data)
  if (data.length < size) break
  from += size
}
const targets = leads.filter(l => allFailed.has((l.email || '').toLowerCase()) && l.status === 'sent')
console.log(`\nGmail 반송주소 ${allFailed.size}개 · 그중 교정대상(status=sent) ${targets.length}건`)

if (DRY) { console.log('DRY RUN — 변경 안 함'); process.exit(0) }
let ok = 0
for (const t of targets) {
  const { error } = await sb.from('cold_outreach').update({ status: 'bounced' }).eq('id', t.id)
  if (error) console.log('  ✗', t.email, error.message); else ok++
}
console.log(`✅ ${ok}건 bounced 로 교정 완료`)

const { count } = await sb.from('cold_outreach').select('*', { count: 'exact', head: true }).eq('status', 'bounced')
console.log(`현재 총 bounced: ${count}건`)
