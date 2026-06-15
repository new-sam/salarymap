# FYI Daily Summary

GA4 세션 + Supabase 데이터를 모아 Slack으로 리포트를 쏘는 Supabase Edge Function (Deno/TS).
원래 별도 레포(`fyi-daily-summary`)에 있던 걸 salarymap으로 이전.

## 모드 (`?mode=`)

| mode | 설명 |
|------|------|
| `daily` (기본) | 전일 요약, 전전일 대비(DoD) |
| `weekly` | 주간 요약, 전주 대비(WoW) |
| `realtime` | 오늘 실시간 (Slack 슬래시 커맨드용) |
| `healthcheck` | salary-fyi.com 헬스체크 (다운 시에만 알림, `?test=true`로 강제 전송) |

기준 타임존: UTC+7 (베트남). 캠페인 시작일: `2026-04-20`.

## 필요한 환경변수 (Supabase secrets)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SLACK_WEBHOOK_URL          # 리포트를 보낼 Slack incoming webhook
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
