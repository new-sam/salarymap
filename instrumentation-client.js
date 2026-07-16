// Sentry 클라이언트(브라우저) 초기화. Next.js가 자동으로 로드함.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://913aa61f073d8909e9e538c52d387134@o4511738308788224.ingest.us.sentry.io/4511738316849152',
  tracesSampleRate: 0.1,
  // 연봉/이력서 PII 앱 — 세션리플레이 미사용, 기본 PII 전송 안 함
  sendDefaultPii: false,
  // 실제 버그가 아닌 브라우저/환경 잡음은 리포트 제외 (슬랙 알림 폭탄 방지)
  ignoreErrors: [
    // 미디어 자동재생/취소 — 브라우저 정상 동작
    'The play() request was interrupted',
    'The operation was aborted',
    'The operation is not supported',
    'AbortError',
    'NotSupportedError',
    // iOS 앱 웹뷰 브릿지가 일반 브라우저에서 호출됨 (웹에선 항상 없음)
    'webkit.messageHandlers',
    'messageHandlers',
  ],
});

// 클라이언트 라우트 전환 계측 (Sentry 권장 훅)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
