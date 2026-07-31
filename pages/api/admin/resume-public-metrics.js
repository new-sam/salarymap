import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedSignup } from '../../../lib/admin-metrics'
import { CATEGORIES, normalizePosition } from './talent-supply'

// 목표지표 대시보드 — 이력서 공개 전환.
// 공개 = 우리 공개 인재풀 노출(is_resume_public). 외부 인재마켓(VTM) 전송은 폐지됐다.
//
// 일별 전환은 DB 트리거가 심는 resume_public_on/off 이벤트로만 센다(20260731 마이그레이션).
// 트리거 적용 전 구간은 일별 데이터가 없다 — 프로필 updated_at 버킷으로 추정하지 않는다.
// 그건 '오늘 공개함'이 아니라 '오늘 프로필을 수정함'이라 지표를 부풀린다(7/14 착시의 원인).
//
// 코호트(주차)는 가입일(created_at) 기준 — 이력서 업로드 시각 컬럼이 없어서 쓰는 근사치다.
// /cv 랜딩은 가입과 업로드가 같은 세션이라 최근 구간은 거의 일치하고, 옛 유저일수록 어긋난다.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000
const vnDay = (iso) => new Date(new Date(iso).getTime() + ICT_OFFSET_MS).toISOString().slice(0, 10)
const vnWeek = (iso) => {
  const d = new Date(new Date(iso).getTime() + ICT_OFFSET_MS)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) // 월요일 시작
  return d.toISOString().slice(0, 10)
}

const WEEKS = 10
const DAILY_DAYS = 21

// 8월 목표(승주, 마감 8/10). "등록 인재풀" = 이력서를 올린 회원, "등록 비율" = 가입자 중 그 비율.
// 개발:비개발은 직군 분류(talent-supply와 동일 normalizePosition) 기준이고,
// 기획·디자인(product)은 비개발에 포함한다. 한국어/영어는 목표선 없이 현황만 본다.
const GOAL = { deadline: '2026-08-10', pool: 1500, rate: 0.5, techShare: 0.6 }

const GROUP_OF = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.group]))
// position이 비면 desired_roles로 폴백 — 인재 공급/비개발 풀 탭과 같은 규칙.
const roleGroup = (p) => {
  let key = normalizePosition(p.position)
  if (!key && Array.isArray(p.desired_roles) && p.desired_roles.length) {
    key = normalizePosition(p.desired_roles.find((v) => String(v || '').trim()) || '')
  }
  if (!key) return 'unknown'
  const g = GROUP_OF[key]
  return g === 'tech' ? 'tech' : g === 'other' ? 'unknown' : 'nontech' // product(기획·디자인)는 비개발
}

// 어학은 이력서 파싱이 채우는 자유 텍스트('Intermediate','IELTS 6.0','Sơ cấp'…).
// 수준을 나누는 기준이 없어 "기재 있음"으로만 세고, 명시적 없음만 걸러낸다.
const hasCert = (v) => {
  const s = String(v || '').trim()
  return !!s && !/^(none|n\/a|na|no|없음|không|-)$/i.test(s)
}

