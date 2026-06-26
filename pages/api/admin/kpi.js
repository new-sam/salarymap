import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { EXCLUDED_EMAIL_DOMAINS } from '../../../lib/admin-metrics'

// FYI 12주 KPI 트래커 — 주간(W1~W12) 실측 집계.
//  · 유입단: Meta 광고비/노출/클릭/설치(Meta Marketing API) + 가입수(auth.users) → CPI·가입당비용·CTR·설치→가입전환율
//  · 작동단: 앱/웹 이벤트(user_id) + community_posts/comments + user_profiles
//      - ⭐ 작성자 비율 = 그 주 활성(로그인) 유저 중 글·댓글 쓴 비율
//      - ⭐ 참여 vs 비참여 치환율 차이 = (글·댓글 작성자 이력서등록률) ÷ (비작성자 이력서등록률)
//  · app/web 분리: 활성/작성자/글·댓글/작성자비율만 토글 가능(목표는 합산 기준). 가입·이력서·팔로우·치환율은 합산만(플랫폼 컬럼 없음).
//      - 활성 유저 = events.user_id(앱·웹 모두 로그인 시 기록) + meta.platform 으로 분리.
//      - 작성자/글·댓글 = community_posts/comments 테이블(정답·합산) 기준. 웹은 작성이벤트가 없어서,
//        앱 작성이벤트(create_community_*)로 '앱 작성자'를 식별하고 나머지를 웹으로 귀속.
//  · 목표선(가목표)은 프론트(KPIView)에서 주차밴드별로 표시. 여기선 실측만 책임진다.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// W1 시작 = 광고 실험 시작주의 월요일(VN). 12주 트래커의 기준점.
const W1_START = '2026-06-15'
const WEEKS = 12
const DAY = 86400000

// VN(UTC+7) 날짜 문자열 — 대시보드(toVN)와 동일 기준.
const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)
// naive(자정) 파싱 — 서버 TZ에 무관하게 캘린더 날짜 산술(기존 cohort 로직과 동일).
const parseNaive = (d) => new Date(d + 'T00:00:00').getTime()
const addDays = (d, n) => new Date(parseNaive(d) + n * DAY).toISOString().slice(0, 10)
const dayDiff = (a, b) => Math.round((parseNaive(b) - parseNaive(a)) / DAY)
const rate = (a, b) => (b > 0 ? +((a / b) * 100).toFixed(1) : null)
const ratio = (a, b) => (b > 0 ? +(a / b).toFixed(2) : null)

// 주차 인덱스(0~11). W1_START 이전이거나 12주 이후면 범위 밖.
const idxOf = (vnDay) => Math.floor(dayDiff(W1_START, vnDay) / 7)

