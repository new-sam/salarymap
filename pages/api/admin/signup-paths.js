import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// "목표지표 — Sean" [가입 경로] 탭 — 최근 N일 가입자 한 명 한 명의 유입 경로.
// 귀속 우선순위: user_profiles.utm(가입 시점 저장) > 첫 이벤트 utm > 첫 이벤트 referrer.
// goal-metrics와 동일한 개인 비밀번호 게이트(x-goal-pass, 서버 검증).
const GOAL_PASSWORD = process.env.GOAL_METRICS_PASSWORD || 'wsj11029'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const WINDOW_DAYS = 14
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

// 유저별 첫 이벤트 (platform + utm/referrer 폴백 귀속용).
// 청크를 작게(50) 잡는다 — 이벤트 많은 유저가 끼면 1000행 응답 한도에 잘려
// 뒤 유저들의 첫 이벤트가 통째로 빠질 수 있다.
async function firstEventMap(userIds) {
  const map = {}
  for (let i = 0; i < userIds.length; i += 50) {
    const chunk = userIds.slice(i, i + 50)
    const { data } = await supabase
      .from('events')
      .select('user_id, event, page, meta, created_at')
      .in('user_id', chunk)
      .order('created_at', { ascending: true })
    for (const e of data || []) if (!(e.user_id in map)) map[e.user_id] = e
  }
  return map
}

const refHost = (r) => {
  if (!r) return null
  try { return new URL(r).hostname.replace('www.', '') } catch { return r }
}

// ad-metrics의 channelOf와 동일한 분류 — 소스 문자열/referrer → 채널 라벨.
function classify(source, referrer) {
  const s = (source || '').toLowerCase()
  if (['meta', 'mt', 'facebook', 'fb', 'instagram', 'ig'].includes(s)) return 'meta_ad'
  if (['google', 'tiktok'].includes(s)) return 'other_ad'
  if (s === 'threads') return 'threads'
  if (s) return `utm:${s}`
  const h = refHost(referrer)
  if (!h) return 'direct'
  if (/salary|localhost|vercel/.test(h)) return 'internal'
  if (/google|bing/.test(h)) return 'organic_search'
  if (/facebook|instagram|t\.co|twitter|linkedin|zalo|threads/.test(h)) return 'social'
  return `ref:${h}`
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if ((req.headers['x-goal-pass'] || '') !== GOAL_PASSWORD) return res.status(403).json({ error: 'bad_pass' })

  try {
    const sinceIso = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString()

    const users = (await listAllUsers())
      .filter((u) => !isExcludedSignup(u))
      .filter((u) => u.created_at >= sinceIso)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const ids = users.map((u) => u.id)

    // 가입 시점 utm (auth/callback이 user_profiles에 upsert)
    const profiles = {}
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, utm_source, utm_medium, utm_campaign')
        .in('id', ids.slice(i, i + 200))
      for (const p of data || []) profiles[p.id] = p
    }

    const firstEv = await firstEventMap(ids)

    const byDay = {}
    for (const u of users) {
      const p = profiles[u.id]
      const ev = firstEv[u.id]
      const m = ev?.meta || null
      const source = p?.utm_source || m?.utm_source || m?.source || null
      const campaign = p?.utm_campaign || m?.utm_campaign || null
      const referrer = m?.referrer || null
      const row = {
        at: u.created_at,
        email: u.email || null,
        platform: m?.platform === 'app' ? 'app' : 'web',
        channel: ev ? classify(source, referrer) : (source ? classify(source, null) : 'no_event'),
        source,
        campaign,
        medium: p?.utm_medium || m?.utm_medium || null,
        referrer: refHost(referrer),
        firstPage: ev?.page || null,
        firstEvent: ev?.event || null,
      }
      ;(byDay[vnDay(u.created_at)] ||= []).push(row)
    }

    const days = Object.keys(byDay)
      .sort()
      .reverse()
      .map((date) => {
        const signups = byDay[date]
        const chan = {}
        for (const r of signups) chan[r.channel] = (chan[r.channel] || 0) + 1
        return {
          date,
          total: signups.length,
          channels: Object.entries(chan).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
          signups,
        }
      })

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ windowDays: WINDOW_DAYS, days, generatedAt: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
