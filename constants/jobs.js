export const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=400&fit=crop',
]

// 직군 분류: 대분류(group) → 소분류(role). role.value 가 jobs.role 컬럼에 저장되는 canonical 영어 키.
// 기존 15개 값(Backend, Frontend, DevOps, QA, Design, PM, HR, Marketing, Sales, Finance, Operations, Non-IT …)은
// 소분류 value 로 그대로 유지 → 기존 공고 데이터가 안 깨진다. 신규 세분화 직군만 추가.
// 라벨은 ko/vi/en 3개국어(저장값은 영어 키, 화면 라벨만 번역).
export const ROLE_GROUPS = [
  {
    key: 'software',
    label: { ko: '소프트웨어 개발', en: 'Software Development', vi: 'Phát triển phần mềm' },
    roles: [
      { value: 'Backend',   label: { ko: '백엔드 개발자', en: 'Backend Developer', vi: 'Lập trình viên Backend' } },
      { value: 'Frontend',  label: { ko: '프론트엔드 개발자', en: 'Frontend Developer', vi: 'Lập trình viên Frontend' } },
      { value: 'Fullstack', label: { ko: '풀스택 개발자', en: 'Fullstack Developer', vi: 'Lập trình viên Fullstack' } },
      { value: 'Mobile',    label: { ko: '모바일 개발자 (iOS/Android)', en: 'Mobile Developer (iOS/Android)', vi: 'Lập trình viên Mobile (iOS/Android)' } },
      { value: 'Web',       label: { ko: '웹 개발자', en: 'Web Developer', vi: 'Lập trình viên Web' } },
      { value: 'Embedded',  label: { ko: '임베디드 SW 엔지니어', en: 'Embedded Software Engineer', vi: 'Kỹ sư phần mềm nhúng' } },
      { value: 'Game',      label: { ko: '게임 개발자', en: 'Game Developer', vi: 'Lập trình viên Game' } },
    ],
  },
  {
    key: 'data',
    label: { ko: '데이터', en: 'Data', vi: 'Dữ liệu' },
    roles: [
      { value: 'Data Analyst',   label: { ko: '데이터 분석가', en: 'Data Analyst', vi: 'Chuyên viên phân tích dữ liệu' } },
      { value: 'Data Engineer',  label: { ko: '데이터 엔지니어', en: 'Data Engineer', vi: 'Kỹ sư dữ liệu' } },
      { value: 'Data Scientist', label: { ko: '데이터 과학자', en: 'Data Scientist', vi: 'Nhà khoa học dữ liệu' } },
      { value: 'BI',             label: { ko: 'BI 분석가/엔지니어', en: 'BI Analyst / Engineer', vi: 'Chuyên viên / Kỹ sư BI' } },
      { value: 'ML Engineer',    label: { ko: '머신러닝 엔지니어', en: 'Machine Learning Engineer', vi: 'Kỹ sư Machine Learning' } },
      { value: 'AI Engineer',    label: { ko: 'AI 엔지니어 / 연구원', en: 'AI Engineer / Researcher', vi: 'Kỹ sư / Nghiên cứu AI' } },
    ],
  },
  {
    key: 'infra',
    label: { ko: '인프라 · 운영', en: 'Infrastructure & Ops', vi: 'Hạ tầng & Vận hành' },
    roles: [
      { value: 'DevOps',   label: { ko: 'DevOps 엔지니어', en: 'DevOps Engineer', vi: 'Kỹ sư DevOps' } },
      { value: 'SRE',      label: { ko: '사이트 신뢰성 엔지니어 (SRE)', en: 'Site Reliability Engineer (SRE)', vi: 'Kỹ sư SRE' } },
      { value: 'SysAdmin', label: { ko: '시스템 관리자', en: 'System Administrator', vi: 'Quản trị hệ thống' } },
      { value: 'Cloud',    label: { ko: '클라우드 엔지니어', en: 'Cloud Engineer', vi: 'Kỹ sư Cloud' } },
      { value: 'Network',  label: { ko: '네트워크 엔지니어', en: 'Network Engineer', vi: 'Kỹ sư mạng' } },
      { value: 'DBA',      label: { ko: '데이터베이스 관리자 (DBA)', en: 'Database Administrator (DBA)', vi: 'Quản trị CSDL (DBA)' } },
    ],
  },
  {
    key: 'qa',
    label: { ko: '품질 · 테스트', en: 'Quality & Test', vi: 'Chất lượng & Kiểm thử' },
    roles: [
      { value: 'QA',            label: { ko: 'QA 엔지니어 / 테스터', en: 'QA Engineer / Tester', vi: 'Kỹ sư QA / Tester' } },
      { value: 'QA Automation', label: { ko: 'QA 자동화 엔지니어', en: 'QA Automation Engineer', vi: 'Kỹ sư QA Automation' } },
      { value: 'QC',            label: { ko: 'QC 엔지니어', en: 'QC Engineer', vi: 'Kỹ sư QC' } },
    ],
  },
  {
    key: 'product',
    label: { ko: '제품 · 디자인', en: 'Product & Design', vi: 'Sản phẩm & Thiết kế' },
    roles: [
      { value: 'PM',            label: { ko: '제품 관리자 (PM)', en: 'Product Manager', vi: 'Product Manager' } },
      { value: 'PO',            label: { ko: '제품 소유자 (PO)', en: 'Product Owner', vi: 'Product Owner' } },
      { value: 'Design',        label: { ko: 'UI/UX 디자이너', en: 'UI/UX Designer', vi: 'Nhà thiết kế UI/UX' } },
      { value: 'UX Researcher', label: { ko: 'UX 연구원', en: 'UX Researcher', vi: 'Nghiên cứu UX' } },
    ],
  },
  {
    key: 'security',
    label: { ko: '보안', en: 'Security', vi: 'Bảo mật' },
    roles: [
      { value: 'Security Engineer',  label: { ko: '보안 엔지니어', en: 'Security Engineer', vi: 'Kỹ sư bảo mật' } },
      { value: 'Security Analyst',   label: { ko: '사이버 보안 분석가', en: 'Cybersecurity Analyst', vi: 'Chuyên viên phân tích an ninh mạng' } },
      { value: 'Penetration Tester', label: { ko: '침투 테스터', en: 'Penetration Tester', vi: 'Penetration Tester' } },
    ],
  },
  {
    key: 'leadership',
    label: { ko: '아키텍처 · 리더십', en: 'Architecture & Leadership', vi: 'Kiến trúc & Lãnh đạo' },
    roles: [
      { value: 'Solutions Architect', label: { ko: '솔루션 아키텍트', en: 'Solutions Architect', vi: 'Kiến trúc sư giải pháp' } },
      { value: 'Tech Lead',           label: { ko: '기술 리드 / 팀 리드', en: 'Tech Lead / Team Lead', vi: 'Tech Lead / Team Lead' } },
      { value: 'Engineering Manager', label: { ko: '엔지니어링 매니저', en: 'Engineering Manager', vi: 'Engineering Manager' } },
      { value: 'CTO',                 label: { ko: 'CTO / 엔지니어링 부사장', en: 'CTO / VP of Engineering', vi: 'CTO / Phó CT Kỹ thuật' } },
    ],
  },
  {
    key: 'other_tech',
    label: { ko: '기타 기술', en: 'Other Tech', vi: 'Kỹ thuật khác' },
    roles: [
      { value: 'Business Analyst', label: { ko: '비즈니스 분석가 (BA)', en: 'Business Analyst (BA)', vi: 'Chuyên viên phân tích nghiệp vụ (BA)' } },
      { value: 'Technical Writer', label: { ko: '기술 작가', en: 'Technical Writer', vi: 'Technical Writer' } },
      { value: 'IT Support',       label: { ko: 'IT 지원 / 헬프데스크', en: 'IT Support / Helpdesk', vi: 'Hỗ trợ IT / Helpdesk' } },
      { value: 'ERP/CRM',          label: { ko: 'ERP/CRM 전문가 (SAP, Salesforce)', en: 'ERP/CRM Specialist (SAP, Salesforce)', vi: 'Chuyên gia ERP/CRM (SAP, Salesforce)' } },
      { value: 'Blockchain',       label: { ko: '블록체인 개발자', en: 'Blockchain Developer', vi: 'Lập trình viên Blockchain' } },
    ],
  },
  {
    key: 'business',
    label: { ko: '비 IT · 비즈니스', en: 'Non-IT · Business', vi: 'Phi IT · Kinh doanh' },
    roles: [
      { value: 'HR',         label: { ko: '인사 (HR)', en: 'HR', vi: 'Nhân sự (HR)' } },
      { value: 'Marketing',  label: { ko: '마케팅', en: 'Marketing', vi: 'Marketing' } },
      { value: 'Sales',      label: { ko: '영업', en: 'Sales', vi: 'Kinh doanh' } },
      { value: 'Finance',    label: { ko: '재무 / 회계', en: 'Finance', vi: 'Tài chính' } },
      { value: 'Operations', label: { ko: '운영', en: 'Operations', vi: 'Vận hành' } },
      { value: 'Non-IT',     label: { ko: '기타 (Non-IT)', en: 'Other (Non-IT)', vi: 'Khác (Non-IT)' } },
    ],
  },
]

