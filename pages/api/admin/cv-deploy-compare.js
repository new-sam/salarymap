import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'

/* /cv 개선 배포(2026-08-25)의 전후 비교 — 같은 길이의 창을 나란히 놓는다.
   날짜 피커를 쓰지 않는 이유: 이 표의 값은 "배포 시점"에 고정돼야 뜻이 있고,
   피커로 아무 기간이나 잡으면 전후가 뒤섞여 아무 말도 못 하게 된다. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 첫 cv_scroll_depth 가 찍힌 시각 = 새 번들이 실제로 돌기 시작한 시점.
const DEPLOY_AT = new Date('2026-08-25T14:13:00+07:00')
/* 비교 창의 상한. cv_form_view 누락 수정과 cv_open_picker 계측이 2026-08-18 에
   붙었다 — "전" 창이 그 이전으로 넘어가면 폼 도달·피커가 구조적으로 낮게 잡혀
   배포 효과가 아니라 계측 차이를 보게 된다. 8/18~8/25 사이인 7일이 한계다. */
const MAX_WINDOW_MS = 7 * 86400000
const EVENTS = ['cv_view', 'cv_form_view', 'cv_open_picker', 'cv_attach_file',
                'cv_register_success', 'cv_click_hero_cta', 'cv_scrolldown_click',
                /* 가입은 이력서 등록과 다른 사건이다 — 순서를 바꾼 뒤로는 이력서 없이
                   가입만 하고 나가는 사람이 생긴다. sign_up 은 /auth/callback 에서
                   sm_cid 쿠키로 찍히므로 /cv 방문자와 client_id 로 이을 수 있다.
                   단 전역 이벤트라 /cv 밖 가입도 섞인다 — 반드시 교집합으로 센다. */
                'sign_up']
const PAGE = 1000

async function tally(fromISO, toISO) {
  const seen = {}
  for (const e of EVENTS) seen[e] = new Set()
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await supabase
      .from('events').select('event, client_id')
      .in('event', EVENTS)
      .gte('created_at', fromISO).lt('created_at', toISO)
      .order('created_at', { ascending: true })
      .range(off, off + PAGE - 1)
    if (error) throw error
    for (const r of data || []) if (r.client_id) seen[r.event]?.add(r.client_id)
    if (!data || data.length < PAGE) break
    if (off > 200000) break // 안전판
  }
  const out = Object.fromEntries(EVENTS.map(e => [e, seen[e].size]))
  // /cv 를 본 사람 중 가입한 사람 — 전역 sign_up 을 그대로 쓰면 /cv 밖 유입이 섞인다.
  const viewers = seen.cv_view
  out.signup_from_cv = [...seen.sign_up].filter(k => viewers.has(k)).length
  // 가입은 했는데 이력서는 안 남긴 사람. 순서 교체가 만드는 코호트라 따로 센다.
  out.signup_no_resume = [...seen.sign_up]
    .filter(k => viewers.has(k) && !seen.cv_register_success.has(k)).length
  return out
}

export default async function handler(req, res) {
  if (!(await verifyAdminOrDevStub(req))) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const elapsed = Date.now() - DEPLOY_AT.getTime()
    /* 24시간을 넘기면 창을 온전한 하루 단위로 잘라 쓴다. 30시간치를 1.25로 나눠
       "일 평균"이라 부르면 반나절을 예측으로 채운 값이 된다 — 완료된 날만 센다.
       24시간이 안 됐으면 자르지 않고 그대로 두고(원값 그대로 보여준다) 화면이
       "아직 24시간이 안 지났다"고 밝힌다. */
    const raw = Math.max(3600000, Math.min(elapsed, MAX_WINDOW_MS))
    const wholeDays = Math.floor(raw / 86400000)
    const win = wholeDays >= 1 ? wholeDays * 86400000 : raw
    const capped = elapsed > MAX_WINDOW_MS
    const after = await tally(DEPLOY_AT.toISOString(), new Date(DEPLOY_AT.getTime() + win).toISOString())
    const before = await tally(new Date(DEPLOY_AT.getTime() - win).toISOString(), DEPLOY_AT.toISOString())
    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json({
      deployAt: DEPLOY_AT.toISOString(),
      hours: Math.round(win / 3600000),
      // days >= 1 이면 화면이 일 평균으로 전환한다. 0 이면 아직 하루가 안 찼다.
      days: wholeDays,
      capped, // 7일에 걸렸다 = 이제 창이 더 안 늘어난다
      before, after,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
