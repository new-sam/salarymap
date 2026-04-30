import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'
import { useT } from '../lib/i18n'

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
const PERK_FILTER_KEYS = [
  { key: 'pays_more', tKey: 'jobs.paysMore' },
  { key: 'remote', label: 'Remote' },
  { key: 'korea', tKey: 'jobs.koreanCompany' },
  { key: 'vietnam', tKey: 'jobs.vnCompany' },
  { key: 'global', tKey: 'jobs.global' },
]

export default function JobsPage() {
  const router = useRouter()
  const fileRef = useRef(null)
  const { t } = useT()

  const [jobs, setJobs] = useState([])
  const [jobsLoaded, setJobsLoaded] = useState(false)
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
        const cached = sessionStorage.getItem('fyi_is_admin')
        if (cached !== null) {
          setIsAdminUser(cached === 'true')
        } else {
          try {
            const res = await fetch(`/api/admin/check?email=${encodeURIComponent(s.user.email)}`)
            const { isAdmin } = await res.json()
            setIsAdminUser(isAdmin)
            sessionStorage.setItem('fyi_is_admin', String(isAdmin))
          } catch {}
        }
      }
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(d => { setJobs(d); setJobsLoaded(true) }).catch(() => setJobsLoaded(true))
  }, [])

  const getBump = (job) => {
    if (!userSalary || !job.salary_min) return null
    return Math.round(((job.salary_min - userSalary) / userSalary) * 100)
  }

  const companyQuery = router.query.company ? String(router.query.company).toLowerCase() : null

  const filteredJobs = jobs
    .filter(job => {
      if (companyQuery && job.company?.toLowerCase() !== companyQuery) return false
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
      const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${session.user.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('resumes').upload(path, resumeFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: resumeFile.type || 'application/octet-stream',
      })
      if (upErr) {
        setApplying(false)
        alert('CV 업로드에 실패했습니다: ' + upErr.message + '\n\n관리자에게 문의하거나 CV 없이 다시 시도해주세요.')
        return
      }
      const { data } = supabase.storage.from('resumes').getPublicUrl(path)
      resumeUrl = data.publicUrl
    }
    const applyRes = await fetch('/api/job-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        jobCompany: selectedJob.company,
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
    if (!applyRes.ok) {
      setApplying(false)
      const err = await applyRes.json().catch(() => ({}))
      alert('지원 처리에 실패했습니다: ' + (err.error || 'unknown error'))
      return
    }
    setApplying(false)
    setApplied(true)
    // GA4 event
    if (typeof gtag === 'function') gtag('event', 'job_apply', { event_category: 'engagement', event_label: selectedJob.title, company: selectedJob.company })
    // Meta Pixel event
    if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'job_apply', content_category: selectedJob.title })
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
      <div style={{ fontSize: 14, color: '#aaa' }}>{t('jobs.loading')}</div>
    </div>
  )

  return (
    <>
      <Head>
        <title>{t('jobs.title')}</title>
        <meta name="description" content="Curated IT jobs in Vietnam with higher pay. Our headhunter personally introduces you to top companies. Remote, Korean, and global opportunities." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://salary-fyi.com/jobs" />
        <meta property="og:title" content="Jobs — Higher Pay, Better Roles | FYI Salary" />
        <meta property="og:description" content="Curated IT jobs in Vietnam with higher pay. Our headhunter personally introduces you." />
        <meta property="og:image" content="https://salary-fyi.com/og-image.png" />
        <link rel="canonical" href="https://salary-fyi.com/jobs" />
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
          .jg { grid-template-columns: 1fr; }
          .jn-r .jn-submit { display: none; }
          .jn-tab { font-size: 12px; padding: 0 8px; }
        }
      `}</style>

      <GlobalNav activePage="jobs" />

      <div className="jw">
        {/* HEADER */}
        <div className="jw-eye">{t('jobs.eyebrow')}</div>
        <div className="jw-h1">{t('jobs.h1')}</div>
        <div className="jw-sub">{t('jobs.sub')}</div>

        {(
          <>
            {/* STATE C — submitted + logged in */}
            {userSalary && (
              <div className="jbm">
                <span className="jbm-dot" />
                {t('jobs.yourSalary', { salary: Math.round(userSalary / 1000000), role: userRole || '—', exp: userExperience || '—', company: userCompany || '—' })}
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
              {PERK_FILTER_KEYS.map(({ key, tKey, label }) => (
                <button key={key} className={`jf-pill outline${perkFilter === key ? ' on' : ''}`} onClick={() => setPerkFilter(perkFilter === key ? null : key)}>{tKey ? t(tKey) : label}</button>
              ))}
            </div>

            <div className="jf-count">{t('jobs.matchCount', { count: filteredJobs.length })}</div>

            {/* Grid */}
            <div className="jg" style={{ opacity: jobsLoaded ? 1 : 0, transition: 'opacity .3s' }}>
              {filteredJobs.map((job, idx) => {
                const bump = getBump(job)
                return (
                  <div key={job.id} className="jc">
                    <div className="jc-img" onClick={() => { setCarouselIdx(0); setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[idx % 3] }) }}>
                      <div className="jc-img-in" style={{
                        background: `url(${job.image_url || job.images?.[0] || DEFAULT_IMAGES[idx % 3]}) center/cover no-repeat`,
                      }}>
                        {bump !== null && bump > 0 && (
                          <div className="jc-bump" dangerouslySetInnerHTML={{ __html: t('jobs.bumpVs', { bump }) }} />
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
                    <button className="jc-apply" onClick={() => openApply(job)}>{t('jobs.apply')}</button>
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
                  <div className="jd-meta-label">{t('jobs.experience')}</div>
                  <div className="jd-meta-value">{t('jobs.years', { min: detailJob.experience_min, max: detailJob.experience_max })}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.position')}</div>
                  <div className="jd-meta-value">{detailJob.role}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.type')}</div>
                  <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{detailJob.type}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.region')}</div>
                  <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{detailJob.country}</div>
                </div>
              </div>

              <div className="jd-divider" />

              {/* Description */}
              <div className="jd-section-title">{t('jobs.about')}</div>
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
                      {t('jobs.higherThanCurrent', { pct: Math.round(((detailJob.salary_min - userSalary) / userSalary) * 100) })}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      Your benchmark: {Math.round(userSalary/1e6)}M VND → This role: {Math.round(detailJob.salary_min/1e6)}M–{Math.round(detailJob.salary_max/1e6)}M VND
                    </div>
                  </div>
                </div>
              )}

              {/* Apply CTA */}
              <button className="jd-apply-btn" onClick={() => { setDetailJob(null); openApply(detailJob) }}>
                {t('jobs.apply')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* APPLY PANEL — STATE C */}
      {showPanel && selectedJob && (
        <>
          <div className="ap-bg" onClick={() => setShowPanel(false)} />
          <div className="ap">
            <div className="ap-bar" />
            <button className="ap-x" onClick={() => setShowPanel(false)}>×</button>

            {!applied ? (
              <>
                <div className="ap-h">{t('jobs.applyThis')}</div>
                <div className="ap-sub">{t('jobs.applySub')}</div>

                <div className="ap-job">
                  <div className="ap-job-ini">{selectedJob.company_initials || selectedJob.company.slice(0,2).toUpperCase()}</div>
                  <div>
                    <div className="ap-job-t">{selectedJob.title} — {selectedJob.company}</div>
                    <div className="ap-job-s">{Math.round(selectedJob.salary_min/1e6)}M–{Math.round(selectedJob.salary_max/1e6)}M VND</div>
                  </div>
                </div>

                <div className="ap-lbl">{t('jobs.yourProfile')}</div>
                <div className="ap-tags">
                  {userRole && <div className="ap-tag">{userRole} · {userExperience || '—'} yrs</div>}
                  {userCompany && <div className="ap-tag">{t('jobs.currentAt', { company: userCompany, salary: userSalary ? Math.round(userSalary/1e6) : '—' })}</div>}
                </div>

                <div className="ap-lbl">{t('jobs.cvOptional')}</div>
                <div className="ap-up" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && f.size <= 5 * 1024 * 1024) setResumeFile(f)
                    else if (f) alert('Max 5MB')
                  }} />
                  {resumeFile
                    ? <div className="ap-up-f">{resumeFile.name}</div>
                    : <><div className="ap-up-t" style={{ whiteSpace: 'pre-line' }}>{t('jobs.dragCV')}</div></>
                  }
                </div>

                <button className="ap-btn" onClick={() => {
                  if (!isLoggedIn) { localStorage.setItem('fyi_login_return','/jobs'); supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin+'/auth/callback' }}); return; }
                  handleApply();
                }} disabled={applying}>
                  {!isLoggedIn ? t('jobs.loginToApply') : applying ? t('jobs.sending') : t('jobs.submitApplication')}
                </button>
                <button className="ap-skip" onClick={() => {
                  if (!isLoggedIn) { localStorage.setItem('fyi_login_return','/jobs'); supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin+'/auth/callback' }}); return; }
                  setResumeFile(null); handleApply();
                }}>{t('jobs.applyNoCV')}</button>
              </>
            ) : (
              <div className="ap-ok">
                <div className="ap-ok-i">✓</div>
                <div className="ap-ok-h">{t('jobs.applied')}</div>
                <div className="ap-ok-p">{t('jobs.appliedSub')}</div>
                <button className="ap-skip" style={{ marginTop: 20 }} onClick={() => setShowPanel(false)}>{t('jobs.close')}</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
