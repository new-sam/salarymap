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
  const endISO = `${endDate}T23:59:59`

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
        .gte('created_at', `${APP_EVENT_START}T00:00:00`)
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

    for (const r of rows) {
      const m = r.meta || {}
      const date = toVN(r.created_at)
      const c = cid(m)
      const ev = r.event

      // --- 전 기간: 리텐션 축 ---
      if (c) {
        if (!firstSeen[c] || date < firstSeen[c]) firstSeen[c] = date
        ;(activeDays[c] || (activeDays[c] = new Set())).add(date)
      }

      if (!inRange(date)) continue
      // --- 범위 내: 볼륨/분포/퍼널 ---
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
      const f = new Date(firstSeen[c] + 'T00:00:00').getTime()
      let mx = 0
      for (const d of activeDays[c]) mx = Math.max(mx, Math.round((new Date(d + 'T00:00:00').getTime() - f) / DAY))
      return mx
    }
    const calcRet = (n) => {
      const eligible = clients.filter(c => (now - new Date(firstSeen[c] + 'T00:00:00').getTime()) >= n * DAY)
      const retained = eligible.filter(c => maxOffset(c) >= n)
      return { eligible: eligible.length, retained: retained.length, rate: eligible.length ? ((retained.length / eligible.length) * 100).toFixed(1) : '0' }
    }
    const d1 = calcRet(1), d7 = calcRet(7), d30 = calcRet(30)

    // 주간 코호트(가입주차 = first-seen 월요일 기준), W1~W4
    const cohortMap = {}
    for (const c of clients) {
      const f = new Date(firstSeen[c] + 'T00:00:00')
      const mon = new Date(f); mon.setDate(f.getDate() - ((f.getDay() + 6) % 7))
      const wk = mon.toISOString().slice(0, 10)
      ;(cohortMap[wk] || (cohortMap[wk] = [])).push(c)
    }
    const cohorts = Object.entries(cohortMap).sort((a, b) => a[0].localeCompare(b[0])).map(([week, cs]) => ({
      week, total: cs.length,
      weeks: [1, 2, 3, 4].map(w => {
        const n = w * 7
        const eligible = cs.filter(c => (now - new Date(firstSeen[c] + 'T00:00:00').getTime()) >= n * DAY)
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
        const age = (now - new Date(d + 'T00:00:00').getTime())
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

    // ---- 응답 ----
    res.setHeader('Cache-Control', 'no-store')
    res.json({
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
      eventCounts: distArr(eventCounts),
      daily,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
