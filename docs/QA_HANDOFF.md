# 기업/ATS QA — 진행 상태 (이어서 작업용)

- 브랜치: `codex/company-landing-qa`
- 마지막 업데이트: 2026-06-02

## 다른 컴퓨터에서 받기

```bash
git fetch origin
git checkout codex/company-landing-qa
git pull
```

env: 루트 `.env.example` 참고해서 `.env.local` 채우기.
실제 값(Resend 키, Supabase 키 등)은 repo에 없음 — 안전한 채널로 가져올 것. (`.env.local`은 `.gitignore` 처리됨)

## 완료 (커밋됨)

### P0~P2 — `c3a9cc0`
- 반려(rejected) 상태 대시보드 라벨/배지 스타일 추가
- 반려 공고 수정 저장 시 `pending_review`로 재제출 + 어드민 재알림
- 승인 대기/반려 공고는 활성 토글 숨김 → 승인 우회 차단
- 모바일 반응형 (사이드바 상단바 전환, 칸반·폼·캘린더·후보상세 1열)
- `QA_CHECKLIST.csv` 로그인 섹션을 구글 OAuth+약관 기준으로 정정, 공고 승인·채용팀 항목 추가
- `edit.js` 다국어 전환

### P3 — `0e4121d`
- 면접 일정 / 평가 메모 컬럼 분리 (면접은 `interview_*` 전용 저장, `admin_note`는 메모 전용) + 후보 상세에 '예정된 면접' 표시
- 초대 저장 role을 실제 합류 role(`interviewer`)과 일치

### 리포트 (docs/)
- `FYI_COMPANY_QA.html` — P0~P3 수정 내역 (전부 ✓ 해결)
- `FYI_COMPANY_GAPS.html` — 짝꿍 기능 누락 24건 (영역 A~H, 심각도별)
- `QA_CHECKLIST.csv` — 수동 클릭 체크리스트 (O/X 칸 비어 있음 — 실기기/실로그인 확인용)

## 남은 작업 (GAPS 리포트 기준)

전체 상세: `docs/FYI_COMPANY_GAPS.html`

### 높음 5건 (먼저)
- **A-2** 회사 설정 단계 로그아웃/계정 전환 (잘못된 계정 진입 시 전환 불가)
- **A-3** 회원탈퇴 / 계정 삭제 (경로 전무)
- **B-3** 도메인 자동합류 승인 게이트 (같은 도메인이면 누구나 admin 자동합류 — 보안)
- **E-2** 면접 일정 → 후보 자동 안내 메일 (일정만 저장되고 후보는 모름)
- **G-2** 공고 오너 이전(transfer) (오너 퇴사 시 팀 관리 불능)

### 검증필요 3건 (착수 전 확정 권장)
- **C-3** 공고 삭제 시 `job_applications` 연쇄삭제 동작 (FK ON DELETE — 후보 데이터 유실 여부)
- **A-5** OAuth 실패/취소 시 콜백 처리
- **G-5** 제외된 면접관의 직접 URL 접근 차단 (RLS)

### 그 외
중간 10건 / 낮음 7건 — GAPS 리포트 참조.

## 비고
- 어드민 대시보드·`/auth/callback` 작업은 별도 커밋(`0ac9221`, `6239b1e`)으로 이미 브랜치에 포함됨.
- 칸반 단계 메커니즘/내용은 별도 검토 중이라 이 QA 범위에서 제외함.
