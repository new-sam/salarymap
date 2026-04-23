import NextStepSheet from '../components/NextStepSheet'

export default function TestNextStep() {
  // Mock localStorage for testing
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem('fyi_salary')) localStorage.setItem('fyi_salary', '30')
    if (!localStorage.getItem('fyi_role')) localStorage.setItem('fyi_role', 'Backend')
    if (!localStorage.getItem('fyi_exp')) localStorage.setItem('fyi_exp', '3–4 yrs')
  }

  return (
    <div style={{ background: '#111', minHeight: '100vh', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <div style={{ padding: '40px 20px', maxWidth: 680, margin: '0 auto', color: '#fff', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>NextStep Sheet Test</h1>
        <p style={{ fontSize: 13, color: '#888' }}>Sheet appears after 3 seconds</p>
      </div>
      <NextStepSheet
        role="Backend"
        experience="3–4 yrs"
        percentile={25}
        topCompanies={[
          { name: 'Grab Vietnam', premiumPct: 45, domain: 'grab.com' },
          { name: 'VNG Corporation', premiumPct: 32, domain: 'vng.com.vn' },
        ]}
      />
    </div>
  )
}
