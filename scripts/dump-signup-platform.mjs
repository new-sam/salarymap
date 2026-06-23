// 신규 가입의 web/app split — 슬랙봇과 정확히 같은 식 (isExcludedSignup +
// banned 제외) + events 의 user 별 첫 이벤트 platform 으로 분류.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { isExcludedSignup } from '../lib/admin-metrics.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function listAllUsers() {
  const out = []; let p = 1
  while (true) {
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: p, perPage: 1000 })
    if (!users?.length) break
    out.push(...users)
    if (users.length < 1000) break
    p++
  }
  return out
}

async function splitByPlatform(userIds) {
  if (!userIds.length) return { web: 0, app: 0 }
  // 페이지 단위로 events 조회 (in 절 큰 list 안전 처리)
  const platformByUid = {}
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const { data } = await supabase
      .from('events')
      .select('user_id, meta, created_at')
      .in('user_id', chunk)
      .order('created_at', { ascending: true })
    for (const e of data || []) {
      if (!platformByUid[e.user_id]) {
        platformByUid[e.user_id] = e.meta?.platform === 'app' ? 'app' : 'web'
      }
    }
  }
  let app = 0, web = 0
  for (const uid of userIds) {
    if (platformByUid[uid] === 'app') app++; else web++
  }
  return { web, app }
}

async function dumpRange(label, startUtc, endUtc) {
  const allUsers = await listAllUsers()
  const startISO = new Date(startUtc).toISOString()
  const endISO = new Date(endUtc).toISOString()
  const ids = allUsers
    .filter(u => u.created_at >= startISO && u.created_at <= endISO && !isExcludedSignup(u))
    .map(u => u.id)
  const split = await splitByPlatform(ids)
  console.log(`${label} 신규 가입 ${ids.length}명 → web ${split.web} / app ${split.app}`)
}

await dumpRange('6/21 (월요일)', '2026-06-21T00:00:00+07:00', '2026-06-21T23:59:59+07:00')
await dumpRange('6/22 (월요일)', '2026-06-22T00:00:00+07:00', '2026-06-22T23:59:59+07:00')
await dumpRange('4/20 ~ 6/23 누적', '2026-04-20T00:00:00+07:00', '2026-06-23T23:59:59+07:00')
