import { useEffect, useState } from 'react'

export default function ResultSection({ salary, role, experience, company }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    async function fetchResult() {
      const res = await fetch(`/api/result?salary=${salary}&role=${encodeURIComponent(role)}&experience=${encodeURIComponent(experience)}&company=${encodeURIComponent(company)}`)
      const data = await res.json()
      setResult(data)
    }
    if (salary) fetchResult()
  }, [salary, role, experience, company])

  if (!result) return null

  const { percentile, userSalary, marketMedian, diff, diffPct, topCompanies } = result
  const isPositive = diff >= 0

  return (
    <section style={{
      background: '#000',
      minHeight: '100vh',
      padding: '48px 24px',
      fontFamily: "'Inter', sans-serif",
      WebkitFontSmoothing: 'antialiased',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Your Result label */}
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '0.05em' }}>
        Your Result
      </div>

      {/* Top X% headline */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '56px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>Top </span>
        <span style={{ fontSize: '56px', fontWeight: 800, color: '#ff4400', lineHeight: 1 }}>{percentile}%</span>
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '32px' }}>
        Among {role} engineers with {experience} experience
      </div>

      {/* 3 metric boxes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        width: '100%',
        maxWidth: '480px',
        marginBottom: '40px',
      }}>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '16px 12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            ${userSalary}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Your salary</div>
        </div>

        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '16px 12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            ${marketMedian}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Market median</div>
        </div>

        <div style={{
          background: 'rgba(255,68,0,0.15)',
          border: '1px solid #ff4400',
          borderRadius: '12px',
          padding: '16px 12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#ff4400', marginBottom: '4px' }}>
            {isPositive ? '+' : ''}{diff}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Difference</div>
        </div>
      </div>

      {/* Companies paying more */}
      {topCompanies && topCompanies.length > 0 && (
        <div style={{
          width: '100%',
          maxWidth: '480px',
          background: '#111',
          border: '1px solid #222',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
            Companies paying more
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '16px' }}>
            for {role} · {experience}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topCompanies.slice(0, 4).map((co, i) => {
              const initials = co.name.slice(0, 2).toUpperCase();
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#1a1a1a',
                  borderRadius: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px',
                      background: '#2a2a2a', overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 700, color: '#666', position: 'relative',
                    }}>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${co.domain}&sz=64`}
                        alt={co.name}
                        onError={e => { e.target.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0 }}
                      />
                      <span>{initials}</span>
                    </div>
                    <span style={{ fontSize: '14px', color: '#fff', fontWeight: 500 }}>{co.name}</span>
                  </div>
                  <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
                    +{co.premiumPct}% vs yours
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  )
}
