import Link from 'next/link';

// 회사 화면 공용 브랜드 — 메인 GlobalNav와 동일한 /logo.png (로고 자체가 FYI 형상)
const SIZES = { md: 30, sm: 24 };

export default function Brand({ href = '/for-companies', size = 'md', style }) {
  const h = SIZES[size] || SIZES.md;
  return (
    <Link
      href={href}
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', ...style }}
    >
      <img src="/logo.png" alt="FYI" style={{ width: h, height: h, objectFit: 'contain' }} />
    </Link>
  );
}
