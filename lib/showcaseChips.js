/* /private/showcasing 첫 화면의 선택지 — 직군·스택·경력·우대조건.

   원티드(wanted.co.kr/wdlist)의 직군 대·소분류 라벨을 그대로 쓴다. 우리말로 새로 짓지
   않은 이유는 하나다 — 고객사 담당자는 원티드에서 쓰던 이름으로 직군을 말한다. 같은
   자리를 두 이름으로 부르면 고르는 데 시간이 든다.

   개발 소분류 둘만 예외다(풀스택·백엔드 — 각 항목 주석 참고). 원티드 이름을 따르는 건
   '담당자가 쓰는 말'이기 때문인데, 그 셋만큼은 프론트엔드·백엔드·풀스택이 현장에서
   한 벌로 통한다. 원티드를 따르느라 가운데만 '서버'라고 부르면 그 벌이 깨진다.

   다만 목록은 원티드 것을 그대로 옮기지 않았다. 원티드는 20 대분류·418 소분류인데
   그중 절반 이상이 우리 풀에서 0명이다. 고를 수 있는데 아무도 안 나오는 칩은
   "그런 인재가 없다"가 아니라 "이 서비스가 고장났다"로 읽힌다. 그래서 사람이 실제로
   있는 것만 남겼다.

   괄호 안 숫자는 2026-08-11 기준 인재풀(이력서 보유·HR 제외 2,060명)에서 센 값이다.
   칩을 넣고 뺀 근거라 주석에 남긴다. 화면에는 안 띄운다 — 풀이 얼마나 얇은지를
   고객사에 그대로 알리는 셈이라서. 풀은 매일 자라니 숫자는 대소 관계만 믿으면 된다.

   stacks 는 언제나 '보유자 많은 순'이다. 화면이 앞 열 개만 펴고 나머지를 접기 때문에,
   순서가 곧 "무엇을 먼저 보여줄까"가 된다 — 우리 풀이 두꺼운 것과 아무나 쓰는 것이
   앞에 와야 고른 만큼 사람이 나온다. 묶음(언어→DB→인프라)으로 정렬하면 Vue(115)가
   Docker(532)보다 앞에 서는 일이 생긴다.

   positions 는 user_profiles.position 값이다. 여기 적힌 값만 jd-criteria 의 POSITIONS
   목록을 통과한다 — 목록 밖의 값은 걸러지므로, 칩을 늘릴 때는 그 표에 있는 값인지부터
   봐야 한다. */

