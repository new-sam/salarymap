import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { getClientId, mirrorClarity } from '../lib/track'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import Icon from '../components/Icon'
import JobFilterModal from '../components/jobs/JobFilterModal'
import { DEFAULT_IMAGES, roleLabel, roleGroupKey, roleGroupLabel, jobInCategoryGroup, categoryGroupLabel, JOBS_PER_PAGE } from '../constants/jobs'
import { COMPANY_PROFILES } from '../data/companyProfiles.js'
import { formatSalaryCard, getHighSalaryThreshold } from '../utils/salary'
import { generateCompanyDescription } from '../utils/companyDescription'
import { getStoredUtm, getApplicationSource } from '../lib/utm'

function decodeHTML(str) {
  if (!str || typeof str !== 'string') return str
  const el = typeof document !== 'undefined' && document.createElement('textarea')
  if (!el) return str
  el.innerHTML = str
  return el.value
}

// Module-level: survives client-side navigation, resets on full page reload
let _cachedProfile = null

// 직무/근무형태/기술/경력 필터 매칭 — 본 목록과 필터 모달의 실시간 건수가 같은 로직을 공유한다.
// f: { roles, types, techs, expMin, expMax } — 배열은 다중선택(섹션 안 OR, 섹션 간 AND).
function matchesJobFilters(job, f) {
  if (f.roles.length > 0) {
    const hit = f.roles.some(rf => {
      // 광고 랜딩용 직군 묶음 — role 컬럼 우선 + 비IT는 제목분류(제조/사무 구분)
      // grp:ktc 는 직군이 아니라 source='ktc'(LikeLion KTC 시드) 전용 광고 랜딩.
      if (rf.startsWith('grp:')) return rf.slice(4) === 'ktc' ? job.source === 'ktc' : jobInCategoryGroup(job, rf.slice(4))
      if (rf.startsWith('cat:')) return roleGroupKey(job.role) === rf.slice(4)
      return job.role === rf
    })
    if (!hit) return false
  }
  if (f.types.length > 0 && !f.types.includes(job.type)) return false
  if (f.techs.length > 0) {
    const stack = job.tech_stack || []
    const hit = f.techs.some(tf => stack.some(t => t.toLowerCase().includes(tf.toLowerCase())))
    if (!hit) return false
  }
  if (f.expMin !== '' || f.expMax !== '') {
    const jobMin = job.experience_min || 0
    const jobMax = job.experience_max || 0
    if (!jobMin && !jobMax) return true // 경력 무관은 항상 포함
    const eMin = f.expMin !== '' ? Number(f.expMin) : 0
    const eMax = f.expMax !== '' ? Number(f.expMax) : 99
    if (jobMax < eMin || jobMin > eMax) return false
  }
  return true
}

// KTC 광고 랜딩(/jobs?role=grp:ktc)에서 최상단에 지정 순서대로 고정할 공고 ID.
const KTC_PRIORITY_IDS = [
  '5877ee3e-73f3-429c-84b9-6eca612a2fe1', // Lumicraft — Full-stack Developer
  '7a42601a-985a-45c3-9ab8-e1a48f1ea167', // Wellpod — TikTok Ads Marketing Manager
  'a7ce2e41-147b-4f36-bbef-bb3e7803485f', // Wellpod — TikTok Shop & Shopify Manager
  '29e88671-199a-405a-a8dd-a17b1c4bfcee', // Simco — Factory Supervisor (Quản đốc Nhà máy)
  'b52e7cb1-5c58-40d1-afa4-84f2b4cc4fd1', // Firts Marketing Company — ACCOUNT EXECUTIVE
  '7e3fae04-faa4-4a84-b2b0-afffebf08ca7', // Designbook — Front-end Publisher
  '3079bd21-a94a-4ee2-bbb6-315f88745ed2', // Designbook — PHP Backend Developer
  'c2111d3b-3b71-40ec-88be-7fb5a004a989', // SoundGraph — Mobile App QA & Technical Coordinator
  'e5fec906-df3a-4b14-aa3a-269eaf1382c5', // Camon Social — Pickleball Marketing Manager (Mid/Senior)
  '66bf6ff0-cc45-4735-b297-f843e556b40e', // Camon Social — Community & Event Marketing Executive
  '6a56d047-dab8-4a68-a631-31c5ba21136b', // Camon Social — Marketing Specialist (Mid/Senior)
]

// 지정 ID 목록을 순서대로 리스트 최상단으로 끌어올린다 (나머지는 기존 순서 유지).
function pinPriority(list, ids) {
  const rank = new Map(ids.map((id, i) => [id, i]))
  const pinned = list.filter(j => rank.has(j.id)).sort((a, b) => rank.get(a.id) - rank.get(b.id))
  const rest = list.filter(j => !rank.has(j.id))
  return [...pinned, ...rest]
}

// 스토리지 URL에서 원본 이력서 파일명 복원 (업로드 시 `${timestamp}_${safeName}`로 저장됨)
function resumeNameFromUrl(url) {
  try { return decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/^\d+_/, '') } catch { return 'resume' }
}

