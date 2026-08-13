import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: false,
  devIndicators: false,
  // Google One Tap은 클라이언트에서 client_id가 필요 — 기존 서버용 env를 빌드타임에 노출 (client_id는 공개값)
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  },
  serverExternalPackages: ['googleapis', 'google-auth-library'],
  async redirects() {
    return [
      // /resume 비공개 — 아직 공개하면 안 되는 페이지가 main 에 올라가 라이브로 나갔다.
      // 코드는 그대로 두고 문만 닫는다(정리는 별도 PR). permanent:false 는 의도적이다 —
      // 308 로 내보내면 브라우저가 캐시해서 다시 열 때 사용자별로 안 풀린다.
      { source: '/resume', destination: '/', permanent: false },
      { source: '/ig', destination: '/?utm_source=instagram&utm_medium=social', permanent: false },
      { source: '/th', destination: '/?utm_source=threads&utm_medium=social', permanent: false },
      { source: '/fb', destination: '/?utm_source=facebook&utm_medium=social', permanent: false },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'likelion-ts',
  project: 'salarymap-web',
  silent: !process.env.CI,
  // 소스맵 업로드는 SENTRY_AUTH_TOKEN 있을 때만 동작(없으면 스킵). Phase 2에서 추가.
  widenClientFileUpload: true,
});