export const GROUPS = [
  {
    key: 'dev',
    label: '개발',
    roles: [
      /* 전에는 이 칩 이름이 '웹 개발자'였다. 그런데 잡히는 415명 중 401명의 position 이
         'Fullstack' 이라, 누르면 풀스택 개발자가 나오는데 칩은 그 말을 안 하고 있었다.

         파서를 의심했지만 파서가 맞았다(2026-08-11 401명 전수 확인):
         - 프런트+백 스택을 둘 다 가진 사람 385명(96%). 프런트만 가진 사람은 0명이다.
         - 이력서 headline·직함에 스스로 'full stack/풀스택'이라 적은 사람 338명(84%).
         parseResume 의 enum(constants/jobs.js)에는 'Web' 도 있어서 모델이 고를 수
         있었는데도 14명만 그렇게 골랐다. 즉 이 풀은 실제로 풀스택이고, 틀렸던 건
         우리가 붙인 한국어 이름이었다.

         그래서 'Web' 14명도 이 칩에 함께 둔다. 원티드는 웹과 풀스택을 따로 두지만
         14명짜리 칩을 세우면 눌러서 5명을 못 채운다 — 모바일 칩(안드로이드·iOS =
         'Mobile' 하나)과 같은 사정이다. */
      { key: 'web', label: '풀스택 개발자', positions: ['Fullstack', 'Web'] },                 // 415 (Fullstack 401 + Web 14)
      /* 원티드 라벨은 '서버 개발자'지만 여기서는 '백엔드'로 쓴다. 위아래가 풀스택·
         프론트엔드라, 가운데만 서버라고 부르면 셋이 한 벌로 안 읽힌다. 잡는 값은
         그대로 'Backend' 하나다 — 바뀐 건 이름뿐이다. */
      { key: 'server', label: '백엔드 개발자', positions: ['Backend'] },                        // 221
      { key: 'frontend', label: '프론트엔드 개발자', positions: ['Frontend'] },                 // 140
      { key: 'ml', label: '머신러닝 엔지니어', positions: ['AI Engineer', 'ML Engineer', 'AI/Data'] }, // 77
      { key: 'qa', label: 'QA,테스트 엔지니어', positions: ['QA', 'QA Automation'] },           // 75
      /* 원티드는 안드로이드·iOS·크로스플랫폼을 따로 두지만 우리는 못 가른다 —
         셋 다 position 이 'Mobile' 하나다(53명). 가르지 못하는 걸 갈라 보여 주면
         "iOS 개발자"를 골랐는데 안드로이드 이력서가 나온다. 한 칩으로 둔다. */
      { key: 'mobile', label: '모바일 앱 개발자', positions: ['Mobile'] },                      // 55
      { key: 'devops', label: 'DevOps / 시스템 관리자', positions: ['DevOps', 'Cloud', 'SysAdmin', 'Network'] }, // 52
      { key: 'embedded', label: '임베디드 개발자', positions: ['Embedded'] },                   // 26
      { key: 'dataeng', label: '데이터 엔지니어', positions: ['Data Engineer'] },               // 14
      { key: 'support', label: '기술지원', positions: ['IT Support'] },                        // 12
      { key: 'datasci', label: '데이터 사이언티스트', positions: ['Data Scientist'] },           // 10
    ],
    /* 개발 풀 1,095명에서 센 보유자 수 순. Git(528)·Postman(286)은 뺐다 — 거의 모두가
       적어 두는 말이라 골라도 아무도 안 걸러진다. 조건이 아니라 소음이다.

       React 가 첫 자리인 건 표기 변형을 합쳐 세서다(React·ReactJS·React.js = 610).
       갈라 세면 194 로 열 번째쯤에 앉아 접힘 뒤로 숨는다 — 우리 풀에서 제일 두꺼운
       기술이 안 보이게 된다. 매칭 쪽 normSkill 은 아직 이 셋을 못 합친다(별건). */
    stacks: ['React', 'JavaScript', 'Docker', 'TypeScript', 'MySQL', 'PostgreSQL', 'Node.js',
      'MongoDB', 'Python', 'Java', 'Next.js', 'Redis', 'NestJS', 'C#', 'Spring Boot', 'AWS',
      'PHP', 'Vue.js', 'Laravel', 'Angular', 'Kubernetes', '.NET'],
  },
  {
    key: 'marketing',
    label: '마케팅·광고',
    /* 마케터 288명은 position 이 전부 'Marketing' 한 값이다. 소분류를 눌러도 지금은
       같은 288명이 모집단이고, 퍼포먼스냐 콘텐츠냐는 이력서 본문에서 갈라야 한다
       (lib/talentCategory.js 의 eliteCategory 가 headline 정규식으로 하는 일).
       그 판정은 매칭 프롬프트 쪽 일이라 여기서는 라벨만 세워 둔다. */
    roles: [
      { key: 'performance', label: '퍼포먼스 마케터', positions: ['Marketing'] },
      { key: 'content', label: '콘텐츠 마케터', positions: ['Marketing'] },
      { key: 'social', label: '소셜 마케터', positions: ['Marketing'] },
      { key: 'brand', label: '브랜드 마케터', positions: ['Marketing'] },
      { key: 'digital', label: '디지털 마케터', positions: ['Marketing'] },
      { key: 'research', label: '마켓 리서처', positions: ['Marketing'] },
      { key: 'copy', label: '카피라이터', positions: ['Marketing'] },
    ],
    stacks: ['Canva', 'CapCut', 'Social Media Management', 'Content Creation', 'SEO',
      'Video Editing', 'Content Marketing', 'Market Research', 'Photoshop', 'Digital Marketing',
      'Copywriting', 'Facebook Ads', 'Google Ads', 'Google Analytics'],
  },
  {
    key: 'design',
    label: '디자인',
    // 디자이너 117명도 position 이 'Design' 하나다 — 마케팅과 같은 사정.
    roles: [
      { key: 'ux', label: 'UX 디자이너', positions: ['Design', 'UX', 'UX Researcher'] },
      { key: 'ui', label: 'UI,GUI 디자이너', positions: ['Design', 'UX'] },
      { key: 'graphic', label: '그래픽 디자이너', positions: ['Design'] },
      { key: 'motion', label: '영상,모션 디자이너', positions: ['Design'] },
      { key: 'bx', label: 'BI/BX 디자이너', positions: ['Design'] },
      { key: 'webdesign', label: '웹 디자이너', positions: ['Design'] },
    ],
    stacks: ['Figma', 'Photoshop', 'Illustrator', 'Branding', 'Canva', 'InDesign',
      'After Effects', 'Prototyping', 'Wireframing'],
  },
  {
    key: 'biz',
    label: '경영·비즈니스',
    roles: [
      { key: 'planner', label: '서비스 기획자', positions: ['Business Analyst', 'Planning'] }, // 29
      { key: 'pm', label: 'PM·PO', positions: ['PM', 'Product Owner'] },                      // 24
      { key: 'ops', label: '운영 매니저', positions: ['Operations'] },                          // 20
      { key: 'finance', label: '회계·경리', positions: ['Finance'] },                          // 15
      /* 원티드는 HR 을 대분류로 따로 두지만 우리 풀은 13명이라 대분류를 세울 수 없다.
         한 칸짜리 대분류를 만들면 고르러 들어갔다가 빈손으로 나온다. */
      { key: 'hr', label: '인사담당', positions: ['HR'] },                                     // 13
      { key: 'analyst', label: '데이터 분석가', positions: ['Data Analyst'] },                  // 12
    ],
    stacks: ['SQL', 'Excel', 'Power BI', 'Figma', 'Jira', 'Agile', 'Scrum', 'Confluence'],
  },
  {
    key: 'sales',
    label: '영업',
    // 46명. 셋 다 position 은 'Sales' 계열 한 덩어리다.
    roles: [
      { key: 'global', label: '해외영업', positions: ['Sales'] },
      { key: 'b2b', label: '기업영업', positions: ['Sales', 'Business Dev'] },
      { key: 'tech', label: '기술영업', positions: ['Sales Engineer', 'Sales'] },
    ],
    /* 스택 칩이 없다. 46명에서 5명 넘게 적은 도구가 Excel·Sales·Customer Service 셋뿐이라,
       칩을 세우면 고를 것이 없는 줄이 하나 생긴다. stacks 가 비면 화면이 그 줄을 건너뛴다. */
    stacks: [],
  },
]

