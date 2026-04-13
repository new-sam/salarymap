import { useState, useEffect } from 'react'

export default function CompanyDetailPanel({
  company, isOpen, onClose,
  userRole, userExperience, userSalary, userCompany, isSubmitted,
}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !company) { setDetail(null); return }
    setLoading(true)
    const params = new URLSearchParams({ company })
    if (userRole) params.set('role', userRole)
    if (userExperience) params.set('experience', userExperience)
    fetch(`/api/company-detail?${params}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isOpen, company])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const isOwnCompany = isSubmitted && userCompany && company &&
    company.toLowerCase() === userCompany.toLowerCase()

  const font = { fontFamily: "'Barlow', 'Inter', sans-serif" }

  const blurStyle = { filter: 'blur(8px)', userSelect: 'none', pointerEvents: 'none' }

  const comparePct = (isSubmitted && userSalary && detail?.summary?.median)
    ? Math.round(((userSalary - detail.summary.median) / detail.summary.median) * 100)
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 50, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity .3s',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)', background: '#fff', zIndex: 51,
        overflowY: 'auto', ...font,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(0.22, 0.9, 0.36, 1)',
      }}>
        {company && (
          <>
            {/* Header */}
            <div style={{
              background: '#1a1a18', padding: '28px 24px 24px', position: 'relative',
            }}>
              <div onClick={onClose} style={{
                position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 14,
              }}>✕</div>

              {isOwnCompany && (
                <div style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '8px 14px', marginBottom: 16,
                  fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                }}>This is your current company</div>
              )}

              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                {company}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                {loading ? 'Loading...' : detail ? `${detail.totalCount} salaries` : ''}
              </div>

              {isSubmitted && userRole && (
                <div style={{
                  marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,96,0,0.12)', border: '1px solid rgba(255,96,0,0.2)',
                  borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#ff6000',
                }}>
                  {userRole} · {userExperience}
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>

              {/* Summary boxes */}
              {detail?.summary ? (
                <div style={isSubmitted ? {} : blurStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    {[
                      { label: 'P25', value: detail.summary.p25 },
                      { label: 'Median', value: detail.summary.median, hl: true },
                      { label: 'P75', value: detail.summary.p75 },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: s.hl ? '#fff6f0' : '#f8f6f3', borderRadius: 10,
                        padding: '16px 12px', textAlign: 'center',
                        border: s.hl ? '1px solid #ffe0cc' : '1px solid transparent',
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.hl ? '#ff6000' : '#111' }}>
                          {isSubmitted ? `${s.value}M` : '??M'}
                        </div>
                        <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>{s.label} /mo</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginBottom: 20 }}>
                    Based on {detail.summary.count} similar submissions · VND /month
                  </div>
                </div>
              ) : !loading && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>
                  Not enough data for this role yet.
                </div>
              )}

              {/* Compare badge */}
              {isSubmitted && comparePct !== null && detail?.summary?.median > 0 && (
                <div style={{
                  background: comparePct >= 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${comparePct >= 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 13, color: '#555' }}>
                    {isOwnCompany ? 'vs market median' : 'vs your salary'}
                  </span>
                  <span style={{
                    fontSize: 15, fontWeight: 800,
                    color: comparePct >= 0 ? '#16a34a' : '#dc2626',
                  }}>
                    {comparePct >= 0 ? '+' : ''}{comparePct}%{comparePct >= 0 ? ' more' : ' less'}
                  </span>
                </div>
              )}

              {/* Gate — not submitted */}
              {!isSubmitted && (
                <div style={{
                  background: '#f8f6f3', borderRadius: 14, padding: '28px 20px',
                  textAlign: 'center', marginBottom: 24,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 6 }}>
                    Submit your salary to unlock
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                    Anonymous · 2 minutes · see how you compare
                  </div>
                  <button
                    onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }}
                    style={{
                      ...font, fontSize: 14, fontWeight: 800, background: '#ff6000', color: '#fff',
                      border: 'none', padding: '13px 28px', borderRadius: 10, cursor: 'pointer',
                    }}
                  >Submit my salary →</button>
                </div>
              )}

              {/* Feed */}
              {detail?.feed && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Individual salaries
                  </div>
                  <div style={isSubmitted ? {} : blurStyle}>
                    {(isSubmitted ? detail.feed : detail.feed.slice(0, 3)).map((item, i) => {
                      const isYou = isSubmitted && isOwnCompany &&
                        item.role === userRole &&
                        item.experience === userExperience &&
                        item.salary === userSalary
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '11px 14px', borderRadius: 8, marginBottom: 4,
                          background: isYou ? 'rgba(255,96,0,0.06)' : item.mostSimilar ? 'rgba(34,197,94,0.06)' : 'transparent',
                          border: isYou ? '1px solid rgba(255,96,0,0.15)' : item.mostSimilar ? '1px solid rgba(34,197,94,0.12)' : '1px solid #f0ede8',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                              {item.role}
                            </div>
                            <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>
                              {item.experience}
                            </div>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#111', flexShrink: 0 }}>
                            {isSubmitted ? `${item.salary}M` : '??M'}
                          </div>
                          {isYou && (
                            <span style={{
                              fontSize: 10, fontWeight: 800, color: '#ff6000',
                              background: 'rgba(255,96,0,0.1)', padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                            }}>← YOU</span>
                          )}
                          {!isYou && item.mostSimilar && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: '#16a34a',
                              background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                            }}>similar</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Rating */}
              {detail?.rating && isSubmitted && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 28, marginBottom: 12 }}>
                    Employee ratings
                  </div>
                  {[
                    { label: 'Work-life balance', value: detail.rating.worklife },
                    { label: 'Salary fairness', value: detail.rating.salary },
                    { label: 'Growth opportunity', value: detail.rating.growth },
                  ].map(r => (
                    <div key={r.label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: '1px solid #f0ede8',
                    }}>
                      <span style={{ fontSize: 13, color: '#555' }}>{r.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>{r.value}</span>
                        <span style={{ fontSize: 12, color: '#f59e0b' }}>{'★'.repeat(Math.round(r.value))}{'☆'.repeat(5 - Math.round(r.value))}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 6 }}>
                    Based on {detail.rating.count} reviews
                  </div>
                </>
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 13 }}>
                  Loading...
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile bottom sheet override */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .cdp-panel {
            top: auto !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-height: 90vh !important;
            border-radius: 20px 20px 0 0 !important;
            transform: translateY(100%) !important;
          }
          .cdp-panel.open {
            transform: translateY(0) !important;
          }
        }
      `}</style>
    </>
  )
}
