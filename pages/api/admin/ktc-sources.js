import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedApplication } from '../../../lib/admin-metrics'

// KTC 소싱 채널 비교 — KTC 공고에 지원자를 모아준 채널별(ITviec/LinkedIn/landing/TopDev/…)
// 볼륨·추이·질(파이프라인 통과율)을 비교한다. FYI의 채용 플랫폼 효용 판단용.
//  · 타 플랫폼: ktc_candidates (ktc-support Supabase에서 동기화, 탭 내 유니크 지원자 기준)
//  · FYI: 시트 탭이 한참 뒤처져 있어(116 vs 실제 ~500) salarymap DB에서 라이브로 집계
//  · 크로스탭 FYI 열: 회사명 정규화 + 제목 포함관계로 공고코드 행에 매칭 (미매칭은 별도 행)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// VN(UTC+7) 기준 월/일 버킷 (예: '2026-05', '2026-05-14')
const toVNMonth = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 7)
const toVNDate = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)

const normCompany = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
// 제목 정규화: 괄호 내용·기호 제거, 표기 흔들림 통일 → 포함관계 매칭용
const normTitle = (s) => String(s || '')
  .replace(/\(.*?\)/g, ' ')
  .toLowerCase()
  .replace(/full[\s-]?stack/g, 'fullstack')
  .replace(/front[\s-]?end/g, 'frontend')
  .replace(/back[\s-]?end/g, 'backend')
  .replace(/[^a-z0-9가-힣]/g, '')

// 회사명 표기 흔들림 병합 (candidates 쪽 변형 → 대표 표기)
const COMPANY_ALIAS = { fptsoftware: 'fptsoftwarekorea' }
const canonCompany = (s) => {
  const n = normCompany(s)
  return COMPANY_ALIAS[n] || n
}

async function fetchAll(table, select, tweak) {
  let all = [], offset = 0
  for (;;) {
    let q = supabase.from(table).select(select).range(offset, offset + 999)
    if (tweak) q = tweak(q)
    const { data, error } = await q
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
    offset += 1000
  }
  return all
}

