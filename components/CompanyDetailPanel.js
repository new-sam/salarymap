import { useState, useEffect } from 'react'

const DEFAULT_VISIBLE = 5
const LOAD_MORE_COUNT = 20

export default function CompanyDetailPanel({
  company, isOpen, onClose,
  userRole, userExperience, userSalary, userCompany, isSubmitted,
  cardIndex = 0,
}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeRole, setActiveRole] = useState('All')
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [isMobile, setIsMobile] = useState(false)

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch data
  useEffect(() => {
    if (!isOpen || !company) return
    setDetail(null)
    setVisibleCount(DEFAULT_VISIBLE)
    setActiveRole(isSubmitted && userRole ? userRole : 'All')
    setLoading(true)
    fetch(`/api/company-detail?company=${encodeURIComponent(company)}`)
      .then(r => r.json())
      .then(d => {
        setDetail(d)
        // If default role has no data, fallback to 'All'
        if (isSubmitted && userRole && d?.feed) {
          const hasRoleData = d.feed.some(r => r.role === userRole)
          if (!hasRoleData) setActiveRole('All')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isOpen, company])

  // ESC close
  useEffect(() => {
    if (!isOpen) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Derived state ──
  const isLocked = !isSubmitted && cardIndex >= 3
  const isMyCompany = isSubmitted && userCompany && company &&
    userCompany.trim().toLowerCase() === company.trim().toLowerCase()

  // Roles for tabs
  const allRoles = detail?.feed
    ? ['All', ...Array.from(new Set(detail.feed.map(r => r.role)))]
    : ['All']

  // Filtered feed
  const filteredFeed = detail?.feed
    ? (activeRole === 'All' ? detail.feed : detail.feed.filter(r => r.role === activeRole))
    : []

  // Paginated
  const visibleFeed = filteredFeed.slice(0, visibleCount)
  const remaining = filteredFeed.length - visibleCount

  // Summary from filtered feed — use all entries for this role (no experience filter)
  // so min/max/median reflect the full visible range
  const summaryData = (() => {
    if (!detail?.feed) return null
    const base = activeRole === 'All' ? detail.feed : detail.feed.filter(r => r.role === activeRole)
    const salaries = base.map(r => r.salary).sort((a, b) => a - b)
    if (!salaries.length) return null
    return {
      p25: salaries[Math.floor(salaries.length * 0.25)],
      median: salaries[Math.floor(salaries.length * 0.5)],
      p75: salaries[Math.floor(salaries.length * 0.75)],
      count: salaries.length,
      min: salaries[0],
      max: salaries[salaries.length - 1],
    }
  })()

  // Compare
  const comparePct = summaryData?.median && userSalary
    ? Math.round(((summaryData.median - userSalary) / userSalary) * 100)
    : null

  // Distribution helpers
  const distPct = (val) => {
    if (!summaryData) return 0
    const range = summaryData.max - summaryData.min
    if (range === 0) return 50
    return Math.max(0, Math.min(100, Math.round(((val - summaryData.min) / range) * 100)))
  }

  // Format
  const fmt = (v) => Math.round(v) + 'M VND'
  const fmtShort = (v) => Math.round(v) + 'M'

  // Experience display — "5" → "5 yrs experience", "5–7 yrs" → as-is
  const fmtExp = (exp) => {
    if (!exp) return ''
    const s = String(exp).trim()
    if (/^\d+$/.test(s)) return `${s} yrs experience`
    if (s.toLowerCase().includes('yr') || s.toLowerCase().includes('under')) return s
    return `${s} yrs experience`
  }

  // Average rating
  const avgRating = detail?.rating
    ? Math.round(((detail.rating.worklife + detail.rating.salary + detail.rating.growth) / 3) * 10) / 10
    : null

  // ── Panel style ──
  const panelStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    maxHeight: '90vh', background: '#fff', zIndex: 300,
    borderRadius: '20px 20px 0 0', overflowY: 'auto',
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
    fontFamily: "'Inter', sans-serif",
  } : {
    position: 'fixed', top: 0, right: 0,
    width: 'clamp(580px, 65vw, 860px)', height: '100vh', background: '#fff', zIndex: 300,
    overflowY: 'auto',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '-4px 0 30px rgba(0,0,0,0.12)',
    fontFamily: "'Inter', sans-serif",
  }

  // ── isYou helper ──
  const checkIsYou = (row) => isSubmitted &&
    row.role === userRole &&
    String(row.experience) === String(userExperience) &&
    row.salary === userSalary

  // ── Render helpers ──

  const renderHeader = () => (
    <div style={{
      background: '#111', padding: '18px 20px 14px',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: '#ff6000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: '#fff',
        }}>{company.slice(0, 3).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
            {loading ? 'Loading...' : `${detail?.totalCount || 0} salaries shared`}
          </div>
        </div>
        <div onClick={onClose} style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,0.08)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'rgba(255,255,255,0.5)',
        }}>✕</div>
      </div>

      {/* Stats bar — only when data loaded and not locked */}
      {detail && !isLocked && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
          {[
            { label: 'Salaries', value: detail.totalCount },
            { label: 'Median', value: summaryData ? fmtShort(summaryData.median) : '–', accent: true },
            { label: 'Rating', value: avgRating ? `${avgRating}/5` : '–' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.accent ? '#ff6000' : '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderRoleTabs = () => (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', padding: '14px 0 10px',
      WebkitOverflowScrolling: 'touch',
    }}>
      {allRoles.map(role => {
        const active = role === activeRole
        return (
          <button key={role} onClick={() => { setActiveRole(role); setVisibleCount(DEFAULT_VISIBLE) }} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', flexShrink: 0,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: active ? '#111' : '#f0f0f0',
            color: active ? '#fff' : '#666',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}>{role}</button>
        )
      })}
    </div>
  )

  const renderSummaryBoxes = (blurred = false) => {
    // No data for selected role — show message instead of ??
    if (!summaryData && !blurred) {
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 4 }}>Salary breakdown</div>
          <div style={{
            background: '#f5f5f5', borderRadius: 12, padding: '20px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>
              No salary data for <strong style={{ color: '#555' }}>{activeRole}</strong> at this company yet.
            </div>
            <div style={{ fontSize: 11, color: '#bbb' }}>
              Try selecting "All" or a different role above.
            </div>
          </div>
        </div>
      )
    }

    const boxes = summaryData
      ? [
          { label: 'Lowest', value: fmtShort(summaryData.min) },
          { label: 'Median', value: fmtShort(summaryData.median), hl: true },
          { label: 'Highest', value: fmtShort(summaryData.max) },
        ]
      : [
          { label: 'Lowest', value: '–' },
          { label: 'Median', value: '–', hl: true },
          { label: 'Highest', value: '–' },
        ]
    return (
      <div style={blurred ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' } : {}}>
        {/* Section title */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 4 }}>
          Salary breakdown
        </div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5, marginBottom: 12 }}>
          {isSubmitted && userRole
            ? `How ${activeRole === 'All' ? 'all roles' : activeRole + ' engineers'} at ${company} are paid, filtered to your experience level (±1 year).`
            : `Salary range for ${activeRole === 'All' ? 'all roles' : activeRole + ' engineers'} at ${company}, based on anonymous submissions.`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
          {boxes.map(s => (
            <div key={s.label} style={{
              background: s.hl ? '#fff4f0' : '#f5f5f5',
              border: s.hl ? '1.5px solid #ffcab3' : '1.5px solid transparent',
              borderRadius: 12, padding: '16px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.hl ? '#ff6000' : '#1a1a1a', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.hl ? '#ff6000' : '#888', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {summaryData && (
          <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginBottom: 4 }}>
            Based on {summaryData.count} submissions · VND per month
          </div>
        )}
      </div>
    )
  }

  const renderDistribution = () => {
    if (!isSubmitted || !summaryData || summaryData.max === summaryData.min) return null
    const medPos = distPct(summaryData.median)
    const youPos = userSalary ? distPct(userSalary) : null
    return (
      <div style={{ margin: '14px 0 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 4 }}>
          Where you stand
        </div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5, marginBottom: 10 }}>
          The bar below shows the full salary range at this company. The orange dot is the median, and the dark dot is your salary.
        </div>
        {/* Track */}
        <div style={{ position: 'relative', height: 6, background: '#eee', borderRadius: 3 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, height: 6, borderRadius: 3,
            background: 'linear-gradient(90deg, #ffcab3, #ff6000)',
            width: '100%',
          }} />
          {/* Median marker */}
          <div style={{
            position: 'absolute', top: -4, width: 14, height: 14, borderRadius: '50%',
            background: '#ff6000', border: '2px solid #fff',
            left: `${medPos}%`, transform: 'translateX(-50%)',
          }} />
          {/* You marker */}
          {youPos !== null && (
            <div style={{
              position: 'absolute', top: -4, width: 14, height: 14, borderRadius: '50%',
              background: '#111', border: '2px solid #fff',
              left: `${youPos}%`, transform: 'translateX(-50%)',
            }} />
          )}
        </div>
        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#aaa' }}>
          <span>{fmtShort(summaryData.min)}</span>
          <span style={{ color: '#ff6000', fontWeight: 600 }}>● median {fmtShort(summaryData.median)}</span>
          {youPos !== null && <span style={{ color: '#111', fontWeight: 600 }}>● you {fmtShort(userSalary)}</span>}
          <span>{fmtShort(summaryData.max)}</span>
        </div>
      </div>
    )
  }

  const renderCompareBadge = () => {
    if (comparePct === null || !summaryData) return null
    if (isMyCompany) {
      return (
        <div style={{
          background: '#f5f5f5', border: '1px solid #e0e0e0',
          borderRadius: 12, padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
            You work here — this is your current company's pay range.
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>
            Your salary: {fmtShort(userSalary)} · Company median: {fmtShort(summaryData.median)}
          </div>
        </div>
      )
    }
    const more = comparePct >= 0
    return (
      <div style={{
        background: more ? '#f0fff4' : '#fff5f5',
        border: `1.5px solid ${more ? '#86efac' : '#fca5a5'}`,
        borderRadius: 12, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: more ? '#16a34a' : '#dc2626' }}>
            {more ? '+' : ''}{comparePct}% {more ? 'more here' : 'less here'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
          {more
            ? `Engineers here earn about ${Math.abs(comparePct)}% more than your current salary (${fmtShort(userSalary)}). Consider this company if you're looking to grow.`
            : `Engineers here earn about ${Math.abs(comparePct)}% less than your current salary (${fmtShort(userSalary)}). You're ahead of this company's pay range.`}
        </div>
      </div>
    )
  }

  const renderFeedRow = (row, i) => {
    const isYou = checkIsYou(row)
    const bg = isYou ? '#fff4f0' : row.mostSimilar ? '#f0fff4' : '#f7f7f7'
    const bd = isYou ? '1.5px solid #ff6000' : row.mostSimilar ? '1px solid #86efac' : 'none'
    return (
      <div key={i} style={{
        background: bg, border: bd, borderRadius: 10, padding: '10px 13px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{row.role}</span>
            {isYou && <span style={{ fontSize: 9, fontWeight: 700, color: '#ff6000', background: 'rgba(255,68,0,0.08)', padding: '1px 6px', borderRadius: 3 }}>YOU</span>}
            {!isYou && row.mostSimilar && isSubmitted && <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '1px 6px', borderRadius: 3 }}>similar</span>}
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{fmtExp(row.experience)}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: isYou ? '#ff6000' : '#1a1a1a' }}>{fmt(row.salary)}</div>
          <div style={{ fontSize: 9, color: '#bbb', marginTop: 1 }}>per month</div>
        </div>
      </div>
    )
  }

  const renderFeed = (blurred = false) => {
    const rows = blurred
      ? [{ role: 'Backend', experience: '3–4 yrs', salary: 38, mostSimilar: false },
         { role: 'Frontend', experience: '1–2 yrs', salary: 32, mostSimilar: false },
         { role: 'Mobile', experience: '5–7 yrs', salary: 55, mostSimilar: false }]
      : visibleFeed
    return (
      <div style={blurred ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' } : {}}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 4 }}>
          Individual salary entries
        </div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5, marginBottom: 10 }}>
          {isSubmitted
            ? 'Real salary entries from engineers at this company. Green rows are from people with a similar role and experience to yours.'
            : 'Real salary entries submitted anonymously by engineers at this company.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row, i) => renderFeedRow(row, i))}
        </div>
        {!blurred && remaining > 0 && (
          <button onClick={() => setVisibleCount(v => v + LOAD_MORE_COUNT)} style={{
            width: '100%', padding: 10, marginTop: 8,
            background: '#f7f7f7', border: 'none', borderRadius: 10,
            fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit',
          }}>Load {Math.min(remaining, LOAD_MORE_COUNT)} more ({remaining} remaining)</button>
        )}
      </div>
    )
  }

  const renderRating = (blurred = false) => {
    const hasData = !!detail?.rating
    const items = [
      { key: 'worklife', label: 'Work-life balance', desc: 'Flexibility, hours, remote options', icon: '⚖️', value: hasData ? detail.rating.worklife : 0 },
      { key: 'salary',   label: 'Salary satisfaction', desc: 'Pay fairness vs market & workload', icon: '💰', value: hasData ? detail.rating.salary : 0 },
      { key: 'growth',   label: 'Growth opportunity', desc: 'Promotion path, learning, mentorship', icon: '📈', value: hasData ? detail.rating.growth : 0 },
    ]
    const overallAvg = hasData
      ? Math.round(((detail.rating.worklife + detail.rating.salary + detail.rating.growth) / 3) * 10) / 10
      : null

    const ratingLabel = (v) => {
      if (v >= 4.5) return 'Excellent'
      if (v >= 3.5) return 'Good'
      if (v >= 2.5) return 'Average'
      if (v >= 1.5) return 'Below avg'
      return 'Poor'
    }

    return (
      <div style={{
        marginTop: 18, marginBottom: 18,
        ...(blurred ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' } : {}),
      }}>
        {/* Section header */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 4 }}>
          Employee satisfaction
        </div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5, marginBottom: 14 }}>
          {hasData
            ? `Rated by ${detail.rating.count} engineer${detail.rating.count > 1 ? 's' : ''} who submitted their salary. Each category is scored 1–5.`
            : `No one has rated this company yet. After submitting your salary, you can be the first to leave a rating.`}
        </div>

        <div style={{ background: '#f7f7f7', borderRadius: 14, padding: '16px 18px' }}>

          {/* Overall score — only when data exists */}
          {hasData && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
              paddingBottom: 14, borderBottom: '1px solid #ebebeb',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: overallAvg >= 3.5 ? '#f0fff4' : overallAvg >= 2.5 ? '#fffbeb' : '#fff5f5',
                border: `1.5px solid ${overallAvg >= 3.5 ? '#86efac' : overallAvg >= 2.5 ? '#fcd34d' : '#fca5a5'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800,
                color: overallAvg >= 3.5 ? '#16a34a' : overallAvg >= 2.5 ? '#b45309' : '#dc2626',
              }}>{overallAvg}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                  {ratingLabel(overallAvg)}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>
                  Overall score from {detail.rating.count} review{detail.rating.count > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )}

          {/* Individual rows */}
          {items.map(({ key, label, desc, icon, value }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              {/* Label row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{desc}</div>
                </div>
                {hasData && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', flexShrink: 0 }}>
                    {value.toFixed(1)}<span style={{ fontSize: 10, fontWeight: 400, color: '#aaa' }}>/5</span>
                  </div>
                )}
              </div>
              {/* Bar + scale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 9, color: '#ccc', flexShrink: 0, width: 8, textAlign: 'center' }}>0</div>
                <div style={{
                  flex: 1, height: 8, background: '#e4e4e4', borderRadius: 20, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: hasData ? `${(value / 5) * 100}%` : '0%',
                    background: hasData
                      ? (value >= 3.5 ? '#22c55e' : value >= 2.5 ? '#f59e0b' : '#ef4444')
                      : '#e4e4e4',
                    borderRadius: 20,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: 9, color: '#ccc', flexShrink: 0, width: 8, textAlign: 'center' }}>5</div>
              </div>
            </div>
          ))}

          {/* No data state — overlay text */}
          {!hasData && (
            <div style={{
              textAlign: 'center', padding: '4px 0 2px',
              fontSize: 11, fontWeight: 600, color: '#bbb',
            }}>
              NO RATINGS YET
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderGate = () => (
    <div style={{
      background: '#f5f5f5', borderRadius: 16,
      padding: '28px 22px', textAlign: 'center', marginBottom: 20,
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>
        Want to see what {company} pays?
      </div>
      <div style={{ fontSize: 13, color: '#888', lineHeight: 1.7, marginBottom: 20 }}>
        We keep salary data fair — share yours to unlock everyone else's.<br />
        It takes 2 minutes and your identity is never shared.
      </div>
      <button onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }} style={{
        width: '100%', padding: '14px 0',
        background: '#ff6000', border: 'none', borderRadius: 12,
        fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
      }}>Submit my salary → unlock</button>
      <div style={{ fontSize: 10, color: '#bbb', marginTop: 10 }}>
        100% anonymous · No login required
      </div>
    </div>
  )

  const renderBottomCTA = () => (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(transparent, #fff 30%)',
      padding: '20px 0 8px', textAlign: 'center',
    }}>
      <button onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }} style={{
        padding: '10px 24px',
        background: '#111', border: 'none', borderRadius: 10,
        fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
      }}>Submit yours to see where you rank →</button>
    </div>
  )

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <>
      {/* Backdrop */}
      {isOpen && <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299,
      }} />}

      {/* Panel */}
      <div style={panelStyle}>
        {company && (
          <>
            {/* Mobile handle */}
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd' }} />
              </div>
            )}

            {renderHeader()}

            <div style={{ padding: '0 20px 40px' }}>

              {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: '#ccc' }}>Loading...</div>
              )}

              {/* ── STATE A: Locked ── */}
              {!loading && detail && isLocked && (
                <>
                  {renderSummaryBoxes(true)}
                  {renderGate()}
                  {renderRating(true)}
                  {renderFeed(true)}
                </>
              )}

              {/* ── STATE B: Open, not submitted ── */}
              {!loading && detail && !isSubmitted && !isLocked && (
                <>
                  {renderRoleTabs()}
                  {renderSummaryBoxes(false)}
                  {renderRating(false)}
                  {renderFeed(false)}
                  {renderBottomCTA()}
                </>
              )}

              {/* ── STATE C: Submitted, other company ── */}
              {!loading && detail && isSubmitted && !isMyCompany && (
                <>
                  {renderRoleTabs()}
                  {renderSummaryBoxes(false)}
                  {renderCompareBadge()}
                  {renderDistribution()}
                  {renderRating(false)}
                  {renderFeed(false)}
                </>
              )}

              {/* ── STATE D: Submitted, my company ── */}
              {!loading && detail && isSubmitted && isMyCompany && (
                <>
                  <div style={{
                    background: '#111', borderRadius: 10, padding: '10px 14px',
                    textAlign: 'center', marginTop: 14, marginBottom: 14,
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>This is your current company</div>
                  {renderRoleTabs()}
                  {renderSummaryBoxes(false)}
                  {renderCompareBadge()}
                  {renderDistribution()}
                  {renderRating(false)}
                  {renderFeed(false)}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