// 하위호환: 평면 값 리스트(기존 import 유지). 신규 소분류 canonical 값 전체.
export const ROLE_OPTIONS = ROLE_GROUPS.flatMap(g => g.roles.map(r => r.value))

// value → { group, label } 인덱스. 레거시 값(신규 목록엔 없지만 기존 데이터에 존재)도 포함.
const ROLE_INDEX = {}
ROLE_GROUPS.forEach(g => g.roles.forEach(r => { ROLE_INDEX[r.value] = { group: g.key, label: r.label } }))
// 'Data' 는 과거 포괄 직군값 → 6개로 세분화됐지만 기존 공고엔 남아있음. 데이터 카테고리로 매핑.
const LEGACY_ROLES = {
  Data: { group: 'data', label: { ko: '데이터', en: 'Data', vi: 'Dữ liệu' } },
}

// role 저장값 → 화면 라벨(언어별). 미등록 값은 원문 그대로.
export function roleLabel(value, lang = 'en') {
  const e = ROLE_INDEX[value] || LEGACY_ROLES[value]
  return e ? (e.label[lang] || e.label.en) : (value || '')
}
// role 저장값 → 소속 대분류 key (필터 그룹핑용). 없으면 null.
export function roleGroupKey(value) {
  const e = ROLE_INDEX[value] || LEGACY_ROLES[value]
  return e ? e.group : null
}
// 대분류 key → 화면 라벨(언어별).
export function roleGroupLabel(key, lang = 'en') {
  const g = ROLE_GROUPS.find(g => g.key === key)
  return g ? (g.label[lang] || g.label.en) : (key || '')
}
export const TYPE_OPTIONS = ['remote','onsite','hybrid']
// 근무지 — 베트남 주요 도시/성 + 원격/기타 (회사 ATS 폼·필터 공통)
export const LOCATION_OPTIONS = ['Hồ Chí Minh','Hà Nội','Đà Nẵng','Hải Phòng','Cần Thơ','Bình Dương','Đồng Nai','Bắc Ninh','Hưng Yên','Quảng Ninh','Khánh Hòa','Thừa Thiên Huế','Bà Rịa – Vũng Tàu','Remote','Khác / Other']
export const TECH_OPTIONS = ['Java','Python','AWS','React','Go','TypeScript','JavaScript','Node.js','Kotlin','Docker','Spring Framework','Rust','Swift','Flutter','Kubernetes']

