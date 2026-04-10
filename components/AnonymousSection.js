export default function AnonymousSection() {
  return (
    <section style={{
      background: '#fff',
      padding: '75px 60px 60px',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      position: 'relative',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{
          fontSize: 'clamp(32px, 4vw, 51px)',
          fontWeight: 700,
          color: '#4a4a4a',
          lineHeight: 1.3,
          marginBottom: '14px',
        }}>
          This is{' '}
          <em style={{ color: '#3794FE', fontStyle: 'normal' }}>completely</em>
          {' '}anonymous.
        </h2>
        <p style={{
          fontSize: '20px',
          fontWeight: 400,
          color: '#4a4a4a',
          maxWidth: '797px',
          margin: '0 auto',
        }}>
          We don't know who you are. We just know what engineers in Vietnam are earning.
        </p>
      </div>

      {/* Lock icon — centered above cards */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-40px', position: 'relative', zIndex: 2 }}>
        {/* Outer ring */}
        <div style={{
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(200,222,255,0.34) 21.63%, rgba(255,255,255,0) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Middle ring */}
          <div style={{
            width: '138px', height: '138px', borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(200,222,255,0.33) 55.77%, rgba(255,255,255,0.24) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Inner circle */}
            <div style={{
              width: '97px', height: '97px', borderRadius: '50%',
              background: '#0077FF',
              boxShadow: '0px 8px 19px 1px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="48" height="62" viewBox="0 0 57 74" fill="none">
                <path d="M26.6348 1.0498C27.5972 0.712962 28.646 0.712978 29.6084 1.0498L52.7305 9.14258C54.5351 9.77431 55.743 11.4776 55.7432 13.3896V54.0557C55.7432 56.5409 53.7284 58.5557 51.2432 58.5557H5C2.51472 58.5557 0.5 56.5409 0.5 54.0557V13.3896C0.500166 11.4776 1.70891 9.77425 3.51367 9.14258L26.6348 1.0498Z" fill="#4A4A4A" stroke="#B3FF00"/>
                <circle cx="28.1218" cy="11.2488" r="3.71827" fill="#B3FF00" stroke="#B3FF00"/>
                <path d="M12.8427 39.8705H43.4012C44.7818 39.8707 45.9012 40.9899 45.9012 42.3705V54.8373C45.9012 64.6565 37.9411 72.6166 28.1219 72.6166C18.3028 72.6166 10.3427 64.6565 10.3427 54.8373V42.3705C10.3427 40.9898 11.4619 39.8705 12.8427 39.8705Z" fill="#B3FF00" stroke="#B3FF00"/>
                <path d="M22.9554 72.3754C22.0676 72.1143 21.2082 71.7874 20.3821 71.4008L28.2142 39.3705H31.0267L22.9554 72.3754ZM17.9124 70.0014C16.1525 68.8141 14.6114 67.328 13.3597 65.6166L19.7776 39.3705H25.4017L17.9124 70.0014Z" fill="white" fillOpacity="0.82"/>
                <path d="M36.5584 34.7146C36.5584 32.4771 35.6695 30.3313 34.0874 28.7491C32.5052 27.167 30.3594 26.2781 28.1218 26.2781C25.8843 26.2781 23.7385 27.167 22.1563 28.7491C20.5742 30.3313 19.6853 32.4771 19.6853 34.7146" stroke="#B3FF00" strokeWidth="6" strokeLinecap="round"/>
                <path d="M28.1223 47.8071C30.4517 47.8074 32.34 49.6963 32.34 52.0258C32.3399 53.2539 31.8143 54.3583 30.9763 55.1287C30.6617 55.418 30.4819 55.8444 30.5856 56.259L32.0293 62.0313C32.1871 62.6624 31.7097 63.2739 31.0591 63.2739H25.1842C24.5337 63.2739 24.0563 62.6625 24.2141 62.0314L25.6571 56.2588C25.7607 55.8443 25.5809 55.418 25.2665 55.1287C24.4289 54.3582 23.9036 53.2537 23.9035 52.0258C23.9035 49.6962 25.7926 47.8071 28.1223 47.8071Z" fill="#4A4A4A"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Two cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        maxWidth: '1064px',
        margin: '0 auto',
      }}>

        {/* Left card — What you submit */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(216,234,255,0) 0%, rgba(55,148,254,0.56) 100%)',
          boxShadow: '0px 17px 20px -9px rgba(0,0,0,0.25)',
          borderRadius: '17px',
          padding: '28px 28px 32px',
          paddingTop: '52px',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 300, color: '#303030', marginBottom: '20px' }}>
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
                background: '#3794FE',
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: '#fff',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '16px', color: '#fff' }}>{label}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.95)',
                  filter: 'blur(5px)',
                  userSelect: 'none',
                }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right card — What everyone sees */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(216,234,255,0) 0%, rgba(55,148,254,0.56) 100%)',
          boxShadow: '0px 17px 20px -9px rgba(0,0,0,0.25)',
          borderRadius: '17px',
          padding: '28px 28px 32px',
          paddingTop: '52px',
        }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#3794FE', marginBottom: '10px' }}>
            What everyone sees
          </div>
          <div style={{ fontSize: '17px', fontWeight: 300, color: '#2b2b2b', marginBottom: '14px' }}>
            Backend · 4–6 yrs · Grab
          </div>
          <div style={{ height: '9px', background: '#fff', borderRadius: '28px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ height: '100%', width: '72%', background: '#3794FE', borderRadius: '28px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: '#4a4a4a' }}>
              $2,400 — $3,800
            </span>
            <span style={{ fontSize: '13px', fontWeight: 300, color: '#2b2b2b' }}>
              Based on 35 salaries
            </span>
          </div>
        </div>

      </div>

      {/* Bottom note */}
      <div style={{
        marginTop: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}>
        {/* Glasses icon */}
        <svg width="36" height="32" viewBox="0 0 36 32" fill="none">
          <rect x="0" y="0" width="36" height="5" rx="2" fill="#0077FF"/>
          <rect x="10" y="5" width="15" height="9" rx="2" fill="#0077FF"/>
          <circle cx="10" cy="24" r="7" fill="#3794FE" stroke="#0077FF" strokeWidth="3"/>
          <circle cx="26" cy="24" r="7" fill="#3794FE" stroke="#0077FF" strokeWidth="3"/>
          <line x1="17" y1="24" x2="19" y2="24" stroke="#0077FF" strokeWidth="3"/>
        </svg>
        <span style={{ fontSize: '24px', fontWeight: 200, color: '#4a4a4a' }}>
          We can't identify you. Even if we tried.
        </span>
      </div>

    </section>
  );
}
