import { createClient } from '@supabase/supabase-js'
import { verifyAdmin } from './check'

// 앱(모바일) 행동지표 — events 테이블에서 meta.platform='app' 만 집계.
//  · 수집 명세: salary-fyi 모바일 src/lib/track.ts + docs/community-tracking.md
//  · 전략 톱라인(회의브리프): 앱 D7 잔존율 · 푸시 클릭(재방문) · 글당 답글 수
//  · 식별 축은 meta.client_id(영속 익명 디바이스 ID) — DAU/MAU·리텐션·동일유저 퍼널의 기준.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 앱 이벤트 수집 시작(이 이전엔 앱 트래픽 없음). 리텐션 first-seen 정확도를 위해 범위와 무관하게 이 시점부터 전부 읽는다.
const APP_EVENT_START = '2026-06-01'

const DAY = 86400000
// VN(UTC+7) 기준 날짜 문자열 — 웹 대시보드(toVN)와 동일 기준.
const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)

export default async function handler(req, res) {
  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  const { from, to } = req.query
  const endDate = to || new Date().toISOString().slice(0, 10)
  const startDate = from || new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10)
  // VN-day (UTC+7) bounds — matches toVN bucketing + retention day arithmetic below.
  const endISO = new Date(`${endDate}T23:59:59+07:00`).toISOString()
  const appStartISO = new Date(`${APP_EVENT_START}T00:00:00+07:00`).toISOString()

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
    // 앱 이벤트 전체(APP_EVENT_START~to) — 리텐션 first-seen은 전 기간, 볼륨 지표는 [from,to]로 필터.
    const rows = await fetchAll(
      supabase.from('events')
        .select('event, meta, created_at')
        .eq('meta->>platform', 'app')
        .gte('created_at', appStartISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: true })
    )

    const now = Date.now()
    const cid = (m) => (m && (m.client_id || m.user_id)) || null
    const inRange = (d) => d >= startDate && d <= endDate

    // ---- 단일 패스 누적기 ----
    const eventCounts = {}                 // [from,to] 범위 내 event별 카운트
    const dailyMap = {}                    // date -> { date, ...event counts }
    const firstSeen = {}                   // client_id -> 최초 VN date (전 기간)
    const activeDays = {}                  // client_id -> Set(VN date) (전 기간)
    const funnelSets = {}                  // step -> Set(client_id) (범위 내, 동일유저 퍼널)
    const setOf = (k) => (funnelSets[k] || (funnelSets[k] = new Set()))
    const osSet = {}, verSet = {}          // os/app_version -> Set(client_id) (범위 내)
    const catView = {}, catFilter = {}     // 커뮤니티 카테고리 분포 (범위 내)
    const searchQ = {}                     // 검색어 -> count (범위 내)
    const pushCat = {}                     // 푸시 category -> { click, received } (범위 내)
    const roleDist = {}, expDist = {}      // 연봉 제출 role/experience 분포 (범위 내)
    let anonPost = 0, anonComment = 0      // 익명 글/댓글 수 (범위 내, 분모는 create 카운트)

    const bumpDaily = (date, key) => {
      if (!dailyMap[date]) dailyMap[date] = { date }
      dailyMap[date][key] = (dailyMap[date][key] || 0) + 1
    }

    // ---- 분석가 모듈용 누적기 ----
    const firstSeenMs = {}                 // client -> 최초 관측 ms(VN)
    const rangeClients = new Set()         // [from,to] 내 활성 client (기능 채택 분모)
    const clientFeatures = {}              // client -> Set(feature) (범위 내)
    const actEvents = {}                   // client -> Set(event) (최초 ACT_WINDOW일 내, 액티베이션용)
    const ACT_WINDOW = 3                   // 신규유저 액티베이션 관측 창(일)
    const RET_MAX = 14                     // 언바운드 리텐션 커브 최대 offset(일)
    const dayMs = (d) => new Date(d + 'T00:00:00+07:00').getTime()
    // 이벤트 → 기능 버킷 (기능 채택률용)
    const featureOf = (e) => {
      if (e === 'submit_salary') return 'salary'
      if (e === 'resume_upload') return 'resume'
      if (e === 'push_click') return 'push'
      if (e === 'view_jobs_page' || e === 'click_job_card' || e === 'click_apply_button' || e === 'submit_application' || e === 'save_job') return 'jobs'
      if (e.indexOf('community') !== -1) return 'community'
      return null
    }

    for (const r of rows) {
      const m = r.meta || {}
      const date = toVN(r.created_at)
      const c = cid(m)
      const ev = r.event

      // --- 전 기간: 리텐션 축 ---
      if (c) {
        if (!firstSeen[c] || date < firstSeen[c]) firstSeen[c] = date
        const dms = dayMs(date)
        if (firstSeenMs[c] == null || dms < firstSeenMs[c]) firstSeenMs[c] = dms
        ;(activeDays[c] || (activeDays[c] = new Set())).add(date)
        // 액티베이션: 최초 관측일로부터 ACT_WINDOW일 이내 행동만 적재(범위 무관, rows는 오름차순이라 firstSeenMs 확정 상태)
        const off = Math.round((dms - firstSeenMs[c]) / DAY)
        if (off >= 0 && off <= ACT_WINDOW) (actEvents[c] || (actEvents[c] = new Set())).add(ev)
      }

      if (!inRange(date)) continue
      // --- 범위 내: 볼륨/분포/퍼널 ---
      if (c) {
        rangeClients.add(c)
        const f = featureOf(ev)
        if (f) (clientFeatures[c] || (clientFeatures[c] = new Set())).add(f)
      }
      eventCounts[ev] = (eventCounts[ev] || 0) + 1
      bumpDaily(date, ev)
      if (c) {
        if (m.os) (osSet[m.os] || (osSet[m.os] = new Set())).add(c)
        if (m.app_version) (verSet[m.app_version] || (verSet[m.app_version] = new Set())).add(c)
      }

      switch (ev) {
        case 'view_community': if (c) setOf('f_view').add(c); break
        case 'click_community_post': if (c) setOf('f_click').add(c); break
        case 'view_community_post':
          if (c) setOf('f_viewPost').add(c)
          if (m.category) catView[m.category] = (catView[m.category] || 0) + 1
          break
        case 'like_community_post':
        case 'create_community_comment':
          if (c) setOf('f_engage').add(c)
          if (ev === 'create_community_comment' && m.is_anonymous) anonComment++
          break
        case 'create_community_post':
          if (c) setOf('f_create').add(c)
          if (m.is_anonymous) anonPost++
          break
        case 'filter_community_category':
          if (m.category) catFilter[m.category] = (catFilter[m.category] || 0) + 1
          break
        case 'search_community':
          if (m.query) searchQ[m.query] = (searchQ[m.query] || 0) + 1
          break
        case 'submit_salary':
          if (m.role) roleDist[m.role] = (roleDist[m.role] || 0) + 1
          if (m.experience != null) expDist[String(m.experience)] = (expDist[String(m.experience)] || 0) + 1
          break
        case 'push_click': {
          const k = m.category || '(none)'
          ;(pushCat[k] || (pushCat[k] = { click: 0, received: 0 })).click++
          break
        }
        case 'push_received': {
          const k = m.category || '(none)'
          ;(pushCat[k] || (pushCat[k] = { click: 0, received: 0 })).received++
          break
        }
      }

      // 역할 집합(범위 내 고유 유저) — 작성자/반응자/열람자(1% 법칙)
      if (c) {
        if (ev === 'create_community_post' || ev === 'create_community_comment') setOf('creators').add(c)
        else if (ev === 'like_community_post' || ev === 'like_community_comment') setOf('reactors').add(c)
        else if (ev === 'view_community' || ev === 'view_community_post') setOf('viewers').add(c)
        // 전환 선행 게이트: 이력서→지원 연결용
        if (ev === 'resume_upload') setOf('resumeUsers').add(c)
        if (ev === 'submit_application') setOf('applyUsers').add(c)
        if (ev === 'submit_salary') setOf('salaryUsers').add(c)
        if (ev === 'push_click') setOf('pushClickUsers').add(c)
      }
    }

    // ---- 리텐션 (client_id 기준, 전 기간) ----
    // 기존 RetentionView와 동일 정의: eligible = (now-firstSeen)>=N일, retained = 최대 offset>=N (N일 후에도 활동).
    const clients = Object.keys(firstSeen)
    const maxOffset = (c) => {
      const f = new Date(firstSeen[c] + 'T00:00:00+07:00').getTime()
      let mx = 0
      for (const d of activeDays[c]) mx = Math.max(mx, Math.round((new Date(d + 'T00:00:00+07:00').getTime() - f) / DAY))
      return mx
    }
    const calcRet = (n) => {
      const eligible = clients.filter(c => (now - new Date(firstSeen[c] + 'T00:00:00+07:00').getTime()) >= n * DAY)
      const retained = eligible.filter(c => maxOffset(c) >= n)
      return { eligible: eligible.length, retained: retained.length, rate: eligible.length ? ((retained.length / eligible.length) * 100).toFixed(1) : '0' }
    }
    const d1 = calcRet(1), d7 = calcRet(7), d30 = calcRet(30)

    // 주간 코호트(가입주차 = first-seen 월요일 기준), W1~W4
    const cohortMap = {}
    for (const c of clients) {
      // For weekday math, parse as naive (UTC midnight) so getDate/getDay return
      // the same calendar date as the YYYY-MM-DD string. Using +07:00 here would
      // shift to the previous calendar day on a UTC server.
      const f = new Date(firstSeen[c] + 'T00:00:00')
      const mon = new Date(f); mon.setDate(f.getDate() - ((f.getDay() + 6) % 7))
      const wk = mon.toISOString().slice(0, 10)
      ;(cohortMap[wk] || (cohortMap[wk] = [])).push(c)
    }
    const cohorts = Object.entries(cohortMap).sort((a, b) => a[0].localeCompare(b[0])).map(([week, cs]) => ({
      week, total: cs.length,
      weeks: [1, 2, 3, 4].map(w => {
        const n = w * 7
        const eligible = cs.filter(c => (now - new Date(firstSeen[c] + 'T00:00:00+07:00').getTime()) >= n * DAY)
        if (!eligible.length) return null
        const retained = eligible.filter(c => maxOffset(c) >= n)
        return { eligible: eligible.length, retained: retained.length, rate: ((retained.length / eligible.length) * 100).toFixed(1) }
      }),
    }))

    // ---- DAU/WAU/MAU + 일별 활성(신규/재방문) (범위 내) ----
    const dayClients = {} // date -> Set(client)
    for (const c of clients) {
      for (const d of activeDays[c]) {
        if (!inRange(d)) continue
        ;(dayClients[d] || (dayClients[d] = new Set())).add(c)
      }
    }
    const wauSet = new Set(), mauSet = new Set()
    for (const c of clients) {
      for (const d of activeDays[c]) {
        const age = (now - new Date(d + 'T00:00:00+07:00').getTime())
        if (age < 7 * DAY) wauSet.add(c)
        if (age < 30 * DAY) mauSet.add(c)
      }
    }
    const dauSeries = Object.entries(dayClients).sort((a, b) => a[0].localeCompare(b[0])).map(([date, set]) => {
      let nu = 0
      for (const c of set) if (firstSeen[c] === date) nu++
      return { date, active: set.size, new: nu, returning: set.size - nu }
    })
    const lastDay = dauSeries[dauSeries.length - 1]

    // ---- 일별 시리즈 정렬 + 범위 전 날짜 채우기 ----
    const allDates = []
    // Iterate dates as labels: parse naive (UTC midnight) so .slice(0,10) returns
    // the same YYYY-MM-DD we want. Adding +07:00 here would emit the previous day.
    for (let cur = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T00:00:00'); cur <= end; cur.setDate(cur.getDate() + 1)) {
      allDates.push(cur.toISOString().slice(0, 10))
    }
    const daily = allDates.map(date => ({ date, ...(dailyMap[date] || {}) }))

    // ---- 헬퍼: 분포 → 정렬 배열 ----
    const cnt = (ev) => eventCounts[ev] || 0
    const sizeOf = (k) => (funnelSets[k] ? funnelSets[k].size : 0)
    const rate = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) : null)
    const distArr = (obj) => Object.entries(obj).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    const setDist = (obj) => Object.entries(obj).map(([name, s]) => ({ name, count: s.size })).sort((a, b) => b.count - a.count)

    // ---- 커뮤니티 ----
    const posts = cnt('create_community_post')
    const comments = cnt('create_community_comment')
    const community = {
      funnel: {
        view: cnt('view_community'),
        click: cnt('click_community_post'),
        viewPost: cnt('view_community_post'),
        engage: cnt('like_community_post') + cnt('create_community_comment'),
        create: posts,
        // 동일유저(client_id) 단계별 도달 수
        uView: sizeOf('f_view'), uClick: sizeOf('f_click'), uViewPost: sizeOf('f_viewPost'),
        uEngage: sizeOf('f_engage'), uCreate: sizeOf('f_create'),
      },
      ctr: rate(cnt('click_community_post'), cnt('view_community')),                 // 글 클릭률
      engageRate: rate(cnt('like_community_post') + cnt('create_community_comment'), cnt('view_community_post')),
      writeConv: rate(posts, cnt('click_community_write')),                          // 작성 전환율
      posts, comments,
      commentsPerPost: posts > 0 ? (comments / posts).toFixed(2) : '0',
      anonPostRate: rate(anonPost, posts),
      anonCommentRate: rate(anonComment, comments),
      creators: sizeOf('creators'), reactors: sizeOf('reactors'), viewers: sizeOf('viewers'),
      categoriesViewed: distArr(catView),
      categoriesFiltered: distArr(catFilter),
      topSearches: distArr(searchQ).slice(0, 20),
    }

    // ---- 핵심 전환 ----
    const conversion = {
      jobs: {
        view: cnt('view_jobs_page'), card: cnt('click_job_card'), apply: cnt('click_apply_button'),
        submit: cnt('submit_application'), save: cnt('save_job'),
        viewRate: rate(cnt('click_job_card'), cnt('view_jobs_page')),
        applyRate: rate(cnt('click_apply_button'), cnt('click_job_card')),
        submitRate: rate(cnt('submit_application'), cnt('click_apply_button')),  // 핵심 누수(이력서 게이트)
        saveRate: rate(cnt('save_job'), cnt('click_job_card')),
      },
      salary: {
        count: cnt('submit_salary'),
        uniqueUsers: sizeOf('salaryUsers'),
        byRole: distArr(roleDist),
        byExperience: distArr(expDist),
      },
      resume: {
        uploads: cnt('resume_upload'),
        uploadUsers: sizeOf('resumeUsers'),
        applyUsers: sizeOf('applyUsers'),
        // 이력서 올린 유저 중 지원 완료 유저 비율
        uploadToApply: rate(
          [...(funnelSets.resumeUsers || [])].filter(c => funnelSets.applyUsers && funnelSets.applyUsers.has(c)).length,
          sizeOf('resumeUsers')
        ),
      },
    }

    // ---- 푸시 (재참여 엔진) ----
    const push = {
      clicks: cnt('push_click'),
      clickUsers: sizeOf('pushClickUsers'),
      received: cnt('push_received'),       // 포그라운드 수신만(OS 한계)
      byCategory: Object.entries(pushCat).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.click - a.click),
      // 정상 CTR(클릭/발송)의 분모(발송수)는 서버 발송 로그가 출처 — 여기선 클릭 볼륨/유저만 책임.
      ctrNote: 'sent_denominator_server_side',
    }

    // ---- 세그먼트 ----
    const segments = { os: setDist(osSet), appVersion: setDist(verSet) }

    // ===== 분석가 모듈 =====
    const weekOf = (dstr) => {
      // 월요일 시작 ISO주. 요일 계산은 naive(UTC자정) 파싱 — cohort 로직과 동일.
      const f = new Date(dstr + 'T00:00:00')
      const mon = new Date(f); mon.setDate(f.getDate() - ((f.getDay() + 6) % 7))
      return mon.toISOString().slice(0, 10)
    }

    // 1) 스티키니스 — 평균 DAU 기준 DAU/MAU·WAU/MAU + 기간 신규유저
    const avgDau = dauSeries.length ? Math.round(dauSeries.reduce((a, s) => a + s.active, 0) / dauSeries.length) : 0
    const stickiness = {
      avgDau,
      dauMau: mauSet.size ? ((avgDau / mauSet.size) * 100).toFixed(1) : null,
      wauMau: mauSet.size ? ((wauSet.size / mauSet.size) * 100).toFixed(1) : null,
    }
    const newUsersInRange = clients.filter(c => inRange(firstSeen[c])).length

    // 2) 언바운드 리텐션 커브(D0~RET_MAX) — offset별 eligible/retained
    const offsetsByClient = {}
    for (const c of clients) {
      const s = new Set()
      for (const d of activeDays[c]) s.add(Math.round((dayMs(d) - firstSeenMs[c]) / DAY))
      offsetsByClient[c] = s
    }
    const retentionCurve = []
    for (let n = 0; n <= RET_MAX; n++) {
      const elig = clients.filter(c => (now - firstSeenMs[c]) >= n * DAY)
      const ret = elig.filter(c => offsetsByClient[c].has(n))
      retentionCurve.push({ day: n, eligible: elig.length, retained: ret.length, rate: elig.length ? ((ret.length / elig.length) * 100).toFixed(1) : null })
    }

    // 3) 신규유저 액티베이션 퍼널 — 코호트=범위 내 최초관측 & 관측창 경과, 최초 ACT_WINDOW일 내 행동
    const cohort = clients.filter(c => inRange(firstSeen[c]) && (now - firstSeenMs[c]) >= ACT_WINDOW * DAY)
    const hasAny = (c, arr) => { const s = actEvents[c]; return !!s && arr.some(e => s.has(e)) }
    const A_VIEW = ['view_jobs_page', 'view_community']
    const A_ENGAGE = ['click_job_card', 'click_community_post', 'view_community_post', 'search_community', 'save_job', 'filter_community_category']
    const A_CONVERT = ['submit_salary', 'submit_application', 'create_community_post', 'create_community_comment', 'resume_upload']
    const aView = cohort.filter(c => hasAny(c, A_VIEW)).length
    const aEngage = cohort.filter(c => hasAny(c, A_ENGAGE)).length
    const aConvert = cohort.filter(c => hasAny(c, A_CONVERT)).length
    const activation = {
      window: ACT_WINDOW, cohort: cohort.length, view: aView, engage: aEngage, convert: aConvert,
      viewRate: rate(aView, cohort.length), engageRate: rate(aEngage, cohort.length), convertRate: rate(aConvert, cohort.length),
    }

    // 4) 그로스 어카운팅(주간) — new/retained/resurrected/churned + Quick Ratio
    const clientWeeks = {}
    for (const c of clients) { const s = new Set(); for (const d of activeDays[c]) s.add(weekOf(d)); clientWeeks[c] = s }
    const firstWeek = {}; for (const c of clients) firstWeek[c] = weekOf(firstSeen[c])
    const allWeeks = [...new Set(clients.flatMap(c => [...clientWeeks[c]]))].sort()
    const prevWeekStr = (w) => { const d = new Date(w + 'T00:00:00'); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
    const growthWeeks = allWeeks.map(w => {
      const pw = prevWeekStr(w)
      let nu = 0, ret = 0, resur = 0, ch = 0
      for (const c of clients) {
        const a = clientWeeks[c].has(w), p = clientWeeks[c].has(pw)
        if (a) { if (firstWeek[c] === w) nu++; else if (p) ret++; else resur++ }
        else if (p) ch++
      }
      return { week: w, new: nu, retained: ret, resurrected: resur, churned: ch, wau: nu + ret + resur, quickRatio: ch > 0 ? ((nu + resur) / ch).toFixed(2) : null }
    })

    // 5) 인게이지먼트 깊이 — 파워유저 곡선(범위 내 활성일수 분포)
    const powerBuckets = { '1': 0, '2': 0, '3': 0, '4-5': 0, '6-7': 0, '8+': 0 }
    let rangeClientCount = 0
    for (const c of clients) {
      let cnt = 0; for (const d of activeDays[c]) if (inRange(d)) cnt++
      if (cnt === 0) continue
      rangeClientCount++
      const b = cnt >= 8 ? '8+' : cnt >= 6 ? '6-7' : cnt >= 4 ? '4-5' : String(cnt)
      powerBuckets[b]++
    }
    const powerCurve = Object.entries(powerBuckets).map(([name, count]) => ({ name, count }))
    const multiDayRate = rate(rangeClientCount - powerBuckets['1'], rangeClientCount)

    // 6) 기능 채택률 + 멀티기능 중첩
    const FEATURES = ['community', 'jobs', 'salary', 'resume', 'push']
    const featureCounts = Object.fromEntries(FEATURES.map(f => [f, 0]))
    const fcDist = {}
    for (const c of Object.keys(clientFeatures)) {
      const s = clientFeatures[c]
      for (const f of s) if (featureCounts[f] != null) featureCounts[f]++
      fcDist[s.size] = (fcDist[s.size] || 0) + 1
    }
    const featDenom = rangeClients.size || 1
    const featureAdoption = FEATURES.map(f => ({ name: f, count: featureCounts[f], rate: rate(featureCounts[f], featDenom) }))
    const featureCountDist = Object.entries(fcDist).map(([n, count]) => ({ n: Number(n), count })).sort((a, b) => a.n - b.n)

    const analytics = {
      stickiness, newUsersInRange, retentionCurve, activation,
      growth: { weeks: growthWeeks, latest: growthWeeks.length ? growthWeeks[growthWeeks.length - 1] : null },
      depth: { powerCurve, rangeClients: rangeClientCount, multiDayRate, featureAdoption, featureCountDist, featureDenom: featDenom },
    }

    // ---- 웹 모달 → 앱스토어 유도 (web 이벤트라 platform='app' 필터에서 제외됨, 별도 집계) ----
    const promoStartISO = new Date(`${startDate}T00:00:00+07:00`).toISOString()
    const promoRows = await fetchAll(
      supabase.from('events')
        .select('event')
        .in('event', ['view_app_promo_modal', 'click_app_download'])
        .gte('created_at', promoStartISO)
        .lte('created_at', endISO)
    )
    let promoImpr = 0, promoClick = 0
    for (const r of promoRows) {
      if (r.event === 'view_app_promo_modal') promoImpr++
      else if (r.event === 'click_app_download') promoClick++
    }
    const webAppPromo = {
      impressions: promoImpr,
      clicks: promoClick,
      ctr: promoImpr > 0 ? ((promoClick / promoImpr) * 100).toFixed(1) : null,
    }

    // ---- 응답 ----
    res.setHeader('Cache-Control', 'no-store')
    res.json({
      webAppPromo,
      meta: {
        appEventStart: APP_EVENT_START,
        totalAppEvents: rows.length,
        rangeEvents: Object.values(eventCounts).reduce((a, b) => a + b, 0),
        from: startDate, to: endDate,
      },
      topline: {
        d7,                                                  // 앱 D7 잔존율 (최우선)
        commentsPerPost: community.commentsPerPost,          // 글당 답글 수 (커뮤니티 생존)
        pushClicks: push.clicks, pushClickUsers: push.clickUsers, // 푸시 재방문 (엔진)
      },
      retention: {
        dau: lastDay ? lastDay.active : 0,
        wau: wauSet.size, mau: mauSet.size,
        d1, d7, d30, cohorts, dauSeries,
      },
      community,
      conversion,
      push,
      segments,
      analytics,
      eventCounts: distArr(eventCounts),
      daily,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