// Meta Marketing API — 광고비/노출/클릭/설치 일별 pull. 토큰/계정ID 미설정이면 미연동으로 반환.
async function fetchMeta(sinceDay, untilDay) {
  const token = process.env.META_ACCESS_TOKEN
  const acct = process.env.META_AD_ACCOUNT_ID
  if (!token || !acct) return { configured: false, daily: [] }
  const act = acct.startsWith('act_') ? acct : `act_${acct}`
  const params = new URLSearchParams({
    fields: 'spend,impressions,clicks,actions',
    time_range: JSON.stringify({ since: sinceDay, until: untilDay }),
    time_increment: '1',
    level: 'account',
    access_token: token,
  })
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${act}/insights?${params}`)
    const j = await r.json()
    if (j.error) return { configured: true, error: j.error.message, daily: [] }
    // 설치 전환: action_type 가 앱 설치 계열인 항목 합산.
    const INSTALL = new Set(['mobile_app_install', 'omni_app_install', 'app_install'])
    const daily = (j.data || []).map((row) => {
      let installs = 0
      for (const a of row.actions || []) if (INSTALL.has(a.action_type)) installs += Number(a.value) || 0
      return {
        day: row.date_start, // YYYY-MM-DD (광고계정 TZ)
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        installs,
      }
    })
    return { configured: true, daily }
  } catch (e) {
    return { configured: true, error: e.message, daily: [] }
  }
}

const CREATE_EVENTS = ['create_community_post', 'create_community_comment']

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  const startISO = new Date(`${W1_START}T00:00:00+07:00`).toISOString()
  const todayVN = toVN(new Date().toISOString())
  const lastDay = addDays(W1_START, WEEKS * 7 - 1)

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
    // ---- 제외 user_id 집합(내부 도메인/정지 계정) + 가입 집계 ----
    // community.js와 동일 정책: 시드봇/팀 계정은 지표에서 제외.
    const excluded = new Set()
    const authUsers = []
    try {
      let page = 1
      while (true) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (error || !users || users.length === 0) break
        for (const u of users) {
          const banned = u.banned_until && new Date(u.banned_until) > new Date()
          const internal = u.email && EXCLUDED_EMAIL_DOMAINS.some((d) => u.email.endsWith('@' + d))
          if (banned || internal) excluded.add(u.id)
          else authUsers.push({ id: u.id, day: toVN(u.created_at) })
        }
        if (users.length < 1000) break
        page++
      }
    } catch (e) {
      // admin API 불가 — 제외 없이 전체 카운트로 진행.
    }
    const keep = (uid) => uid && !excluded.has(uid)

    // ---- 병렬 fetch ----
    const [events, posts, comments, profiles, follows, meta] = await Promise.all([
      // 로그인 이벤트(앱+웹). user_id 컬럼 = 양쪽 공통, meta.platform 으로 app/web 분리.
      fetchAll(
        supabase.from('events').select('event, user_id, meta, created_at').not('user_id', 'is', null).gte('created_at', startISO)
      ),
      // 글/댓글은 정답·합산 소스(치환율 누적 스냅샷 + 주별 작성자/카운트).
      fetchAll(supabase.from('community_posts').select('user_id, created_at')),
      fetchAll(supabase.from('community_comments').select('user_id, created_at')),
      fetchAll(
        supabase.from('user_profiles').select('id, resume_url, is_resume_public, verified_company_name')
      ),
      fetchAll(supabase.from('company_follows').select('user_id, created_at').gte('created_at', startISO)),
      fetchMeta(W1_START, todayVN <= lastDay ? todayVN : lastDay),
    ])

    // ---- 주차 누적기 ----
    const mk = () => Array.from({ length: WEEKS }, () => 0)
    const mkSet = () => Array.from({ length: WEEKS }, () => new Set())
    const inRange = (i) => i >= 0 && i < WEEKS

    const signups = mk()
    // 가입주 코호트(리텐션 분모) — auth.users 가입일 기준, 합산(가입엔 플랫폼 없음).
    const cohortSet = mkSet()
    // 활성(로그인) 유저 — 플랫폼별 + 합산
    const activeApp = mkSet(), activeWeb = mkSet(), activeAll = mkSet()
    // 앱 작성자(앱 create 이벤트 발사자) + 앱 작성이벤트 카운트 — 분리 귀속용
    const appWriterSet = mkSet()
    const appPostEv = mk(), appCommentEv = mk()
    // 글/댓글 테이블 기준(합산·정답)
    const writersTbl = mkSet()
    const postsTbl = mk(), commentsTbl = mk()
    const followsWk = mk()
    const acqWk = Array.from({ length: WEEKS }, () => ({ spend: 0, impressions: 0, clicks: 0, installs: 0 }))

    for (const u of authUsers) {
      const i = idxOf(u.day)
      if (inRange(i)) { signups[i]++; cohortSet[i].add(u.id) }
    }
    for (const r of events) {
      const uid = r.user_id
      if (!keep(uid)) continue
      const i = idxOf(toVN(r.created_at))
      if (!inRange(i)) continue
      const isApp = (r.meta && r.meta.platform) === 'app'
      activeAll[i].add(uid)
      ;(isApp ? activeApp[i] : activeWeb[i]).add(uid)
      if (isApp && CREATE_EVENTS.includes(r.event)) {
        appWriterSet[i].add(uid)
        if (r.event === 'create_community_post') appPostEv[i]++
        else appCommentEv[i]++
      }
    }
    for (const p of posts) {
      if (!keep(p.user_id)) continue
      const i = idxOf(toVN(p.created_at))
      if (inRange(i)) { postsTbl[i]++; writersTbl[i].add(p.user_id) }
    }
    for (const c of comments) {
      if (!keep(c.user_id)) continue
      const i = idxOf(toVN(c.created_at))
      if (inRange(i)) { commentsTbl[i]++; writersTbl[i].add(c.user_id) }
    }
    for (const f of follows) {
      if (!keep(f.user_id)) continue
      const i = idxOf(toVN(f.created_at))
      if (inRange(i)) followsWk[i]++
    }
    for (const d of meta.daily) {
      const i = idxOf(d.day)
      if (!inRange(i)) continue
      acqWk[i].spend += d.spend
      acqWk[i].impressions += d.impressions
      acqWk[i].clicks += d.clicks
      acqWk[i].installs += d.installs
    }

    // ---- 치환율 스냅샷(누적, 주말 기준): 작성자 vs 비작성자 이력서등록률 ----
    const writeDays = {} // uid -> 최초 작성 VN day (합산)
    for (const arr of [posts, comments]) {
      for (const r of arr) {
        if (!keep(r.user_id)) continue
        const d = toVN(r.created_at)
        if (!writeDays[r.user_id] || d < writeDays[r.user_id]) writeDays[r.user_id] = d
      }
    }
    // 프로필 상태 lookup(유저당 1행 아님 — 앱 가입자는 행이 없을 수 있어 분모는 auth.users로).
    const profMap = {}
    for (const p of profiles) {
      if (!keep(p.id)) continue
      profMap[p.id] = { hasResume: !!p.resume_url, isPublic: !!p.is_resume_public, verified: !!p.verified_company_name }
    }

    // ---- 주차별 행 빌드 ----
    const curIdx = idxOf(todayVN)
    const rows = Array.from({ length: WEEKS }, (_, i) => {
      const start = addDays(W1_START, i * 7)
      const end = addDays(W1_START, i * 7 + 6)
      const isFuture = i > curIdx

      // 유입 — Meta 실측 + DB 가입(합산).
      const a = acqWk[i]
      const su = signups[i]
      const acq = {
        signups: su,
        spend: meta.configured ? a.spend : null,
        impressions: meta.configured ? a.impressions : null,
        clicks: meta.configured ? a.clicks : null,
        installs: meta.configured ? a.installs : null,
        cpi: meta.configured ? ratio(a.spend, a.installs) : null,
        costPerSignup: meta.configured ? ratio(a.spend, su) : null,
        ctr: meta.configured ? rate(a.clicks, a.impressions) : null,
        installToSignup: meta.configured ? rate(su, a.installs) : null,
      }

      // 작동 — 플랫폼별 활성/작성자/글·댓글/작성자비율.
      const wAll = writersTbl[i].size
      let wApp = 0
      for (const uid of writersTbl[i]) if (appWriterSet[i].has(uid)) wApp++
      const wWeb = Math.max(0, wAll - wApp)
      const pAll = postsTbl[i], cAll = commentsTbl[i]
      const pApp = Math.min(appPostEv[i], pAll), cApp = Math.min(appCommentEv[i], cAll)
      const byPlatform = {
        all: { activeUsers: activeAll[i].size, writers: wAll, posts: pAll, comments: cAll, writerRatio: rate(wAll, activeAll[i].size) },
        app: { activeUsers: activeApp[i].size, writers: wApp, posts: pApp, comments: cApp, writerRatio: rate(wApp, activeApp[i].size) },
        web: { activeUsers: activeWeb[i].size, writers: wWeb, posts: pAll - pApp, comments: cAll - cApp, writerRatio: rate(wWeb, activeWeb[i].size) },
      }

      // 치환율 스냅샷(weekEnd 기준 누적, 합산). 분모 = 그 시점까지 가입한 전체 유저(auth.users).
      let pTot = 0, pRes = 0, nTot = 0, nRes = 0, verified = 0, resHolders = 0, pubHolders = 0, popTot = 0
      for (const u of authUsers) {
        if (u.day > end) continue // 아직 가입 전
        popTot++
        const pr = profMap[u.id] // 프로필 행이 없으면 미등록(이력서 없음)으로 간주
        if (pr?.verified) verified++
        if (pr?.hasResume) { resHolders++; if (pr.isPublic) pubHolders++ }
        const wrote = writeDays[u.id] && writeDays[u.id] <= end
        if (wrote) { pTot++; if (pr?.hasResume) pRes++ }
        else { nTot++; if (pr?.hasResume) nRes++ }
      }
      // 주간 리텐션 — 가입주(i) 코호트가 다음주(i+1)에도 활성(이벤트 1건+)인 비율. 합산 기준.
      //  · 다음주가 시작된 코호트만 산출. i+1==curIdx면 다음주 진행중 → partial(부분집계).
      const cohortSize = cohortSet[i].size
      let retention = null, retentionPartial = false
      if (i + 1 < WEEKS && i + 1 <= curIdx && cohortSize > 0) {
        let retained = 0
        for (const uid of cohortSet[i]) if (activeAll[i + 1].has(uid)) retained++
        retention = rate(retained, cohortSize)
        retentionPartial = i + 1 === curIdx
      }

      const convParticipant = rate(pRes, pTot)
      const convNon = rate(nRes, nTot)
      const act = {
        byPlatform,
        follows: followsWk[i],
        convParticipant,
        convNonParticipant: convNon,
        convRatio: convParticipant != null && convNon ? +(convParticipant / convNon).toFixed(2) : null,
        verifiedWorkers: verified,
        resumeRate: rate(resHolders, popTot),
        publicToggleRate: rate(pubHolders, resHolders),
        retention,
        retentionCohort: cohortSize,
        retentionPartial,
      }

      return { w: i + 1, start, end, isFuture, acq, act }
    })

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      w1Start: W1_START,
      weeks: WEEKS,
      currentWeek: inRange(curIdx) ? curIdx + 1 : curIdx < 0 ? 0 : WEEKS,
      meta: { configured: meta.configured, error: meta.error || null },
      rows,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
