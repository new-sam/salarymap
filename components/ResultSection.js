import { useEffect, useState } from 'react'
import NextStepSheet from './NextStepSheet'

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

  const { percentile, userSalary, marketMedian, diff, topCompanies } = result
  const isPositive = diff >= 0

  const pillCards = [
    { val: `${userSalary}M`, label: 'Your\nsalary', accent: false },
    { val: `${marketMedian}M`, label: 'Market\nmedian', accent: false },
    { val: `${isPositive ? '+' : ''}${diff}M`, label: 'Difference', accent: true },
  ]

  return (
    <section style={{
      background: '#000',
      padding: '64px 40px 80px',
      fontFamily: "'Barlow', 'Inter', sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Outer gradient container */}
      <div style={{
        maxWidth: '1178px',
        margin: '0 auto',
        background: 'linear-gradient(180deg, rgba(217,217,217,0) 0%, rgba(255,255,255,0.21) 100%)',
        borderRadius: '25px',
        padding: '56px 48px 64px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '48px',
        alignItems: 'start',
      }}>

        {/* ─── LEFT COLUMN ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          {/* Your Result */}
          <div style={{ fontSize: '27px', fontWeight: 400, color: '#8f8f8f', marginBottom: '12px' }}>
            Your Result
          </div>

          {/* Top N% */}
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '82px', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>Top </span>
            <span style={{ fontSize: '82px', fontWeight: 700, color: '#ff4400', lineHeight: 1, letterSpacing: '-0.02em' }}>{percentile}%</span>
          </div>

          {/* Subtitle */}
          <div style={{ fontSize: '20px', fontWeight: 400, color: '#fff', marginBottom: '48px', textAlign: 'center' }}>
            Among {role} engineers with {experience} experience
          </div>

          {/* 3 Pill Cards */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '16px' }}>
            {pillCards.map(({ val, label, accent }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Pill body */}
                <div style={{
                  width: '126px',
                  height: '206px',
                  background: accent ? '#ff4400' : '#fff',
                  borderRadius: '15px 15px 71px 71px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: '28px',
                  position: 'relative',
                }}>
                  {/* Value */}
                  <div style={{
                    fontSize: '38px',
                    fontWeight: 800,
                    color: accent ? '#fff' : '#8f8f8f',
                    lineHeight: 1.2,
                    textAlign: 'center',
                    marginBottom: '12px',
                  }}>
                    {val}
                  </div>

                  {/* $ Coin */}
                  <div style={{
                    width: '71px',
                    height: '71px',
                    borderRadius: '50%',
                    background: accent ? '#fff' : '#ff4400',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    bottom: '16px',
                  }}>
                    <span style={{
                      fontSize: '42px',
                      fontWeight: 700,
                      color: accent ? '#ff4400' : '#fff',
                      lineHeight: 1,
                      marginTop: '-4px',
                    }}>$</span>
                  </div>
                </div>

                {/* Label below pill */}
                <div style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: accent ? '#ff4400' : '#fff',
                  textAlign: 'center',
                  marginTop: '16px',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.3,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(42,42,42,0.08) 0%, rgba(144,144,144,0.27) 100%)',
          borderRadius: '19px',
          padding: '28px 32px',
          minHeight: '460px',
        }}>
          {/* Orange accent bar */}
          <div style={{ width: '126px', height: '8px', background: '#ff4400', borderRadius: '28px', margin: '0 auto 28px' }} />

          {/* Title */}
          <div style={{ fontSize: '25px', fontWeight: 400, color: '#fff', textAlign: 'center', lineHeight: 1.35, marginBottom: '32px' }}>
            Companies paying more<br />for {role} · {experience}
          </div>

          {/* Company rows */}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '10px 16px',
                  border: '1px solid #585858',
                  borderRadius: '9px',
                }}>
                  {/* Logo */}
                  <div style={{
                    width: '54px', height: '54px', borderRadius: '50%',
                    background: '#222', overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${co.domain}&sz=128`}
                      alt={co.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, borderRadius: '50%' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#666' }}>{initials}</span>
                  </div>

                  {/* Name */}
                  <span style={{ fontSize: '21px', fontWeight: 400, color: '#fff', flex: 1 }}>{co.name}</span>

                  {/* Premium badge */}
                  <span style={{ fontSize: '22px', fontWeight: 700, color: '#b3ff00', whiteSpace: 'nowrap' }}>
                    +{co.premiumPct}% vs yours
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom sheet — appears 2s after result loads */}
      {result && (
        <NextStepSheet
          role={role}
          experience={experience}
          percentile={result.percentile}
          topCompanies={result.topCompanies}
        />
      )}
    </section>
  )
}
