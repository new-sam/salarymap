import { useState, useEffect } from 'react'

export default function CompanyDetailPanel({
  company, isOpen, onClose,
  userRole, userExperience, userSalary, userCompany, isSubmitted,
}) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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

  const isMyCompany = isSubmitted && userCompany && company &&
    company.trim().toLowerCase() === userCompany.trim().toLowerCase()

  const comparePct = (isSubmitted && userSalary && detail?.summary?.median)
    ? (isMyCompany
        ? Math.round(((detail.summary.median - userSalary) / userSalary) * 100)
        : Math.round(((detail.summary.median - userSalary) / userSalary) * 100))
    : null

  const fmtSal = (v) => Math.round(v) + 'M'

  // --- panel style ---
  const panelStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    maxHeight: '90vh', height: 'auto',
    background: '#fff', zIndex: 50,
    borderRadius: '20px 20px 0 0',
    overflowY: 'auto',
    fontFamily: "'Inter', sans-serif",
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
  } : {
    position: 'fixed', top: 0, right: 0,
    width: 420, height: '100vh',
    background: '#fff', zIndex: 50,
    overflowY: 'auto',
    fontFamily: "'Inter', sans-serif",
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 49,
        display: isOpen ? 'block' : 'none',
      }} />

      {/* Panel */}
      <div style={panelStyle}>
        {company && (
          <>
            {/* ── Header ── */}
            <div style={{
              background: '#111', padding: '20px',
              display: 'flex', alignItems: 'center', gap: 12,
              position: 'sticky', top: 0, zIndex: 10,
            }}>
              {/* Logo circle */}
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: '#ff4400',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {company.slice(0, 3).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {company}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {loading ? 'Loading...' : `${detail?.totalCount || 0} salaries shared`}
                </div>
              </div>
              {/* Close */}
              <div onClick={onClose} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.6)',
                flexShrink: 0,
              }}>✕</div>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: 16 }}>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb', fontSize: 13 }}>Loading...</div>
              )}

              {!loading && detail && (
                <>
                  {/* ── STATE 1: not submitted ── */}
                  {!isSubmitted && (
                    <>
                      {/* Blurred summary */}
                      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', marginBottom: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          {['25th %ile', 'Median', '75th %ile'].map((label, i) => (
                            <div key={label} style={{ background: '#f7f7f7', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 700, color: i === 1 ? '#ff4400' : '#1a1a1a', marginBottom: 2 }}>42M</div>
                              <div style={{ fontSize: 10, color: '#aaa' }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gate box */}
                      <div style={{
                        background: '#f7f7f7', borderRadius: 14,
                        padding: '18px 16px', textAlign: 'center', marginBottom: 14,
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
                          Share yours to see all salaries
                        </div>
                        <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6, marginBottom: 14 }}>
                          Submit your salary anonymously.<br />
                          Unlock individual salary entries from real engineers.
                        </div>
                        <button onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }} style={{
                          width: '100%', padding: 12,
                          background: '#ff4400', border: 'none', borderRadius: 11,
                          fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                          fontFamily: "'Inter', sans-serif",
                        }}>
                          Submit my salary → unlock
                        </button>
                      </div>

                      {/* Blurred feed */}
                      <div style={{ filter: 'blur(6px)', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '.06em', marginBottom: 8 }}>INDIVIDUAL SALARIES</div>
                        {[1, 2, 3].map(i => (
                          <div key={i} style={{ background: '#f7f7f7', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Backend</div><div style={{ fontSize: 10, color: '#aaa' }}>3 yrs</div></div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>38M VND</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── STATE 2 & 3: submitted ── */}
                  {isSubmitted && (
                    <>
                      {/* Own company banner */}
                      {isMyCompany && (
                        <div style={{
                          background: '#111', color: '#fff', borderRadius: 10,
                          padding: '9px 13px', marginBottom: 14,
                          fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: '.02em',
                        }}>This is your current company</div>
                      )}

                      {/* Context bar */}
                      {userRole && (
                        <div style={{
                          background: '#fff4f0', border: '1.5px solid #ff4400',
                          borderRadius: 10, padding: '9px 13px',
                          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                        }}>
                          <div style={{
                            background: '#ff4400', color: '#fff',
                            fontSize: 10, fontWeight: 700,
                            padding: '2px 8px', borderRadius: 5,
                          }}>
                            {userRole} · {userExperience}
                          </div>
                          <div style={{ fontSize: 11, color: '#666' }}>Filtered to your role & experience</div>
                        </div>
                      )}

                      {/* Summary boxes */}
                      {detail.summary ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                          {[
                            { label: '25th %ile', value: detail.summary.p25 },
                            { label: 'Median', value: detail.summary.median, highlight: true },
                            { label: '75th %ile', value: detail.summary.p75 },
                          ].map(({ label, value, highlight }) => (
                            <div key={label} style={{
                              background: '#f7f7f7', borderRadius: 10,
                              padding: '12px 8px', textAlign: 'center',
                            }}>
                              <div style={{
                                fontSize: 18, fontWeight: 700, marginBottom: 2,
                                color: highlight ? '#ff4400' : '#1a1a1a',
                              }}>
                                {value ? fmtSal(value) : '–'}
                              </div>
                              <div style={{ fontSize: 10, color: '#aaa' }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '12px 0 16px', color: '#bbb', fontSize: 12 }}>
                          Not enough data for this role yet.
                        </div>
                      )}

                      {/* Compare badge */}
                      {comparePct !== null && detail.summary?.median > 0 && (
                        <div style={{
                          borderRadius: 10, padding: '10px 13px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 14,
                          background: comparePct >= 0 ? '#f0fff4' : '#fff5f5',
                          border: `1px solid ${comparePct >= 0 ? '#86efac' : '#fca5a5'}`,
                        }}>
                          <div style={{ fontSize: 12, color: '#555' }}>
                            {isMyCompany ? 'vs market median' : `vs your salary (${fmtSal(userSalary)})`}
                          </div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: comparePct >= 0 ? '#16a34a' : '#dc2626',
                          }}>
                            {comparePct >= 0 ? '+' : ''}{comparePct}%
                          </div>
                        </div>
                      )}

                      {/* Individual feed */}
                      {detail.feed && detail.feed.length > 0 && (
                        <>
                          <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '.06em', marginBottom: 8 }}>
                            INDIVIDUAL SALARIES · similar to you first
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {detail.feed.map((row, i) => {
                              const isYou = isMyCompany &&
                                row.role === userRole &&
                                String(row.experience) === String(userExperience) &&
                                row.salary === userSalary

                              return (
                                <div key={i} style={{
                                  background: isYou ? '#fff4f0' : row.mostSimilar ? '#f0fff4' : '#f7f7f7',
                                  border: isYou ? '1.5px solid #ff4400' : row.mostSimilar ? '1.5px solid #86efac' : '1px solid #efefef',
                                  borderRadius: 10, padding: '10px 12px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                                      {row.role}
                                      {isYou && <span style={{ color: '#ff4400', fontSize: 10, marginLeft: 6 }}>← YOU</span>}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#aaa' }}>{row.experience} yrs</div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: isYou ? '#ff4400' : '#1a1a1a' }}>
                                      {fmtSal(row.salary)} VND
                                    </div>
                                    {isYou && (
                                      <div style={{ fontSize: 9, background: '#ff4400', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>your entry</div>
                                    )}
                                    {!isYou && row.mostSimilar && (
                                      <div style={{ fontSize: 9, background: '#22c55e', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>similar</div>
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
                        <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 12 }}>
                          <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '.06em', marginBottom: 10 }}>
                            COMPANY RATING · {detail.rating.count} reviews
                          </div>
                          {[
                            { label: 'Work-life', value: detail.rating.worklife },
                            { label: 'Salary fair', value: detail.rating.salary },
                            { label: 'Growth', value: detail.rating.growth },
                          ].map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{ fontSize: 11, color: '#555', width: 70, flexShrink: 0 }}>{label}</div>
                              <div style={{ display: 'flex', gap: 2 }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                  <div key={s} style={{
                                    width: 11, height: 11, borderRadius: 2,
                                    background: s <= Math.round(value) ? '#ff4400' : '#ebebeb',
                                  }} />
                                ))}
                              </div>
                              <div style={{ fontSize: 11, color: '#aaa' }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Bottom spacer */}
              <div style={{ height: 40 }} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
