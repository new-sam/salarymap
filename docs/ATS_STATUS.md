# FYI for Companies — ATS 현재 상태 (2026-05-14)

> 베트남 IT 기업이 self-serve로 채용을 진행하는 ATS. 회사 가입부터 공고 등록·지원자 관리·면접 일정까지 한 화면에서.

---

## 한 줄 요약

**기업이 1분 만에 가입 → 공고 직접 게재 → /jobs 피드 즉시 노출 → 지원자 들어오면 칸반에서 상태 관리 + 이력서 인라인 확인 + 평가 메모 + 단계 이동 + 면접 일정 기록까지 self-serve.**

---

## 랜딩에서 첫 채용까지의 진입 흐름

```
[salary-fyi.com 메인 (개인용)]
   └ 우측 상단 nav에 작은 "기업 채용 ↗" 링크
                  ↓ 클릭
[/for-companies] 기업 전용 별도 랜딩
   ├ 사자 캐릭터 + "베트남 IT 채용, 7.3일로 압축합니다"
   ├ 거대 카운트업 KPI: 7.3일 / 0원 / 14,252명
   ├ HOW IT WORKS 5단계 (스크린샷)
   ├ 경쟁사 O/X 비교 테이블 (VietnamWorks, ITviec, TopDev, LinkedIn vs FYI)
   └ CTA: "무료로 공고 올리기"
                  ↓ 클릭
[/company/signup] 기업 계정 가입 폼
   ├ 회사 이메일 (gmail 등 프리메일 거부)
   ├ 본인 이름
   ├ 회사명
   └ "이메일로 인증 링크 받기"
                  ↓
[발송 안내 화면] "메일이 안 보이면 스팸함 확인하세요"
                  ↓ 이메일 클릭 (매직링크)
[/auth/callback] 자동 로그인
   ├ recruiter_companies row 자동 생성 (또는 동일 도메인 회사에 연결)
   └ recruiter_users row 생성 (user_id ↔ company_id ↔ role:admin)
                  ↓ 자동 리디렉트
[/company] 빈 대시보드
   └ "+ 첫 공고 작성하기" 큰 CTA
                  ↓
[/company/jobs/new] 공고 작성 폼
   ├ 포지션·설명·역할·근무지·경력·연봉
   ├ 회사 로고 + 공고 대표 이미지 업로드 (Supabase Storage)
   ├ 우측 라이브 미리보기 (후보자가 볼 카드 모습)
   └ "공고 게재하기"
                  ↓ jobs 테이블 insert (status=live, is_active=true)
[/company] 대시보드에 등록한 공고 카드 표시
   └ 동시에 [/jobs] 후보자 피드에 즉시 노출
                  ↓ 후보자 지원 시
[좌측 사이드바] LIVE 공고 목록에 🟢 dot
[/company/ats?job=X] 칸반 — 신규 지원 컬럼에 카드 등장
                  ↓ 카드 클릭
[중앙 모달] 후보자 상세 (이력서 인라인 + 정보 + 평가 메모 + 단계 이동 + 면접 일정)
```

진입부터 첫 후보자 평가까지 **이론상 10분 안에 완료 가능**.

---

## 회사 입장 흐름 (스크린 단위)

| # | URL | 화면 | 동작 |
|---|---|---|---|
| 1 | `/for-companies` | 랜딩 (사자 + KPI 카운트업 + 5단계 설명 + 경쟁사 비교) | "공고 올리기" CTA → 가입 |
| 2 | `/company/signup` | 가입 폼 (회사 이메일 + 이름 + 회사명) | 매직링크 발송 |
| 3 | (이메일) | Supabase 인증 메일 | 링크 클릭 시 자동 로그인 |
| 4 | `/company` | 대시보드 | 공고 0개 → "첫 공고 작성하기" / 있으면 카드 리스트 |
| 5 | `/company/jobs/new` | 공고 작성 폼 | 포지션·연봉·스킬·이미지(로고+썸네일) → 게재 |
| 6 | `/jobs` (후보자 시점) | 게재된 공고 카드 즉시 노출 | 후보자가 지원 |
| 7 | `/company/ats?job=X` | 4컬럼 칸반 (신규지원/열람/검토/결정) | 카드 클릭 |
| 8 | (모달) | 후보자 상세 — 이력서 인라인 PDF + 정보 + 평가 메모 + 단계 이동 + 면접 일정 | 단계 이동·평가 기록 |
| 9 | `/company/jobs/[id]/edit` | 공고 수정 · 일시중지 · 삭제 | 운영 |

좌측 사이드바에는 본인 회사 공고 목록 (LIVE는 🟢 dot) — 바로 칸반 이동.

---

## 후보자 입장 (이미 있던 흐름 활용)

1. salary-fyi.com 가입 (기존 candidate side)
2. `/jobs` 피드 탐색 → 기업이 올린 공고 클릭 → "지원" 버튼
3. 자동으로 `job_applications` row 생성 → 기업 칸반 "신규 지원" 컬럼에 표시
4. 회사가 단계 이동·연락하면 status 업데이트
5. 후보자 본인 `/profile`에서 지원 결과 확인

