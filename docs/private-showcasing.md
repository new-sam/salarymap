# /private/showcasing — 화면·API 로직 정리

비공개 인재 추천 화면(브랜드명 "공고마감")의 전체 동작. 다른 프로젝트(ggmg.ai.kr)에서
이 흐름을 붙이거나 링크할 때 필요한 계약을 기준으로 정리했다.

관련 파일
- 화면: `pages/private/showcasing.js` (1,890줄, 단일 파일)
- API: `pages/api/private/jd-extract.js` · `jd-criteria.js` · `jd-match.js` · `inquiry.js`
- 점수 로직: `lib/jdMatch.js`
- 링크 토큰: `lib/showcaseToken.js`
- DDL: `supabase/migrations/20260805_showcase_links.sql` · `20260806_showcase_inquiries.sql` · `20260806_showcase_result_cache.sql`

---

## 1. 한 줄 요약

기업 담당자가 JD를 붙여넣으면 → 조건을 뽑고 → 이력서 풀을 훑어 → **10명**을 카드로 보여주고
→ 상담 문의를 받는다. 후보의 실명·이메일·이력서 원본은 화면에도 응답에도 없다.

---

## 2. 진입 — 인증이 아니라 "안 알려진 주소"

`/private/showcasing?c=<토큰>`

- **로그인 없음.** 주소를 아는 사람은 그냥 열린다. 토큰이 없거나 위조여도 페이지는 열린다.
- 토큰이 하는 일은 딱 하나 — **"누구에게 보낸 링크로 들어왔나"를 로그에 붙이는 것**.
- `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` 로 검색 차단.
  robots.txt에는 안 적는다(주소를 광고하는 꼴이라).

### 토큰 형식 (`lib/showcaseToken.js`)

```
payload = "회사명|캠페인"            // 예: "멋쟁이사자처럼|showcase1"
token   = base64url(payload) + "." + base64url(HMAC-SHA256(payload, SECRET))
```

- SECRET: `process.env.RESUME_PUBLIC_TOKEN_SECRET`, 기본값이 소스 리터럴 `'wsj11029-resume-public'`
  (로컬 스크립트가 서명하고 prod가 검증하는 구조라 양쪽이 같아야 함)
- `makeToken(company, campaign)` / `verifyToken(token)` → `{ company, campaign }` 또는 `null`
- 구분자가 `|` 인 이유: 회사명에 점이 들어가도(`A.I. Corp`) 파싱이 안 깨지게

### getServerSideProps 분기

| 조건 | props |
|---|---|
| `c` 없음 / 서명 불일치 | `{ co: null, campaign: null, off: false, c: null }` |
| 서명 OK + `showcase_links`에 **있음** | `{ co: 회사명, campaign, off: false, c: 토큰 }` |
| 서명 OK + `showcase_links`에 **없음** | `{ co: null, campaign: null, off: true, c: null }` |

세 번째가 **추적을 끊은 링크**다. `showcase_links`에서 행을 지우면 그 링크는 이벤트를 안 남기고
검색 기록에도 기업명이 안 붙는다. 서명은 회수할 수 없으니 "표에 있느냐"가 곧 "아직 세는 링크냐".
단, 상담 문의는 그대로 받는다.

---

## 3. 화면 상태 머신

`step` 하나로 돈다: `input → criteria → match → finish → done`

| step | 화면 |
|---|---|
| `input` | 워드마크 + JD 입력칸 하나 (붙여넣기 or 파일 첨부) |
| `criteria` | 로딩 — 퍼센트 0→30(상한 55), "JD를 읽고 있어요" |
| `match` | 로딩 — 퍼센트 →94(상한 99), 조건 상자가 채워짐 |
| `finish` | 퍼센트를 100까지 빠르게 채움 (14ms 간격) |
| `done` | 결과 — 10장 카로셀 + 하단 고정 CTA |

포인트 몇 개:
- **퍼센트는 연출이다.** 서버 호출이 두 방뿐이라 진짜 진행률이 없다. 다만 경계에서는 거짓말을 안 한다
  — 조건 단계는 30에서, 매칭 단계는 94에서 기어가며 결과를 기다린다.
