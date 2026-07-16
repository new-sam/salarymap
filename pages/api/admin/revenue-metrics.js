import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { isExcludedApplication } from '../../../lib/admin-metrics'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 어드민 · 이익 지원 지표: 우리 이익이 남는 두 창구의 지원을 한 화면에.
//  ① 기업 등록 공고 (jobs.company_id 있음, source='company_self')
//  ② KTC 시드 공고 (jobs.source='ktc', company_id 없음)
// 합계·비중 + 시계열(일/주/월용 최근 180일) + 유입 경로(application_source)·platform.
// '기업 채용 퍼널'(company-metrics.js)과 성격이 달라 별도 엔드포인트로 분리한다.

// 알려진 유입 경로 표시 순서. 그 외 값은 뒤에 덧붙인다.
const SOURCE_ORDER = ['direct', 'salary', 'cv_success', 'similar_after_apply', 'coldmail_jobs']

// 직접 지원(application_source='direct')의 유입 채널 귀속 — 지원 레코드의 utm/referrer 기준.
//  meta    = 유료 메타 광고 (utm_source=meta 또는 utm_medium=lead/paid/paid_social)
//  organic = 그 외 채널 신호가 있는 무료 유입 (태깅된 비-meta 소스 or FB/구글검색 referrer)
//  unknown = utm 없고 채널 referrer도 없음 (추적 유실 — '오가닉'으로 단정 못 함)
// user_profiles.utm이 전원 비어 유저 단위 귀속은 불가 → 지원 세션 기준. 미상은 별도 버킷.
const PAID_MED = new Set(['lead', 'paid', 'paid_social'])
const lc = (v) => (v || '').toLowerCase()
function channelOf(ap) {
  const src = lc(ap.utm_source), med = lc(ap.utm_medium), ref = lc(ap.referrer)
  if (src === 'meta' || PAID_MED.has(med)) return 'meta'
  if (src) return 'organic' // facebook/fb/threads/zalo 등 태깅된 비-meta 소스 = 오가닉 소셜
  if (/facebook/.test(ref) || /google\.com\/$|google\.com\.vn/.test(ref)) return 'organic' // FB 클릭 · 구글 검색
  return 'unknown' // utm 없음 + 채널 referrer 없음(로그인 리다이렉트·null 등)
}

