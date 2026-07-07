import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { verifyAdminOrDevStub } from './check'

// 공고 제목(주로 베트남어) → 한국어. 짧은 제목 배치 1회(gpt-4o-mini)라 토큰 적음.
// 키 없거나 실패하면 원문 유지(폴백) — 절대 엔드포인트를 깨지 않음.
async function translateTitles(titles) {
  const uniq = [...new Set(titles.filter(Boolean))]
  if (!process.env.OPENAI_API_KEY || uniq.length === 0) return {}
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You translate job titles (mostly Vietnamese) into short natural Korean. Return JSON: {"t": {"<original>": "<korean>", ...}}. Keep each translation concise (role name only).' },
        { role: 'user', content: JSON.stringify(uniq) },
      ],
    })
    return JSON.parse(completion.choices[0].message.content || '{}').t || {}
  } catch {
    return {}
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 어드민 · 기업 지표 (초안): ① 회사 가입내역 ② ATS 활용/모집 내역.
// 광고로 유입되는 기업 계정과 그들의 채용(공고·지원) 활동을 한 화면에서 본다.
// 데이터: recruiter_companies / recruiter_users / jobs(company_id) / job_applications.

// 지원 파이프라인 단계 표준 순서 (job_applications.status). 실제 값은 pending/viewed/
// reviewing/decided 위주 — 미래에 새 값이 생겨도 누락되지 않게 실제 등장한 값만 이 순서로
// 정렬하고, 목록 밖 값은 뒤에 덧붙인다.
const STAGE_CANON = ['pending', 'applied', 'viewed', 'reviewing', 'decided', 'accepted', 'rejected']

// 공고(수요) 직군 분류 — 베트남어 블루칼라/제조·물류 위주 데이터에 맞춘 키워드 휴리스틱.
// 위에서부터 첫 매칭 승(구체적 직군을 일반보다 먼저). 매칭 안 되면 'other'.
export const DEMAND_CATEGORIES = [
  { key: 'dev', ko: '개발·IT' },
  { key: 'data', ko: '데이터·AI' },
  { key: 'design', ko: '디자인' },
  { key: 'pm', ko: '기획·PM' },
  { key: 'sales', ko: '영업·BD' },
  { key: 'marketing', ko: '마케팅' },
  { key: 'hr', ko: '인사·HR' },
  { key: 'qc', ko: '품질·QC' },
  { key: 'engineering', ko: '기술·설비(전기·기계)' },
  { key: 'production', ko: '생산·제조' },
  { key: 'logistics', ko: '물류·창고' },
  { key: 'office', ko: '사무·관리' },
  { key: 'exec', ko: '경영·임원' },
  { key: 'other', ko: '기타' },
]
const DEMAND_RULES = [
  ['data', /\bai\b|\bdata\b|machine learning|khoa học dữ liệu|dữ liệu|phân tích/],
  ['dev', /developer|software|lập trình|front[\s-]?end|back[\s-]?end|full[\s-]?stack|\bweb\b|\bit\b|coder|programmer|phần mềm|devops|software engineer/],
  ['hr', /tuyển dụng|nhân sự|đào tạo|\bhr\b|recruit|human resource|training/],
  ['qc', /\bqc\b|\bqa\b|chất lượng|kiểm tra|kiểm định|giám sát vệ sinh|vệ sinh công nghiệp|quality/],
  ['marketing', /marketing|social media|truyền thông|content|nội dung|\bseo\b|thương hiệu/],
  ['sales', /kinh doanh|bán hàng|\bsales?\b|business development|\bbd\b|telesales|chăm sóc khách|customer|\bcs\b/],
  ['design', /thiết kế đồ họa|đồ họa|graphic|\bui\b|\bux\b|designer|motion/],
  ['pm', /\bpm\b|\bpo\b|product manager|project manager|quản lý dự án|planner|kế hoạch/],
  ['exec', /giám đốc|\bdirector\b|head of|trưởng phòng|trưởng bộ phận|\bceo\b|\bcto\b|\bcfo\b|\bcoo\b|quản lý cấp cao/],
  ['engineering', /kỹ sư|kỹ thuật|cơ khí|cơ điện|\bđiện\b|điện tử|bảo trì|thiết bị|automation|m&e|xây dựng|công trình|thi công/],
  ['production', /sản xuất|quản đốc|công nhân|thợ|lắp ráp|tổ sơn|đứng máy|máy chấn|máy laser|máy hàn|hàn|\bmay\b|gia công|vận hành máy|đóng gói|dán tem|đúc|ép nhựa|dệt/],
  ['logistics', /\bkho\b|giao hàng|bốc hàng|soạn hàng|giao nhận|logistics|vận chuyển|xuất nhập|thu mua|procurement|supply chain|tài xế|lái xe|forklift/],
  ['office', /kế toán|hành chính|thư ký|secretary|văn phòng|admin|lễ tân|trợ lý|nhân viên văn phòng|pháp lý|legal|tài chính|finance/],
]
const CAT_KO = Object.fromEntries(DEMAND_CATEGORIES.map(c => [c.key, c.ko]))
export function classifyJobTitle(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return 'other'
  for (const [key, re] of DEMAND_RULES) if (re.test(s)) return key
  return 'other'
}

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // 회사 계정 + 멤버(리크루터)
  const { data: companiesRaw } = await supabase
    .from('recruiter_companies')
    .select('id, name, email_domain, verified_at, created_at')
    .order('created_at', { ascending: false })
  const companies = companiesRaw || []

  const { data: membersRaw } = await supabase
    .from('recruiter_users')
    .select('company_id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })
  const members = membersRaw || []
  const memberCount = {}
  members.forEach(m => { memberCount[m.company_id] = (memberCount[m.company_id] || 0) + 1 })

  // 기업 소유 공고 (company_id 있는 = 자체 등록). 크롤/내부 공고는 제외.
  const { data: jobsRaw } = await supabase
    .from('jobs')
    .select('id, company_id, title, status, is_active, created_at')
    .not('company_id', 'is', null)
    .order('created_at', { ascending: false })
  const jobs = jobsRaw || []
  const jobToCompany = {}
  jobs.forEach(j => { jobToCompany[j.id] = j.company_id })

  // 위 공고들에 대한 지원 + 단계
  const jobIds = jobs.map(j => j.id)
  let apps = []
  if (jobIds.length) {
    const { data: appsRaw } = await supabase
      .from('job_applications')
      .select('job_id, status')
      .in('job_id', jobIds)
    apps = appsRaw || []
  }

  // 회사별 집계
  const agg = {}
  const bump = (cid) => (agg[cid] = agg[cid] || { jobs: 0, live: 0, pending: 0, applications: 0, stages: {} })
  jobs.forEach(j => {
    const a = bump(j.company_id)
    a.jobs += 1
    if (j.status === 'pending_review') a.pending += 1
    else if (j.is_active) a.live += 1
  })
  const jobAppCount = {}       // job_id → 지원 수
  const jobStages = {}         // job_id → { status: count }  (공고별 단계)
  const stageTotals = {}       // 전체 단계별 지원 수
  apps.forEach(ap => {
    jobAppCount[ap.job_id] = (jobAppCount[ap.job_id] || 0) + 1
    const st = ap.status || 'applied'
    ;(jobStages[ap.job_id] = jobStages[ap.job_id] || {})[st] = (jobStages[ap.job_id][st] || 0) + 1
    stageTotals[st] = (stageTotals[st] || 0) + 1
    const cid = jobToCompany[ap.job_id]
    if (!cid) return
    const a = bump(cid)
    a.applications += 1
    a.stages[st] = (a.stages[st] || 0) + 1
  })

  // ① 회사 가입내역 — 계정별 요약 (최신 가입 순)
  const signups = companies.map(c => ({
    id: c.id,
    name: c.name,
    email_domain: c.email_domain,
    verified: !!c.verified_at,
    created_at: c.created_at,
    members: memberCount[c.id] || 0,
    jobs: agg[c.id]?.jobs || 0,
    live: agg[c.id]?.live || 0,
    applications: agg[c.id]?.applications || 0,
  }))

  // 이번 달 일별 유입 — 하루마다 신규 가입 기업 + 신규 공고 (광고 성과를 일 단위로)
  const now = new Date()
  const y = now.getUTCFullYear(), mo = now.getUTCMonth(), todayDom = now.getUTCDate()
  const daily = []
  const dayIdx = {}
  for (let i = 1; i <= todayDom; i++) {
    const d = new Date(Date.UTC(y, mo, i)).toISOString().slice(0, 10)
    dayIdx[d] = daily.length
    daily.push({ date: d, companies: 0, jobs: 0 })
  }
  companies.forEach(c => { const d = (c.created_at || '').slice(0, 10); if (d in dayIdx) daily[dayIdx[d]].companies += 1 })
  jobs.forEach(j => { const d = (j.created_at || '').slice(0, 10); if (d in dayIdx) daily[dayIdx[d]].jobs += 1 })
  const monthLabel = `${y}-${String(mo + 1).padStart(2, '0')}`

  const companyName = Object.fromEntries(companies.map(c => [c.id, c.name]))

  // 드릴다운: 리크루터(채용담당자) 목록 — 최신 가입 순
  const recruiters = members.map(m => ({
    email: m.email,
    name: m.full_name || null,
    role: m.role || null,
    company: companyName[m.company_id] || '(unknown)',
    created_at: m.created_at,
  }))

  // 제목 한국어 번역 (라이브, 폴백 있음)
  const koTitleMap = await translateTitles(jobs.map(j => j.title))

  // 드릴다운: 자체 공고 목록 — 지원 많은 순
  const jobsList = jobs.map(j => ({
    id: j.id,
    title: j.title || '(제목 없음)',
    titleKo: koTitleMap[j.title] || null,
    category: classifyJobTitle(j.title),
    categoryKo: CAT_KO[classifyJobTitle(j.title)],
    company_id: j.company_id,
    company: companyName[j.company_id] || '(unknown)',
    status: j.status,
    live: !!(j.is_active && j.status !== 'pending_review'),
    pending: j.status === 'pending_review',
    applications: jobAppCount[j.id] || 0,
    stages: jobStages[j.id] || {},
    created_at: j.created_at,
  })).sort((x, y) => y.applications - x.applications)

  // ② ATS 활용/모집 내역 — 자체 공고가 있는 회사만, 활동 많은 순
  const ats = Object.entries(agg)
    .filter(([, a]) => a.jobs > 0)
    .map(([cid, a]) => ({
      company_id: cid,
      name: companyName[cid] || '(unknown)',
      ...a,
      avgApps: a.jobs > 0 ? Math.round((a.applications / a.jobs) * 10) / 10 : 0,
    }))
    .sort((x, y) => y.applications - x.applications || y.jobs - x.jobs)

  // 직군(수요)별 집계 — 공고 수 / 지원 수 / 공고당 지원. 공고 많은 순.
  const catKo = Object.fromEntries(DEMAND_CATEGORIES.map(c => [c.key, c.ko]))
  const catAgg = Object.fromEntries(DEMAND_CATEGORIES.map(c => [c.key, { jobs: 0, applications: 0 }]))
  jobsList.forEach(j => { const a = catAgg[j.category] || catAgg.other; a.jobs += 1; a.applications += j.applications })
  const byCategory = DEMAND_CATEGORIES
    .map(c => ({ key: c.key, ko: c.ko, jobs: catAgg[c.key].jobs, applications: catAgg[c.key].applications, avgApps: catAgg[c.key].jobs > 0 ? Math.round((catAgg[c.key].applications / catAgg[c.key].jobs) * 10) / 10 : 0 }))
    .filter(c => c.jobs > 0)
    .sort((a, b) => b.jobs - a.jobs)
  // '기타(other)'로 떨어진 제목 — 규칙 보완 검수용
  const otherTitles = jobsList.filter(j => j.category === 'other').map(j => j.title)

  // 실제 등장한 단계만, 표준 순서로 (그 외 값은 뒤에 덧붙임)
  const present = new Set()
  Object.values(agg).forEach(a => Object.keys(a.stages).forEach(s => present.add(s)))
  const stageOrder = [
    ...STAGE_CANON.filter(s => present.has(s)),
    ...[...present].filter(s => !STAGE_CANON.includes(s)),
  ]

  const overview = {
    companies: companies.length,
    verified: companies.filter(c => c.verified_at).length,
    members: (membersRaw || []).length,
    jobsCompanySelf: jobs.length,
    jobsPending: jobs.filter(j => j.status === 'pending_review').length,
    jobsLive: jobs.filter(j => j.is_active && j.status !== 'pending_review').length,
    applications: apps.length,
    activeCompanies: ats.length, // 자체 공고를 하나라도 올린 회사
    // 공고당 평균 지원 = 지원이 1건+ 들어온 공고 기준(0 지원·미노출 공고 제외).
    // 공고 상태(라이브/paused)는 변동이 커 분모로 부적합 → 지원 유무로 고정.
    jobsWithApps: Object.keys(jobAppCount).length,
    avgAppsPerJob: Object.keys(jobAppCount).length > 0
      ? Math.round((apps.length / Object.keys(jobAppCount).length) * 10) / 10
      : 0,
  }

  return res.status(200).json({ overview, signups, daily, monthLabel, byCategory, otherTitles, ats, jobsList, recruiters, stageTotals, stageOrder })
}