- **결과가 캐시로 즉시 와도 최소 3초는 로딩에 머문다.** 조건 상자("이렇게 이해했습니다")를
  읽을 시간을 주려고. 실제 매칭(15초대)에서는 이 대기가 0.
- 입력칸은 `grow()`로 내용만큼 자라고, 340px을 넘으면 "넓게 보기" 토글이 나타난다.
- `Cmd/Ctrl + Enter`로 제출.

---

## 4. API 계약 4개

### 4-1. `POST /api/private/jd-extract` — 파일 → 텍스트

`multipart/form-data`, 필드명 `file`

- 허용: `.pdf` `.docx` `.txt` `.md` / 최대 **5MB** / 뽑은 글은 20,000자에서 자름
- 응답: `{ text, name }`
- 에러: 파일 없음·확장자 불가·용량 초과·스캔본(글자 30자 미만) → 400
- **저장하지 않는다.** 임시 파일도 `finally`에서 즉시 삭제.
- 뽑은 글은 입력칸을 **덮지 않고 이어 붙인다** (사람이 먼저 쓴 조건이 날아가지 않게)

### 4-2. `POST /api/private/jd-criteria` — JD 원문 → 조건

요청: `{ jd: string }` (30자 미만이면 400)

모델: **gpt-4o**, `temperature: 0`, `seed: 7`, `response_format: json_object`

응답:
```jsonc
{
  "pool": 1497,            // 훑을 이력서 건수 (로딩 문구에 씀). 실패 시 null
  "h": "<sha256 64자>",    // JD 원문 지문 — 소문자화 + 공백 정규화 후 해시. 원문은 저장 안 함
  "criteria": {
    "title": "하노이 백엔드 개발자",
    "positions": ["Backend", "Fullstack"],   // 고정 목록에서만 (POSITIONS 41개)
    "requirements": ["...", "..."],          // 3~8개. 유추한 건 문장 끝에 "(추정)"
    "preferred": ["..."],                    // 최대 5개
    "must_skills": ["React", "TypeScript"],  // 최대 8
    "nice_skills": ["..."],
    "keywords": ["..."],                     // 도메인·산업 단서
    "yoe_min": 3, "yoe_max": 5,              // 또는 null
    "korean": "required|plus|none",
    "english": "required|plus|none",
    "note": "근무지·고용형태 등 한 줄",
    "inferred": 2                            // (추정) 요건 개수
  }
}
```

서버가 모델 출력 위에 얹는 **코드 보정 3가지** — 여기가 이 API의 핵심이다:

1. **"우대" 단어가 붙은 요건은 우대로 옮긴다.** `/우대|ưu tiên|preferred|nice to have|a plus/i`
   한국 JD는 자격요건 목록 안에 "한국어 가능자 우대"를 섞어 쓰는데, 그대로 두면 통과선이 되어
   한국어 없는 사람이 전부 미달로 떨어진다. 단, 옮기고 나서 요건이 2개 미만이면 안 옮긴다.
2. **어학 강도 되돌리기(demote).** 모델이 "한국 기업의 베트남 채용이니 한국어는 당연히 필수"로
   넘겨짚는다. 요건 문장에 없고 우대에만 있으면 `plus`로, 양쪽에 다 없으면 `none`으로 내린다.
   이 한 글자가 1차 필터에서 −15점이라 영향이 크다.
3. **요건이 2개 미만이면 400.** 충족률이 0% 아니면 100%로만 나와 순위가 안 생긴다.

### 4-3. `POST /api/private/jd-match` — 조건 → 후보 10명

요청: `{ criteria, c: <토큰|null>, h: <해시|null> }`
`maxDuration: 60` (Vercel 함수 타임아웃)

응답:
```jsonc
{
  "sid": "<uuid|null>",   // 검색 id. null이면 화면이 문의 버튼을 감춘다
  "pool": 1497,           // 전체 이력서
  "screened": 46,         // 모델이 실제로 판정한 수
  "passed": 12,           // 기준을 넘은 수
  "yoeWindow": { "lo": 2, "hi": 6 },
  "picks": [ /* 카드 10장 */ ]
}
```

