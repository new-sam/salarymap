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
      { source: '/ig', destination: '/?utm_source=instagram&utm_medium=social', permanent: false },
      { source: '/th', destination: '/?utm_source=threads&utm_medium=social', permanent: false },
      { source: '/fb', destination: '/?utm_source=facebook&utm_medium=social', permanent: false },
    ];
  },
};

export default nextConfig;
