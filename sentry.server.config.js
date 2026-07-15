// Sentry 서버(Node.js 런타임) 초기화. instrumentation.js 의 register()에서 로드됨.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://913aa61f073d8909e9e538c52d387134@o4511738308788224.ingest.us.sentry.io/4511738316849152',
  // 트랜잭션 샘플링 — 에러는 100% 잡히고, 성능추적만 10%
  tracesSampleRate: 0.1,
  // 연봉/이력서 PII 앱 — IP·쿠키·요청본문 등 기본 PII 전송 안 함
  sendDefaultPii: false,
});