/* 소분류마다 다른 스택을 더 얹는다. 개발 대분류의 기본 목록은 웹 쪽으로 기울어 있어서,
   머신러닝이나 모바일을 고른 사람에게는 고를 것이 없다 — 그 자리에서 쓰는 도구는
   목록에 아예 없다.

   여기 것이 대분류 목록보다 '앞'에 선다(stacksFor 참고). 뒤에 붙이면 개발 기본 22개를
   지나야 나오는데, 화면은 앞 열 개만 펴므로 접힘 뒤로 통째로 숨는다 — 머신러닝을
   고른 사람에게 PyTorch 를 감추면 이 목록을 만든 이유가 없어진다.
   각 줄도 보유자 많은 순이다. */
export const ROLE_STACKS = {
  ml: ['FastAPI', 'PyTorch', 'TensorFlow', 'OpenCV', 'Scikit-learn', 'LangChain', 'Pandas', 'NumPy', 'RAG'],
  datasci: ['Scikit-learn', 'Pandas', 'NumPy', 'Power BI'],
  dataeng: ['Pandas', 'NumPy'],
  mobile: ['React Native', 'Flutter', 'Kotlin', 'Swift'],
}

/* 경력 구간 — JD 만으로는 연차가 안 잡히는 경우가 많다. 담당자 머릿속에는 구간이 있는데
   글에만 안 적힌 것뿐이라 여기서 한 번 받는다.

   칩 넷(신입·1~3·3~5·5+)이던 것을 막대 하나로 바꿨다. 칩은 우리가 미리 그어 둔 네 칸
   중에서 고르게 하는데, 실제로 오는 요구는 "2~4년"처럼 그 칸에 안 맞는 것이 많았다.
   여러 칸을 골라 합집합으로 넓히는 길이 있긴 했지만, 그건 '2~4년이 필요하다'를
   '1~5년도 좋다'로 바꿔 말하게 시키는 것이다 — 구간을 직접 긋게 하면 그 왜곡이 없다.

   위 끝(YOE_MAX)은 열린 구간이다. 그 위로는 사람마다 폭이 커서 한 숫자로 못 묶는다 —
   결과 카드의 단가 표(COST)가 5년차 위를 숫자로 안 적는 것과 같은 이유다.

   숫자를 이제 클라이언트가 쥐지만 그대로 믿지는 않는다. 로그인이 없는 경로라
   jd-criteria 가 0~YOE_MAX 로 다시 조인다 — 여기 상수와 그쪽 상수는 같아야 한다. */
