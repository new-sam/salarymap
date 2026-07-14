import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// "목표지표 - Sean" 콜드메일 공개 전환 탭 데이터.
// 비공개 이력서 보유자에게 "공개하면 축하금 이벤트 참여 가능" 콜드메일 발송 → 원클릭 링크로 공개 전환.
// 퍼널: 발송(coldmail_public_sent) → 클릭(coldmail_public_click) → 전환(coldmail_public_convert).
// 발송 코호트/전환 모두 events 테이블에 기록(별도 테이블/마이그레이션 불필요).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000
const vnDay = (iso) => new Date(new Date(iso).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10)

async function fetchAll(build) {
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) {
    return res.status(403).json({ error: 'bad_pass' })
  }

  try {
    const [evts, targetHead] = await Promise.all([
      fetchAll(() => supabase.from('events')
        .select('event, user_id, created_at, meta')
        .in('event', ['coldmail_public_sent', 'coldmail_public_click', 'coldmail_public_convert'])
        .order('created_at')),
      // 아직 비공개인(= 앞으로 보낼 수 있는) 이력서 보유자 수 — 라이브 참고값
      supabase.from('user_profiles').select('id', { count: 'exact', head: true })
        .not('resume_url', 'is', null).eq('is_resume_public', false),
    ])

    const usersBy = { sent: new Set(), click: new Set(), convert: new Set() }
    const firstSentByUser = {}
    const days = {} // day -> { day, clicks, converts }
    const touch = (d) => (days[d] = days[d] || { day: d, clicks: 0, converts: 0 })

    for (const e of evts) {
      const uid = e.user_id
      if (e.event === 'coldmail_public_sent') {
        if (uid) usersBy.sent.add(uid)
        if (uid && !firstSentByUser[uid]) firstSentByUser[uid] = e.created_at
      } else if (e.event === 'coldmail_public_click') {
        if (uid) usersBy.click.add(uid)
        touch(vnDay(e.created_at)).clicks++
      } else if (e.event === 'coldmail_public_convert') {
        if (uid) usersBy.convert.add(uid)
        touch(vnDay(e.created_at)).converts++
      }
    }

    const sent = usersBy.sent.size
    const clicked = usersBy.click.size
    const converted = usersBy.convert.size
    const sentDates = Object.values(firstSentByUser).map((iso) => vnDay(iso)).sort()
    const daily = Object.values(days).sort((a, b) => a.day.localeCompare(b.day))

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      sent, clicked, converted,
      clickRate: sent ? clicked / sent : 0,
      convertRate: sent ? converted / sent : 0,
      clickToConvert: clicked ? converted / clicked : 0,
      firstSentDay: sentDates[0] || null,
      lastSentDay: sentDates[sentDates.length - 1] || null,
      targetRemaining: targetHead.count || 0, // 아직 비공개인 이력서 보유자(발송 대상 풀)
      daily,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
