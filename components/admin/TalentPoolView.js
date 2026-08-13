import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAdmin } from '../../lib/adminSwr'
import { isTopTier, overseasOf, classifyUniversity } from '../../lib/topUniversities'
import { ROLE_GROUPS } from '../../constants/jobs'
import { ELITE_CATS, asSkills, asExperiences, eliteCategory } from '../../lib/talentCategory'

// 인재의 학벌 신호 = 도메인 인증 학교(authoritative) ∪ 이력서 자유입력 university.
// 인증 학교는 verified_school_tier(='top')로 바로 명문대 집계되고, 그 외엔 자유입력
// 이름을 topUniversities로 분류한다. 둘 중 하나라도 걸리면 해당 버킷으로 센다.
const topTierOf = r => r.verified_school_tier === 'top' || isTopTier(r.university) || isTopTier(r.verified_school_name)
const overseasOfR = r => overseasOf(r.university) || overseasOf(r.verified_school_name)
const isOverseasR = r => overseasOfR(r) !== null
// 카드/CSV에 보여줄 학교명 — 자유입력 우선, 없으면 인증된 학교명.
const uniOf = r => r.university || r.verified_school_name || ''

// 이력서 보유 인재 전체(공개+비공개)를 스태핑(인재 배치) 관점으로 보는 화면.
// 한국 기업이 지원자의 "급"을 판단할 때 보는 신호 — 학벌 / 전 회사 네임밸류 /
// 경력 연차·직급 / 어학(특히 한국어) / 핵심 스킬 — 을 한 카드에 모아 보여준다.
// 비공개 이력서는 카드에 뱃지로 구분(기업 노출 시 마스킹/공개전환 필요).
// 데이터는 운영용 이력서 탭과 동일한 /api/admin/resumes 를 재사용한다.

// 경력 레벨 분류 (yoe_months 기준)
const LEVELS = [
  { key: 'newgrad', label: '신입',   en: 'New grad', vi: 'Fresher', test: m => m === 0 },
  { key: 'junior',  label: '주니어', en: 'Junior',   vi: 'Junior',  test: m => m > 0 && m < 24 },
  { key: 'mid',     label: '미들',   en: 'Mid',      vi: 'Middle',  test: m => m >= 24 && m < 60 },
  { key: 'senior',  label: '시니어', en: 'Senior',   vi: 'Senior',  test: m => m >= 60 },
]

function levelOf(months) {
  if (months === null || months === undefined) return null
  return LEVELS.find(l => l.test(months))?.key || null
}

// 가장 최근(혹은 대표) 직급 텍스트 — 카드 상단 "직급" 표시용
function topTitle(r, exps) {
  return exps[0]?.title || ''
}

// position(소분류 canonical 값) → 대분류 그룹 키. 검색필터/공고폼과 같은 ROLE_GROUPS 체계.
// 파서가 남긴 레거시 값('AI/Data' 등)과 빈값은 매핑에 없어 'etc'(미분류)로 떨어진다.
// 어드민 인재풀 전용 대분류 — ROLE_GROUPS 기반이되 '비 IT · 비즈니스'는 한 칩에 마케팅~통번역이
// 다 뭉쳐 있어 역할별로 쪼갠다(8/5 유저 요청). constants 는 검색필터/공고폼과 공유라 안 건드린다.
const ADMIN_GROUPS = ROLE_GROUPS.flatMap(g => g.key === 'business'
  ? g.roles.map(r => ({ key: `biz:${r.value}`, label: r.label, roles: [r.value] }))
  : [{ key: g.key, label: g.label, roles: g.roles.map(r => r.value) }])
const ROLE_TO_GROUP = {}
for (const g of ADMIN_GROUPS) for (const v of g.roles) ROLE_TO_GROUP[v] = g.key
ROLE_TO_GROUP['AI/Data'] = 'data' // 구 파서 enum — 데이터 그룹으로 흡수
const ROLE_LABELS = {}
for (const g of ROLE_GROUPS) for (const r of g.roles) ROLE_LABELS[r.value] = r.label
const groupOfPosition = p => ROLE_TO_GROUP[p] || 'etc'

// ── 최우수 인재풀 (모달) ──────────────────────────────────────────────
// 인재 스쿼드 기준: 좋은 학교(명문/해외) + 언어(영어 B2급↑ 또는 한국어). 포폴은 DB에 없어 제외.
// 소셜/퍼포먼스/브랜딩은 position enum에 없는 세분류라 headline/스킬 정규식으로 가른다.
// 어학 자유입력(시험점수/자가평가 혼재) → 점수. 표기 편차 방어: "IELTS Academic 6.0", "TOEIC 895/990" 등.
function eliteKoScore(s) {
  if (!s) return 0
  const topik = s.match(/topik[^0-9]*(\d)/i)
  if (topik) return +topik[1] >= 5 ? 30 : +topik[1] >= 3 ? 22 : 12
  if (/native|fluent|advanced/i.test(s)) return 25
  if (/business|intermediate/i.test(s)) return 15
  return 8
}
function eliteEnScore(s) {
  if (!s) return 0
  const ielts = s.match(/ielts[^0-9]*(\d(?:\.\d)?)/i)
  if (ielts) return +ielts[1] >= 7 ? 25 : +ielts[1] >= 6 ? 18 : 8
  const toeic = s.match(/toeic[^0-9]*(\d{3})/i)
  if (toeic) return +toeic[1] >= 850 ? 25 : +toeic[1] >= 700 ? 15 : 6
  if (/native|fluent|c1|c2|advanced/i.test(s)) return 20
  if (/b2|upper|business|professional/i.test(s)) return 14
  if (/b1|intermediate/i.test(s)) return 7
  return 4
}
function eliteSchoolScore(r) {
  if (r.verified_school_tier === 'top') return 30
  const c = classifyUniversity(r.university) || classifyUniversity(r.verified_school_name)
  if (c?.tier === 'top') return 30
  if (overseasOf(r.university) || overseasOf(r.verified_school_name)) return 25
  if (c?.tier === 'strong') return 15
  return 0
}
function eliteRank(r, cat) {
  const school = eliteSchoolScore(r)
  const koS = eliteKoScore(r.korean_cert)
  const enS = eliteEnScore(r.english_cert)
  const links = Array.isArray(r.resume_summary?.links) ? r.resume_summary.links : []
  const langOk = koS > 0 || enS >= 14
  // 디자인 계열은 어학 기재율이 낮아(15~25%) 학교 AND 언어를 요구하면 구조적으로 걸러진다
  // → 학교 OR 언어로 완화. 포폴 링크는 가산점(디자이너 1급 신호).
  const isDesign = cat === 'uiux' || cat === 'branding'
  const qualified = !!(r.full_name || '').trim() && (isDesign ? (school >= 15 || langOk) : (school >= 15 && langOk))
  const total = school + koS + enS + Math.min((r.yoe_months || 0) / 12, 7) * 2.5 + (links.length ? 10 : 0)
  return { total, qualified }
}

