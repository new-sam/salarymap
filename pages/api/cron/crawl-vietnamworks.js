import { createClient } from '@supabase/supabase-js'
import { guessRole } from '../../../lib/roleGuess'
import { LOCATION_OPTIONS } from '../../../constants/jobs'
import { fetchVwFullTexts, buildDescription } from '../../../lib/vietnamworksDetail'

// 적재 건당 상세 페이지 1회 fetch(전문 추출)가 붙어 기본 15초로는 모자란다.
export const config = { maxDuration: 300 }

// VietnamWorks 비개발 공고 수집.
// 인재풀이 개발 직군에 극편중(포지션 기입 778명 중 비개발 41명)이라, 비개발 지원자를 끌어올
// 공고 자체가 부족한 상태를 메운다. TopDev 크롤러(IT 전용)와 정반대로 개발 공고를 버린다.
//
// ⚠️ 검색 API의 jobFunction 필터 파라미터는 서버가 무시한다(필터를 걸어도 전체 건수가 그대로).
//    그래서 키워드로 조회한 뒤 응답에 들어있는 jobFunction.parentId로 직접 걸러낸다.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const API = 'https://ms.vietnamworks.com/job-search/v1.0/search'
const HITS = 50          // 페이지당 조회
const MAX_PAGES = 3      // 키워드당 조회 페이지
const PER_TARGET = 12    // 타깃당 1회 실행 신규 적재 상한 (?perTarget= 로 조정)
const USD_TO_VND = 25400 // 공고 급여 표시 단위가 VND 월급이라 USD 공고는 환산

// VietnamWorks jobFunction.parentId → 우리 canonical role(constants/jobs.js).
// fn: 허용 parentId(키워드 노이즈 제거용, null이면 파싱 결과를 그대로 신뢰)
// allow: 제목으로 세분화를 허용할 role — 없으면 target.role 로 고정한다.
const TARGETS = [
  { key: 'marketing', role: 'Marketing', fn: [17], queries: ['marketing', 'truyền thông'] },
  { key: 'sales', role: 'Sales', fn: [21], queries: ['nhân viên kinh doanh', 'sales executive'] },
  { key: 'hr', role: 'HR', fn: [12], queries: ['nhân sự', 'tuyển dụng'] },
  { key: 'finance', role: 'Finance', fn: [2, 10], queries: ['kế toán', 'tài chính'] },
  { key: 'design', role: 'Design', fn: [7], queries: ['thiết kế đồ họa', 'designer'] },
  { key: 'office', role: 'Operations', fn: [20, 6], queries: ['hành chính', 'chăm sóc khách hàng'], allow: ['Procurement'] },
  { key: 'logistics', role: 'Warehouse', fn: [13], queries: ['logistics', 'kho vận'], allow: ['Warehouse', 'Procurement'] },
  // 공장 QA는 소프트웨어 QA가 아니라 QC — 개발 직군 통계가 오염되지 않게 다시 매핑한다.
  { key: 'manufacturing', role: 'Production Worker', fn: [27], queries: ['sản xuất', 'vận hành máy'], allow: ['Production Manager', 'Maintenance', 'QC', 'QA', 'HSE', 'Merchandiser', 'Warehouse'], remap: { QA: 'QC' } },
  // 통·번역은 별도 jobFunction이 없어(사무행정으로 잡힘) 키워드만 신뢰한다.
  { key: 'interpreter', role: 'Interpreter', fn: null, queries: ['phiên dịch tiếng Hàn', 'biên dịch tiếng Hàn'] },
]

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const perTarget = Number(req.query.perTarget) || PER_TARGET
    const dryRun = req.query.dryRun === '1'
    const result = await crawlVietnamWorks(perTarget, dryRun)
    return res.status(200).json(result)
  } catch (err) {
    console.error('VietnamWorks crawl error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function crawlVietnamWorks(perTarget, dryRun) {
  // ⚠️ 페이지네이션 필수 — source_id 목록이 1000행에서 잘리면 중복 적재된다.
  const existingIds = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jobs')
      .select('source_id')
      .eq('source', 'vietnamworks')
      .range(from, from + 999)
    if (error) throw error
    for (const j of data || []) existingIds.add(j.source_id)
    if (!data || data.length < 1000) break
  }

  const today = new Date().toISOString().slice(0, 10)
  const results = []
  let totalInserted = 0

  for (const target of TARGETS) {
    const picked = new Map() // jobId → 원본 (키워드 간 중복 제거)

    for (const query of target.queries) {
      for (let page = 0; page < MAX_PAGES; page++) {
        if (picked.size >= perTarget) break
        const jobs = await search(query, page)
        if (!jobs.length) break

        for (const job of jobs) {
          const id = String(job.jobId || '')
          if (!id || existingIds.has(id) || picked.has(id)) continue
          if (!job.jobTitle || !job.companyName) continue
          if (target.fn && !target.fn.includes(job.jobFunction?.parentId)) continue
          if (job.expiredOn && job.expiredOn.slice(0, 10) < today) continue
          picked.set(id, job)
          if (picked.size >= perTarget) break
        }
        await sleep(400)
      }
      if (picked.size >= perTarget) break
    }

    let inserted = 0
    for (const job of picked.values()) {
      const record = mapToRecord(job, target)
      if (dryRun) { inserted++; continue }
      // 검색 API 는 상세를 요약본("..." 끝)으로만 주므로 공고 페이지에서 전문을 가져와
      // 교체한다. 실패하면 요약본이라도 유지.
      const full = await fetchVwFullTexts(job.jobUrl)
      if (full) {
        record.description = buildDescription(
          full.description || job.jobDescription,
          full.requirement || job.jobRequirement
        )
      }
      await sleep(300)
      const { error } = await supabase.from('jobs').insert(record)
      if (error) console.error(`Failed VW job ${job.jobId}:`, error.message)
      else { inserted++; existingIds.add(String(job.jobId)) }
    }

    totalInserted += inserted
    results.push({ target: target.key, role: target.role, matched: picked.size, inserted })
  }

  const deactivated = dryRun ? 0 : await deactivateExpired()
  return { dryRun, perTarget, totalInserted, deactivated, results }
}