---

## 데이터 구조 (Supabase)

이번 작업에서 새로 추가된 것 + 기존 활용:

### 새 테이블 (recruiter_*)
- **`recruiter_companies`** — 회사 명부 (id, name, email_domain, tax_id, verified_at, created_by)
- **`recruiter_users`** — 회사 담당자 (user_id ↔ company_id, role)

### 기존 `jobs` 확장
- `company_id` 추가 → recruiter_companies 연결
- `status` 추가 → `draft / pending_review / live / paused / closed`
- 기존 row는 자동으로 `live` 설정 (영향 0)

### 기존 `job_applications` 활용 (변경 없음)
- 칸반 4단계: `pending / viewed / reviewing / decided`
- `admin_note` 컬럼에 평가 메모 + 면접 일정 저장

### 편의 VIEW
- **`recruiter_jobs`** — jobs + recruiter_companies 조인된 조회 전용 view (관리 편의)

### 보안 (RLS)
- 회사 자기 데이터만 읽고 쓸 수 있게 모든 테이블 격리
- 후보자는 자기 지원만, 회사는 자기 공고/지원자만

---

## 작동하는 것 ✅

- 회사 매직링크 가입 → 회사·사용자 명부 자동 등록
- 가입 직후 빈 대시보드 진입
- 공고 작성·이미지 업로드 (Supabase Storage `job-images` 버킷)
- 게재 시 후보자 `/jobs` 피드에 즉시 노출
- 후보자 지원 → 칸반 자동 도착
- 카드 클릭 → 중앙 모달로 후보자 상세 (이력서 PDF 인라인 + 정보 사이드 + 평가 메모 + 단계 이동)
- 면접 일정 입력 → admin_note에 자동 기록
- 공고 수정·일시중지·삭제 (회사 본인 공고만)
- 좌측 사이드바에 본인 회사 LIVE 공고 직접 링크 (🟢 dot)

---

## 아직 없는 것 (다음 우선순위)

| 항목 | 추정 작업 시간 | 비고 |
|---|---|---|
| 인터뷰 요청 시 후보자에게 이메일 자동 발송 | 1~2일 | Resend 또는 Postmark 연결 |
| 드래그앤드롭 칸반 | 1일 | dnd-kit 같은 라이브러리 |
| 평가 점수 / 별점 / 스코어카드 | 1일 | job_applications에 컬럼 추가 |
| 분석 대시보드 (퍼널·KPI) | 2~3일 | 기존 admin 분석 패턴 재사용 |
| 팀 멤버 초대 / 권한 분리 | 2일 | recruiter_users.role 활용 |
| 첫 공고 운영 검수 큐 (어뷰징 방지) | 1일 | admin/jobs 페이지 활용 |
| D-30 검증 자동 인보이스 | 3일 | cron + Stripe/현지 PG |
| PDPL 동의 흐름 | 1일 | 인터뷰 요청 시점에 명시적 동의 |
| 후보자 본인 시점에서 인터뷰 일정 응답 | 2~3일 | 신규 페이지 |

**이메일 발송과 평가 점수가 가장 자주 요청될 듯** — 베타 운영 시작하면서 손으로 처리하다 자동화하는 게 정확함.

---

## 운영 정책 — Concierge MVP

**자동화 ❌ 되어 있는 부분은 운영진이 손으로** 보완:
- 회사 가입 → 새 row 보고 운영진이 메일/카톡으로 환영
- 첫 공고는 운영진이 `/admin/jobs`에서 검수 (어뷰징 방지)
- 후보자에게 인터뷰 알림 메일 → 운영진이 직접 발송
- D-30 검증 → 운영진 캘린더 알람 + 수동 인보이스

손으로 자주 반복되는 작업부터 자동화. 추측 아닌 실제 사용 데이터 기반 우선순위.

---

## 기술 스택

- **Frontend**: Next.js 16 (Pages router), React, Pretendard 폰트
- **Backend**: Supabase (Auth + Postgres + Storage + RLS)
- **Hosting**: Vercel (production은 main 브랜치만 자동 배포)
- **현재 브랜치**: `feat/company-flow` (origin에 푸시됨, main에 머지 전)

---

## 데모 (로컬)

```
http://localhost:3000/for-companies   ← 랜딩
http://localhost:3000/company         ← 기업 대시보드 (가입 필요)
http://localhost:3000/jobs            ← 후보자 피드 (가입한 회사 공고 표시)
```

---

## 다음 액션 제안

1. **머지 + production 배포** — 베타 운영 가능한 상태
2. **첫 5개 베타 기업 손으로 모집** (Concierge)
3. **이메일 발송 자동화** — 손이 가장 많이 가는 부분부터
4. **평가 점수 추가** — 회사들이 자주 요청할 가능성 큼

질문 있으면 슬랙으로 주세요.