export const YOE_MAX = 10

/* 구간 → 사람이 읽는 말. 화면에 뜨는 글과 서버로 가는 글(chipsToJd)이 같은 말을 쓰도록
   한 자리에 둔다 — 화면에 "신입~3년"이라 떠 놓고 조건에 "0~3년"이라 적히면, 결과가
   이상할 때 무엇으로 찾은 건지 되짚을 데가 없다. */
export function yoeLabel(min, max) {
  const [lo, hi] = yoeClamp(min, max)
  /* 양 끝에 걸쳐 있어도 '전체'라고 쓰지 않는다. 손잡이는 0 과 10 에 서 있는데 글자만
     '전체'라고 하면, 이게 고른 값인지 아직 안 고른 자리인지가 안 갈린다 — 실제로
     "회색인데 뭔지 모르겠다"는 말이 여기서 나왔다. 서 있는 자리를 그대로 읽어 준다.
     (연차를 안 따진다는 뜻인 건 변함없다 — jd-criteria 가 이 구간을 null 로 본다.) */
  if (lo === 0 && hi >= YOE_MAX) return `0~${YOE_MAX}년+`
  /* 위 끝에 닿으면 '+'. '10년 이상'이라고 풀어 쓰면 위 손잡이가 끝에 서 있는데도 글에는
     끝이 없어서, 막대가 말하는 것과 글이 말하는 것이 어긋나 보인다. '+'는 그 자리에
     끝이 있고 그 위가 열려 있다는 걸 한 글자로 말한다. */
  if (hi >= YOE_MAX) return lo === YOE_MAX ? `${YOE_MAX}년+` : `${lo}~${YOE_MAX}년+`
  if (lo === hi) return lo === 0 ? '신입' : `${lo}년차`
  // '2년~5년'이 아니라 '2~5년' — 단위는 뒤에 한 번만 붙는다. 앞을 '신입'으로 여는 때만 예외다.
  return lo === 0 ? `신입~${hi}년` : `${lo}~${hi}년`
}

// 화면과 서버가 같은 규칙으로 조인다 — 뒤집힌 구간·범위 밖·숫자가 아닌 것 전부 여기서 걸린다.
export function yoeClamp(min, max) {
  const n = (v, dflt) => {
    const k = Math.round(Number(v))
    return Number.isFinite(k) ? Math.min(YOE_MAX, Math.max(0, k)) : dflt
  }
  const lo = n(min, 0)
  const hi = n(max, YOE_MAX)
  return lo <= hi ? [lo, hi] : [hi, lo]
}

