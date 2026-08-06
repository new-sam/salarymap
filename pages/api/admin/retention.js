import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'

// 리텐션 전용 집계 — 전체 서비스(웹+앱), 가입 유저(user_id) 축.
//  · 활성 = events 에 user_id 이벤트 1건+ (KPI 탭과 동일 축 — 앱·웹 모두 로그인 시 기록).
//  · 리텐션 정의 = unbounded: 가입 N일(주) 후에도 활동 흔적이 있으면 유지 — 앱 대시보드와 동일 정의.
//  · ?platform=all|web|app — 활성 축만 필터(meta.platform === 'app'). 가입 분모엔 플랫폼이 없다.
//  · 코호트 모집단 = user_id 이벤트가 쌓이기 시작한 날(dataStart, 실측 2026-06-16) 이후 가입자만.
//    그 전 가입자는 초기 활동이 기록에 없어 리텐션이 가짜 0으로 잡힌다. DAU/WAU/MAU 는 전체 유저.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DAY = 86400000
// VN(UTC+7) 날짜 문자열 — kpi.js(toVN)와 동일 기준.
const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)
// UTC 자정 파싱 — 서버 TZ 무관 캘린더 날짜 산술. (kpi.js 의 parseNaive 는 로컬 자정 파싱이라
// 서버 TZ가 UTC가 아니면 addDays 왕복에서 하루가 밀린다 — 여기선 UTC 고정으로 회피.)
const parseNaive = (d) => Date.parse(d + 'T00:00:00Z')
const addDays = (d, n) => new Date(parseNaive(d) + n * DAY).toISOString().slice(0, 10)
const dayDiff = (a, b) => Math.round((parseNaive(b) - parseNaive(a)) / DAY)
const mondayOf = (d) => addDays(d, -((new Date(parseNaive(d)).getUTCDay() + 6) % 7))
const rate = (a, b) => (b > 0 ? +((a / b) * 100).toFixed(1) : null)

// 언바운드 커브에 노출할 오프셋(일). D0 = 가입 당일 활동(계측 커버리지 체크 겸용).
const CURVE_DAYS = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30]