// 1000행 캡 방어 — 조건에 맞는 지원을 페이지네이션으로 전부 긁어온다.
async function fetchAll(buildQuery) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await buildQuery().range(from, from + 999)
    if (error || !data || !data.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const SEL = 'created_at, applicant_email, application_source, platform, utm_source, utm_medium, referrer'
  // 내부/테스트(@likelion.net 등) 지원자는 두 창구 모두 동일하게 제외.
  const [companyRaw, ktcRaw, ktcJobsRes, companyJobsRes] = await Promise.all([
    fetchAll(() => supabase.from('job_applications').select(`${SEL}, jobs!inner(company_id)`).not('jobs.company_id', 'is', null)),
    fetchAll(() => supabase.from('job_applications').select(`${SEL}, jobs!inner(source)`).eq('jobs.source', 'ktc')),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('source', 'ktc').eq('is_active', true),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).not('company_id', 'is', null).eq('is_active', true),
  ])
  const companyApps = companyRaw.filter(ap => !isExcludedApplication(ap))
  const ktcApps = ktcRaw.filter(ap => !isExcludedApplication(ap))

  // 최근 180일 일별 시계열 — 프론트에서 일/주/월로 버킷팅. 베트남(UTC+7) 날짜 기준(봇과 일치).
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000)
  const y = vnNow.getUTCFullYear(), mo = vnNow.getUTCMonth(), todayDom = vnNow.getUTCDate()
  const vnDay = (ts) => ts ? new Date(new Date(ts).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) : ''
  // 각 일별 행은 3가지 보기 키를 모두 담는다: 창구(company/ktc) · 경로(src_*) · 직접채널(ch_*).
  const CH_KEYS = ['meta', 'organic', 'unknown']
  const zeroRow = () => {
    const r = { company: 0, ktc: 0 }
    SOURCE_ORDER.forEach(k => { r['src_' + k] = 0 })
    CH_KEYS.forEach(k => { r['ch_' + k] = 0 })
    return r
  }
  const daily = []
  const dayIdx = {}
  const todayVn = new Date(Date.UTC(y, mo, todayDom))
  for (let i = 179; i >= 0; i--) {
    const dt = new Date(todayVn); dt.setUTCDate(todayVn.getUTCDate() - i)
    const d = dt.toISOString().slice(0, 10)
    dayIdx[d] = daily.length
    daily.push({ date: d, ...zeroRow() })
  }
  const bucketApp = (ap, sideKey) => {
    const d = vnDay(ap.created_at); if (!(d in dayIdx)) return
    const row = daily[dayIdx[d]]
    row[sideKey] += 1                                                   // 창구: company | ktc
    const src = SOURCE_ORDER.includes(ap.application_source) ? ap.application_source : 'direct'
    row['src_' + src] += 1                                             // 경로
    if ((ap.application_source || 'direct') === 'direct') row['ch_' + channelOf(ap)] += 1 // 직접 채널
  }
  companyApps.forEach(ap => bucketApp(ap, 'company'))
  ktcApps.forEach(ap => bucketApp(ap, 'ktc'))

  // 유입 경로(application_source) — null은 DB 기본값과 동일하게 'direct' 취급. 기업/KTC 분리.
  const srcAgg = {}
  const addSrc = (ap, side) => { const k = ap.application_source || 'direct'; (srcAgg[k] = srcAgg[k] || { company: 0, ktc: 0 })[side] += 1 }
  companyApps.forEach(ap => addSrc(ap, 'company'))
  ktcApps.forEach(ap => addSrc(ap, 'ktc'))
  const sourceBreakdown = [...SOURCE_ORDER.filter(k => srcAgg[k]), ...Object.keys(srcAgg).filter(k => !SOURCE_ORDER.includes(k))]
    .map(k => ({ key: k, company: srcAgg[k].company, ktc: srcAgg[k].ktc, total: srcAgg[k].company + srcAgg[k].ktc }))
    .sort((a, b) => b.total - a.total)

  // 직접 지원의 유입 채널 (메타 광고 / 오가닉 / 미상) — 기업/KTC 분리. '직접 지원' 행 드릴다운용.
  const isDirect = (ap) => (ap.application_source || 'direct') === 'direct'
  const chAgg = { meta: { company: 0, ktc: 0 }, organic: { company: 0, ktc: 0 }, unknown: { company: 0, ktc: 0 } }
  companyApps.filter(isDirect).forEach(ap => { chAgg[channelOf(ap)].company += 1 })
  ktcApps.filter(isDirect).forEach(ap => { chAgg[channelOf(ap)].ktc += 1 })
  const directChannels = ['meta', 'organic', 'unknown'].map(k => ({ key: k, company: chAgg[k].company, ktc: chAgg[k].ktc, total: chAgg[k].company + chAgg[k].ktc }))

  // 플랫폼(web/app) — 옛 레코드는 미기록(null).
  const platform = { web: 0, app: 0, unknown: 0 }
  const addPlat = (ap) => { platform[ap.platform === 'web' ? 'web' : ap.platform === 'app' ? 'app' : 'unknown'] += 1 }
  companyApps.forEach(addPlat); ktcApps.forEach(addPlat)

  const applications = companyApps.length
  const ktcApplications = ktcApps.length
  const revenueApplications = applications + ktcApplications
  const overview = {
    applications,
    ktcApplications,
    revenueApplications,
    ktcShare: revenueApplications > 0 ? Math.round((ktcApplications / revenueApplications) * 1000) / 10 : 0,
    ktcJobsActive: ktcJobsRes.count || 0,
    companyJobsActive: companyJobsRes.count || 0,
  }

  return res.status(200).json({ overview, daily, sourceBreakdown, directChannels, platform })
}
