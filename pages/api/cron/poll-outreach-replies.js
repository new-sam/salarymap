import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

// 콜드메일 발송건의 Gmail 을 읽어 상태를 자동 갱신. 두 패스로 동작:
//  1) 스레드 패스: gmail_thread_id 있는 발송건의 스레드에서 회신→'replied', 반송→'bounced'
//  2) 반송 sweep 패스: mailer-daemon 반송메일을 계정 전 영역(in:anywhere, 스팸/휴지통 포함)에서
//     직접 검색해 실패주소를 모아 발송리드와 역매칭 → 'bounced'. 스레드 미기록·스팸분류 반송까지 커버.
//     (스레드 패스만으론 반송 대량 누락됨 — 반송 알림이 스팸함으로 가고 초안발송분은 thread_id 없음.)
// scripts/outreach/poll-replies.mjs / apply-bounces.mjs 의 크론 이식판. 캠페인 무관, owner 전체(wsj·younghun).
// Vercel cron 이 Authorization: Bearer ${CRON_SECRET} 로 호출. 수동 점검: ?dry=1 (쓰기 없이 집계만).
export const config = { maxDuration: 60 }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 발신 계정 — 스레드를 읽으려면 그 계정의 토큰 필요(gmail_oauth_tokens DB, 없으면 env 폴백).
const OWNERS = [
  { key: 'wsj', sender: 'wsj@likelion.net' },
  { key: 'younghun', sender: 'younghun@likelion.net' },
]

const isBounce = (from) => /mailer-daemon|postmaster|mail delivery/i.test(from)

// 반송 sweep 검색어 — 서버마다 반송 제목 형식이 달라 넓게 잡는다. in:anywhere 로 스팸/휴지통 포함.
const BOUNCE_Q = '(from:mailer-daemon OR from:postmaster OR from:"Mail Delivery System" OR from:"Mail Delivery Subsystem" OR subject:("Delivery Status Notification" OR "Undelivered" OR "Address not found" OR "delivery failed" OR "Undeliverable" OR "failure notice" OR "Returned mail" OR "could not be delivered" OR "Delivery incomplete" OR "Mail delivery failed" OR "Delivery has failed")) in:anywhere newer_than:30d'

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

  // --- 패스 2: 반송 전수 sweep (스레드 없는 발송분 + 스팸함까지 커버) ---
  const failedAddrs = new Set()
  for (const owner of OWNERS) {
    const gmail = await gmailFor(owner.sender)
    if (!gmail) continue
    try {
      let pageToken
      do {
        const { data } = await gmail.users.messages.list({ userId: 'me', q: BOUNCE_Q, maxResults: 500, pageToken })
        for (const m of (data.messages || [])) {
          try {
            const { data: msg } = await gmail.users.messages.get({
              userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['X-Failed-Recipients'],
            })
            const rcpt = (msg.payload?.headers || []).find(x => x.name === 'X-Failed-Recipients')?.value
            const addrs = rcpt
              ? rcpt.split(',').map(s => s.trim().toLowerCase())
              : (msg.snippet || '').match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)?.map(a => a.toLowerCase())
                  .filter(a => !/mailer-daemon|postmaster|googlemail|google\.com/.test(a)) || []
            addrs.forEach(a => failedAddrs.add(a))
          } catch { summary.errors++ }
          await new Promise(s => setTimeout(s, 50))
        }
        pageToken = data.nextPageToken
      } while (pageToken)
    } catch (e) {
      summary.byOwner[owner.key] = { ...(summary.byOwner[owner.key] || {}), sweepError: e.message }
    }
  }

  // 실패주소 ∩ 발송리드(status=sent) → bounced. cold_outreach 2000+행이라 페이지네이션 필수.
  let sweepBounced = 0
  if (failedAddrs.size) {
    let leadsAll = [], from = 0, size = 1000
    while (true) {
      const { data } = await supabase.from('cold_outreach').select('id, email, status').order('id').range(from, from + size - 1)
      leadsAll = leadsAll.concat(data || [])
      if (!data || data.length < size) break
      from += size
    }
    const targets = leadsAll.filter(l => failedAddrs.has((l.email || '').toLowerCase()) && l.status === 'sent')
    for (const t of targets) {
      if (dry) { sweepBounced++; continue }
      const { error } = await supabase.from('cold_outreach').update({ status: 'bounced' }).eq('id', t.id)
      if (error) summary.errors++; else sweepBounced++
    }
  }
  summary.bounced += sweepBounced
  summary.sweep = { failedAddrs: failedAddrs.size, corrected: sweepBounced }

  // 실행 흔적(0건이어도 돌았는지 확인용) — scrape-pikdi 와 동일 패턴
  await supabase.from('events').insert({ event: 'cron_poll_outreach', page: '/api/cron/poll-outreach-replies', meta: summary }).then(() => {}, () => {})
  return res.status(200).json({ ok: true, ...summary })
}
