# Resume Registration UX Audit

스코프: 이력서 등록(작성·업로드·공개·재사용) 에 영향을 주는 모든 사용자 surface 와 데이터 흐름.
목적: 집중 개선 작업을 위한 baseline. 와이어프레임 + 플로우 + hotspot 우선순위.

작성일: 2026-06-20.
스크린샷: `docs/resume-ux/` (Playwright 캡처).

---

## 1. Surface 인벤토리

### A. 진입점

| # | 위치 (파일:라인) | 표면 | 비고 |
|---|---|---|---|
| A1 | `components/GlobalNav.js:160` | 헤더 우상단 "✨ AI 이력서" 너지 | 홈 + 이력서 미등록자, **인증 후에만** 표시 |
| A2 | `components/MobileTabBar.js:21` | 모바일 하단 "My Page" 탭 | 미로그인 시 `fyi-show-login` |
| A3a | `pages/jobs/[id].js:385` | 공고 **상세 페이지** Apply → 인라인 PDF 업로드 (5MB) | 익명도 업로드 영역 노출, 버튼은 "Login to apply" |
| A3b | `pages/jobs.js:1017,1695` | 공고 **리스트 모달** Apply | ⚠ 익명 클릭 시 **확인 없이 곧바로 Google OAuth** (A3a와 다른 UX) |
| A4 | `components/GlobalNav.js:242` | 데스크탑 사용자 드롭다운 "My Profile" | → `/profile` (익명은 `/` 로 리다이렉트) |
| A5 | `pages/profile.js:401` | 첫 방문 자동 노출 3-step 온보딩 모달 | 이력서 등록을 step 1로 안내 |

### B. 등록 폼 본체 (모두 `pages/profile.js` 내 카드)

| # | 라인 | 카드 | 핵심 요소 |
|---|---|---|---|
| B1 | 923–1011 | 이력서 | 업로드 / 변경 / 삭제 / AI 파싱 진행률 / 포트폴리오 URL / 공개 토글 |
| B2 | 1014–1122 | 기본 정보 | 사진(1MB↓ 권장), 이름, 소재지, 한 줄 소개 |
| B3 | 1124–1180 | 스킬 + 교육 | 쉼표 구분 스킬, 대학교/전공/졸업연도/GPA |
| B4 | 1182–1300 | 경력 + 프로젝트 | 동적 추가/제거, dirty 시각화 (초록 보더) |
| B5 | 821–906 | HR 공개 + 채용신호 + 근무형태 | `hr_visible`, `job_signal`, `work_type` |
| B6 | 737–758 | Floating 저장 버튼 | `isDirty` 일 때만 노출, 60% 미만이면 비활성 |

### C. 등록 이후 (Downstream) 노출

| # | 위치 | 표면 |
|---|---|---|
| C1 | `pages/profile.js` (본인 보기) | 본인 프로필 탭 (Profile / Posts / Employment / Badges / Applications) |
| C2 | `pages/for-companies.js:273` | 기업 인재 풀 노출 (`hr_visible=true` 만) |
| C3 | `components/company/CandidateDetail.js` | 기업 ATS 지원자 패널 (평가·인터뷰·메일) |
| C4 | `components/admin/ResumesView.js` | 어드민 이력서 테이블 + CSV + 배치 파싱 |
| C5 | `pages/api/job-applications.js` | 공고 지원 시 PDF 첨부 → `job_applications.resume_url` |
| C6 | `pages/api/profile/share-resume.js` | 공개 ON → 외부 VTM 인재풀 전송 (base64 PDF + meta) |

---

## 2. 사용자 플로우 다이어그램

```
[ENTRY]
  A1 GlobalNav AI 너지   ┐
  A2 Mobile My Page tab  ├─→ /profile ─→ (첫방문) 온보딩 3-step 모달
  A4 Dropdown My Profile ┘                  │
  A3 /jobs/[id] Apply ─→ 인라인 PDF 업로드 ─→ /api/job-applications
                        (미로그인이면 Google OAuth → /profile 유도)

[FORM @ /profile]
  ┌─ B1 이력서 카드 ────────────────────────────────┐
  │ [📄 이력서 등록] → 파일 선택                    │
  │   ↓ POST /api/profile/upload (FormData)         │
  │   ↓ user_profiles.resume_url (?v=timestamp)     │
  │   ↓ runAiParse()                                │
  │   ↓ GET /api/profile/parse-resume               │
  │      • pdf-parse 텍스트 추출                    │
  │      • 내장 JPEG 사진 추출 (10KB–2MB)           │
  │      • OpenAI gpt-4o-mini 필드 추출             │
  │   ↓ setForm 자동 채움                           │
  │ [✓ filename.pdf] [변경] [×]                     │
  │ 포트폴리오: [______]                            │
  │ ☐ 이력서 공개 → /api/profile/share-resume → VTM  │
  └─────────────────────────────────────────────────┘
  ↓ B2 기본정보 → B3 스킬·교육 → B4 경력·프로젝트
  ↓ B5 HR 공개 토글 (60% 미만이면 alert)
  ↓ B6 [저장] (Floating, dirty일 때만)
  → PUT /api/profile/talent

[DOWNSTREAM]
  C1 본인 /profile
  C2 /for-companies (hr_visible=true)
  C3 /company/ats (CandidateDetail)
  C4 /admin/dashboard (ResumesView)
  C5 /jobs/[id] 지원 → job_applications.resume_url
  C6 외부 VTM 인재풀
```

