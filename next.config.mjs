/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: false,
  async redirects() {
    return [
      { source: '/ig', destination: '/?utm_source=instagram&utm_medium=social', permanent: false },
      { source: '/th', destination: '/?utm_source=threads&utm_medium=social', permanent: false },
      { source: '/fb', destination: '/?utm_source=facebook&utm_medium=social', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/strategy', destination: '/strategy.html' },
      { source: '/strategy-en', destination: '/strategy-en.html' },
    ];
  },
};

export default nextConfig;
