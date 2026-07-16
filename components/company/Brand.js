import Link from 'next/link';

// 회사 화면 공용 브랜드 — 메인 GlobalNav와 동일한 신형 FYI 워드마크(/fyi-logo.png)
const SIZES = { md: 30, sm: 24 };

export default function Brand({ href = '/for-companies', size = 'md', style }) {
  const h = SIZES[size] || SIZES.md;
  return (
    <Link
      href={href}
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', ...style }}
    >
      <img src="/fyi-logo.png" alt="FYI" style={{ height: h, width: 'auto', objectFit: 'contain' }} />
    </Link>
  );
}
