import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

// 콜드메일 발송건의 Gmail 스레드를 읽어 상태를 자동 갱신:
//  - mailer-daemon/postmaster 반송(주소없음·용량초과 등) → status='bounced'
//  - 수신자 회신 → status='replied'
// scripts/outreach/poll-replies.mjs 의 크론 이식판. 캠페인 무관, 발송 owner 전체(wsj·younghun) 커버.
// Vercel cron 이 Authorization: Bearer ${CRON_SECRET} 로 호출. 수동 점검: ?dry=1 (쓰기 없이 집계만).
export const config = { maxDuration: 60 }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 발신 계정 — 스레드를 읽으려면 그 계정의 토큰 필요(gmail_oauth_tokens DB, 없으면 env 폴백).
const OWNERS = [
  { key: 'wsj', sender: 'wsj@likelion.net' },
  { key: 'younghun', sender: 'younghun@likelion.net' },
]

const isBounce = (from) => /mailer-daemon|postmaster|mail delivery/i.test(from)

async function gmailFor(sender) {
  const { data } = await supabase.from('gmail_oauth_tokens').select('refresh_token').eq('email', sender).maybeSingle()
  const refresh = data?.refresh_token || process.env.GMAIL_REFRESH_TOKEN
  if (!refresh) return null
  const oauth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET)
  oauth.setCredentials({ refresh_token: refresh })
  return google.gmail({ version: 'v1', auth: oauth })
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const dry = !!req.query.dry
  const summary = { dry, checked: 0, replied: 0, bounced: 0, errors: 0, byOwner: {} }

  for (const owner of OWNERS) {
    const gmail = await gmailFor(owner.sender)
    if (!gmail) { summary.byOwner[owner.key] = { skipped: 'no_token' }; continue }

    // 이 owner 가 보낸 발송건(스레드 있는 것) — 캠페인 무관 전체
    const { data: leads, error } = await supabase.from('cold_outreach')
      .select('id, email, gmail_thread_id')
      .eq('owner', owner.key).eq('status', 'sent').not('gmail_thread_id', 'is', null)
    if (error) { summary.errors++; summary.byOwner[owner.key] = { error: error.message }; continue }

    let replied = 0, bounced = 0
    for (const l of leads) {
      try {
        const { data } = await gmail.users.threads.get({
          userId: 'me', id: l.gmail_thread_id, format: 'metadata', metadataHeaders: ['From'],
        })
        // 발신자(owner) 본인이 아닌 메시지의 From 만 본다
        const froms = (data.messages || [])
          .map(m => (m.payload?.headers || []).find(h => h.name === 'From')?.value || '')
          .filter(f => !f.toLowerCase().includes(owner.sender.toLowerCase()))
        if (froms.some(isBounce)) {
          if (!dry) await supabase.from('cold_outreach').update({ status: 'bounced' }).eq('id', l.id)
          bounced++
        } else if (froms.length) {
          if (!dry) await supabase.from('cold_outreach').update({ status: 'replied', replied_at: new Date().toISOString() }).eq('id', l.id)
          replied++
        }
      } catch { summary.errors++ }
      await new Promise(s => setTimeout(s, 80)) // Gmail API 레이트리밋 여유
    }
    summary.checked += leads.length; summary.replied += replied; summary.bounced += bounced
    summary.byOwner[owner.key] = { checked: leads.length, replied, bounced }
  }

  // 실행 흔적(0건이어도 돌았는지 확인용) — scrape-pikdi 와 동일 패턴
  await supabase.from('events').insert({ event: 'cron_poll_outreach', page: '/api/cron/poll-outreach-replies', meta: summary }).then(() => {}, () => {})
  return res.status(200).json({ ok: true, ...summary })
}
