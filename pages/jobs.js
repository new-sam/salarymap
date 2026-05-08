import { useState, useEffect, useRef, useMemo } from 'react'
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
const ROLE_OPTIONS = ['Backend','Frontend','Fullstack','Data','DevOps','Mobile','PM','Design','QA']
const TYPE_OPTIONS = ['remote','onsite','hybrid']
const TECH_OPTIONS = ['Java','Python','AWS','React','Go','TypeScript','JavaScript','Node.js','Kotlin','Docker','Spring Framework','Rust','Swift','Flutter','Kubernetes']

// Salary benchmark by role & experience (million VND/month)
// Cross-referenced: ITviec 2025-2026, NodeFlair, VietnamDevs, Adecco Vietnam
const MARKET_SALARY = {
  Backend:   { 0: 17000000, 1: 35000000, 3: 41000000, 5: 57000000, 8: 68000000 },
  Frontend:  { 0: 17000000, 1: 33000000, 3: 47000000, 5: 57000000, 8: 58000000 },
  Fullstack: { 0: 16000000, 1: 25000000, 3: 37000000, 5: 47000000, 8: 63000000 },
  Data:      { 0: 18000000, 1: 27000000, 3: 45000000, 5: 57000000, 8: 95000000 },
  DevOps:    { 0: 18000000, 1: 32000000, 3: 45000000, 5: 60000000, 8: 75000000 },
  Mobile:    { 0: 17000000, 1: 32000000, 3: 38000000, 5: 53000000, 8: 52000000 },
  PM:        { 0: 20000000, 1: 33000000, 3: 52000000, 5: 62000000, 8: 75000000 },
  Design:    { 0: 16000000, 1: 26000000, 3: 38000000, 5: 48000000, 8: 58000000 },
  QA:        { 0: 16000000, 1: 24000000, 3: 30000000, 5: 39000000, 8: 53000000 },
}

// Tech stack premiums — in-demand/niche techs pay more
const TECH_PREMIUM = { Go: 1.08, Rust: 1.10, Kotlin: 1.06, Swift: 1.06, Kubernetes: 1.07, AWS: 1.05, Terraform: 1.07, Scala: 1.08, Elixir: 1.09, 'Machine Learning': 1.10, AI: 1.10, Blockchain: 1.08, 'Spring Framework': 1.03, React: 1.02, TypeScript: 1.03 }

// Deterministic hash from company name → consistent small offset per company
function companyHash(name) {
  if (!name) return 0
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return ((h % 100) / 100) * 0.10 - 0.05 // range: -0.05 to +0.05
}

// Title seniority detection
function titleSeniority(title) {
  if (!title) return 1.0
  const t = title.toLowerCase()
  if (/\b(principal|staff|architect)\b/.test(t)) return 1.15
  if (/\b(lead|head)\b/.test(t)) return 1.10
  if (/\bsenior\b/.test(t)) return 1.06
  if (/\b(junior|intern|fresher)\b/.test(t)) return 0.90
  return 1.0
}

// City-based adjustment (HCMC baseline)
function cityFactor(location) {
  if (!location) return 1.0
  const loc = location.toLowerCase()
  if (/da nang|đà nẵng|danang/.test(loc)) return 0.90
  if (/ha noi|hà nội|hanoi/.test(loc)) return 0.95
  return 1.0
}

function getEstimatedSalary(job) {
  const table = MARKET_SALARY[job.role] || MARKET_SALARY.Backend
  const bands = [0, 1, 3, 5, 8]
  const midExp = job.experience_min != null && job.experience_max != null ? (job.experience_min + job.experience_max) / 2 : 3
  let band = bands[0]
  for (const b of bands) { if (midExp >= b) band = b }
  const median = table[band]
  // country
  const countryMult = job.country === 'global' ? 1.20 : job.country === 'korea' ? 1.15 : 1.0
  // company size
  const sizeNum = parseInt(job.company_size) || 0
  const sizeMult = sizeNum >= 200 ? 1.10 : sizeNum >= 50 ? 1.0 : sizeNum > 0 ? 0.95 : 1.0
  // city
  const cityMult = job.type === 'remote' ? 1.03 : cityFactor(job.location)
  // title seniority
  const titleMult = titleSeniority(job.title)
  // tech stack premium (average of matching techs, capped)
  let techMult = 1.0
  if (job.tech_stack?.length) {
    const premiums = job.tech_stack.map(t => TECH_PREMIUM[t]).filter(Boolean)
    if (premiums.length) techMult = Math.min(1.12, premiums.reduce((a, b) => a + b, 0) / premiums.length)
  }
  // company-specific offset
  const compOffset = 1.0 + companyHash(job.company)
  const multiplier = countryMult * sizeMult * cityMult * titleMult * techMult * compOffset
  const min = Math.round(median * 0.87 * multiplier)
  const max = Math.round(median * 1.13 * multiplier)
  return { min, max, estimated: true }
}

