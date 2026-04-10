import { useState, useEffect } from 'react';

export default function SlidePanel({ company, isOpen, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !company) { setDetail(null); return; }
    setLoading(true);
    fetch(`/api/company/${encodeURIComponent(company.company)}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen, company]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const domain = company?.domain || null;
  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
    : null;
  const initials = company?.company
    ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '';

  const maxMedian = detail?.roles?.length
    ? Math.max(...detail.roles.map(r => r.median))
    : 100;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 200, opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'opacity .32s',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'clamp(480px, 50vw, 800px)', background: 'white', zIndex: 201,
        overflowY: 'auto',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(0.22, 0.9, 0.36, 1)',
        fontFamily: "'Barlow', sans-serif",
      }}>
        {company && (
          <>
            {/* Header */}
            <div style={{
              height: '160px', position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(160deg, #1a1a18 0%, #2a2a28 100%)',
              display: 'flex', alignItems: 'center', padding: '0 28px', gap: '20px',
            }}>
              {/* Close button */}
              <div onClick={onClose} style={{
                position: 'absolute', top: '16px', right: '16px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'white', fontSize: '15px', lineHeight: 1,
              }}>✕</div>

              {/* Logo */}
              {faviconUrl ? (
                <img src={faviconUrl} alt={company.company}
                  style={{ width: 48, height: 48, borderRadius: '10px', objectFit: 'contain', background: 'rgba(255,255,255,0.9)', padding: '6px' }}
                  onError={e => e.target.style.display = 'none'} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: '10px', background: '#FF6200',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 900, color: '#fff',
                }}>{initials}</div>
              )}

              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#FF6200', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {company.topPct ? `Top ${company.topPct}%` : 'Company'}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff', letterSpacing: '-.03em' }}>
                  {company.company}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                  {company.count} salaries · {company.topRole || 'Tech'}
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px' }}>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '28px' }}>
                {[
                  { label: 'Min', value: `$${company.min}` },
                  { label: 'Median', value: `$${company.median}`, highlight: true },
                  { label: 'Max', value: `$${company.max}` },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#f8f6f3', borderRadius: '10px', padding: '14px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: s.highlight ? '#FF6200' : '#111' }}>{s.value}</div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>{s.label}/mo</div>
                  </div>
                ))}
              </div>

              {/* Loading */}
              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '13px' }}>Loading roles...</div>
              )}

              {/* Role breakdown */}
              {detail && detail.roles && detail.roles.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '16px' }}>
                    Salary by role
                  </div>
                  {detail.roles.map((role, i) => {
                    const barPct = Math.min(100, Math.round((role.median / maxMedian) * 100));
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    return (
                      <div key={role.role} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 0', borderBottom: '1px solid #f0ede8',
                      }}>
                        {medal && <span style={{ fontSize: '16px', flexShrink: 0 }}>{medal}</span>}
                        {!medal && <div style={{ width: '20px', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{role.role}</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#FF6200' }}>${role.median}/mo</span>
                          </div>
                          <div style={{ height: '4px', borderRadius: '2px', background: '#f0ede8', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: '2px',
                              background: i === 0 ? '#FF6200' : i === 1 ? '#ffab6b' : '#ddd',
                              width: `${barPct}%`, transition: 'width .5s ease',
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>${role.min} – ${role.max}</span>
                            <span style={{ fontSize: '10px', color: '#aaa' }}>{role.count} people</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {detail && (!detail.roles || detail.roles.length === 0) && !loading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '13px' }}>
                  Not enough role data yet for this company.
                </div>
              )}

              {/* CTA */}
              <div style={{
                marginTop: '28px', background: '#fff6f0', border: '1px solid #ffe0cc',
                borderRadius: '14px', padding: '20px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#111', marginBottom: '6px' }}>
                  How does your salary compare?
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '14px' }}>
                  Submit your salary anonymously to see where you rank.
                </div>
                <button
                  onClick={() => { onClose(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }); }}
                  style={{
                    fontFamily: "'Barlow',sans-serif", fontSize: '14px', fontWeight: 800,
                    background: '#FF6200', color: '#fff', border: 'none', padding: '13px 28px',
                    borderRadius: '10px', cursor: 'pointer',
                  }}
                >Am I Underpaid? →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
