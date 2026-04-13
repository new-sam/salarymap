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

  const isMyCompany = isSubmitted && userCompany && company &&
    company.trim().toLowerCase() === userCompany.trim().toLowerCase()

  const med = detail?.summary?.median
  const comparePct = (isSubmitted && userSalary && med)
    ? Math.round(((med - userSalary) / userSalary) * 100)
    : null

  const fmt = (v) => Math.round(v) + 'M'

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 999,
        }} />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '50vw',
        maxWidth: '600px',
        minWidth: '360px',
        height: '100vh',
        background: '#ffffff',
        boxShadow: isOpen ? '-8px 0 30px rgba(0,0,0,0.18)' : 'none',
        zIndex: 1000,
        overflowY: 'auto',
        overflowX: 'hidden',
        transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: "'Inter', 'Barlow', sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>
        {company && (
          <>
            {/* ═══ HEADER ═══ */}
            <div style={{
              background: '#111111',
              padding: '20px 20px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}>
              {/* Logo */}
              <div style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: '#ff4400',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
              }}>
                {company.slice(0, 3).toUpperCase()}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 17, fontWeight: 700, color: '#ffffff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{company}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {loading ? 'Loading...' : `${detail?.totalCount || 0} salaries shared`}
                </div>
              </div>

              {/* Close */}
              <div onClick={onClose} style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,0.5)',
              }}>✕</div>
            </div>

            {/* ═══ BODY ═══ */}
            <div style={{ padding: '20px 20px 40px' }}>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: '#ccc' }}>Loading...</div>
              )}

              {!loading && detail && !isSubmitted && (
                /* ═══ STATE 1: NOT SUBMITTED ═══ */
                <>
                  {/* Blurred summary placeholder */}
                  <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {['25th %ile', 'Median', '75th %ile'].map((lbl, idx) => (
                        <div key={lbl} style={{
                          background: '#f5f5f5', borderRadius: 10, padding: '14px 8px', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: idx === 1 ? '#ff4400' : '#222', marginBottom: 3 }}>42M</div>
                          <div style={{ fontSize: 10, color: '#aaa' }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gate */}
                  <div style={{
                    background: '#f5f5f5', borderRadius: 14,
                    padding: '22px 18px', textAlign: 'center', marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
                      Share yours to see all salaries
                    </div>
                    <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6, marginBottom: 16 }}>
                      Submit your salary anonymously.<br />
                      Unlock individual salary entries from real engineers.
                    </div>
                    <button onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }} style={{
                      width: '100%', padding: '12px 0',
                      background: '#ff4400', border: 'none', borderRadius: 11,
                      fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>Submit my salary → unlock</button>
                  </div>

                  {/* Blurred feed placeholder */}
                  <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
                    <div style={{ fontSize: 10, color: '#bbb', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>INDIVIDUAL SALARIES</div>
                    {[35, 42, 51].map((s, i) => (
                      <div key={i} style={{
                        background: '#f5f5f5', borderRadius: 10, padding: '12px 14px', marginBottom: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#222' }}>Backend</div>
                          <div style={{ fontSize: 10, color: '#bbb' }}>3 yrs</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{s}M VND</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!loading && detail && isSubmitted && (
                /* ═══ STATE 2 & 3: SUBMITTED ═══ */
                <>
                  {/* My company banner */}
                  {isMyCompany && (
                    <div style={{
                      background: '#111', borderRadius: 10, padding: '10px 14px',
                      textAlign: 'center', marginBottom: 14,
                      fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.02em',
                    }}>This is your current company</div>
                  )}

                  {/* Context bar */}
                  {userRole && (
                    <div style={{
                      background: '#fff4f0',
                      border: '1.5px solid #ff4400',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 16,
                    }}>
                      <div style={{
                        background: '#ff4400', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        padding: '3px 9px', borderRadius: 5, flexShrink: 0,
                      }}>{userRole} · {userExperience}</div>
                      <div style={{ fontSize: 11, color: '#777' }}>Filtered to your role & experience</div>
                    </div>
                  )}

                  {/* Summary boxes */}
                  {detail.summary ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 6 }}>
                        {[
                          { label: '25th %ile', value: detail.summary.p25 },
                          { label: 'Median', value: detail.summary.median, hl: true },
                          { label: '75th %ile', value: detail.summary.p75 },
                        ].map(s => (
                          <div key={s.label} style={{
                            background: s.hl ? '#fff4f0' : '#f5f5f5',
                            border: s.hl ? '1.5px solid #ffcab3' : '1.5px solid transparent',
                            borderRadius: 10, padding: '14px 8px', textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 19, fontWeight: 700, color: s.hl ? '#ff4400' : '#1a1a1a', letterSpacing: '-0.02em' }}>
                              {fmt(s.value)}
                            </div>
                            <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center', marginBottom: 16 }}>
                        Based on {detail.summary.count} similar submissions · VND /month
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '14px 0 18px', fontSize: 12, color: '#bbb' }}>
                      Not enough data for this role yet.
                    </div>
                  )}

                  {/* Compare badge */}
                  {comparePct !== null && med > 0 && (
                    <div style={{
                      background: comparePct >= 0 ? '#f0fff4' : '#fff5f5',
                      border: `1.5px solid ${comparePct >= 0 ? '#86efac' : '#fca5a5'}`,
                      borderRadius: 10, padding: '11px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 18,
                    }}>
                      <div style={{ fontSize: 12, color: '#555' }}>
                        {isMyCompany ? 'vs market median' : `vs your salary (${fmt(userSalary)})`}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: comparePct >= 0 ? '#16a34a' : '#dc2626' }}>
                        {comparePct >= 0 ? '+' : ''}{comparePct}%
                      </div>
                    </div>
                  )}

                  {/* Feed */}
                  {detail.feed && detail.feed.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#bbb', letterSpacing: '0.06em', marginBottom: 10 }}>
                        INDIVIDUAL SALARIES · similar to you first
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                        {detail.feed.map((row, i) => {
                          const isYou = isMyCompany &&
                            row.role === userRole &&
                            String(row.experience) === String(userExperience) &&
                            row.salary === userSalary

                          const bg = isYou ? '#fff4f0' : row.mostSimilar ? '#f0fff4' : '#f5f5f5'
                          const bd = isYou ? '1.5px solid #ff4400' : row.mostSimilar ? '1.5px solid #86efac' : '1px solid #eee'

                          return (
                            <div key={i} style={{
                              background: bg, border: bd,
                              borderRadius: 10, padding: '11px 14px',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                                  {row.role}
                                  {isYou && <span style={{ color: '#ff4400', fontSize: 10, fontWeight: 700, marginLeft: 6 }}>← YOU</span>}
                                </div>
                                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{row.experience} yrs</div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: isYou ? '#ff4400' : '#1a1a1a' }}>
                                  {fmt(row.salary)} VND
                                </div>
                                {isYou && (
                                  <div style={{ fontSize: 9, fontWeight: 700, background: '#ff4400', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>your entry</div>
                                )}
                                {!isYou && row.mostSimilar && (
                                  <div style={{ fontSize: 9, fontWeight: 700, background: '#22c55e', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>similar</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Rating */}
                  {detail.rating && (
                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#bbb', letterSpacing: '0.06em', marginBottom: 12 }}>
                        COMPANY RATING · {detail.rating.count} reviews
                      </div>
                      {[
                        { label: 'Work-life', value: detail.rating.worklife },
                        { label: 'Salary fair', value: detail.rating.salary },
                        { label: 'Growth', value: detail.rating.growth },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: '#666', width: 72, flexShrink: 0 }}>{label}</div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <div key={s} style={{
                                width: 12, height: 12, borderRadius: 3,
                                background: s <= Math.round(value) ? '#ff4400' : '#e8e8e8',
                              }} />
                            ))}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#999' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