const COMPANY_PROFILES = {
  'Sendbird': { founded: 2013, hq: 'Seoul / San Mateo, CA', employees: 350, funding: '$221M (Series C)', revenue: '$100M+ ARR', industry: 'Communications API / SaaS', clients: 'Reddit, Hinge, Paytm, Virgin Mobile', desc: 'Global in-app communications platform powering chat, voice, and video for 300M+ monthly active users across 1,200+ enterprise clients worldwide.' },
  'Zigbang': { founded: 2010, hq: 'Seoul', employees: 500, funding: '$225M+', revenue: '₩120B+', industry: 'PropTech / Real Estate', clients: 'Direct consumer platform', desc: 'Korea\'s #1 real estate platform with 10M+ downloads, expanding into smart home IoT and office solutions through the acquisition of Samsung SDS\'s property division.' },
  'Imweb': { founded: 2013, hq: 'Seoul', employees: 200, funding: '₩50B+ (Series C)', revenue: '₩30B+', industry: 'E-commerce / Website Builder', clients: '400,000+ businesses', desc: 'Korea\'s leading no-code website & e-commerce builder, enabling SMBs to create professional online stores. Processes over ₩2T in annual GMV.' },
  'Lunit': { founded: 2013, hq: 'Seoul', employees: 300, funding: 'KOSDAQ Listed', revenue: '₩50B+', industry: 'Medical AI / HealthTech', clients: '4,000+ hospitals globally', desc: 'KOSDAQ-listed AI medical imaging company specializing in cancer detection. FDA-cleared products deployed in 4,000+ hospitals across 50+ countries.' },
  'ShopLive': { founded: 2019, hq: 'Seoul / Palo Alto', employees: 80, funding: '$35M (Series A)', revenue: 'Undisclosed', industry: 'Live Commerce / Video SaaS', clients: 'Hyundai, Samsung, GS Retail', desc: 'Leading live-commerce and shoppable video platform, powering interactive shopping experiences for major retailers across Asia and North America.' },
  'Genoray': { founded: 2003, hq: 'Seongnam', employees: 250, funding: 'KOSDAQ Listed', revenue: '₩80B+', industry: 'Medical Devices', clients: 'Hospitals in 100+ countries', desc: 'KOSDAQ-listed medical device manufacturer specializing in digital X-ray and dental imaging systems, exported to over 100 countries worldwide.' },
  'InnoGrid': { founded: 2015, hq: 'Seoul', employees: 150, funding: '₩30B+', revenue: '₩20B+', industry: 'Cloud / DevOps', clients: 'Enterprise & government', desc: 'Cloud infrastructure and DevOps solutions provider, specializing in hybrid cloud management and container orchestration for Korean enterprises.' },
  'BCUAI': { founded: 2020, hq: 'Seoul', employees: 40, funding: 'Seed / Series A', revenue: 'Early stage', industry: 'AI / Deep Learning', clients: 'B2B enterprise', desc: 'AI startup specializing in computer vision and natural language processing solutions for enterprise automation and digital transformation.' },
  'Orchestro': { founded: 2018, hq: 'Seoul', employees: 60, funding: '$15M+', revenue: 'Undisclosed', industry: 'DevOps / AIOps', clients: 'Enterprise clients', desc: 'AIOps platform using machine learning to automate IT operations, incident management, and infrastructure optimization for large-scale environments.' },
  'Naver Pay': { founded: 2019, hq: 'Seongnam', employees: 400, funding: 'Naver subsidiary', revenue: '₩200B+', industry: 'FinTech / Payments', clients: '30M+ users', desc: 'Naver\'s integrated payment platform serving 30M+ users with online/offline payments, remittances, and financial services within Korea\'s largest tech ecosystem.' },
  'xAI': { founded: 2023, hq: 'San Francisco', employees: 100, funding: '$6B+', revenue: 'Pre-revenue', industry: 'AI Research', clients: 'Grok AI users', desc: 'Elon Musk\'s AI research company building Grok, a large language model focused on truthful, helpful AI. One of the most well-funded AI startups globally.' },
  'Coupang': { founded: 2010, hq: 'Seoul / Seattle', employees: 70000, funding: 'NYSE Listed ($CPNG)', revenue: '$25B+', industry: 'E-commerce / Logistics', clients: '20M+ active customers', desc: 'Korea\'s largest e-commerce platform, NYSE-listed with $25B+ revenue. Known for Rocket Delivery same-day shipping and vertically integrated logistics network.' },
  'Coinone': { founded: 2014, hq: 'Seoul', employees: 200, funding: 'Series B', revenue: 'Undisclosed', industry: 'Crypto / FinTech', clients: '2.5M+ users', desc: 'One of Korea\'s top 5 cryptocurrency exchanges, regulated by Korean financial authorities. Offers spot trading, staking, and institutional services.' },
  'Viva Republica (Toss)': { founded: 2013, hq: 'Seoul', employees: 3000, funding: '$1B+ (Series G)', revenue: '₩1.5T+', industry: 'FinTech / Super App', clients: '23M+ users', desc: 'Korea\'s leading fintech super app valued at $7.4B, serving 23M+ users with banking, investments, insurance, and payments through a single platform.' },
  'Microsoft': { founded: 1975, hq: 'Redmond, WA', employees: 220000, funding: 'NASDAQ Listed ($MSFT)', revenue: '$245B+', industry: 'Technology / Cloud / AI', clients: 'Global enterprise & consumer', desc: 'World\'s second most valuable company powering Azure cloud, Office 365, Windows, LinkedIn, and GitHub. Major AI investments through OpenAI partnership.' },
  'Amazon': { founded: 1994, hq: 'Seattle, WA', employees: 1500000, funding: 'NASDAQ Listed ($AMZN)', revenue: '$640B+', industry: 'E-commerce / Cloud (AWS)', clients: 'Global consumer & enterprise', desc: 'World\'s largest e-commerce and cloud computing company. AWS powers 32% of global cloud infrastructure, serving millions of businesses worldwide.' },
  'OpenAI': { founded: 2015, hq: 'San Francisco', employees: 3000, funding: '$13B+ (Microsoft)', revenue: '$5B+ ARR', industry: 'AI Research / LLM', clients: '200M+ ChatGPT users', desc: 'Creator of ChatGPT and GPT-4, the world\'s most widely used AI platform. Pioneering artificial general intelligence research with 200M+ weekly active users.' },
  'Krafton': { founded: 2007, hq: 'Seoul', employees: 3500, funding: 'KOSPI Listed', revenue: '₩2.3T+', industry: 'Gaming', clients: 'PUBG: 75M daily players', desc: 'KOSPI-listed gaming powerhouse behind PUBG (Battlegrounds), one of the most played games in history with 75M+ daily players across platforms.' },
  'LIKELION': { founded: 2013, hq: 'Seoul', employees: 200, funding: 'Series B', revenue: '₩30B+', industry: 'EdTech / Coding Bootcamp', clients: '100,000+ graduates', desc: 'Korea\'s largest coding education platform with 100,000+ graduates. Operates bootcamps, university programs, and corporate training across 15+ countries.' },
  'SOOP': { founded: 2006, hq: 'Seoul', employees: 600, funding: 'KOSDAQ Listed', revenue: '₩300B+', industry: 'Live Streaming', clients: '8M+ monthly users', desc: 'Formerly AfreecaTV, Korea\'s pioneering live streaming platform rebranded as SOOP. KOSDAQ-listed with 8M+ monthly active users and strong esports presence.' },
  'Kakao Healthcare': { founded: 2022, hq: 'Seongnam', employees: 150, funding: 'Kakao subsidiary', revenue: 'Early stage', industry: 'HealthTech / Digital Health', clients: 'Hospitals & patients', desc: 'Kakao\'s healthcare subsidiary building digital health solutions including AI diagnostics, telemedicine, and health data platforms within Korea\'s largest messaging ecosystem.' },
  'Upstage': { founded: 2020, hq: 'Seoul', employees: 100, funding: '$72M (Series B)', revenue: 'Undisclosed', industry: 'AI / LLM', clients: 'Enterprise B2B', desc: 'AI startup founded by former Kakao Brain leaders, building Solar LLM and document AI. Ranked #1 on Hugging Face Open LLM Leaderboard multiple times.' },
  'CJ Olive Young': { founded: 1999, hq: 'Seoul', employees: 8000, funding: 'CJ Group subsidiary', revenue: '₩4T+', industry: 'Beauty / Retail', clients: '1,300+ stores nationwide', desc: 'Korea\'s dominant health & beauty retailer with 1,300+ stores and booming online platform. A key distribution channel for K-beauty brands globally.' },
  'Mad Engine': { founded: 2013, hq: 'Seoul', employees: 60, funding: 'Series A', revenue: '₩10B+', industry: 'Gaming / Entertainment', clients: 'Global gamers', desc: 'Game development studio creating cross-platform titles with global audiences, known for innovative gameplay mechanics and strong live-service operations.' },
  'Vidacs': { founded: 2019, hq: 'Seoul', employees: 45, funding: 'Series A', revenue: 'Undisclosed', industry: 'AI / Video Analytics', clients: 'Enterprise & media', desc: 'AI video analytics startup specializing in automated video understanding, content moderation, and media intelligence for enterprise clients.' },
  'Kitworks': { founded: 2020, hq: 'Seoul', employees: 30, funding: 'Seed', revenue: 'Early stage', industry: 'Developer Tools / SaaS', clients: 'Development teams', desc: 'Developer productivity startup building tools for code collaboration, CI/CD optimization, and engineering team performance analytics.' },
  'TeamSPARTA': { founded: 2019, hq: 'Seoul', employees: 300, funding: 'Series B', revenue: '₩50B+', industry: 'EdTech / Bootcamp', clients: '300,000+ students', desc: 'Fast-growing coding bootcamp operator behind "Sparta Coding Club" and "Hanghae99", with 300,000+ enrolled students and 98% employment rate for graduates.' },
  'Wavebridge': { founded: 2018, hq: 'Seoul', employees: 60, funding: '$20M+', revenue: 'Undisclosed', industry: 'Crypto / DeFi', clients: 'Institutional investors', desc: 'Digital asset management and DeFi infrastructure company providing quantitative trading, custodial services, and blockchain solutions for institutional clients.' },
  '42dot': { founded: 2020, hq: 'Seoul', employees: 200, funding: 'Hyundai Motor Group', revenue: 'R&D stage', industry: 'Autonomous Driving / AI', clients: 'Hyundai/Kia vehicles', desc: 'Hyundai Motor Group\'s autonomous driving subsidiary developing self-driving AI, SDV (Software Defined Vehicle) platform, and urban mobility solutions.' },
  'Supercent': { founded: 2019, hq: 'Seoul', employees: 100, funding: 'Series A', revenue: '₩50B+', industry: 'Hyper-casual Gaming', clients: '500M+ downloads globally', desc: 'Korea\'s top hyper-casual game publisher with 500M+ downloads globally. Known for rapid prototyping and data-driven game publishing methodology.' },
  'LawTalk': { founded: 2014, hq: 'Seoul', employees: 80, funding: 'Series B', revenue: '₩20B+', industry: 'LegalTech', clients: '5,000+ lawyers, 1M+ users', desc: 'Korea\'s #1 legal tech platform connecting 5,000+ lawyers with users for consultations. Pioneered online legal marketplace with AI-powered case matching.' },
}

