import { useState, useEffect, useRef } from 'react'

export default function CompanyDetailPanel({
  company, isOpen, onClose,
  userRole, userExperience, userSalary, userCompany, isSubmitted,
}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    company.trim().toLowerCase() === userCompany.trim().toLowerCase()

  const F = { fontFamily: "'Barlow', 'Inter', sans-serif" }
  const blur = { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }

  const sal = (v) => `${v}M VND`

  const comparePct = (isSubmitted && userSalary && detail?.summary?.median)
    ? Math.round(((userSalary - detail.summary.median) / detail.summary.median) * 100)
    : null

  // --- panel positioning ---
  const panelStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    maxHeight: '90vh', background: '#fff', zIndex: 50,
    borderRadius: '20px 20px 0 0', overflowY: 'auto', ...F,
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '0 -4px 40px rgba(0,0,0,0.25)',
  } : {
    position: 'fixed', top: 0, right: 0, height: '100vh',
    width: 420, background: '#fff', zIndex: 50,
    overflowY: 'auto', ...F,
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '-4px 0 40px rgba(0,0,0,0.15)',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 49, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity .3s',
        }}
      />

      {/* Panel */}
      <div ref={panelRef} style={panelStyle}>
        {company && (
          <>
            {/* Header — sticky */}
            <div style={{
              background: '#1a1a18', padding: '24px 20px 20px',
              position: 'sticky', top: 0, zIndex: 2,
            }}>
              {/* Close */}
              <div onClick={onClose} style={{
                position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 13, lineHeight: 1,
              }}>✕</div>

              {/* Mobile drag indicator */}
              {isMobile && (
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 16px' }} />
              )}

              {/* Own company banner */}
              {isOwnCompany && (
                <div style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '7px 12px', marginBottom: 14,
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '.02em',
                }}>This is your current company</div>
              )}

              {/* Company name */}
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', paddingRight: 36 }}>
                {company}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                {loading ? 'Loading...' : detail ? `${detail.totalCount} salaries` : ''}
              </div>

              {/* Context bar */}
              {isSubmitted && userRole && (
                <div style={{
                  marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,96,0,0.1)', border: '1px solid rgba(255,96,0,0.18)',
                  borderRadius: 5, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#ff6000',
                }}>
                  {userRole} · {userExperience}
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '20px' }}>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb', fontSize: 13 }}>
                  Loading...
                </div>
              )}

              {/* Summary boxes */}
              {!loading && detail?.summary && (
                <div style={isSubmitted ? {} : blur}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                    {[
                      { label: 'P25', value: detail.summary.p25 },
                      { label: 'Median', value: detail.summary.median, hl: true },
                      { label: 'P75', value: detail.summary.p75 },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: s.hl ? '#fff6f0' : '#f8f6f3', borderRadius: 10,
                        padding: '14px 10px', textAlign: 'center',
                        border: s.hl ? '1.5px solid #ffe0cc' : '1.5px solid transparent',
                      }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.hl ? '#ff4400' : '#111', letterSpacing: '-0.02em' }}>
                          {isSubmitted ? sal(s.value) : '??M'}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#aaa', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          {s.label} /mo
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: '#ccc', textAlign: 'center', marginBottom: 16 }}>
                    Based on {detail.summary.count} similar submissions
                  </div>
                </div>
              )}

              {!loading && !detail?.summary && detail && (
                <div style={{ textAlign: 'center', padding: '16px 0 20px', color: '#bbb', fontSize: 12 }}>
                  Not enough data for this role yet.
                </div>
              )}

              {/* Compare badge */}
              {isSubmitted && comparePct !== null && detail?.summary?.median > 0 && (
                <div style={{
                  background: comparePct >= 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${comparePct >= 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {isOwnCompany ? 'vs market median' : 'vs your salary'}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: comparePct >= 0 ? '#16a34a' : '#dc2626',
                  }}>
                    {comparePct >= 0 ? '+' : ''}{comparePct}%{comparePct >= 0 ? ' more' : ' less'}
                  </span>
                </div>
              )}

              {/* Gate — not submitted */}
              {!isSubmitted && !loading && (
                <div style={{
                  background: '#f8f6f3', borderRadius: 12, padding: '24px 16px',
                  textAlign: 'center', marginBottom: 20, border: '1px solid #efe9e0',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4 }}>
                    Submit your salary to unlock
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 14 }}>
                    Anonymous · 2 minutes · see how you compare
                  </div>
                  <button
                    onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }}
                    style={{
                      ...F, fontSize: 13, fontWeight: 800, background: '#ff6000', color: '#fff',
                      border: 'none', padding: '11px 24px', borderRadius: 8, cursor: 'pointer',
                    }}
                  >Submit my salary →</button>
                </div>
              )}

              {/* Feed */}
              {!loading && detail?.feed && detail.feed.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '.06em',
                    textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
                  }}>
                    Individual salaries
                  </div>
                  <div style={isSubmitted ? {} : blur}>
                    {(isSubmitted ? detail.feed : detail.feed.slice(0, 3)).map((item, i) => {
                      const isYou = isSubmitted && isOwnCompany &&
                        item.role === userRole &&
                        item.experience === userExperience &&
                        item.salary === userSalary

                      const rowBg = isYou
                        ? '#fff4f0'
                        : item.mostSimilar ? '#f0fff4' : '#fff'
                      const rowBorder = isYou
                        ? '#ff4400'
                        : item.mostSimilar ? '#86efac' : '#f0ede8'

                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                          background: rowBg, border: `1px solid ${rowBorder}`,
                        }}>
                          {/* Role + exp */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                              {item.role}
                            </div>
                            <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>
                              {item.experience} yrs
                            </div>
                          </div>

                          {/* Salary */}
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#111', flexShrink: 0 }}>
                            {isSubmitted ? sal(item.salary) : '??M'}
                          </div>

                          {/* Badge */}
                          {isYou && (
                            <span style={{
                              fontSize: 9, fontWeight: 800, color: '#ff4400',
                              background: 'rgba(255,68,0,0.08)', padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                            }}>← YOU</span>
                          )}
                          {!isYou && item.mostSimilar && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: '#16a34a',
                              background: 'rgba(34,197,94,0.08)', padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                            }}>similar</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Rating */}
              {detail?.rating && (
                <div style={isSubmitted ? { marginTop: 24 } : { ...blur, marginTop: 24 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '.06em',
                    textTransform: 'uppercase', marginBottom: 10,
                  }}>
                    Employee ratings
                  </div>
                  {[
                    { label: 'Work-life balance', value: detail.rating.worklife },
                    { label: 'Salary fairness', value: detail.rating.salary },
                    { label: 'Growth opportunity', value: detail.rating.growth },
                  ].map(r => (
                    <div key={r.label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 0', borderBottom: '1px solid #f0ede8',
                    }}>
                      <span style={{ fontSize: 12, color: '#555' }}>{r.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 11, color: '#f59e0b' }}>
                          {'★'.repeat(Math.round(r.value))}{'☆'.repeat(5 - Math.round(r.value))}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111', minWidth: 22, textAlign: 'right' }}>
                          {r.value}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: '#ccc', marginTop: 5 }}>
                    Based on {detail.rating.count} reviews
                  </div>
                </div>
              )}

              {/* Bottom spacer for mobile */}
              <div style={{ height: 40 }} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
