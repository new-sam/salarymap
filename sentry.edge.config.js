// Sentry 엣지 런타임(미들웨어 등) 초기화. instrumentation.js 의 register()에서 로드됨.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://913aa61f073d8909e9e538c52d387134@o4511738308788224.ingest.us.sentry.io/4511738316849152',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
