// 실제 반송 집계: 발송 계정(wsj, younghun) 받은편지함에서 mailer-daemon 반송메일을
// 직접 검색해 실패 수신주소를 추출한다. gmail_thread_id 유무와 무관하게 전수 집계.
// 실행: node scripts/outreach/count-bounces.mjs
import { google } from 'googleapis'
import { ownerClient, OWNERS, sb } from './lib.mjs'

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

const failedByOwner = {}
const allFailed = new Set()

for (const owner of [OWNERS.wsj, OWNERS.younghun]) {
  const gmail = google.gmail({ version: 'v1', auth: await ownerClient(owner) })
  let msgs = []
  try { msgs = await listAll(gmail, QUERY) }
  catch (e) { console.log(`[${owner.name}] 검색 실패: ${e.message}`); continue }

  const failed = new Set()
  for (const m of msgs) {
    try {
      const { data } = await gmail.users.messages.get({
        userId: 'me', id: m.id, format: 'metadata',
        metadataHeaders: ['X-Failed-Recipients', 'Subject'],
      })
      const h = (data.payload?.headers || [])
      const rcpt = h.find(x => x.name === 'X-Failed-Recipients')?.value
      let addrs = []
      if (rcpt) addrs = rcpt.split(',').map(s => s.trim().toLowerCase())
      else {
        // 헤더 없으면 snippet에서 이메일 추출(폴백)
        const snip = data.snippet || ''
        addrs = (snip.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [])
          .map(a => a.toLowerCase())
          .filter(a => !/mailer-daemon|postmaster|googlemail|google\.com/.test(a))
      }
      addrs.forEach(a => { failed.add(a); allFailed.add(a) })
    } catch {}
    await new Promise(s => setTimeout(s, 60))
  }
  failedByOwner[owner.name] = { msgCount: msgs.length, uniqueFailed: failed.size, addrs: [...failed] }
  console.log(`[${owner.name}] mailer-daemon 메일 ${msgs.length}건 · 고유 실패주소 ${failed.size}개`)
}

console.log('\n=== 전체 고유 반송 주소:', allFailed.size, '개 ===')

// DB의 발송 리드와 대조 — 반송 주소가 우리 발송대상인지 확인
const { data: leads } = await sb.from('cold_outreach')
  .select('email,status').not('sent_at', 'is', null)
const leadEmails = new Map((leads || []).map(l => [(l.email || '').toLowerCase(), l.status]))
const matched = [...allFailed].filter(a => leadEmails.has(a))
console.log('그중 발송대상과 매칭:', matched.length, '개')
console.log('현재 DB status=bounced 개수:', (leads || []).filter(l => l.status === 'bounced').length)

console.log('\n=== Gmail에서 찾은 반송 주소 목록 ===')
;[...allFailed].sort().forEach(a => console.log(' ', a, leadEmails.has(a) ? `(DB:${leadEmails.get(a)})` : '(DB 미매칭)'))

// DB에서 bounced 로 표기된 8건이 Gmail 검색결과에 다 잡히는지 역대조
const dbBounced = (leads || []).filter(l => l.status === 'bounced').map(l => (l.email || '').toLowerCase())
console.log('\n=== DB=bounced 8건 vs Gmail 대조 ===')
dbBounced.forEach(a => console.log(' ', a, allFailed.has(a) ? '✓ Gmail서 확인' : '✗ Gmail 미검출'))