/* 우대조건. 우대는 떨어뜨리는 조건이 아니라 순서를 정하는 조건이라, 골라도 후보가
   줄지 않는다 — 그래서 개수보다 '한 줄에 접히느냐'가 실질 한계다. 지금 일곱이다.

   고른 기준은 둘이다. "프로필에 근거가 남아 있느냐"와 "골랐을 때 카드가 채워지느냐".
   뒤엣것이 이 화면에만 있는 조건이다 — 여기는 우리 인재가 좋아 보여야 하는 자리라,
   근거가 얇은 칩은 고른 순간 결과가 빈약해져서 안 넣느니만 못하다.

   근거는 이렇게 남아 있다(2026-08-11, 이력서 보유 2,060명 기준):
   - 관련 전공 학위 → major 1,776명(88%). 학위 등급은 degree 필드(Associate/Bachelor/
     Master/PhD)가 따로 있다.
   - 석사 이상 → 같은 degree 필드. enum 이라 판정이 흔들리지 않는다. 머신러닝·데이터·
     연구 직군에서 실제로 갈리는 자리라 따로 세웠다.
   - 영어 업무 가능 → english_cert 1,182명(59%). IELTS·B2·Fluent 로 표기가 섞여 있어
     등급화가 필요하다(lib/langTier.js).
   - 한국어 업무 가능 → korean_cert 는 70명(3%)뿐이다. 근거로는 제일 얇은데도 넣는 건,
     고객사가 대놓고 한국어를 찾을 때 누를 곳이 없으면 그게 더 큰 구멍이어서다.
     대신 이 칩이 무슨 일을 하는지는 알고 써야 한다 — 아래 '작동하는 층' 참고.
   - 한국 유학 · 한국 대학 → university 1,816명(90%). 한국 대학을 나온 사람은 한국어·
     문화 적응·비자 이력이 한꺼번에 붙어서, cert 한 장보다 고객사가 사려는 것에 가깝다.
     한국어 칩의 얇은 근거를 메우는 자리다.
   - 글로벌 기업 / 한국 기업 근무 경험 → experiences 1,781명(88%)에 회사명이 있다.
     한국 기업으로 보이는 경력은 러프하게 세어 111명. 우대라서 적어도 되지만 필수로
     쓰면 안 된다. 회사명 판정 테이블은 우리가 안 들고 있다 — 학교와 달리 회사는
     모델이 이름을 보고 판단한다.

   ─ 작동하는 층 ─
   우대 칩이 실제로 힘을 쓰는 데는 두 곳뿐이고, 둘이 서로 다르다.

   1) 코드 가점(lib/jdMatch.js prefilterScore) — 어학 둘만 여기 걸린다. c.korean === 'plus'
      면 korean_cert 보유자에게 +10, english 는 +6. 즉 '한국어 업무 가능'을 고르면 그
      70명이 상위 20명을 크게 차지한다. 가점은 제일 센데 모수는 제일 얇은 조합이라,
      이 칩만 단독으로 고르면 결과가 눈에 띄게 얇아질 수 있다. '한국 유학'을 같이
      두는 이유가 그거다.
   2) LLM 판정(pages/api/private/jd-match.js) — 나머지 다섯은 전부 여기서만 산다.
      haystackOf 에 든 것(university·major·edu_ko·경력의 회사명과 직함·주요이력)을
      모델이 읽고 우대 충족을 센다. 코드가 미리 걸러 둔 20명 안에서만 벌어지는 일이다.

   그래서 '한국 유학'에 판정 테이블을 안 붙였다. lib/topUniversities.js 의 overseasOf 에
   한국을 더하면 될 것 같지만, 그 함수는 어드민 인재풀의 해외 비율·점수 가중치·CSV 가
   같이 쓴다 — 여기 칩 하나 때문에 저쪽 KPI 가 조용히 바뀐다. */
