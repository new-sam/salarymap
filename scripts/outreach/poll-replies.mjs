// 회신 자동감지: status='sent' 리드의 Gmail 스레드를 읽어, 우리(SENDER)가 아닌
// 발신자의 메시지가 있으면 status='replied' 로 승격한다. 회신율도 출력.
// 실행: node scripts/outreach/poll-replies.mjs   (크론으로 주기 실행 가능)
import { google } from 'googleapis'
import { sb, oauthClient, SENDER, env } from './lib.mjs'

const CAMPAIGN = 'kocham_2026'

if (!env.GMAIL_REFRESH_TOKEN) { console.log('✗ GMAIL_REFRESH_TOKEN 없음. 먼저: node scripts/outreach/auth.mjs'); process.exit(1) }
const gmail = google.gmail({ version: 'v1', auth: oauthClient() })

const { data: leads, error } = await sb.from('cold_outreach')
  .select('id, email, gmail_thread_id')
  .eq('campaign', CAMPAIGN).eq('status', 'sent').not('gmail_thread_id', 'is', null)
if (error) { console.log('조회 오류:', error.message); process.exit(1) }

console.log(`발송(미회신) ${leads.length}건 스레드 확인 중…`)
let replied = 0
for (const l of leads) {
  try {
    const { data } = await gmail.users.threads.get({
      userId: 'me', id: l.gmail_thread_id, format: 'metadata', metadataHeaders: ['From'],
    })
    // 우리(SENDER)가 아닌 발신자의 메시지 = 상대방 답장
    const hasReply = (data.messages || []).some(m => {
      const from = (m.payload?.headers || []).find(h => h.name === 'From')?.value || ''
      return !from.toLowerCase().includes(SENDER.toLowerCase())
    })
    if (hasReply) {
      await sb.from('cold_outreach').update({ status: 'replied', replied_at: new Date().toISOString() }).eq('id', l.id)
      replied++
      console.log(`  ↩︎ 회신 감지: ${l.email}`)
    }
  } catch (e) { console.log(`  ✗ ${l.email}: ${e.message}`) }
  await new Promise(s => setTimeout(s, 200))
}

// 회신율 = (회신 이상) / (총 발송)
const inState = (states) => sb.from('cold_outreach').select('*', { count: 'exact', head: true })
  .eq('campaign', CAMPAIGN).in('status', states)
const { count: sentTotal } = await inState(['sent', 'replied', 'meeting', 'won', 'lost'])
const { count: repliedTotal } = await inState(['replied', 'meeting', 'won', 'lost'])
console.log(`\n신규 회신 ${replied}건`)
console.log(`회신율: ${repliedTotal}/${sentTotal} = ${sentTotal ? Math.round((repliedTotal / sentTotal) * 100) : 0}%`)
