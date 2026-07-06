# FYI Daily Summary

GA4 세션 + Supabase 데이터를 모아 Slack으로 리포트를 쏘는 Supabase Edge Function (Deno/TS).
원래 별도 레포(`fyi-daily-summary`)에 있던 걸 salarymap으로 이전.

## 모드 (`?mode=`)

| mode | 설명 |
|------|------|
| `daily` (기본) | 전일 요약, 전전일 대비(DoD). `?channel=ceo` 붙이면 대표 전용 채널(`SLACK_CEO_WEBHOOK_URL`)로만 발송 |
| `weekly` | 주간 요약, 전주 대비(WoW) |
| `realtime` | 오늘 실시간 (Slack 슬래시 커맨드용) |
| `healthcheck` | salary-fyi.com 헬스체크 (다운 시에만 알림, `?test=true`로 강제 전송) |

기준 타임존: UTC+7 (베트남). 캠페인 시작일: `2026-04-20`.

## 필요한 환경변수 (Supabase secrets)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SLACK_WEBHOOK_URL          # 기본 팀 채널 webhook (daily/weekly/realtime/healthcheck)
SLACK_CEO_WEBHOOK_URL      # (선택) 대표 전용 채널 webhook. daily 를 ?channel=ceo 로 호출할 때만 사용
GA4_PROPERTY_ID            # 기본값 533725598
GA4_CLIENT_EMAIL           # GA4 서비스 계정 이메일
GA4_PRIVATE_KEY            # GA4 서비스 계정 private key (\n 이스케이프 허용)
```

## 배포

```bash
supabase functions deploy daily-summary
# 시크릿은 최초 1회 설정
supabase secrets set SLACK_WEBHOOK_URL=... GA4_CLIENT_EMAIL=... GA4_PRIVATE_KEY=...
```

스케줄(daily/weekly cron)은 Supabase 대시보드의 scheduled function/trigger에서 관리.

데일리는 채널별로 cron 을 분리한다:
- 팀 채널: `?mode=daily` — 기존 09:00(KST) cron.
- 대표 채널: `?mode=daily&channel=ceo` — 10:00(KST) = **01:00 UTC** 별도 cron.
lock key 가 채널별로 다르므로(`daily-<date>` vs `daily-<date>-ceo`) 두 cron 은 서로 간섭 없음.
