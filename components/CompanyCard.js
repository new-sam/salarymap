import { useState } from 'react';

export default function CompanyCard({ company, rank, isUnlocked, onClick, onScrollToSubmit }) {
  const [logoError, setLogoError] = useState(false);

  const initials = company.company
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const domain = company.domain || null;
  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
    : null;

  const locked = !isUnlocked && rank >= 3;

  return (
    <div
      className={`company-card ${locked ? 'locked' : 'open'}`}
      onClick={() => {
        if (locked && onScrollToSubmit) {
          onScrollToSubmit(company.company);
        } else if (!locked) {
          onClick(company);
        }
      }}
    >
      {/* Background gradient */}
      <div className="card-bg" style={{ backgroundColor: '#2a2a28' }} />

      {/* Logo */}
      {faviconUrl && !logoError ? (
        <div className="card-logo-wrap">
          <img
            className="card-logo-img"
            src={faviconUrl}
            alt={company.company}
            onError={() => setLogoError(true)}
          />
        </div>
      ) : null}

      {/* Overlay */}
      <div className="card-overlay" />

      {locked ? (
        /* Locked overlay */
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '8px', cursor: 'pointer', borderRadius: '14px',
        }}>
          <span style={{ fontSize: '22px' }}>🔒</span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{company.company}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{company.count} salaries</span>
          <span style={{
            marginTop: '8px', background: '#FF6200', color: 'black',
            fontSize: '12px', fontWeight: 800, padding: '9px 20px', borderRadius: '100px',
          }}>Submit to unlock →</span>
        </div>
      ) : (
        /* Open card content */
        <>
          <div className="card-top">
            <span className="card-rank">#{rank + 1}</span>
            <span className="card-category">{company.topRole || 'Tech'}</span>
          </div>
          <div className="card-bottom">
            <div className="card-name-row">
              <div className="card-name">{company.company}</div>
              <div className="card-count">{company.count} salaries</div>
            </div>
            <div className="card-divider" />
            <div className="card-sal">${company.min} – ${company.max} /mo</div>
          </div>
        </>
      )}
    </div>
  );
}
