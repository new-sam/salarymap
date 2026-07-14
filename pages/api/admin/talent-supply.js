import { createClient } from '@supabase/supabase-js'
import { verifyAdminOrDevStub } from './check'
import { ROLE_GROUPS } from '../../../constants/jobs'

// 인재 공급(Talent supply) 구성 — FYI에 등록한 인재풀을 "포지션(직군)"으로 분해해
// 기업 고객의 수요 포지션과 공급이 맞는지 매일 확인하기 위한 스냅샷.
//  · 퍼널 3단계: 전체 프로필 → 이력서 등록 → 활성(active).
//  · 활성 정의(OR): 최근 7일 방문(로그인 이벤트) · 채용 지원(job_applications) · 반복 방문(2일+).
//  · position은 드롭다운(enum)이지만 과거/앱/자유입력이 섞여 ~50종 free-text가 존재 →
//    normalizePosition으로 표준 직군 버킷에 매핑(휴리스틱). 매칭 안 되면 'other'.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DAY = 86400000
// VN(UTC+7) 날짜 문자열 — 앱/웹 대시보드와 동일 기준.
const toVN = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10)

// 표준 직군 카테고리 (group: tech = 개발직군, product = 개발 인접, nontech = 비개발, other = 미분류)
export const CATEGORIES = [
  { key: 'fullstack', ko: '풀스택', en: 'Fullstack', group: 'tech' },
  { key: 'backend', ko: '백엔드', en: 'Backend', group: 'tech' },
  { key: 'frontend', ko: '프론트엔드', en: 'Frontend', group: 'tech' },
  { key: 'mobile', ko: '모바일', en: 'Mobile', group: 'tech' },
  { key: 'data_ai', ko: '데이터·AI', en: 'Data/AI', group: 'tech' },
  { key: 'devops', ko: 'DevOps', en: 'DevOps', group: 'tech' },
  { key: 'qa', ko: 'QA', en: 'QA', group: 'tech' },
  { key: 'dev_generic', ko: '기타 개발', en: 'Other dev', group: 'tech' },
  { key: 'security', ko: '보안', en: 'Security', group: 'tech' },
  { key: 'design', ko: '디자인', en: 'Design', group: 'product' },
  { key: 'pm', ko: '기획·PM', en: 'PM/PO', group: 'product' },
  { key: 'marketing', ko: '마케팅', en: 'Marketing', group: 'nontech' },
  { key: 'sales_bd', ko: '영업·BD', en: 'Sales/BD', group: 'nontech' },
  { key: 'finance', ko: '재무·회계', en: 'Finance', group: 'nontech' },
  { key: 'hr', ko: '인사·HR', en: 'HR', group: 'nontech' },
  { key: 'procurement', ko: '구매·자재', en: 'Procurement', group: 'nontech' },
  { key: 'interpreter', ko: '통·번역', en: 'Interpreter', group: 'nontech' },
  { key: 'manufacturing', ko: '생산·제조', en: 'Manufacturing', group: 'nontech' },
  { key: 'operations', ko: '운영·기타직무', en: 'Ops/Other roles', group: 'nontech' },
  { key: 'other', ko: '미분류', en: 'Uncategorized', group: 'other' },
]

// 순서대로 첫 매칭 승 — 구체적인 직군을 일반 개발보다 먼저 검사.
const RULES = [
  ['fullstack', /full[\s-]?stack|풀스택/],
  ['backend', /back[\s-]?end|백엔드/],
  ['frontend', /front[\s-]?end|프론트|unity/],
  ['mobile', /\bmobile\b|android|\bios\b|flutter|react native|모바일/],
  ['data_ai', /\bdata\b|\bai\b|machine learning|\bml\b|analyst|scientist|데이터|인공지능/],
  ['devops', /devops|\binfra\b|\bsre\b|\bcloud\b|데브옵스/],
  ['qa', /\bqa\b|quality assurance|\btester\b|테스터|품질/],
  ['security', /security|보안|penetration|infosec|bảo mật/],
  ['design', /design|\bux\b|\bui\b|motion|디자인|그래픽/],
  ['pm', /\bpm\b|\bpo\b|product manager|product owner|project manager|delivery manager|기획|프로덕트/],
  ['marketing', /marketing|마케팅|growth|콘텐츠|content/],
  ['sales_bd', /\bsales?\b|business dev|\bbd\b|account exec|영업|세일즈/],
  ['finance', /finance|재무|회계|accountant|accounting|kế toán|tài chính/],
  ['hr', /\bhr\b|human resource|recruit|people ops|talent acquisition|인사|채용담당|리크루/],
  ['procurement', /procurement|purchas|구매|자재|thu mua|vật tư/],
  ['interpreter', /interpret|translat|통역|번역|phiên dịch|biên dịch/],
  ['manufacturing', /production|factory|manufactur|생산|공장|warehouse|창고|물류|maintenance|설비|\bhse\b|merchandis|nhà máy|sản xuất/],
  ['operations', /operation|운영|logistics|supply chain|store manager|retail|커머스|\bcs\b|고객|nhân viên|công nhân/],
  ['dev_generic', /develop|devlop|devop|engineer|software|\bit\b|\bdev\b|개발|프로그램|kỹ sư|coder|programmer|\bcio\b|\bcto\b|technical|엔지니어/],
]

