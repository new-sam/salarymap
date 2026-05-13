import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'
import { useT } from '../lib/i18n'
import Icon from '../components/Icon'
import { DEFAULT_IMAGES, ROLE_OPTIONS, TYPE_OPTIONS, TECH_OPTIONS, JOBS_PER_PAGE } from '../constants/jobs'
import { COMPANY_PROFILES } from '../data/companyProfiles.js'
import { formatSalaryCard, getHighSalaryThreshold } from '../utils/salary'
import { generateCompanyDescription } from '../utils/companyDescription'

// Module-level: survives client-side navigation, resets on full page reload
let _cachedProfile = null

export default function JobsPage() {
  const router = useRouter()
  const fileRef = useRef(null)
  const { t, lang } = useT()

  const [jobs, setJobs] = useState([])
  const [jobsLoaded, setJobsLoaded] = useState(false)
  const highSalaryThreshold = useMemo(() => getHighSalaryThreshold(jobs), [jobs])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expMin, setExpMin] = useState('')
  const [expMax, setExpMax] = useState('')
  const [techFilter, setTechFilter] = useState('')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [userSalary, setUserSalary] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userExperience, setUserExperience] = useState(null)
  const [userCompany, setUserCompany] = useState(null)

  const [sortBy, setSortBy] = useState('spread')
  const [hideExpired, setHideExpired] = useState(true)

  // Detail & Apply panel
  const [detailJob, setDetailJob] = useState(null)
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [detailApplyMode, setDetailApplyMode] = useState(false)
  const [aiSummaryReady, setAiSummaryReady] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [bookmarks, setBookmarks] = useState([])
  const [appliedJobs, setAppliedJobs] = useState([])
  const [toast, setToast] = useState(null)
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE)
  const barPlaceholderRef = useRef(null)
  const stickyRef = useRef(null)
  const [barFixed, setBarFixed] = useState(false)
  const [barTop, setBarTop] = useState(56)

  const track = (event, page, meta) => {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, page, meta, email: user?.email }) }).catch(() => {})
  }

  // AI summary loading animation
  useEffect(() => {
    if (!detailJob) { setAiSummaryReady(false); return }
    setAiSummaryReady(false)
    const timer = setTimeout(() => setAiSummaryReady(true), 1200 + Math.random() * 600)
    if (typeof fbq === 'function') fbq('track', 'ViewContent', { content_name: detailJob.title, content_category: detailJob.company, content_type: 'job' })
    return () => clearTimeout(timer)
  }, [detailJob])

  // Sticky sort bar via JS
  useEffect(() => {
    const onScroll = () => {
      const ph = barPlaceholderRef.current
      const st = stickyRef.current
      if (!ph || !st) return
      const stickyBottom = st.getBoundingClientRect().bottom
      const phTop = ph.getBoundingClientRect().top
      setBarTop(stickyBottom)
      setBarFixed(phTop <= stickyBottom)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(JOBS_PER_PAGE) }, [searchQuery, roleFilter, typeFilter, techFilter, expMin, expMax])

  // Infinite scroll
  const loadMoreObserver = useRef(null)
  useEffect(() => {
    loadMoreObserver.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(v => v + JOBS_PER_PAGE)
    }, { rootMargin: '200px' })
    return () => loadMoreObserver.current?.disconnect()
  }, [])
  const loadMoreCallback = useCallback(node => {
    loadMoreObserver.current?.disconnect()
    if (node) loadMoreObserver.current?.observe(node)
  }, [])

  // UTM capture + page view tracking on jobs page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const utmKeys = ['utm_source','utm_medium','utm_campaign','utm_content']
    const hasNewUtm = utmKeys.some(k => params.get(k))
    if (hasNewUtm) {
      const expires = new Date(Date.now() + 30 * 86400000).toUTCString()
      utmKeys.forEach(k => {
        const v = params.get(k)
        if (v) {
          document.cookie = `${k}=${encodeURIComponent(v)};path=/;expires=${expires};SameSite=Lax`
          sessionStorage.setItem(k, v)
        }
      })
    }
    const getUtm = (k) => {
      const p = params.get(k)
      if (p) return p
      const s = sessionStorage.getItem(k)
      if (s) return s
      const match = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)'))
      return match ? decodeURIComponent(match[1]) : null
    }
    track('view_jobs_page', '/jobs', {
      utm_source: getUtm('utm_source'),
      utm_medium: getUtm('utm_medium'),
      utm_campaign: getUtm('utm_campaign'),
      utm_content: getUtm('utm_content'),
      referrer: document.referrer || null,
    })
  }, [])

  // Load state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSubmitted(localStorage.getItem('fyi_submitted') === 'true')
      if (!_cachedProfile) {
        const freshSubmit = sessionStorage.getItem('fyi_fresh_submit') === 'true'
        if (freshSubmit) {
          sessionStorage.removeItem('fyi_fresh_submit')
          const sal = parseInt(localStorage.getItem('fyi_salary'))
          _cachedProfile = {
            salary: sal ? sal * 1000000 : null,
            role: localStorage.getItem('fyi_role'),
            exp: localStorage.getItem('fyi_exp'),
            company: localStorage.getItem('fyi_company'),
          }
        }
      }
      if (_cachedProfile) {
        if (_cachedProfile.salary) setUserSalary(_cachedProfile.salary)
        setUserRole(_cachedProfile.role)
        setUserExperience(_cachedProfile.exp)
        setUserCompany(_cachedProfile.company)
      }
      try { setAppliedJobs(JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]')) } catch { }
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
          } catch { }
        }
        // Load bookmarks from DB
        try {
          const bRes = await fetch(`/api/job-bookmarks?userId=${s.user.id}`)
          const bData = await bRes.json()
          if (bData.bookmarks) {
            const ids = bData.bookmarks.map(b => b.job_id)
            setBookmarks(ids)
            localStorage.setItem('fyi_bookmarks', JSON.stringify(ids))
          }
        } catch { }
      }
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    let retries = 0
    const load = () => {
      fetch('/api/jobs').then(r => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      }).then(d => {
        if (d.length === 0 && retries < 2) {
          retries++
          setTimeout(load, 1000)
        } else {
          setJobs(d); setJobsLoaded(true)
          // Open job detail if jobId query param exists
          const qJobId = new URLSearchParams(window.location.search).get('jobId')
          if (qJobId) {
            const found = d.find(j => String(j.id) === qJobId)
            if (found) { setCarouselIdx(0); setDetailApplyMode(false); setApplied(false); setResumeFile(null); setDetailJob(found) }
          }
        }
      }).catch(() => {
        if (retries < 2) { retries++; setTimeout(load, 1000) }
        else setJobsLoaded(true)
      })
    }
    load()
  }, [])

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    if (!openDropdown) return
    const handle = () => setOpenDropdown(null)
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [openDropdown])

  const typeLabel = (type) => {
    const normalized = {
      remote: 'jobs.typeRemote', onsite: 'jobs.typeOnsite', hybrid: 'jobs.typeHybrid',
      '원격 근무': 'jobs.typeRemote', '원격근무': 'jobs.typeRemote', '재택': 'jobs.typeRemote',
      '오프라인 근무': 'jobs.typeOnsite', '오프라인근무': 'jobs.typeOnsite',
      '하이브리드': 'jobs.typeHybrid',
    }[type]
    return normalized ? t(normalized) : type
  }

  const getBump = (job) => {
    if (!userSalary || !job.salary_min) return null
    return Math.round(((job.salary_min - userSalary) / userSalary) * 100)
  }

  const isProfileMatch = (job) => {
    if (!userSalary) return false
    const roleMatch = userRole && job.role === userRole
    const salaryMatch = job.salary_min && job.salary_min > userSalary
    const expMatch = userExperience && job.experience_min != null && job.experience_max != null &&
      Number(String(userExperience).replace(/[^0-9]/g, '') || 0) >= job.experience_min &&
      Number(String(userExperience).replace(/[^0-9]/g, '') || 0) <= job.experience_max
    return roleMatch || salaryMatch || expMatch
  }

  const companyQuery = router.query.company ? String(router.query.company).toLowerCase() : null

  const filteredJobs = (() => {
    const q = searchQuery.toLowerCase().trim()
    const filtered = jobs.filter(job => {
      if (companyQuery && job.company?.toLowerCase() !== companyQuery) return false
      if (q && !job.title?.toLowerCase().includes(q) && !job.company?.toLowerCase().includes(q)) return false
      if (hideExpired && job.deadline && new Date(job.deadline) < new Date()) return false
      if (roleFilter && job.role !== roleFilter) return false
      if (typeFilter && job.type !== typeFilter) return false
      if (techFilter && !(job.tech_stack || []).some(t => t.toLowerCase().includes(techFilter.toLowerCase()))) return false
      if (expMin !== '' || expMax !== '') {
        const jobMin = job.experience_min || 0
        const jobMax = job.experience_max || 0
        if (!jobMin && !jobMax) return true // 경력 무관은 항상 포함
        const eMin = expMin !== '' ? Number(expMin) : 0
        const eMax = expMax !== '' ? Number(expMax) : 99
        if (jobMax < eMin || jobMin > eMax) return false
      }
      return true
    })
    // 스크랩 필터
    if (sortBy === 'saved') {
      return filtered.filter(job => bookmarks.includes(job.id))
    }
    // 정렬
    if (sortBy === 'deadline') {
      filtered.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline) - new Date(b.deadline)
      })
    } else if (sortBy === 'latest') {
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }
    // sortBy === 'spread' → 같은 회사 분산 배치
    if (sortBy === 'spread') {
      const featured = filtered.filter(j => j.is_featured)
      const rest = filtered.filter(j => !j.is_featured)
      const byCompany = {}
      rest.forEach(job => {
        const key = job.company || ''
        if (!byCompany[key]) byCompany[key] = []
        byCompany[key].push(job)
      })
      const queues = Object.values(byCompany).sort((a, b) => b.length - a.length)
      const result = []
      while (queues.some(q => q.length > 0)) {
        for (const q of queues) {
          if (q.length > 0) result.push(q.shift())
        }
      }
      return [...featured, ...result]
    }
    // featured 공고 상단 고정 (다른 정렬에서도)
    const featured = filtered.filter(j => j.is_featured)
    const rest = filtered.filter(j => !j.is_featured)
    return [...featured, ...rest]
  })()

  const handleApply = async (job) => {
    const target = job || selectedJob
    if (!target || !session) return
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
        jobId: target.id,
        jobTitle: target.title,
        jobCompany: target.company,
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
    // Save applied job to prevent re-applying
    setAppliedJobs(prev => {
      const next = [...prev, target.id]
      localStorage.setItem('fyi_applied_jobs', JSON.stringify(next))
      return next
    })
    // Save to my-applications cache so it shows instantly
    try {
      const cached = JSON.parse(localStorage.getItem('fyi_my_applications') || '[]')
      cached.unshift({
        id: Date.now(),
        job_id: target.id,
        job_title: target.title,
        job_company: target.company,
        status: 'applied',
        created_at: new Date().toISOString(),
      })
      localStorage.setItem('fyi_my_applications', JSON.stringify(cached))
    } catch {}
    // Redirect to confirmation page
    router.push({
      pathname: '/jobs/applied',
      query: { title: target.title, company: target.company },
    })
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const toggleBookmark = (jobId) => {
    if (!isLoggedIn) {
      setShowAuthModal(true)
      return
    }
    const isRemoving = bookmarks.includes(jobId)
    setBookmarks(prev => {
      const next = isRemoving ? prev.filter(id => id !== jobId) : [...prev, jobId]
      localStorage.setItem('fyi_bookmarks', JSON.stringify(next))
      return next
    })
    showToast(isRemoving ? t('jobs.unsaved') : t('jobs.savedToast'))
    const job = jobs.find(j => j.id === jobId)
    track(isRemoving ? 'unsave_job' : 'save_job', '/jobs', { jobId, title: job?.title, company: job?.company })
    fetch('/api/job-bookmarks', {
      method: isRemoving ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobId }),
    }).catch(() => {})
  }

  const openApply = (job) => {
    if (appliedJobs.includes(job.id)) return
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

        .jn { position: sticky; top: 0; z-index: 100; height: 56px; background: #fafaf8; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; }
        .jn-l { display: flex; align-items: center; gap: 28px; }
        .jn-logo { font-size: 18px; font-weight: 800; color: #ff4400; text-decoration: none; }
        .jn-tabs { display: flex; }
        .jn-tab { font-size: 14px; color: #999; padding: 0 16px; height: 56px; display: flex; align-items: center; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; text-decoration: none; transition: color .15s; }
        .jn-tab:hover { color: #555; }
        .jn-tab.on { color: #111; font-weight: 600; border-bottom-color: #ff4400; }
        .jn-r { display: flex; align-items: center; gap: 10px; }
        .jn-login { font-size: 13px; font-weight: 600; color: #666; background: none; border: 1px solid #ddd; padding: 6px 16px; border-radius: 6px; cursor: pointer; }
        .jn-submit { font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 7px 16px; border-radius: 6px; cursor: pointer; }
        .jn-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ff4400; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; }
        .jn-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .jn-menu { position: absolute; top: calc(100% + 8px); right: 0; background: #fafaf8; border: 1px solid #eee; border-radius: 12px; padding: 6px; min-width: 180px; z-index: 500; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jn-menu-email { padding: 10px 14px; font-size: 12px; color: #999; border-bottom: 1px solid #f0f0f0; margin-bottom: 4px; }
        .jn-menu-item { display: block; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; background: none; color: #333; font-size: 13px; cursor: pointer; text-align: left; text-decoration: none; transition: background .1s; font-family: inherit; }
        .jn-menu-item:hover { background: #f5f5f5; }

        .jw { max-width: 1080px; margin: 0 auto; padding: 36px 40px 80px; }
        .jw-eye { font-size: 11px; font-weight: 700; color: #ff4400; letter-spacing: .08em; margin-bottom: 8px; }
        .jw-h1 { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; letter-spacing: -0.3px; }
        .jw-sub { font-size: 14px; color: #999; margin-bottom: 20px; }

        .jbm { display: flex; align-items: center; gap: 14px; background: linear-gradient(135deg, #ff4400 0%, #ff6b35 100%); border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(255,68,0,0.18); }
        .jbm-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .jbm-icon svg { width: 18px; height: 18px; }
        .jbm-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .jbm-label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.85); letter-spacing: 0.03em; }
        .jbm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .jbm-tag { font-size: 13px; color: #fff; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap; backdrop-filter: blur(4px); }

        .jf-sticky { position: sticky; top: 56px; z-index: 15; background: #fafaf8; padding: 12px 0 4px; border-bottom: 1px solid #e8e8e8; }
        .jf-search { position: relative; margin-bottom: 16px; }
        .jf-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .jf-search-input { width: 100%; padding: 11px 36px 11px 40px; font-size: 14px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fafaf8; outline: none; transition: border-color .15s; font-family: inherit; }
        .jf-search-input:focus { border-color: #ff4400; }
        .jf-search-input::placeholder { color: #999; }
        .jf-search-clear { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 18px; color: #999; cursor: pointer; line-height: 1; }

        .jf { display: flex; gap: 8px; margin-bottom: 0; flex-wrap: wrap; align-items: center; }
        .jf-dd { position: relative; }
        .jf-dd-btn { font-size: 13px; font-weight: 500; color: #555; background: #fafaf8; border: 1px solid #e0e0e0; padding: 8px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .15s; white-space: nowrap; font-family: inherit; }
        .jf-dd-btn:hover { border-color: #999; }
        .jf-dd-btn.on { background: #111; color: #fff; border-color: #111; font-weight: 600; }
        .jf-dd-arrow { font-size: 10px; opacity: 0.5; }
        .jf-dd-menu { position: absolute; top: calc(100% + 4px); left: 0; background: #fafaf8; border: 1px solid #eee; border-radius: 10px; padding: 4px; min-width: 160px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jf-dd-menu-scroll { max-height: 240px; overflow-y: auto; }
        .jf-dd-item { display: block; width: 100%; padding: 9px 12px; border: none; background: none; font-size: 13px; color: #333; cursor: pointer; text-align: left; border-radius: 6px; transition: background .1s; font-family: inherit; white-space: nowrap; }
        .jf-dd-item:hover { background: #f5f5f5; }
        .jf-dd-item.on { color: #ff4400; font-weight: 600; }
        .jf-reset { font-size: 13px; color: #999; background: none; border: none; cursor: pointer; padding: 8px 4px; font-family: inherit; text-decoration: underline; white-space: nowrap; }
        .jf-reset:hover { color: #666; }
        .jf-exp-panel { position: absolute; top: calc(100% + 4px); left: 0; background: #fafaf8; border: 1px solid #eee; border-radius: 12px; padding: 20px; min-width: 280px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jf-exp-title { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 16px; }
        .jf-exp-display { font-size: 18px; font-weight: 700; color: #111; text-align: center; margin-bottom: 20px; }
        .jf-exp-slider { position: relative; height: 32px; margin-bottom: 20px; }
        .jf-exp-track { position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: #e8e8e8; border-radius: 2px; transform: translateY(-50%); }
        .jf-exp-fill { position: absolute; top: 0; bottom: 0; background: #ff4400; border-radius: 2px; }
        .jf-exp-range { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; margin: 0; }
        .jf-exp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #ff4400; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; pointer-events: auto; }
        .jf-exp-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #ff4400; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; pointer-events: auto; }
        .jf-exp-footer { display: flex; justify-content: space-between; align-items: center; }
        .jf-exp-reset { font-size: 13px; color: #999; background: none; border: none; cursor: pointer; font-family: inherit; }
        .jf-exp-reset:hover { color: #666; }
        .jf-exp-apply { font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-family: inherit; }
        .jf-exp-apply:hover { background: #e63d00; }

        .jf-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .jf-bar-fixed { position: fixed; left: 0; right: 0; z-index: 14; background: #fafaf8; padding: 8px 40px 4px; border-bottom: 1px solid #e8e8e8; max-width: 1080px; margin: 0 auto; }
        @media (max-width: 768px) { .jf-bar-fixed { padding: 8px 16px 4px; } }
        .jf-bar-l { display: flex; align-items: center; gap: 16px; }
        .jf-check { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #777; cursor: pointer; user-select: none; }
        .jf-check input { accent-color: #ff4400; cursor: pointer; margin: 0; }
        .jf-count { font-size: 16px; font-weight: 800; color: #111; }
        .jf-sort { display: flex; background: #f5f5f5; border-radius: 8px; overflow: hidden; }
        .jf-sort-btn { font-size: 13px; font-weight: 500; color: #777; background: none; border: none; padding: 7px 14px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .jf-sort-btn.on { background: #fafaf8; color: #111; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 6px; }
        .jf-sort-saved { display: inline-flex; align-items: center; border-left: 1px solid #e0e0e0; margin-left: 2px; }
        .jf-sort-saved.on { color: #ff4400; }

        /* Hot jobs */
        .jh { margin-top: 20px; margin-bottom: 32px; }
        .jh-title {
          font-size: 16px; font-weight: 800; color: #111; margin-bottom: 14px;
          display: flex; align-items: center; gap: 7px;
        }
        .jh-trend {
          display: inline-flex; align-items: center;
          color: #ff4400;
        }
        .jh-trend-arrows {
          display: flex; flex-direction: column; gap: 0;
          line-height: 0;
        }
        .jh-trend-arrow {
          display: block; animation: arrowUp 1.4s ease-in-out infinite;
        }
        .jh-trend-arrow:nth-child(1) { animation-delay: 0s; }
        .jh-trend-arrow:nth-child(2) { animation-delay: 0.15s; }
        .jh-trend-arrow:nth-child(3) { animation-delay: 0.3s; }
        @keyframes arrowUp {
          0%, 100% { opacity: 0.2; transform: translateY(1px); }
          40%, 60% { opacity: 1; transform: translateY(-1px); }
        }
        .jh-app { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #ff4400; font-weight: 700; margin-right: 6px; overflow: visible; }
        .jh-pulse { width: 6px; height: 6px; border-radius: 50%; background: #ff4400; position: relative; flex-shrink: 0; margin: 4px; }
        .jh-pulse::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; background: rgba(255,68,0,0.35); animation: jh-ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes jh-ping { 0% { transform: scale(1); opacity: 1; } 75%,100% { transform: scale(2.2); opacity: 0; } }
        .jh-open { font-size: 11px; color: #38a169; font-weight: 600; display: inline-flex; align-items: center; line-height: 1; }
        .jh-divider { height: 1px; background: #eee; margin-top: 32px; }

        .jg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; align-items: stretch; }

        /* Card */
        .jc { cursor: pointer; display: flex; flex-direction: column; min-width: 0; }
        .jc-match { position: absolute; top: 10px; left: 10px; background: #ff4400; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; z-index: 2; }
        .jc-img { border-radius: 8px; overflow: hidden; position: relative; padding-top: 62%; margin-bottom: 11px; background: #f0f0f0; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.06); }
        .jc-img-in { position: absolute; inset: 0; transition: transform .25s ease; background-color: #f0f0f0; background-size: cover; background-position: center; background-repeat: no-repeat; }
        .jc:hover .jc-img-in { transform: scale(1.04); }
        .jc-bump { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.62); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 4px; z-index: 2; }
        .jc-bump b { color: #ff4400; font-weight: 700; }
        .jc-bm { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(250,250,248,0.92); display: flex; align-items: center; justify-content: center; z-index: 2; border: none; cursor: pointer; }
        .jc-ini { position: absolute; bottom: 10px; left: 10px; width: 34px; height: 34px; border-radius: 6px; background: #fafaf8; border: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #333; z-index: 2; }
        .jc-body { flex: 1; display: flex; flex-direction: column; }
        .jc-t { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
        .jc-co { font-size: 13px; color: #777; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jc-sal { font-size: 15px; font-weight: 800; color: #ff4400; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; }
        .jc-bottom { margin-top: auto; }
        .jc-m { font-size: 12px; color: #999; white-space: nowrap; overflow: visible; text-overflow: ellipsis; display: flex; align-items: center; }
        .jc-m b { color: #ff4400; font-weight: 700; }
        .jc-tag { font-size: 11px; font-weight: 500; color: #555; background: #f0f0f0; padding: 2px 7px; border-radius: 4px; }
        .jc-tag-more { color: #999; }
        .jc-badges { position: absolute; bottom: 10px; right: 10px; display: flex; gap: 4px; z-index: 2; }
        .jc-type-badge { font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 4px; letter-spacing: 0.3px; }
        .jc-type-badge.remote { color: #fff; background: #16a34a; }
        .jc-type-badge.hybrid { color: #fff; background: #2563eb; }
        .jc-type-badge.highpay { color: #fff; background: #ff4400; }
        .jc-dday { display: inline-flex; align-items: center; margin-left: 6px; font-size: 11px; font-weight: 700; color: #ff4400; background: #fff7f5; border: 1px solid #ffd6c8; padding: 1px 6px; border-radius: 4px; line-height: 1; }
        .jc-dday.urgent { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
        .jc-nudge { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .jc-nudge-t { font-size: 12px; color: #777; }
        .jc-nudge-b { font-size: 12px; color: #ff4400; font-weight: 700; background: none; border: none; cursor: pointer; white-space: nowrap; }

        /* Empty slot */
        .jc-empty { border-radius: 8px; padding-top: 62%; position: relative; background: #fafafa; border: 1.5px dashed #e5e5e5; margin-bottom: 11px; }
        .jc-empty-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
        .jc-empty-t { font-size: 12px; color: #999; }
        .jc-empty-b { padding: 6px 14px; background: #ff4400; border: none; border-radius: 5px; font-size: 12px; font-weight: 700; color: #fff; cursor: pointer; }

        /* Gate */
        .jgate { position: relative; min-height: 420px; }
        .jgate-blur { filter: blur(7px); pointer-events: none; user-select: none; }
        .jgate-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fafaf8; border: 1px solid #eee; border-radius: 16px; padding: 56px 40px; text-align: center; z-index: 2; max-width: 440px; width: 90%; box-shadow: 0 8px 40px rgba(0,0,0,0.06); }
        .jgate-icon { font-size: 32px; margin-bottom: 16px; }
        .jgate-h { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 8px; }
        .jgate-p { font-size: 14px; color: #777; line-height: 1.7; margin-bottom: 24px; white-space: pre-line; }
        .jgate-btn { font-size: 14px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 13px 28px; border-radius: 8px; cursor: pointer; transition: background .15s; }
        .jgate-btn:hover { background: #e63d00; }

        /* Apply panel */
        .ap-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; }
        .ap { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 560px; background: #fafaf8; border-radius: 20px 20px 0 0; z-index: 51; padding: 24px 28px 40px; max-height: 85vh; overflow-y: auto; animation: apUp .3s ease; }
        @keyframes apUp { from { transform: translate(-50%,100%); } to { transform: translate(-50%,0); } }
        .ap-bar { width: 36px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 0 auto 20px; }
        .ap-x { position: absolute; top: 16px; right: 20px; font-size: 20px; color: #999; cursor: pointer; background: none; border: none; line-height: 1; }
        .ap-h { font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .ap-sub { font-size: 13px; color: #999; margin-bottom: 20px; line-height: 1.5; }
        .ap-job { background: #f7f7f7; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .ap-job-ini { width: 36px; height: 36px; border-radius: 6px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #555; flex-shrink: 0; }
        .ap-job-t { font-size: 14px; font-weight: 600; color: #111; }
        .ap-job-s { font-size: 12px; color: #ff4400; font-weight: 600; }
        .ap-lbl { font-size: 10px; font-weight: 700; color: #999; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }
        .ap-tags { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .ap-tag { background: #f0fff4; border: 1px solid #86efac; border-radius: 6px; padding: 8px 12px; font-size: 13px; color: #166534; }
        .ap-up { border: 1.5px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 20px; transition: border-color .15s; }
        .ap-up:hover { border-color: #999; }
        .ap-up-t { font-size: 13px; color: #999; }
        .ap-up-h { font-size: 11px; color: #aaa; margin-top: 4px; }
        .ap-up-f { font-size: 13px; color: #111; font-weight: 600; }
        .ap-btn { width: 100%; padding: 12px; font-size: 14px; font-weight: 700; color: #fff; background: #ff4400; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: opacity .15s; }
        .ap-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ap-skip { width: 100%; padding: 8px; font-size: 13px; color: #999; background: none; border: none; cursor: pointer; }
        .ap-ok { text-align: center; padding: 40px 0; }
        .ap-ok-i { font-size: 40px; color: #22c55e; margin-bottom: 12px; }
        .ap-ok-h { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .ap-ok-p { font-size: 14px; color: #777; line-height: 1.5; }

        /* Job Detail Panel */
        .jd-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 60; }
        .jd { position: fixed; top: 0; right: 0; width: 50%; height: 100vh; background: #fafaf8; z-index: 61; overflow-y: auto; animation: jdSlide .3s ease; box-shadow: -8px 0 40px rgba(0,0,0,0.1); }
        @keyframes jdSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .jd-x { position: absolute; top: 16px; right: 20px; font-size: 24px; color: #999; cursor: pointer; background: none; border: none; z-index: 2; line-height: 1; }
        .jd-img { width: 100%; max-height: 400px; background: #f0f0f0; background-size: contain; background-position: center; background-repeat: no-repeat; aspect-ratio: 16/9; }
        .jd-body { padding: 28px 32px 40px; }
        .jd-company { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .jd-co-ini { width: 44px; height: 44px; border-radius: 10px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #555; flex-shrink: 0; }
        .jd-co-name { font-size: 15px; font-weight: 600; color: #111; }
        .jd-co-loc { font-size: 13px; color: #777; }
        .jd-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px; letter-spacing: -0.3px; }
        .jd-salary { font-size: 16px; font-weight: 700; color: #ff4400; margin-bottom: 24px; }
        .jd-divider { height: 1px; background: #f0f0f0; margin: 24px 0; }
        .jd-section-title { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
        .jd-desc { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; }
        .jd-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }

        /* Work Information */
        .jd-work-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .jd-work-item { display: flex; align-items: center; gap: 10px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px 14px; }
        .jd-work-icon { font-size: 18px; flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fafaf8; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .jd-work-label { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
        .jd-work-value { font-size: 13px; color: #222; font-weight: 600; margin-top: 2px; }

        /* Company Overview */
        .jd-company-overview { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); border: 1px solid #e0e7ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
        .jd-co-overview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .jd-co-overview-badge { font-size: 11px; font-weight: 700; color: #6366f1; background: #e0e7ff; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
        .jd-co-overview-badge::before { content: '\\2726'; font-size: 10px; }
        .jd-co-overview-badge.ai-thinking { animation: aiBadgePulse 1.2s ease-in-out infinite; }
        @keyframes aiBadgePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .jd-co-overview-text { font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 16px; white-space: pre-line; }
        .jd-co-overview-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e0e7ff; padding-top: 14px; }
        .jd-co-stat { flex: 1; text-align: center; }
        .jd-co-stat { padding: 8px 0; }
        .jd-co-stat:nth-child(odd) { border-right: 1px solid #e0e7ff; }
        .jd-co-stat-num { font-size: 15px; font-weight: 800; color: #111; }
        .jd-co-stat-label { font-size: 11px; color: #777; margin-top: 2px; }

        /* AI loading skeleton */
        .ai-loading { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 16px; }
        .ai-loading-line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #e0e7ff 25%, #ede9fe 50%, #e0e7ff 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        /* AI fade-in */
        .ai-fade-in { animation: aiFadeIn 0.6s ease-out both; }
        @keyframes aiFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .jd-meta-item { background: #f9f9f8; border-radius: 8px; padding: 12px 14px; }
        .jd-meta-label { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .jd-meta-value { font-size: 14px; font-weight: 600; color: #111; }
        .jd-apply-float { position: sticky; bottom: 0; background: #fafaf8; padding: 16px 32px; border-top: 1px solid #f0f0f0; z-index: 2; }
        .jd-apply-btn { width: 100%; padding: 14px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s; }
        .jd-apply-btn:hover { background: #e63d00; }
        .jd-apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .jd-save-btn { width: 48px; height: 48px; border-radius: 8px; border: 1px solid #e0e0e0; background: #fafaf8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; flex-shrink: 0; }
        .jd-save-btn:hover { border-color: #ff4400; background: #fff5f0; }
        .toast { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px); background: #222; color: #fff; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 10px; z-index: 9999; opacity: 0; animation: toastIn .25s ease forwards; box-shadow: 0 6px 24px rgba(0,0,0,0.25); pointer-events: none; display: flex; align-items: center; gap: 8px; }
        @keyframes toastIn { to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .jd-apply-inline { padding: 20px 32px 24px; border-top: 1px solid #f0f0f0; }
        .jd-apply-inline-h { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 14px; }
        .jd-login-box { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 10px; padding: 16px 20px; text-align: center; margin-top: 8px; }
        .jd-login-text { font-size: 13px; color: #777; margin-bottom: 10px; }
        .jd-login-btn { background: #ff4400; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; }

        /* Pagination */

        @media (max-width: 900px) { .jg { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 768px) {
          .jn { padding: 0 16px; height: 48px; }
          .jn-l { gap: 16px; }
          .jn-tab { font-size: 13px; height: 48px; padding: 0 12px; }
          .jw { padding: 28px 16px 60px; }
          .jw-h1 { font-size: 20px; }
          .jg { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
          .jbm { padding: 12px 14px; gap: 10px; }
          .jbm-icon { width: 30px; height: 30px; border-radius: 8px; }
          .jbm-icon svg { width: 15px; height: 15px; }
          .jbm-tag { font-size: 12px; padding: 3px 8px; }
          .jf-sticky { top: 48px; }
          .jf { gap: 6px; }
          .jf-dd-btn { font-size: 12px; padding: 7px 10px; }
          .jf-sort { flex-wrap: wrap; }
          .jf-sort-btn { font-size: 12px; padding: 6px 10px; }
          .jgate-box { padding: 36px 24px; }
          .ap { padding: 20px 20px 32px; }
          .jd { width: 100%; }
          .jd-body { padding: 20px 16px 32px; }
          .jd-img { max-height: 280px; }
          .jd-title { font-size: 18px; }
          .jd-work-info { grid-template-columns: 1fr; }
          .jd-co-overview-stats { grid-template-columns: 1fr 1fr; }
          .jd-apply-float { padding: 12px 16px; }
          .jd-save-btn { width: 44px; height: 44px; }
          .jd-apply-btn { padding: 12px; font-size: 14px; }
          .toast { font-size: 13px; padding: 10px 20px; bottom: 24px; }
        }
        @media (max-width: 480px) {
          .jg { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .jh .jg { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; gap: 14px; padding-bottom: 8px; grid-template-columns: none; }
          .jh .jg::-webkit-scrollbar { display: none; }
          .jh .jg > .jc { min-width: 60%; flex-shrink: 0; scroll-snap-align: start; }
          .jn-r .jn-submit { display: none; }
          .jn-tab { font-size: 12px; padding: 0 8px; }
        }
        .jc-skel .jc-skel-img { position: absolute; inset: 0; border-radius: 8px; background: #e9e9e9; }
        .jc-skel-line { border-radius: 4px; background: #e9e9e9; }
        .shimmer { background: linear-gradient(90deg, #e9e9e9 25%, #f5f5f5 50%, #e9e9e9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <GlobalNav activePage="jobs" />

      <div className="jw">
        {/* HEADER */}
        <div className="jw-eye">{t('jobs.eyebrow')}</div>
        <div className="jw-h1">{t('jobs.h1')}</div>
        <div className="jw-sub">{t('jobs.sub')}</div>

        {(
          <div className="jw-content">
            {/* STATE C — submitted + logged in */}
            {userSalary && (
              <div className="jbm">
                <div className="jbm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                <div className="jbm-body">
                  <span className="jbm-label">{t('jobs.profileMatch')}</span>
                  <div className="jbm-tags">
                    <span className="jbm-tag">{Math.round(userSalary / 1000000)}M VND</span>
                    {userRole && <span className="jbm-tag">{userRole}</span>}
                    {userExperience && <span className="jbm-tag">{userExperience}</span>}
                    {userCompany && <span className="jbm-tag">{userCompany}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Search + Filters (sticky) */}
            <div className="jf-sticky" ref={stickyRef}>
            <div className="jf-search">
              <svg className="jf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="jf-search-input" placeholder={t('jobs.searchPlaceholder')} value={searchQuery} onChange={e => { setSearchQuery(e.target.value) }} />
              {searchQuery && <button className="jf-search-clear" onClick={() => setSearchQuery('')}>×</button>}
            </div>

            {/* Filter dropdowns */}
            <div className="jf">
              {/* Role */}
              <div className="jf-dd">
                <button className={`jf-dd-btn${roleFilter ? ' on' : ''}`} onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'role' ? null : 'role') }}>
                  {roleFilter || t('jobs.filterRole')} <span className="jf-dd-arrow">▾</span>
                </button>
                {openDropdown === 'role' && (
                  <div className="jf-dd-menu">
                    <button className={`jf-dd-item${!roleFilter ? ' on' : ''}`} onClick={() => { setRoleFilter(''); setOpenDropdown(null) }}>{t('jobs.filterAll')}</button>
                    {ROLE_OPTIONS.map(r => (
                      <button key={r} className={`jf-dd-item${roleFilter === r ? ' on' : ''}`} onClick={() => { setRoleFilter(r); setOpenDropdown(null) }}>{r}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Experience */}
              <div className="jf-dd">
                <button className={`jf-dd-btn${expMin !== '' || expMax !== '' ? ' on' : ''}`} onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'exp' ? null : 'exp') }}>
                  {expMin !== '' || expMax !== '' ? `${expMin || 0} ~ ${expMax || 15}${t('jobs.expYears')}` : t('jobs.yearsAny')} <span className="jf-dd-arrow">▾</span>
                </button>
                {openDropdown === 'exp' && (
                  <div className="jf-exp-panel" onClick={e => e.stopPropagation()}>
                    <div className="jf-exp-title">{t('jobs.expSelect')}</div>
                    <div className="jf-exp-display">{expMin === '' && expMax === '' ? t('jobs.yearsAny') : `${expMin || 0}${t('jobs.expYears')} ~ ${expMax || 15}${t('jobs.expYears')}`}</div>
                    <div className="jf-exp-slider">
                      <div className="jf-exp-track">
                        <div className="jf-exp-fill" style={{ left: `${(Number(expMin || 0) / 15) * 100}%`, right: `${100 - (Number(expMax || 15) / 15) * 100}%` }} />
                      </div>
                      <input type="range" className="jf-exp-range" min="0" max="15" value={expMin || 0} onChange={e => { const v = e.target.value; if (Number(v) <= Number(expMax || 15)) { setExpMin(v === '0' ? '' : v) } }} />
                      <input type="range" className="jf-exp-range" min="0" max="15" value={expMax || 15} onChange={e => { const v = e.target.value; if (Number(v) >= Number(expMin || 0)) { setExpMax(v === '15' ? '' : v) } }} />
                    </div>
                    <div className="jf-exp-footer">
                      <button className="jf-exp-reset" onClick={() => { setExpMin(''); setExpMax('') }}>{t('jobs.filterReset')}</button>
                      <button className="jf-exp-apply" onClick={() => setOpenDropdown(null)}>{t('jobs.expApply')}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Type */}
              <div className="jf-dd">
                <button className={`jf-dd-btn${typeFilter ? ' on' : ''}`} onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'type' ? null : 'type') }}>
                  {typeFilter ? typeLabel(typeFilter) : t('jobs.filterType')} <span className="jf-dd-arrow">▾</span>
                </button>
                {openDropdown === 'type' && (
                  <div className="jf-dd-menu">
                    <button className={`jf-dd-item${!typeFilter ? ' on' : ''}`} onClick={() => { setTypeFilter(''); setOpenDropdown(null) }}>{t('jobs.filterAll')}</button>
                    {TYPE_OPTIONS.map(tp => (
                      <button key={tp} className={`jf-dd-item${typeFilter === tp ? ' on' : ''}`} onClick={() => { setTypeFilter(tp); setOpenDropdown(null) }}>{typeLabel(tp)}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tech */}
              <div className="jf-dd">
                <button className={`jf-dd-btn${techFilter ? ' on' : ''}`} onClick={e => { e.stopPropagation(); setOpenDropdown(openDropdown === 'tech' ? null : 'tech') }}>
                  {techFilter || t('jobs.filterTech')} <span className="jf-dd-arrow">▾</span>
                </button>
                {openDropdown === 'tech' && (
                  <div className="jf-dd-menu jf-dd-menu-scroll">
                    <button className={`jf-dd-item${!techFilter ? ' on' : ''}`} onClick={() => { setTechFilter(''); setOpenDropdown(null) }}>{t('jobs.filterAll')}</button>
                    {TECH_OPTIONS.map(tc => (
                      <button key={tc} className={`jf-dd-item${techFilter === tc ? ' on' : ''}`} onClick={() => { setTechFilter(tc); setOpenDropdown(null) }}>{tc}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reset */}
              {(roleFilter || typeFilter || expMin !== '' || expMax !== '' || techFilter || searchQuery) && (
                <button className="jf-reset" onClick={() => { setRoleFilter(''); setTypeFilter(''); setExpMin(''); setExpMax(''); setTechFilter(''); setSearchQuery('') }}>{t('jobs.filterReset')}</button>
              )}
            </div>
            </div>

            {/* Hot jobs section */}
            {jobs.length > 0 && !searchQuery && !roleFilter && !typeFilter && !techFilter && expMin === '' && expMax === '' && (() => {
              const now = new Date()
              const featuredJobs = jobs.filter(j => j.is_featured).sort((a, b) => (b.salary_max || 0) - (a.salary_max || 0)).slice(0, 4)
              let hotJobs
              if (featuredJobs.length >= 4) {
                hotJobs = featuredJobs
              } else {
                const closing = jobs
                  .filter(j => !j.is_featured && j.deadline && new Date(j.deadline) > now && Math.ceil((new Date(j.deadline) - now) / 86400000) <= 14)
                  .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                  .slice(0, 2)
                const noDeadline = jobs
                  .filter(j => !j.is_featured && !j.deadline && !closing.find(c => c.id === j.id))
                  .slice(0, 2)
                hotJobs = [...featuredJobs, ...closing, ...noDeadline].slice(0, 4)
              }
              if (hotJobs.length === 0) return null
              const fakeCount = (id) => 20 + (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 21
              return (
                <div className="jh">
                  <div className="jh-title"><span className="jh-trend"><span className="jh-trend-arrows"><svg className="jh-trend-arrow" width="12" height="6" viewBox="0 0 12 6"><polyline points="1,5 6,1 11,5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><svg className="jh-trend-arrow" width="12" height="6" viewBox="0 0 12 6"><polyline points="1,5 6,1 11,5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><svg className="jh-trend-arrow" width="12" height="6" viewBox="0 0 12 6"><polyline points="1,5 6,1 11,5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span></span>{t('jobs.hotTitle')}</div>
                  <div className="jg">
                    {hotJobs.map((job, idx) => {
                      const bump = getBump(job)
                      const matched = isProfileMatch(job)
                      const days = job.deadline ? Math.ceil((new Date(job.deadline) - now) / 86400000) : null
                      return (
                        <div key={job.id} className="jc" onClick={() => { setCarouselIdx(0); setDetailApplyMode(false); setApplied(false); setResumeFile(null); setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[idx % 3] }); track('click_job_card','jobs',{jobId:job.id,title:job.title,company:job.company}) }}>
                          <div className="jc-img">
                            <div className="jc-img-in" style={(() => { const hasImg = job.image_url || job.images?.[0]; const src = hasImg || job.logo_url || DEFAULT_IMAGES[idx % 3]; const mode = !hasImg && job.logo_url ? '60%' : 'cover'; return { background: `#fff url(${src}) center/${mode} no-repeat` } })()}>
                              {!job.is_featured && bump !== null && bump > 0 && (
                                <div className="jc-bump" dangerouslySetInnerHTML={{ __html: t('jobs.bumpVs', { bump }) }} />
                              )}
                              {!job.is_featured && matched && <div className="jc-match" style={bump > 0 ? { top: 38 } : undefined}>{t('jobs.profileBadge')}</div>}
                              <button className="jc-bm" aria-label="Bookmark" onClick={e => { e.stopPropagation(); toggleBookmark(job.id) }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarks.includes(job.id) ? '#ff4400' : 'none'} stroke={bookmarks.includes(job.id) ? '#ff4400' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                </svg>
                              </button>
                              {(() => {
                                const s = formatSalaryCard(job)
                                const hasType = job.type === 'remote' || job.type === 'hybrid'
                                const hasHigh = s.min >= highSalaryThreshold
                                if (!hasType && !hasHigh) return null
                                return (
                                  <div className="jc-badges">
                                    {hasHigh && <span className="jc-type-badge highpay">{t('jobs.highPay')}</span>}
                                    {hasType && <span className={`jc-type-badge ${job.type}`}>{typeLabel(job.type)}</span>}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                          <div className="jc-body">
                            <div className="jc-t">{job.title}</div>
                            <div className="jc-co">{job.company}</div>
                            <div className="jc-bottom">
                              <div className="jc-m">
                                {[
                                  !job.experience_min && !job.experience_max ? t('jobs.yearsAny') : job.experience_max >= 30 ? t('jobs.yearsMin', { min: job.experience_min || 0 }) : t('jobs.years', { min: job.experience_min, max: job.experience_max }),
                                  typeLabel(job.type),
                                  days !== null ? (days === 0 ? (lang === 'vi' ? t('jobs.ddayToday') : 'D-Day') : (lang === 'vi' ? t('jobs.dday', { days }) : `D-${days}`)) : t('jobs.hotUntilFilled'),
                                ].filter(Boolean).join(' · ')}
                              </div>
                              {(() => {
                                const sal = formatSalaryCard(job)
                                return (
                                  <div className="jc-sal">
                                    {Math.round(sal.min / 1e6)}M – {Math.round(sal.max / 1e6)}M VND
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="jh-divider" />
                </div>
              )
            })()}

            {!jobsLoaded && (
              <div className="jg jg-skeleton">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="jc jc-skel">
                    <div className="jc-img"><div className="jc-skel-img shimmer" /></div>
                    <div className="jc-body">
                      <div className="jc-skel-line shimmer" style={{ width: '70%', height: 14, marginBottom: 8 }} />
                      <div className="jc-skel-line shimmer" style={{ width: '50%', height: 12, marginBottom: 6 }} />
                      <div className="jc-skel-line shimmer" style={{ width: '40%', height: 12 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div ref={barPlaceholderRef} style={{ height: barFixed ? 44 : 0 }} />
            <div className={`jf-bar${barFixed ? ' jf-bar-fixed' : ''}`} style={{ visibility: jobsLoaded ? 'visible' : 'hidden', ...(barFixed ? { top: barTop } : {}) }}>
              <div className="jf-bar-l">
                <div className="jf-count">{t('jobs.matchCount', { count: filteredJobs.length })}</div>
                <label className="jf-check">
                  <input type="checkbox" checked={hideExpired} onChange={e => { setHideExpired(e.target.checked) }} />
                  <span>{t('jobs.hideExpired')}</span>
                </label>
              </div>
              <div className="jf-sort">
                {['spread','latest','deadline'].map(key => (
                  <button key={key} className={`jf-sort-btn${sortBy === key ? ' on' : ''}`} onClick={() => { setSortBy(key) }}>{t(`jobs.sort.${key}`)}</button>
                ))}
                {bookmarks.length > 0 && (
                  <button className={`jf-sort-btn jf-sort-saved${sortBy === 'saved' ? ' on' : ''}`} onClick={() => { setSortBy(sortBy === 'saved' ? 'spread' : 'saved') }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={sortBy === 'saved' ? '#ff4400' : 'none'} stroke={sortBy === 'saved' ? '#ff4400' : 'currentColor'} strokeWidth="2.5" style={{ marginRight: 4 }}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                    {t('jobs.saved')} ({bookmarks.length})
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            {(() => {
              const visibleJobs = filteredJobs.slice(0, visibleCount)
              return (
                <>
                  <div className="jg" style={{ opacity: jobsLoaded ? 1 : 0, transition: 'opacity .3s' }}>
                    {visibleJobs.map((job, idx) => {
                      const bump = getBump(job)
                      const matched = isProfileMatch(job)
                      return (
                        <div key={job.id} className="jc" onClick={() => { setCarouselIdx(0); setDetailApplyMode(false); setApplied(false); setResumeFile(null); setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[idx % 3] }); track('click_job_card','jobs',{jobId:job.id,title:job.title,company:job.company}) }}>
                          <div className="jc-img">
                            <div className="jc-img-in" style={(() => { const hasImg = job.image_url || job.images?.[0]; const src = hasImg || job.logo_url || DEFAULT_IMAGES[idx % 3]; const mode = !hasImg && job.logo_url ? '60%' : 'cover'; return { background: `#fff url(${src}) center/${mode} no-repeat` } })()}>
                              {!job.is_featured && bump !== null && bump > 0 && (
                                <div className="jc-bump" dangerouslySetInnerHTML={{ __html: t('jobs.bumpVs', { bump }) }} />
                              )}
                              {!job.is_featured && matched && <div className="jc-match" style={bump > 0 ? { top: 38 } : undefined}>{t('jobs.profileBadge')}</div>}
                              <button className="jc-bm" aria-label="Bookmark" onClick={e => { e.stopPropagation(); toggleBookmark(job.id) }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarks.includes(job.id) ? '#ff4400' : 'none'} stroke={bookmarks.includes(job.id) ? '#ff4400' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                </svg>
                              </button>
                              {(() => {
                                const s = formatSalaryCard(job)
                                const hasType = job.type === 'remote' || job.type === 'hybrid'
                                const hasHigh = s.min >= highSalaryThreshold
                                if (!hasType && !hasHigh) return null
                                return (
                                  <div className="jc-badges">
                                    {hasHigh && <span className="jc-type-badge highpay">{t('jobs.highPay')}</span>}
                                    {hasType && <span className={`jc-type-badge ${job.type}`}>{typeLabel(job.type)}</span>}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                          <div className="jc-body">
                            <div className="jc-t">{job.title}</div>
                            <div className="jc-co">{job.company}</div>
                            <div className="jc-bottom">
                              <div className="jc-m">
                                {[
                                  !job.experience_min && !job.experience_max ? t('jobs.yearsAny') : job.experience_max >= 30 ? t('jobs.yearsMin', { min: job.experience_min || 0 }) : t('jobs.years', { min: job.experience_min, max: job.experience_max }),
                                  job.type !== 'remote' && job.location,
                                  typeLabel(job.type),
                                ].filter(Boolean).join(' · ')}
                                {job.deadline && (() => {
                                  const days = Math.ceil((new Date(job.deadline) - new Date()) / 86400000)
                                  if (days < 0) return null
                                  return <span className={`jc-dday${days <= 7 ? ' urgent' : ''}`}>{lang === 'vi' ? (days === 0 ? t('jobs.ddayToday') : t('jobs.dday', { days })) : days === 0 ? 'D-Day' : `D-${days}`}</span>
                                })()}
                              </div>
                              {(() => {
                                const sal = formatSalaryCard(job)
                                return (
                                  <div className="jc-sal">
                                    {Math.round(sal.min / 1e6)}M – {Math.round(sal.max / 1e6)}M VND
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {visibleCount < filteredJobs.length && <div ref={loadMoreCallback} style={{ height: 1 }} />}
                </>
              )
            })()}
          </div>
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
                    backgroundImage: `url(${uniqueImgs[carouselIdx % uniqueImgs.length]})`,
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
                <div className="jd-co-ini">{detailJob.company_initials || detailJob.company.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="jd-co-name">{detailJob.company}</div>
                  <div className="jd-co-loc">
                    {detailJob.location} · {typeLabel(detailJob.type)}
                    {detailJob.company_url && <> · <a href={detailJob.company_url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff4400', textDecoration: 'none' }}>Website</a></>}
                  </div>
                </div>
              </div>

              {/* Title & Salary */}
              <div className="jd-title">{detailJob.title}</div>
              {detailJob.salary_min > 0 && (
                <div className="jd-salary">{Math.round(detailJob.salary_min / 1e6)}M – {Math.round(detailJob.salary_max / 1e6)}M VND</div>
              )}

              {/* Tech Stack */}
              {detailJob.tech_stack?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {detailJob.tech_stack.map(t => (
                    <span key={t} style={{ fontSize: 12, fontWeight: 600, color: '#333', background: '#f0f0f0', padding: '4px 10px', borderRadius: 5 }}>{t}</span>
                  ))}
                </div>
              )}

              {/* Meta grid */}
              <div className="jd-meta-grid">
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.experience')}</div>
                  <div className="jd-meta-value">{!detailJob.experience_min && !detailJob.experience_max ? t('jobs.yearsAny') : detailJob.experience_max >= 30 ? t('jobs.yearsMin', { min: detailJob.experience_min || 0 }) : t('jobs.years', { min: detailJob.experience_min, max: detailJob.experience_max })}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.position')}</div>
                  <div className="jd-meta-value">{detailJob.role}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.type')}</div>
                  <div className="jd-meta-value">{typeLabel(detailJob.type)}</div>
                </div>
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.region')}</div>
                  <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{detailJob.country}</div>
                </div>
                {detailJob.company_size && (
                  <div className="jd-meta-item">
                    <div className="jd-meta-label">Company Size</div>
                    <div className="jd-meta-value">{detailJob.company_size}</div>
                  </div>
                )}
                {detailJob.headcount && (
                  <div className="jd-meta-item">
                    <div className="jd-meta-label">Headcount</div>
                    <div className="jd-meta-value">{detailJob.headcount}</div>
                  </div>
                )}
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Deadline</div>
                  <div className="jd-meta-value">{detailJob.deadline ? (() => {
                    const days = Math.ceil((new Date(detailJob.deadline) - new Date()) / 86400000)
                    const ddayText = lang === 'vi' ? (days === 0 ? t('jobs.ddayToday') : days > 0 ? t('jobs.dday', { days }) : 'Đã đóng') : days >= 0 ? `D-${days}` : 'Closed'
                    return `${detailJob.deadline} (${ddayText})`
                  })() : t('jobs.ongoing')}</div>
                </div>
              </div>

              <div className="jd-divider" />

              {/* Company Information */}
              <div className="jd-section-title">Company Overview</div>
              <div className="jd-company-overview">
                <div className="jd-co-overview-header">
                  <div className={`jd-co-overview-badge ${aiSummaryReady ? '' : 'ai-thinking'}`}>
                    {aiSummaryReady ? 'AI Summary' : 'Analyzing...'}
                  </div>
                </div>
                {!aiSummaryReady ? (
                  <div className="ai-loading">
                    <div className="ai-loading-line shimmer" style={{ width: '100%' }} />
                    <div className="ai-loading-line shimmer" style={{ width: '92%' }} />
                    <div className="ai-loading-line shimmer" style={{ width: '85%' }} />
                    <div className="ai-loading-line shimmer" style={{ width: '96%' }} />
                    <div className="ai-loading-line shimmer" style={{ width: '70%' }} />
                    <div className="ai-loading-line shimmer" style={{ width: '88%' }} />
                  </div>
                ) : (
                  <div className="ai-fade-in">
                    <div className="jd-co-overview-text">
                      {generateCompanyDescription(detailJob)}
                    </div>
                    {(() => {
                      const p = COMPANY_PROFILES[detailJob.company]
                      return (
                        <div className="jd-co-overview-stats">
                          <div className="jd-co-stat">
                            <div className="jd-co-stat-num">{p?.employees?.toLocaleString() || detailJob.company_size || '–'}+</div>
                            <div className="jd-co-stat-label">Employees</div>
                          </div>
                          <div className="jd-co-stat">
                            <div className="jd-co-stat-num">{p?.founded || '–'}</div>
                            <div className="jd-co-stat-label">Founded</div>
                          </div>
                          <div className="jd-co-stat">
                            <div className="jd-co-stat-num" style={{ fontSize: p?.revenue?.length > 10 ? 12 : 15 }}>{p?.revenue || 'Undisclosed'}</div>
                            <div className="jd-co-stat-label">Revenue</div>
                          </div>
                          <div className="jd-co-stat">
                            <div className="jd-co-stat-num" style={{ fontSize: p?.funding?.length > 12 ? 11 : 15 }}>{p?.funding || 'Undisclosed'}</div>
                            <div className="jd-co-stat-label">Funding</div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="jd-divider" />

              {/* Work Information */}
              <div className="jd-section-title">Work Information</div>
              <div className="jd-work-info">
                <div className="jd-work-item">
                  <div className="jd-work-icon"><Icon name="calendar" size={18} color="#555" /></div>
                  <div>
                    <div className="jd-work-label">Work Days</div>
                    <div className="jd-work-value">Monday – Friday</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon"><Icon name="clock" size={18} color="#555" /></div>
                  <div>
                    <div className="jd-work-label">Work Hours</div>
                    <div className="jd-work-value">9:00 AM – 6:00 PM</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon"><Icon name="mapPin" size={18} color="#555" /></div>
                  <div>
                    <div className="jd-work-label">Work Type</div>
                    <div className="jd-work-value">{detailJob.type === 'remote' ? 'Fully Remote' : detailJob.type === 'hybrid' ? 'Hybrid (Office + Remote)' : 'On-site'}</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon"><Icon name="palmTree" size={18} color="#555" /></div>
                  <div>
                    <div className="jd-work-label">Paid Leave</div>
                    <div className="jd-work-value">12+ days / year</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon"><Icon name="clipboard" size={18} color="#555" /></div>
                  <div>
                    <div className="jd-work-label">Contract</div>
                    <div className="jd-work-value">Full-time (Permanent)</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon"><Icon name="hospital" size={18} color="#555" /></div>
                  <div>
                    <div className="jd-work-label">Insurance</div>
                    <div className="jd-work-value">Social & Health Insurance</div>
                  </div>
                </div>
              </div>

              <div className="jd-divider" />

              {/* Description */}
              <div className="jd-section-title">{t('jobs.about')}</div>
              <div className="jd-desc">
                {detailJob.description || `${detailJob.company} is looking for a ${detailJob.title} to join their team in ${detailJob.location}.\n\nThis is a ${detailJob.type} position offering ${Math.round(detailJob.salary_min / 1e6)}M–${Math.round(detailJob.salary_max / 1e6)}M VND, ideal for candidates with ${detailJob.experience_min}–${detailJob.experience_max} years of experience in ${detailJob.role}.\n\nOur headhunter team will personally introduce you and support you throughout the process.`}
              </div>

              {/* Benefits */}
              {detailJob.benefits?.length > 0 && (
                <>
                  <div className="jd-divider" />
                  <div className="jd-section-title">Benefits</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    {detailJob.benefits.map(b => (
                      <span key={b} style={{ fontSize: 13, color: '#166534', background: '#f0fff4', border: '1px solid #86efac', padding: '5px 12px', borderRadius: 6 }}>{b}</span>
                    ))}
                  </div>
                </>
              )}

              {/* Hiring Process */}
              {detailJob.hiring_process && (
                <>
                  <div className="jd-divider" />
                  <div className="jd-section-title">Hiring Process</div>
                  <div style={{ fontSize: 14, color: '#444', marginBottom: 24 }}>{detailJob.hiring_process}</div>
                </>
              )}

              <div className="jd-divider" />

              {/* Bump comparison */}
              {isSubmitted && userSalary && detailJob.salary_min > userSalary && (
                <div style={{
                  background: '#fff7f5', border: '1px solid #ffd6c8', borderRadius: 10,
                  padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name="trendUp" size={20} color="#ff4400" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                      {t('jobs.higherThanCurrent', { pct: Math.round(((detailJob.salary_min - userSalary) / userSalary) * 100) })}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      Your benchmark: {Math.round(userSalary / 1e6)}M VND → This role: {Math.round(detailJob.salary_min / 1e6)}M–{Math.round(detailJob.salary_max / 1e6)}M VND
                    </div>
                  </div>
                </div>
              )}

            </div>
            {/* Inline Apply Form */}
            {detailApplyMode && !applied && !appliedJobs.includes(detailJob.id) && (
              <div className="jd-apply-inline" ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                <div className="jd-apply-inline-h">{t('jobs.applyThis')}</div>

                <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>{t('jobs.cvRequired') || 'Resume (required)'}</div>
                <div className="ap-up" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && f.size <= 5 * 1024 * 1024) setResumeFile(f)
                    else if (f) alert('Max 5MB')
                  }} />
                  {resumeFile
                    ? <div className="ap-up-f">{resumeFile.name}</div>
                    : <div className="ap-up-t" style={{ whiteSpace: 'pre-line' }}>{t('jobs.dragCV')}</div>
                  }
                </div>

                <button className="jd-apply-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => {
                  if (!isLoggedIn) { localStorage.setItem('fyi_login_return', '/jobs'); supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } }); return; }
                  handleApply(detailJob);
                }} disabled={applying || !resumeFile}>
                  {!isLoggedIn ? t('jobs.loginToApply') : applying ? t('jobs.sending') : t('jobs.submitApplication')}
                </button>
              </div>
            )}

            {/* Floating Apply CTA */}
            {!detailApplyMode && (
              <div className="jd-apply-float">
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="jd-save-btn" onClick={() => toggleBookmark(detailJob.id)} title={bookmarks.includes(detailJob.id) ? t('jobs.saved') : t('jobs.save')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarks.includes(detailJob.id) ? '#ff4400' : 'none'} stroke={bookmarks.includes(detailJob.id) ? '#ff4400' : '#666'} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                  </button>
                  {appliedJobs.includes(detailJob.id) ? (
                    <button className="jd-apply-btn" disabled style={{ background: '#ccc', flex: 1 }}>
                      {t('jobs.applied')}
                    </button>
                  ) : (
                    <button className="jd-apply-btn" style={{ flex: 1 }} onClick={() => { setDetailApplyMode(true); track('click_apply_button','/jobs',{jobId:detailJob.id,title:detailJob.title,company:detailJob.company}) }}>
                      {t('jobs.apply')}
                    </button>
                  )}
                </div>
              </div>
            )}
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
                  <div className="ap-job-ini">{selectedJob.company_initials || selectedJob.company.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="ap-job-t">{selectedJob.title} — {selectedJob.company}</div>
                    {selectedJob.salary_min > 0 && <div className="ap-job-s">{Math.round(selectedJob.salary_min / 1e6)}M–{Math.round(selectedJob.salary_max / 1e6)}M VND</div>}
                  </div>
                </div>

                <div className="ap-lbl">{t('jobs.yourProfile')}</div>
                <div className="ap-tags">
                  {userRole && <div className="ap-tag">{userRole} · {userExperience || '—'} yrs</div>}
                  {userCompany && <div className="ap-tag">{t('jobs.currentAt', { company: userCompany, salary: userSalary ? Math.round(userSalary / 1e6) : '—' })}</div>}
                </div>

                <div className="ap-lbl">{t('jobs.cvRequired') || 'Resume (required)'}</div>
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
                  if (!isLoggedIn) { localStorage.setItem('fyi_login_return', '/jobs'); window.location.href = '/api/auth/google?return=' + encodeURIComponent('/jobs'); return; }
                  handleApply();
                }} disabled={applying || !resumeFile}>
                  {!isLoggedIn ? t('jobs.loginToApply') : applying ? t('jobs.sending') : t('jobs.submitApplication')}
                </button>
              </>
            ) : (
              <div className="ap-ok">
                <div className="ap-ok-i"><Icon name="check" size={24} color="#fff" /></div>
                <div className="ap-ok-h">{t('jobs.applied')}</div>
                <div className="ap-ok-p">{t('jobs.appliedSub')}</div>
                <button className="ap-skip" style={{ marginTop: 20 }} onClick={() => setShowPanel(false)}>{t('jobs.close')}</button>
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4400" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          {toast}
        </div>
      )}

      {showAuthModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
          onClick={e => { if(e.target===e.currentTarget) setShowAuthModal(false); }}>
          <div style={{background:'#fff',borderRadius:'20px',padding:'40px 36px',maxWidth:'420px',width:'100%',fontFamily:"'Barlow',sans-serif"}}>
            <div style={{fontSize:'24px',fontWeight:900,color:'#111',letterSpacing:'-0.5px',marginBottom:'8px'}}>{t('auth.title')}</div>
            <div style={{fontSize:'13px',color:'#888',marginBottom:'28px',lineHeight:1.6}}>{t('auth.sub')}</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button onClick={async () => { setShowAuthModal(false); localStorage.setItem('fyi_login_return', '/jobs'); try { await supabase.auth.signInWithOAuth({ provider:'linkedin_oidc', options:{ redirectTo: window.location.origin+'/auth/callback', scopes:'openid profile email' } }); } catch(e) { console.error(e); } }}
                style={{width:'100%',background:'#0A66C2',color:'#fff',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
                <span style={{fontWeight:900,fontSize:'16px'}}>in</span> {t('auth.linkedin')}
              </button>
              <button onClick={() => { setShowAuthModal(false); localStorage.setItem('fyi_login_return', '/jobs'); window.location.href = '/api/auth/google?return=' + encodeURIComponent('/jobs'); }}
                style={{width:'100%',background:'#f5f5f3',color:'#111',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
                <span style={{fontWeight:900,fontSize:'16px'}}>G</span> {t('auth.google')}
              </button>
              <button onClick={() => setShowAuthModal(false)}
                style={{background:'none',border:'none',color:'#bbb',fontSize:'12px',cursor:'pointer',fontFamily:"'Barlow',sans-serif",marginTop:'4px',width:'100%',textAlign:'center'}}>
                {t('auth.later')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
