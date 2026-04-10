import { useState } from 'react'

export default function AnonymousSection() {
  return (
    <section style={{
      background: '#000',
      padding: '80px 60px 60px',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '52px' }}>
        <h2 style={{
          fontSize: 'clamp(36px, 5vw, 62px)',
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          marginBottom: '14px',
        }}>
          This is{' '}
          <em style={{ color: '#ff4400', fontStyle: 'normal' }}>completely</em>
          {' '}anonymous.
        </h2>
        <p style={{
          fontSize: '18px',
          fontWeight: 300,
          color: 'rgba(255,255,255,0.6)',
        }}>
          We don't know who you are. We just know what engineers in Vietnam are earning.
        </p>
      </div>

      {/* Main body */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 220px',
        gap: '40px',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(217,217,217,0.02) 0%, rgba(255,255,255,0.06) 100%)',
        borderRadius: '24px',
        padding: '28px',
      }}>

        {/* Left — two boxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* What you submit */}
          <div style={{
            background: 'rgba(42,42,42,0.5)',
            border: '1px solid rgba(100,100,100,0.2)',
            borderRadius: '16px',
            padding: '22px 24px',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 300,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '16px',
            }}>
              What you submit
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Salary', val: '$4,200' },
                { label: 'Role', val: 'Backend' },
                { label: 'Experience', val: '4 yrs' },
                { label: 'Company', val: 'Grab' },
              ].map(({ label, val }) => (
                <div key={label} style={{
                  background: '#2b2b2b',
                  border: '1px solid #585858',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <div style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: '#ff4400',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '16px', color: '#fff' }}>{label}</span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.35)',
                    filter: 'blur(5px)',
                    userSelect: 'none',
                  }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What everyone sees */}
          <div style={{
            background: 'rgba(42,42,42,0.5)',
            border: '1px solid rgba(100,100,100,0.2)',
            borderRadius: '16px',
            padding: '22px 24px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ff4400', marginBottom: '10px' }}>
              What everyone sees
            </div>
            <div style={{ fontSize: '15px', fontWeight: 300, color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
              Backend · 4–6 yrs · Grab
            </div>
            <div style={{ height: '9px', background: '#2a2a2a', borderRadius: '20px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '100%', width: '65%', background: '#ff4400', borderRadius: '20px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '26px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                $2,400 — $3,800
              </span>
              <span style={{ fontSize: '13px', fontWeight: 300, color: 'rgba(255,255,255,0.35)' }}>
                Based on 35 salaries
              </span>
            </div>
          </div>

        </div>

        {/* Right — connector + lock */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>

          {/* Arrow top */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '12px' }}>
            <div style={{ width: '80%', height: '1.5px', background: '#fff' }} />
            <div style={{ width: '1.5px', height: '48px', background: '#fff' }} />
            <div style={{
              width: 0, height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '12px solid #fff',
              marginRight: '-5.5px',
            }} />
          </div>

          {/* Lock circle */}
          <div style={{
            width: '130px', height: '130px',
            borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(255,255,255,0.08) 100%)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '8px 0',
          }}>
            <svg width="72" height="88" viewBox="0 0 72 88" fill="none">
              <path d="M8 34L36 10L64 34V80C64 82.2 62.2 84 60 84H12C9.8 84 8 82.2 8 80V34Z" fill="#ff4400"/>
              <circle cx="36" cy="32" r="6" fill="rgba(217,217,217,0.82)"/>
              <rect x="18" y="48" width="36" height="30" rx="6" fill="rgba(217,217,217,0.82)"/>
              <path d="M24 48V40a12 12 0 0124 0v8" stroke="rgba(217,217,217,0.6)" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M24 56 L34 46" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" strokeLinecap="round"/>
              <circle cx="36" cy="61" r="5" fill="#ff4400"/>
              <rect x="33.5" y="64" width="5" height="8" rx="2" fill="#ff4400"/>
            </svg>
          </div>

          {/* Arrow bottom */}
          <div style={{ width: '100%', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '1.5px', height: '48px', background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={{
                width: 0, height: 0,
                borderTop: '7px solid transparent',
                borderBottom: '7px solid transparent',
                borderRight: '12px solid #fff',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, height: '1.5px', background: '#fff' }} />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom note */}
      <div style={{
        marginTop: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}>
        <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
          <rect x="0" y="18" width="40" height="6" rx="2" fill="#ff4400"/>
          <rect x="12" y="6" width="16" height="13" rx="2" fill="#ff4400"/>
          <circle cx="13" cy="28" r="7" fill="rgba(200,209,234,0.3)" stroke="#ff4400" strokeWidth="3.5"/>
          <circle cx="27" cy="28" r="7" fill="rgba(200,209,234,0.3)" stroke="#ff4400" strokeWidth="3.5"/>
        </svg>
        <span style={{ fontSize: '20px', fontWeight: 300, color: 'rgba(255,255,255,0.65)' }}>
          We can't identify you. Even if we tried.
        </span>
      </div>

    </section>
  )
}
