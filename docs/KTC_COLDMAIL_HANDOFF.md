# KTC 콜드메일 캠페인 — 인수인계 (2026-07-28)

> KTC 지원자 2,032명을 FYI 회원으로 유입시키는 콜드메일 캠페인.
> 작성자가 푸시 권한이 없어 **로컬 작업분을 그대로 옮겨 적용**해야 한다.
> 대시보드 코드 2곳 + 신규 파일 3개 + 메일 템플릿 2개.

---

## 0. 한 줄 요약

**어드민 goals 탭의 캠페인별 표에 `coldmail-ktc` 행이 뜨게 하는 게 목표.** 그러려면
발송 로그(`coldmail_public_sent`)와 클릭(`coldmail_public_click`)이 쌓여야 하고,
집계 로직이 `user_id` 없는 수신자를 셀 수 있어야 한다.

---

## 1. 왜 기존 코드로는 안 되는가

기존 콜드메일 캠페인(`coldmail1`·`jobs1`·`recommend1`)의 수신자는 **FYI 회원**이라
모든 이벤트에 `user_id`가 있다. 집계도 `user_id` 기준 Set 이다.

이번 수신자는 **KTC 지원자 = FYI 계정 없음**이다. 그래서 두 가지를 바꿨다.

1. 링크 토큰을 `user_id` 대신 **이메일 해시**로 서명 (신규 `lib/ktcMailToken.js`)
2. 집계에서 `user_id ?? meta.lead` 로 사람을 식별 (기존 파일 1줄 수정)

---

## 2. 적용할 변경 — 기존 파일 2곳

### 2-1. `pages/api/admin/campaign-resume-public-metrics.js`

```diff
-      const uid = e.user_id
+      // FYI 계정이 없는 수신자(KTC 지원자 콜드메일)는 user_id 가 없다 — 이메일 해시(meta.lead)로
+      // 사람을 구분한다. 두 값은 서로 겹치지 않아 같은 Set 에 넣어도 안전하다.
+      const uid = e.user_id || e.meta?.lead || null
       const c = camp(e.meta?.campaign || 'coldmail1')
```

주석도 같이 (선택):

```diff
-    // 캠페인별 분리 집계 — coldmail1(축하금)·jobs1(공고 원탭지원) 등을 따로 본다.
+    // 캠페인별 분리 집계 — coldmail1(축하금)·jobs1(공고 원탭지원)·coldmail-ktc(KTC 지원자→FYI 유입) 등을
+    // 따로 본다. 버킷은 meta.campaign 값으로 자동 생성되므로 새 캠페인은 이벤트만 쌓이면 표에 나온다.
```

> **이 한 줄이 핵심.** 없으면 `coldmail-ktc` 행이 전부 0으로 나온다.
> 캠페인 버킷 자체는 `meta.campaign` 값으로 자동 생성되므로 추가 코드가 필요 없다.

### 2-2. `components/admin/GoalMetricsView.js` (범례 문구, 표시용)

```diff
-{ko ? '캠페인별 (coldmail1=축하금 · jobs1=공고 원탭지원 · recommend1=담당자 추천)' : 'By campaign'}
+{ko ? '캠페인별 (coldmail1=축하금 · jobs1=공고 원탭지원 · recommend1=담당자 추천 · coldmail-ktc=KTC 지원자→FYI 유입)' : 'By campaign'}
```

---

## 3. 신규 파일 3개 (그대로 추가)

| 파일 | 줄수 | 역할 |
|---|---|---|
| `lib/ktcMailToken.js` | 38 | 이메일 HMAC 서명 토큰 · `leadId(email)` |
| `pages/api/ktc/r.js` | 41 | CTA 클릭 리다이렉트 + `coldmail_public_click` 기록 |
| `scripts/send-ktc-coldmail.mjs` | 203 | 대상 추출 · 머지 · Resend 발송 · `coldmail_public_sent` 기록 |

### 설계 메모

- **토큰을 왜 새로 만들었나** — 기존 `lib/campaignToken.js`는 payload 를 **첫 `.`으로**
  쪼갠다. 이메일에는 점이 들어가서 파싱이 깨진다. 그래서 별도 모듈에서 `|` 로 나눈다.
- **이메일 원문을 링크에 싣지 않는다** — HMAC 해시 앞 16자만 `lead` 로 쓴다.
  발송·클릭 양쪽에 같은 값을 남겨 대조한다.
- **오픈 리다이렉트 차단** — `to` 파라미터는 내부 경로(`/`로 시작, `//` 아님)만 허용.
- **토큰이 없거나 위조돼도 리다이렉트는 해준다** — 측정만 실패하고 링크는 살아야 한다.

### 이벤트 스키마

```
events.event  : 'coldmail_public_sent' | 'coldmail_public_click'
events.meta   : { campaign: 'coldmail-ktc', lead: <이메일 해시 16자>,
                  lang: 'vi'|'ko', mode: 'utm'|'redirect', resend_id, to, cta }
```

---

## 4. 메일 템플릿 2개 (레포 루트)

| 파일 | 언어 | 제목 |
|---|---|---|
| `coldmain.html` | 한국어 | `KTC - {{position}} 포지션에 지원해 주셨죠` |
| `coldmain-vi.html` | **베트남어** | `KTC - {{position}} — bạn đã ứng tuyển vị trí này` |

**실제 발송은 베트남어판이다.** 한국어판은 내부 확인용.

- 플레이스홀더: `{{name}}`(호칭 tên) · `{{position}}`(최신 지원포지션) · `{{ctaUrl}}` · `{{unsubscribeUrl}}`
- 베트남어판은 폰트 스택에서 **Pretendard 를 뺐다** — 성조 부호 배치가 어색하다
  (`globals.css` 의 `:lang(vi)` 정책과 동일). 메일 클라이언트는 웹폰트를 대부분 막으므로 시스템 폰트만 쓴다.
