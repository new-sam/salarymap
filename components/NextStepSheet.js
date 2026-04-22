import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

// Character images from public folder
const CharImg = ({ src }) => (
  <img src={src} alt="" style={{ width: '100%', display: 'block', borderRadius: '14px 14px 0 0' }} />
)

export default function NextStepSheet({ role, experience, percentile, topCompanies }) {
  const [visible, setVisible] = useState(false)
  const [selected, setSelected] = useState(null) // null | 'open' | 'selective' | 'none'
  const [jobs, setJobs] = useState([])
  const router = useRouter()
  const userSalary = typeof window !== 'undefined' ? parseInt(localStorage.getItem('fyi_salary')) || 0 : 0

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000)
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

  const handleSelect = (intent) => {
    setSelected(intent)
    if (typeof window !== 'undefined') localStorage.setItem('fyi_intent', intent)
    // Scroll to post content
    setTimeout(() => {
      document.getElementById('ns-post')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  const cardStyle = (intent) => ({
    display: 'flex', flexDirection: 'column', cursor: 'pointer', borderRadius: 16, overflow: 'hidden',
    border: selected === intent
      ? (intent === 'none' ? '1.5px solid #aaa' : '1.5px solid #0080FF')
      : '1.5px solid #ebebeb',
    background: '#fff', transition: 'all .18s cubic-bezier(.16,1,.3,1)',
    boxShadow: selected === intent
      ? (intent === 'none' ? '0 0 0 3px rgba(0,0,0,0.06)' : '0 0 0 3px rgba(0,128,255,0.15), 0 6px 20px rgba(0,128,255,0.15)')
      : '0 2px 8px rgba(0,0,0,0.06)',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  })

  return (
    <>
      <div onClick={() => setVisible(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '28px 28px 0 0',
        zIndex: 500, boxShadow: '0 -20px 80px rgba(0,0,0,0.4)',
        animation: 'nsSlideUp 0.4s cubic-bezier(.16,1,.3,1)',
        maxHeight: '85vh', overflowY: 'auto',
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}>
        <style>{`
          @keyframes nsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>

        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '14px auto 0' }} />

        <div style={{ padding: '14px 18px 28px' }}>

          {/* Title */}
          <div style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, fontStyle: 'italic', color: '#111', lineHeight: 1.3, textAlign: 'center', marginBottom: 10 }}>
            Do you want us to connect you with a <span style={{ color: '#0080FF' }}>better-paying</span> company?
          </div>
          <div style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
            We helped <b style={{ color: '#0080FF' }}>3,000+</b> engineers earn more than <b style={{ color: '#0080FF' }}>10%</b> of their current salary.
          </div>

          {/* 3 Intent cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { intent: 'open', img: '/char1.png', label: 'Yes, available\nfor better job\noffers', desc: 'I want to find a fit job now', blue: true },
              { intent: 'selective', img: '/char2.svg', label: "Open if it's\nthe right fit", desc: "I'd consider it for the right role and salary", blue: true },
              { intent: 'none', img: '/char3.png', label: 'Not right now', desc: "I'm happy where I am", blue: false },
            ].map(({ intent, img, label, desc, blue }) => (
              <div key={intent} style={cardStyle(intent)} onClick={() => handleSelect(intent)}>
                <CharImg src={img} />
                <div style={{ padding: '10px 8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, textAlign: 'center', lineHeight: 1.3,
                    whiteSpace: 'pre-line', cursor: 'pointer',
                    color: blue ? '#0080FF' : '#888',
                    ...(selected === intent && blue ? { color: '#005ecc' } : {}),
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 10, color: '#bbb', textAlign: 'center', lineHeight: 1.4 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Maybe later */}
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <button onClick={() => setVisible(false)}
              style={{ padding: 8, background: 'transparent', border: 'none', fontSize: 11, color: '#ccc', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", letterSpacing: '.01em' }}>
              Maybe later
            </button>
          </div>

          {/* Post-select content */}
          <div id="ns-post">
            {/* Opt 1 or 2: Jobs preview */}
            {(selected === 'open' || selected === 'selective') && (
              <div>
                {/* Match message */}
                {jobCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0fff4', border: '1px solid #86efac', borderRadius: 10, padding: '9px 12px', marginBottom: 12 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: '#444', lineHeight: 1.4 }}>
                      We found <b style={{ color: '#111' }}>{jobCount} jobs</b> that pay more than you right now
                    </div>
                  </div>
                )}

                {/* Blurred jobs preview */}
                {jobCount > 0 && (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', marginBottom: 14 }}>
                    <div style={{ display: 'flex', filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }}>
                      {jobs.map((job, i) => {
                        const initials = job.company_initials || (job.company || '').slice(0, 2).toUpperCase()
                        const bump = Math.round(((job.salary_min - userSalary) / userSalary) * 100)
                        return (
                          <div key={i} style={{ flex: i === 2 ? '0 0 30%' : '0 0 52%', borderRight: '1px solid #f0f0f0', opacity: i === 2 ? 0.6 : 1, background: '#fff' }}>
                            <div style={{ height: 72, background: `url(${job.images?.[0] || job.image_url || ''}) center/cover no-repeat, ${bgColors[i % 3]}`, position: 'relative' }}>
                              <div style={{ position: 'absolute', bottom: 8, left: 8, width: 26, height: 26, borderRadius: 5, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#333' }}>
                                {initials}
                              </div>
                            </div>
                            <div style={{ padding: '8px 10px 10px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{job.title}</div>
                              <div style={{ fontSize: 10, color: '#aaa', marginBottom: 5 }}>{job.company} · {job.location}</div>
                              <div style={{ fontSize: 10, color: '#bbb', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ textDecoration: 'line-through' }}>{userSalary}M</span>
                                <span>→</span>
                                <span style={{ color: '#111', fontWeight: 700 }}>{Math.round(job.salary_min / 1e6)}–{Math.round(job.salary_max / 1e6)}M</span>
                                {bump > 0 && <span style={{ background: '#fff4f0', color: '#ff4400', fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontSize: 9 }}>+{bump}%</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: 20 }}>🔒</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Sign in to see & apply</span>
                    </div>
                    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 60, background: 'linear-gradient(to right, transparent, #fff)', pointerEvents: 'none' }} />
                  </div>
                )}

                <button onClick={() => router.push('/jobs')}
                  style={{ width: '100%', padding: 13, background: '#0080FF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", boxShadow: '0 4px 16px rgba(0,128,255,0.25)', marginBottom: 8 }}>
                  See all jobs →
                </button>
                <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center' }}>🔒 No spam. We only reach out when it's worth your time.</div>
              </div>
            )}

            {/* Opt 3: Browse freely */}
            {selected === 'none' && (
              <div>
                <button onClick={() => setVisible(false)}
                  style={{ width: '100%', padding: 13, background: '#111', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: 8 }}>
                  Browse salary data →
                </button>
                <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center' }}>No sign-up needed. Explore all company salaries freely.</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
