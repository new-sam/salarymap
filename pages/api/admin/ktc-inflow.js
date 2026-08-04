import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

// "유진 작업실" 유입 3단 — 자체 이벤트 로그(events.session_start) 기준, VN(UTC+7) 일별.
//   ① 전체 유입: session_start (세션당 1회, /admin 제외 — pages/_app.js)
//   ② KTC 유입: 그중 진입 경로가 /ktc* 인 세션
//   ③ 구 랜딩 경유: 그중 리퍼러가 구 K-Tech College 랜딩인 세션
// 구 랜딩은 ktc.likelion.edu.vn (ktc-landing2026 프로젝트) — /ktc 로 대체됐지만 아직 유입이 있다.
// 표기가 바뀔 수 있어 /ktc 진입 리퍼러 목록(ktcReferrers)도 같이 반환한다.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const OLD_LANDING_HOSTS = ['ktc.likelion.edu.vn', 'ktc-landing2026.vercel.app']

const vnDay = (iso) => new Date(new Date(iso).getTime() + 7 * 36e5).toISOString().slice(0, 10)

const refHost = (referrer) => {
  if (!referrer) return '(direct)'
  try { return new URL(referrer).hostname } catch { return referrer.slice(0, 60) }
}
const isOldLanding = (meta) => {
  const host = refHost(meta?.referrer)
  const src = String(meta?.utm_source || '')
  return OLD_LANDING_HOSTS.some(h => host === h || host.endsWith(`.${h}`) || src.includes(h))
}

// 리퍼러가 비는 진입(광고 인앱 브라우저·메일·메신저)은 전부 '(direct)' 한 줄로 뭉친다.
// 그 안의 최대 덩어리가 Meta 광고라, 뭉쳐두면 "출처 불명"으로 오독된다.
// → 리퍼러가 없고 utm_source 가 있으면 그 출처로 갈라내고, 리퍼러가 아니라 UTM 으로
//   판정했다는 걸 viaUtm 배지로 구분한다. 둘 다 없는 것만 진짜 '(direct)'.
const entrySource = (meta) => {
  const host = refHost(meta?.referrer)
  if (host !== '(direct)') return { key: host, viaUtm: false }
  const src = String(meta?.utm_source || '').trim()
  return src ? { key: src, viaUtm: true } : { key: '(direct)', viaUtm: false }
}

async function fetchAll(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export default async function handler(req, res) {
  const user = await verifyAdminOrDevStub(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from/to required' })
  // VN 하루 경계로 조회 (표시 버킷도 VN 기준이라 일치)
  const gte = `${from}T00:00:00+07:00`
  const lte = `${to}T23:59:59+07:00`

  try {
    const sessionQ = () => supabase.from('events')
      .select('created_at')
      .eq('event', 'session_start')
      .gte('created_at', gte).lte('created_at', lte)
      .order('created_at', { ascending: true })
    // KTC 진입만 meta 까지 (리퍼러 분류용) — page 는 session_start 시점의 진입 경로
    const ktcQ = () => supabase.from('events')
      .select('created_at, page, meta')
      .eq('event', 'session_start')
      .like('page', '/ktc%')
      .gte('created_at', gte).lte('created_at', lte)
      .order('created_at', { ascending: true })

    const [sessions, ktcSessions] = await Promise.all([fetchAll(sessionQ), fetchAll(ktcQ)])

    const byDay = {}
    const day = (d) => byDay[d] || (byDay[d] = { date: d, total: 0, ktc: 0, oldLanding: 0 })
    for (const e of sessions) day(vnDay(e.created_at)).total++
    const referrers = {}
    for (const e of ktcSessions) {
      const d = day(vnDay(e.created_at))
      d.ktc++
      const old = isOldLanding(e.meta)
      if (old) d.oldLanding++
      const { key, viaUtm } = entrySource(e.meta)
      const r = referrers[key] || (referrers[key] = { host: key, sessions: 0, oldLanding: old, viaUtm })
      r.sessions++
    }

    const days = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
    const sum = (k) => days.reduce((a, d) => a + d[k], 0)

    res.json({
      days,
      totals: { total: sum('total'), ktc: sum('ktc'), oldLanding: sum('oldLanding') },
      ktcReferrers: Object.values(referrers).sort((a, b) => b.sessions - a.sessions),
    })
  } catch (e) {
    console.error('ktc-inflow:', e.message)
    res.status(500).json({ error: e.message })
  }
}