// 기능별 사용 그룹핑 — 실제 이벤트 어휘(2026-08 기준 145종) 기반. 첫 매치 승.
// 새 이벤트는 매치 안 되면 'other'로 잡히므로 여기에 규칙만 추가하면 된다.
const FEATURE_RULES = [
  ['general', /^(session_start|landing|page_view|hero_cta_click|app_open|app_session_duration|view_app_promo_modal|click_app_download|app_review_prompt)$/],
  ['jobs', /^(view_jobs_page|click_job_card|view_job_detail|click_apply_button|submit_application|cancel_application|view_similar_jobs_modal|apply_similar_job|save_job|unsave_job|click_jobs_cta|job_title_ko|coldmail_job_apply)$/],
  ['salary', /^wizard_|^(submit_salary|result_gate_view|result_company_card_click|click_salary_hero|company_gate_click|company_gate_login_success|search_company)$/],
  ['cv', /^cv_|^(resume_upload|resume_public_on|resume_public_off|click_my_resume_nav|view_cv_popup|click_cv_popup|dismiss_cv_popup|click_cv_banner|view_cv_landing|click_cv_landing_cta|coldmail_resume_upload|kcv_view|click_korean_cv_nav)$/],
  ['community', /^(view_community|click_community|create_community|like_community|filter_community|search_community)/],
  ['ktc', /^ktc_|^click_ktc_nav$/],
  ['profile', /^profile_/],
  ['quiz', /^quiz_|^click_quiz_nav$/],
  ['photo', /^photo_claim_/],
  ['card', /^(view_card|open_card_design|save_card_design|share_card|share_card_unlock)$/],
  ['coldmail', /^coldmail_|^recommend_/], // recommend_* = 공고 추천(광고)메일 반응
  ['push', /^(push_click|push_received|view_notification_inbox|open_notification)$/],
  ['onboarding', /^(sign_up|click_login|view_login_page|click_welcome_bonus_)/],
]
// 기능 집계에서 아예 빼는 이벤트 — 발송 마커(활동 아님)·크론·어드민.
const NON_FEATURE = (ev) => /_sent$/.test(ev) || /^cron_/.test(ev) || ev === 'admin_action' || ev === 'changelog'
const FEATURE_WINDOW = 30 // 일 — MAU와 같은 창
// 주간 코호트 삼각표 최대 오프셋(W+0 ~ W+8) / 표시할 코호트 주 수(롤링).
const WEEK_OFFSETS = 8
const MAX_COHORT_WEEKS = 16

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  const platform = ['web', 'app'].includes(req.query.platform) ? req.query.platform : 'all'

  async function fetchAll(query) {
    let all = []
    let offset = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await query.range(offset, offset + PAGE - 1)
      if (error) throw error
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      offset += PAGE
    }
    return all
  }

  try {
    const todayVN = toVN(new Date().toISOString())

    // ---- 데이터 시작일: user_id 이벤트 첫 행(고정값 하드코딩 대신 실측) ----
    const { data: firstEv } = await supabase
      .from('events').select('created_at').not('user_id', 'is', null)
      .order('created_at', { ascending: true }).limit(1)
    const dataStart = firstEv?.[0] ? toVN(firstEv[0].created_at) : todayVN

    // ---- 전체 유저(내부/정지 계정 제외) ----
    let users = []
    let page = 1
    while (true) {
      const { data: { users: batch }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !batch || batch.length === 0) break
      users = users.concat(batch)
      if (batch.length < 1000) break
      page++
    }
    users = users.filter(u => !isExcludedSignup(u)).map(u => ({ id: u.id, day: toVN(u.created_at) }))
    const userDay = new Map(users.map(u => [u.id, u.day]))

    // ---- user_id 이벤트 전량 → 유저별/일별 활동 ----
    // ⚠ range 페이지네이션은 .order() 필수 — 정렬 없으면 행 누락/중복.
    const events = await fetchAll(
      supabase.from('events').select('event, user_id, meta, created_at')
        .not('user_id', 'is', null).order('created_at', { ascending: true })
    )

    const activeDaysByUser = new Map() // uid -> Set(VN day)
    const activeByDay = new Map()      // VN day -> Set(uid)
    for (const r of events) {
      // 발송 마커(push_sent·coldmail_*_sent 등)는 서버가 기록 — 유저 활동이 아니므로
      // 활성/리텐션 축에서 제외(앱 대시보드의 push_sent 제외와 동일 원칙).
      if (/_sent$/.test(r.event)) continue
      const uid = r.user_id
      if (!userDay.has(uid)) continue // 제외/삭제 계정
      const isApp = (r.meta && r.meta.platform) === 'app'
      if (platform === 'app' && !isApp) continue
      if (platform === 'web' && isApp) continue
      const d = toVN(r.created_at)
      if (!activeDaysByUser.has(uid)) activeDaysByUser.set(uid, new Set())
      activeDaysByUser.get(uid).add(d)
      if (!activeByDay.has(d)) activeByDay.set(d, new Set())
      activeByDay.get(d).add(uid)
    }

    // ---- 활성 요약: DAU(오늘) / WAU(7일) / MAU(30일) — 가입 시점 무관 전체 ----
    const unionDays = (n) => {
      const s = new Set()
      for (let i = 0; i < n; i++) {
        const set = activeByDay.get(addDays(todayVN, -i))
        if (set) for (const uid of set) s.add(uid)
      }
      return s.size
    }
    const dau = unionDays(1)
    const wau = unionDays(7)
    const mau = unionDays(30)

    // ---- 코호트 모집단(dataStart 이후 가입) + 유저별 최대 활동 오프셋 ----
    const cohortUsers = users.filter(u => u.day >= dataStart)
    const maxOffset = new Map() // uid -> 가입일 기준 마지막 활동 오프셋(일), 활동 없으면 미등록
    for (const u of cohortUsers) {
      const days = activeDaysByUser.get(u.id)
      if (!days) continue
      let max = -1
      for (const d of days) {
        const off = dayDiff(u.day, d)
        if (off > max) max = off
      }
      if (max >= 0) maxOffset.set(u.id, max)
    }

    // ---- 언바운드 리텐션 커브: eligible = 가입 N일 경과, retained = N일째 이후에도 활동 ----
    const curve = CURVE_DAYS.map(n => {
      const eligible = cohortUsers.filter(u => dayDiff(u.day, todayVN) >= n)
      let retained = 0
      for (const u of eligible) if ((maxOffset.get(u.id) ?? -1) >= n) retained++
      return { day: n, eligible: eligible.length, retained, rate: rate(retained, eligible.length) }
    })
    const curveAt = (n) => curve.find(c => c.day === n)

    // ---- 기능별 사용(최근 30일) — 어떤 기능이 잘 쓰이는지, 사용 유저/이벤트 수 ----
    const featSince = addDays(todayVN, -(FEATURE_WINDOW - 1))
    const featAgg = new Map() // key -> { users:Set, events:n, byEvent:Map(event -> Set(uid)) }
    for (const r of events) {
      if (NON_FEATURE(r.event)) continue
      if (!userDay.has(r.user_id)) continue
      const isApp = (r.meta && r.meta.platform) === 'app'
      if (platform === 'app' && !isApp) continue
      if (platform === 'web' && isApp) continue
      if (toVN(r.created_at) < featSince) continue
      const key = (FEATURE_RULES.find(([, re]) => re.test(r.event)) || ['other'])[0]
      if (!featAgg.has(key)) featAgg.set(key, { users: new Set(), events: 0, byEvent: new Map() })
      const f = featAgg.get(key)
      f.users.add(r.user_id)
      f.events++
      if (!f.byEvent.has(r.event)) f.byEvent.set(r.event, new Set())
      f.byEvent.get(r.event).add(r.user_id)
    }
    const features = [...featAgg.entries()]
      .map(([key, f]) => ({
        key,
        users: f.users.size,
        events: f.events,
        top: [...f.byEvent.entries()]
          .map(([event, s]) => ({ event, users: s.size }))
          .sort((a, b) => b.users - a.users).slice(0, 3),
      }))
      .sort((a, b) => b.users - a.users)

    // ---- 주간 코호트 삼각표(가입주 × W+0..W+8, 캘린더 주 기준) ----
    const curWeek = mondayOf(todayVN)
    const firstWeek = mondayOf(dataStart)
    const rollingFloor = addDays(curWeek, -(MAX_COHORT_WEEKS - 1) * 7)
    const startWeek = firstWeek > rollingFloor ? firstWeek : rollingFloor

    const activeWeeksByUser = new Map() // uid -> Set(monday)
    for (const [uid, days] of activeDaysByUser) {
      const s = new Set()
      for (const d of days) s.add(mondayOf(d))
      activeWeeksByUser.set(uid, s)
    }

    const byWeek = new Map() // monday -> [uid]
    for (const u of cohortUsers) {
      const w = mondayOf(u.day)
      if (w < startWeek) continue
      if (!byWeek.has(w)) byWeek.set(w, [])
      byWeek.get(w).push(u.id)
    }
    const cohorts = [...byWeek.keys()].sort().map(week => {
      const ids = byWeek.get(week)
      const cells = []
      for (let off = 0; off <= WEEK_OFFSETS; off++) {
        const target = addDays(week, off * 7)
        if (target > curWeek) { cells.push(null); continue }
        let active = 0
        for (const uid of ids) if (activeWeeksByUser.get(uid)?.has(target)) active++
        cells.push({ active, rate: rate(active, ids.length), partial: target === curWeek })
      }
      return { week, size: ids.length, cells }
    })

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      platform,
      meta: {
        dataStart, today: todayVN,
        totalUsers: users.length, cohortUsers: cohortUsers.length,
        weekOffsets: WEEK_OFFSETS, featureWindow: FEATURE_WINDOW,
      },
      summary: {
        dau, wau, mau,
        dauMau: rate(dau, mau), wauMau: rate(wau, mau),
        d1: curveAt(1), d7: curveAt(7), d30: curveAt(30),
      },
      curve,
      cohorts,
      features,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
