export default function ResultSection({
  percentile, userSalary, marketMedian,
  role, experience, companiesPayingMore = []
}) {
  const difference = userSalary - marketMedian;
  const isAbove = difference >= 0;

  return (
    <div style={{
      background: '#111',
      borderRadius: '20px',
      padding: '40px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '32px',
      alignItems: 'start',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>

      {/* LEFT — percentile + 3 cards */}
      <div>
        <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', fontWeight: 300, textAlign: 'center', marginBottom: '6px' }}>
          Your Result
        </div>
        <div style={{ fontSize: '80px', fontWeight: 800, color: '#fff', lineHeight: 1, textAlign: 'center', letterSpacing: '-0.03em', marginBottom: '6px' }}>
          Top <span style={{ color: '#ff4400' }}>{percentile}</span>%
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: '36px' }}>
          Among {role} engineers with {experience} experience
        </div>

        {/* 3 salary cards */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          {[
            { val: `${userSalary}M`, label: 'Your\nsalary', accent: false },
            { val: `${marketMedian}M`, label: 'Market\nmedian', accent: false },
            { val: `${isAbove ? '+' : ''}${difference}M`, label: 'Difference', accent: true },
          ].map(({ val, label, accent }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                background: accent ? '#ff4400' : '#fff',
                borderRadius: '16px 16px 0 0',
                padding: '20px 16px 0',
                width: '110px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: accent ? '#fff' : '#666',
                  marginBottom: '16px',
                }}>
                  {val}
                </div>
                <div style={{
                  width: '52px', height: '52px',
                  borderRadius: '50%',
                  background: accent ? '#fff' : '#ff4400',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '-26px',
                  zIndex: 1,
                  position: 'relative',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10"
                      stroke={accent ? '#ff4400' : '#fff'} strokeWidth="2"/>
                    <text x="12" y="17" textAnchor="middle"
                      fill={accent ? '#ff4400' : '#fff'}
                      fontSize="13" fontWeight="700">$</text>
                  </svg>
                </div>
              </div>
              <div style={{
                fontSize: '13px', fontWeight: 600, textAlign: 'center',
                color: accent ? '#ff4400' : '#fff',
                marginTop: '36px',
                whiteSpace: 'pre-line',
                lineHeight: 1.4,
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — companies paying more */}
      <div style={{
        background: '#1a1a1a',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #2a2a2a',
      }}>
        <div style={{ width: '60px', height: '3px', background: '#ff4400', borderRadius: '2px', marginBottom: '16px' }} />

        <div style={{ fontSize: '18px', fontWeight: 600, color: '#fff', lineHeight: 1.35, marginBottom: '24px' }}>
          Companies paying more<br />
          <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
            for {role} · {experience}
          </span>
        </div>

        {companiesPayingMore.length === 0 && (
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', padding: '20px 0', textAlign: 'center' }}>
            No data yet for this role and experience level.
          </div>
        )}

        {companiesPayingMore.map((co, i) => {
          const pctHigher = Math.round(((co.medianSalary - userSalary) / userSalary) * 100);
          const initials = co.company.slice(0, 2).toUpperCase();
          return (
            <div key={co.company} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 0',
              borderBottom: i < companiesPayingMore.length - 1 ? '1px solid #252525' : 'none',
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: '#2a2a2a', overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#888',
                position: 'relative',
              }}>
                <img
                  src={`https://www.google.com/s2/favicons?domain=${co.domain}&sz=64`}
                  alt={co.company}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', inset: 0 }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span>{initials}</span>
              </div>
              <span style={{ fontSize: '15px', color: '#fff', flex: 1 }}>{co.company}</span>
              <span style={{
                fontSize: '13px', fontWeight: 700, color: '#22c55e',
                background: 'rgba(34,197,94,0.12)',
                padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap',
              }}>
                +{pctHigher}% vs yours
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
