import { useEffect, useState } from 'react'
import NextStepSheet from './NextStepSheet'

export default function ResultSection({ salary, role, experience, company, isLoggedIn }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await fetch(`/api/result?salary=${salary}&role=${encodeURIComponent(role)}&experience=${encodeURIComponent(experience)}&company=${encodeURIComponent(company)}`)
        if (!res.ok) return
        const data = await res.json()
        setResult(data)
      } catch(e) {
        // network error — silent fail, component stays hidden
      }
    }
    if (salary) fetchResult()
  }, [salary, role, experience, company])

  if (!result) return null

  const { percentile, userSalary, marketMedian, diff, topCompanies } = result
  const isPositive = diff >= 0

  const pillCards = [
    { val: `${userSalary}M`, label: 'Your\nsalary', accent: false },
    { val: `${marketMedian}M`, label: 'Market\nmedian', accent: false },
    { val: `${isPositive ? '+' : ''}${diff}M`, label: 'Difference', accent: true },
  ]

  return (
    <section className="result-section">
      <style>{`
        .result-section {
          background: #000;
          padding: 64px 40px 80px;
          font-family: 'Barlow', 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .result-grid {
          max-width: 1178px;
          margin: 0 auto;
          background: linear-gradient(180deg, rgba(217,217,217,0) 0%, rgba(255,255,255,0.21) 100%);
          border-radius: 25px;
          padding: 56px 48px 64px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
        }
        .result-top-pct { font-size: 82px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
        .result-subtitle { font-size: 20px; }
        .pill-row { display: flex; gap: 20px; justify-content: center; margin-bottom: 16px; }
        .pill-body { width: 126px; height: 206px; border-radius: 15px 15px 71px 71px; }
        .pill-val { font-size: 38px; }
        .pill-coin { width: 71px; height: 71px; }
        .pill-coin-symbol { font-size: 42px; }
        .pill-label { font-size: 24px; }
        .result-right { padding: 28px 32px; min-height: 460px; }
        .result-right-title { font-size: 25px; }
        .result-co-name { font-size: 21px; }
        .result-co-badge { font-size: 22px; }
        .result-co-logo { width: 54px; height: 54px; }

        @media (max-width: 768px) {
          .result-section { padding: 40px 16px 60px; }
          .result-grid {
            grid-template-columns: 1fr;
            padding: 32px 20px 40px;
            gap: 32px;
          }
          .result-top-pct { font-size: 52px; }
          .result-subtitle { font-size: 15px; }
          .pill-row { gap: 12px; }
          .pill-body { width: 90px; height: 150px; }
          .pill-val { font-size: 26px; }
          .pill-coin { width: 50px; height: 50px; }
          .pill-coin-symbol { font-size: 30px; }
          .pill-label { font-size: 16px; }
          .result-right { padding: 20px 16px; min-height: auto; }
          .result-right-title { font-size: 18px; }
          .result-co-name { font-size: 15px; }
          .result-co-badge { font-size: 14px; }
          .result-co-logo { width: 40px; height: 40px; }
        }

        @media (max-width: 400px) {
          .pill-body { width: 80px; height: 130px; }
          .pill-val { font-size: 22px; }
          .pill-coin { width: 42px; height: 42px; }
          .pill-coin-symbol { font-size: 26px; }
          .pill-label { font-size: 14px; }
          .result-top-pct { font-size: 42px; }
        }
      `}</style>

      <div className="result-grid">

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '27px', fontWeight: 400, color: '#8f8f8f', marginBottom: '12px' }}>
            Your Result
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span className="result-top-pct" style={{ color: '#fff' }}>Top </span>
            <span className="result-top-pct" style={{ color: '#ff6000' }}>{percentile}%</span>
          </div>
          <div className="result-subtitle" style={{ fontWeight: 400, color: '#fff', marginBottom: '48px', textAlign: 'center' }}>
            Among {role} professionals with {experience} experience
          </div>

          {/* 3 Pill Cards */}
          <div className="pill-row">
            {pillCards.map(({ val, label, accent }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="pill-body" style={{
                  background: accent ? '#ff6000' : '#fff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'flex-start', paddingTop: '28px', position: 'relative',
                }}>
                  <div className="pill-val" style={{
                    fontWeight: 800, color: accent ? '#fff' : '#8f8f8f',
                    lineHeight: 1.2, textAlign: 'center', marginBottom: '12px',
                  }}>
                    {val}
                  </div>
                  <div className="pill-coin" style={{
                    borderRadius: '50%', background: accent ? '#fff' : '#ff6000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'absolute', bottom: '16px',
                  }}>
                    <span className="pill-coin-symbol" style={{
                      fontWeight: 700, color: accent ? '#ff6000' : '#fff',
                      lineHeight: 1, marginTop: '-4px',
                    }}>₫</span>
                  </div>
                </div>
                <div className="pill-label" style={{
                  fontWeight: 700, color: accent ? '#ff6000' : '#fff',
                  textAlign: 'center', marginTop: '16px', whiteSpace: 'pre-line', lineHeight: 1.3,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="result-right" style={{
          background: 'linear-gradient(180deg, rgba(42,42,42,0.08) 0%, rgba(144,144,144,0.27) 100%)',
          borderRadius: '19px',
        }}>
          <div style={{ width: '126px', height: '8px', background: '#ff6000', borderRadius: '28px', margin: '0 auto 28px' }} />
          <div className="result-right-title" style={{ fontWeight: 400, color: '#fff', textAlign: 'center', lineHeight: 1.35, marginBottom: '32px' }}>
            Companies paying more<br />for {role} · {experience}
          </div>

          {(!topCompanies || topCompanies.length === 0) && (
            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>
              You're already at the top for this role.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(topCompanies || []).slice(0, 4).map((co, i) => {
              const initials = co.name.slice(0, 2).toUpperCase()
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', border: '1px solid #585858', borderRadius: '9px',
                }}>
                  <div className="result-co-logo" style={{
                    borderRadius: '50%', background: '#222', overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  }}>
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${co.domain}&sz=128`}
                      alt={co.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, borderRadius: '50%' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#666' }}>{initials}</span>
                  </div>
                  <span className="result-co-name" style={{ fontWeight: 400, color: '#fff', flex: 1 }}>{co.name}</span>
                  <span className="result-co-badge" style={{ fontWeight: 700, color: '#b3ff00', whiteSpace: 'nowrap' }}>
                    +{co.premiumPct}% vs yours
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom sheet — appears 2s after result loads */}
      {result && !isLoggedIn && (
        <NextStepSheet
          role={role}
          experience={experience}
          percentile={result.percentile}
          topCompanies={result.topCompanies}
        />
      )}
      {/* Logged-in users: inline CTA instead of sheet */}
      {result && isLoggedIn && result.topCompanies?.length > 0 && (
        <div style={{
          maxWidth: 1178, margin: '32px auto 0', padding: '0 48px',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a0d07 0%, #111 100%)',
            border: '1px solid rgba(255,96,0,0.2)', borderRadius: 16,
            padding: '28px 32px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                {result.topCompanies.length} companies pay more for your role
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                Our headhunter can personally introduce you — no job boards, no spam.
              </div>
            </div>
            <a href="/jobs" style={{
              background: '#ff6000', color: '#fff', border: 'none', padding: '12px 24px',
              borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              See matching jobs →
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