async function search(query, page) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ userId: 0, query, filter: [], ranges: [], order: [], hitsPerPage: HITS, page }),
  })
  if (!resp.ok) return []
  const data = await resp.json()
  return data.data || []
}

function mapToRecord(job, target) {
  const loc = (job.workingLocations || [])[0] || {}
  const skills = (job.skills || []).map(s => s.skillName).filter(Boolean).slice(0, 10)
  const benefits = (job.benefits || [])
    .map(b => [b.benefitName, b.benefitValue].filter(Boolean).join(': '))
    .filter(s => s && s.length < 150)
    .slice(0, 10)

  const rate = job.salaryCurrency === 'USD' ? USD_TO_VND : 1
  const salaryMin = Math.round((job.salaryMin || 0) * rate)
  const salaryMax = Math.round((job.salaryMax || 0) * rate)

  return {
    title: job.jobTitle,
    company: job.companyName,
    company_initials: job.companyName.slice(0, 2).toUpperCase(),
    logo_url: job.companyLogo || null,
    location: simplifyLocation(loc),
    type: 'onsite',
    country: 'vietnam',
    role: pickRole(job.jobTitle, target),
    // yearsOfExperience 는 '무관'을 -1 로 보낸다.
    experience_min: Math.max(0, Number(job.yearsOfExperience) || 0),
    experience_max: 0,
    salary_min: salaryMin,
    salary_max: salaryMax,
    description: buildDescription(job.jobDescription, job.jobRequirement),
    is_active: true,
    tech_stack: skills,
    benefits,
    deadline: job.expiredOn ? job.expiredOn.slice(0, 10) : null,
    recruit_count: Number(job.numberOfRecruits) || null,
    apply_url: job.jobUrl || null,
    source: 'vietnamworks',
    source_id: String(job.jobId),
  }
}

// 제목으로 세분화가 의미 있는 타깃(생산/물류)만 guessRole 결과를 받아들이고,
// 나머지는 VietnamWorks 분류(jobFunction)를 신뢰해 target.role 로 고정한다.
function pickRole(title, target) {
  const g = guessRole(title)
  if (g && (target.allow || []).includes(g)) return target.remap?.[g] || g
  return target.role
}

function simplifyLocation(loc) {
  const vi = loc.cityNameVI || loc.cityName || ''
  const hit = LOCATION_OPTIONS.find(o => o === vi)
  return hit || vi
}

async function deactivateExpired() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('source', 'vietnamworks')
    .eq('is_active', true)
    .not('deadline', 'is', null)
    .lt('deadline', today)
    .select('id')
  return data?.length || 0
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