- 지표 카드 2개: `3.7번 / 1인당 월평균 받은 오퍼`, `983 / 누적 공고·기업`

> ⚠️ **`983`은 실데이터와 다르다.** 실제는 공고 513 + 거쳐간 기업 250 = **763**.
> 집계 기준을 정해서 맞추거나 수치를 바꿔야 한다.
> `3.7번`도 출처 미확인 — DB 기준 1인당 누적 지원은 1.3건(2,176÷1,649)이다.

---

## 5. 발송 대상

`data/ktc-leads-not-in-fyi.csv` — **2,032명** (git 제외 경로, PII)

```
KTC 지원자 2,789건 → 이메일 중복 제거 2,178명
  − FYI 기가입 141명
  − 테스트·내부 계정 4명
  + 도메인 오타 교정 후 복구 10명
= 2,032명 (고유 이메일 2,032, MX 전부 정상)
```

컬럼: `이메일 · 이름 · 호칭(tên) · 최신 지원포지션 · 최초 유입경로 · 발송배치(1~6)` 등

---

## 6. 실행 방법

```bash
# 확인만 (발송 안 함 — 기본값)
node scripts/send-ktc-coldmail.mjs --dry-run --lang=vi --limit=200

# 배포 전: UTM 링크로 발송
node scripts/send-ktc-coldmail.mjs --lang=vi --limit=200 --utm --send

# 배포 후: 추적 리다이렉트로 발송
node scripts/send-ktc-coldmail.mjs --lang=vi --limit=200 --send
```

옵션: `--lang=ko|vi` · `--limit=N` · `--seed=N`(기본 20260728) · `--utm` · `--send` · `--dry-run`

안전장치

- `--send` 없으면 **절대 발송하지 않는다**
- **시드 고정 랜덤** — 같은 시드면 같은 200명 (중단 후 재개·사후 감사)
- **중복 발송 차단** — `data/ktc-coldmail-sent-*.csv` 를 읽어 이미 보낸 사람을 풀에서 뺀다.
  다음 200명은 같은 명령을 다시 돌리면 된다
- 발송 후 `data/ktc-coldmail-sent-<타임스탬프>.csv` 에 명단 기록 (Resend id 포함)

---

## 7. 배포 전에 보낼 때 — `--utm` 모드

**`/api/ktc/r` 은 프로덕션에 없다(현재 404).** 배포 전에 기본 모드로 보내면
수신자가 CTA를 눌렀을 때 전부 404를 본다.

`--utm` 을 붙이면 CTA가 프로덕션 `/jobs` 로 직접 간다(200 확인).

```
https://salary-fyi.com/jobs?utm_source=coldmail&utm_medium=email
  &utm_campaign=coldmail-ktc&utm_content=<lead>
```

이미 배포된 `_app.js` 의 `session_start` 가 `utm_source/medium/campaign` 을
`events` 에 기록하므로 **클릭 수는 잡힌다.** 다만

- goals 탭 캠페인 표에는 안 나온다 (`coldmail_public_click` 이벤트가 아니라서)
- `utm_content`(사람 단위)는 `session_start` 가 읽지 않아 **캠페인 단위 집계만** 가능

배포 후에는 `--utm` 을 빼고 보내면 된다.

---

## 8. 검증 결과 (로컬 E2E)

발송 3건 기록 → 1명 클릭 → 대시보드와 동일 로직으로 집계:

```
coldmail-ktc   발송 3 · 클릭 2 (CTR 66.7%) · 전환 0 (0.0%)
```

`user_id` 없는 수신자도 `meta.lead` 로 사람 단위 구분이 되는 것을 확인했다.
(테스트 이벤트는 정리 완료)

---

## 9. 아직 없는 것

| 항목 | 상태 | 영향 |
|---|---|---|
| **전환(가입) 추적** | 없음 | 표의 `전환` 열이 항상 0. 아래 참고 |
| **수신거부 페이지** | 없음 | 현재 `mailto:hello@salary-fyi.com?subject=Unsubscribe: <이메일>` 로 대체. 대량 발송 시 PDPD 이슈 |
| **발신 도메인 워밍업** | 미확인 | `hello@salary-fyi.com` 으로 대량 발송 이력 없음. 스팸 분류 위험 |
| **983 / 3.7 수치 근거** | 미확인 | §4 참고 |

### 전환 추적을 붙이려면

기존 `coldmail_public_convert` 는 `/api/resume/go-public`(이력서 공개 전환)이 찍는
**회원 전용** 이벤트라 KTC 리드는 탈 수 없다. 둘 중 하나가 필요하다.

- **쿠키 이어붙이기** — `/api/ktc/r` 에서 `lead` 를 쿠키에 심고, 가입 완료 시 읽어
  `coldmail_public_convert` 기록. 정확하지만 같은 브라우저 한정
- **이메일 대조** — 나중에 `user_profiles.email` 을 발송 명단과 맞춰 배치 집계.
  시점 추적은 안 되지만 코드가 거의 필요 없다

---

## 10. 체크리스트

- [ ] `campaign-resume-public-metrics.js` 1줄 수정 (§2-1) ← **필수**
- [ ] `GoalMetricsView.js` 범례 수정 (§2-2)
- [ ] 신규 파일 3개 추가 (§3)
- [ ] `coldmain.html` · `coldmain-vi.html` 추가 (§4)
- [ ] `983` / `3.7` 수치 확정
- [ ] 수신거부 링크 결정
- [ ] 배포 → `--utm` 없이 발송, 또는 배포 전이면 `--utm` 으로 발송
- [ ] 첫 200명 발송 후 **바운스율 확인** (5% 넘으면 중단)