---

## 3. 와이어프레임

### 3.1 데스크탑 `/profile` 등록 폼 (max-width 580px)

```
┌────────── /profile ──────────────┐
│ [Header: 사진·이름·회사인증 배지]  │
│ [Tabs: Profile|Posts|Employ|...]  │
│                                   │
│ ╭─ B5 HR 공개 + 신호 ───────────╮ │
│ │ ☐ 인재풀 공개   [토글]        │ │
│ │ "기업이 당신을 찾을 수 있어요" │ │
│ │ ─────────                     │ │
│ │ 채용신호:                     │ │
│ │ [◉ 수동] [○ 기회] [○ 적극]   │ │
│ │ 근무형태:                     │ │
│ │ [All] [Remote] [On-site]      │ │
│ ╰───────────────────────────────╯ │
│                                   │
│ ╭─ 완성도 60% ████░░░░ ────────╮ │
│ │ "회사 인증 필요 (60%↑)"      │ │
│ ╰───────────────────────────────╯ │
│                                   │
│ ╭─ B1 이력서 ───────────────────╮ │
│ │ ✨ AI 이력서 등록해주세요     │ │
│ │ [📄 이력서 등록 / 드래그]    │ │
│ │ ── 진행 중 ──                 │ │
│ │ [████░░] 텍스트 추출 35%     │ │
│ │ ── 등록됨 ──                  │ │
│ │ 📄 file.pdf  [변경] [×]      │ │
│ │ 포트폴리오: [https://___]    │ │
│ │ ☐ 이력서 공개  ← VTM 전송!   │ │
│ ╰───────────────────────────────╯ │
│                                   │
│ ╭─ B2 기본정보 ─────────────────╮ │
│ │ [사진 72px] [변경]            │ │
│ │ 이름 [_________]              │ │
│ │ 소재지 [_______]              │ │
│ │ 한 줄 소개 [____]             │ │
│ ╰───────────────────────────────╯ │
│                                   │
│ ╭─ B3 스킬 / 교육 ──────────────╮ │
│ │ 스킬 [React, Node.js, ...]   │ │
│ │ 대학 [___] 전공 [___]        │ │
│ │ 졸업 [____] GPA [_._]        │ │
│ ╰───────────────────────────────╯ │
│                                   │
│ ╭─ B4 경력 [+추가] ─────────────╮ │
│ │ #1 회사 / 직무 / 기간 / 설명 │ │
│ ╰───────────────────────────────╯ │
│ ╭─ B4 프로젝트 [+추가] ────────╮ │
│ │ #1 이름 / 설명 / URL         │ │
│ ╰───────────────────────────────╯ │
│                                   │
│   [💾 저장] ← B6 Floating, dirty │
└───────────────────────────────────┘
```

### 3.2 `/jobs/[id]` Apply 인라인 업로드

```
┌─── /jobs/[id] ───────────────────┐
│ [공고 상세 본문]                 │
│ ╭─ Apply ──────────────────────╮ │
│ │ [Apply 클릭]                 │ │
│ │  ↓                           │ │
│ │ "PDF를 드래그하세요"         │ │
│ │ (선택) filename.pdf          │ │
│ │ [지원 제출]                  │ │
│ ╰──────────────────────────────╯ │
│ ※ 프로필 이력서 재사용 옵션 없음 │
└──────────────────────────────────┘
```

### 3.3 모바일 (≤480px)

```
┌── /profile (모바일) ──┐
│ [Header]              │
│ [Tabs 가로 스크롤]    │
│ [HR 공개]             │
│ [완성도]              │
│ [이력서]              │
│ [기본정보]            │
│ [...]                 │
│                       │
│ ⚠ 탭 전환 시          │
│   dirty 가드 없음     │
├───────────────────────┤
│ [Home][Jobs][My][...]│ ← 하단 탭
└───────────────────────┘
```