export const PREF_CHIPS = [
  { key: 'major', label: '관련 전공 학위' },
  { key: 'master', label: '석사 이상' },
  { key: 'english', label: '영어 업무 가능' },
  { key: 'korean', label: '한국어 업무 가능' },
  { key: 'kr_study', label: '한국 유학 · 한국 대학' },
  { key: 'global_company', label: '글로벌 기업 근무 경험' },
  { key: 'kr_company', label: '한국 기업 근무 경험' },
]

export const groupOf = (key) => GROUPS.find((g) => g.key === key) || null

/* 고른 소분류가 얹는 스택까지 합쳐 화면에 낼 목록. 중복은 먼저 나온 것을 남긴다.
   소분류 것이 앞이다 — 직접 고른 자리의 도구가 먼저 보여야 한다(ROLE_STACKS 참고). */
export function stacksFor(groupKey, roleKeys) {
  const g = groupOf(groupKey)
  if (!g) return []
  const extra = (roleKeys || []).flatMap((k) => ROLE_STACKS[k] || [])
  return [...new Set([...extra, ...g.stacks])]
}

/* 고른 칩을 jd-criteria 가 읽을 글로 편다.

   이 화면은 이제 JD 를 아예 안 받는다(조건 직접 적기 제거). 그런데 뒤쪽(조건 뽑기 →
   판정 → 순위)은 전부 "글에서 요건을 뽑는다"를 전제로 서 있다. 그 셋을 한꺼번에 고쳐
   쓰는 대신 입구에서 글로 만들어 넣는다 — 칩 화면과 매칭 프롬프트를 따로 손볼 수 있게.
   즉 여기가 이제 파이프라인으로 들어가는 유일한 문이라, 칩에 없는 조건은 들어갈 길이
   없다. 새 조건은 반드시 칩으로 세워야 한다.

   직무 분류를 영문 코드로 같이 적는 이유: jd-criteria 는 모델이 뱉은 positions 중
   POSITIONS 목록에 있는 값만 남긴다. 우리말 라벨만 주면 모델이 목록 밖 표기를 지어내
   전부 걸러지고, 그러면 1차 거름망의 직무 일치(+30)가 통째로 논다. */
export function chipsToJd({ group, roles, stacks, yoe, prefs }) {
  const g = groupOf(group)
  if (!g) return ''

  const picked = g.roles.filter((r) => (roles || []).includes(r.key))
  const positions = [...new Set(picked.flatMap((r) => r.positions))]
  const prefLabels = PREF_CHIPS.filter((p) => (prefs || []).includes(p.key)).map((p) => p.label)
  // 전체(0~YOE_MAX)면 아예 안 적는다 — "경력 전체"라고 적어 두면 모델이 그걸 요건 한 줄로 센다.
  const [yoeLo, yoeHi] = yoeClamp(yoe?.[0], yoe?.[1])
  const yoeText = yoeLo === 0 && yoeHi >= YOE_MAX ? '' : yoeLabel(yoeLo, yoeHi)

  const lines = [
    `채용 직군: ${g.label}${picked.length ? ` — ${picked.map((r) => r.label).join(', ')}` : ''}`,
    positions.length ? `직무 분류 표기: ${positions.join(', ')}` : '',
    stacks?.length ? `필요 기술: ${stacks.join(', ')}` : '',
    yoeText ? `희망 경력: ${yoeText}` : '',
    // "우대사항" 이라는 말이 그대로 있어야 jd-criteria 의 우대 이동 보정(PREF_WORD)이 잡는다.
    // 요건 쪽으로 올라가면 통과선이 되어 그 조건이 없는 사람이 전부 미달로 떨어진다.
    prefLabels.length ? `우대사항: ${prefLabels.map((l) => `${l} 우대`).join(', ')}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}