카드 한 장:
```jsonc
{
  "fit": 87,              // 화면의 적합점수 (0~100)
  "rank": "A|B|C|탈락",
  "why": "이 분을 왜 추천하는지 한 문장",
  "strengths": ["은행 결제 시스템 운영", "팀 리드 경험"],
  "met": 5, "total": 6,           // 자격요건 충족
  "pref": 2, "prefTotal": 3,      // 우대 충족
  "missing": ["...", "..."],
  "photo": "https://...",
  "title": "결제 시스템 백엔드 개발자",   // 모델이 한국어로 새로 쓴 직무 = 이 화면에서 이 사람의 '이름'
  "position": "Backend",
  "yoe": 3.4, "yoeM": 41,         // 화면은 yoeM으로 "3년 5개월" 표기
  "bullets": ["...", "...", "..."],  // 파서가 뽑은 관련 경험 (최대 5)
  "english": "비즈니스 회화", "korean": "중급",   // 레벨 표현만 한국어화
  "skills": ["React", "TypeScript", ...],       // 최대 8, 조건에 걸린 것부터
  "skillsMore": 12,
  "hits": ["React", "TypeScript"]               // 이 중 조건에 걸린 것 — 화면에서 주황 칩
}
```

**응답에 없는 것: `id`, `full_name`, `email`, `resume_url`.**
SQL의 SELECT 목록(`COLUMNS`)에서 아예 빼서, 화면 코드가 실수해도 샐 것이 없게 했다.

### 4-4. `POST /api/private/inquiry` — 상담 문의 접수

요청:
```jsonc
{
  "sid": "<검색 uuid>",
  "picked": [0, 2, 4],      // 후보 id가 아니라 카드 인덱스
  "name": "홍길동", "company": "○○테크",
  "email": "a@b.com",       // 화면이 한 칸에서 @ 유무로 갈라 보냄
  "phone": "",
  "when": "2026-08-12 14:00, 2026-08-13 10:30",
  "memo": "...",
  "hp": "",                 // 함정칸 (봇만 채운다)
  "t": 1754500000000        // 모달을 연 시각
}
```

- **후보를 id로 받지 않는다.** 누구인지는 서버가 `showcase_searches.picks[i]`를 펴서 안다.
  그래서 이 API가 열려 있어도 후보 신원은 요청에도 응답에도 없다.
- 봇 두 겹: `hp`가 채워졌거나 체류가 3초 미만이면 **400이 아니라 200 `{ok:true}`**를 준다
  (무엇에 걸렸는지 알려 주면 맞춰서 다시 보낸다).
- `MAX_PER_SEARCH = 3` — 같은 sid로 3건까지. 429.
- **IP를 저장하지 않는다.** sid를 얻으려면 LLM 20여 회·20초짜리 검색을 치러야 해서
  폼 자체가 이미 비싼 문 뒤에 있다는 판단.
- 접수 성공 시 `notifyShowcaseInquiry(id)`로 메일 발송하되, 실패해도 접수는 성공 처리.

---

## 5. 매칭 파이프라인 (`jd-match` + `lib/jdMatch.js`)

```
전체 풀 (~1,500)
  ↓ 1차: 코드 점수 prefilterScore()            SCREEN_N = 48
48명
  ↓ 2차: gpt-4o-mini 병렬 판정 → judge() 보정
판정 완료
  ↓ 정렬: 우대충족 → 충족률 → fit → 1차점수
통과자(passed)
  ↓ 3차: gpt-4o 비교 순위 (통과자 > 10명일 때만)  RANK_N = 14
10명 (PICK_N)
```

### 1차 — `prefilterScore(p, c)`

순위가 아니라 "명백히 아닌 사람 걷어내기". 가중치는 굵게만:

| 항목 | 점수 |
|---|---|
| `positions`에 직무 일치 | +30 |
| `must_skills` 적중률 | × 40 |
| `nice_skills` 적중 | 개당 +4 (최대 16) |
| `keywords` 적중 | 개당 +3 (최대 15) |
| 연차가 허용창 안 | +10 / 미달 −6·년(최대 25) / 초과 −5·년(최대 20) |
| 한국어 required | 있으면 +12, 없으면 **−15** |
| 한국어 plus + 보유 | +10 |
| 영어 required | +8 / −8 |
| 영어 plus + 보유 | +6 |
| 주요이력(bullets) 있음 | +5 |