function generateCompanyDescription(job) {
  const profile = COMPANY_PROFILES[job.company]
  const sizeNum = profile?.employees || parseInt(job.company_size) || 0
  const techList = job.tech_stack?.length ? job.tech_stack.slice(0, 4).join(', ') : null
  const locationDesc = job.location || 'Vietnam'
  const typeDesc = job.type === 'remote' ? 'remote-first culture with distributed teams' : job.type === 'hybrid' ? 'flexible hybrid work model' : 'collaborative on-site environment'
  const expDesc = job.experience_min != null && job.experience_max != null
    ? (job.experience_max >= 30 ? `${job.experience_min}+ years` : `${job.experience_min}–${job.experience_max} years`)
    : null

  const paragraphs = []

  // Paragraph 1: Company overview (use profile if available)
  if (profile) {
    paragraphs.push(`${profile.desc} Founded in ${profile.founded}, headquartered in ${profile.hq}.`)
  } else {
    const sizeDesc = sizeNum >= 500 ? 'large-scale enterprise' : sizeNum >= 100 ? 'mid-sized company' : sizeNum >= 10 ? 'growing startup' : 'technology company'
    paragraphs.push(`${job.company} is a ${sizeDesc} based in ${locationDesc}, offering a ${typeDesc}. The company operates in the technology sector and is actively expanding its ${job.role} team.`)
  }

  // Paragraph 2: Key metrics (revenue, funding, scale)
  if (profile) {
    let metrics = `📊 Key Metrics — `
    const parts = []
    if (profile.revenue) parts.push(`Revenue: ${profile.revenue}`)
    if (profile.funding) parts.push(`Funding: ${profile.funding}`)
    if (profile.employees) parts.push(`Team Size: ${profile.employees.toLocaleString()}+ employees`)
    if (profile.industry) parts.push(`Industry: ${profile.industry}`)
    metrics += parts.join(' · ')
    if (profile.clients) metrics += `\nClients & Reach: ${profile.clients}`
    paragraphs.push(metrics)
  }

  // Paragraph 3: Role-specific details
  if (techList || expDesc) {
    let rolePara = `🔧 This Position — `
    const roleParts = []
    if (techList) roleParts.push(`Tech stack includes ${techList}`)
    if (expDesc) roleParts.push(`looking for ${expDesc} of experience`)
    if (job.salary_min > 0) roleParts.push(`offering ${Math.round(job.salary_min / 1e6)}M–${Math.round(job.salary_max / 1e6)}M VND`)
    rolePara += roleParts.join(', ') + '.'
    paragraphs.push(rolePara)
  }

  // Paragraph 4: Work culture & growth
  if (sizeNum >= 500) {
    paragraphs.push(`🏢 Work Culture — With ${sizeNum.toLocaleString()}+ employees, ${job.company} provides structured career paths, mentorship programs, and cross-functional collaboration. Employees benefit from established processes, competitive compensation, and long-term stability.`)
  } else if (sizeNum >= 100) {
    paragraphs.push(`🏢 Work Culture — A team of ${sizeNum}+ professionals balancing structured growth with startup agility. Individual contributions have visible impact while benefiting from established engineering practices and clear promotion paths.`)
  } else if (sizeNum >= 10) {
    paragraphs.push(`🏢 Work Culture — A lean team of ${sizeNum}+ members offering high ownership and direct impact. Early team members often experience accelerated career growth with broader responsibilities and close collaboration with leadership.`)
  }

  // Paragraph 5: Benefits
  if (job.benefits?.length > 0) {
    paragraphs.push(`✅ Benefits — ${job.benefits.slice(0, 6).join(', ')}`)
  }

  return paragraphs.join('\n\n')
}