---

## 4. 개선 Hotspot (우선순위)

| 순위 | 항목 | 위치 | 영향 |
|---|---|---|---|
| 1 | 공고 지원 시 **프로필 이력서 재사용 불가** — 매번 새 PDF | `pages/jobs/[id].js:385` | 매번 업로드 = 지원 마찰 高 |
| 2 | 공개 토글 = **외부 VTM 전송** 동의 fluff | `pages/profile.js:986`, `pages/api/profile/share-resume.js:33` | 개인정보·신뢰 |
| 3 | 60% 게이트 사유 미공개 — "왜 못하지?" | `pages/profile.js:828` | 막다른 길 경험 |
| 4 | AI 파싱 **가짜 진행률** (setInterval) | `pages/profile.js:614-619` | 신뢰 저하 |
| 5 | 파싱 실패 → 수동입력 유도 부재 | `pages/api/profile/parse-resume.js:104` | 이탈 |
| 6 | 파일 크기 제한 **불일치** (10MB vs 5MB) | `upload.js:21` vs `jobs/[id].js:388` | 혼란 |
| 7 | 모바일 탭 전환 dirty 가드 없음 | `pages/profile.js:295` (데스크탑만) | 데이터 손실 |
| 8 | 진입점 5개 중복 | A1–A5 | 멘탈모델 분산 |
| 9 | `hr_visible` ↔ `company_verified` 관계 불명확 | `pages/profile.js:388, 821` | 토글 망설임 |
| 10 | `/jobs/[id]` 카피 i18n 누락 (베트남어) | `pages/jobs/[id].js:251–356` | 베트남 사용자 영어만 |
| 11 | 익명에서 `/profile` 진입 → `/` 리다이렉트 (인터셉트 모달 없음) | `pages/profile.js` 게이트 | 너지 클릭이 의도 잃어버림 |
| 12 | `/jobs` 리스트 모달 Apply 가 익명에서 **무경고 OAuth** | `pages/jobs.js:1695` | A3a와 달라 사용자 혼란 + 의도 손실 |

---

## 5. 데이터 모델 핵심

`user_profiles` 이력서 관련 컬럼 (`supabase/migrations/20260512_talent_profile.sql`):

```
resume_url        TEXT          -- S3 PDF URL (?v=timestamp 캐시버스팅)
photo_url         TEXT          -- 자동 추출되거나 수동 업로드
portfolio_url     TEXT
headline          TEXT          -- "Senior Backend Engineer"
position          TEXT          -- Backend/Frontend/AI/...
yoe_months        INT
skills            TEXT[]
experiences       JSONB         -- [{company, role, period, desc}]
projects          JSONB         -- [{name, desc, url}]
university, major, graduation_year, gpa
location, work_type, salary_min, salary_max
job_signal        TEXT          -- active|open|passive (default passive)
hr_visible        BOOL          -- 인재풀 노출 여부 (default false)
profile_completed_at TIMESTAMPTZ
```

`job_applications.resume_url`: 공고 지원 시 첨부된 PDF (별도, 프로필과 분리).

---

## 6. 주요 API

| Endpoint | 메서드 | 역할 |
|---|---|---|
| `/api/profile/upload` | POST FormData | S3 업로드 → resume_url 갱신 (10MB 제한) |
| `/api/profile/parse-resume` | GET | PDF → OpenAI gpt-4o-mini → 필드 JSON |
| `/api/profile/talent` | PUT | 프로필 필드 전체 저장 |
| `/api/profile/share-resume` | POST | 공개 동기화 (VTM 외부 풀 전송) |
| `/api/job-applications` | POST | 공고 지원 + PDF 첨부 (5MB 제한) |

---

## 7. 다음 작업 후보

- Hotspot #1 (이력서 재사용): `/jobs/[id]` Apply UI 에 "프로필 이력서 사용" 라디오 옵션 추가. 백엔드는 `user_profiles.resume_url` 을 다시 가져와 첨부.
- Hotspot #2 (VTM 동의): 공개 토글 옆 `dialog` 로 "외부 인재풀에 전송됩니다" 명시 + 확인.
- Hotspot #3 (60% 게이트): 부족 필드 리스트 동적 노출 (예: "경력 1건 / 학력 / 스킬 3개 이상 필요").