// 같은 회사·제목 공고 중복 제거 — 크롤러 중복 삽입 + 대소문자/공백 변형 방어.
// /api/jobs가 created_at desc 정렬이라 첫 항목(최신)이 유지된다.
function dedupeJobs(list) {
  const seen = new Set()
  return (list || []).filter(j => {
    const key = `${(j.company || '').trim().toLowerCase().replace(/\s+/g, ' ')}::${(j.title || '').trim().toLowerCase().replace(/\s+/g, ' ')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 핫 섹션·메인 그리드 공용 카드. 썸네일 오버레이는 좌상단 배지 1개(featured > bump > match),
// 우상단 북마크, 우하단 배지 1개(고연봉 > 근무형태)로 제한한다.
function JobCard({ job, idx, bump, matched, highSalaryThreshold, bookmarked, onOpen, onToggleBookmark, typeLabel, t, lang }) {
  const router = useRouter()
  const sal = formatSalaryCard(job)
  const hasImg = job.image_url || job.images?.[0]
  const src = hasImg || job.logo_url || DEFAULT_IMAGES[idx % 3]
  const mode = !hasImg && job.logo_url ? '60%' : 'cover'
  const days = job.deadline ? Math.ceil((new Date(job.deadline) - new Date()) / 86400000) : null
  const highPay = sal.min >= highSalaryThreshold
  const showType = job.type === 'remote' || job.type === 'hybrid'
  return (
    <div className={`jc${job.is_featured ? ' jc-featured' : ''}`} onClick={() => onOpen(job, idx)}>
      {job.is_featured && (
        <div className="jc-feat"><span>{t('jobs.featuredBadge')}</span></div>
      )}
      <div className="jc-img">
        <div className="jc-img-in" style={{ background: `#fff url(${src}) center/${mode} no-repeat` }}>
          {!job.is_featured && (bump !== null && bump > 0 ? (
            <div className="jc-bump" dangerouslySetInnerHTML={{ __html: t('jobs.bumpVs', { bump }) }} />
          ) : matched ? (
            <div className="jc-match">{t('jobs.profileBadge')}</div>
          ) : null)}
          <button className="jc-bm" aria-label="Bookmark" onClick={e => { e.stopPropagation(); onToggleBookmark(job.id) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? '#ff4400' : 'none'} stroke={bookmarked ? '#ff4400' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
          {(highPay || showType) && (
            <div className="jc-badges">
              {highPay
                ? <span className="jc-type-badge highpay">{t('jobs.highPay')}</span>
                : <span className={`jc-type-badge ${job.type}`}>{typeLabel(job.type)}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="jc-body">
        <div className="jc-t">{job.title}</div>
        <div className="jc-co jc-co-link" onClick={e => { e.stopPropagation(); router.push(`/companies/${encodeURIComponent(job.company)}`) }}>{job.company}</div>
        <div className="jc-bottom">
          <div className="jc-m">
            <span className="jc-m-txt">
              {[
                !job.experience_min && !job.experience_max ? t('jobs.yearsAny') : job.experience_max >= 30 ? t('jobs.yearsMin', { min: job.experience_min || 0 }) : t('jobs.years', { min: job.experience_min, max: job.experience_max }),
                job.type !== 'remote' && job.location,
                typeLabel(job.type),
              ].filter(Boolean).join(' · ')}
            </span>
            {days !== null && days >= 0 && (
              <span className={`jc-dday${days <= 7 ? ' urgent' : ''}`}>{days === 0 ? t('jobs.ddayToday') : t('jobs.ddayShort', { days })}</span>
            )}
          </div>
          <div className="jc-sal">{Math.round(sal.min / 1e6)}M – {Math.round(sal.max / 1e6)}M VND</div>
        </div>
      </div>
    </div>
  )
}

export default function JobsPage() {
  const router = useRouter()
  const fileRef = useRef(null)
  const { t, lang } = useT()

  const [jobs, setJobs] = useState([])
  const [jobsLoaded, setJobsLoaded] = useState(false)
  const highSalaryThreshold = useMemo(() => getHighSalaryThreshold(jobs), [jobs])
  const [searchQuery, setSearchQuery] = useState('')
  // 다중선택 배열(앱 필터와 동일). roles 항목은 소분류 value | 'cat:<대분류>' | 'grp:*'(광고 랜딩) 혼용 가능.
  const [roleFilters, setRoleFilters] = useState([])
  const [typeFilters, setTypeFilters] = useState([])
  const [expMin, setExpMin] = useState('')
  const [expMax, setExpMax] = useState('')
  const [techFilters, setTechFilters] = useState([])
  const [filterOpen, setFilterOpen] = useState(false) // 통합 필터 모달
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
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
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying] = useState(false)
  const [detailApplyMode, setDetailApplyMode] = useState(false)

  useEffect(() => {
    if (!detailJob) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') closeDetail() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [detailJob])
  const [bookmarks, setBookmarks] = useState([])
  const [appliedJobs, setAppliedJobs] = useState([])
  const [toast, setToast] = useState(null)
  const [appliedInfo, setAppliedInfo] = useState(null)
  const [showAiProfilePrompt, setShowAiProfilePrompt] = useState(null)
  const [aiParsing, setAiParsing] = useState(0)
  const [hasProfileResume, setHasProfileResume] = useState(false)
  const [profileResumeUrl, setProfileResumeUrl] = useState(null)
  const [similarApplying, setSimilarApplying] = useState(null)
  const [similarArmed, setSimilarArmed] = useState(null)
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE)

  const track = (event, page, meta) => {
    // userId/clientId 를 함께 보내야 유저 단위 dedup·퍼널 분석이 가능(lib/track.js 와 동일 기준).
    // getClientId()는 sm_cid 가 없으면 생성 — /jobs 로 직진입한 익명 방문자도 cid 를 갖게 된다.
    mirrorClarity(event)
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, page, meta, email: user?.email, userId: user?.id || null, clientId: getClientId() }) }).catch(() => {})
  }

  // Meta Pixel: job detail view
  useEffect(() => {
    if (!detailJob) return
    if (typeof fbq === 'function') fbq('track', 'ViewContent', { content_name: detailJob.title, content_category: detailJob.company, content_type: 'job' })
  }, [detailJob?.id])

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(JOBS_PER_PAGE) }, [searchQuery, roleFilters, typeFilters, techFilters, expMin, expMax, router.query.company])

  // 직무별 광고 딥링크: /jobs?role=Backend (또는 ?role=cat:software) 로 랜딩하면 해당 직무로
  // 바로 필터 → ATS(기업 직접등록) 공고가 최상단(companyFirst)에 떠서 우선 매칭·지원 유도.
  useEffect(() => {
    const r = router.query.role
    if (typeof r === 'string' && r) setRoleFilters([r])
  }, [router.query.role])

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
    // Mark this visit as coming from a salary submission so the application is
    // attributed to the 'salary' funnel even after navigating around the jobs page.
    if (params.get('from') === 'salary') {
      try { sessionStorage.setItem('fyi_apply_source', 'salary') } catch {}
    }
    // Persist the original landing referrer once, so non-UTM channel attribution
    // survives client-side navigation up to the moment the candidate applies.
    if (!sessionStorage.getItem('fyi_referrer') && document.referrer && !document.referrer.includes(window.location.host)) {
      const expires = new Date(Date.now() + 30 * 86400000).toUTCString()
      sessionStorage.setItem('fyi_referrer', document.referrer)
      document.cookie = `fyi_referrer=${encodeURIComponent(document.referrer)};path=/;expires=${expires};SameSite=Lax`
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
        // Load bookmarks from DB + check profile resume
        try {
          const [bRes, pRes] = await Promise.all([
            fetch('/api/job-bookmarks', { headers: { Authorization: `Bearer ${s.access_token}` } }),
            fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${s.access_token}` } }),
          ])
          const bData = await bRes.json()
          if (bData.bookmarks) {
            const ids = bData.bookmarks.map(b => b.job_id)
            setBookmarks(ids)
            localStorage.setItem('fyi_bookmarks', JSON.stringify(ids))
          }
          // /api/profile/talent은 { profile: {...} }로 감싸서 반환한다.
          const pData = await pRes.json()
          const pResume = pData.profile?.resume_url
          if (pResume) { setHasProfileResume(true); setProfileResumeUrl(pResume) }
        } catch { }
      }
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
          setJobs(dedupeJobs(d)); setJobsLoaded(true)
        }
      }).catch(() => {
        if (retries < 2) { retries++; setTimeout(load, 1000) }
        else setJobsLoaded(true)
      })
    }
    load()
  }, [])

  // 상세 패널 상태를 ?jobId= 쿼리와 동기화 — 딥링크로 열리고, 브라우저 뒤로가기로 닫힌다.
  useEffect(() => {
    const qId = router.query.jobId
    if (!qId) { setDetailJob(null); return }
    if (detailJob && String(detailJob.id) === String(qId)) return
    const found = jobs.find(j => String(j.id) === String(qId))
    if (found) { setCarouselIdx(0); setDetailApplyMode(false); setResumeFile(null); setDetailJob(found) }
  }, [router.query.jobId, jobs])

  const openDetail = (job, idx) => {
    setCarouselIdx(0); setDetailApplyMode(false); setResumeFile(null)
    setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[idx % 3] })
    router.push({ pathname: '/jobs', query: { ...router.query, jobId: job.id } }, undefined, { shallow: true, scroll: false })
    track('click_job_card', 'jobs', { jobId: job.id, title: job.title, company: job.company })
  }

  const closeDetail = () => {
    setDetailJob(null)
    if (router.query.jobId !== undefined) {
      const { jobId, ...rest } = router.query
      router.replace({ pathname: '/jobs', query: rest }, undefined, { shallow: true, scroll: false })
    }
  }

  // 상세 패널 열릴 때 무거운 필드(description/benefits/hiring_process)를 lazy fetch.
  // 리스트(/api/jobs)는 카드용 필드만 내려주므로 detailJob엔 이 필드들이 없다.
  useEffect(() => {
    const id = detailJob?.id
    if (!id || detailJob._full) return
    let cancelled = false
    fetch(`/api/jobs/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(full => {
        if (cancelled || !full) return
        // 카드 데이터(prev)를 우선 유지하고, 빠진 무거운 필드만 full에서 채운다.
        setDetailJob(prev => (prev && prev.id === full.id) ? { ...full, ...prev, _full: true } : prev)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [detailJob?.id])

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

  // 검색·회사·마감 제외만 적용된 목록 — 본 목록과 필터 모달의 실시간 건수가 공유한다.
  const baseFilteredJobs = (() => {
    const q = searchQuery.toLowerCase().trim()
    return jobs.filter(job => {
      if (companyQuery && job.company?.toLowerCase() !== companyQuery) return false
      if (q && !job.title?.toLowerCase().includes(q) && !job.company?.toLowerCase().includes(q)) return false
      if (hideExpired && job.deadline && new Date(job.deadline) < new Date()) return false
      return true
    })
  })()

  const filteredJobs = (() => {
    const filtered = baseFilteredJobs.filter(job =>
      matchesJobFilters(job, { roles: roleFilters, types: typeFilters, techs: techFilters, expMin, expMax })
    )
    // featured(프리미엄) 공고는 최상단 벽으로 쌓지 않고 5칸 간격으로 삽입 —
    // 노출 우선순위는 유지하되 첫 화면이 배지 도배가 되는 걸 방지 (featured끼리는 최신순)
    const pinFeatured = (list) => {
      const feat = list.filter(j => j.is_featured)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      const rest = list.filter(j => !j.is_featured)
      const out = []
      let fi = 0, ri = 0
      while (fi < feat.length || ri < rest.length) {
        if (out.length % 5 === 0 && fi < feat.length) out.push(feat[fi++])
        else if (ri < rest.length) out.push(rest[ri++])
        else out.push(feat[fi++])
      }
      return out
    }
    // 같은 회사가 3칸 안에 반복되면 뒤쪽의 다른 회사 공고와 교체 (한 화면 내 중복 노출 방지)
    const spaceCompanies = (list) => {
      const out = [...list]
      for (let i = 0; i < out.length; i++) {
        const recent = out.slice(Math.max(0, i - 3), i).map(j => j.company)
        if (recent.includes(out[i].company)) {
          const j = out.findIndex((x, k) => k > i && !recent.includes(x.company))
          if (j > -1) { const tmp = out[i]; out[i] = out[j]; out[j] = tmp }
        }
      }
      return out
    }
    // 기업이 직접 등록한 공고(source='company_self')는 크롤링 물량에 밀리지 않도록 항상 최상단 —
    // 단, 한 회사가 여러 개 올려도 뭉치지 않게 회사별 라운드로빈으로 분산(회사 내부는 최신순).
    // 명시적 정렬(최신/마감)에는 적용하지 않는다(유저 의도 존중).
    const companyFirst = (list) => {
      const co = list.filter(j => j.source === 'company_self')
      const rest = list.filter(j => j.source !== 'company_self')
      const byCompany = {}
      co.forEach(job => {
        const key = job.company || ''
        if (!byCompany[key]) byCompany[key] = []
        byCompany[key].push(job)
      })
      const queues = Object.values(byCompany)
      queues.forEach(q => q.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)))
      const spread = []
      while (queues.some(q => q.length > 0)) {
        for (const q of queues) {
          if (q.length > 0) spread.push(q.shift())
        }
      }
      return [...spread, ...rest]
    }
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
    // sortBy === 'spread' → 베트남 인지도순 (유명 기업 우선 + 같은 회사 분산)
    if (sortBy === 'spread') {
      const BRAND_RANK = {
        'VNG Corporation': 1, 'MoMo': 2, 'FPT Software': 3, 'FPT IS': 4,
        'Vietinbank': 5, 'MobiFone': 6, 'HEINEKEN Vietnam': 7, 'Viva Republica (Toss)': 8,
        'Samsung SDS': 9, 'NEC Vietnam': 10, 'Sendbird': 11, 'Lunit': 12,
        'Microsoft': 13, 'Amazon': 14, 'OpenAI': 15, 'xAI': 16,
        'Coupang': 17, 'Krafton': 18, 'Naver Pay': 19, 'Kakao Healthcare': 20,
        'CJ Olive Young': 21, 'Descente Korea': 22, 'Coinone': 23, 'SOOP': 24,
      }
      const getBrand = (company) => {
        for (const [name, rank] of Object.entries(BRAND_RANK)) {
          if (company?.includes(name)) return rank
        }
        return 999
      }
      filtered.sort((a, b) => getBrand(a.company) - getBrand(b.company))
      // 같은 회사 분산
      const byCompany = {}
      filtered.forEach(job => {
        const key = job.company || ''
        if (!byCompany[key]) byCompany[key] = []
        byCompany[key].push(job)
      })
      const queues = Object.entries(byCompany)
        .sort((a, b) => getBrand(a[0]) - getBrand(b[0]))
        .map(([, jobs]) => jobs)
      const spread = []
      while (queues.some(q => q.length > 0)) {
        for (const q of queues) {
          if (q.length > 0) spread.push(q.shift())
        }
      }
      // wanted/non-wanted 1:1 인터리빙
      const wanted = spread.filter(j => j.source === 'wanted')
      const other = spread.filter(j => j.source !== 'wanted')
      const result = []
      let wi = 0, oi = 0
      while (wi < wanted.length || oi < other.length) {
        if (oi < other.length) result.push(other[oi++])
        if (wi < wanted.length) result.push(wanted[wi++])
      }
      return companyFirst(pinFeatured(spaceCompanies(result)))
    }
    // wanted/non-wanted 1:1 인터리빙
    const interleave = (list) => {
      const wanted = list.filter(j => j.source === 'wanted')
      const other = list.filter(j => j.source !== 'wanted')
      const result = []
      let wi = 0, oi = 0
      while (wi < wanted.length || oi < other.length) {
        if (oi < other.length) result.push(other[oi++])
        if (wi < wanted.length) result.push(wanted[wi++])
      }
      return result
    }
    return pinFeatured(spaceCompanies(interleave(filtered)))
  })()

  const modalFilterCount = roleFilters.length + typeFilters.length + techFilters.length + (expMin !== '' || expMax !== '' ? 1 : 0)
  const activeFilterCount = modalFilterCount + (searchQuery ? 1 : 0)

  // 핫 섹션: 필터 없는 기본 뷰에서만. featured 우선, 부족하면 마감임박·고연봉으로 채움.
  // 핫에 노출된 공고는 아래 메인 그리드에서 제외해 같은 공고가 두 번 보이지 않게 한다.
  const hotJobs = (() => {
    if (jobs.length === 0 || activeFilterCount > 0 || companyQuery || sortBy === 'saved') return []
    const now = new Date()
    const hotScore = (j) => {
      let s = 0
      if (j.deadline && new Date(j.deadline) > now && Math.ceil((new Date(j.deadline) - now) / 86400000) <= 14) s += 50
      s += (j.salary_max || 0) / 1000
      return s
    }
    // 마감 지난 공고는 "적극 채용 중" 섹션에 부적합 — 제외
    const live = jobs.filter(j => !j.deadline || new Date(j.deadline) >= now)
    const featuredJobs = live.filter(j => j.is_featured)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    const fillJobs = live.filter(j => !j.is_featured).sort((a, b) => hotScore(b) - hotScore(a))
    return [...featuredJobs, ...fillJobs].slice(0, 4)
  })()
  const hotIds = new Set(hotJobs.map(j => j.id))
  const gridJobs = (() => {
    const base = hotJobs.length ? filteredJobs.filter(j => !hotIds.has(j.id)) : filteredJobs
    return roleFilters.includes('grp:ktc') ? pinPriority(base, KTC_PRIORITY_IDS) : base
  })()

  const resetFilters = () => { setRoleFilters([]); setTypeFilters([]); setExpMin(''); setExpMax(''); setTechFilters([]); setSearchQuery('') }

  const clearCompanyQuery = () => {
    const { company, ...rest } = router.query
    router.replace({ pathname: '/jobs', query: rest }, undefined, { shallow: true, scroll: false })
  }

  // 지원 완료 모달에 띄울 유사 공고 3개 — 목적은 기업 직접등록(company_self) 공고로 지원을
  // 몰아주는 것. 유사한 기업 등록 공고(정확 직무 일치 → 같은 대분류)를 전부 크롤 공고보다
  // 위에 놓고, 남는 슬롯만 비슷한 직무의 크롤 공고로 채운다. 무관 공고는 채우지 않고 회사
  // 중복은 제거. 'Non-IT'는 잡동사니 직군이라 대분류 완화 매칭에서 제외. 모달 오픈 시점에
  // 목록을 고정해 모달 안에서 지원해도 재배치되지 않게 appliedInfo에 담아둔다.
  const similarJobsFor = (target) => {
    const group = target.role && target.role !== 'Non-IT' ? roleGroupKey(target.role) : null
    const tier = (j) => {
      const exact = target.role && j.role === target.role
      const related = group && j.role !== 'Non-IT' && roleGroupKey(j.role) === group
      if (!exact && !related) return -1
      if (j.source === 'company_self') return exact ? 0 : 1
      return exact ? 2 : 3
    }
    const seenCompany = new Set()
    return jobs
      .filter(j => j.id !== target.id && !appliedJobs.includes(j.id))
      .map(j => ({ j, t: tier(j) }))
      .filter(x => x.t >= 0)
      .sort((a, b) => a.t - b.t)
      .filter(({ j }) => { if (seenCompany.has(j.company)) return false; seenCompany.add(j.company); return true })
      .map(x => x.j)
      .slice(0, 3)
  }

  // 지원 완료 모달의 유사 공고 원탭 지원 — 방금 지원에 쓴 이력서를 그대로 재사용한다.
  const applySimilar = async (job) => {
    if (!session || similarApplying || appliedJobs.includes(job.id)) return
    setSimilarApplying(job.id)
    const res = await fetch('/api/job-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        jobId: job.id,
        jobTitle: job.title,
        jobCompany: job.company,
        resumeUrl: appliedInfo?.resumeUrl || null,
        applicantRole: userRole,
        applicantExperience: userExperience,
        applicantSalary: userSalary,
        applicantCompany: userCompany,
        applicantEmail: session.user.email,
        applicantName: session.user.user_metadata?.full_name || '',
        ...getStoredUtm(),
        applicationSource: 'similar_after_apply',
      }),
    })
    setSimilarApplying(null)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(t('jobs.applyError', { error: err.error || 'unknown error' }))
      return
    }
    setAppliedJobs(prev => {
      const next = [...prev, job.id]
      localStorage.setItem('fyi_applied_jobs', JSON.stringify(next))
      return next
    })
    try {
      const cached = JSON.parse(localStorage.getItem('fyi_my_applications') || '[]')
      cached.unshift({
        id: Date.now(),
        job_id: job.id,
        job_title: job.title,
        job_company: job.company,
        status: 'applied',
        created_at: new Date().toISOString(),
      })
      localStorage.setItem('fyi_my_applications', JSON.stringify(cached))
    } catch {}
    track('apply_similar_job', '/jobs', { jobId: job.id, title: job.title, company: job.company })
    if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'job_apply_confirmed', content_category: job.title })
  }

  const handleApply = async (job) => {
    const target = job
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
        alert(t('jobs.cvUploadError', { error: upErr.message }))
        return
      }
      const { data } = supabase.storage.from('resumes').getPublicUrl(path)
      resumeUrl = data.publicUrl
    } else if (profileResumeUrl) {
      // 새 파일을 안 올렸으면 프로필에 등록된 이력서로 지원한다.
      resumeUrl = profileResumeUrl
    }
    const applyRes = await fetch('/api/job-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        jobId: target.id,
        jobTitle: target.title,
        jobCompany: target.company,
        resumeUrl,
        applicantRole: userRole,
        applicantExperience: userExperience,
        applicantSalary: userSalary,
        applicantCompany: userCompany,
        applicantEmail: session.user.email,
        applicantName: session.user.user_metadata?.full_name || '',
        // Use the attribution captured on landing — router.query is empty by apply time.
        ...getStoredUtm(),
        applicationSource: getApplicationSource(),
      }),
    })
    if (!applyRes.ok) {
      setApplying(false)
      const err = await applyRes.json().catch(() => ({}))
      alert(t('jobs.applyError', { error: err.error || 'unknown error' }))
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
    // Show success modal + push URL for Meta Pixel conversion tracking
    const similar = similarJobsFor(target)
    if (similar.length) track('view_similar_jobs_modal', '/jobs', { jobId: target.id, count: similar.length })
    setSimilarArmed(null)
    setAppliedInfo({ title: target.title, company: target.company, resumeUrl, similar })
    setDetailJob(null)
    window.history.pushState(null, '', `/jobs/applied?title=${encodeURIComponent(target.title)}&company=${encodeURIComponent(target.company)}`)
    if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'job_apply_confirmed', content_category: target.title })
  }

  // Kick off login for the apply flow. Return the user straight back to the open
  // job (via ?jobId=) so the detail panel reopens and they can submit their CV in
  // one authenticated step — instead of losing the panel + selected file and
  // landing on a bare page.
  const loginForJob = (jobId) => {
    const dest = jobId ? `/jobs?jobId=${jobId}` : '/jobs'
    localStorage.setItem('fyi_login_return', dest)
    // Use our own server-side Google flow, which fully controls the return path.
    // (Supabase's hosted signInWithOAuth falls back to the project Site URL — the
    //  salary homepage — whenever redirectTo isn't in the allow-list, which dropped
    //  users on the salary page instead of bringing them back to the job.)
    window.location.href = '/api/auth/google?return=' + encodeURIComponent(dest)
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ jobId }),
    }).catch(() => {})
  }

  return (
    <>
      <Head>
        <title>{t('jobs.title')}</title>
        <meta name="description" content="Curated IT jobs in Vietnam with higher pay. Our headhunter personally introduces you to top companies. Remote, Korean, and global opportunities." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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

        .jf-head { padding: 12px 0 4px; border-bottom: 1px solid #e8e8e8; }
        .jf-search { position: relative; margin-bottom: 16px; }
        .jf-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .jf-search-input { width: 100%; padding: 11px 36px 11px 40px; font-size: 14px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fafaf8; outline: none; transition: border-color .15s; font-family: inherit; }
        .jf-search-input:focus { border-color: #ff4400; }
        .jf-search-input::placeholder { color: #999; }
        .jf-search-clear { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 18px; color: #999; cursor: pointer; line-height: 1; }

        .jf { display: flex; gap: 8px; margin-bottom: 0; flex-wrap: wrap; align-items: center; }
        .jf-open { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #555; background: #fafaf8; border: 1px solid #e0e0e0; padding: 8px 14px; border-radius: 999px; cursor: pointer; font-family: inherit; white-space: nowrap; transition: all .15s; }
        .jf-open:hover { border-color: #999; }
        .jf-open.on { color: #ff4400; border-color: #ff4400; background: #fff2ec; }
        .jf-open-n { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; height: 17px; border-radius: 50%; background: #ff4400; color: #fff; font-size: 11px; font-weight: 800; padding: 0 4px; }
        .jf-sum { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: #ff4400; background: #fff2ec; border: 1px solid rgba(255,68,0,0.25); border-radius: 999px; padding: 7px 12px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .jf-sum-x { font-size: 14px; line-height: 1; color: rgba(255,68,0,0.7); }
        .jf-dd { position: relative; }
        .jf-dd-btn { font-size: 13px; font-weight: 500; color: #555; background: #fafaf8; border: 1px solid #e0e0e0; padding: 8px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .15s; white-space: nowrap; font-family: inherit; }
        .jf-dd-btn:hover { border-color: #999; }
        .jf-dd-btn.on { background: #111; color: #fff; border-color: #111; font-weight: 600; }
        .jf-dd-arrow { font-size: 10px; opacity: 0.5; }
        .jf-dd-menu { position: absolute; top: calc(100% + 4px); left: 0; background: #fafaf8; border: 1px solid #eee; border-radius: 10px; padding: 4px; min-width: 160px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jf-dd-menu-scroll { max-height: 260px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #d5d5d5 transparent; }
        .jf-dd-menu-scroll::-webkit-scrollbar { width: 6px; }
        .jf-dd-menu-scroll::-webkit-scrollbar-thumb { background: #d5d5d5; border-radius: 6px; }
        .jf-dd-menu-scroll::-webkit-scrollbar-track { background: transparent; }
        .jf-dd-item { display: block; width: 100%; padding: 9px 12px; border: none; background: none; font-size: 13px; color: #333; cursor: pointer; text-align: left; border-radius: 6px; transition: background .1s; font-family: inherit; white-space: nowrap; }
        .jf-dd-item:hover { background: #f5f5f5; }
        .jf-dd-item.on { color: #ff4400; font-weight: 600; }
        .jf-dd-cat { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 600; color: #191F28; }
        .jf-dd-caret { font-size: 10px; color: #bbb; transition: transform .15s; }
        .jf-dd-cat.open .jf-dd-caret { transform: rotate(180deg); }
        .jf-dd-branch { padding-left: 12px; }
        .jf-dd-sub { color: #666; font-weight: 500; }
        .jf-dd-count { color: #bbb; font-weight: 500; font-size: 12px; }
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

        .jf-bar { position: sticky; top: 56px; z-index: 15; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; background: #f7f7f5; padding: 10px 0; border-bottom: 1px solid #ececea; }
        .jf-bar-l { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .jf-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #555; background: #fafaf8; border: 1px solid #e0e0e0; border-radius: 999px; padding: 5px 12px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .jf-chip:hover { border-color: #999; }
        .jf-chip-n { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; border-radius: 50%; background: #ff4400; color: #fff; font-size: 10px; font-weight: 800; padding: 0 4px; }
        .jf-chip-x { font-size: 14px; color: #999; line-height: 1; }
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
        .jh-divider { height: 1px; background: #eee; margin-top: 32px; }

        .jg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; align-items: stretch; }

        /* Card */
        .jc { cursor: pointer; display: flex; flex-direction: column; min-width: 0; position: relative; }
        .jc-match { position: absolute; top: 10px; left: 10px; background: #ff4400; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; z-index: 2; }
        /* 적극 채용중 — 앱과 동일하게 사진 밖, 카드 상단 선 가운데에 반쯤 걸치는 알약 */
        .jc-feat { position: absolute; top: -9px; left: 12px; right: 0; z-index: 4; display: flex; justify-content: flex-start; pointer-events: none; }
        .jc-feat span { max-width: 85%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: linear-gradient(135deg, #ff4400 0%, #ff6b35 100%); color: #fff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px; letter-spacing: 0.2px; box-shadow: 0 2px 8px rgba(255,68,0,0.32); }
        .jc-img { border-radius: 8px; overflow: hidden; position: relative; padding-top: 62%; margin-bottom: 11px; background: #f0f0f0; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.06); }
        .jc-featured .jc-img { border-color: rgba(255,68,0,0.55); }
        .jc-img-in { position: absolute; inset: 0; transition: transform .25s ease; background-color: #f0f0f0; background-size: cover; background-position: center; background-repeat: no-repeat; }
        .jc:hover .jc-img-in { transform: scale(1.04); }
        .jc-bump { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.62); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 4px; z-index: 2; }
        .jc-bump b { color: #ff4400; font-weight: 700; }
        .jc-bm { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(250,250,248,0.92); display: flex; align-items: center; justify-content: center; z-index: 2; border: none; cursor: pointer; }
        .jc-body { flex: 1; display: flex; flex-direction: column; }
        .jc-t { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 3px; line-height: 1.35; min-height: 2.7em; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .jc-co { font-size: 13px; color: #777; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jc-co-link { cursor: pointer; display: inline-block; max-width: 100%; }
        .jc-co-link:hover { color: #ff4400; text-decoration: underline; }
        .jd-co-link { cursor: pointer; text-decoration: none; }
        .jd-co-link:hover { color: #ff4400; text-decoration: underline; }
        .jc-sal { font-size: 15px; font-weight: 800; color: #ff4400; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; }
        .jc-bottom { margin-top: auto; }
        .jc-m { font-size: 12px; color: #999; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .jc-m-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jc-m b { color: #ff4400; font-weight: 700; }
        .jc-tag { font-size: 11px; font-weight: 500; color: #555; background: #f0f0f0; padding: 2px 7px; border-radius: 4px; }
        .jc-tag-more { color: #999; }
        .jc-badges { position: absolute; bottom: 10px; right: 10px; display: flex; gap: 4px; z-index: 2; }
        .jc-type-badge { font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 4px; letter-spacing: 0.3px; }
        .jc-type-badge.remote { color: #fff; background: #16a34a; }
        .jc-type-badge.hybrid { color: #fff; background: #2563eb; }
        .jc-type-badge.highpay { color: #fff; background: #ff4400; }
        .jc-dday { display: inline-flex; align-items: center; flex-shrink: 0; font-size: 11px; font-weight: 700; color: #ff4400; background: #fff7f5; border: 1px solid #ffd6c8; padding: 1px 6px; border-radius: 4px; line-height: 1.4; white-space: nowrap; }
        .jc-dday.urgent { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
        /* Empty state */
        .jg-empty { text-align: center; padding: 72px 20px; }
        .jg-empty-i { font-size: 30px; margin-bottom: 12px; }
        .jg-empty-t { font-size: 15px; font-weight: 600; color: #555; margin-bottom: 16px; }
        .jg-empty-b { font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-family: inherit; }

        /* CV upload box (inline apply) */
        .ap-up { border: 1.5px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 20px; transition: border-color .15s; }
        .ap-up:hover { border-color: #999; }
        .ap-file { display: flex; align-items: center; gap: 10px; border: 1px solid #eee; background: #fafafa; border-radius: 8px; padding: 12px 14px; text-align: left; }
        .ap-file-name { font-size: 13px; font-weight: 600; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ap-file-sub { font-size: 11.5px; color: #999; margin-top: 2px; }
        .ap-file-swap { display: block; width: 100%; margin: 8px 0 20px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; font-weight: 600; color: #555; cursor: pointer; font-family: inherit; transition: border-color .15s; }
        .ap-file-swap:hover { border-color: #999; }
        /* 지원 완료 모달 유사 공고 — CV 완료 모달(.cvm-*)과 같은 패턴, 액센트만 jobs 브랜드(#ff4400) */
        .sim-job { display: flex; align-items: center; gap: 12px; border: 1px solid #ece5db; border-radius: 12px; padding: 12px 13px; }
        .sim-job-logo { flex-shrink: 0; width: 42px; height: 42px; border-radius: 10px; background-color: #f3eee6; background-size: cover; background-position: center; background-repeat: no-repeat; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: #b09a7f; }
        .sim-job-title { font-size: 14px; font-weight: 700; color: #1a1612; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sim-job-company { font-size: 12.5px; color: #8a8073; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sim-apply { flex-shrink: 0; min-width: 84px; text-align: center; font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; border-radius: 9px; padding: 9px 14px; cursor: pointer; font-family: inherit; transition: opacity .15s; }
        .sim-apply:disabled { cursor: default; }
        .sim-apply.applying { opacity: 0.55; }
        /* 오터치 방지 2탭: 첫 탭에서 확인 상태로 전환 */
        .sim-apply.arm { background: #fff1e8; color: #ff4400; box-shadow: inset 0 0 0 1.5px #ff4400; }
        .sim-apply.done { background: #E7F6EC; color: #16a34a; }
        /* 지원 완료 모달 체크 모션: 원이 팝(overshoot)으로 뜨고 이어서 체크가 그려진다 */
        .applied-check { width: 56px; height: 56px; border-radius: 50%; background: #ff4400; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; animation: appliedPop .45s cubic-bezier(.34,1.56,.64,1) both; }
        .applied-check-path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: appliedDraw .3s ease-out .3s forwards; }
        @keyframes appliedPop { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes appliedDraw { to { stroke-dashoffset: 0; } }
        .ap-up-t { font-size: 13px; color: #999; }
        .ap-up-f { font-size: 13px; color: #111; font-weight: 600; }

        /* Job Detail Panel */
        .jd-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 60; }
        .jd { position: fixed; top: 0; right: 0; width: 50%; height: 100vh; height: 100dvh; background: #fafaf8; z-index: 61; overflow-y: auto; overscroll-behavior: contain; animation: jdSlide .3s ease; box-shadow: -8px 0 40px rgba(0,0,0,0.1); }
        @keyframes jdSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .jd-x { position: absolute; top: 16px; right: 20px; font-size: 24px; color: #999; cursor: pointer; background: none; border: none; z-index: 2; line-height: 1; }
        .jd-back { display: none; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; background: #fafaf8; font-size: 14px; font-weight: 600; color: #333; cursor: pointer; border: none; width: 100%; flex-shrink: 0; }
        .jd-scroll { display: contents; }
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
        .jd-comm-cta { display: flex; align-items: center; gap: 14px; padding: 16px 18px; margin-bottom: 24px; border: 1px solid #ffd6c8; background: #fff7f5; border-radius: 12px; text-decoration: none; transition: border-color .15s, box-shadow .15s; animation: aiFadeIn 0.6s ease-out 0.2s both; }
        .jd-comm-cta:hover { border-color: #ff8a3d; box-shadow: 0 2px 12px rgba(255,68,0,0.08); }
        .jd-comm-cta-emoji { font-size: 26px; line-height: 1; flex-shrink: 0; }
        .jd-comm-cta-body { flex: 1; min-width: 0; }
        .jd-comm-cta-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 3px; }
        .jd-comm-cta-co { color: #ff4400; font-weight: 800; }
        .jd-comm-cta-desc { font-size: 13px; color: #777; line-height: 1.5; }
        .jd-comm-cta-btn { flex-shrink: 0; padding: 9px 16px; border-radius: 999px; background: #ff4400; color: #fff; font-size: 13px; font-weight: 700; white-space: nowrap; }
        @media (max-width: 560px) { .jd-comm-cta { flex-wrap: wrap; } .jd-comm-cta-btn { width: 100%; text-align: center; } }
        .jd-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }

        /* Company Overview */
        .jd-company-overview { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); border: 1px solid #e0e7ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
        .jd-co-overview-text { font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 16px; white-space: pre-line; }
        .jd-co-overview-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e0e7ff; padding-top: 14px; }
        .jd-co-stat { flex: 1; text-align: center; }
        .jd-co-stat { padding: 8px 0; }
        .jd-co-stat:nth-child(odd) { border-right: 1px solid #e0e7ff; }
        .jd-co-stat-num { font-size: 15px; font-weight: 800; color: #111; }
        .jd-co-stat-label { font-size: 11px; color: #777; margin-top: 2px; }

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
        .toast { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(20px); background: #222; color: #fff; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 10px; z-index: 100002; opacity: 0; animation: toastIn .25s ease forwards; box-shadow: 0 6px 24px rgba(0,0,0,0.25); pointer-events: none; display: flex; align-items: center; gap: 8px; }
        @keyframes toastIn { to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .jd-apply-inline { padding: 20px 32px 24px; border-top: 1px solid #f0f0f0; }
        .jd-apply-inline-h { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 14px; }
        .jd-login-box { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 10px; padding: 16px 20px; text-align: center; margin-top: 8px; }
        .jd-login-text { font-size: 13px; color: #777; margin-bottom: 10px; }
        .jd-login-btn { background: #ff4400; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; }

        /* Pagination */

        @media (max-width: 900px) { .jg { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 768px) {
          .jw { padding: 28px 16px 60px; }
          .jw-h1 { font-size: 20px; }
          .jg { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
          .jbm { padding: 12px 14px; gap: 10px; }
          .jbm-icon { width: 30px; height: 30px; border-radius: 8px; }
          .jbm-icon svg { width: 15px; height: 15px; }
          .jbm-tag { font-size: 12px; padding: 3px 8px; }
          .jf { gap: 6px; }
          .jf-dd-btn { font-size: 12px; padding: 7px 10px; }
          .jf-bar { top: 52px; transition: top .25s ease; }
          /* 헤더가 스크롤로 숨으면(_app.js) 매칭 카운트 바도 최상단에 붙인다. */
          body[data-chrome-hidden="1"] .jf-bar { top: 0; }
          .jf-sort { flex-wrap: wrap; }
          .jf-sort-btn { font-size: 12px; padding: 6px 10px; }
          .jd { width: 100%; top: 52px; height: calc(100vh - 52px); height: calc(100dvh - 52px); z-index: 100000; padding-bottom: calc(68px + env(safe-area-inset-bottom)); }
          /* 헤더가 스크롤로 숨은 상태(매칭 바가 top:0으로 올라옴)에서 상세를 열면 상단 52px에
             매칭 바가 비친다 — 상세 패널도 최상단부터 전체를 덮는다. */
          body[data-chrome-hidden="1"] .jd { top: 0; height: 100vh; height: 100dvh; }
          .jd-x { display: none; }
          .jd-back { display: flex !important; position: sticky; top: 0; z-index: 3; }
          .jd-body { padding: 20px 16px 32px; }
          .jd-img { max-height: 280px; }
          .jd-title { font-size: 18px; }
          .jd-co-overview-stats { grid-template-columns: 1fr 1fr; }
          .jd-apply-float { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fafaf8; border-top: 1px solid #f0f0f0; z-index: 100001; }
          .jd-save-btn { width: 44px; height: 44px; }
          .jd-apply-btn { padding: 12px; font-size: 14px; }
          .toast { font-size: 13px; padding: 10px 20px; bottom: calc(24px + env(safe-area-inset-bottom)); }
        }
        @media (max-width: 480px) {
          .jg { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          /* padding-top: overflow-x:auto가 overflow-y도 auto로 만들어 카드 위로 -9px 걸친 '적극채용중' 칩이 잘린다 — 위쪽 여유를 준다. */
          .jh .jg { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; gap: 14px; padding-top: 14px; padding-bottom: 8px; grid-template-columns: none; }
          .jh .jg::-webkit-scrollbar { display: none; }
          /* flex-basis 고정 — min-width만 주면 nowrap 내용 길이에 따라 카드 폭이 제각각 커진다. */
          .jh .jg > .jc { flex: 0 0 60%; scroll-snap-align: start; }
        }
        .jc-skel .jc-skel-img { position: absolute; inset: 0; border-radius: 8px; background: #e9e9e9; }
        .jc-skel-line { border-radius: 4px; background: #e9e9e9; }
        .shimmer { background: linear-gradient(90deg, #e9e9e9 25%, #f5f5f5 50%, #e9e9e9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

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

            {/* Search + Filters */}
            <div className="jf-head">
            <div className="jf-search">
              <svg className="jf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="jf-search-input" placeholder={t('jobs.searchPlaceholder')} value={searchQuery} onChange={e => { setSearchQuery(e.target.value) }} />
              {searchQuery && <button className="jf-search-clear" onClick={() => setSearchQuery('')}>×</button>}
            </div>

            {/* 필터 — 드롭다운 4개 대신 버튼 하나 + 모달(탭·실시간 건수). 적용된 조건은 요약 칩으로 노출(× 탭 시 개별 해제). */}
            <div className="jf">
              <button className={`jf-open${modalFilterCount > 0 ? ' on' : ''}`} onClick={() => setFilterOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="17" x2="14" y2="17"/></svg>
                {t('jobs.filterModalTitle')}
                {modalFilterCount > 0 && <span className="jf-open-n">{modalFilterCount}</span>}
              </button>
              {roleFilters.map(rf => (
                <button key={rf} className="jf-sum" onClick={() => setRoleFilters(prev => prev.filter(x => x !== rf))}>
                  {rf.startsWith('grp:') ? categoryGroupLabel(rf.slice(4), lang) : rf.startsWith('cat:') ? roleGroupLabel(rf.slice(4), lang) : roleLabel(rf, lang)} <span className="jf-sum-x">×</span>
                </button>
              ))}
              {(expMin !== '' || expMax !== '') && (
                <button className="jf-sum" onClick={() => { setExpMin(''); setExpMax('') }}>
                  {`${expMin || 0} ~ ${expMax || 15}${t('jobs.expYears')}`} <span className="jf-sum-x">×</span>
                </button>
              )}
              {typeFilters.map(tf => (
                <button key={tf} className="jf-sum" onClick={() => setTypeFilters(prev => prev.filter(x => x !== tf))}>
                  {typeLabel(tf)} <span className="jf-sum-x">×</span>
                </button>
              ))}
              {techFilters.map(tf => (
                <button key={tf} className="jf-sum" onClick={() => setTechFilters(prev => prev.filter(x => x !== tf))}>
                  {tf} <span className="jf-sum-x">×</span>
                </button>
              ))}
              {activeFilterCount > 0 && (
                <button className="jf-reset" onClick={resetFilters}>{t('jobs.filterReset')}</button>
              )}
            </div>
            </div>

            {/* Hot jobs section */}
            {hotJobs.length > 0 && (
              <div className="jh">
                <div className="jh-title"><span className="jh-trend"><span className="jh-trend-arrows"><svg className="jh-trend-arrow" width="12" height="6" viewBox="0 0 12 6"><polyline points="1,5 6,1 11,5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><svg className="jh-trend-arrow" width="12" height="6" viewBox="0 0 12 6"><polyline points="1,5 6,1 11,5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><svg className="jh-trend-arrow" width="12" height="6" viewBox="0 0 12 6"><polyline points="1,5 6,1 11,5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span></span>{t('jobs.hotTitle')}</div>
                <div className="jg">
                  {hotJobs.map((job, idx) => (
                    <JobCard key={job.id} job={job} idx={idx} bump={getBump(job)} matched={isProfileMatch(job)}
                      highSalaryThreshold={highSalaryThreshold} bookmarked={bookmarks.includes(job.id)}
                      onOpen={openDetail} onToggleBookmark={toggleBookmark} typeLabel={typeLabel} t={t} lang={lang} />
                  ))}
                </div>
                <div className="jh-divider" />
              </div>
            )}

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

            <div className="jf-bar" style={{ visibility: jobsLoaded ? 'visible' : 'hidden' }}>
              <div className="jf-bar-l">
                <div className="jf-count">{t('jobs.matchCount', { count: filteredJobs.length })}</div>
                {companyQuery && (
                  <button className="jf-chip" onClick={clearCompanyQuery}>{String(router.query.company)} <span className="jf-chip-x">×</span></button>
                )}
                {activeFilterCount > 0 && (
                  <button className="jf-chip" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{t('jobs.filters')} <span className="jf-chip-n">{activeFilterCount}</span></button>
                )}
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
            <div className="jg" style={{ opacity: jobsLoaded ? 1 : 0, transition: 'opacity .3s' }}>
              {gridJobs.slice(0, visibleCount).map((job, idx) => (
                <JobCard key={job.id} job={job} idx={idx} bump={getBump(job)} matched={isProfileMatch(job)}
                  highSalaryThreshold={highSalaryThreshold} bookmarked={bookmarks.includes(job.id)}
                  onOpen={openDetail} onToggleBookmark={toggleBookmark} typeLabel={typeLabel} t={t} lang={lang} />
              ))}
            </div>
            {visibleCount < gridJobs.length && <div ref={loadMoreCallback} style={{ height: 1 }} />}

            {/* Empty state */}
            {jobsLoaded && filteredJobs.length === 0 && (
              <div className="jg-empty">
                <div className="jg-empty-i">🔍</div>
                <div className="jg-empty-t">{t('jobs.emptyTitle')}</div>
                {(activeFilterCount > 0 || companyQuery) && (
                  <button className="jg-empty-b" onClick={() => { resetFilters(); if (companyQuery) clearCompanyQuery() }}>{t('jobs.filterReset')}</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* JOB DETAIL PANEL */}
      {detailJob && (
        <>
          <div className="jd-bg" onClick={closeDetail} />
          <div className="jd">
            <button className="jd-x" onClick={closeDetail}>×</button>
            <button className="jd-back" onClick={closeDetail}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              {t('jobs.back') || 'Back'}
            </button>

            <div className="jd-scroll">
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
                  <Link href={`/companies/${encodeURIComponent(detailJob.company)}`} className="jd-co-name jd-co-link">{detailJob.company}</Link>
                  <div className="jd-co-loc">
                    {detailJob.location} · {typeLabel(detailJob.type)}
                    {detailJob.company_url && <> · <a href={detailJob.company_url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff4400', textDecoration: 'none' }}>{t('jobs.website')}</a></>}
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
                  <div className="jd-meta-value">{roleLabel(detailJob.role, lang)}</div>
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
                    <div className="jd-meta-label">{t('jobs.companySize')}</div>
                    <div className="jd-meta-value">{detailJob.company_size}</div>
                  </div>
                )}
                {detailJob.headcount && (
                  <div className="jd-meta-item">
                    <div className="jd-meta-label">{t('jobs.headcount')}</div>
                    <div className="jd-meta-value">{detailJob.headcount}</div>
                  </div>
                )}
                <div className="jd-meta-item">
                  <div className="jd-meta-label">{t('jobs.deadlineLabel')}</div>
                  <div className="jd-meta-value">{detailJob.deadline ? (() => {
                    const days = Math.ceil((new Date(detailJob.deadline) - new Date()) / 86400000)
                    const ddayText = lang === 'vi' ? (days === 0 ? t('jobs.ddayToday') : days > 0 ? t('jobs.dday', { days }) : t('jobs.closed')) : days >= 0 ? `D-${days}` : t('jobs.closed')
                    return `${detailJob.deadline} (${ddayText})`
                  })() : t('jobs.ongoing')}</div>
                </div>
              </div>

              <div className="jd-divider" />

              {/* Company Information */}
              <div className="jd-section-title">{t('jobs.companyOverview')}</div>
              <div className="jd-company-overview">
                <div className="jd-co-overview-text">
                  {generateCompanyDescription(detailJob)}
                </div>
                {(() => {
                  const p = COMPANY_PROFILES[detailJob.company]
                  return (
                    <div className="jd-co-overview-stats">
                      <div className="jd-co-stat">
                        <div className="jd-co-stat-num">{p?.employees?.toLocaleString() || detailJob.company_size || '–'}+</div>
                        <div className="jd-co-stat-label">{t('jobs.statEmployees')}</div>
                      </div>
                      <div className="jd-co-stat">
                        <div className="jd-co-stat-num">{p?.founded || '–'}</div>
                        <div className="jd-co-stat-label">{t('jobs.statFounded')}</div>
                      </div>
                      <div className="jd-co-stat">
                        <div className="jd-co-stat-num" style={{ fontSize: p?.revenue?.length > 10 ? 12 : 15 }}>{p?.revenue || t('jobs.statUndisclosed')}</div>
                        <div className="jd-co-stat-label">{t('jobs.statRevenue')}</div>
                      </div>
                      <div className="jd-co-stat">
                        <div className="jd-co-stat-num" style={{ fontSize: p?.funding?.length > 12 ? 11 : 15 }}>{p?.funding || t('jobs.statUndisclosed')}</div>
                        <div className="jd-co-stat-label">{t('jobs.statFunding')}</div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Community CTA */}
              {(
                <Link
                  href="/community"
                  className="jd-comm-cta"
                  onClick={() => track('click_community_cta', '/jobs', { jobId: detailJob.id, company: detailJob.company })}
                >
                  <div className="jd-comm-cta-emoji">💬</div>
                  <div className="jd-comm-cta-body">
                    <div className="jd-comm-cta-title">
                      {t('jobs.commCtaTitle', { company: '\u0000' }).split('\u0000').map((s, i, arr) => (
                        <span key={i}>{s}{i < arr.length - 1 && <span className="jd-comm-cta-co">{detailJob.company}</span>}</span>
                      ))}
                    </div>
                    <div className="jd-comm-cta-desc">{t('jobs.commCtaDesc')}</div>
                  </div>
                  <span className="jd-comm-cta-btn">{t('jobs.commCtaBtn')}</span>
                </Link>
              )}

              <div className="jd-divider" />

              {/* Description — 리스트 API엔 없는 필드라 상세 fetch 완료 전엔 스켈레톤.
                  대체 문구를 먼저 보여주면 로드 후 내용이 통째로 바뀌어 보인다. */}
              <div className="jd-section-title">{t('jobs.about')}</div>
              {!detailJob._full && !detailJob.description ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  <div className="jc-skel-line shimmer" style={{ height: 12, width: '96%' }} />
                  <div className="jc-skel-line shimmer" style={{ height: 12, width: '88%' }} />
                  <div className="jc-skel-line shimmer" style={{ height: 12, width: '92%' }} />
                  <div className="jc-skel-line shimmer" style={{ height: 12, width: '60%' }} />
                </div>
              ) : (
                <div className="jd-desc">
                  {decodeHTML(detailJob.description) || `${detailJob.company} is looking for a ${detailJob.title} to join their team in ${detailJob.location}.\n\nThis is a ${detailJob.type} position offering ${Math.round(detailJob.salary_min / 1e6)}M–${Math.round(detailJob.salary_max / 1e6)}M VND, ideal for candidates with ${detailJob.experience_min}–${detailJob.experience_max} years of experience in ${detailJob.role}.\n\nOur headhunter team will personally introduce you and support you throughout the process.`}
                </div>
              )}

              {/* Benefits */}
              {detailJob.benefits?.length > 0 && (
                <>
                  <div className="jd-divider" />
                  <div className="jd-section-title">{t('jobs.benefits')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    {detailJob.benefits.map(b => (
                      <span key={b} style={{ fontSize: 13, color: '#166534', background: '#f0fff4', border: '1px solid #86efac', padding: '5px 12px', borderRadius: 6 }}>{decodeHTML(b)}</span>
                    ))}
                  </div>
                </>
              )}

              {/* Hiring Process */}
              {detailJob.hiring_process && (
                <>
                  <div className="jd-divider" />
                  <div className="jd-section-title">{t('jobs.hiringProcess')}</div>
                  <div style={{ fontSize: 14, color: '#444', marginBottom: 24 }}>{decodeHTML(detailJob.hiring_process)}</div>
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
                      {t('jobs.benchmarkLine', { cur: Math.round(userSalary / 1e6), min: Math.round(detailJob.salary_min / 1e6), max: Math.round(detailJob.salary_max / 1e6) })}
                    </div>
                  </div>
                </div>
              )}

            </div>
            {/* Inline Apply Form */}
            {detailApplyMode && !appliedJobs.includes(detailJob.id) && (
              <div className="jd-apply-inline" ref={el => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                <div className="jd-apply-inline-h">{t('jobs.applyThis')}</div>

                <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>{t('jobs.cvRequired') || 'Resume (required)'}</div>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0]
                  if (f && f.size <= 5 * 1024 * 1024) setResumeFile(f)
                  else if (f) alert(t('jobs.maxFileSize'))
                }} />
                {(resumeFile || profileResumeUrl) ? (
                  <>
                    <div className="ap-file">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ap-file-name">{resumeFile ? resumeFile.name : resumeNameFromUrl(profileResumeUrl)}</div>
                        {!resumeFile && <div className="ap-file-sub">{t('jobs.registeredResume')}</div>}
                      </div>
                    </div>
                    <button type="button" className="ap-file-swap" onClick={() => fileRef.current?.click()}>{t('jobs.uploadOtherResume')}</button>
                  </>
                ) : (
                  <div className="ap-up" onClick={() => fileRef.current?.click()}>
                    <div className="ap-up-t" style={{ whiteSpace: 'pre-line' }}>{t('jobs.dragCV')}</div>
                  </div>
                )}

                <button className="jd-apply-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => {
                  if (!isLoggedIn) { loginForJob(detailJob.id); return; }
                  handleApply(detailJob);
                }} disabled={applying || (!resumeFile && !profileResumeUrl)}>
                  {!isLoggedIn ? t('jobs.loginToApply') : applying ? t('jobs.sending') : t('jobs.submitApplication')}
                </button>
              </div>
            )}

            </div>{/* /jd-scroll */}

            {/* Floating Apply CTA */}
            {!detailApplyMode && (
              <div className="jd-apply-float">
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="jd-save-btn" onClick={() => toggleBookmark(detailJob.id)} title={bookmarks.includes(detailJob.id) ? t('jobs.saved') : t('jobs.save')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarks.includes(detailJob.id) ? '#ff4400' : 'none'} stroke={bookmarks.includes(detailJob.id) ? '#ff4400' : '#666'} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                  </button>
                  <button className="jd-save-btn" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/jobs/${detailJob.id}`); showToast(t('jobs.linkCopied')) }} title="Share">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  </button>
                  {appliedJobs.includes(detailJob.id) ? (
                    <button className="jd-apply-btn" disabled style={{ background: '#ccc', flex: 1 }}>
                      {t('jobs.applied')}
                    </button>
                  ) : (
                    <button className="jd-apply-btn" style={{ flex: 1 }} onClick={() => {
                      track('click_apply_button','/jobs',{jobId:detailJob.id,title:detailJob.title,company:detailJob.company});
                      if (!isLoggedIn) { loginForJob(detailJob.id); return; }
                      setDetailApplyMode(true);
                    }}>
                      {t('jobs.apply')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="toast">{toast}</div>
      )}

      {appliedInfo && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
          onClick={e => { if(e.target===e.currentTarget) { if(appliedInfo.resumeUrl && !hasProfileResume){setShowAiProfilePrompt({resumeUrl:appliedInfo.resumeUrl})} setAppliedInfo(null); window.history.replaceState(null, '', '/jobs'); } }}>
          <div style={{background:'#fff',borderRadius:'20px',padding:'40px 36px',maxWidth:'420px',width:'100%',fontFamily:"'Barlow',sans-serif",textAlign:'center'}}>
            <div className="applied-check">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path className="applied-check-path" d="M4 12.5l5.5 5.5L20 7" />
              </svg>
            </div>
            <div style={{fontSize:'22px',fontWeight:900,color:'#111',letterSpacing:'-0.5px',marginBottom:'8px'}}>{t('jobs.appliedModalTitle')}</div>
            <div style={{fontSize:'14px',color:'#666',lineHeight:1.6,marginBottom:'24px'}}>
              {t('jobs.appliedModalDesc', { company: appliedInfo.company, title: appliedInfo.title })}
            </div>
            {appliedInfo.similar?.length > 0 && (
              <div style={{textAlign:'left',marginBottom:'20px'}}>
                <div style={{fontSize:'15px',fontWeight:800,color:'#111',marginBottom:'4px'}}>{t('jobs.similarTitle')}</div>
                <div style={{fontSize:'12.5px',color:'#888',marginBottom:'12px'}}>{t('jobs.similarDesc')}</div>
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {appliedInfo.similar.map(j => {
                    const isApplied = appliedJobs.includes(j.id)
                    const isApplying = similarApplying === j.id
                    const isArmed = similarArmed === j.id
                    const thumb = j.logo_url || j.image_url || j.images?.[0] || null
                    return (
                      <div key={j.id} className="sim-job">
                        <div className="sim-job-logo" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}>
                          {!thumb && (j.company_initials || (j.company || '?').charAt(0).toUpperCase())}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="sim-job-title">{j.title}</div>
                          <div className="sim-job-company">{j.company}</div>
                        </div>
                        <button
                          className={`sim-apply${isApplied ? ' done' : ''}${isApplying ? ' applying' : ''}${isArmed ? ' arm' : ''}`}
                          disabled={isApplied || isApplying}
                          onClick={() => { if (isArmed) { setSimilarArmed(null); applySimilar(j) } else setSimilarArmed(j.id) }}>
                          {isApplied ? t('jobs.similarApplied')
                            : isApplying ? t('jobs.similarApplying')
                            : isArmed ? t('jobs.similarConfirmTap')
                            : t('jobs.similarApply')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <button onClick={() => { if(appliedInfo.resumeUrl && !hasProfileResume){setShowAiProfilePrompt({resumeUrl:appliedInfo.resumeUrl})} setAppliedInfo(null); window.history.replaceState(null, '', '/jobs'); }}
              style={{background:'#ff4400',color:'#fff',fontSize:'14px',fontWeight:700,padding:'14px 32px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif"}}>
              {t('jobs.confirm')}
            </button>
          </div>
        </div>
      )}

      {showAiProfilePrompt && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
          onClick={e => { if(e.target===e.currentTarget && !aiParsing) setShowAiProfilePrompt(null); }}>
          <div style={{background:'#fff',borderRadius:'20px',padding:'40px 36px',maxWidth:'420px',width:'100%',fontFamily:"'Barlow',sans-serif",textAlign:'center'}}>
            {aiParsing ? (
              <>
                <div style={{fontSize:'40px',marginBottom:'16px'}}>&#10024;</div>
                <div style={{fontSize:'18px',fontWeight:800,color:'#111',marginBottom:'8px'}}>{t('jobs.aiParsingTitle')}</div>
                <div style={{fontSize:'13px',color:'#888',lineHeight:1.6,marginBottom:'20px'}}>{t('jobs.aiParsingSub')}</div>
                <div style={{background:'#f0f0f0',borderRadius:'8px',height:'8px',overflow:'hidden',marginBottom:'10px'}}>
                  <div style={{background:'#ff4400',height:'100%',borderRadius:'8px',width:`${aiParsing}%`,transition:'width 0.4s ease'}} />
                </div>
                <div style={{fontSize:'13px',fontWeight:700,color:'#ff4400'}}>{aiParsing}%</div>
              </>
            ) : (
              <>
                <div style={{fontSize:'40px',marginBottom:'16px'}}>&#10024;</div>
                <div style={{fontSize:'20px',fontWeight:900,color:'#111',letterSpacing:'-0.5px',marginBottom:'8px'}}>{t('jobs.aiProfileTitle')}</div>
                <div style={{fontSize:'14px',color:'#666',lineHeight:1.6,marginBottom:'24px'}}>{t('jobs.aiProfileDesc')}</div>
                <div style={{display:'flex',gap:'10px'}}>
                  <button onClick={() => setShowAiProfilePrompt(null)}
                    style={{flex:1,background:'#f0f0f0',color:'#555',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif"}}>
                    {t('jobs.aiProfileSkip')}
                  </button>
                  <button onClick={async () => {
                    setAiParsing(5)
                    try {
                      const token = (await supabase.auth.getSession()).data.session?.access_token
                      setAiParsing(15)
                      await fetch('/api/profile/talent', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Resume-Source': 'jobs' },
                        body: JSON.stringify({ resume_url: showAiProfilePrompt.resumeUrl }),
                      })
                      setAiParsing(30)
                      const tick = setInterval(() => { setAiParsing(p => p < 85 ? p + Math.random() * 8 >> 0 : p) }, 800)
                      const parseRes = await fetch('/api/profile/parse-resume', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      })
                      clearInterval(tick)
                      setAiParsing(95)
                      if (!parseRes.ok) throw new Error('parse failed')
                      setAiParsing(100)
                      await new Promise(r => setTimeout(r, 400))
                      router.push('/profile?from=ai-resume')
                    } catch (err) {
                      console.error('AI profile parse error:', err)
                      alert(t('jobs.aiProfileError'))
                    } finally {
                      setAiParsing(0)
                      setShowAiProfilePrompt(null)
                    }
                  }}
                    style={{flex:1,background:'#ff4400',color:'#fff',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif"}}>
                    {t('jobs.aiProfileConfirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 통합 필터 모달 — 적용을 눌러야 목록에 반영, 닫으면 변경 폐기. */}
      <JobFilterModal
        open={filterOpen}
        initial={{ roles: roleFilters, types: typeFilters, techs: techFilters, expMin, expMax }}
        countWith={draft => baseFilteredJobs.filter(j => matchesJobFilters(j, draft)).length}
        onApply={d => {
          setRoleFilters(d.roles)
          setTypeFilters(d.types)
          setTechFilters(d.techs)
          setExpMin(d.expMin)
          setExpMax(d.expMax)
          setFilterOpen(false)
        }}
        onClose={() => setFilterOpen(false)}
        typeLabel={typeLabel}
        t={t}
        lang={lang}
      />

      {showAuthModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
          onClick={e => { if(e.target===e.currentTarget) setShowAuthModal(false); }}>
          <div style={{background:'#fff',borderRadius:'20px',padding:'40px 36px',maxWidth:'420px',width:'100%',fontFamily:"'Barlow',sans-serif"}}>
            <div style={{fontSize:'24px',fontWeight:900,color:'#111',letterSpacing:'-0.5px',marginBottom:'8px'}}>{t('auth.title')}</div>
            <div style={{fontSize:'13px',color:'#888',marginBottom:'28px',lineHeight:1.6}}>{t('auth.sub')}</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button onClick={async () => { setShowAuthModal(false); localStorage.setItem('fyi_login_return', window.location.pathname + window.location.search); try { await supabase.auth.signInWithOAuth({ provider:'linkedin_oidc', options:{ redirectTo: window.location.origin+'/auth/callback', scopes:'openid profile email' } }); } catch(e) { console.error(e); } }}
                style={{width:'100%',background:'#0A66C2',color:'#fff',fontSize:'14px',fontWeight:700,padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:"'Barlow',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
                <span style={{fontWeight:900,fontSize:'16px'}}>in</span> {t('auth.linkedin')}
              </button>
              <button onClick={() => { setShowAuthModal(false); const ret = window.location.pathname + window.location.search; localStorage.setItem('fyi_login_return', ret); window.location.href = '/api/auth/google?return=' + encodeURIComponent(ret); }}
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
