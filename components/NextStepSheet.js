import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function NextStepSheet({ role, experience, percentile, topCompanies }) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState('cta') // 'cta' | 'jobs' | 'done'
  const [jobs, setJobs] = useState([])
  const router = useRouter()

  const userSalary = typeof window !== 'undefined' ? parseInt(localStorage.getItem('fyi_salary')) || 0 : 0

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch('/api/jobs')
        if (!res.ok) return
        const data = await res.json()
        setJobs(data.filter(j => j.salary_min > userSalary).slice(0, 3))
      } catch {}
    }
    fetchJobs()
  }, [userSalary])

  if (!visible) return null

  const jobCount = jobs.length
  const bgColors = ['#e8ecf5', '#f0ece8', '#e8f0ec']

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => { if (step === 'done') setVisible(false) }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400,
          backdropFilter: 'blur(4px)', transition: 'opacity .3s' }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '28px 28px 0 0',
        padding: '28px 0 0', zIndex: 500,
        boxShadow: '0 -20px 80px rgba(0,0,0,0.4)',
        animation: 'sheetSlideUp 0.4s cubic-bezier(.16,1,.3,1)',
        maxHeight: '85vh', overflowY: 'auto',
        fontFamily: "'Barlow', 'Inter', sans-serif",
      }}>
        <style>{`
          @keyframes sheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes sheetFadeSlide { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        `}</style>

        {/* Handle */}
        <div style={{ width: 56, height: 5, background: '#ddd', borderRadius: 3, margin: '0 auto 28px' }} />

        <div style={{ padding: '0 24px 40px', maxWidth: '600px', margin: '0 auto' }}>

          {/* ═══ STEP: CTA — Intent selection ═══ */}
          {step === 'cta' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.35, margin: '0 0 8px' }}>
                  Do you want us to connect you with a <span style={{ color: '#ff4400' }}>better-paying</span> company?
                </h3>
                <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
                  We helped <strong style={{ color: '#1a1a1a' }}>3,000+</strong> engineers earn more than <strong style={{ color: '#1a1a1a' }}>10%</strong> of their current salary.
                </p>
              </div>

              {/* 3 intent cards */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                {[
                  { emoji: '🚀', label: 'Yes, available for better job offers', sub: 'I want to find a fit job now', intent: 'open' },
                  { emoji: '👀', label: 'Open if it\'s the right fit', sub: "I'd consider it for the right role and salary", intent: 'selective' },
                  { emoji: '😌', label: 'Not right now', sub: "I'm happy where I am", intent: 'none' },
                ].map(({ emoji, label, sub, intent }) => (
                  <button key={intent} onClick={() => {
                    if (intent === 'none') { setStep('done'); return; }
                    if (typeof window !== 'undefined') localStorage.setItem('fyi_intent', intent)
                    setStep('jobs')
                  }}
                    style={{
                      flex: 1, padding: '16px 10px', borderRadius: 16,
                      border: '2px solid #eee', background: '#fff', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      fontFamily: 'inherit', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff4400'; e.currentTarget.style.background = '#fff8f5'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.background = '#fff'; }}
                  >
                    <span style={{ fontSize: 28 }}>{emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, textAlign: 'center' }}>{label}</span>
                    <span style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4, textAlign: 'center' }}>{sub}</span>
                  </button>
                ))}
              </div>

              <button onClick={() => setVisible(false)}
                style={{ width: '100%', padding: 12, background: 'transparent', border: 'none',
                  fontSize: 13, color: '#ccc', cursor: 'pointer', fontFamily: 'inherit' }}>
                Maybe later
              </button>
            </div>
          )}

          {/* ═══ STEP: JOBS — Preview after intent ═══ */}
          {step === 'jobs' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease' }}>

              {/* Match message bar */}
              {jobCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                  background: '#f0fff4', border: '1px solid #86efac', borderRadius: 10,
                  padding: '9px 12px', marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#444' }}>
                    We found <strong style={{ color: '#111' }}>{jobCount} jobs</strong> that pay more than you right now
                  </span>
                </div>
              )}

              {/* Blurred jobs preview */}
              {jobCount > 0 && (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden',
                  border: '1px solid #eee', marginBottom: 14 }}>
                  {/* Inner blurred */}
                  <div style={{ display: 'flex', filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }}>
                    {jobs.map((job, i) => {
                      const initials = job.company_initials || (job.company || '').slice(0, 2).toUpperCase()
                      const bump = Math.round(((job.salary_min - userSalary) / userSalary) * 100)
                      return (
                        <div key={i} style={{ flex: i === 2 ? '0 0 30%' : '0 0 52%', borderRight: '1px solid #f0f0f0',
                          opacity: i === 2 ? 0.6 : 1 }}>
                          {/* Image area */}
                          <div style={{ height: 72, background: bgColors[i % 3], position: 'relative' }}>
                            <div style={{ position: 'absolute', bottom: 6, left: 6, width: 26, height: 26, borderRadius: 5,
                              background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, fontWeight: 800, color: '#333' }}>
                              {initials}
                            </div>
                          </div>
                          {/* Body */}
                          <div style={{ padding: '8px 10px 10px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {job.title}
                            </div>
                            <div style={{ fontSize: 10, color: '#aaa', marginBottom: 5 }}>{job.company}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: '#bbb', textDecoration: 'line-through' }}>{userSalary}M</span>
                              <span style={{ fontSize: 10, color: '#bbb' }}>→</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{Math.round(job.salary_min / 1e6)}–{Math.round(job.salary_max / 1e6)}M</span>
                              {bump > 0 && (
                                <span style={{ background: '#fff4f0', color: '#ff4400', fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>
                                  +{bump}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 20 }}>🔒</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Sign in to see & apply</span>
                  </div>
                  {/* Right fade */}
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60,
                    background: 'linear-gradient(to right, transparent, #fff)', pointerEvents: 'none' }} />
                </div>
              )}

              {/* CTA */}
              <button onClick={() => router.push('/jobs')}
                style={{
                  width: '100%', padding: 13, background: '#0080FF', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 16px rgba(0,128,255,0.25)', marginBottom: 8,
                }}>
                See all jobs →
              </button>

              {/* Privacy note */}
              <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center' }}>
                🔒 No spam. We only reach out when it's worth your time.
              </div>
            </div>
          )}

          {/* ═══ STEP: DONE ═══ */}
          {step === 'done' && (
            <div style={{ animation: 'sheetFadeSlide 0.35s ease', textAlign: 'center', padding: '20px 0 12px' }}>
              <div style={{ fontSize: 64, marginBottom: 18 }}>👋</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>No worries!</div>
              <div style={{ fontSize: 16, color: '#999', lineHeight: 1.65, marginBottom: 32 }}>
                Your salary data is saved. If you ever want to explore,<br />FYI will always be here.
              </div>
              <button onClick={() => setVisible(false)}
                style={{ width: '100%', padding: 18, borderRadius: 16, border: '2px solid #e8e8e8',
                  background: '#f7f7f7', fontSize: 17, fontWeight: 700, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