각 hotspot 은 단일 PR 로 가능. 진입점 통일(Hotspot #8) 은 별도 디자인 결정 필요.

---

## 8. 부록: Playwright 캡처 결과 + 와이어프레임 cross-check

스크린샷 디렉토리: `docs/resume-ux/` (2026-06-20 캡처, 익명 세션).

| 파일 | 뷰포트 | 페이지 | 상태 |
|---|---|---|---|
| `01-home-desktop.png` | 1280×900 | `/` | 익명 |
| `02-profile-redirect-anonymous.png` | 1280×900 | `/profile` → `/` 리다이렉트 | 익명 (login gate) |
| `03-jobs-list-desktop.png` | 1280×900 | `/jobs` | 24개 카드 |
| `04-job-detail-modal.png` | 1280×900 | `/jobs` 카드 클릭 → modal | 익명 |
| `05-jobs-id-anon-top.png` | 1280×900 | `/jobs/[id]` 상단 | 익명 |
| `06-jobs-id-anon-after-apply-click.png` | 1280×900 | `/jobs/[id]` Apply 클릭 후 | "CV (bắt buộc)" 드래그 + "Đăng nhập để ứng tuyển" |
| `06b-jobs-id-anon-fullpage.png` | 1280×900 | `/jobs/[id]` 전체 페이지 | full scroll |
| `07-home-mobile.png` | 390×844 | `/` 모바일 | 익명 |
| `08-jobs-id-mobile.png` | 390×844 | `/jobs/[id]` 모바일 전체 | 익명 |

### 8.1 와이어프레임 vs 실제 렌더 — 차이/검증

**🔴 신규 발견 (와이어프레임에 없던 것)**

1. **`/profile` 익명 시 `/` 로 리다이렉트** (캡처 02)
   - §1 진입점 표 (A1, A4) 에는 "→ /profile" 만 적혀있지만, **익명에서는 / 로 튕긴다**. 로그인 인터셉트 모달이 별도로 안 뜬다.
   - 영향: A1 너지 / A4 드롭다운 → 로그인 안 한 사용자는 멘탈모델 깨짐. **너지가 표시되려면 이미 로그인 상태여야 함** (`hasResume` 판정 자체가 인증 후).
   - **추가 hotspot 후보 #11**: 익명 진입에 대한 "로그인 후 이력서 등록" 인터셉트 UX 부재.

2. **`/jobs` (리스트의 모달) Apply 와 `/jobs/[id]` (페이지) Apply 의 UX 가 다름** (캡처 04 vs 06)
   - `/jobs` 모달 Apply (`pages/jobs.js:1695`): 익명 시 **곧바로 Google OAuth 리다이렉트** (확인 다이얼로그 없음). 캡처 시도 시 즉시 accounts.google.com 으로 이동했다.
   - `/jobs/[id]` 페이지 Apply (`pages/jobs/[id].js:385`): 익명 시 **인라인 업로드 영역 + "Đăng nhập để ứng tuyển →" 버튼이 먼저 노출** (캡처 06). 버튼 클릭 후 OAuth.
   - 영향: 같은 "Apply" 라벨이 진입 경로에 따라 다른 UX. **§4 hotspot #1 (이력서 재사용) 작업 시 두 surface 모두 손봐야** 함.
   - **추가 hotspot 후보 #12**: `/jobs` 모달의 Apply 무경고 OAuth 점프.

**✅ 와이어프레임과 일치 (캡처 06)**
- `/jobs/[id]` 의 인라인 업로드 영역: "Kéo thả CV hoặc chọn file / PDF / DOCX · tối đa 5MB" (= 와이어프레임 §3.2)
- 5MB 제한 카피 직접 노출 → **§4 hotspot #6 (10MB vs 5MB 불일치) 사용자 가시화 확정**.
- "Đăng nhập để ứng tuyển →" (Login to apply) 버튼 = §2 플로우 다이어그램의 분기.

**⚠ 캡처 못한 surface (인증 필요)**
- `/profile` 의 폼 본체 (B1–B6 카드). 익명 캡처 불가.
- 첫 방문 온보딩 3-step 모달 (A5). `profile_completed_at IS NULL` 한정.
- AI 파싱 진행률 UI (B1 의 setInterval 가짜 진행률).
- HR 공개 토글 + 60% 게이트 alert (B5).
- 다음 단계: 로컬에 테스트 계정으로 수동 로그인 후 재캡처. 또는 Playwright auth state 저장.

### 8.2 cross-check 결과 doc 반영

§1 A1·A4 진입점 표: "익명은 `/` 로 튕김" 주석 추가 권장.
§1 A3: `/jobs` 리스트 모달 Apply (≠ `/jobs/[id]`) 를 **별도 surface 로 분리** 권장.
§4 hotspot 표에 #11, #12 추가 (위 신규 발견).