// 공고 taxonomy(ROLE_GROUPS)의 canonical role.value → 대시보드 카테고리 키.
// 프로필 폼이 이제 ROLE_GROUPS 값을 그대로 저장하므로 정확 매칭이 우선(휴리스틱 RULES보다 앞).
const ROLE_TO_CAT = {
  Backend: 'backend', Frontend: 'frontend', Fullstack: 'fullstack', Mobile: 'mobile',
  Web: 'dev_generic', Embedded: 'dev_generic', Game: 'dev_generic',
  PM: 'pm', PO: 'pm', Design: 'design', 'UX Researcher': 'design',
  HR: 'hr', Marketing: 'marketing', Sales: 'sales_bd', Finance: 'finance',
  Operations: 'operations', Procurement: 'procurement', Interpreter: 'interpreter', 'Non-IT': 'operations',
}
// 세분 role을 개별 지정하지 않은 그룹은 대분류(영문 라벨) 단위 기본값으로.
const GROUP_EN_TO_CAT = {
  'Data': 'data_ai',
  'Infrastructure & Ops': 'devops',
  'Quality & Test': 'qa',
  'Security': 'security',
  'Architecture & Leadership': 'dev_generic',
  'Other Tech': 'dev_generic',
  'Manufacturing & Production': 'manufacturing',
}
const CANON = {}
for (const g of ROLE_GROUPS) for (const r of g.roles) {
  CANON[r.value.toLowerCase()] = ROLE_TO_CAT[r.value] || GROUP_EN_TO_CAT[g.label.en] || 'other'
}

export function normalizePosition(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return null // 미입력 — 카테고리와 별도로 '(unknown)'로 집계
  if (CANON[s]) return CANON[s] // 신 taxonomy 정확 매칭 우선
  for (const [key, re] of RULES) if (re.test(s)) return key
  return 'other'
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

export default async function handler(req, res) {
  const admin = await verifyAdminOrDevStub(req)
  if (!admin) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const nowMs = Date.now()
    const weekAgoISO = new Date(nowMs - 7 * DAY).toISOString()

    const [profiles, idEvents, apps] = await Promise.all([
      fetchAll('user_profiles', 'id, position, desired_roles, resume_url, is_resume_public'),
      // 로그인 식별 이벤트만(웹은 대부분 익명 client_id라 활성 판정은 로그인 유저 기준).
      fetchAll('events', 'user_id, created_at', q => q.not('user_id', 'is', null)),
      fetchAll('job_applications', 'user_id', q => q.not('user_id', 'is', null)),
    ])

    // ---- 활성 집합 계산 ----
    // recent7d: 최근 7일 방문 / repeat: 서로 다른 2일+ 방문(반복) / applied: 채용 지원 이력
    const recent7d = new Set()
    const daysByUser = {}
    for (const e of idEvents) {
      if (e.created_at >= weekAgoISO) recent7d.add(e.user_id)
      ;(daysByUser[e.user_id] || (daysByUser[e.user_id] = new Set())).add(toVN(e.created_at))
    }
    const applied = new Set(apps.map(a => a.user_id))
    const isActive = (id) =>
      recent7d.has(id) || applied.has(id) || (daysByUser[id] && daysByUser[id].size >= 2)

    // ---- 카테고리별 3단계 누적 ----
    const blank = () => ({ all: 0, resume: 0, resumePublic: 0, active: 0 })
    const cat = Object.fromEntries(CATEGORIES.map(c => [c.key, blank()]))
    const unknown = blank() // position 미입력
    const uncat = {}        // 'other'로 떨어진 원본 문자열 분포(검수용)

    const totals = {
      profiles: profiles.length,
      withPosition: 0,
      resumeHolders: 0,
      resumePublic: 0,
      activeAll: 0,
      activeResume: 0,
    }

    for (const p of profiles) {
      const hasResume = !!p.resume_url
      const isPub = hasResume && !!p.is_resume_public
      const act = isActive(p.id)
      if (act) totals.activeAll++

      let key = normalizePosition(p.position)
      // position 미입력이면 CV모달에서 고른 desired_roles(신 taxonomy)로 보완.
      let srcVal = p.position
      if (!key && Array.isArray(p.desired_roles) && p.desired_roles.length) {
        srcVal = p.desired_roles.find(v => String(v || '').trim()) || ''
        key = normalizePosition(srcVal)
      }
      const bucket = key ? cat[key] : unknown
      if (key) totals.withPosition++

      bucket.all++
      if (hasResume) { bucket.resume++; totals.resumeHolders++ }
      if (isPub) { bucket.resumePublic++; totals.resumePublic++ }
      if (hasResume && act) { bucket.active++; totals.activeResume++ }

      if (key === 'other') {
        const v = String(srcVal).trim()
        if (v) uncat[v] = (uncat[v] || 0) + 1
      }
    }

    const categories = CATEGORIES.map(c => ({ ...c, ...cat[c.key] }))
      .filter(c => c.all > 0)
      .sort((a, b) => b.all - a.all)

    // 개발 vs 비개발 요약(수요-공급 갭 판단용). product는 tech에 합산.
    const groupSum = (groups, field) =>
      categories.filter(c => groups.includes(c.group)).reduce((s, c) => s + c[field], 0)
    const split = {
      tech: { all: groupSum(['tech', 'product'], 'all'), resume: groupSum(['tech', 'product'], 'resume') },
      nontech: { all: groupSum(['nontech'], 'all'), resume: groupSum(['nontech'], 'resume') },
      other: { all: groupSum(['other'], 'all'), resume: groupSum(['other'], 'resume') },
    }

    res.setHeader('Cache-Control', 'no-store')
    res.json({
      generatedAt: new Date().toISOString(),
      totals,
      categories,
      unknown,
      split,
      uncategorized: Object.entries(uncat).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      activeDef: { windowDays: 7, note: 'recent 7d visit OR applied OR repeat visitor (2+ days). Login-identified events only.' },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
