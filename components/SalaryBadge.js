import { getSalaryTierByKey } from '../lib/salaryTiers'

// Medal icon shared across variants.
function MedalIcon({ size, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

// Salary verification badge.
//   variant="pill"   compact inline pill for community posts/comments
//   variant="lg"     large round badge for the profile badge ladder
// Pass `t` from useT() for i18n; falls back to the Korean defaultLabel.
// `locked` (lg only) renders a grayscale, lock-overlaid placeholder.
export default function SalaryBadge({ tierKey, t, variant = 'pill', locked = false }) {
  const tier = getSalaryTierByKey(tierKey)
  if (!tier) return null
  const label = t ? t(`salary.tier.${tier.key}`) : tier.defaultLabel

  if (variant === 'pill') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        background: tier.grad, color: '#fff',
        fontSize: 10, fontWeight: 800, lineHeight: 1.4,
        padding: '1px 6px 1px 5px', borderRadius: 5, whiteSpace: 'nowrap',
        letterSpacing: '-0.2px', verticalAlign: 'middle',
      }}>
        <MedalIcon size={9} />
        {label}
      </span>
    )
  }

  // variant === 'lg'
  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      background: locked ? '#eef0f2' : tier.grad,
      boxShadow: locked ? 'none' : '0 2px 8px rgba(0,0,0,0.12)',
    }}>
      {locked ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b4bcc4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ) : (
        <MedalIcon size={24} />
      )}
    </div>
  )
}
