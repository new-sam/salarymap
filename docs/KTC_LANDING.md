# /ktc — K-Tech College 랜딩 (이식 가이드)

> 외부 레포 `van-dot123/ktc-landing`(Next.js 14 App Router · TypeScript)의 랜딩을
> FYI(Next.js 16 Pages Router · JavaScript)로 옮긴 것. 같은 방식으로 다른 캠페인
> 랜딩을 만들 때 이 문서를 따라가면 된다.

---

## 한 줄 요약

**원본의 섹션 구성·순서는 그대로 두고, 마크업만 FYI 스택으로 다시 쓴 뒤 색·타이포를 FYI 디자인 시스템으로 갈아끼웠다. 공고 데이터는 원본과 같은 외부 Supabase를 읽기 전용으로 붙였다.**

---

## 1. 왜 복사가 아니라 재작성인가

| | 원본 ktc-landing | FYI salarymap |
|---|---|---|
| 라우터 | App Router (`src/app`) | **Pages Router** (`pages/`) |
| 언어 | TypeScript (.tsx) | **JavaScript** (.js, jsconfig) |
| Next | 14.2 | 16.1 |
| UI | shadcn/ui + Radix + framer-motion | Radix + 자체 인라인 스타일 |

파일을 그대로 옮기면 동작하지 않는다. 원본 의존성(framer-motion, swiper, uploadthing,
react-query, react-hook-form+zod)은 **하나도 추가하지 않고** 대체했다.

| 원본 | 대체 |
|---|---|
| framer-motion `AnimationLayout` | [`Reveal.js`](../components/ktc/Reveal.js) — IntersectionObserver 페이드업 |
| swiper `InfiniteMovingCards` | CSS `@keyframes` 마퀴 ([`ImageGallery.js`](../components/ktc/ImageGallery.js)) |
| shadcn `Button`/`Input`/`Select` | [`ktcStyles.js`](../components/ktc/ktcStyles.js) 토큰 + 네이티브 엘리먼트 |
| `next/image` + static import | `<img>` + `/ktc/*` 경로 |

---

## 2. 파일 지도

```
pages/ktc/index.js          220줄  섹션 조립 + 전체 반응형 CSS(한 곳에 모음)
pages/api/ktc/jobs.js        92줄  공고 공개 API (읽기 전용)
components/ktc/
  ktcStyles.js              105줄  색·타이포·버튼 토큰, 앵커 상수  ← 리테마 시작점
  Reveal.js                  39줄  스크롤 진입 애니메이션
  KtcNav.js                 131줄  섹션 탭바 + 스크롤스파이
  Hero.js                   138줄
  AboutUs.js / Organization.js / Advantage.js / Participants.js
  JobBoard.js               589줄  목록·상세·필터·페이지네이션·모달
  Benefits.js / Process.js / ApplySection.js / ImageGallery.js / Faq.js
public/ktc/                 4.6MB  로고·이미지·갤러리
lib/translations/{ko,vi}.js        ktc.* 키 각 138개
```

섹션 순서는 원본 `src/app/page.tsx`와 동일:
`Hero → AboutUs → Organization → Advantage → Participants → JobBoard → Benefits →
Process → ApplySection → ImageGallery → Faq`

---

## 3. 전역 크롬과의 관계 (pages/_app.js)

`/ktc`는 **FYI 헤더·푸터를 그대로 쓴다.** 자체로 갖는 건 섹션 탭바뿐이다.

```js
activePageFor()           → 'ktc' 반환 → GlobalNav 렌더 + 헤더 K-company 칩 활성
isStandaloneLanding       → MobileTabBar·AppDownloadModal 제외 (전환 동선 보호)
autoHideChrome 제외        → 헤더가 스크롤로 숨으면 fixed 탭바가 허공에 뜬다
body[data-standalone-landing] → 모바일 하단 60px 예약만 해제(상단 52px은 유지)
```

새 캠페인 랜딩을 만들면 이 4가지를 같이 손봐야 한다.

---

## 4. 리테마 — 색을 바꾸려면

**[`ktcStyles.js`](../components/ktc/ktcStyles.js)의 `c` 객체만 고치면 대부분 따라온다.**
회색 계열은 FYI 디자인 시스템(`tailwind.config.js`의 토스식 그레이)과 같은 값을 쓴다.

