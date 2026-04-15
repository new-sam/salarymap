import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('All')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [userSalary, setUserSalary] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userExperience, setUserExperience] = useState(null)
  const [userCompany, setUserCompany] = useState(null)
  const [applyJob, setApplyJob] = useState(null)
  const [applyStep, setApplyStep] = useState('form') // form | uploading | success
  const [resumeUrl, setResumeUrl] = useState(null)
  const [resumeName, setResumeName] = useState(null)
  const fileRef = useRef(null)

  // Load user state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSubmitted(localStorage.getItem('fyi_submitted') === 'true')
      const sal = parseInt(localStorage.getItem('fyi_salary'))
      if (sal) setUserSalary(sal * 1000000) // stored as M, convert to raw
      setUserRole(localStorage.getItem('fyi_role'))
      setUserExperience(localStorage.getItem('fyi_exp'))
      setUserCompany(localStorage.getItem('fyi_company'))
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true)
        setUser(session.user)
      }
    })
  }, [])

  // Fetch jobs
  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(setJobs).catch(() => {})
  }, [])

  const filters = ['All', 'Remote', 'Korean company', 'Vietnam local', 'Global']

  const filteredJobs = jobs.filter(job => {
    if (filter === 'All') return true
    if (filter === 'Remote') return job.type === 'remote'
    if (filter === 'Korean company') return job.country === 'korea'
    if (filter === 'Vietnam local') return job.country === 'vietnam'
    if (filter === 'Global') return job.country === 'global'
    return true
  }).filter(job => {
    if (!isSubmitted || !userSalary) return true
    return job.salary_min > userSalary
  })

  const getBumpPct = (job) => {
    if (!userSalary || !isSubmitted) return null
    return Math.round(((job.salary_min - userSalary) / userSalary) * 100)
  }

  const handleApply = async () => {
    if (!applyJob || !user) return
    setApplyStep('uploading')
    try {
      await fetch('/api/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: applyJob.id, userId: user.id, resumeUrl }),
      })
      setApplyStep('success')
    } catch {
      setApplyStep('form')
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return }
    setResumeName(file.name)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('resumes').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('resumes').getPublicUrl(path)
      setResumeUrl(data.publicUrl)
    }
  }

  return (
    <>
      <Head>
        <title>Jobs — FYI Salary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }

        .jobs-nav { position: sticky; top: 0; z-index: 100; height: 56px; background: #fff; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; }
        .jobs-nav-left { display: flex; align-items: center; gap: 28px; }
        .jobs-logo { font-size: 20px; font-weight: 900; color: #ff4400; letter-spacing: -0.5px; cursor: pointer; text-decoration: none; }
        .jobs-tabs { display: flex; gap: 0; }
        .jobs-tab { font-size: 14px; font-weight: 600; color: #aaa; padding: 18px 14px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s; text-decoration: none; display: block; }
        .jobs-tab:hover { color: #333; }
        .jobs-tab.active { color: #111; border-bottom-color: #ff4400; }
        .jobs-nav-right { display: flex; align-items: center; gap: 10px; }
        .jobs-nav-login { font-size: 13px; font-weight: 600; color: #666; background: none; border: 1px solid #ddd; padding: 6px 16px; border-radius: 6px; cursor: pointer; }
        .jobs-nav-submit { font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 7px 16px; border-radius: 6px; cursor: pointer; }
        .jobs-nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ff4400; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; cursor: pointer; overflow: hidden; }
        .jobs-nav-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .jobs-header { padding: 36px 40px 0; max-width: 1080px; margin: 0 auto; }
        .jobs-eyebrow { font-size: 11px; color: #ff4400; letter-spacing: .08em; font-weight: 700; margin-bottom: 8px; }
        .jobs-title { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; letter-spacing: -0.3px; }
        .jobs-sub { font-size: 14px; color: #aaa; margin-bottom: 20px; }

        .jobs-benchmark { display: inline-flex; align-items: center; gap: 7px; background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 20px; padding: 6px 14px; font-size: 13px; color: #555; margin-bottom: 20px; flex-wrap: wrap; }
        .jobs-benchmark-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4400; flex-shrink: 0; }

        .jobs-filters { display: flex; gap: 8px; max-width: 1080px; margin: 0 auto; padding: 0 40px 24px; flex-wrap: wrap; }
        .jobs-pill { font-size: 13px; font-weight: 600; color: #888; background: #fff; border: 1px solid #eee; padding: 7px 16px; border-radius: 20px; cursor: pointer; transition: all .15s; }
        .jobs-pill:hover { border-color: #ccc; color: #555; }
        .jobs-pill.active { background: #111; color: #fff; border-color: #111; }

        .jobs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1080px; margin: 0 auto; padding: 0 40px 60px; }

        .job-card { cursor: pointer; }
        .job-card-img { border-radius: 8px; overflow: hidden; padding-top: 62%; position: relative; background: #f0f0f0; margin-bottom: 11px; }
        .job-card-img-inner { position: absolute; inset: 0; transition: transform .25s; }
        .job-card:hover .job-card-img-inner { transform: scale(1.04); }
        .job-card-bump { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; padding: 4px 9px; border-radius: 4px; z-index: 2; }
        .job-card-bump-pct { color: #ff4400; font-weight: 700; }
        .job-card-bookmark { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.92); display: flex; align-items: center; justify-content: center; z-index: 2; cursor: pointer; border: none; }
        .job-card-initials { position: absolute; bottom: 10px; left: 10px; width: 34px; height: 34px; border-radius: 6px; background: #fff; border: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #333; z-index: 2; }
        .job-card-title { font-size: 15px; font-weight: 600; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
        .job-card-company { font-size: 13px; color: #888; margin-bottom: 3px; }
        .job-card-meta { font-size: 12px; color: #bbb; }
        .job-card-salary { color: #ff4400; font-weight: 700; }
        .job-card-login-nudge { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .job-card-login-text { font-size: 12px; color: #888; }
        .job-card-login-btn { font-size: 12px; color: #ff4400; font-weight: 700; background: none; border: none; cursor: pointer; white-space: nowrap; }
        .job-card-apply-btn { width: 100%; padding: 8px; font-size: 12px; font-weight: 600; color: #fff; background: #111; border: none; border-radius: 6px; cursor: pointer; margin-top: 8px; transition: background .15s; }
        .job-card-apply-btn:hover { background: #333; }

        .job-empty-slot { border: 1.5px dashed #e0e0e0; border-radius: 8px; padding-top: 62%; position: relative; margin-bottom: 11px; }
        .job-empty-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
        .job-empty-text { font-size: 12px; color: #bbb; }
        .job-empty-btn { font-size: 12px; color: #ff4400; font-weight: 700; background: none; border: none; cursor: pointer; }

        .jobs-gate { position: relative; }
        .jobs-gate-blur { filter: blur(6px); pointer-events: none; user-select: none; }
        .jobs-gate-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; border: 1px solid #eee; border-radius: 16px; padding: 56px 40px; text-align: center; z-index: 10; max-width: 440px; width: 90%; }
        .jobs-gate-icon { font-size: 32px; margin-bottom: 12px; }
        .jobs-gate-title { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 8px; }
        .jobs-gate-sub { font-size: 14px; color: #888; line-height: 1.6; margin-bottom: 24px; white-space: pre-line; }
        .jobs-gate-btn { font-size: 14px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 12px 28px; border-radius: 8px; cursor: pointer; }

        /* Apply panel */
        .apply-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; }
        .apply-panel { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 560px; background: #fff; border-radius: 20px 20px 0 0; z-index: 201; padding: 20px 28px 32px; max-height: 85vh; overflow-y: auto; animation: slideUp .3s ease; }
        @keyframes slideUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }
        .apply-handle { width: 36px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 0 auto 20px; }
        .apply-title { font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .apply-sub { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
        .apply-job-box { background: #f7f7f7; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .apply-job-initials { width: 36px; height: 36px; border-radius: 6px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #555; flex-shrink: 0; }
        .apply-job-info { flex: 1; }
        .apply-job-title { font-size: 14px; font-weight: 600; color: #111; }
        .apply-job-salary { font-size: 12px; color: #ff4400; font-weight: 600; }
        .apply-label { font-size: 10px; font-weight: 700; color: #aaa; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }
        .apply-profile-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .apply-profile-tag { background: #f0fff4; border: 1px solid #86efac; border-radius: 6px; padding: 8px 12px; font-size: 13px; color: #166534; }
        .apply-upload { border: 1.5px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 20px; transition: border-color .15s; }
        .apply-upload:hover { border-color: #bbb; }
        .apply-upload-text { font-size: 13px; color: #aaa; }
        .apply-upload-hint { font-size: 11px; color: #ccc; margin-top: 4px; }
        .apply-upload-file { font-size: 13px; color: #111; font-weight: 600; }
        .apply-submit-btn { width: 100%; padding: 12px; font-size: 14px; font-weight: 700; color: #fff; background: #ff4400; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 8px; }
        .apply-skip-btn { width: 100%; padding: 8px; font-size: 13px; color: #aaa; background: none; border: none; cursor: pointer; }
        .apply-success { text-align: center; padding: 24px 0; }
        .apply-success-icon { font-size: 48px; margin-bottom: 12px; }
        .apply-success-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .apply-success-sub { font-size: 14px; color: #888; line-height: 1.5; }

        @media (max-width: 900px) {
          .jobs-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .jobs-nav { padding: 0 16px; height: 48px; }
          .jobs-nav-left { gap: 16px; }
          .jobs-logo { font-size: 18px; }
          .jobs-tab { font-size: 13px; padding: 14px 10px; }
          .jobs-header { padding: 28px 16px 0; }
          .jobs-title { font-size: 20px; }
          .jobs-filters { padding: 0 16px 20px; }
          .jobs-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 0 16px 40px; }
          .jobs-benchmark { font-size: 12px; padding: 5px 12px; }
          .jobs-gate-box { padding: 36px 24px; }
          .apply-panel { padding: 16px 20px 28px; }
        }
        @media (max-width: 480px) {
          .jobs-grid { grid-template-columns: 1fr; gap: 16px; max-width: 400px; }
          .jobs-nav-right .jobs-nav-submit { display: none; }
          .jobs-tab { font-size: 12px; padding: 14px 8px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="jobs-nav">
        <div className="jobs-nav-left">
          <Link href="/" className="jobs-logo">FYI</Link>
          <div className="jobs-tabs">
            <Link href="/" className="jobs-tab">Salaries</Link>
            <Link href="/jobs" className="jobs-tab active">Jobs</Link>
          </div>
        </div>
        <div className="jobs-nav-right">
          {!isLoggedIn ? (
            <>
              <button className="jobs-nav-login" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })}>Log in</button>
              <button className="jobs-nav-submit" onClick={() => router.push('/#submit')}>Submit Salary</button>
            </>
          ) : (
            <div className="jobs-nav-avatar">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" />
              ) : (
                (user?.email || 'U')[0].toUpperCase()
              )}
            </div>
          )}
        </div>
      </nav>

      {/* HEADER */}
      <div className="jobs-header">
        <div className="jobs-eyebrow">JOBS CURATED FOR YOU</div>
        <div className="jobs-title">Only jobs that pay more than you make now.</div>
        <div className="jobs-sub">No job boards. No spam. Real offers, real numbers.</div>

        {isSubmitted && userSalary && (
          <div className="jobs-benchmark">
            <span className="jobs-benchmark-dot" />
            Your benchmark: {Math.round(userSalary / 1000000)}M VND · {userRole || '—'} · {userExperience || '—'} · {userCompany || '—'} · All jobs below pay more
          </div>
        )}
      </div>

      {/* FILTERS */}
      <div className="jobs-filters">
        {filters.map(f => (
          <button key={f} className={`jobs-pill${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {/* STATE A: Not submitted — gate */}
      {!isSubmitted ? (
        <div className="jobs-gate" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 40px 60px', position: 'relative', minHeight: 400 }}>
          <div className="jobs-gate-box">
            <div className="jobs-gate-icon">🔒</div>
            <div className="jobs-gate-title">Unlock jobs matched for you</div>
            <div className="jobs-gate-sub">{"Submit your salary — takes 2 minutes.\nWe'll show every job that pays more than you make right now."}</div>
            <button className="jobs-gate-btn" onClick={() => router.push('/#submit')}>Submit my salary → unlock jobs</button>
          </div>
          <div className="jobs-gate-blur">
            <div className="jobs-grid" style={{ padding: 0 }}>
              {[1,2,3,4].map(i => (
                <div key={i} className="job-card">
                  <div className="job-card-img"><div className="job-card-img-inner" style={{ background: '#eee' }} /></div>
                  <div className="job-card-title" style={{ background: '#eee', height: 16, borderRadius: 4, width: '80%' }} />
                  <div style={{ background: '#f0f0f0', height: 12, borderRadius: 4, width: '50%', marginTop: 6 }} />
                  <div style={{ background: '#f5f5f5', height: 10, borderRadius: 4, width: '70%', marginTop: 6 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* STATE B & C: Submitted */
        <div className="jobs-grid">
          {filteredJobs.map(job => {
            const pct = getBumpPct(job)
            return (
              <div key={job.id} className="job-card">
                {/* Image area */}
                <div className="job-card-img">
                  <div className="job-card-img-inner" style={{ background: '#e8e8e6' }} />
                  {pct !== null && pct > 0 && (
                    <div className="job-card-bump">
                      ↑ <span className="job-card-bump-pct">+{pct}%</span> vs your salary
                    </div>
                  )}
                  <button className="job-card-bookmark" aria-label="Bookmark">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                    </svg>
                  </button>
                  <div className="job-card-initials">{job.company_initials || job.company.slice(0,2).toUpperCase()}</div>
                </div>

                {/* Info */}
                <div className="job-card-title">{job.title}</div>
                <div className="job-card-company">{job.company}</div>
                <div className="job-card-meta">
                  {job.location} · {job.type} · <span className="job-card-salary">{Math.round(job.salary_min/1000000)}M–{Math.round(job.salary_max/1000000)}M VND</span>
                </div>

                {/* Apply area */}
                {!isLoggedIn ? (
                  <div className="job-card-login-nudge">
                    <span className="job-card-login-text">Log in to apply</span>
                    <button className="job-card-login-btn" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })}>
                      Continue with Google →
                    </button>
                  </div>
                ) : (
                  <button className="job-card-apply-btn" onClick={() => { setApplyJob(job); setApplyStep('form'); setResumeUrl(null); setResumeName(null); }}>
                    Apply now →
                  </button>
                )}
              </div>
            )
          })}

          {/* Empty slot */}
          <div className="job-card">
            <div className="job-empty-slot">
              <div className="job-empty-content">
                <span className="job-empty-text">More roles being curated</span>
                <button className="job-empty-btn">Notify me →</button>
              </div>
            </div>
            <div className="job-card-title" style={{ color: '#ccc' }}>Coming soon</div>
            <div className="job-card-company" style={{ color: '#ddd' }}>We're reviewing new companies</div>
          </div>
        </div>
      )}

      {/* APPLY PANEL (STATE C) */}
      {applyJob && isLoggedIn && (
        <>
          <div className="apply-backdrop" onClick={() => setApplyJob(null)} />
          <div className="apply-panel">
            <div className="apply-handle" />

            {applyStep !== 'success' ? (
              <>
                <div className="apply-title">Apply for this role</div>
                <div className="apply-sub">Our team reviews every application and reaches out within 2 business days.</div>

                {/* Job summary */}
                <div className="apply-job-box">
                  <div className="apply-job-initials">{applyJob.company_initials || applyJob.company.slice(0,2).toUpperCase()}</div>
                  <div className="apply-job-info">
                    <div className="apply-job-title">{applyJob.title} — {applyJob.company}</div>
                    <div className="apply-job-salary">{Math.round(applyJob.salary_min/1000000)}M–{Math.round(applyJob.salary_max/1000000)}M VND</div>
                  </div>
                </div>

                {/* Profile */}
                <div className="apply-label">YOUR PROFILE · auto-filled</div>
                <div className="apply-profile-row">
                  {userRole && <div className="apply-profile-tag">{userRole} · {userExperience || '—'} experience</div>}
                  {userCompany && <div className="apply-profile-tag">Current: {userCompany} · {userSalary ? Math.round(userSalary/1000000) : '—'}M VND</div>}
                </div>

                {/* Resume */}
                <div className="apply-label">RESUME (optional)</div>
                <div className="apply-upload" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={handleFileUpload} />
                  {resumeName ? (
                    <div className="apply-upload-file">{resumeName}</div>
                  ) : (
                    <>
                      <div className="apply-upload-text">Drop CV here or browse</div>
                      <div className="apply-upload-hint">PDF / DOCX · max 5MB</div>
                    </>
                  )}
                </div>

                <button className="apply-submit-btn" onClick={handleApply} disabled={applyStep === 'uploading'}>
                  {applyStep === 'uploading' ? 'Sending...' : 'Send application →'}
                </button>
                <button className="apply-skip-btn" onClick={handleApply}>Apply without CV</button>
              </>
            ) : (
              <div className="apply-success">
                <div className="apply-success-icon">✓</div>
                <div className="apply-success-title">Application sent!</div>
                <div className="apply-success-sub">We'll reach out within 2 business days.</div>
                <button className="apply-skip-btn" style={{ marginTop: 20 }} onClick={() => setApplyJob(null)}>Close</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
