// Sentry 클라이언트(브라우저) 초기화. Next.js가 자동으로 로드함.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://913aa61f073d8909e9e538c52d387134@o4511738308788224.ingest.us.sentry.io/4511738316849152',
  tracesSampleRate: 0.1,
  // 연봉/이력서 PII 앱 — 세션리플레이 미사용, 기본 PII 전송 안 함
  sendDefaultPii: false,
});

// 클라이언트 라우트 전환 계측 (Sentry 권장 훅)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