// 근무 요일/시간 기본값 — 회사가 프로필/공고에서 값을 지정하지 않았을 때 상세페이지에
// 노출되는 폴백. (예전엔 이 문자열이 JobPreview.js·jobs/[id].js에 하드코딩돼 있었음)
export const DEFAULT_WORK_DAYS = 'Monday – Friday'
export const DEFAULT_WORK_HOURS = '9:00 AM – 6:00 PM'
export const DEFAULT_PAID_LEAVE = '12+ days / year'
export const DEFAULT_CONTRACT = 'Full-time (Permanent)'

export const MARKET_SALARY = {
  Backend:   { 0: 17000000, 1: 35000000, 3: 41000000, 5: 57000000, 8: 68000000 },
  Frontend:  { 0: 17000000, 1: 33000000, 3: 47000000, 5: 57000000, 8: 58000000 },
  Fullstack: { 0: 16000000, 1: 25000000, 3: 37000000, 5: 47000000, 8: 63000000 },
  Data:      { 0: 18000000, 1: 27000000, 3: 45000000, 5: 57000000, 8: 95000000 },
  DevOps:    { 0: 18000000, 1: 32000000, 3: 45000000, 5: 60000000, 8: 75000000 },
  Mobile:    { 0: 17000000, 1: 32000000, 3: 38000000, 5: 53000000, 8: 52000000 },
  PM:        { 0: 20000000, 1: 33000000, 3: 52000000, 5: 62000000, 8: 75000000 },
  Design:    { 0: 16000000, 1: 26000000, 3: 38000000, 5: 48000000, 8: 58000000 },
  QA:        { 0: 16000000, 1: 24000000, 3: 30000000, 5: 39000000, 8: 53000000 },
}

export const TECH_PREMIUM = { Go: 1.08, Rust: 1.10, Kotlin: 1.06, Swift: 1.06, Kubernetes: 1.07, AWS: 1.05, Terraform: 1.07, Scala: 1.08, Elixir: 1.09, 'Machine Learning': 1.10, AI: 1.10, Blockchain: 1.08, 'Spring Framework': 1.03, React: 1.02, TypeScript: 1.03 }

export const JOBS_PER_PAGE = 20
