import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=400&fit=crop',
]
const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Frontend', label: 'Frontend' },
  { key: 'Backend', label: 'Backend' },
  { key: 'Fullstack', label: 'Full-Stack' },
  { key: 'Mobile', label: 'Mobile' },
  { key: 'Design', label: 'Design' },
  { key: 'PM', label: 'PM' },
]
const PERK_FILTERS = [
  { key: 'pays_more', label: 'Pays more' },
  { key: 'remote', label: 'Remote' },
  { key: 'korea', label: 'Korean company' },
  { key: 'vietnam', label: 'Vietnam local' },
  { key: 'global', label: 'Global' },
]

export default function JobsPage() {
  const router = useRouter()
  const fileRef = useRef(null)

  const [jobs, setJobs] = useState([])
  const [roleFilter, setRoleFilter] = useState('all')
  const [perkFilter, setPerkFilter] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [userSalary, setUserSalary] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userExperience, setUserExperience] = useState(null)
  const [userCompany, setUserCompany] = useState(null)

  // Detail & Apply panel
  const [detailJob, setDetailJob] = useState(null)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [bookmarks, setBookmarks] = useState([])

  // Load state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSubmitted(localStorage.getItem('fyi_submitted') === 'true')
      const sal = parseInt(localStorage.getItem('fyi_salary'))
      if (sal) setUserSalary(sal * 1000000)
      setUserRole(localStorage.getItem('fyi_role'))
      setUserExperience(localStorage.getItem('fyi_exp'))
      setUserCompany(localStorage.getItem('fyi_company'))
      try { setBookmarks(JSON.parse(localStorage.getItem('fyi_bookmarks') || '[]')) } catch {}
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
      if (roleFilter !== 'all' && job.role !== roleFilter) return false
      if (perkFilter === 'pays_more') return userSalary ? job.salary_min > userSalary : true
      if (perkFilter === 'remote') return job.type === 'remote'
      if (perkFilter === 'korea' || perkFilter === 'vietnam' || perkFilter === 'global') return job.country === perkFilter
      return true
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

  const toggleBookmark = (jobId) => {
    setBookmarks(prev => {
      const next = prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
      localStorage.setItem('fyi_bookmarks', JSON.stringify(next))
      return next
    })
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
        .jf-pill.outline { background: transparent; border: 1px solid #e0e0e0; font-weight: 500; }
        .jf-pill.outline.on { background: #fff7f5; color: #ff4400; border-color: #ff4400; font-weight: 600; }

        .jf-count { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 16px; }

        .jg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }

        /* Card */
        .jc { cursor: pointer; }
        .jc-img { border-radius: 8px; overflow: hidden; position: relative; padding-top: 62%; margin-bottom: 11px; background: #f0f0f0; }
        .jc-img-in { position: absolute; inset: 0; transition: transform .25s ease; background-color: #f0f0f0; background-size: cover; background-position: center; background-repeat: no-repeat; }
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

        /* Job Detail Panel */
        .jd-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 60; }
        .jd { position: fixed; top: 0; right: 0; width: 50%; height: 100vh; background: #fff; z-index: 61; overflow-y: auto; animation: jdSlide .3s ease; box-shadow: -8px 0 40px rgba(0,0,0,0.1); }
        @keyframes jdSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .jd-x { position: absolute; top: 16px; right: 20px; font-size: 24px; color: #aaa; cursor: pointer; background: none; border: none; z-index: 2; line-height: 1; }
        .jd-img { width: 100%; height: 280px; object-fit: cover; background: #f0f0f0; }
        .jd-body { padding: 28px 32px 40px; }
        .jd-company { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .jd-co-ini { width: 44px; height: 44px; border-radius: 10px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #555; flex-shrink: 0; }
        .jd-co-name { font-size: 15px; font-weight: 600; color: #111; }
        .jd-co-loc { font-size: 13px; color: #888; }
        .jd-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px; letter-spacing: -0.3px; }
        .jd-salary { font-size: 16px; font-weight: 700; color: #ff4400; margin-bottom: 24px; }
        .jd-divider { height: 1px; background: #f0f0f0; margin: 24px 0; }
        .jd-section-title { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
        .jd-desc { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; }
        .jd-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .jd-meta-item { background: #f9f9f8; border-radius: 8px; padding: 12px 14px; }
        .jd-meta-label { font-size: 10px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .jd-meta-value { font-size: 14px; font-weight: 600; color: #111; }
        .jd-apply-btn { width: 100%; padding: 14px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background .15s; }
        .jd-apply-btn:hover { background: #e63d00; }
        .jd-login-box { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 10px; padding: 16px 20px; text-align: center; margin-top: 8px; }
        .jd-login-text { font-size: 13px; color: #888; margin-bottom: 10px; }
        .jd-login-btn { background: #ff4400; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; }

        @media (max-width: 900px) { .jg { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) {
          .jn { padding: 0 16px; height: 48px; }
          .jn-l { gap: 16px; }
          .jn-tab { font-size: 13px; height: 48px; padding: 0 12px; }
          .jw { padding: 28px 16px 60px; }
          .jw-h1 { font-size: 20px; }
          .jg { grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .jbm { font-size: 12px; padding: 5px 12px; }
          .jgate-box { padding: 36px 24px; }
          .ap { padding: 20px 20px 32px; }
          .jd { width: 100%; }
          .jd-body { padding: 20px 16px 32px; }
          .jd-img { height: 200px; }
          .jd-title { font-size: 18px; }
        }
        @media (max-width: 480px) {
          .jg { grid-template-columns: 1fr; max-width: 400px; }
          .jn-r .jn-submit { display: none; }
          .jn-tab { font-size: 12px; padding: 0 8px; }
        }
      `}</style>

      <GlobalNav activePage="jobs" />

      <div className="jw">
        {/* HEADER */}
        <div className="jw-eye">JOBS CURATED FOR YOU</div>
        <div className="jw-h1">Better roles, higher pay — picked for you.</div>
        <div className="jw-sub">Opportunities matched to your profile. Our headhunter personally introduces you.</div>

        {/* STATE A — not submitted */}
        {(!isSubmitted || !isLoggedIn) ? (
          /* GATE: not submitted OR not logged in — unified blur + gate */
          <div className="jgate" style={{ minHeight: 500 }}>
            <div className="jgate-blur">
              <div className="jg">
                {(jobs.length ? jobs : [null,null,null,null]).slice(0, 4).map((job, i) => (
                  <div key={job?.id || i} className="jc">
                    <div className="jc-img"><div className="jc-img-in" style={{ background: `url(${job?.images?.[0] || job?.image_url || DEFAULT_IMAGES[i % 3]}) center/cover no-repeat` }} /></div>
                    <div className="jc-t" style={!job ? { background: '#e0e0e0', height: 14, borderRadius: 4, width: '70%' } : {}}>{job?.title || ''}</div>
                    <div className="jc-co" style={!job ? { background: '#eee', height: 11, borderRadius: 4, width: '45%', marginTop: 4 } : {}}>{job?.company || ''}</div>
                    {job ? (
                      <div className="jc-m">{job.location} · {job.type} · <b>{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M VND</b></div>
                    ) : (
                      <div style={{ background: '#f0f0f0', height: 10, borderRadius: 4, width: '60%', marginTop: 4 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="jgate-box" style={{ padding: 0, overflow: 'hidden', maxWidth: 420 }}>
              <div style={{
                background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
                padding: '32px 36px 28px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>
                  {jobs.length > 0 ? `${jobs.length} role${jobs.length !== 1 ? 's' : ''} available now` : 'Roles curated for you'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  {!isSubmitted
                    ? 'Submit your salary to see matched opportunities'
                    : 'Sign in to view details and get introduced'}
                </div>
              </div>
              <div style={{ padding: '24px 36px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!isSubmitted ? (
                  <button style={{
                    width: '100%', padding: '13px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: '#ff4400', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }} onClick={() => router.push('/#submit')}>
                    Submit my salary →
                  </button>
                ) : (
                  <>
                    <button style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      width: '100%', padding: '13px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      background: '#fff', color: '#333', border: '1px solid #ddd', cursor: 'pointer', fontFamily: 'inherit',
                    }} onClick={() => { localStorage.setItem('fyi_login_return','/jobs'); supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin+'/auth/callback' }}) }}>
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Continue with Google
                    </button>
                    <button style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      width: '100%', padding: '13px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      background: '#0A66C2', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }} onClick={() => { localStorage.setItem('fyi_login_return','/jobs'); supabase.auth.signInWithOAuth({ provider:'linkedin_oidc', options:{ redirectTo: window.location.origin+'/auth/callback', scopes:'openid profile email' }}) }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      Continue with LinkedIn
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* STATE C — submitted + logged in */}
            {userSalary && (
              <div className="jbm">
                <span className="jbm-dot" />
                Your benchmark: {Math.round(userSalary / 1000000)}M VND · {userRole || '—'} · {userExperience || '—'} · {userCompany || '—'} · All jobs below pay more
              </div>
            )}

            {/* Role filters */}
            <div className="jf">
              {ROLE_FILTERS.map(({ key, label }) => (
                <button key={key} className={`jf-pill${roleFilter === key ? ' on' : ''}`} onClick={() => setRoleFilter(key)}>{label}</button>
              ))}
            </div>
            {/* Perk filters */}
            <div className="jf">
              {PERK_FILTERS.map(({ key, label }) => (
                <button key={key} className={`jf-pill outline${perkFilter === key ? ' on' : ''}`} onClick={() => setPerkFilter(perkFilter === key ? null : key)}>{label}</button>
              ))}
            </div>

            <div className="jf-count">{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} matched for you</div>

            {/* Grid */}
            <div className="jg">
              {filteredJobs.map((job, idx) => {
                const bump = getBump(job)
                return (
                  <div key={job.id} className="jc">
                    <div className="jc-img" onClick={() => { setCarouselIdx(0); setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[idx % 3] }) }}>
                      <div className="jc-img-in" style={{
                        background: `url(${job.image_url || job.images?.[0] || DEFAULT_IMAGES[idx % 3]}) center/cover no-repeat`,
                      }}>
                        {bump !== null && bump > 0 && (
                          <div className="jc-bump">↑ <b>+{bump}%</b> vs your salary</div>
                        )}
                        <button className="jc-bm" aria-label="Bookmark" onClick={e => { e.stopPropagation(); toggleBookmark(job.id) }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarks.includes(job.id) ? '#ff4400' : 'none'} stroke={bookmarks.includes(job.id) ? '#ff4400' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <button className="jc-apply" onClick={() => openApply(job)}>Apply now →</button>
                  </div>
                )
              })}

            </div>
          </>
        )}
      </div>

      {/* JOB DETAIL PANEL */}
      {detailJob && (
        <>
          <div className="jd-bg" onClick={() => setDetailJob(null)} />
          <div className="jd">
            <button className="jd-x" onClick={() => setDetailJob(null)}>×</button>

            {/* Hero image / Carousel */}
            {(() => {
              const uploaded = detailJob.images?.length ? detailJob.images : []
              const fallback = detailJob.image_url || detailJob._imgFallback || DEFAULT_IMAGES[0]
              const uniqueImgs = uploaded.length ? uploaded : [fallback]
              return (
                <div style={{ position: 'relative' }}>
                  <div className="jd-img" style={{
                    background: `url(${uniqueImgs[carouselIdx % uniqueImgs.length]}) center/cover no-repeat`,
                  }} />
                  {uniqueImgs.length > 1 && (
                    <>
                      <button onClick={() => setCarouselIdx(i => (i - 1 + uniqueImgs.length) % uniqueImgs.length)} style={{
                        position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                        width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                        color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>‹</button>
                      <button onClick={() => setCarouselIdx(i => (i + 1) % uniqueImgs.length)} style={{
                        position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
                        width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                        color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>›</button>
                      <div style={{
                        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 6,
                      }}>
                        {uniqueImgs.map((_, i) => (
                          <div key={i} onClick={() => setCarouselIdx(i)} style={{
                            width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                            background: i === carouselIdx % uniqueImgs.length ? '#fff' : 'rgba(255,255,255,0.4)',
                          }} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            <div className="jd-body">
              {/* Company */}
              <div className="jd-company">
                <div className="jd-co-ini">{detailJob.company_initials || detailJob.company.slice(0,2).toUpperCase()}</div>
                <div>
                  <div className="jd-co-name">{detailJob.company}</div>
                  <div className="jd-co-loc">{detailJob.location} · {detailJob.type}</div>
                </div>
              </div>

              {/* Title & Salary */}
              <div className="jd-title">{detailJob.title}</div>
              <div className="jd-salary">{Math.round(detailJob.salary_min/1e6)}M – {Math.round(detailJob.salary_max/1e6)}M VND</div>

              {/* Meta grid */}
              <div className="jd-meta-grid">
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Experience</div>
                  <div className="jd-meta-value">{detailJob.experience_min}–{detailJob.experience_max} years</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Role</div>
                  <div className="jd-meta-value">{detailJob.role}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Work type</div>
                  <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{detailJob.type}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Region</div>
                  <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{detailJob.country}</div>
                </div>
              </div>

              <div className="jd-divider" />

              {/* Description */}
              <div className="jd-section-title">About this role</div>
              <div className="jd-desc">
                {detailJob.description || `${detailJob.company} is looking for a ${detailJob.title} to join their team in ${detailJob.location}.\n\nThis is a ${detailJob.type} position offering ${Math.round(detailJob.salary_min/1e6)}M–${Math.round(detailJob.salary_max/1e6)}M VND, ideal for candidates with ${detailJob.experience_min}–${detailJob.experience_max} years of experience in ${detailJob.role}.\n\nOur headhunter team will personally introduce you and support you throughout the process.`}
              </div>

              <div className="jd-divider" />

              {/* Bump comparison */}
              {isSubmitted && userSalary && detailJob.salary_min > userSalary && (
                <div style={{
                  background: '#fff7f5', border: '1px solid #ffd6c8', borderRadius: 10,
                  padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>📈</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                      +{Math.round(((detailJob.salary_min - userSalary) / userSalary) * 100)}% higher than your current salary
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      Your benchmark: {Math.round(userSalary/1e6)}M VND → This role: {Math.round(detailJob.salary_min/1e6)}M–{Math.round(detailJob.salary_max/1e6)}M VND
                    </div>
                  </div>
                </div>
              )}

              {/* Apply CTA */}
              {isLoggedIn ? (
                <button className="jd-apply-btn" onClick={() => { setDetailJob(null); openApply(detailJob) }}>
                  Apply now →
                </button>
              ) : (
                <div className="jd-login-box">
                  <div className="jd-login-text">Log in to apply for this position</div>
                  <button className="jd-login-btn" onClick={() => { localStorage.setItem('fyi_login_return','/jobs'); supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin+'/auth/callback' }}) }}>
                    Continue with Google →
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

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