// 포폴 링크 도메인 → 카드 표시 라벨
const LINK_LABELS = [
  ['behance.net', 'Behance'], ['dribbble.com', 'Dribbble'], ['artstation.com', 'ArtStation'],
  ['github.com', 'GitHub'], ['gitlab.com', 'GitLab'], ['figma.com', 'Figma'],
  ['notion.', 'Notion'], ['drive.google.com', 'Drive'], ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'], ['vimeo.com', 'Vimeo'],
]
const linkLabel = (u) => LINK_LABELS.find(([d]) => u.includes(d))?.[1] || 'Portfolio'

export default function TalentPoolView({ token, lang }) {
  const vi = lang === 'vi'
  const ko = !vi && lang !== 'en' // admin은 ko/en/vi. undefined면 ko.
  const L = vi ? {
    loadingPool: 'Đang tải nguồn ứng viên…', emptyPool: 'Chưa có CV nào.',
    noMatch: 'Không có ứng viên phù hợp.',
    statTotal: 'Tổng', statPublic: 'Công khai', people: '', statTop: 'Trường top', statOverseas: 'Du học', statKorean: 'Tiếng Hàn', filtered: 'Đã lọc',
    searchPh: 'Tên, vị trí, công ty, trường, kỹ năng...', csv: 'Tải CSV',
    all: 'Tất cả', fPublic: '🔓 Công khai', fTop: '🎓 Trường top', fOverseas: '🌏 Du học', fKorean: '🇰🇷 Tiếng Hàn', allWork: 'Tất cả hình thức',
    badgePublic: 'Công khai', lblGroup: 'Nhóm ngành', lblRole: 'Vị trí', lblCond: 'Điều kiện',
    eliteBtn: 'Ứng viên xuất sắc', aiFillAll: 'Điền AI tất cả', batchStop: 'Dừng', batchDone: 'Hoàn tất',
    filterBtn: 'Bộ lọc', reset: 'Đặt lại', done: 'Xong', lblLevel: 'Kinh nghiệm', lblWork: 'Hình thức',
    rowSchool: 'Học vấn', rowCareer: 'Kinh nghiệm', rowHighlights: 'Nổi bật', rowLang: 'Ngoại ngữ', rowSkills: 'Kỹ năng', rowLinks: 'Portfolio',
    rowSalary: 'Lương/năm', salarySrcProfile: 'tự khai', salarySrcVerified: 'đã xác minh',
    topNote: 'Trường top VN', langEn: 'T.Anh', langKo: 'T.Hàn', noInfo: 'Chưa rõ', newGrad: 'Fresher',
    unknown: 'Chưa rõ', noRole: 'Chưa rõ vị trí', levelUnknown: 'Cấp bậc?', aiFill: 'Điền bằng AI', aiFilling: 'Đang phân tích…',
    aiTitle: 'Kinh nghiệm/ngoại ngữ còn trống — bấm để điền bằng AI', resume: 'CV →',
    unclassified: 'Chưa phân loại', parseFail: 'Phân tích thất bại', retry: 'Thử lại',
    recBtn: 'Đề xuất việc', recApplied: 'đã ứng tuyển',
    poolTitle: 'Nguồn ứng viên', noName: 'Không có tên',
  } : ko ? {
    loadingPool: '인재풀 불러오는 중...', emptyPool: '이력서를 등록한 인재가 아직 없습니다.',
    noMatch: '조건에 맞는 인재가 없습니다.',
    statTotal: '전체', statPublic: '공개', people: '명', statTop: '명문대', statOverseas: '해외', statKorean: '한국어', filtered: '필터',
    searchPh: '이름, 직무, 회사, 학교, 스킬...', csv: 'CSV 다운로드',
    all: '전체', fPublic: '🔓 공개', fTop: '🎓 명문대', fOverseas: '🌏 해외대', fKorean: '🇰🇷 한국어', allWork: '근무형태 전체',
    badgePublic: '공개', lblGroup: '직군', lblRole: '세부 직무', lblCond: '조건',
    eliteBtn: '최우수 인재', aiFillAll: 'AI 전체 채우기', batchStop: '중단', batchDone: '완료',
    filterBtn: '필터', reset: '초기화', done: '완료', lblLevel: '경력', lblWork: '근무형태',
    rowSchool: '학력', rowCareer: '경력', rowHighlights: '주요이력', rowLang: '외국어', rowSkills: '기술', rowLinks: '포폴',
    rowSalary: '연봉', salarySrcProfile: '직접기입', salarySrcVerified: '뱃지 인증',
    topNote: '베트남 상위권 대학 (한국 인서울급)', langEn: '영어', langKo: '한국어', noInfo: '정보 없음', newGrad: '신입',
    unknown: '미상', noRole: '직무 미상', levelUnknown: '경력?', aiFill: 'AI 채우기', aiFilling: '분석 중…',
    aiTitle: '경력/어학이 비어 있어요 — 눌러서 AI로 채웁니다', resume: '이력서 보기',
    unclassified: '미분류', parseFail: '분석 실패', retry: '재시도',
    recBtn: '공고 추천', recApplied: '지원',
    poolTitle: '공개 인재풀', noName: '이름 없음',
  } : {
    loadingPool: 'Loading talent pool…', emptyPool: 'No resumes yet.',
    noMatch: 'No matching talent.',
    statTotal: 'Total', statPublic: 'Public', people: '', statTop: 'Top-tier', statOverseas: 'Overseas', statKorean: 'Korean', filtered: 'Filtered',
    searchPh: 'Name, role, company, school, skills...', csv: 'Download CSV',
    all: 'All', fPublic: '🔓 Public', fTop: '🎓 Top-tier', fOverseas: '🌏 Overseas', fKorean: '🇰🇷 Korean', allWork: 'All work types',
    badgePublic: 'Public', lblGroup: 'Group', lblRole: 'Role', lblCond: 'Filters',
    eliteBtn: 'Top talent', aiFillAll: 'AI fill all', batchStop: 'Stop', batchDone: 'Done',
    filterBtn: 'Filters', reset: 'Reset', done: 'Done', lblLevel: 'Level', lblWork: 'Work type',
    rowSchool: 'Education', rowCareer: 'Career', rowHighlights: 'Highlights', rowLang: 'Languages', rowSkills: 'Skills', rowLinks: 'Portfolio',
    rowSalary: 'Salary/yr', salarySrcProfile: 'self-reported', salarySrcVerified: 'badge-verified',
    topNote: 'Top-tier VN univ.', langEn: 'EN', langKo: 'KO', noInfo: 'N/A', newGrad: 'New grad',
    unknown: 'Unknown', noRole: 'No role', levelUnknown: 'Level?', aiFill: 'AI fill', aiFilling: 'Filling…',
    aiTitle: 'Career/language empty — click to fill with AI', resume: 'Resume →',
    unclassified: 'Unclassified', parseFail: 'Parse failed', retry: 'Retry',
    recBtn: 'Recommend', recApplied: 'applied',
    poolTitle: 'Talent Pool', noName: 'No name',
  }
  const levelLabel = (l) => (l ? (vi ? l.vi : ko ? l.label : l.en) : L.levelUnknown)
  const { data: all, isLoading: loading, mutate } = useAdmin('/api/admin/resumes', token)
  // 공고 추천: 발송 이력(+지원 여부) 및 기업 등록 공고 목록(모달 셀렉트용)
  const { data: recs, mutate: mutateRecs } = useAdmin('/api/admin/talent-recommend', token)
  const { data: allJobs } = useAdmin('/api/jobs', token)
  const [recTarget, setRecTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [groupSel, setGroupSel] = useState([]) // 대분류 다중선택(ADMIN_GROUPS key | 'etc'), []=전체
  const [posFilter, setPosFilter] = useState('all')     // 세부 직무(position 값, ''=빈값)
  const [levelFilter, setLevelFilter] = useState('all')
  const [workFilter, setWorkFilter] = useState('all')
  const [koreanOnly, setKoreanOnly] = useState(false)
  const [topOnly, setTopOnly] = useState(false)
  const [overseasOnly, setOverseasOnly] = useState(false)
  const [publicOnly, setPublicOnly] = useState(false)
  const [parsingId, setParsingId] = useState(null)
  const [mode, setMode] = useState('pool') // 'pool' 전체 인재풀 | 'elite' 최우수 인재
  const [batch, setBatch] = useState(null) // AI 전체 채우기 진행상태 { total, done, fail } | null
  const batchCancel = useRef(false)
  const [filterOpen, setFilterOpen] = useState(false) // 필터 모달

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>{L.loadingPool}</div>

  // 이력서 보유자 전체 — 공개 여부는 필터 칩(publicOnly)과 카드 뱃지로 구분한다.
  const pool = all || []
  if (pool.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{L.emptyPool}</div>

  async function reparse(userId) {
    if (parsingId) return
    setParsingId(userId)
    try {
      const res = await fetch('/api/admin/parse-resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const parsed = await res.json()
        mutate(prev => prev.map(r => r.id === userId ? { ...r, ...parsed, skills: parsed.skills } : r), false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`${L.parseFail}: ${err.error || res.status}`)
      }
    } catch (e) {
      alert(`${L.parseFail}: ${e.message}`)
    } finally {
      setParsingId(null)
    }
  }

  // AI 전체 채우기 — 미파싱 인재를 동시 3개씩 순회 파싱.
  // 서버 배치 대신 클라이언트 순회인 이유: 파싱 1건당 5~15초라 서버리스 타임아웃에 걸린다.
  // 실패자는 API가 resume_summary.parse_failed 로 마킹 → 다음 배치/카드 버튼에서 제외.
  // 판정은 요약 불릿 유무만 — 경력회사 유무를 섞으면 신입(무경력) CV가 영원히 재파싱 대상이 된다.
  const needsParse = (r) => {
    const bullets = r.resume_summary?.bullets
    return !Array.isArray(bullets) || bullets.length === 0
  }
  const parseTargets = pool.filter(r => needsParse(r) && !r.resume_summary?.parse_failed)

  async function runBatchParse() {
    if (batch) { batchCancel.current = true; return } // 실행 중 재클릭 = 중단
    batchCancel.current = false
    const targets = parseTargets.map(r => r.id)
    const st = { total: targets.length, done: 0, fail: 0 }
    setBatch({ ...st })
    let idx = 0
    async function worker() {
      while (idx < targets.length && !batchCancel.current) {
        const userId = targets[idx++]
        try {
          const res = await fetch('/api/admin/parse-resumes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId, batch: true }),
          })
          if (res.ok) {
            const parsed = await res.json()
            mutate(prev => prev.map(r => r.id === userId ? { ...r, ...parsed, skills: parsed.skills } : r), false)
          } else {
            st.fail++
            mutate(prev => prev.map(r => r.id === userId ? { ...r, resume_summary: { ...(r.resume_summary || {}), parse_failed: true } } : r), false)
          }
        } catch {
          st.fail++
        }
        st.done++
        setBatch({ ...st })
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker))
    setBatch(null)
  }

  // 공고 추천 이력을 인재별로 묶는다 (카드 버튼 라벨 + 모달 히스토리용)
  const recsByUser = {}
  for (const rec of (recs || [])) (recsByUser[rec.user_id] ||= []).push(rec)
  const companyJobs = (allJobs || []).filter(j => j.source === 'company_self')

  // 직군(대분류)/세부 직무 카운트 — 필터 칩용
  const langKey = vi ? 'vi' : ko ? 'ko' : 'en'
  const groupCounts = {}
  for (const r of pool) {
    const g = groupOfPosition(r.position)
    groupCounts[g] = (groupCounts[g] || 0) + 1
  }
  const roleCounts = {} // 선택된 대분류들 안의 position별 카운트
  if (groupSel.length > 0) {
    for (const r of pool) {
      if (!groupSel.includes(groupOfPosition(r.position))) continue
      const p = r.position || ''
      roleCounts[p] = (roleCounts[p] || 0) + 1
    }
  }
  // 세부 직무 칩: 선택된 그룹들의 정의 순서 우선, 정의에 없는 값(레거시/빈값)은 건수순으로 뒤에
  const selRoleValues = ADMIN_GROUPS.filter(g => groupSel.includes(g.key)).flatMap(g => g.roles)
  const subRoles = groupSel.length === 0 ? [] : [
    ...selRoleValues.filter(v => roleCounts[v]).map(v => ({ value: v, label: ROLE_LABELS[v]?.[langKey] || v })),
    ...Object.keys(roleCounts)
      .filter(p => !selRoleValues.includes(p))
      .sort((a, b) => roleCounts[b] - roleCounts[a])
      .map(p => ({ value: p, label: p || L.unclassified })),
  ]
  function toggleGroup(k) {
    setPosFilter('all') // 그룹 선택이 바뀌면 세부 직무 선택은 무효
    setGroupSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])
  }

  const filtered = pool.filter(r => {
    if (groupSel.length > 0 && !groupSel.includes(groupOfPosition(r.position))) return false
    if (posFilter !== 'all' && (r.position || '') !== posFilter) return false
    if (levelFilter !== 'all' && levelOf(r.yoe_months) !== levelFilter) return false
    if (workFilter !== 'all' && (r.work_type || '') !== workFilter) return false
    if (koreanOnly && !(r.korean_cert || '').trim()) return false
    if (topOnly && !topTierOf(r)) return false
    if (overseasOnly && !isOverseasR(r)) return false
    if (publicOnly && !r.is_resume_public) return false
    if (search) {
      const q = search.toLowerCase()
      const companies = asExperiences(r.experiences).map(e => e.company)
      const hay = [r.full_name, r.email, r.position, r.headline, r.university, r.verified_school_name, r.major, ...companies, ...asSkills(r.skills)]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const workTypes = [...new Set(pool.map(r => r.work_type).filter(Boolean))]
  const publicCount = pool.filter(r => r.is_resume_public).length
  const koreanCount = pool.filter(r => (r.korean_cert || '').trim()).length
  const topTierCount = pool.filter(topTierOf).length
  const topTierPct = pool.length ? Math.round((topTierCount / pool.length) * 100) : 0
  const overseasCount = pool.filter(isOverseasR).length
  const overseasPct = pool.length ? Math.round((overseasCount / pool.length) * 100) : 0

  // 필터 모달 — 활성 필터 요약(바 표시)·초기화·섹션 헬퍼
  const activeFilters = []
  for (const k of groupSel) activeFilters.push(k === 'etc' ? L.unclassified : (ADMIN_GROUPS.find(g => g.key === k)?.label[langKey] || k))
  if (posFilter !== 'all') activeFilters.push(subRoles.find(sr => sr.value === posFilter)?.label || posFilter || L.unclassified)
  if (levelFilter !== 'all') activeFilters.push(levelLabel(LEVELS.find(l => l.key === levelFilter)))
  if (publicOnly) activeFilters.push(L.fPublic)
  if (topOnly) activeFilters.push(L.fTop)
  if (overseasOnly) activeFilters.push(L.fOverseas)
  if (koreanOnly) activeFilters.push(L.fKorean)
  if (workFilter !== 'all') activeFilters.push(workFilter)
  function resetFilters() {
    setGroupSel([]); setPosFilter('all'); setLevelFilter('all'); setWorkFilter('all')
    setPublicOnly(false); setTopOnly(false); setOverseasOnly(false); setKoreanOnly(false)
  }
  const fSection = (label, node) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{node}</div>
    </div>
  )

  function downloadCsv() {
    const headers = ['Name', 'Email', 'Public', 'Position', 'Level', 'YoE (months)', 'University', 'Top-tier', 'Overseas', 'Major', 'Grad Year', 'Companies', 'Korean', 'English', 'Skills', 'Location', 'Work Type', 'Salary Min', 'Salary Max', 'Currency', 'Current Salary (M/yr)', 'Verified Salary (M/yr)', 'Resume URL', 'Updated']
    const rows = filtered.map(r => {
      const exps = asExperiences(r.experiences)
      return [
        r.full_name, r.email, r.is_resume_public ? 'Y' : '', r.position || '', (LEVELS.find(l => l.key === levelOf(r.yoe_months)) || {})[vi ? 'vi' : ko ? 'label' : 'en'] || '',
        r.yoe_months ?? '', uniOf(r), topTierOf(r) ? 'Y' : '', overseasOfR(r)?.country || '', r.major || '', r.graduation_year || '',
        exps.map(e => `${e.company}${e.title ? ` (${e.title})` : ''}`).join(' / '),
        r.korean_cert || '', r.english_cert || '', asSkills(r.skills).join(', '),
        r.location || '', r.work_type || '', r.salary_min ?? '', r.salary_max ?? '', r.salary_currency || '',
        r.current_salary ? Math.round(r.current_salary / 1000000) * 12 : '', r.verified_salary ? Math.round(r.verified_salary) * 12 : '',
        r.resume_url, r.updated_at ? new Date(r.updated_at).toLocaleString('ko-KR') : '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `talent-pool-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const chip = (active) => ({
    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? '#ff6000' : '#E5E8EB'}`, cursor: 'pointer',
    background: active ? '#ff600014' : '#fff', color: active ? '#ff6000' : '#6B7280',
    transition: 'all 0.15s',
  })
  const cntStyle = { color: '#9CA3AF', fontWeight: 500 }

  return (
    <>
      <style>{`
        .tp-card { transition: box-shadow 0.15s, border-color 0.15s; }
        .tp-card:hover { border-color: #ff6000; box-shadow: 0 2px 10px rgba(15,23,42,0.06); }
        .jobsel-dropdown::-webkit-scrollbar { width: 6px; }
        .jobsel-dropdown::-webkit-scrollbar-thumb { background: #E5E8EB; border-radius: 3px; }
      `}</style>

      {/* 모드 탭: 인재풀 전체 ↔ 최우수 인재 (인재 스쿼드 쇼케이스) */}
      <div style={{ display: 'inline-flex', gap: 0, background: '#f3f4f6', borderRadius: 10, padding: 3, marginBottom: 16 }}>
        {[{ key: 'pool', label: L.poolTitle }, { key: 'elite', label: `⭐ ${L.eliteBtn}` }].map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: mode === m.key ? '#fff' : 'transparent',
              color: mode === m.key ? '#111' : '#999',
              boxShadow: mode === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'elite' && <EliteView pool={pool} lang={lang} L={L} vi={vi} ko={ko} />}

      {mode === 'pool' && <>
      {/* 헤더: 제목 + 통계 스트립 + 검색/CSV */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{L.poolTitle}</h3>
          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', fontSize: 13, color: '#6B7280', flexWrap: 'wrap' }}>
            <span>{L.statTotal} <strong style={{ color: '#0F172A' }}>{pool.length}</strong>{L.people}</span>
            <span>{L.statPublic} <strong style={{ color: '#0F172A' }}>{publicCount}</strong>{L.people}</span>
            <span>{L.statTop} <strong style={{ color: '#0F172A' }}>{topTierCount}</strong> ({topTierPct}%)</span>
            {overseasCount > 0 && <span>{L.statOverseas} <strong style={{ color: '#0F172A' }}>{overseasCount}</strong> ({overseasPct}%)</span>}
            {koreanCount > 0 && <span>{L.statKorean} <strong style={{ color: '#0F172A' }}>{koreanCount}</strong></span>}
            {filtered.length !== pool.length && <span style={{ color: '#ff6000', fontWeight: 600 }}>· {L.filtered} {filtered.length}{L.people}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={L.searchPh}
            style={{ padding: '7px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 240 }}
          />
          {(parseTargets.length > 0 || batch) && (
            <button onClick={runBatchParse}
              style={{ padding: '8px 14px', border: '1px solid #ff6000', borderRadius: 8, fontSize: 13, background: batch ? '#FFF6F0' : '#fff', color: '#ff6000', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {batch
                ? `${batch.done}/${batch.total}${batch.fail ? ` · ${L.parseFail} ${batch.fail}` : ''} — ${L.batchStop}`
                : `${L.aiFillAll} (${parseTargets.length})`}
            </button>
          )}
          <button onClick={downloadCsv}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, background: '#ff6000', color: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {L.csv}
          </button>
        </div>
      </div>

      {/* 필터 바: 모달 트리거 + 활성 필터 요약 — 인라인 3단 칩이 산만하다는 피드백(8/5)으로 모달化 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, minWidth: 0 }}>
        <button onClick={() => setFilterOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${activeFilters.length ? '#ff6000' : '#E5E8EB'}`, borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#fff', color: activeFilters.length ? '#ff6000' : '#374151', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
          {L.filterBtn}
          {activeFilters.length > 0 && <span style={{ background: '#ff6000', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 800, padding: '1px 7px' }}>{activeFilters.length}</span>}
        </button>
        {activeFilters.length > 0 && (
          <>
            <span style={{ fontSize: 12.5, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{activeFilters.join(' · ')}</span>
            <button onClick={resetFilters} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#9CA3AF', padding: 0, flexShrink: 0 }}>{L.reset}</button>
          </>
        )}
      </div>

      {/* 필터 모달: 직군 → 세부 직무 → 경력 → 스펙 → 근무형태 (클릭 즉시 반영) */}
      {filterOpen && (
        <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 600, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '20px 22px', boxShadow: '0 12px 40px rgba(15,23,42,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{L.filterBtn} <span style={{ fontSize: 12.5, fontWeight: 600, color: '#9CA3AF' }}>· {filtered.length}{L.people}</span></div>
              <button onClick={() => setFilterOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9CA3AF', padding: 0, lineHeight: 1 }}>×</button>
            </div>

            {fSection(L.lblGroup, (
              <>
                <button onClick={() => { setGroupSel([]); setPosFilter('all') }} style={chip(groupSel.length === 0)}>{L.all} <span style={cntStyle}>{pool.length}</span></button>
                {ADMIN_GROUPS.filter(g => groupCounts[g.key]).map(g => (
                  <button key={g.key} onClick={() => toggleGroup(g.key)} style={chip(groupSel.includes(g.key))}>
                    {g.label[langKey]} <span style={cntStyle}>{groupCounts[g.key]}</span>
                  </button>
                ))}
                {groupCounts.etc > 0 && (
                  <button onClick={() => toggleGroup('etc')} style={chip(groupSel.includes('etc'))}>
                    {L.unclassified} <span style={cntStyle}>{groupCounts.etc}</span>
                  </button>
                )}
              </>
            ))}

            {subRoles.length > 1 && fSection(L.lblRole, (
              <>
                <button onClick={() => setPosFilter('all')} style={chip(posFilter === 'all')}>{L.all}</button>
                {subRoles.map(sr => (
                  <button key={sr.value || '_none'} onClick={() => setPosFilter(sr.value)} style={chip(posFilter === sr.value)}>
                    {sr.label} <span style={cntStyle}>{roleCounts[sr.value]}</span>
                  </button>
                ))}
              </>
            ))}

            {fSection(L.lblLevel, (
              <>
                <button onClick={() => setLevelFilter('all')} style={chip(levelFilter === 'all')}>{L.all}</button>
                {LEVELS.map(l => {
                  const count = pool.filter(r => levelOf(r.yoe_months) === l.key).length
                  if (count === 0) return null
                  return <button key={l.key} onClick={() => setLevelFilter(l.key)} style={chip(levelFilter === l.key)}>{levelLabel(l)} <span style={cntStyle}>{count}</span></button>
                })}
              </>
            ))}

            {fSection(L.lblCond, (
              <>
                <button onClick={() => setPublicOnly(v => !v)} style={chip(publicOnly)}>{L.fPublic} <span style={cntStyle}>{publicCount}</span></button>
                {topTierCount > 0 && <button onClick={() => setTopOnly(v => !v)} style={chip(topOnly)}>{L.fTop} <span style={cntStyle}>{topTierCount}</span></button>}
                {overseasCount > 0 && <button onClick={() => setOverseasOnly(v => !v)} style={chip(overseasOnly)}>{L.fOverseas} <span style={cntStyle}>{overseasCount}</span></button>}
                {koreanCount > 0 && <button onClick={() => setKoreanOnly(v => !v)} style={chip(koreanOnly)}>{L.fKorean} <span style={cntStyle}>{koreanCount}</span></button>}
              </>
            ))}

            {workTypes.length > 0 && fSection(L.lblWork, (
              <>
                <button onClick={() => setWorkFilter('all')} style={chip(workFilter === 'all')}>{L.all}</button>
                {workTypes.map(w => (
                  <button key={w} onClick={() => setWorkFilter(w)} style={chip(workFilter === w)}>
                    {w} <span style={cntStyle}>{pool.filter(r => r.work_type === w).length}</span>
                  </button>
                ))}
              </>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <button onClick={resetFilters} style={{ padding: '8px 16px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, background: '#fff', color: '#6B7280', cursor: 'pointer', fontWeight: 600 }}>{L.reset}</button>
              <button onClick={() => setFilterOpen(false)} style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, background: '#ff6000', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{L.done} ({filtered.length})</button>
            </div>
          </div>
        </div>
      )}

      {/* 인재 카드 그리드 (3열 고정) */}
      <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {filtered.map(r => (
          <TalentCard key={r.id} r={r} L={L} vi={vi} ko={ko}
            userRecs={recsByUser[r.id] || []}
            onRecommend={() => setRecTarget(r)}
            onReparse={() => reparse(r.id)}
            parsing={parsingId === r.id}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{L.noMatch}</div>
      )}
      </>}

      {recTarget && (
        <RecommendModal
          person={recTarget}
          jobs={companyJobs}
          history={recsByUser[recTarget.id] || []}
          token={token}
          lang={lang}
          onClose={() => setRecTarget(null)}
          onSent={(row) => mutateRecs(prev => row ? [row, ...(prev || [])] : prev, !row)}
        />
      )}
    </>
  )
}

// 인재 프로필 카드 — 인재풀 그리드와 최우수 인재 탭이 공유하는 단일 카드.
// onRecommend 핸들러가 없으면(최우수 탭) 푸터 액션(이메일/공고추천/AI채우기)을 생략한다.
function TalentCard({ r, L, vi, ko, userRecs = [], onRecommend, onReparse, parsing }) {
  // 스펙 패널 행 — 라벨(굵게) : 값, 행 사이 구분선. 스크린샷 디자인(회색 패널) 기준.
  const panelRow = (label, value, muted, first) => (
    <div key={label} style={{ display: 'flex', gap: 12, padding: '11px 13px', borderTop: first ? 'none' : '1px solid #ECEEF1', fontSize: 12.5, lineHeight: 1.55 }}>
      <span style={{ flexShrink: 0, width: vi ? 88 : ko ? 52 : 72, fontWeight: 700, color: '#111', paddingTop: 1 }}>{label}</span>
      <span style={{ minWidth: 0, flex: 1, color: muted ? '#B6BDC6' : '#374151' }}>{value}</span>
    </div>
  )
  const skills = asSkills(r.skills)
  const exps = asExperiences(r.experiences)
  const title = topTitle(r, exps) || r.headline || r.position || ''
  // AI 요약(resume_summary): 한국어 호칭·학위·학력주석·주요이력 3줄 — 20260727 양식
  const summary = r.resume_summary || {}
  const nick = summary.name_ko || ''
  const bullets = Array.isArray(summary.bullets) ? summary.bullets : []
  // 카드 간 정렬 통일: 모든 행을 상시 렌더 + 줄 수 고정(1줄 ellipsis/고정 높이)해서
  // 어떤 카드든 행 구성·위치가 동일하게 만든다. 넘치는 내용은 title 툴팁으로.
  const oneLine = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const yoeText = r.yoe_months == null ? null
    : r.yoe_months === 0 ? L.newGrad
    : String(Math.round((r.yoe_months / 12) * 10) / 10)
  const uni = uniOf(r)
  // 학력 2줄 고정: 대학명(+명문 🎓) / 학위 · 전공
  const eduNode = (
    <span style={{ display: 'block' }}>
      <span style={{ ...oneLine, fontWeight: 700, color: uni ? '#111' : '#B6BDC6' }} title={uni}>
        {uni || '-'}{topTierOf(r) && <span title={L.topNote}> 🎓</span>}
      </span>
      <span style={{ ...oneLine, color: '#9CA3AF' }}>{[summary.degree, summary.edu_ko || r.major].filter(Boolean).join(' · ') || '-'}</span>
    </span>
  )
  // 연봉: 프로필 직접기입(current_salary, 원 단위) > 뱃지 인증(verified_salary, 백만 단위) 폴백.
  // 연봉위저드 제출은 안 쓴다 — 익명 자기신고라 부정확(유저 지시 8/13, 정확한 값만).
  // 수집·저장은 월급이지만 표기는 연봉(×12) — 행 라벨이 "연봉"이라서(유저 지시 8/13). 툴팁=월급.
  // 신입 처리는 경력 0 확인자만 — 1~11개월 경력자도 월급 수집 가능 풀(유저 정정 8/13).
  const curM = r.current_salary ? Math.round(r.current_salary / 1000000) : null
  const verM = curM == null && r.verified_salary ? Math.round(r.verified_salary) : null
  const salM = curM ?? verM
  const salaryFresher = salM == null && r.yoe_months === 0
  const salaryNode = (
    <span style={oneLine} title={salM != null ? `${salM}M/tháng${verM != null && r.verified_salary_at ? ` · ${r.verified_salary_at.slice(0, 10)}` : ''}` : undefined}>
      {salM != null ? (<>
        <span style={{ fontWeight: 700, color: '#111' }}>₫{salM * 12}M</span>
        <span style={{ color: '#9CA3AF' }}> · {curM != null ? L.salarySrcProfile : L.salarySrcVerified}</span>
      </>) : salaryFresher ? <span style={{ color: '#6B7280', fontWeight: 600 }}>{L.newGrad}</span> : '-'}
    </span>
  )
  const hasLang = !!(r.english_cert || r.korean_cert)
  const langNode = (
    <span style={oneLine} title={[r.english_cert, r.korean_cert].filter(Boolean).join(' / ')}>
      {hasLang ? (<>
        {r.english_cert && <><span style={{ color: '#ff6000', fontWeight: 600 }}>{L.langEn}</span> {r.english_cert}</>}
        {r.english_cert && r.korean_cert && <span style={{ color: '#CBD5E1' }}> · </span>}
        {r.korean_cert && <><span style={{ color: '#ff6000', fontWeight: 600 }}>{L.langKo}</span> {r.korean_cert}</>}
      </>) : '-'}
    </span>
  )
  // 주요이력 3줄 고정 높이 — 불릿 수가 달라도 아래 행 위치가 안 흔들린다
  const bulletsNode = (
    <span style={{ display: 'block', height: 'calc(1.55em * 3)', overflow: 'hidden' }} title={bullets.join('\n')}>
      {bullets.length > 0 ? bullets.slice(0, 3).map((b, i) => <span key={i} style={oneLine}>· {b}</span>) : '-'}
    </span>
  )
  // 칩 행(포폴/기술) 1줄 고정 높이
  const chipRowStyle = { display: 'flex', gap: 5, height: 24, alignItems: 'center', overflow: 'hidden', flexWrap: 'nowrap' }
  const chipStyle = { padding: '3px 9px', borderRadius: 6, fontSize: 11.5, background: '#fff', border: '1px solid #E5E8EB', whiteSpace: 'nowrap', flexShrink: 0 }
  const links = Array.isArray(summary.links) ? summary.links : []
  const linkNode = (
    <span style={chipRowStyle}>
      {links.length > 0 ? links.slice(0, 3).map(u => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" title={u}
          style={{ ...chipStyle, color: '#1A73E8', textDecoration: 'none', fontWeight: 600 }}>
          {linkLabel(u)} ↗
        </a>
      )) : '-'}
    </span>
  )
  const skillNode = (
    <span style={chipRowStyle} title={skills.join(', ')}>
      {skills.length > 0 ? (<>
        {skills.slice(0, 3).map(s => <span key={s} style={{ ...chipStyle, color: '#374151' }}>{s}</span>)}
        {skills.length > 3 && <span style={{ fontSize: 11.5, color: '#9CA3AF', flexShrink: 0 }}>+{skills.length - 3}</span>}
      </>) : '-'}
    </span>
  )
  return (
    <div className="tp-card" style={{ position: 'relative', background: '#fff', border: '1px solid #E5E8EB', borderRadius: 14, padding: '20px 14px 12px', display: 'flex', flexDirection: 'column' }}>
      {/* 공개 뱃지 — 우상단 고정(카드 레이아웃에 영향 없게 absolute) */}
      {r.is_resume_public && (
        <span style={{ position: 'absolute', top: 12, right: 12, padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: '#DCFCE7', color: '#15803D' }}>{L.badgePublic}</span>
      )}
      {/* 헤더: 중앙 사진 · 이름(호칭) · 직무 — 각 1줄 고정 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 14 }}>
        {r.photo_url ? (
          <img src={r.photo_url} alt="" referrerPolicy="no-referrer" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#999' }}>
            {(r.full_name || '?')[0]}
          </div>
        )}
        <div title={r.full_name} style={{ marginTop: 10, fontWeight: 700, fontSize: 15.5, lineHeight: 1.3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.full_name || L.noName}{nick && <span style={{ color: '#9CA3AF', fontWeight: 600 }}> ({nick})</span>}
        </div>
        <div title={title} style={{ fontSize: 12.5, color: '#6B7280', marginTop: 3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || L.noRole}</div>
      </div>

      {/* 스펙 패널: 행 구성·순서·높이 고정 — 카드끼리 같은 위치에 같은 정보. flex:1로 하단 버튼 라인 통일 */}
      <div style={{ background: '#F8F9FA', borderRadius: 10, flex: 1 }}>
        {panelRow(L.rowCareer, yoeText || L.unknown, !yoeText, true)}
        {panelRow(L.rowSalary, salaryNode, salM == null && !salaryFresher)}
        {panelRow(L.rowSchool, eduNode, !uni)}
        {panelRow(L.rowHighlights, bulletsNode, bullets.length === 0)}
        {panelRow(L.rowLang, langNode, !hasLang)}
        {panelRow(L.rowLinks, linkNode, links.length === 0)}
        {panelRow(L.rowSkills, skillNode, skills.length === 0)}
      </div>

      {/* 이력서 보기 — 하단 전체폭 버튼 (원본 PDF). 패널이 flex:1이라 항상 같은 라인에 붙는다 */}
      {r.resume_url && (
        <a href={r.resume_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', marginTop: 12, padding: '10px 0', border: '1px solid #E5E8EB', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#111', textDecoration: 'none', background: '#fff' }}>
          {L.resume}
        </a>
      )}

      {/* 푸터: 이메일 · 공고추천 · AI 분석 — marginTop auto로 카드 바닥 고정 */}
      {onRecommend && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 'auto' }}>
          <a href={r.email ? `mailto:${r.email}` : undefined} title={r.email}
            style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{r.email || '-'}</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {(() => {
              const appliedN = userRecs.filter(x => x.applied_at).length
              const label = userRecs.length === 0 ? L.recBtn
                : `${L.recBtn} ${userRecs.length}${appliedN ? ` · ${L.recApplied} ${appliedN}` : ''}`
              return (
                <button onClick={onRecommend}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: userRecs.length > 0 ? '#ff6000' : '#6B7280', padding: 0 }}>
                  {label}
                </button>
              )
            })()}
            {summary.parse_failed ? (
              <button onClick={onReparse} disabled={parsing}
                title={L.aiTitle}
                style={{ border: 'none', background: 'none', cursor: parsing ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600, color: parsing ? '#9CA3AF' : '#DC2626', padding: 0 }}>
                {parsing ? L.aiFilling : `${L.parseFail} · ${L.retry}`}
              </button>
            ) : bullets.length === 0 && ( // 요약 유무만 본다 — 경력회사 조건은 신입 CV를 영원히 재파싱 대상으로 만든다
              <button onClick={onReparse} disabled={parsing}
                title={L.aiTitle}
                style={{ border: 'none', background: 'none', cursor: parsing ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600, color: parsing ? '#9CA3AF' : '#6B7280', padding: 0 }}>
                {parsing ? L.aiFilling : L.aiFill}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 최우수 인재 탭 — 인재 스쿼드 요청(8/4): 기업 미팅/콜드메일에서 실제 우수 인재를 바로
// 보여주기 위한 영역별(개발/디자인/마케터 × 2) 상위 후보. 기준 충족자만 프로필 카드로 표시하고
// 기준 미달 영역은 비워서 풀의 갭도 그대로 드러낸다(퍼포먼스 마케터 등).
function EliteView({ pool, lang, L, vi, ko }) {
  const langKey = vi ? 'vi' : ko ? 'ko' : 'en'
  const [catSel, setCatSel] = useState(null) // null이면 후보 있는 첫 카테고리 자동 선택
  const M = vi ? {
    desc: 'Trường top/du học + tiếng Anh (B2↑) hoặc tiếng Hàn (Thiết kế: trường HOẶC ngoại ngữ) · có portfolio được cộng điểm',
    empty: 'Chưa có ứng viên đạt tiêu chí', total: 'tổng',
  } : ko ? {
    desc: '기준: 명문·해외대 + 영어(비즈니스급↑) 또는 한국어 (디자인은 학교/언어 중 하나) · 포폴 보유 가산',
    empty: '기준 충족 인재가 아직 없습니다', total: '총',
  } : {
    desc: 'Top/overseas school + English (B2+) or Korean (Design: school OR language) · portfolio adds score',
    empty: 'No qualifying talent yet', total: 'total',
  }

  // 기준 충족자만 영역별 수집 → 점수순 → 동명(중복 계정) 제거
  const byCat = {}
  for (const r of pool) {
    const cat = eliteCategory(r)
    if (!cat) continue
    const s = eliteRank(r, cat)
    if (!s.qualified) continue
    ;(byCat[cat] ||= []).push({ r, total: s.total })
  }
  for (const k of Object.keys(byCat)) {
    byCat[k].sort((a, b) => b.total - a.total)
    const seen = new Set()
    byCat[k] = byCat[k].filter(({ r }) => {
      const key = (r.full_name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const flatCats = ELITE_CATS.flatMap(g => g.cats)
  const active = catSel || flatCats.find(c => (byCat[c.key] || []).length > 0)?.key || flatCats[0].key
  const list = byCat[active] || []
  const chip = (on) => ({
    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${on ? '#ff6000' : '#E5E8EB'}`, cursor: 'pointer',
    background: on ? '#ff600014' : '#fff', color: on ? '#ff6000' : '#6B7280',
    transition: 'all 0.15s',
  })

  return (
    <>
      <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>{M.desc}</div>

      {/* 카테고리 하위탭: 대분류 라벨 + 세부 칩 (개발 | 디자인 | 마케터) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '10px 14px', background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 10 }}>
        {ELITE_CATS.map((g, gi) => (
          <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {gi > 0 && <span style={{ width: 1, height: 18, background: '#E5E8EB', margin: '0 4px' }} />}
            <span style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF' }}>{g.label[langKey]}</span>
            {g.cats.map(c => (
              <button key={c.key} onClick={() => setCatSel(c.key)} style={chip(active === c.key)}>
                {c.label[langKey]} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{(byCat[c.key] || []).length}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: '40px 12px', border: '1px dashed #E5E8EB', borderRadius: 12, fontSize: 12.5, color: '#B6BDC6', textAlign: 'center' }}>{M.empty}</div>
      ) : (
        <div className="adm-m-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {list.map(({ r }) => <TalentCard key={r.id} r={r} L={L} vi={vi} ko={ko} />)}
        </div>
      )}
    </>
  )
}

// 공고 선택 드롭다운 — native select 대신 브랜드 디자인(profile.js CustomSelect 계열).
// 공고는 회사명·포지션 2줄 + 로고, 이미 추천 보낸 공고는 비활성(발송됨 표시).
function JobSelect({ jobs, value, onChange, sentJobIds, placeholder, sentLabel }) {
  const [open, setOpen] = useState(false)
  // 드롭다운은 body로 portal + fixed 배치 — 모달의 overflow:auto 경계에 잘리지 않게.
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const reposition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const menuH = Math.min(260, jobs.length * 47 + 8)
    const spaceBelow = window.innerHeight - r.bottom
    const above = spaceBelow < menuH + 12 && r.top > spaceBelow
    setCoords({
      left: r.left,
      width: r.width,
      top: above ? r.top - menuH - 4 : r.bottom + 4,
      maxHeight: above ? Math.min(260, r.top - 12) : Math.min(260, spaceBelow - 12),
    })
  }, [jobs.length])

  useEffect(() => {
    if (!open) return
    reposition()
    const onOutside = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // 모달 내부 스크롤/리사이즈 시 위치 갱신 (capture: 내부 스크롤 컨테이너까지 포착)
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  const selected = jobs.find(j => j.id === value)
  const logoBox = (job, size) => job.logo_url
    ? <img src={job.logo_url} alt="" style={{ width: size, height: size, borderRadius: 6, objectFit: 'contain', background: '#fff', border: '1px solid #EEF0F2', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: 6, background: '#FFF1E7', color: '#ea580c', fontSize: size * 0.42, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(job.company || '?').trim()[0] || '?'}</div>

  return (
    <div style={{ position: 'relative' }}>
      <button ref={triggerRef} type="button" onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '9px 11px', border: `1px solid ${open ? '#ff6000' : '#E5E8EB'}`,
        borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color .15s', outline: 'none',
      }}>
        {selected ? (
          <>
            {logoBox(selected, 28)}
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.title}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.company}</span>
            </span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: 13, color: '#9CA3AF' }}>{placeholder}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && coords && createPortal(
        <div ref={menuRef} className="jobsel-dropdown" style={{
          position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 200,
          background: '#fff', border: '1px solid #EEF0F2', borderRadius: 10, padding: 4,
          maxHeight: coords.maxHeight, overflowY: 'auto', boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
        }}>
          {jobs.map(j => {
            const sent = sentJobIds.has(j.id)
            const active = j.id === value
            return (
              <button key={j.id} type="button" disabled={sent}
                onClick={() => { if (!sent) { onChange(j.id); setOpen(false) } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
                  border: 'none', borderRadius: 6, background: active ? '#FFF6F0' : 'transparent',
                  cursor: sent ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: sent ? 0.5 : 1, transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!sent && !active) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                {logoBox(j, 28)}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? '#ff6000' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.company}</span>
                </span>
                {sent && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#94A3B8' }}>{sentLabel}</span>}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// 공고 추천 메일 모달 — 기업 등록 공고(company_self) 중 하나를 골라
// 베트남어 추천 메일(리멤버 형식)을 발송한다. 미리보기는 서버에서 실제 발송본과
// 동일한 내용을 받아와 보여준다.
function RecommendModal({ person, jobs, history, token, lang, onClose, onSent }) {
  const vi = lang === 'vi'
  const ko = !vi && lang !== 'en'
  const M = vi ? {
    title: 'Email đề xuất việc làm', to: 'Người nhận', selectJob: 'Chọn tin tuyển dụng', selectPh: 'Chọn tin tuyển dụng do công ty đăng...',
    history: 'Đề xuất đã gửi', applied: 'Đã ứng tuyển', sent: 'Đã gửi', alreadySent: '✓ Đã gửi',
    lang: 'Ngôn ngữ email', preview: 'Xem trước email', previewLoading: 'Đang tải bản xem trước...',
    send: 'Gửi', sending: 'Đang gửi...', done: 'Đã gửi', close: 'Đóng',
    noJobs: 'Chưa có tin tuyển dụng do công ty đăng (company_self).', noEmail: 'Tài khoản không có email — không thể gửi',
    dup: 'Đã đề xuất tin tuyển dụng này rồi.',
  } : ko ? {
    title: '공고 추천 메일', to: '받는 사람', selectJob: '공고 선택', selectPh: '기업 등록 공고 선택...',
    history: '보낸 추천', applied: '지원함', sent: '발송됨', alreadySent: '✓ 발송됨',
    lang: '메일 언어', preview: '메일 미리보기', previewLoading: '미리보기 불러오는 중...',
    send: '보내기', sending: '발송 중...', done: '발송 완료', close: '닫기',
    noJobs: '기업 등록 공고(company_self)가 없습니다.', noEmail: '이메일이 없는 계정입니다 — 발송 불가',
    dup: '이미 이 공고를 추천했습니다.',
  } : {
    title: 'Recommend a job', to: 'To', selectJob: 'Job', selectPh: 'Select a company-posted job...',
    history: 'Sent recommendations', applied: 'Applied', sent: 'Sent', alreadySent: '✓ Sent',
    lang: 'Email language', preview: 'Email preview', previewLoading: 'Loading preview...',
    send: 'Send', sending: 'Sending...', done: 'Sent', close: 'Close',
    noJobs: 'No company-posted jobs (company_self).', noEmail: 'Account has no email — cannot send',
    dup: 'Already recommended this job.',
  }
  const [jobId, setJobId] = useState('')
  const [mailLang, setMailLang] = useState('vi')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)

  const sentJobIds = new Set(history.map(h => h.job_id))

  useEffect(() => {
    if (!jobId) { setPreview(null); return }
    let alive = true
    setPreviewLoading(true)
    setError(null)
    setSentTo(null)
    fetch('/api/admin/talent-recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: person.id, jobId, lang: mailLang, preview: true }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.ok) setPreview(data)
        else setError(data.error || `HTTP ${res.status}`)
      })
      .catch(e => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setPreviewLoading(false) })
    return () => { alive = false }
  }, [jobId, mailLang]) // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!jobId || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/talent-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: person.id, jobId, lang: mailLang }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) setError(M.dup)
      else if (!res.ok) setError(data.error || `HTTP ${res.status}`)
      else {
        setSentTo(data.to)
        onSent(data.recommendation || null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const label = { fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 5 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 520, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '20px 22px', boxShadow: '0 12px 40px rgba(15,23,42,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{M.title}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 3 }}>
              {M.to}: <strong style={{ color: '#374151' }}>{person.full_name || '-'}</strong> · {person.email || M.noEmail}
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9CA3AF', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {history.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={label}>{M.history}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5, background: '#FAFBFC', border: '1px solid #EEF0F2', borderRadius: 8, padding: '7px 10px' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>
                    <strong>{h.job_title}</strong> · {h.job_company}
                  </span>
                  <span style={{ flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{h.created_at ? new Date(h.created_at).toLocaleDateString('ko-KR') : ''}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: h.applied_at ? '#DCFCE7' : '#EEF1F4', color: h.applied_at ? '#15803D' : '#64748B' }}>
                      {h.applied_at ? M.applied : M.sent}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={label}>{M.selectJob}</div>
          {jobs.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>{M.noJobs}</div>
          ) : (
            <JobSelect
              jobs={jobs}
              value={jobId}
              onChange={setJobId}
              sentJobIds={sentJobIds}
              placeholder={M.selectPh}
              sentLabel={M.alreadySent}
            />
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={label}>{M.lang}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['vi', '🇻🇳 Tiếng Việt'], ['ko', '🇰🇷 한국어'], ['en', '🇺🇸 English']].map(([code, name]) => (
              <button key={code} onClick={() => setMailLang(code)}
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${mailLang === code ? '#ff6000' : '#E5E8EB'}`,
                  background: mailLang === code ? '#ff600014' : '#fff', color: mailLang === code ? '#ff6000' : '#6B7280' }}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {jobId && (
          <div style={{ marginBottom: 14 }}>
            <div style={label}>{M.preview}</div>
            {previewLoading ? (
              <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '12px 0' }}>{M.previewLoading}</div>
            ) : preview ? (
              <div style={{ border: '1px solid #EEF0F2', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', padding: '9px 12px', borderBottom: '1px solid #EEF0F2', background: '#FAFBFC' }}>{preview.subject}</div>
                {/* 실제 발송되는 HTML 그대로 렌더 (서버가 만든 자체 템플릿) */}
                <div style={{ maxHeight: 380, overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            ) : null}
          </div>
        )}

        {error && <div style={{ fontSize: 12.5, color: '#DC2626', marginBottom: 12 }}>{error}</div>}
        {sentTo && <div style={{ fontSize: 12.5, color: '#15803D', fontWeight: 700, marginBottom: 12 }}>✓ {M.done} → {sentTo}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', border: '1px solid #E5E8EB', borderRadius: 8, fontSize: 13, background: '#fff', color: '#6B7280', cursor: 'pointer', fontWeight: 600 }}>
            {M.close}
          </button>
          <button onClick={send} disabled={!jobId || !preview || sending || !!sentTo}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, background: (!jobId || !preview || sending || sentTo) ? '#FDBA8C' : '#ff6000', color: '#fff', cursor: (!jobId || !preview || sending || sentTo) ? 'default' : 'pointer', fontWeight: 700 }}>
            {sending ? M.sending : M.send}
          </button>
        </div>
      </div>
    </div>
  )
}