// 파이프라인(ktc-support 기준): new(스크리닝 대기) → passed(스크리닝 합격) →
// ai_interview_sent/done/passed → final_passed(최종 합격). 탈락 = screening_failed·rejected.
// 서류통과 = 스크리닝 합격 "이상" 전부 (AI 인터뷰 단계·최종 합격 포함 — 이미 스크리닝은 통과한 상태).
const DOC_PASS_STATUSES = new Set(['passed', 'ai_interview_sent', 'ai_interview_done', 'ai_interview_passed', 'final_passed'])

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // 기간 필터 (지원일 기준, VN 날짜). 지정 시 날짜 파싱 안 된 소수 행은 귀속 불가라 제외.
    const { from, to } = req.query
    const inRange = (iso) => {
      if (!iso) return false
      const d = toVNDate(iso)
      return (!from || d >= from) && (!to || d <= to)
    }
    const filtering = Boolean(from || to)

    const [candidates, applications, ktcJobs] = await Promise.all([
      fetchAll('ktc_candidates', 'sheet_source, email, applied_company, applied_job, position, job_code, applied_at, pipeline_status, synced_at'),
      // 지원 "건" 원본 (중복 포함, 시트 직행). 테이블 미적재 시 빈 배열로 폴백.
      fetchAll('ktc_applications', 'sheet_source, applied_at').catch(() => []),
      fetchAll('jobs', 'id, title, company, is_active', q => q.eq('source', 'ktc')),
    ])
    const jobIds = ktcJobs.map(j => j.id)
    let fyiApps = []
    for (let i = 0; i < jobIds.length; i += 50) {
      fyiApps = fyiApps.concat(await fetchAll(
        'job_applications', 'job_id, applicant_email, user_id, created_at',
        q => q.in('job_id', jobIds.slice(i, i + 50))
      ))
    }
    fyiApps = fyiApps.filter(a => !isExcludedApplication(a) && (!filtering || inRange(a.created_at)))

    // ---- FYI 라이브: 공고별 유니크 지원자 (타 플랫폼과 동일 기준) ----
    const fyiByJob = {}       // job_id → Set(지원자 키)
    const fyiMonths = {}      // month → Set(지원자 키) — 플랫폼 표의 월별 유니크
    const fyiJobMonths = {}   // job_id → { month → Set(지원자 키) } — 공고 표의 월별
    const fyiAll = new Set()
    for (const a of fyiApps) {
      const who = (a.applicant_email || '').toLowerCase() || a.user_id || `${a.job_id}-anon`
      ;(fyiByJob[a.job_id] || (fyiByJob[a.job_id] = new Set())).add(who)
      const m = toVNMonth(a.created_at)
      ;(fyiMonths[m] || (fyiMonths[m] = new Set())).add(who)
      const jm = fyiJobMonths[a.job_id] || (fyiJobMonths[a.job_id] = {})
      ;(jm[m] || (jm[m] = new Set())).add(who)
      fyiAll.add(who)
    }

    // ---- 플랫폼별 집계 (시트 FYI 탭은 라이브로 대체하므로 제외) ----
    const rows = candidates.filter(c => c.sheet_source !== 'FYI' && (!filtering || inRange(c.applied_at)))
    const platforms = {}
    for (const c of rows) {
      const p = platforms[c.sheet_source] || (platforms[c.sheet_source] = { key: c.sheet_source, total: 0, months: {}, docPass: 0, finalPassed: 0 })
      p.total++
      if (c.applied_at) {
        const m = toVNMonth(c.applied_at)
        p.months[m] = (p.months[m] || 0) + 1
      }
      if (DOC_PASS_STATUSES.has(c.pipeline_status)) p.docPass++
      if (c.pipeline_status === 'final_passed') p.finalPassed++
    }

    // ---- 채널별 지원 "건" (중복 포함, ktc_applications) ----
    const appRows = applications.filter(a => !filtering || inRange(a.applied_at))
    for (const a of appRows) {
      const p = platforms[a.sheet_source] || (platforms[a.sheet_source] = { key: a.sheet_source, total: 0, months: {}, docPass: 0, finalPassed: 0 })
      p.appsTotal = (p.appsTotal || 0) + 1
      if (a.applied_at) {
        const m = toVNMonth(a.applied_at)
        const am = p.appsMonths || (p.appsMonths = {})
        am[m] = (am[m] || 0) + 1
      }
    }
    // FYI 지원 건 월별 (raw, 유니크 아님)
    const fyiAppsMonths = {}
    for (const a of fyiApps) {
      const m = toVNMonth(a.created_at)
      fyiAppsMonths[m] = (fyiAppsMonths[m] || 0) + 1
    }

    // ---- 공고(코드) × 플랫폼 크로스탭 ----
    // 행 키: job_code 우선, 없으면 정규화한 공고명. FYI 라이브는 회사+제목 매칭으로 행에 합류.
    const jobRows = {}
    for (const c of rows) {
      // 코드 없는 행은 회사+제목으로 키 구성 (흔한 제목이 회사 간 합쳐지지 않도록)
      const key = c.job_code || (c.applied_job ? `t:${canonCompany(c.applied_company)}:${normTitle(c.applied_job)}` : null)
      if (!key) continue
      const r = jobRows[key] || (jobRows[key] = {
        code: c.job_code, label: null, company: null, byPlatform: {}, fyi: 0, total: 0, months: {}, platformMonths: {},
        _labels: {}, _positions: {}, _companies: {}, _normTitles: new Set(),
      })
      r.byPlatform[c.sheet_source] = (r.byPlatform[c.sheet_source] || 0) + 1
      r.total++
      if (c.applied_at) {
        const m = toVNMonth(c.applied_at)
        r.months[m] = (r.months[m] || 0) + 1
        const pm = r.platformMonths[c.sheet_source] || (r.platformMonths[c.sheet_source] = {})
        pm[m] = (pm[m] || 0) + 1
      }
      if (c.applied_job) {
        r._labels[c.applied_job] = (r._labels[c.applied_job] || 0) + 1
        r._normTitles.add(normTitle(c.applied_job.replace(/^[A-Z]{2,6}\d{3,4}\s*[-:._]*\s*/, '')))
      }
      if (c.position) {
        r._positions[c.position] = (r._positions[c.position] || 0) + 1
        r._normTitles.add(normTitle(c.position))
      }
      if (c.applied_company) {
        const canon = canonCompany(c.applied_company)
        const e = r._companies[canon] || (r._companies[canon] = { name: c.applied_company, count: 0 })
        e.count++
      }
    }
    for (const r of Object.values(jobRows)) {
      // 제목: applied_job 최빈값에서 코드 접두 제거 → 비면 position 최빈값 → 최후에 코드
      const top = Object.entries(r._labels).sort((a, b) => b[1] - a[1])[0]
      const cleaned = top ? top[0].replace(/^[A-Z]{2,6}\d{3,4}\s*[-:._]*\s*/, '').trim() : ''
      const topPos = Object.entries(r._positions).sort((a, b) => b[1] - a[1])[0]
      r.label = cleaned || (topPos ? topPos[0] : r.code)
      // 지배적 회사만 채택 — 소수 오입력(다른 회사 1~2건)이 매칭을 오염시키지 않도록
      const topComp = Object.entries(r._companies).sort((a, b) => b[1].count - a[1].count)[0]
      r._canonCompany = topComp ? topComp[0] : null
      r.company = topComp ? topComp[1].name : null
    }

    // 코드 없이 적재된 행을 같은 회사+제목의 코드 행에 병합 (랜딩 일부 행이 코드 없이 들어옴)
    const titlesOverlap = (a, b) =>
      [...a._normTitles].some(t1 => t1 && [...b._normTitles].some(t2 => t2 && (t1.includes(t2) || t2.includes(t1))))
    for (const [key, r] of Object.entries(jobRows)) {
      if (r.code || !r._canonCompany) continue
      const target = Object.values(jobRows).find(o => o.code && o._canonCompany === r._canonCompany && titlesOverlap(o, r))
      if (!target) continue
      for (const [p, n] of Object.entries(r.byPlatform)) target.byPlatform[p] = (target.byPlatform[p] || 0) + n
      for (const [m, n] of Object.entries(r.months)) target.months[m] = (target.months[m] || 0) + n
      for (const [p, pm] of Object.entries(r.platformMonths)) {
        const t = target.platformMonths[p] || (target.platformMonths[p] = {})
        for (const [m, n] of Object.entries(pm)) t[m] = (t[m] || 0) + n
      }
      target.total += r.total
      r._normTitles.forEach(t => target._normTitles.add(t))
      delete jobRows[key]
    }

    // FYI 라이브를 크로스탭 행에 매칭: 같은 회사(지배적, 정규화) + 제목 포함관계
    const unmatched = []
    for (const j of ktcJobs) {
      const n = fyiByJob[j.id] ? fyiByJob[j.id].size : 0
      if (!n) continue
      const jc = canonCompany(j.company)
      const jt = normTitle(j.title)
      const hit = Object.values(jobRows).find(r =>
        r._canonCompany === jc &&
        [...r._normTitles].some(t => t && jt && (t.includes(jt) || jt.includes(t)))
      )
      const jm = Object.fromEntries(Object.entries(fyiJobMonths[j.id] || {}).map(([m, s]) => [m, s.size]))
      if (hit) {
        hit.fyi += n
        hit.total += n
        for (const [m, c] of Object.entries(jm)) hit.months[m] = (hit.months[m] || 0) + c
        const pm = hit.platformMonths.FYI || (hit.platformMonths.FYI = {})
        for (const [m, c] of Object.entries(jm)) pm[m] = (pm[m] || 0) + c
      } else {
        unmatched.push({ code: null, label: j.title, company: j.company, byPlatform: {}, fyi: n, total: n, months: jm, platformMonths: { FYI: jm } })
      }
    }

    // ---- 랜딩 유입 상세 (ktc-landing DB 라이브): UTM 소스/캠페인/랜딩 내 위치 × 월 ----
    let landing = null
    if (process.env.KTC_LANDING_SUPABASE_URL && process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY) {
      const landingDb = createClient(process.env.KTC_LANDING_SUPABASE_URL, process.env.KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const apps = []
      for (let off = 0; ; off += 1000) {
        const { data, error } = await landingDb
          .from('applications')
          .select('source, utm_source, utm_campaign, created_at')
          .range(off, off + 999)
        if (error) throw error
        apps.push(...data)
        if (data.length < 1000) break
      }
      const inScope = apps.filter(a => !filtering || inRange(a.created_at))
      const agg = (field) => {
        const map = {}
        for (const a of inScope) {
          const k = (a[field] || '').trim() || '(direct)'
          const e = map[k] || (map[k] = { key: k, total: 0, months: {} })
          e.total++
          const m = toVNMonth(a.created_at)
          e.months[m] = (e.months[m] || 0) + 1
        }
        return Object.values(map).sort((a, b) => b.total - a.total)
      }
      landing = {
        total: inScope.length,
        utmSources: agg('utm_source'),
        campaigns: agg('utm_campaign'),
        pageSources: agg('source'),
      }
    }

    // ---- 채널별 입사 귀속 (ktc_hires × 이메일 조인) — 기간 필터 무관 누적 ----
    let hires = null
    const hireRows = await fetchAll('ktc_hires', '*').catch(() => [])
    if (hireRows.length) {
      // 이메일 → 최초 유입 채널 (candidates는 이미 전역 유니크·최초 채널 귀속)
      const chanByEmail = {}
      for (const c of candidates) {
        const e = (c.email || '').toLowerCase()
        if (e && !chanByEmail[e]) chanByEmail[e] = c.sheet_source === 'FYI' ? 'FYI' : c.sheet_source
      }
      const fyiEmails = new Set(fyiApps.map(a => (a.applicant_email || '').toLowerCase()).filter(Boolean))
      const rows = hireRows.map(h => {
        const e = (h.email || '').toLowerCase()
        const viaFyi = fyiEmails.has(e)
        const channel = chanByEmail[e] || (viaFyi ? 'FYI' : null)
        return {
          name: h.full_name, company: h.company, position: h.position1 || h.position2,
          status: h.status, onboarding: h.hired_at || h.onboarding_raw, leftAt: h.left_at,
          revenue: h.revenue_usd, profit: h.profit_usd,
          channel, viaFyi,
        }
      })
      const byChannel = {}
      for (const r of rows) {
        const k = r.channel || '_unattributed'
        const e = byChannel[k] || (byChannel[k] = { key: k, hires: 0, revenue: 0, profit: 0 })
        e.hires++
        e.revenue += r.revenue || 0
        e.profit += r.profit || 0
      }
      hires = {
        total: rows.length,
        viaFyi: rows.filter(r => r.viaFyi).length,
        attributed: rows.filter(r => r.channel).length,
        byChannel: Object.values(byChannel).sort((a, b) => b.hires - a.hires),
        rows,
      }
    }

    const platformList = Object.values(platforms).sort((a, b) => b.total - a.total)
    const monthSet = new Set(Object.keys(fyiMonths))
    for (const p of platformList) Object.keys(p.months).forEach(m => monthSet.add(m))
    const months = [...monthSet].sort()

    const jobList = [...Object.values(jobRows), ...unmatched]
      .map(({ _labels, _positions, _companies, _normTitles, _canonCompany, ...r }) => r)
      .sort((a, b) => b.total - a.total)

    const syncedAt = candidates.reduce((mx, c) => (c.synced_at > mx ? c.synced_at : mx), '')

    res.json({
      syncedAt,
      months,
      platforms: platformList.map(({ key, total, months: m, docPass, finalPassed, appsTotal, appsMonths }) => ({
        key, total, months: m, docPass, finalPassed,
        appsTotal: appsTotal || 0, appsMonths: appsMonths || {},
      })),
      hasApplications: applications.length > 0,
      landing,
      hires,
      fyi: {
        total: fyiAll.size,
        applications: fyiApps.length,
        months: Object.fromEntries(Object.entries(fyiMonths).map(([m, s]) => [m, s.size])),
        appsMonths: fyiAppsMonths,
      },
      jobs: jobList,
      totals: {
        candidates: rows.length,
        activeKtcJobs: ktcJobs.filter(j => j.is_active).length,
        ktcJobs: ktcJobs.length,
      },
    })
  } catch (e) {
    console.error('ktc-sources:', e)
    res.status(500).json({ error: e.message })
  }
}