스킬 매칭은 `normSkill()`(소문자 + 영숫자/+/# 만 남김)로 "React.js"≡"React", "Node.js"≡"NodeJS".
3글자 미만 토큰(Go·C·R)은 정확 일치만 — 부분일치를 열면 "Go"로 "Google"이 걸린다.

### 2차 — 모델은 충족/미달만 판정, 등급·점수는 코드가 낸다

모델(`gpt-4o-mini`)이 답하는 것: 요건별 met/missing, preferred_met, score_breakdown(4항목),
title_ko, why, strengths.

프롬프트의 **읽기 규칙 6조** — 없으면 모델이 요건을 실제보다 세게 읽어 멀쩡한 후보가 떨어진다:
"또는"은 택일 / "및"만 전부 요구 / "~같은·등"은 예시 / "경험" vs "이해·지식" 구분 /
애매하면 충족 쪽 / 요건 하나는 한 번만.

`judge()`의 코드 보정:
- **보정 0 (제일 중요):** 분모는 언제나 **JD의 요건 수**. 모델 목록을 그대로 세면 요건을 하나
  지어낸 사람은 "4/4", 빠뜨린 사람은 "3/3"이 되어 카드마다 잣대가 달라진다. 요건 하나하나를
  훑어 모델이 충족이라 했는지만 본다(`sameRequirement()` — 토큰 60% 겹침).
- 보정 1: met/missing 중복 제거
- 보정 2: 연차 허용창 안이면 연차 요건을 met으로 옮김 (분모에는 남김)

점수:
```
score = requirements_match(0~40) + experience_relevance(0~30)
      + skills_alignment(0~20)  + career_trajectory(0~10)
ratio = met / (met + missing)
fit   = round(60 × ratio + 0.4 × score)          // 화면의 적합점수
```
`fit`에 ratio를 섞는 이유: 모델은 0~100을 쓰라 해도 5·10 단위로만 답해서 그대로 쓰면
순서가 제비뽑기가 된다.

등급 기준: `ratio < 0.5` 또는 `score < 55` → **탈락** / `< 0.7` → C / `< 0.85` → B / 그 이상 A
(A는 우대 1개 이상 충족했거나 JD에 우대사항이 없을 때만)

통과선 0.5는 감이 아니라 ktc-support에서 실제로 고객사까지 전달된 지원자 1,567명의 충족률 5%분위.

연차 허용창: `lo = max(min−1, min×0.5)`, `hi = max ? max+1 : min+4`

### 3차 — 비교 순위 (`gpt-4o`)

2차는 한 명씩 보기 때문에 통과자끼리는 전부 만점이 된다. 그래서 마지막 한 번은 나란히 놓고 본다.

- 순위의 **첫 기준은 우대사항** (자격요건은 이미 통과선으로 썼으므로 더 가릴 게 없다)
- JD가 연차를 요구 안 했으면 후보 설명에서 **연차를 아예 지우고** 보여준다(`hideYoe`).
  문장으로 "연차로 줄 세우지 마라"고 시켜도 15년차가 5년차 위로 올라왔다.
- 최종 점수 = `0.6 × 코드점수 + 0.4 × 모델점수`
- 실패하면 코드 순서를 그대로 쓴다.

### 10명을 못 채우면

기준 미달자를 "가장 가까운 순"으로 채우되 `rank === '탈락'`이라 카드에 **"조건 일부 미달"** 배지가 붙고,
결과 화면 상단에 "조건을 다 만족하는 분은 N명이라..." 안내가 뜬다.

---

## 6. 결과 캐시 (24시간)

`jd-criteria`가 준 JD 해시 `h`에 **형식 버전 접미사**를 붙여 키로 쓴다: `${h}#5`

```
캐시 히트 → showcase_searches.result 를 그대로 반환 (sid는 캐시된 행의 것)
캐시 미스 → 매칭 실행 → 응답한 뒤 백그라운드로 jd_hash·result UPDATE
```

- 온도 0은 "거의" 고정일 뿐이라, 같은 링크에서 두 번 돌렸을 때 10명이 바뀌는 걸 막는 게 이 캐시.
- 24시간인 이유: 인재풀이 매일 자란다. 영영 고정하면 새 이력서가 영영 안 보인다.
- **카드 형식이나 값 규칙을 바꾸면 `#5` 숫자를 올려야 한다.** 안 올리면 24시간 동안
  옛 형식으로 저장된 결과가 새 화면에 계속 나온다.
- 컬럼(`jd_hash`, `result`)이 없으면 조용히 지나간다 — 캐시는 없어도 되는 층.

---

## 7. DB 3표

```sql
showcase_links (token PK, company, campaign, created_at)
-- 발급한 링크. 행을 지우면 그 링크는 추적이 끊긴다.

showcase_searches (id uuid PK, token, company, criteria jsonb, picks text[],
                   pool, screened, passed, created_at, jd_hash, result jsonb)
-- picks 순서 = 화면 카드 번호. JD 원문은 저장 안 함.
-- picks가 uuid[]가 아니라 text[]인 건 user_profiles가 이 마이그레이션 폴더 밖이라서. FK 없음.

showcase_inquiries (id uuid PK, search_id → searches(id) ON DELETE RESTRICT,
                    picked int[], contact_name, company, email, phone,
                    when_pref, memo, status, created_at)
-- status: new | contacted | met | closed
```

`purge_showcase_searches()` — 문의로 안 이어진 30일 지난 검색을 지우는 RPC.
크론이 아니라 **검색이 일어날 때마다** 호출한다(쌓이는 시점이 곧 치울 시점).
`ON DELETE RESTRICT` 덕분에 청소 쿼리가 틀려도 문의가 붙은 검색은 삭제가 실패한다.

> ⚠️ `20260806_showcase_result_cache.sql`(jd_hash·result 컬럼)이 Supabase 대시보드에서
> 적용됐는지 확인 필요. 없으면 캐시만 조용히 죽는다(기능 자체는 동작).

---

## 8. 결과 화면 UI 요약

- **카로셀** — 10장을 한 줄에 세우고 3.5초마다 자동 전환. 무한 루프(양쪽 K=2장 복제 후
  복제 구간 도착 시 전환 없이 순간이동). 드래그(pointer 이벤트), 옆 카드 클릭으로 호출,
  하단 점 10개. 라이브러리 없음.
- **1~3위** — 카드 바탕이 금색(`#FFF8EF`/테두리 `#EFCF9F`), "N위" 알약(1위 브랜드 오렌지,
  2위 잉크, 3위 슬레이트). 4위부터는 회색 원에 숫자만.
- **적합점수 라벨** — `fit ≥ 90` 매우 적합 / `≥ 80` 적합 / 그 미만 조건 근접.
- **예상 단가** — 연차 구간 표. 코드에 하드코딩:

  | 연차 | 월 단가 |
  |---|---|
  | ~1년 (신입) | 99만원 |
  | 1~3년 | 149만원 |
  | 3~5년 | 199만원 |
  | 5년+ 또는 미상 | 별도 협의 |

- **문의 입구는 하단 고정 CTA 하나** — "N명 이력서 받아보기". 3.6초마다 콩콩 튀는 애니메이션.
- **문의 모달** — 필수 3칸(성함·회사명·이메일 또는 전화). 자체 달력으로 미팅 시간을 여러 개
  칩으로 담을 수 있음(10:00~17:30, 30분 단위, 점심 제외). 아무도 안 고르면 **전원**으로 접수.
- **개발 환경에서만** 접수 실패 시 완료 화면으로 넘기고 노란 배너에 실패 사유를 띄운다.
  프로덕션에서는 절대 안 넘긴다.

---

## 9. 이벤트 로그 (`lib/track`, 어드민 `/admin/showcasing-events`)

`off === true`면 아무것도 안 보낸다. 모든 이벤트에 `{ co, campaign }`이 붙는다.

| 이벤트 | meta |
|---|---|
| `psc_open` | — |
| `psc_file` | `chars` |
| `psc_submit` | `chars`, `file` |
| `psc_criteria` | `inferred`, `yoe_min`, `positions` |
| `psc_result` | `picks`, `screened` |
| `psc_fail` | `stage`('criteria'\|'match'), `message`(120자) |
| `psc_restart` | `picks` |
| `psc_inquiry_open` | `all` |
| `psc_meeting` | `n`, `picks`(인덱스 배열), `when`, `memo`(불리언), `all` |
| `psc_meeting_fail` | `n`, `message` |

**JD 원문은 절대 안 싣는다** — 길이만 남긴다. 고객사가 아직 안 낸 자리를 통째로 저장하는 셈이라서.
연락처·이름·회사명도 이벤트에 안 싣는다(events는 클라이언트도 쓰는 테이블).

---

## 10. ggmg.ai.kr에 팝업을 붙일 때

### 확인된 사실

- 이 앱은 `X-Frame-Options`나 CSP `frame-ancestors`를 **어디에도 설정하지 않는다**
  (next.config.mjs·vercel.json·middleware 전부 없음). 즉 현재로선 **다른 도메인에서 iframe으로
  띄우는 게 막혀 있지 않다.**
- 반대로 API들은 **CORS 헤더를 하나도 안 준다.** ggmg에서 UI만 새로 만들고
  `salary-fyi.com/api/private/*`를 직접 fetch하면 **브라우저가 막는다.**
- 모든 fetch가 상대경로(`/api/private/...`)라 코드를 그대로 복사해도 도메인이 안 맞는다.

### 선택지

| 방식 | 필요한 작업 | 트레이드오프 |
|---|---|---|
| **A. iframe 팝업** (권장) | ggmg에 모달 + `<iframe src="https://<도메인>/private/showcasing?c=토큰">`. 이 저장소는 손 안 댐 | 가장 빠르고 안전. 다만 iframe 안이 100vh 기준 레이아웃이라 모달 높이를 충분히(≥720px) 줘야 함. 닫기/높이 조절이 필요하면 `postMessage` 한 줄 추가 |
| **B. 링크/새 창** | 팝업에서 버튼 → 새 탭 | 제일 단순. 이탈이 생김 |
| **C. ggmg에 UI 재구현** | 4개 API에 CORS 허용 오리진 추가 + 토큰 시크릿 공유 + 파일 업로드(multipart) 경로까지 | 1,890줄 UI를 옮겨야 하고, 캐시 버전(`#5`)·카드 스키마가 바뀔 때마다 양쪽을 같이 고쳐야 함 |

**A를 권한다.** 이 화면은 세 단계 상태·자체 달력·카로셀·로딩 연출이 한 파일에 얽혀 있어
분리 비용이 크고, 개인정보 경계(응답에 id/이름/이력서 URL이 없다)가 이 저장소 안에서만 지켜진다.

### A로 갈 때 이 저장소에서 해야 할 일 (있다면)

1. **기업별 토큰 발급** — `makeToken('회사명', 'ggmg')` 로 만들어 `showcase_links`에 insert.
   캠페인 값을 `ggmg`로 따로 두면 이벤트 로그에서 유입을 갈라 볼 수 있다.
2. **iframe 허용 오리진 명시** (선택) — 지금은 아무나 iframe할 수 있는 상태다.
   ggmg만 허용하려면 `next.config.mjs`에 `Content-Security-Policy: frame-ancestors https://ggmg.ai.kr`
   를 이 경로에만 건다.
3. iframe 안에서는 하단 고정 CTA가 `position: fixed`라 iframe 뷰포트 기준으로 잡힌다 —
   모달 높이가 짧으면 CTA가 카드를 가린다.

---

## 11. 코드 읽을 때 주의할 점

- **주석의 "5명"은 낡았다.** `PICK_N = 10`이 현재 값이고, 화면·문구도 10명 기준이다.
  `jd-match.js`와 `showcasing.js` 주석 여럿이 아직 "5명"·"20명으로 좁힌다"로 남아 있다
  (실제로는 48명 스크리닝 → 10명).
- `useState('input')`의 주석은 `input | criteria | match | done`인데 실제로는 `finish`가 하나 더 있다.
- styled-jsx 함정이 주석에 여러 번 나온다 — 스코프 키프레임 이름이 해시로 바뀌어서 인라인
  `style`의 `animation`과 안 만난다. 그래서 일부는 `<style jsx global>`이고, 버튼 애니메이션은
  반드시 같은 서브트리 안에 있어야 한다.
