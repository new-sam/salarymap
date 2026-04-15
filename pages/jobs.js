import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=400&fit=crop',
]
const FILTER_MAP = {
  all: { label: 'All' },
  remote: { label: 'Remote' },
  korea: { label: 'Korean company' },
  vietnam: { label: 'Vietnam local' },
  global: { label: 'Global' },
}

export default function JobsPage() {
  const router = useRouter()
  const fileRef = useRef(null)

  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('all')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [userSalary, setUserSalary] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userExperience, setUserExperience] = useState(null)
  const [userCompany, setUserCompany] = useState(null)

  // Apply panel
  const [showPanel, setShowPanel] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)

  // Load state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSubmitted(localStorage.getItem('fyi_submitted') === 'true')
      const sal = parseInt(localStorage.getItem('fyi_salary'))
      if (sal) setUserSalary(sal * 1000000)
      setUserRole(localStorage.getItem('fyi_role'))
      setUserExperience(localStorage.getItem('fyi_exp'))
      setUserCompany(localStorage.getItem('fyi_company'))
    }
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        setIsLoggedIn(true); setSession(s); setUser(s.user)
        try {
          const res = await fetch(`/api/admin/check?email=${encodeURIComponent(s.user.email)}`)
          const { isAdmin } = await res.json()
          setIsAdminUser(isAdmin)
        } catch {}
      }
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(setJobs).catch(() => {})
  }, [])

  const getBump = (job) => {
    if (!userSalary || !job.salary_min) return null
    return Math.round(((job.salary_min - userSalary) / userSalary) * 100)
  }

  const filteredJobs = jobs
    .filter(job => {
      if (filter === 'all') return true
      if (filter === 'remote') return job.type === 'remote'
      return job.country === filter
    })
    .filter(job => {
      if (!isSubmitted || !userSalary) return true
      return job.salary_min > userSalary
    })

  const handleApply = async () => {
    if (!selectedJob || !session) return
    setApplying(true)
    let resumeUrl = null
    if (resumeFile) {
      const path = `${session.user.id}/${Date.now()}_${resumeFile.name}`
      await supabase.storage.from('resumes').upload(path, resumeFile)
      const { data } = supabase.storage.from('resumes').getPublicUrl(path)
      resumeUrl = data.publicUrl
    }
    await fetch('/api/job-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: selectedJob.id,
        userId: session.user.id,
        resumeUrl,
        applicantRole: userRole,
        applicantExperience: userExperience,
        applicantSalary: userSalary,
        applicantCompany: userCompany,
        applicantEmail: session.user.email,
        applicantName: session.user.user_metadata?.full_name || '',
      }),
    })
    setApplying(false)
    setApplied(true)
  }

  const openApply = (job) => {
    setSelectedJob(job)
    setShowPanel(true)
    setApplied(false)
    setResumeFile(null)
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f5', fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ fontSize: 14, color: '#aaa' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <Head>
        <title>Jobs — FYI Salary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }

        .jn { position: sticky; top: 0; z-index: 100; height: 56px; background: #fff; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; }
        .jn-l { display: flex; align-items: center; gap: 28px; }
        .jn-logo { font-size: 18px; font-weight: 800; color: #ff4400; text-decoration: none; }
        .jn-tabs { display: flex; }
        .jn-tab { font-size: 14px; color: #aaa; padding: 0 16px; height: 56px; display: flex; align-items: center; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; text-decoration: none; transition: color .15s; }
        .jn-tab:hover { color: #555; }
        .jn-tab.on { color: #111; font-weight: 600; border-bottom-color: #ff4400; }
        .jn-r { display: flex; align-items: center; gap: 10px; }
        .jn-login { font-size: 13px; font-weight: 600; color: #666; background: none; border: 1px solid #ddd; padding: 6px 16px; border-radius: 6px; cursor: pointer; }
        .jn-submit { font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 7px 16px; border-radius: 6px; cursor: pointer; }
        .jn-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ff4400; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; }
        .jn-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .jn-menu { position: absolute; top: calc(100% + 8px); right: 0; background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 6px; min-width: 180px; z-index: 500; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jn-menu-email { padding: 10px 14px; font-size: 12px; color: #aaa; border-bottom: 1px solid #f0f0f0; margin-bottom: 4px; }
        .jn-menu-item { display: block; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; background: none; color: #333; font-size: 13px; cursor: pointer; text-align: left; text-decoration: none; transition: background .1s; font-family: inherit; }
        .jn-menu-item:hover { background: #f5f5f5; }

        .jw { max-width: 1080px; margin: 0 auto; padding: 36px 40px 80px; }
        .jw-eye { font-size: 11px; font-weight: 700; color: #ff4400; letter-spacing: .08em; margin-bottom: 8px; }
        .jw-h1 { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; letter-spacing: -0.3px; }
        .jw-sub { font-size: 14px; color: #aaa; margin-bottom: 20px; }

        .jbm { display: inline-flex; align-items: center; gap: 7px; background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 20px; padding: 6px 14px; font-size: 13px; color: #555; margin-bottom: 20px; flex-wrap: wrap; }
        .jbm-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4400; flex-shrink: 0; }

        .jf { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .jf-pill { font-size: 13px; font-weight: 600; color: #666; background: #fff; border: 1px solid #e0e0e0; padding: 7px 16px; border-radius: 20px; cursor: pointer; transition: all .15s; }
        .jf-pill:hover { border-color: #bbb; color: #333; }
        .jf-pill.on { background: #111; color: #fff; border-color: #111; }

        .jf-count { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 16px; }

        .jg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

        /* Card */
        .jc { cursor: pointer; }
        .jc-img { border-radius: 8px; overflow: hidden; position: relative; padding-top: 62%; margin-bottom: 11px; }
        .jc-img-in { position: absolute; inset: 0; transition: transform .25s ease; }
        .jc:hover .jc-img-in { transform: scale(1.04); }
        .jc-bump { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.62); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 4px; z-index: 2; }
        .jc-bump b { color: #ff4400; font-weight: 700; }
        .jc-bm { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.92); display: flex; align-items: center; justify-content: center; z-index: 2; border: none; cursor: pointer; }
        .jc-ini { position: absolute; bottom: 10px; left: 10px; width: 34px; height: 34px; border-radius: 6px; background: #fff; border: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #333; z-index: 2; }
        .jc-t { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .jc-co { font-size: 13px; color: #888; margin-bottom: 4px; }
        .jc-m { font-size: 12px; color: #bbb; }
        .jc-m b { color: #ff4400; font-weight: 700; }
        .jc-nudge { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .jc-nudge-t { font-size: 12px; color: #888; }
        .jc-nudge-b { font-size: 12px; color: #ff4400; font-weight: 700; background: none; border: none; cursor: pointer; white-space: nowrap; }
        .jc-apply { width: 100%; padding: 9px; background: #111; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: background .15s; }
        .jc-apply:hover { background: #333; }

        /* Empty slot */
        .jc-empty { border-radius: 8px; padding-top: 62%; position: relative; background: #fafafa; border: 1.5px dashed #e5e5e5; margin-bottom: 11px; }
        .jc-empty-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
        .jc-empty-t { font-size: 12px; color: #bbb; }
        .jc-empty-b { padding: 6px 14px; background: #ff4400; border: none; border-radius: 5px; font-size: 12px; font-weight: 700; color: #fff; cursor: pointer; }

        /* Gate */
        .jgate { position: relative; min-height: 420px; }
        .jgate-blur { filter: blur(7px); pointer-events: none; user-select: none; }
        .jgate-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; border: 1px solid #eee; border-radius: 16px; padding: 56px 40px; text-align: center; z-index: 2; max-width: 440px; width: 90%; box-shadow: 0 8px 40px rgba(0,0,0,0.06); }
        .jgate-icon { font-size: 32px; margin-bottom: 16px; }
        .jgate-h { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 8px; }
        .jgate-p { font-size: 14px; color: #888; line-height: 1.7; margin-bottom: 24px; white-space: pre-line; }
        .jgate-btn { font-size: 14px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 13px 28px; border-radius: 8px; cursor: pointer; transition: background .15s; }
        .jgate-btn:hover { background: #e63d00; }

        /* Apply panel */
        .ap-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; }
        .ap { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 560px; background: #fff; border-radius: 20px 20px 0 0; z-index: 51; padding: 24px 28px 40px; max-height: 85vh; overflow-y: auto; animation: apUp .3s ease; }
        @keyframes apUp { from { transform: translate(-50%,100%); } to { transform: translate(-50%,0); } }
        .ap-bar { width: 36px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 0 auto 20px; }
        .ap-x { position: absolute; top: 16px; right: 20px; font-size: 20px; color: #aaa; cursor: pointer; background: none; border: none; line-height: 1; }
        .ap-h { font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .ap-sub { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
        .ap-job { background: #f7f7f7; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .ap-job-ini { width: 36px; height: 36px; border-radius: 6px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #555; flex-shrink: 0; }
        .ap-job-t { font-size: 14px; font-weight: 600; color: #111; }
        .ap-job-s { font-size: 12px; color: #ff4400; font-weight: 600; }
        .ap-lbl { font-size: 10px; font-weight: 700; color: #aaa; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }
        .ap-tags { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .ap-tag { background: #f0fff4; border: 1px solid #86efac; border-radius: 6px; padding: 8px 12px; font-size: 13px; color: #166534; }
        .ap-up { border: 1.5px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 20px; transition: border-color .15s; }
        .ap-up:hover { border-color: #bbb; }
        .ap-up-t { font-size: 13px; color: #aaa; }
        .ap-up-h { font-size: 11px; color: #ccc; margin-top: 4px; }
        .ap-up-f { font-size: 13px; color: #111; font-weight: 600; }
        .ap-btn { width: 100%; padding: 12px; font-size: 14px; font-weight: 700; color: #fff; background: #ff4400; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: opacity .15s; }
        .ap-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ap-skip { width: 100%; padding: 8px; font-size: 13px; color: #aaa; background: none; border: none; cursor: pointer; }
        .ap-ok { text-align: center; padding: 40px 0; }
        .ap-ok-i { font-size: 40px; color: #22c55e; margin-bottom: 12px; }
        .ap-ok-h { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .ap-ok-p { font-size: 14px; color: #888; line-height: 1.5; }

        @media (max-width: 900px) { .jg { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) {
          .jn { padding: 0 16px; height: 48px; }
          .jn-l { gap: 16px; }
          .jn-tab { font-size: 13px; height: 48px; padding: 0 12px; }
          .jw { padding: 28px 16px 60px; }
          .jw-h1 { font-size: 20px; }
          .jg { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .jbm { font-size: 12px; padding: 5px 12px; }
          .jgate-box { padding: 36px 24px; }
          .ap { padding: 20px 20px 32px; }
        }
        @media (max-width: 480px) {
          .jg { grid-template-columns: 1fr; max-width: 400px; }
          .jn-r .jn-submit { display: none; }
          .jn-tab { font-size: 12px; padding: 0 8px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="jn">
        <div className="jn-l">
          <Link href="/" className="jn-logo">FYI</Link>
          <div className="jn-tabs">
            <Link href="/" className="jn-tab">Salaries</Link>
            <Link href="/jobs" className="jn-tab on">Jobs</Link>
          </div>
        </div>
        <div className="jn-r">
          {!isLoggedIn ? (
            <>
              <button className="jn-login" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })}>Log in</button>
              <button className="jn-submit" onClick={() => router.push('/#submit')}>Submit Salary</button>
            </>
          ) : (
            <div style={{ position: 'relative' }}>
              <div className="jn-avatar" onClick={() => setShowUserMenu(v => !v)}>
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="" />
                  : (user?.email || 'U')[0].toUpperCase()
                }
              </div>
              {showUserMenu && (
                <div className="jn-menu">
                  <div className="jn-menu-email">{user?.email}</div>
                  {isAdminUser && (
                    <a href="/admin/jobs" className="jn-menu-item">Admin Dashboard</a>
                  )}
                  <button className="jn-menu-item" onClick={async () => {
                    await supabase.auth.signOut()
                    setIsLoggedIn(false); setUser(null); setShowUserMenu(false)
                  }}>Sign out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="jw">
        {/* HEADER */}
        <div className="jw-eye">JOBS CURATED FOR YOU</div>
        <div className="jw-h1">Only jobs that pay more than you make now.</div>
        <div className="jw-sub">No job boards. No spam. Real offers, real numbers.</div>

        {/* STATE A — not submitted */}
        {!isSubmitted ? (
          <div className="jgate">
            <div className="jgate-blur">
              <div className="jg">
                {[0,1,2,3].map(i => (
                  <div key={i} className="jc">
                    <div className="jc-img"><div className="jc-img-in" style={{ background: `url(${DEFAULT_IMAGES[i % 3]}) center/cover no-repeat` }} /></div>
                    <div style={{ background: '#eee', height: 14, borderRadius: 4, width: '75%', marginBottom: 6 }} />
                    <div style={{ background: '#f0f0f0', height: 11, borderRadius: 4, width: '50%', marginBottom: 5 }} />
                    <div style={{ background: '#f5f5f5', height: 10, borderRadius: 4, width: '65%' }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="jgate-box">
              <div className="jgate-icon">🔒</div>
              <div className="jgate-h">Unlock jobs matched for you</div>
              <div className="jgate-p">{"Submit your salary — takes 2 minutes.\nWe'll show every job that pays more than what you make right now."}</div>
              <button className="jgate-btn" onClick={() => router.push('/#submit')}>Submit my salary → unlock jobs</button>
            </div>
          </div>
        ) : (
          <>
            {/* STATE B & C — submitted */}
            {userSalary && (
              <div className="jbm">
                <span className="jbm-dot" />
                Your benchmark: {Math.round(userSalary / 1000000)}M VND · {userRole || '—'} · {userExperience || '—'} · {userCompany || '—'} · All jobs below pay more
              </div>
            )}

            {/* Filters */}
            <div className="jf">
              {Object.entries(FILTER_MAP).map(([key, { label }]) => (
                <button key={key} className={`jf-pill${filter === key ? ' on' : ''}`} onClick={() => setFilter(key)}>{label}</button>
              ))}
            </div>

            <div className="jf-count">{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} matched for you</div>

            {/* Grid */}
            <div className="jg">
              {filteredJobs.map((job, idx) => {
                const bump = getBump(job)
                return (
                  <div key={job.id} className="jc">
                    <div className="jc-img">
                      <div className="jc-img-in" style={{
                        background: `url(${job.image_url || DEFAULT_IMAGES[idx % 3]}) center/cover no-repeat`,
                      }}>
                        {bump !== null && bump > 0 && (
                          <div className="jc-bump">↑ <b>+{bump}%</b> vs your salary</div>
                        )}
                        <button className="jc-bm" aria-label="Bookmark">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                          </svg>
                        </button>
                        <div className="jc-ini">{job.company_initials || job.company.slice(0,2).toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="jc-t">{job.title}</div>
                    <div className="jc-co">{job.company}</div>
                    <div className="jc-m">
                      {job.location} · {job.type} · <b>{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M VND</b>
                    </div>

                    {/* STATE B: login nudge */}
                    {!isLoggedIn ? (
                      <div className="jc-nudge">
                        <span className="jc-nudge-t">Log in to apply</span>
                        <button className="jc-nudge-b" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })}>
                          Continue with Google →
                        </button>
                      </div>
                    ) : (
                      /* STATE C: apply button */
                      <button className="jc-apply" onClick={() => openApply(job)}>Apply now →</button>
                    )}
                  </div>
                )
              })}

            </div>
          </>
        )}
      </div>

      {/* APPLY PANEL — STATE C */}
      {showPanel && selectedJob && isLoggedIn && (
        <>
          <div className="ap-bg" onClick={() => setShowPanel(false)} />
          <div className="ap">
            <div className="ap-bar" />
            <button className="ap-x" onClick={() => setShowPanel(false)}>×</button>

            {!applied ? (
              <>
                <div className="ap-h">Apply for this role</div>
                <div className="ap-sub">Our team reviews every application and reaches out within 2 business days.</div>

                <div className="ap-job">
                  <div className="ap-job-ini">{selectedJob.company_initials || selectedJob.company.slice(0,2).toUpperCase()}</div>
                  <div>
                    <div className="ap-job-t">{selectedJob.title} — {selectedJob.company}</div>
                    <div className="ap-job-s">{Math.round(selectedJob.salary_min/1e6)}M–{Math.round(selectedJob.salary_max/1e6)}M VND</div>
                  </div>
                </div>

                <div className="ap-lbl">YOUR PROFILE · auto-filled</div>
                <div className="ap-tags">
                  {userRole && <div className="ap-tag">{userRole} · {userExperience || '—'} yrs</div>}
                  {userCompany && <div className="ap-tag">Current: {userCompany} · {userSalary ? Math.round(userSalary/1e6) : '—'}M VND</div>}
                </div>

                <div className="ap-lbl">RESUME (optional)</div>
                <div className="ap-up" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && f.size <= 5 * 1024 * 1024) setResumeFile(f)
                    else if (f) alert('Max 5MB')
                  }} />
                  {resumeFile
                    ? <div className="ap-up-f">{resumeFile.name}</div>
                    : <><div className="ap-up-t">Drop CV here or browse</div><div className="ap-up-h">PDF / DOCX · max 5MB</div></>
                  }
                </div>

                <button className="ap-btn" onClick={handleApply} disabled={applying}>
                  {applying ? 'Sending...' : 'Send application →'}
                </button>
                <button className="ap-skip" onClick={() => { setResumeFile(null); handleApply() }}>Apply without CV</button>
              </>
            ) : (
              <div className="ap-ok">
                <div className="ap-ok-i">✓</div>
                <div className="ap-ok-h">Application sent!</div>
                <div className="ap-ok-p">Our team will reach out within 2 business days.</div>
                <button className="ap-skip" style={{ marginTop: 20 }} onClick={() => setShowPanel(false)}>Close</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