function formatSalaryCard(job) {
  if (job.salary_min > 0 && job.salary_max > 0) {
    return { min: job.salary_min, max: job.salary_max, estimated: false }
  }
  return getEstimatedSalary(job)
}

function getHighSalaryThreshold(jobs) {
  if (!jobs.length) return Infinity
  const mins = jobs.map(j => formatSalaryCard(j).min).sort((a, b) => b - a)
  return mins[Math.floor(mins.length * 0.30)] || mins[mins.length - 1]
}

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
  const [currentPage, setCurrentPage] = useState(1)
  const JOBS_PER_PAGE = 20

  // AI summary loading animation + view_job_detail tracking
  useEffect(() => {
    if (!detailJob) { setAiSummaryReady(false); return }
    setAiSummaryReady(false)
    const timer = setTimeout(() => setAiSummaryReady(true), 1200 + Math.random() * 600)
    // Track detail view
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'view_job_detail', page: '/jobs', meta: { jobId: detailJob.id, title: detailJob.title, company: detailJob.company } }) }).catch(() => {})
    if (typeof fbq === 'function') fbq('track', 'ViewContent', { content_name: detailJob.title, content_category: detailJob.company, content_type: 'job' })
    return () => clearTimeout(timer)
  }, [detailJob])

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
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'view_jobs_page',
        page: '/jobs',
        meta: {
          utm_source: getUtm('utm_source'),
          utm_medium: getUtm('utm_medium'),
          utm_campaign: getUtm('utm_campaign'),
          utm_content: getUtm('utm_content'),
          referrer: document.referrer || null,
        },
      }),
    }).catch(() => {})
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
      try { setBookmarks(JSON.parse(localStorage.getItem('fyi_bookmarks') || '[]')) } catch { }
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
      const byCompany = {}
      filtered.forEach(job => {
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
      return result
    }
    return filtered
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

  const toggleBookmark = (jobId) => {
    setBookmarks(prev => {
      const next = prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
      localStorage.setItem('fyi_bookmarks', JSON.stringify(next))
      return next
    })
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

        .jbm { display: flex; align-items: center; gap: 14px; background: linear-gradient(135deg, #ff4400 0%, #ff6b35 100%); border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; box-shadow: 0 4px 16px rgba(255,68,0,0.18); }
        .jbm-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .jbm-icon svg { width: 18px; height: 18px; }
        .jbm-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .jbm-label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.85); letter-spacing: 0.03em; }
        .jbm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .jbm-tag { font-size: 13px; color: #fff; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap; backdrop-filter: blur(4px); }

        .jf-search { position: relative; margin-bottom: 16px; }
        .jf-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
        .jf-search-input { width: 100%; padding: 11px 36px 11px 40px; font-size: 14px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fff; outline: none; transition: border-color .15s; font-family: inherit; }
        .jf-search-input:focus { border-color: #ff4400; }
        .jf-search-input::placeholder { color: #bbb; }
        .jf-search-clear { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 18px; color: #aaa; cursor: pointer; line-height: 1; }

        .jf { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .jf-dd { position: relative; }
        .jf-dd-btn { font-size: 13px; font-weight: 500; color: #555; background: #fff; border: 1px solid #e0e0e0; padding: 8px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .15s; white-space: nowrap; font-family: inherit; }
        .jf-dd-btn:hover { border-color: #bbb; }
        .jf-dd-btn.on { background: #111; color: #fff; border-color: #111; font-weight: 600; }
        .jf-dd-arrow { font-size: 10px; opacity: 0.5; }
        .jf-dd-menu { position: absolute; top: calc(100% + 4px); left: 0; background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 4px; min-width: 160px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jf-dd-menu-scroll { max-height: 240px; overflow-y: auto; }
        .jf-dd-item { display: block; width: 100%; padding: 9px 12px; border: none; background: none; font-size: 13px; color: #333; cursor: pointer; text-align: left; border-radius: 6px; transition: background .1s; font-family: inherit; white-space: nowrap; }
        .jf-dd-item:hover { background: #f5f5f5; }
        .jf-dd-item.on { color: #ff4400; font-weight: 600; }
        .jf-reset { font-size: 13px; color: #aaa; background: none; border: none; cursor: pointer; padding: 8px 4px; font-family: inherit; text-decoration: underline; white-space: nowrap; }
        .jf-reset:hover { color: #666; }
        .jf-exp-panel { position: absolute; top: calc(100% + 4px); left: 0; background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px; min-width: 280px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .jf-exp-title { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 16px; }
        .jf-exp-display { font-size: 18px; font-weight: 700; color: #111; text-align: center; margin-bottom: 20px; }
        .jf-exp-slider { position: relative; height: 32px; margin-bottom: 20px; }
        .jf-exp-track { position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: #e8e8e8; border-radius: 2px; transform: translateY(-50%); }
        .jf-exp-fill { position: absolute; top: 0; bottom: 0; background: #ff4400; border-radius: 2px; }
        .jf-exp-range { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; margin: 0; }
        .jf-exp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #ff4400; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; pointer-events: auto; }
        .jf-exp-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #ff4400; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; pointer-events: auto; }
        .jf-exp-footer { display: flex; justify-content: space-between; align-items: center; }
        .jf-exp-reset { font-size: 13px; color: #aaa; background: none; border: none; cursor: pointer; font-family: inherit; }
        .jf-exp-reset:hover { color: #666; }
        .jf-exp-apply { font-size: 13px; font-weight: 700; color: #fff; background: #ff4400; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-family: inherit; }
        .jf-exp-apply:hover { background: #e63d00; }

        .jf-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .jf-bar-l { display: flex; align-items: center; gap: 16px; }
        .jf-check { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #888; cursor: pointer; user-select: none; }
        .jf-check input { accent-color: #ff4400; cursor: pointer; margin: 0; }
        .jf-count { font-size: 16px; font-weight: 800; color: #111; }
        .jf-sort { display: flex; background: #f5f5f5; border-radius: 8px; overflow: hidden; }
        .jf-sort-btn { font-size: 13px; font-weight: 500; color: #888; background: none; border: none; padding: 7px 14px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .jf-sort-btn.on { background: #fff; color: #111; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 6px; }

        /* Hot jobs */
        .jh { margin-bottom: 32px; }
        .jh-title { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 14px; }
        .jh-app { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #ff4400; font-weight: 700; margin-right: 6px; overflow: visible; }
        .jh-pulse { width: 6px; height: 6px; border-radius: 50%; background: #ff4400; position: relative; flex-shrink: 0; margin: 4px; }
        .jh-pulse::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; background: rgba(255,68,0,0.35); animation: jh-ping 1.5s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes jh-ping { 0% { transform: scale(1); opacity: 1; } 75%,100% { transform: scale(2.2); opacity: 0; } }
        .jh-open { font-size: 11px; color: #38a169; font-weight: 600; display: inline-flex; align-items: center; line-height: 1; }
        .jh-divider { height: 1px; background: #eee; margin-top: 32px; }

        .jg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; align-items: stretch; }

        /* Card */
        .jc { cursor: pointer; display: flex; flex-direction: column; }
        .jc-match { position: absolute; top: 10px; left: 10px; background: #ff4400; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; z-index: 2; }
        .jc-img { border-radius: 8px; overflow: hidden; position: relative; padding-top: 62%; margin-bottom: 11px; background: #f0f0f0; flex-shrink: 0; }
        .jc-img-in { position: absolute; inset: 0; transition: transform .25s ease; background-color: #f0f0f0; background-size: cover; background-position: center; background-repeat: no-repeat; }
        .jc:hover .jc-img-in { transform: scale(1.04); }
        .jc-bump { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.62); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 4px; z-index: 2; }
        .jc-bump b { color: #ff4400; font-weight: 700; }
        .jc-bm { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.92); display: flex; align-items: center; justify-content: center; z-index: 2; border: none; cursor: pointer; }
        .jc-ini { position: absolute; bottom: 10px; left: 10px; width: 34px; height: 34px; border-radius: 6px; background: #fff; border: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #333; z-index: 2; }
        .jc-body { flex: 1; display: flex; flex-direction: column; }
        .jc-t { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
        .jc-co { font-size: 13px; color: #888; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jc-sal { font-size: 15px; font-weight: 800; color: #ff4400; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; }
        .jc-bottom { margin-top: auto; }
        .jc-m { font-size: 12px; color: #bbb; white-space: nowrap; overflow: visible; text-overflow: ellipsis; display: flex; align-items: center; }
        .jc-m b { color: #ff4400; font-weight: 700; }
        .jc-tag { font-size: 11px; font-weight: 500; color: #555; background: #f0f0f0; padding: 2px 7px; border-radius: 4px; }
        .jc-tag-more { color: #aaa; }
        .jc-badges { position: absolute; bottom: 10px; right: 10px; display: flex; gap: 4px; z-index: 2; }
        .jc-type-badge { font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 4px; letter-spacing: 0.3px; }
        .jc-type-badge.remote { color: #fff; background: #16a34a; }
        .jc-type-badge.hybrid { color: #fff; background: #2563eb; }
        .jc-type-badge.highpay { color: #fff; background: #ff4400; }
        .jc-dday { display: inline-flex; align-items: center; margin-left: 6px; font-size: 11px; font-weight: 700; color: #ff4400; background: #fff7f5; border: 1px solid #ffd6c8; padding: 1px 6px; border-radius: 4px; line-height: 1; }
        .jc-dday.urgent { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
        .jc-nudge { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .jc-nudge-t { font-size: 12px; color: #888; }
        .jc-nudge-b { font-size: 12px; color: #ff4400; font-weight: 700; background: none; border: none; cursor: pointer; white-space: nowrap; }

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

        /* Work Information */
        .jd-work-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .jd-work-item { display: flex; align-items: center; gap: 10px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px 14px; }
        .jd-work-icon { font-size: 18px; flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .jd-work-label { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
        .jd-work-value { font-size: 13px; color: #222; font-weight: 600; margin-top: 2px; }

        /* Company Overview */
        .jd-company-overview { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); border: 1px solid #e0e7ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
        .jd-co-overview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .jd-co-overview-badge { font-size: 11px; font-weight: 700; color: #6366f1; background: #e0e7ff; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
        .jd-co-overview-badge::before { content: '✦'; font-size: 10px; }
        .jd-co-overview-badge.ai-thinking { animation: aiBadgePulse 1.2s ease-in-out infinite; }
        @keyframes aiBadgePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .jd-co-overview-text { font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 16px; white-space: pre-line; }
        .jd-co-overview-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e0e7ff; padding-top: 14px; }
        .jd-co-stat { flex: 1; text-align: center; }
        .jd-co-stat { padding: 8px 0; }
        .jd-co-stat:nth-child(odd) { border-right: 1px solid #e0e7ff; }
        .jd-co-stat-num { font-size: 15px; font-weight: 800; color: #111; }
        .jd-co-stat-label { font-size: 11px; color: #888; margin-top: 2px; }

        /* AI loading skeleton */
        .ai-loading { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 16px; }
        .ai-loading-line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #e0e7ff 25%, #ede9fe 50%, #e0e7ff 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        /* AI fade-in */
        .ai-fade-in { animation: aiFadeIn 0.6s ease-out both; }
        @keyframes aiFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .jd-meta-item { background: #f9f9f8; border-radius: 8px; padding: 12px 14px; }
        .jd-meta-label { font-size: 10px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .jd-meta-value { font-size: 14px; font-weight: 600; color: #111; }
        .jd-apply-float { position: sticky; bottom: 0; background: #fff; padding: 16px 32px; border-top: 1px solid #f0f0f0; z-index: 2; }
        .jd-apply-btn { width: 100%; padding: 14px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s; }
        .jd-apply-btn:hover { background: #e63d00; }
        .jd-apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .jd-apply-inline { padding: 20px 32px 24px; border-top: 1px solid #f0f0f0; }
        .jd-apply-inline-h { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 14px; }
        .jd-login-box { background: #fff7f5; border: 1px solid #ffd6c8; border-radius: 10px; padding: 16px 20px; text-align: center; margin-top: 8px; }
        .jd-login-text { font-size: 13px; color: #888; margin-bottom: 10px; }
        .jd-login-btn { background: #ff4400; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; }

        /* Pagination */
        .jp { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 40px; }
        .jp-btn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e0e0e0; background: #fff; color: #555; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .jp-btn:hover:not(:disabled) { border-color: #bbb; color: #111; }
        .jp-btn.on { background: #111; color: #fff; border-color: #111; }
        .jp-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .jp-dots { font-size: 14px; color: #aaa; padding: 0 4px; }

        @media (max-width: 900px) { .jg { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px) {
          .jn { padding: 0 16px; height: 48px; }
          .jn-l { gap: 16px; }
          .jn-tab { font-size: 13px; height: 48px; padding: 0 12px; }
          .jw { padding: 28px 16px 60px; }
          .jw-h1 { font-size: 20px; }
          .jg { grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .jbm { padding: 12px 14px; gap: 10px; }
          .jbm-icon { width: 30px; height: 30px; border-radius: 8px; }
          .jbm-icon svg { width: 15px; height: 15px; }
          .jbm-tag { font-size: 12px; padding: 3px 8px; }
          .jf { gap: 6px; }
          .jf-dd-btn { font-size: 12px; padding: 7px 10px; }
          .jgate-box { padding: 36px 24px; }
          .ap { padding: 20px 20px 32px; }
          .jd { width: 100%; }
          .jd-body { padding: 20px 16px 32px; }
          .jd-img { height: 200px; }
          .jd-title { font-size: 18px; }
          .jd-work-info { grid-template-columns: 1fr; }
          .jd-co-overview-stats { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .jg { grid-template-columns: 1fr; }
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
          <>
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

            {/* Search */}
            <div className="jf-search">
              <svg className="jf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="jf-search-input" placeholder={t('jobs.searchPlaceholder')} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }} />
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
                    <button className={`jf-dd-item${!roleFilter ? ' on' : ''}`} onClick={() => { setRoleFilter(''); setOpenDropdown(null); setCurrentPage(1) }}>{t('jobs.filterAll')}</button>
                    {ROLE_OPTIONS.map(r => (
                      <button key={r} className={`jf-dd-item${roleFilter === r ? ' on' : ''}`} onClick={() => { setRoleFilter(r); setOpenDropdown(null); setCurrentPage(1) }}>{r}</button>
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
                      <input type="range" className="jf-exp-range" min="0" max="15" value={expMin || 0} onChange={e => { const v = e.target.value; if (Number(v) <= Number(expMax || 15)) { setExpMin(v === '0' ? '' : v); setCurrentPage(1) } }} />
                      <input type="range" className="jf-exp-range" min="0" max="15" value={expMax || 15} onChange={e => { const v = e.target.value; if (Number(v) >= Number(expMin || 0)) { setExpMax(v === '15' ? '' : v); setCurrentPage(1) } }} />
                    </div>
                    <div className="jf-exp-footer">
                      <button className="jf-exp-reset" onClick={() => { setExpMin(''); setExpMax(''); setCurrentPage(1) }}>{t('jobs.filterReset')}</button>
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
                    <button className={`jf-dd-item${!typeFilter ? ' on' : ''}`} onClick={() => { setTypeFilter(''); setOpenDropdown(null); setCurrentPage(1) }}>{t('jobs.filterAll')}</button>
                    {TYPE_OPTIONS.map(tp => (
                      <button key={tp} className={`jf-dd-item${typeFilter === tp ? ' on' : ''}`} onClick={() => { setTypeFilter(tp); setOpenDropdown(null); setCurrentPage(1) }}>{typeLabel(tp)}</button>
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
                    <button className={`jf-dd-item${!techFilter ? ' on' : ''}`} onClick={() => { setTechFilter(''); setOpenDropdown(null); setCurrentPage(1) }}>{t('jobs.filterAll')}</button>
                    {TECH_OPTIONS.map(tc => (
                      <button key={tc} className={`jf-dd-item${techFilter === tc ? ' on' : ''}`} onClick={() => { setTechFilter(tc); setOpenDropdown(null); setCurrentPage(1) }}>{tc}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reset */}
              {(roleFilter || typeFilter || expMin !== '' || expMax !== '' || techFilter || searchQuery) && (
                <button className="jf-reset" onClick={() => { setRoleFilter(''); setTypeFilter(''); setExpMin(''); setExpMax(''); setTechFilter(''); setSearchQuery(''); setCurrentPage(1) }}>{t('jobs.filterReset')}</button>
              )}
            </div>

            {/* Hot jobs section */}
            {jobs.length > 0 && currentPage === 1 && !searchQuery && !roleFilter && !typeFilter && !techFilter && expMin === '' && expMax === '' && (() => {
              const now = new Date()
              const closing = jobs
                .filter(j => j.deadline && new Date(j.deadline) > now && Math.ceil((new Date(j.deadline) - now) / 86400000) <= 14)
                .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                .slice(0, 2)
              const noDeadline = jobs
                .filter(j => !j.deadline && !closing.find(c => c.id === j.id))
                .slice(0, 2)
              const hotJobs = [...closing, ...noDeadline].slice(0, 4)
              if (hotJobs.length === 0) return null
              const fakeCount = (id) => 20 + (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 21
              return (
                <div className="jh">
                  <div className="jh-title">🔥 {t('jobs.hotTitle')}</div>
                  <div className="jg">
                    {hotJobs.map((job, idx) => {
                      const bump = getBump(job)
                      const matched = isProfileMatch(job)
                      const days = job.deadline ? Math.ceil((new Date(job.deadline) - now) / 86400000) : null
                      return (
                        <div key={job.id} className="jc" onClick={() => { setCarouselIdx(0); setDetailApplyMode(false); setApplied(false); setResumeFile(null); setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[idx % 3] }); fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'click_job_card',page:'jobs',meta:{jobId:job.id,title:job.title,company:job.company}})}).catch(()=>{}) }}>
                          <div className="jc-img">
                            <div className="jc-img-in" style={{ background: `url(${job.image_url || job.images?.[0] || DEFAULT_IMAGES[idx % 3]}) center/cover no-repeat` }}>
                              {bump !== null && bump > 0 && (
                                <div className="jc-bump" dangerouslySetInnerHTML={{ __html: t('jobs.bumpVs', { bump }) }} />
                              )}
                              {matched && <div className="jc-match" style={bump > 0 ? { top: 38 } : undefined}>{t('jobs.profileBadge')}</div>}
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
                                <span className="jh-app"><span className="jh-pulse" />{t('jobs.hotApplicants', { count: fakeCount(job.id) })}</span>
                                {days !== null ? (
                                  <span className={`jc-dday${days <= 7 ? ' urgent' : ''}`}>{lang === 'vi' ? (days === 0 ? t('jobs.ddayToday') : t('jobs.dday', { days })) : `D-${days}`}</span>
                                ) : (
                                  <span className="jh-open">{t('jobs.hotUntilFilled')}</span>
                                )}
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

            <div className="jf-bar" style={{ visibility: jobsLoaded ? 'visible' : 'hidden' }}>
              <div className="jf-bar-l">
                <div className="jf-count">{t('jobs.matchCount', { count: filteredJobs.length })}</div>
                <label className="jf-check">
                  <input type="checkbox" checked={hideExpired} onChange={e => { setHideExpired(e.target.checked); setCurrentPage(1) }} />
                  <span>{t('jobs.hideExpired')}</span>
                </label>
              </div>
              <div className="jf-sort">
                {['spread','latest','deadline'].map(key => (
                  <button key={key} className={`jf-sort-btn${sortBy === key ? ' on' : ''}`} onClick={() => { setSortBy(key); setCurrentPage(1) }}>{t(`jobs.sort.${key}`)}</button>
                ))}
              </div>
            </div>

            {/* Grid */}
            {(() => {
              const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE)
              const pagedJobs = filteredJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE)
              return (
                <>
                  <div className="jg" style={{ opacity: jobsLoaded ? 1 : 0, transition: 'opacity .3s' }}>
                    {pagedJobs.map((job, idx) => {
                      const bump = getBump(job)
                      const matched = isProfileMatch(job)
                      const globalIdx = (currentPage - 1) * JOBS_PER_PAGE + idx
                      return (
                        <div key={job.id} className="jc" onClick={() => { setCarouselIdx(0); setDetailApplyMode(false); setApplied(false); setResumeFile(null); setDetailJob({ ...job, _imgFallback: DEFAULT_IMAGES[globalIdx % 3] }); fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'click_job_card',page:'jobs',meta:{jobId:job.id,title:job.title,company:job.company}})}).catch(()=>{}) }}>
                          <div className="jc-img">
                            <div className="jc-img-in" style={{
                              background: `url(${job.image_url || job.images?.[0] || DEFAULT_IMAGES[globalIdx % 3]}) center/cover no-repeat`,
                            }}>
                              {bump !== null && bump > 0 && (
                                <div className="jc-bump" dangerouslySetInnerHTML={{ __html: t('jobs.bumpVs', { bump }) }} />
                              )}
                              {matched && <div className="jc-match" style={bump > 0 ? { top: 38 } : undefined}>{t('jobs.profileBadge')}</div>}
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

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="jp">
                      <button className="jp-btn" disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>&lsaquo;</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                        .reduce((acc, p, i, arr) => {
                          if (i > 0 && p - arr[i - 1] > 1) acc.push('...')
                          acc.push(p)
                          return acc
                        }, [])
                        .map((p, i) => p === '...'
                          ? <span key={`dots-${i}`} className="jp-dots">...</span>
                          : <button key={p} className={`jp-btn${p === currentPage ? ' on' : ''}`} onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{p}</button>
                        )}
                      <button className="jp-btn" disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>&rsaquo;</button>
                    </div>
                  )}
                </>
              )
            })()}
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
                  <div className="jd-work-icon">📅</div>
                  <div>
                    <div className="jd-work-label">Work Days</div>
                    <div className="jd-work-value">Monday – Friday</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon">🕘</div>
                  <div>
                    <div className="jd-work-label">Work Hours</div>
                    <div className="jd-work-value">9:00 AM – 6:00 PM</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon">📍</div>
                  <div>
                    <div className="jd-work-label">Work Type</div>
                    <div className="jd-work-value">{detailJob.type === 'remote' ? 'Fully Remote' : detailJob.type === 'hybrid' ? 'Hybrid (Office + Remote)' : 'On-site'}</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon">🏖️</div>
                  <div>
                    <div className="jd-work-label">Paid Leave</div>
                    <div className="jd-work-value">12+ days / year</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon">📋</div>
                  <div>
                    <div className="jd-work-label">Contract</div>
                    <div className="jd-work-value">Full-time (Permanent)</div>
                  </div>
                </div>
                <div className="jd-work-item">
                  <div className="jd-work-icon">🏥</div>
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
                  <span style={{ fontSize: 20 }}>📈</span>
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
                {appliedJobs.includes(detailJob.id) ? (
                  <button className="jd-apply-btn" disabled style={{ background: '#ccc' }}>
                    {t('jobs.applied')}
                  </button>
                ) : (
                  <button className="jd-apply-btn" onClick={() => { setDetailApplyMode(true); fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'click_apply_button',page:'/jobs',meta:{jobId:detailJob.id,title:detailJob.title,company:detailJob.company}})}).catch(()=>{}) }}>
                    {t('jobs.apply')}
                  </button>
                )}
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