```js
export const c = {
  bg: '#f9f9f9', bgAlt: '#ffffff',
  text: '#191F28', textDim: '#4E5968', textFaint: '#8B95A1',   // gray 900/700/500
  line: '#E5E8EB', lineStrong: '#D1D6DB',                       // gray 200/300
  surface: '#ffffff', surfaceHi: '#F2F4F6',
};
export const BRAND = '#ff6000';
```

> 이 랜딩은 한 번 다크(#090909)로 만들었다가 **가독성 문제로 라이트로 되돌렸다.**
> 다크로 갈 경우 토큰 밖에 하드코딩된 곳들을 같이 바꿔야 한다:
> 히어로 배경 그라디언트/베일, 기관 로고 필터, 드롭다운 패널, 모달·바텀시트 배경막,
> 지원폼 입력칸. `grep -n "rgba(255,255,255\|rgba(0,0,0\|invert(1)" components/ktc/*.js`

---

## 5. 반응형 규칙은 한 곳에

미디어쿼리는 전부 [`pages/ktc/index.js`](../pages/ktc/index.js)의 `<style>` 블록에 있다.
컴포넌트는 인라인 스타일만 쓴다.

**브레이크포인트**

| 폭 | 무엇이 바뀌나 |
|---|---|
| ~480px | 배지·CTA·카드 패딩 축소, 헤더 52px |
| ~768px | 히어로 로고 2열, 주관기관 설명 숨김, 그리드 1열 |
| 900px~ | 공고 보드 좌우 분할(내부 스크롤), 참가대상 2단 전개, 소개 제목 한 줄 고정 |

### 여기서 걸렸던 함정 3가지

**① CSS 규칙 순서** — 선택자 우선순위가 같으면 나중 규칙이 이긴다.
`@media (max-width: 480px)` 블록이 기본 규칙보다 **앞**에 있어서 모바일 오버라이드가
통째로 무시된 적이 있다. 순서는 반드시 `기본 → max-width → min-width`.

**② 인라인 스타일 > CSS 클래스** — `{...s.card}`처럼 스프레드하면 `padding`이
인라인으로 박혀서 클래스의 `padding`이 안 먹는다. 두 가지로 해결했다.
- `!important` (예: `.ktc-adv-card { padding: … !important }`)
- **CSS 변수로 값만 넘기기** (히어로 세로 여백 `--ktc-hero-pt/pb`) ← 이쪽이 깔끔

**③ 템플릿 리터럴 안의 백틱** — `<style>{\`…\`}</style>` 주석에 백틱을 쓰면
문자열이 끊긴다. 주석에는 따옴표를 쓸 것.

---

## 6. 다국어

FYI의 `useT()` + `lib/translations/{ko,vi,en}.js` 플랫 딕셔너리를 그대로 쓴다.
접두사 `ktc.*`로 네임스페이스를 나눴고 **ko/vi 각 138개가 1:1로 맞아야 한다.**

```bash
# 키 짝 검사
node -e "const f=require('fs');const k=s=>new Set([...f.readFileSync(s,'utf8')
.matchAll(/^  '(ktc\.[^']+)':/gm)].map(m=>m[1]));
const K=k('lib/translations/ko.js'),V=k('lib/translations/vi.js');
console.log(K.size,V.size,[...K].filter(x=>!V.has(x)))"
```

**줄바꿈 제어를 번역문에 넣는다** — 언어마다 문장 구조가 달라 컴포넌트에 `<br>`을
박으면 엉뚱한 데서 끊긴다.

- **조건부 줄바꿈**: NBSP(` `)로 끊기면 안 되는 구간을 묶는다.
  `'IT 리모트 채용 프로그램'` → 좁아지면 `IT 리모트 / 채용 프로그램`으로만 끊김
- **항상 줄바꿈**: 번역문에 `<br />`을 넣고 `dangerouslySetInnerHTML`로 렌더
  (이 레포의 기존 관행 — `nav.brandTagline` 등)

---

## 7. 공고 데이터

[`pages/api/ktc/jobs.js`](../pages/api/ktc/jobs.js)가 **원본 레포와 같은 Supabase**의
`jobs`(`is_active=true`)를 읽는다. FYI로 동기화하지 않고 읽기 전용으로만 쓴다.

```
env: KTC_LANDING_SUPABASE_URL, KTC_LANDING_SUPABASE_SERVICE_ROLE_KEY
쓰기: pages/api/admin/ktc-landing-jobs.js (어드민)
읽기: pages/api/ktc/jobs.js (공개, s-maxage=300)
```

**원본 데이터가 지저분해서 API에서 정규화한다.** 클라이언트는 표시만 한다.

| 문제 | 처리 |
|---|---|
| `work_type` 8가지 표기 (`0n-site`←숫자 0, `On-site\r\n`, `Onsite`…) | `Onsite`/`Hybrid`/`Remote` 3개로 접음 |
| `location`에 개행·앞뒤 공백 | 공백 정리 |
| `category` 6종(IT·Marketing·Business·Designer·HR·UI/UX) | `group`을 IT/Non-IT로 파생 |
| 급여 VND 원단위 | 표시는 언어별로 나눔 — ko는 만(1e4), vi는 triệu(1e6) |

> `select('*')` 대신 컬럼을 명시했다. 서비스 롤 키를 쓰는 공개 엔드포인트라,
> 나중에 내부용 컬럼이 추가돼도 자동으로 새어나가지 않게 하려는 것.

---

## 8. 지원 폼 — 아직 안 붙음

현재 [`ApplySection.js`](../components/ktc/ApplySection.js)는 **UI만** 있고 제출하면
안내만 뜬다. 공고 상세의 "이 포지션 지원하기"도 준비중 모달로 연결된다.

방향은 정해져 있다: **구글 로그인 + 이력서 등록으로 FYI 회원을 만들고,
`ktc_program_applications`에 프로그램 지원 1건을 남긴다.**

- 마이그레이션 초안: [`supabase/migrations/20260728_ktc_program_applications.sql`](../supabase/migrations/20260728_ktc_program_applications.sql)
  — **아직 DB에 적용하지 않았다.** 대시보드 SQL 에디터에서 수동 실행(db push 금지)
- 재사용할 FYI 자산: `/api/profile/upload`(이력서), `GoogleOneTap`, `user_profiles`,
  `notifyApplicantReceipt`
- `job_applications`를 쓰지 않는 이유: `job_id`가 FYI `jobs`를 가리키는데 KTC 공고는
  외부 DB에 있고, 해당 테이블 RLS가 `job_id` 기준이라 정책이 깨진다

---

## 9. 다른 캠페인 랜딩으로 이식하려면

1. `components/ktc/` → `components/<캠페인>/` 복사, `ktcStyles.js`의 `c`·`BRAND` 교체
2. `pages/<캠페인>/index.js` 생성 — 섹션 조립 + `<style>` 블록(§5 순서 규칙 준수)
3. `lib/translations/{ko,vi}.js`에 `<캠페인>.*` 키 추가 (양쪽 개수 일치 확인)
4. `pages/_app.js` 4곳 등록 (§3)
5. `components/GlobalNav.js`에 진입점 추가 — `.gnav-zone` 칩 패턴 재사용
   (활성 시 `.gnav-link.on::after` 밑줄이 중복되므로 `::after { display:none }` 필요)
6. 자산은 `public/<캠페인>/`에. **원본 이미지를 그대로 넣지 말 것** — KTC는 갤러리
   원본이 160MB였고 `sips`로 1100px JPEG 변환해 2MB로 줄였다

---

## 10. 알려진 미완성

- **지원 폼 미연결** (§8)
- **미이식 라우트** — 원본의 `/event`(Matching Week), `/ung-tuyen`, `/cam-on`,
  `/thank-you`, 개인정보처리방침 MDX
- **퍼널 이벤트 없음** — 섹션 노출/로그인 시작/제출 단계 측정이 없어 이탈 지점을 모른다.
  원본 랜딩도 같은 문제로 2,789건이 몇 명 중 몇 명인지 알 수 없었다
- **SSR에 공고가 없다** — 클라이언트에서 fetch하므로 초기 HTML은 스켈레톤.
  SEO·로딩 깜빡임이 필요하면 `getStaticProps` + `revalidate`로 전환
- **문구 정합성** — 히어로는 "IT 리모트 채용"인데 실제 공고 43건 중 Remote는 0건
  (Onsite 41 / Hybrid 2), Non-IT(26)가 IT(17)보다 많다
