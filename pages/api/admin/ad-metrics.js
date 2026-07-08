import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// "목표지표 — Sean" 페이지의 [광고 성과] 탭 데이터 — 유입/광고 실시간 추적.
// goal-metrics와 동일한 개인 비밀번호 게이트(x-goal-pass, 서버 검증).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const WINDOW_DAYS = 30
const vnDay = (iso) => new Date(new Date(iso).getTime() + 7 * 36e5).toISOString().slice(0, 10)

async function listAllUsers() {
  const out = []
  let p = 1
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page: p, perPage: 1000 })
    const users = data?.users || []
    if (!users.length) break
    out.push(...users)
    if (users.length < 1000) break
    p++
  }
  return out
}

async function pageEvents(cols, gteIso, eventName) {
  const out = []
  let from = 0
  while (true) {
    let q = supabase.from('events').select(cols).order('created_at', { ascending: true }).range(from, from + 999).gte('created_at', gteIso)
    if (eventName) q = q.eq('event', eventName)
    const { data } = await q
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

// 가입자의 첫 이벤트 meta로 platform + 유입 채널 귀속.
function channelOf(m) {
  if (!m) return 'no_event'
  const s = (m.utm_source || m.source || '').toLowerCase()
  if (['meta', 'mt', 'facebook', 'fb', 'instagram', 'ig'].includes(s)) return 'meta_ad'
  if (['google', 'tiktok'].includes(s)) return 'other_ad'
  if (s === 'threads') return 'threads'
  if (s) return `utm:${s}`
  const r = m.referrer || ''
  if (!r) return 'direct'
  try {
    const h = new URL(r).hostname.replace('www.', '')
    if (/salary|localhost|vercel/.test(h)) return 'internal'
    if (/google|bing/.test(h)) return 'organic_search'
    if (/facebook|instagram|t\.co|twitter|linkedin|zalo|threads/.test(h)) return 'social'
    return `ref:${h}`
  } catch {
    return 'direct'
  }
}

const topN = (obj, n, total) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 }))

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) return res.status(403).json({ error: 'bad_pass' })

  try {
    const sinceIso = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString()

    // 1) 가입자(최근 30일, 내부/밴 제외)
    const users = (await listAllUsers()).filter((u) => !isExcludedSignup(u))
    const recent = users.filter((u) => u.created_at >= sinceIso)
    const ids = recent.map((u) => u.id)

    // 2) 가입자 첫 이벤트 → platform + 채널
    const firstMeta = {}
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150)
      const { data } = await supabase
        .from('events')
        .select('user_id, meta, created_at')
        .in('user_id', chunk)
        .order('created_at', { ascending: true })
      for (const e of data || []) if (!(e.user_id in firstMeta)) firstMeta[e.user_id] = e.meta || {}
    }

    let web = 0
    let app = 0
    let noEvent = 0
    const signupChan = {}
    const suByDay = {}
    for (const u of recent) {
      const m = u.id in firstMeta ? firstMeta[u.id] : null
      if (!m) noEvent++
      ;(m?.platform === 'app' ? (app++, 0) : (web++, 0))
      const c = channelOf(m)
      signupChan[c] = (signupChan[c] || 0) + 1
      const d = vnDay(u.created_at)
      suByDay[d] = (suByDay[d] || 0) + 1
    }

    // 3) landing 이벤트(30일) → 소스/캠페인/소재 + 일별
    const land = await pageEvents('meta, created_at', sinceIso, 'landing')
    const src = {}
    const camp = {}
    const content = {}
    const landByDay = {}
    for (const e of land) {
      const m = e.meta || {}
      src[m.utm_source || '(none)'] = (src[m.utm_source || '(none)'] || 0) + 1
      camp[m.utm_campaign || '(none)'] = (camp[m.utm_campaign || '(none)'] || 0) + 1
      if (m.utm_content) content[m.utm_content] = (content[m.utm_content] || 0) + 1
      const d = vnDay(e.created_at)
      landByDay[d] = (landByDay[d] || 0) + 1
    }

    // 4) 일별 퍼널 (최근 21일)
    const days = [...new Set([...Object.keys(landByDay), ...Object.keys(suByDay)])].sort().slice(-21)
    const funnel = days.map((d) => {
      const l = landByDay[d] || 0
      const s = suByDay[d] || 0
      return { date: d, landings: l, signups: s, cvr: l ? Math.round((s / l) * 1000) / 10 : null }
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      windowDays: WINDOW_DAYS,
      totals: {
        signups: recent.length,
        web,
        app,
        landings: land.length,
        noEvent,
        noEventPct: recent.length ? Math.round((noEvent / recent.length) * 1000) / 10 : 0,
      },
      funnel,
      sources: topN(src, 8, land.length),
      campaigns: topN(camp, 8, land.length),
      creatives: topN(content, 10, land.length),
      signupChannels: topN(signupChan, 8, recent.length),
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
