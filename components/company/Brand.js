import Link from 'next/link';

// 회사 화면 공용 브랜드 — 메인 GlobalNav와 동일한 입체 로고 (/fyi-logo-nav.png, 가로형)
const SIZES = { md: 26, sm: 22 };

export default function Brand({ href = '/for-companies', size = 'md', style }) {
  const h = SIZES[size] || SIZES.md;
  return (
    <Link
      href={href}
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', ...style }}
    >
      <img src="/fyi-logo-nav.png" alt="FYI" style={{ height: h, width: 'auto', objectFit: 'contain' }} />
    </Link>
  );
}
