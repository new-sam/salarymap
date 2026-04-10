export default function AnonymousSection() {
  return (
    <section style={{
      background: '#0c0c0b',
      padding: '80px 60px 60px',
      fontFamily: "'Barlow', 'Inter', sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{
          fontSize: 'clamp(32px, 4vw, 51px)',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.3,
          marginBottom: '14px',
        }}>
          This is{' '}
          <em style={{ color: '#ff6000', fontStyle: 'normal' }}>completely</em>
          {' '}anonymous.
        </h2>
        <p style={{
          fontSize: '18px',
          fontWeight: 300,
          color: 'rgba(255,255,255,0.5)',
          maxWidth: '700px',
          margin: '0 auto',
        }}>
          We don't know who you are. We just know what engineers in Vietnam are earning.
        </p>
      </div>

      {/* Lock icon with arrows */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-36px', position: 'relative', zIndex: 2 }}>
        <div style={{ position: 'relative', width: '220px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Left arrow — curving into the lock */}
          <svg width="80" height="100" viewBox="0 0 80 100" fill="none" style={{ position: 'absolute', left: '-24px', top: '10px' }}>
            <path d="M75 5 C50 5, 15 20, 15 55" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            <path d="M10 48 L15 58 L20 48" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>

          {/* Right arrow — curving out of the lock */}
          <svg width="80" height="100" viewBox="0 0 80 100" fill="none" style={{ position: 'absolute', right: '-24px', top: '10px' }}>
            <path d="M5 55 C5 20, 40 5, 65 5" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="4 4" />
            <path d="M60 0 L68 5 L60 10" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>

          {/* Outer ring */}
          <div style={{
            width: '160px', height: '160px', borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(255,96,0,0.12) 0%, rgba(255,96,0,0) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Middle ring */}
            <div style={{
              width: '120px', height: '120px', borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,96,0,0.15) 0%, rgba(255,96,0,0.05) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Inner circle */}
              <div style={{
                width: '84px', height: '84px', borderRadius: '50%',
                background: '#ff6000',
                boxShadow: '0px 8px 24px rgba(255,96,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '36px' }}>🔐</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Two cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        maxWidth: '960px',
        margin: '0 auto',
      }}>

        {/* Left — What you submit */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px',
          padding: '52px 24px 28px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.4)', marginBottom: '18px', letterSpacing: '0.02em' }}>
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
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{
                  width: '7px', height: '7px',
                  borderRadius: '50%',
                  background: '#ff6000',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '14px', color: '#fff' }}>{label}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.3)',
                  filter: 'blur(5px)',
                  userSelect: 'none',
                }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — What everyone sees */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px',
          padding: '52px 24px 28px',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ff6000', marginBottom: '8px' }}>
            What everyone sees
          </div>
          <div style={{ fontSize: '14px', fontWeight: 300, color: 'rgba(255,255,255,0.5)', marginBottom: '14px' }}>
            Backend · 4–6 yrs · Grab
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ height: '100%', width: '72%', background: '#ff6000', borderRadius: '20px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>
              $2,400 — $3,800
            </span>
            <span style={{ fontSize: '12px', fontWeight: 300, color: 'rgba(255,255,255,0.35)' }}>
              Based on 35 salaries
            </span>
          </div>
        </div>

      </div>

      {/* Bottom */}
      <div style={{
        marginTop: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '28px' }}>🙈</span>
        <span style={{ fontSize: '18px', fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>
          We <em style={{ color: '#ff6000', fontStyle: 'normal', fontWeight: 700 }}>can't</em> identify you. Even if we tried.
        </span>
      </div>

    </section>
  );
}
