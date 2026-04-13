import { useState } from 'react';

export default function CompanyCard({ company, index, isUnlocked, onClick, onLockedClick }) {
  const [logoError, setLogoError] = useState(false);

  const initials = company.company.slice(0, 2).toUpperCase();
  const logoUrl = company.logo || null;
  const cardUnlocked = isUnlocked || index < 3;
  const bgImage = company.image || null;

  if (!cardUnlocked) {
    return (
      <div
        className="company-card locked"
        onClick={onLockedClick}
      >
        <div className="card-bg" style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(135deg, #1a1a18 0%, #2a2a28 100%)' }} />
        {logoUrl && !logoError && (
          <div className="card-logo-wrap">
            <img className="card-logo-img" src={logoUrl} alt={company.company} onError={() => setLogoError(true)} />
          </div>
        )}
        <div className="card-overlay" />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '8px', cursor: 'pointer', borderRadius: '14px',
        }}>
          <span style={{ fontSize: '22px' }}>🔒</span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{company.company}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{company.count} salaries</span>
          <span
            onClick={(e) => { e.stopPropagation(); onLockedClick(); }}
            style={{
              marginTop: '8px', background: '#FF6200', color: 'black',
              fontSize: '12px', fontWeight: 800, padding: '9px 20px', borderRadius: '100px',
            }}
          >Submit to unlock →</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="company-card open"
      onClick={() => onClick(company)}
    >
      <div className="card-bg" style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: 'linear-gradient(135deg, #1a1a18 0%, #2a2a28 100%)' }} />
      {logoUrl && !logoError && (
        <div className="card-logo-wrap">
          <img className="card-logo-img" src={logoUrl} alt={company.company} onError={() => setLogoError(true)} />
        </div>
      )}
      <div className="card-overlay" />
      <div className="card-top">
        <span className="card-rank">#{index + 1}</span>
      </div>
      <div className="card-bottom">
        <div className="card-name-row">
          <div className="card-name">{company.company}</div>
          <div className="card-count">{company.count > 0 ? `${company.count} salaries` : 'New'}</div>
        </div>
        <div className="card-divider" />
        {company.hasData ? (
          <div className="card-sal">{company.min}M – {company.max}M VND /mo</div>
        ) : (
          <div className="card-sal" style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '12px' }}>Collecting data...</div>
        )}
      </div>
    </div>
  );
}
