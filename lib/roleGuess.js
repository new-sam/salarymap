// 공고 제목 → canonical role 값(constants/jobs.js ROLE_GROUPS 소분류) 휴리스틱.
// 크롤러(crawl-targets/crawl-topdev/crawl-jobs) 공용. EN/KO/VI 키워드.
// 판단 불가면 null — 과거의 'Backend' 무조건 폴백이 비개발 공고를 오염시켰다.
// 순서 중요: 비개발·구체 키워드를 포괄적 개발 키워드보다 먼저 검사한다.

const RULES = [
  // ── 비즈니스 / 비개발 ('manager', 'executive' 계열을 개발 규칙보다 먼저)
  ['Sales', /account executive|business development|sales(?!force)|kinh doanh|bán hàng|phát triển thị trường|영업/],
  ['Marketing', /marketing|growth|\bbrand\b|communication|content|\bseo\b|social media|tiktok|shopify|truyền thông|마케팅|콘텐츠/],
  ['HR', /recruit|talent acquisition|\bhr\b|human resource|tuyển dụng|nhân sự|đào tạo|인사|채용/],
  ['Finance', /accountant|accounting|audit|finance|kế toán|kiểm toán|tài chính|회계|재무/],
  ['Procurement', /procurement|purchasing|thu mua|vật tư|구매/],
  ['Interpreter', /interpreter|translator|comtor|phiên dịch|biên dịch|thông dịch|통역|번역/],

  // ── 크리에이티브 / 연구 / 교육 / 기타 비IT — 분류 체계에 없는 직군은 기타로
  //    (webtoon coordinator 등이 아래 Operations의 'coordinator'에 선점되지 않게 먼저)
  ['Non-IT', /webtoon|manga|truyện tranh|artist|\b3d\b|video|creator|일러스트|họa sĩ|research scientist|medical scientist|biomedical research|annotator|curriculum|giảng viên|legal|luật|공사|công trình|xây dựng|civil engineer|vệ sinh/],
  ['Operations', /operation|coordinator|chăm sóc khách hàng|customer (service|support)|운영/],

  // ── 생산 · 제조 (VI 공고 다수)
  ['Production Manager', /production manager|quản đốc|tổ trưởng sản xuất|생산 관리/],
  ['Production Worker', /production worker|operator|\bthợ\b|công nhân|sản xuất|tổ sơn|dán tem|lắp ráp|생산직/],
  ['Warehouse', /warehouse|logistics|\bkho\b|giao hàng|soạn hàng|bốc hàng|창고|물류/],
  ['Maintenance', /maintenance|bảo trì|kỹ thuật điện|cơ khí|설비|유지보수/],
  ['HSE', /\bhse\b|an toàn lao động|safety officer|안전 관리/],
  ['Merchandiser', /merchandiser|\bmd\b/],

  // ── 기타 IT 전문직
  ['Business Analyst', /business analyst|\bba\b|phân tích nghiệp vụ/],
  ['Technical Writer', /technical writer/],
  ['ERP/CRM', /\berp\b|\bsap\b|salesforce|\bcrm\b|power platform/],
  ['IT Support', /it support|helpdesk|help desk|triển khai phần mềm|기술 지원/],
  ['Blockchain', /blockchain|web3|smart contract|블록체인/],

  // ── 보안
  ['Penetration Tester', /penetration test|pentest|모의해킹/],
  ['Security Analyst', /security analyst|cybersecurity analyst|보안 분석/],
  ['Security Engineer', /security|보안/],

  // ── 데이터 / AI (연구직 'scientist'는 위 Non-IT에서 이미 걸러짐)
  ['Data Analyst', /data analyst|phân tích dữ liệu|데이터 분석/],
  ['Data Engineer', /data engineer|데이터 엔지니어/],
  ['Data Scientist', /data scientist|데이터 과학/],
  ['BI', /business intelligence|bi analyst|bi engineer/],
  ['ML Engineer', /machine learning|\bml\b|머신러닝/],
  ['AI Engineer', /ai (engineer|developer|agent|specialist|researcher)|agentic ai|artificial intelligence|인공지능/],

  // ── 리더십 / 아키텍트 (마케팅 'Team Leader - Growth' 등이 먼저 걸러진 뒤)
  ['Solutions Architect', /solutions? architect|technical architect|아키텍트/],
  ['Engineering Manager', /engineering manager|head of engineering/],
  ['CTO', /\bcto\b|vp of engineering/],
  ['Tech Lead', /tech(nical)? lead|team lead(er)?|trưởng nhóm/],

  // ── 인프라
  ['DevOps', /devops|platform engineer|infrastructure|인프라/],
  ['SRE', /\bsre\b|site reliability/],
  ['Cloud', /cloud engineer|클라우드/],
  ['Network', /network|네트워크/],
  ['DBA', /\bdba\b|database (administrator|migration)|quản trị csdl/],
  ['SysAdmin', /system engineer|system administrator|sysadmin|시스템 엔지니어/],

  // ── 프로덕트 / 디자인
  ['PO', /product owner|\bpo\b/],
  ['UX Researcher', /ux research/],
  ['Design', /design|\bux\b|\bui\b|디자이/],
  ['PM', /product|project (manager|leader)|program manager|quản lý dự án|기획|\bpm\b/],

  // ── 소프트웨어 개발
  ['Frontend', /front[ -]?end|프론트/],
  ['Fullstack', /full[ -]?stack|풀스택/],
  ['Mobile', /mobile|\bios\b|android|flutter|react native|모바일|\b앱\b/],
  ['Embedded', /embedded|firmware|hardware|임베디드|펌웨어/],
  ['Game', /game\b|unity|unreal|게임/],
  ['QA Automation', /qa automation|test automation|automation (qa|test)/],
  ['QC', /\bqc\b|quality control/],
  ['QA', /\bqa\b|quality assurance|\btest(er|ing)?\b|kiểm thử|테스트/],
  ['Web', /website|web developer|웹 개발/],
  ['Backend', /back[ -]?end|\bserver\b|서버|백엔드|\bphp\b|laravel|magento|\.net|\bc#\b|\bjava\b(?!script)|phần mềm|software (engineer|developer)|개발자|lập trình/],
]

export function guessRole(title, techStack = []) {
  const t = ` ${(title || '').toLowerCase()} `
  for (const [role, re] of RULES) {
    if (re.test(t)) return role
  }
  const stack = (techStack || []).join(' ').toLowerCase()
  if (/php|\.net|java(?!script)|spring/.test(stack)) return 'Backend'
  if (/react|vue|angular/.test(stack)) return 'Frontend'
  return null
}