async function fetchAll(build) {
  const PAGE = 1000
  let all = []
  let from = 0
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

  try {
    const [rows, coldmailConverts, coldmailSends, publicEvents] = await Promise.all([
      // 목표의 분모가 '전체 가입자'라 이력서 없는 프로필까지 다 받고 여기서 가른다.
      fetchAll(() => supabase.from('user_profiles')
        .select('id, email, created_at, is_resume_public, resume_platform, resume_url, position, desired_roles, korean_cert, english_cert')),
      fetchAll(() => supabase.from('events')
        .select('user_id, created_at').eq('event', 'coldmail_public_convert')),
      fetchAll(() => supabase.from('events')
        .select('user_id').eq('event', 'coldmail_public_sent').not('user_id', 'is', null)),
      fetchAll(() => supabase.from('events')
        .select('event, created_at, user_id, meta')
        .in('event', ['resume_public_on', 'resume_public_off'])
        .order('created_at', { ascending: true })),
    ])

    const signups = rows.filter((r) => !isExcludedSignup(r))
    const profiles = signups.filter((r) => r.resume_url)
    const cmUsers = new Set(coldmailConverts.map((e) => e.user_id))
    // 콜드메일 전환은 go-public 이 공개 처리 직후 같은 초에 이벤트를 남긴다 → 유저+날짜로 붙인다.
    const cmDayKeys = new Set(coldmailConverts.map((e) => `${e.user_id}|${vnDay(e.created_at)}`))

    // ---- 스냅샷 총계 ----
    const isPublic = (r) => !!r.is_resume_public
    const publicRows = profiles.filter(isPublic)
    const totals = {
      resumes: profiles.length,
      public: publicRows.length,
      private: profiles.length - publicRows.length,
      rate: profiles.length ? publicRows.length / profiles.length : 0,
      coldmailAttributed: publicRows.filter((r) => cmUsers.has(r.id)).length,
    }

    // ---- 플랫폼별 (콜드메일 귀속 분리) ----
    // resume_platform 은 20260617 마이그 이후 등록분에만 있다 → 그 전은 'unknown'.
    const platKey = (r) => (r.resume_platform === 'app' ? 'app' : r.resume_platform === 'web' ? 'web' : 'unknown')
    const platforms = {}
    for (const key of ['app', 'web', 'unknown']) platforms[key] = { key, reg: 0, pub: 0, coldmail: 0 }
    for (const r of profiles) {
      const p = platforms[platKey(r)]
      p.reg++
      if (isPublic(r)) {
        p.pub++
        if (cmUsers.has(r.id)) p.coldmail++
      }
    }
    const platformList = Object.values(platforms).map((p) => ({
      ...p,
      organic: p.pub - p.coldmail,
      rate: p.reg ? p.pub / p.reg : 0,
      organicRate: p.reg ? (p.pub - p.coldmail) / p.reg : 0,
    }))

    // ---- 주차 코호트 (가입 주차 기준) ----
    const weeks = {}
    const weekStart = vnWeek(new Date(Date.now() - (WEEKS - 1) * 7 * 86400000).toISOString())
    for (const r of profiles) {
      const w = vnWeek(r.created_at)
      if (w < weekStart) continue
      weeks[w] = weeks[w] || {
        week: w,
        web: { reg: 0, pub: 0, coldmail: 0 },
        app: { reg: 0, pub: 0, coldmail: 0 },
        unknown: { reg: 0, pub: 0, coldmail: 0 },
      }
      const c = weeks[w][platKey(r)]
      c.reg++
      if (isPublic(r)) {
        c.pub++
        if (cmUsers.has(r.id)) c.coldmail++
      }
    }
    const weekly = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).map((w) => ({
      week: w.week,
      web: { ...w.web, organic: w.web.pub - w.web.coldmail },
      app: { ...w.app, organic: w.app.pub - w.app.coldmail },
      unknown: { ...w.unknown, organic: w.unknown.pub - w.unknown.coldmail },
    }))

    // ---- 비공개 풀 (앞으로 전환시킬 재고) ----
    // 콜드메일을 계속 돌리므로 "이미 한 번 받은 사람 / 아직 안 받은 사람"을 갈라둔다 — 재발송 대상 산정용.
    // 발송 이벤트에 user_id가 없는 건(KTC 등 비회원 대상)은 애초에 이 풀에 없으니 제외해도 무방.
    const sentUsers = new Set(coldmailSends.map((e) => e.user_id))
    const privateRows = profiles.filter((r) => !isPublic(r))
    const ageDays = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000
    const privatePool = {
      total: privateRows.length,
      d7: privateRows.filter((r) => ageDays(r.created_at) <= 7).length,
      d30: privateRows.filter((r) => ageDays(r.created_at) <= 30).length,
      d90: privateRows.filter((r) => ageDays(r.created_at) <= 90).length,
      coldmailed: privateRows.filter((r) => sentUsers.has(r.id)).length,
      unsent: privateRows.filter((r) => !sentUsers.has(r.id)).length,
      byPlatform: privateRows.reduce((a, r) => ({ ...a, [platKey(r)]: (a[platKey(r)] || 0) + 1 }), {}),
    }

    // ---- 8월 목표 진행 ----
    // ⚠️ 이력서를 '언제' 올렸는지 컬럼이 없어 신규 등록 속도는 가입일로 근사한다.
    //    /cv 유입은 가입과 업로드가 같은 세션이라 최근 구간은 거의 맞고, 옛 유저일수록 어긋난다.
    const newResumes = (n) => profiles.filter((r) => ageDays(r.created_at) <= n).length
    const mixOf = (list) => {
      const m = { tech: 0, nontech: 0, unknown: 0 }
      for (const r of list) m[roleGroup(r)]++
      m.classified = m.tech + m.nontech
      m.techShare = m.classified ? m.tech / m.classified : 0
      return m
    }
    const langOf = (list) => {
      const l = { en: 0, ko: 0, both: 0, total: list.length }
      for (const r of list) {
        const en = hasCert(r.english_cert)
        const kr = hasCert(r.korean_cert)
        if (en) l.en++
        if (kr) l.ko++
        if (en && kr) l.both++
      }
      l.either = l.en + l.ko - l.both
      return l
    }
    const daysLeft = Math.max(0, Math.ceil((new Date(`${GOAL.deadline}T23:59:59+07:00`).getTime() - Date.now()) / 86400000))
    const goal = {
      deadline: GOAL.deadline,
      daysLeft,
      pool: {
        current: profiles.length,
        target: GOAL.pool,
        d7: newResumes(7),
        d30: newResumes(30),
        // 남은 기간 동안 하루에 몇 명을 더 받아야 하는지 vs 최근 7일 실제 속도
        needPerDay: daysLeft ? Math.ceil(Math.max(0, GOAL.pool - profiles.length) / daysLeft) : null,
        actualPerDay: Math.round((newResumes(7) / 7) * 10) / 10,
      },
      rate: {
        current: signups.length ? profiles.length / signups.length : 0,
        target: GOAL.rate,
        signups: signups.length,
      },
      mix: { registered: mixOf(profiles), public: mixOf(publicRows), targetTech: GOAL.techShare },
      lang: { registered: langOf(profiles), public: langOf(publicRows) },
    }

    // ---- 일별 실제 전환 (트리거 이벤트) ----
    const days = {}
    for (let i = DAILY_DAYS - 1; i >= 0; i--) {
      const d = vnDay(new Date(Date.now() - i * 86400000).toISOString())
      days[d] = { day: d, on: 0, off: 0, web: 0, app: 0, unknown: 0, coldmail: 0 }
    }
    // 트리거는 팀 계정 flip도 그대로 잡으므로 지표에서 빼는 유저(likelion 등)는 여기서 거른다.
    const countedUsers = new Set(profiles.map((r) => r.id))
    for (const e of publicEvents) {
      const d = days[vnDay(e.created_at)]
      if (!d || !countedUsers.has(e.user_id)) continue
      if (e.event === 'resume_public_off') { d.off++; continue }
      d.on++
      const p = e.meta?.platform === 'app' ? 'app' : e.meta?.platform === 'web' ? 'web' : 'unknown'
      d[p]++
      if (cmDayKeys.has(`${e.user_id}|${vnDay(e.created_at)}`)) d.coldmail++
    }
    const daily = Object.values(days).map((d) => ({ ...d, net: d.on - d.off }))

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      goal,
      totals,
      platforms: platformList,
      weekly,
      privatePool,
      daily,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
