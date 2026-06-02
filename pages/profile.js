import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'
import SalaryBadge from '../components/SalaryBadge'
import { SALARY_TIERS, getSalaryTier } from '../lib/salaryTiers'
import { useT } from '../lib/i18n'

const POSITIONS = ['Backend','Frontend','Fullstack','Mobile','AI/Data','DevOps','QA','Design','PM','Other']
const YOE_OPTIONS = [
  { value: '0', label: 'New grad / Intern' },
  { value: '6', label: '< 1 year' },
  { value: '12', label: '1 year' },
  { value: '24', label: '2 years' },
  { value: '36', label: '3 years' },
  { value: '48', label: '4 years' },
  { value: '60', label: '5 years' },
  { value: '84', label: '5-7 years' },
  { value: '108', label: '7-10 years' },
  { value: '120', label: '10+ years' },
]

function CustomSelect({ value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        width: '100%', fontSize: 14, padding: '10px 12px', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8, background: '#fff', color: value ? '#111' : 'rgba(0,0,0,0.3)',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'border-color .15s', outline: 'none',
        ...(open ? { borderColor: '#ff6000' } : {}),
      }}>
        <span>{value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10,
          padding: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', scrollbarWidth: 'none',
        }} className="pselect-dropdown">
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }} style={{
              display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 6,
              background: value === opt ? 'rgba(255,96,0,0.08)' : 'transparent',
              color: value === opt ? '#ff6000' : 'rgba(0,0,0,0.6)',
              fontSize: 13, fontWeight: value === opt ? 600 : 400, cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', transition: 'background .1s',
            }}
              onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
              onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = 'transparent' }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Onboarding Modal ──
function OnboardModal({ t, onClose }) {
  const [step, setStep] = useState(0)

  const steps = [
    {
      svg: (
        <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
          <style>{`
            @keyframes obWrite { 0%,100% { transform: translate(0,0) rotate(-5deg); } 30% { transform: translate(20px, 5px) rotate(0deg); } 60% { transform: translate(40px, 0) rotate(2deg); } }
            @keyframes obLineGrow { from { width: 0; } to { width: 100%; } }
            @keyframes obCardUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
            .ob-pen { animation: obWrite 3s ease-in-out infinite; transform-origin: 90% 90%; }
            .ob-card { animation: obCardUp 0.6s ease both; }
          `}</style>
          <g className="ob-card">
            <rect x="30" y="30" width="140" height="100" rx="12" fill="#f5f5f5" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
            <circle cx="65" cy="62" r="14" fill="rgba(255,96,0,0.12)" />
            <circle cx="65" cy="59" r="5" fill="rgba(255,96,0,0.25)" />
            <path d="M57 72a8 8 0 0116 0" fill="rgba(255,96,0,0.15)" />
            <rect x="90" y="52" width="60" height="6" rx="3" fill="rgba(0,0,0,0.08)">
              <animate attributeName="width" from="0" to="60" dur="1.5s" fill="freeze" />
            </rect>
            <rect x="90" y="64" width="45" height="5" rx="2.5" fill="rgba(0,0,0,0.05)">
              <animate attributeName="width" from="0" to="45" dur="1.5s" begin="0.3s" fill="freeze" />
            </rect>
            <rect x="50" y="92" width="100" height="5" rx="2.5" fill="rgba(0,0,0,0.04)">
              <animate attributeName="width" from="0" to="100" dur="1.5s" begin="0.6s" fill="freeze" />
            </rect>
            <rect x="50" y="102" width="80" height="5" rx="2.5" fill="rgba(0,0,0,0.03)">
              <animate attributeName="width" from="0" to="80" dur="1.5s" begin="0.9s" fill="freeze" />
            </rect>
          </g>
          <g className="ob-pen">
            <path d="M120 40 l20-20 l8 8 l-20 20z" fill="#ff6000" opacity="0.8" />
            <path d="M118 42 l2-2 l8 8 l-2 2z" fill="#000" opacity="0.1" />
          </g>
        </svg>
      ),
    },
    {
      svg: (
        <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
          <style>{`
            @keyframes obEyeBlink { 0%,40%,100% { transform: scaleY(1); } 45% { transform: scaleY(0.1); } }
            @keyframes obShield { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes obToggle { 0%,40% { cx: 78; fill: rgba(0,0,0,0.2); } 50%,100% { cx: 122; fill: #ff6000; } }
            .ob-eye { animation: obEyeBlink 3s ease-in-out infinite; transform-origin: center 70px; }
            .ob-shield { animation: obShield 2s ease-in-out infinite; transform-origin: center; }
          `}</style>
          <rect x="65" y="110" width="70" height="28" rx="14" fill="rgba(0,0,0,0.06)" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
          <circle r="10" cy="124" fill="#ff6000">
            <animate attributeName="cx" values="78;122;122;78" keyTimes="0;0.3;0.7;1" dur="4s" repeatCount="indefinite" />
          </circle>
          <g className="ob-eye">
            <path d="M60 70 Q100 35 140 70 Q100 105 60 70Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
            <circle cx="100" cy="70" r="16" fill="rgba(255,96,0,0.08)" stroke="rgba(255,96,0,0.3)" strokeWidth="1.5" />
            <circle cx="100" cy="70" r="7" fill="#ff6000" opacity="0.6" />
            <circle cx="103" cy="67" r="2.5" fill="#fff" opacity="0.6" />
          </g>
          <g className="ob-shield" transform="translate(148, 50)">
            <path d="M12 2 L22 7 V14 C22 20 12 24 12 24 C12 24 2 20 2 14 V7Z" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.4)" strokeWidth="1.5" />
            <path d="M8 13 l3 3 5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      ),
    },
    {
      svg: (
        <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
          <style>{`
            @keyframes obPulse1 { 0%,100% { r: 4; opacity: 0.6; } 50% { r: 7; opacity: 0; } }
            @keyframes obPulse2 { 0%,100% { r: 4; opacity: 0.6; } 50% { r: 7; opacity: 0; } }
            @keyframes obDash { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
            @keyframes obSpark { 0%,100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1); } }
            .ob-line { stroke-dasharray: 5 5; animation: obDash 2s linear infinite; }
            .ob-spark { animation: obSpark 2s ease-in-out infinite; }
            .ob-spark-d1 { animation-delay: 0.5s; }
            .ob-spark-d2 { animation-delay: 1s; }
          `}</style>
          <circle cx="45" cy="80" r="22" fill="rgba(255,96,0,0.08)" stroke="rgba(255,96,0,0.3)" strokeWidth="1.5" />
          <circle cx="45" cy="74" r="7" fill="rgba(255,96,0,0.2)" />
          <path d="M35 92a10 10 0 0120 0" fill="rgba(255,96,0,0.12)" />
          <circle cx="100" cy="80" r="18" fill="rgba(255,96,0,0.06)" stroke="#ff6000" strokeWidth="1.5" />
          <text x="100" y="84" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ff6000">AI</text>
          <circle cx="155" cy="50" r="16" fill="rgba(34,197,94,0.06)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
          <rect x="148" y="44" width="14" height="12" rx="2" fill="rgba(34,197,94,0.15)" />
          <circle cx="155" cy="110" r="16" fill="rgba(59,130,246,0.06)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
          <rect x="148" y="104" width="14" height="12" rx="2" fill="rgba(59,130,246,0.15)" />
          <line x1="67" y1="80" x2="82" y2="80" className="ob-line" stroke="#ff6000" strokeWidth="1.5" />
          <line x1="118" y1="72" x2="139" y2="55" className="ob-line" stroke="#16a34a" strokeWidth="1.5" />
          <line x1="118" y1="88" x2="139" y2="105" className="ob-line" stroke="#3b82f6" strokeWidth="1.5" />
          <circle cx="155" cy="50" fill="#16a34a">
            <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="155" cy="110" fill="#3b82f6">
            <animate attributeName="r" values="4;8;4" dur="2s" begin="0.7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" begin="0.7s" repeatCount="indefinite" />
          </circle>
          <circle cx="130" cy="65" r="2" fill="#ff6000" className="ob-spark" />
          <circle cx="125" cy="95" r="1.5" fill="#ff6000" className="ob-spark ob-spark-d1" />
          <circle cx="80" cy="70" r="1.5" fill="#ff6000" className="ob-spark ob-spark-d2" />
        </svg>
      ),
    },
  ]

  const next = () => {
    if (step < 2) setStep(s => s + 1)
    else onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 20, maxWidth: 400, width: '100%', overflow: 'hidden', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        {/* Illustration */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0 20px', background: '#fafafa' }}>
          {steps[step].svg}
        </div>

        {/* Content */}
        <div style={{ padding: '0 32px 32px', textAlign: 'center' }}>
          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20, marginTop: 20 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? '#ff6000' : 'rgba(0,0,0,0.1)', transition: 'all .3s' }} />
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6000', marginBottom: 8, letterSpacing: '0.05em' }}>
            STEP {step + 1} / 3
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 8px' }}>
            {t(`profile.onboard.step${step + 1}.title`)}
          </h3>
          <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', lineHeight: 1.7, margin: '0 0 24px', minHeight: 44 }}>
            {t(`profile.onboard.step${step + 1}.desc`)}
          </p>

          <button onClick={next}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#ff6000', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {step < 2 ? 'Next' : t('profile.onboard.cta')}
          </button>
        </div>
      </div>
    </div>
  )
}
const WORK_TYPES = ['Remote', 'Hybrid', 'On-site']

function completionScore(p) {
  if (!p) return 0
  const checks = [
    p.photo_url, p.full_name, p.headline, p.location,
    p.resume_url, Array.isArray(p.skills) ? p.skills.length > 0 : !!p.skills,
    p.university, p.experiences?.length > 0,
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

export default function ProfilePage() {
  const router = useRouter()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tab, setTab] = useState('profile') // profile | posts | employment | badges
  const [isAdmin, setIsAdmin] = useState(false)
  const [showOnboard, setShowOnboard] = useState(false)
  const [showAlert, setShowAlert] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [percentile, setPercentile] = useState(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiProgress, setAiProgress] = useState({ percent: 0, message: '' })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [sharingResume, setSharingResume] = useState(false)
  const [showPublishPrompt, setShowPublishPrompt] = useState(false)
  const [myPosts, setMyPosts] = useState([])
  const [myPostsLoading, setMyPostsLoading] = useState(false)
  const [verifications, setVerifications] = useState([])
  const [verificationsLoading, setVerificationsLoading] = useState(false)
  const [verifyForm, setVerifyForm] = useState({ document_type: 'payslip', salary_amount: '' })
  const [verifyUploading, setVerifyUploading] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState(null)
  const [badges, setBadges] = useState([])
  const [badgesLoading, setBadgesLoading] = useState(false)
  const pendingRoute = useRef(null)
  const photoRef = useRef(null)
  const resumeRef = useRef(null)
  const salaryDocRef = useRef(null)

  // Form state
  const [form, setForm] = useState({})
  const [initialForm, setInitialForm] = useState({})
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const df = (k) => { const a = form[k], b = initialForm[k]; const changed = typeof a === 'object' ? JSON.stringify(a) !== JSON.stringify(b) : a !== b; return changed && a ? ' dirty' : '' }
  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty
  const [showTabConfirm, setShowTabConfirm] = useState(false)
  const pendingTab = useRef(null)

  const handleTabChange = (newTab) => {
    if (newTab === tab) return
    if (isDirty && tab === 'profile') {
      pendingTab.current = newTab
      setShowTabConfirm(true)
    } else {
      setTab(newTab)
    }
  }

  // Browser tab close / refresh guard
  useEffect(() => {
    const handler = (e) => { if (isDirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Next.js route change guard
  useEffect(() => {
    const handler = (url) => {
      if (!isDirtyRef.current) return
      pendingRoute.current = url
      setShowLeaveConfirm(true)
      router.events.emit('routeChangeError')
      throw 'Route change blocked'
    }
    router.events.on('routeChangeStart', handler)
    return () => router.events.off('routeChangeStart', handler)
  }, [router])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      setToken(session.access_token)

      // Admin check (cached) — community/posts gated to admins for now
      const cachedAdmin = sessionStorage.getItem('fyi_is_admin')
      if (cachedAdmin !== null) {
        setIsAdmin(cachedAdmin === 'true')
      } else {
        try {
          const r = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
          const d = await r.json()
          setIsAdmin(d.isAdmin)
          sessionStorage.setItem('fyi_is_admin', String(d.isAdmin))
        } catch {}
      }

      // Fetch profile and submissions in parallel
      const [profileRes, subsResult] = await Promise.all([
        fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        supabase.from('submissions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      ])

      if (profileRes.ok) {
        const { profile: p } = await profileRes.json()
        if (p) {
          setProfile(p)
          const formData = {
            full_name: p.full_name || session.user.user_metadata?.full_name || '',
            current_company: p.current_company || '',
            headline: p.headline || '',
            position: p.position || '',
            yoe_months: p.yoe_months ?? '',
            intro: p.intro || '',
            skills: p.skills?.join(', ') || '',
            english_cert: p.english_cert || '',
            korean_cert: p.korean_cert || '',
            location: p.location || '',
            birthdate: p.birthdate || '',
            university: p.university || '',
            major: p.major || '',
            graduation_year: p.graduation_year || '',
            salary_min: p.salary_min ? String(p.salary_min / 1000000) : '',
            salary_max: p.salary_max ? String(p.salary_max / 1000000) : '',
            work_type: p.work_type || '',
            job_signal: p.job_signal || 'passive',
            hr_visible: p.hr_visible || false,
            portfolio_url: p.portfolio_url || '',
            photo_url: p.photo_url || '',
            resume_url: p.resume_url || '',
            university: p.university || '',
            major: p.major || '',
            graduation_year: p.graduation_year || '',
            gpa: p.gpa || '',
            skills: p.skills?.join(', ') || '',
            experiences: p.experiences || [],
            projects: p.projects || [],
            is_resume_public: p.is_resume_public || false,
          }
          setForm(formData)
          setInitialForm(formData)
          // Auto-save Google name if DB is empty
          if (!p.full_name && formData.full_name) {
            fetch('/api/profile/talent', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ full_name: formData.full_name }),
            })
          }
          if (!p.headline && !p.position) {
            setShowOnboard(true)
          }
          if (router.query.from === 'ai-resume' && !p.hr_visible && completionScore(formData) >= 60) {
            setShowPublishPrompt(true)
            router.replace('/profile', undefined, { shallow: true })
          }
        }
      }

      let subs = subsResult.data
      if (!subs?.length && session.user.email) {
        const { data: es } = await supabase.from('submissions').select('*').eq('email', session.user.email).order('created_at', { ascending: false })
        if (es?.length) subs = es
      }
      if (subs?.length) {
        setSubmissions(subs)
        try {
          const latest = subs[0]
          const pRes = await fetch(`/api/percentile?role=${encodeURIComponent(latest.role)}&experience=${encodeURIComponent(latest.experience)}&salary=${latest.salary}&company=${encodeURIComponent(latest.company || '')}`)
          setPercentile(await pRes.json())
        } catch {}
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (tab !== 'posts' || !token || myPosts.length > 0) return
    setMyPostsLoading(true)
    fetch('/api/community/posts?mine=1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMyPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setMyPostsLoading(false))
  }, [tab, token])

  useEffect(() => {
    if (tab !== 'employment' || !token) return
    setVerificationsLoading(true)
    fetch('/api/salary-verification', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setVerifications(d.verifications || []))
      .catch(() => {})
      .finally(() => setVerificationsLoading(false))
  }, [tab, token])

  useEffect(() => {
    if (tab !== 'badges' || !token) return
    setBadgesLoading(true)
    fetch('/api/badges', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBadges(d.badges || []))
      .catch(() => {})
      .finally(() => setBadgesLoading(false))
  }, [tab, token])

  const handleVerifyUpload = async () => {
    const file = salaryDocRef.current?.files?.[0]
    if (!file) return
    setVerifyUploading(true)
    setVerifyMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', verifyForm.document_type)
    if (verifyForm.salary_amount) fd.append('salary_amount', String(parseInt(verifyForm.salary_amount) * 1000000))
    try {
      const res = await fetch('/api/salary-verification/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        const { verification } = await res.json()
        setVerifications(prev => [verification, ...prev])
        setVerifyMsg(t('profile.employment.success'))
        salaryDocRef.current.value = ''
        setVerifyForm({ document_type: 'payslip', salary_amount: '' })
        setTimeout(() => setVerifyMsg(null), 3000)
      }
    } catch (e) {}
    setVerifyUploading(false)
  }

  const handleToggleBadge = async (badgeType, currentActive) => {
    const res = await fetch('/api/badges', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ badge_type: badgeType, is_active: !currentActive }),
    })
    if (res.ok) {
      setBadges(prev => prev.map(b => b.badge_type === badgeType ? { ...b, is_active: !currentActive } : b))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...form,
      skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      yoe_months: form.yoe_months ? parseInt(form.yoe_months) : null,
      salary_min: form.salary_min ? parseInt(form.salary_min) * 1000000 : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) * 1000000 : null,
    }
    delete payload.photo_url
    delete payload.resume_url
    await fetch('/api/profile/talent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    // Refresh profile for completion score
    const res = await fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const { profile: p } = await res.json()
      setProfile(p)
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: p }))
    }
    setInitialForm({ ...form })
    setSaving(false)
    setMsg('Saved!')
    setTimeout(() => setMsg(null), 2000)
  }

  const handleUpload = async (type, file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const res = await fetch('/api/profile/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    if (res.ok) {
      const { url } = await res.json()
      set(type === 'photo' ? 'photo_url' : 'resume_url', url)
      setProfile(prev => ({ ...prev, [type === 'photo' ? 'photo_url' : 'resume_url']: url }))
      if (type === 'resume') {
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'resume_upload', page: '/profile' }) }).catch(() => {})
        runAiParse()
      }
    }
  }

  const runAiParse = async () => {
    setAiParsing(true)
    const steps = [
      { percent: 15, message: t('profile.ai.download') },
      { percent: 35, message: t('profile.ai.extract') },
      { percent: 55, message: t('profile.ai.analyze') },
      { percent: 75, message: t('profile.ai.parse') },
    ]
    let stepIdx = 0
    const timer = setInterval(() => {
      if (stepIdx < steps.length) {
        setAiProgress(steps[stepIdx])
        stepIdx++
      }
    }, 1500)

    try {
      const response = await fetch('/api/profile/parse-resume', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      clearInterval(timer)

      if (!response.ok) {
        const err = await response.json()
        setShowAlert(err.error || 'AI parsing failed')
        setAiParsing(false)
        setAiProgress({ percent: 0, message: '' })
        return
      }

      setAiProgress({ percent: 90, message: t('profile.ai.fill') })
      const { fields: f } = await response.json()

      setForm(prev => ({
        ...prev,
        ...(f.full_name && { full_name: f.full_name }),
        ...(f.headline && { headline: f.headline }),
        ...(f.location && { location: f.location }),
        ...(f.position && { position: f.position }),
        ...(f.yoe_months && { yoe_months: f.yoe_months }),
        ...(f.skills && { skills: f.skills }),
        ...(f.university && { university: f.university }),
        ...(f.major && { major: f.major }),
        ...(f.graduation_year && { graduation_year: f.graduation_year }),
        ...(f.gpa && { gpa: f.gpa }),
        ...(f.experiences?.length && { experiences: f.experiences }),
        ...(f.projects?.length && { projects: f.projects }),
        ...(f.photo_url && { photo_url: f.photo_url }),
      }))

      setAiProgress({ percent: 100, message: t('profile.ai.done') })
      setMsg(t('profile.ai.verify'))
      // Refresh profile for completion score
      const profileRes = await fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${token}` } })
      if (profileRes.ok) { const { profile: p } = await profileRes.json(); setProfile(p) }
    } catch (err) {
      clearInterval(timer)
      setShowAlert('AI parsing failed: ' + err.message)
    }
    setTimeout(() => {
      setAiParsing(false)
      setAiProgress({ percent: 0, message: '' })
    }, 1500)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fafafa' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #ff6000', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const score = completionScore(form)

  return (
    <>
      <Head><title>Profile — FYI</title></Head>
      <style>{`
        body { background: #fafafa; }
        .pw { max-width: 580px; margin: 0 auto; padding: 32px 20px 80px; font-family: 'Barlow', system-ui, sans-serif; }
        .pw-header { margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .pw-header-left { flex: 1; min-width: 0; }
        .pw-header-name { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 4px; }
        .pw-header-photo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(0,0,0,0.08); flex-shrink: 0; }
        .pw-header-photo-placeholder { width: 56px; height: 56px; border-radius: 50%; background: rgba(0,0,0,0.04); border: 2px solid rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pw-header-company { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #888; }
        .pw-header-company input { border: none; outline: none; font-size: 14px; color: #888; font-family: inherit; background: none; padding: 0; width: 200px; }
        .pw-header-company input::placeholder { color: #ccc; }
        .pw-header-company input:focus { color: #111; }
        .pw-tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,0.08); }
        .pw-tab { font-size: 13px; font-weight: 600; color: rgba(0,0,0,0.35); background: none; border: none; padding: 12px 12px; cursor: pointer; font-family: inherit; position: relative; white-space: nowrap; }
        .pw-tab.on { color: #111; }
        .pw-tab.on::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: #ff6000; }
        .pw-post-item { display: block; padding: 14px 0; border-bottom: 1px solid rgba(0,0,0,0.06); text-decoration: none; }
        .pw-post-item:last-child { border-bottom: none; }
        .pw-post-title { font-size: 14px; font-weight: 600; color: #111; margin-bottom: 4px; }
        .pw-post-meta { font-size: 12px; color: #aaa; display: flex; gap: 10px; }
        .pcard { background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .pcard-h { font-size: 13px; font-weight: 700; color: rgba(0,0,0,0.6); letter-spacing: .02em; margin-bottom: 16px; }
        .pfield { margin-bottom: 16px; }
        .pfield:last-child { margin-bottom: 0; }
        .pfield-label { font-size: 12px; font-weight: 700; color: rgba(0,0,0,0.5); letter-spacing: .02em; margin-bottom: 6px; }
        .pfield-value { font-size: 14px; color: #111; }
        .pinput { width: 100%; font-size: 14px; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; outline: none; font-family: inherit; background: #fff; color: #111; transition: border-color .15s; }
        .pinput.dirty { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.03); }
        .pinput:focus { border-color: #ff6000; }
        .pinput::placeholder { color: rgba(0,0,0,0.25); }
        .ptextarea { min-height: 100px; resize: vertical; }
        .psignal { display: flex; gap: 8px; flex-wrap: wrap; }
        .psignal-btn { flex: 1; min-width: 120px; padding: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: rgba(0,0,0,0.02); font-size: 12px; font-weight: 600; color: rgba(0,0,0,0.4); cursor: pointer; text-align: center; font-family: inherit; transition: all .15s; }
        .psignal-btn.on { border-color: #ff6000; color: #ff6000; background: rgba(255,96,0,0.06); }
        .pselect-dropdown::-webkit-scrollbar { display: none; }
        .psave-wrap { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); background: rgba(250,250,250,0.95); backdrop-filter: blur(10px); transform: translateY(100%); transition: transform .25s ease; pointer-events: none; }
        @media (max-width: 768px) { .psave-wrap { bottom: calc(60px + env(safe-area-inset-bottom)); padding: 10px 16px; } }
        .psave-wrap.show { transform: translateY(0); pointer-events: auto; }
        .psave-inner { max-width: 580px; margin: 0 auto; }
        .psave { width: 100%; padding: 14px; background: #ff6000; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 12px rgba(255,96,0,0.3); }
        .psave:disabled { opacity: 0.5; box-shadow: none; }
        .pmsg { background: #fff; color: #111; font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .pprogress { height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; margin-bottom: 8px; overflow: hidden; }
        .pprogress-fill { height: 100%; border-radius: 3px; transition: width .5s; }
        .pphoto-wrap { display: flex; align-items: center; gap: 16px; }
        .pphoto { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(0,0,0,0.08); }
        .pphoto-placeholder { width: 72px; height: 72px; border-radius: 50%; background: rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(0,0,0,0.12); }
        .pupload-btn { font-size: 12px; font-weight: 600; color: #ff6000; background: none; border: 1px solid rgba(255,96,0,0.3); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-family: inherit; }
        .phr-banner { background: linear-gradient(135deg, rgba(255,96,0,0.06), rgba(255,96,0,0.02)); border: 1px solid rgba(255,96,0,0.15); border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
        .ptoggle { display: flex; align-items: center; gap: 12px; }
        .ptoggle-switch { width: 44px; height: 24px; border-radius: 12px; background: rgba(0,0,0,0.12); cursor: pointer; position: relative; transition: background .2s; border: none; padding: 0; }
        .ptoggle-switch.on { background: #ff6000; }
        .ptoggle-switch::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
        .ptoggle-switch.on::after { transform: translateX(20px); }
        .pinline { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        @media (max-width: 500px) { .pinline { grid-template-columns: 1fr; } }
        .plist-item { background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.05); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .plist-item:last-of-type { margin-bottom: 0; }
        .presume-upload-btn { width: 100%; padding: 16px; border-radius: 10px; border: 2px dashed rgba(255,96,0,0.3); background: rgba(255,96,0,0.04); display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 700; color: #ff6000; transition: all .15s; }
        .presume-upload-btn:hover { border-color: #ff6000; background: rgba(255,96,0,0.08); }
        .ai-bubble { background: #ff6000; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; position: relative; animation: aiBounce 2s ease-in-out infinite; }
        .ai-bubble-inner { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #fff; line-height: 1.4; }
        .ai-bubble-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 800; flex-shrink: 0; }
        .ai-bubble-arrow { position: absolute; bottom: -6px; left: 24px; width: 12px; height: 12px; background: #ff6000; transform: rotate(45deg); border-radius: 0 0 3px 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes aiBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .ai-bubble:hover { filter: brightness(1.08); }
        .pw-resume-cta { display: none; }
        .pw-logout { display: none; }
        @media (max-width: 768px) {
          .pw-resume-cta { display: flex; align-items: center; gap: 10px; padding: 14px 16px; margin-bottom: 16px; background: linear-gradient(135deg, #ff6000, #ff7a1a); border-radius: 12px; color: #fff; font-size: 13px; cursor: pointer; box-shadow: 0 2px 12px rgba(255,96,0,0.3); }
          .pw-logout { display: block; width: 100%; padding: 14px; margin-top: 32px; margin-bottom: 20px; background: none; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; font-size: 14px; font-weight: 600; color: #999; cursor: pointer; font-family: 'Barlow', sans-serif; }
        }
      `}</style>

      <GlobalNav activePage="profile" />

      <div className="pw">
        {/* Header */}
        <div className="pw-header">
          <div className="pw-header-left">
            <h1 className="pw-header-name">{form.full_name || user?.user_metadata?.full_name || ''}</h1>
            <div className="pw-header-company">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              <input
                value={form.current_company || ''}
                onChange={e => set('current_company', e.target.value)}
                placeholder={t('profile.companyPlaceholder') || '재직 회사를 입력하세요'}
              />
            </div>
          </div>
          {form.photo_url ? (
            <img src={form.photo_url} className="pw-header-photo" alt="" />
          ) : (
            <div className="pw-header-photo-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="pw-tabs">
          <button className={`pw-tab${tab === 'profile' ? ' on' : ''}`} onClick={() => handleTabChange('profile')}>{t('profile.tab.talent')}</button>
          {isAdmin && (
            <button className={`pw-tab${tab === 'posts' ? ' on' : ''}`} onClick={() => handleTabChange('posts')}>{t('profile.tab.posts') || '내 게시물'}</button>
          )}
          <button className={`pw-tab${tab === 'employment' ? ' on' : ''}`} onClick={() => handleTabChange('employment')}>{t('profile.tab.employment') || '재직정보'}</button>
          <button className={`pw-tab${tab === 'badges' ? ' on' : ''}`} onClick={() => handleTabChange('badges')}>{t('profile.tab.badges') || '뱃지'}</button>
        </div>

        {tab === 'profile' && (<>
          {/* HR + Job Signal + Work Type — single card */}
          <div className="pcard">
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 }}>{t('profile.hr.title')}</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', lineHeight: 1.4 }}>{t('profile.hr.desc')}</div>
              </div>
              <button className={`ptoggle-switch${form.hr_visible ? ' on' : ''}`} onClick={() => {
                if (score < 60 && !form.hr_visible) {
                  setShowAlert(t('profile.hr.need80'))
                  return
                }
                set('hr_visible', !form.hr_visible)
              }} />
            </div>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.4)', marginBottom: 8 }}>{t('profile.signal')}</div>
              <div className="psignal">
                {['active','open','passive'].map(v => {
                  const isOn = form.job_signal === v
                  const icon = v === 'active' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke={isOn ? '#16a34a' : 'rgba(0,0,0,0.2)'} strokeWidth="1.5"/>
                      <circle cx="7" cy="7" r="3" fill={isOn ? '#16a34a' : 'rgba(0,0,0,0.1)'}/>
                    </svg>
                  ) : v === 'open' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke={isOn ? '#f59e0b' : 'rgba(0,0,0,0.2)'} strokeWidth="1.5"/>
                      <path d="M7 4v3.5" stroke={isOn ? '#f59e0b' : 'rgba(0,0,0,0.15)'} strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="7" cy="10" r="0.75" fill={isOn ? '#f59e0b' : 'rgba(0,0,0,0.15)'}/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke={isOn ? '#ff6000' : 'rgba(0,0,0,0.2)'} strokeWidth="1.5"/>
                      <path d="M5 5l4 4M9 5l-4 4" stroke={isOn ? '#ff6000' : 'rgba(0,0,0,0.15)'} strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  )
                  return (
                    <button key={v} className={`psignal-btn${isOn ? ' on' : ''}`} onClick={() => set('job_signal', v)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{icon} {t(`profile.signal.${v}`)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {form.job_signal && form.job_signal !== 'passive' && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="pinline">
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.position')}</div>
                    <CustomSelect value={form.position} options={POSITIONS} placeholder={t('profile.position.ph')} onChange={v => set('position', v)} />
                  </div>
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.yoe')}</div>
                    <CustomSelect value={form.yoe_months ? YOE_OPTIONS.find(o => o.value === String(form.yoe_months))?.label : ''} options={YOE_OPTIONS.map(o => o.label)} placeholder={t('profile.position.ph')} onChange={v => { const found = YOE_OPTIONS.find(o => o.label === v); if (found) set('yoe_months', found.value) }} />
                  </div>
                </div>
                <div className="pinline">
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.salary')}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className={`pinput${df('salary_min')}`} inputMode="numeric" value={form.salary_min || ''} onChange={e => set('salary_min', e.target.value.replace(/[^0-9]/g, ''))} placeholder="" style={{ flex: 1 }} />
                      <span style={{ color: 'rgba(0,0,0,0.25)' }}>~</span>
                      <input className={`pinput${df('salary_max')}`} inputMode="numeric" value={form.salary_max || ''} onChange={e => set('salary_max', e.target.value.replace(/[^0-9]/g, ''))} placeholder="" style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.4)', marginBottom: 8 }}>{t('profile.worktype.title')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['All', 'Remote', 'On-site'].map(v => {
                  const isOn = form.work_type === v
                  return (
                    <button key={v} onClick={() => set('work_type', isOn ? '' : v)} style={{
                      padding: '8px 16px', borderRadius: 20, border: isOn ? '1.5px solid #ff6000' : '1.5px solid rgba(0,0,0,0.1)',
                      background: isOn ? 'rgba(255,96,0,0.06)' : '#fff', color: isOn ? '#ff6000' : 'rgba(0,0,0,0.5)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                    }}>
                      {t(`profile.worktype.${v.toLowerCase()}`)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Completion */}
          <div className="pcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.4)' }}>{t('profile.completion')}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: score >= 60 ? '#16a34a' : '#f59e0b' }}>{score}%</span>
            </div>
            <div className="pprogress"><div className="pprogress-fill" style={{ width: `${score}%`, background: score >= 60 ? '#16a34a' : '#f59e0b' }} /></div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>
              {score < 60 ? t('profile.completion.incomplete') : t('profile.completion.done')}
              {score < 60 && <span style={{ color: '#ff6000', marginLeft: 4 }}>({t('profile.completion.min80')})</span>}
            </div>
          </div>

          {msg && <div className="pmsg">{msg}</div>}
          <div className="pcard" style={{ position: 'relative', overflow: 'visible' }}>
            <div className="pcard-h">{t('profile.resume')}</div>
            {!form.resume_url && !aiParsing && (
              <div className="ai-bubble" onClick={() => resumeRef.current?.click()} style={{ cursor: 'pointer' }}>
                <div className="ai-bubble-inner">
                  <span className="ai-bubble-icon">AI</span>
                  <span>{t('profile.resume.ai_hint')}</span>
                </div>
                <div className="ai-bubble-arrow" />
              </div>
            )}
            {aiParsing && (
              <div style={{ background: 'rgba(255,96,0,0.04)', border: '1px solid rgba(255,96,0,0.12)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #ff6000', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{aiProgress.message}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${aiProgress.percent}%`, background: '#ff6000', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 6, textAlign: 'right' }}>{aiProgress.percent}%</div>
              </div>
            )}
            <div className="pfield">
              <input ref={resumeRef} type="file" accept=".pdf" hidden onChange={e => handleUpload('resume', e.target.files[0])} />
              {form.resume_url ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <a href={form.resume_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#111', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {decodeURIComponent(form.resume_url.split('/').pop().split('?')[0])}
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button className="pupload-btn" onClick={() => resumeRef.current?.click()} disabled={aiParsing}>{t('profile.resume.change')}</button>
                    <button onClick={() => { set('resume_url', ''); setProfile(prev => ({ ...prev, resume_url: '' })); fetch('/api/profile/talent', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ resume_url: '' }) }) }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => resumeRef.current?.click()} className="presume-upload-btn" disabled={aiParsing}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>{t('profile.resume.register')}</span>
                </button>
              )}
            </div>
            <div className="pfield">
              <div className="pfield-label">{t('profile.portfolio')}</div>
              <input className={`pinput${df('portfolio_url')}`} value={form.portfolio_url || ''} onChange={e => set('portfolio_url', e.target.value)} placeholder="" />
            </div>
            {form.resume_url && (
              <div className="pfield" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>{t('profile.resume.share.title')}</div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', lineHeight: 1.4 }}>{t('profile.resume.share.desc')}</div>
                  </div>
                  <button
                    className={`ptoggle-switch${form.is_resume_public ? ' on' : ''}`}
                    disabled={sharingResume}
                    onClick={async () => {
                      setSharingResume(true)
                      try {
                        const res = await fetch('/api/profile/share-resume', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ action: 'toggle' }),
                        })
                        if (res.ok) {
                          const { is_resume_public } = await res.json()
                          set('is_resume_public', is_resume_public)
                          setInitialForm(prev => ({ ...prev, is_resume_public }))
                          setProfile(prev => ({ ...prev, is_resume_public }))
                          setMsg(is_resume_public ? t('profile.resume.share.on') : t('profile.resume.share.off'))
                          setTimeout(() => setMsg(null), 2000)
                        } else {
                          const err = await res.json()
                          setShowAlert(err.error || 'Failed to share resume')
                        }
                      } catch (err) {
                        setShowAlert('Failed to share resume')
                      }
                      setSharingResume(false)
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pcard">
            <div className="pcard-h">{t('profile.basic')}</div>
            <div className="pfield">
              <div className="pfield-label">{t('profile.photo')}</div>
              <div className="pphoto-wrap">
                {form.photo_url ? (
                  <div style={{ position: 'relative' }}>
                    <img src={form.photo_url} className="pphoto" />
                    <button onClick={() => { set('photo_url', ''); setProfile(prev => ({ ...prev, photo_url: '' })); fetch('/api/profile/talent', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ photo_url: '' }) }) }}
                      style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="pphoto-placeholder"><span style={{ fontSize: 24, color: 'rgba(0,0,0,0.2)' }}>+</span></div>
                )}
                <div>
                  <button className="pupload-btn" onClick={() => photoRef.current?.click()}>{t('profile.photo.upload')}</button>
                  <input ref={photoRef} type="file" accept="image/*" hidden onChange={e => handleUpload('photo', e.target.files[0])} />
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', marginTop: 4 }}>{t('profile.photo.hint')}</div>
                </div>
              </div>
            </div>
            <div className="pinline">
              <div className="pfield">
                <div className="pfield-label">{t('profile.name')}</div>
                <input className={`pinput${df('full_name')}`} value={form.full_name || ''} onChange={e => set('full_name', e.target.value)} placeholder="" />
              </div>
              <div className="pfield">
                <div className="pfield-label">{t('profile.location')}</div>
                <input className={`pinput${df('location')}`} value={form.location || ''} onChange={e => set('location', e.target.value)} placeholder="" />
              </div>
            </div>
            <div className="pfield">
              <div className="pfield-label">{t('profile.headline')}</div>
              <input className={`pinput${df('headline')}`} value={form.headline || ''} onChange={e => set('headline', e.target.value)} placeholder="" />
            </div>
          </div>


          {/* Skills */}
          <div className="pcard">
            <div className="pcard-h">{t('profile.skills')}</div>
            <div className="pfield">
              <input className={`pinput${df('skills')}`} value={form.skills || ''} onChange={e => set('skills', e.target.value)} placeholder={t('profile.skills.ph')} />
              <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', marginTop: 4 }}>{t('profile.skills.hint')}</div>
            </div>
          </div>

          {/* Education */}
          <div className="pcard">
            <div className="pcard-h">{t('profile.edu')}</div>
            <div className="pinline">
              <div className="pfield">
                <div className="pfield-label">{t('profile.university')}</div>
                <input className={`pinput${df('university')}`} value={form.university || ''} onChange={e => set('university', e.target.value)} placeholder="" />
              </div>
              <div className="pfield">
                <div className="pfield-label">{t('profile.major')}</div>
                <input className={`pinput${df('major')}`} value={form.major || ''} onChange={e => set('major', e.target.value)} placeholder="" />
              </div>
            </div>
            <div className="pinline">
              <div className="pfield">
                <div className="pfield-label">{t('profile.gradyear')}</div>
                <input className={`pinput${df('graduation_year')}`} value={form.graduation_year || ''} onChange={e => set('graduation_year', e.target.value)} placeholder="" />
              </div>
              <div className="pfield">
                <div className="pfield-label">{t('profile.gpa')}</div>
                <input className={`pinput${df('gpa')}`} value={form.gpa || ''} onChange={e => set('gpa', e.target.value)} placeholder="e.g. 3.8 / 4.0" />
              </div>
            </div>
          </div>

          {/* Experience */}
          <div className="pcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="pcard-h" style={{ marginBottom: 0 }}>{t('profile.exp')}</div>
              <button type="button" className="pupload-btn" onClick={() => set('experiences', [...(form.experiences || []), { company: '', role: '', period: '', desc: '' }])}>+ {t('profile.add')}</button>
            </div>
            {(form.experiences || []).map((exp, i) => (
              <div key={i} className="plist-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.3)' }}>#{i + 1}</span>
                  <button type="button" onClick={() => set('experiences', form.experiences.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.25)', fontFamily: 'inherit' }}>{t('profile.remove')}</button>
                </div>
                <div className="pinline">
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.exp.company')}</div>
                    <input className={`pinput${df('experiences')}`} value={exp.company} onChange={e => { const arr = [...form.experiences]; arr[i] = { ...arr[i], company: e.target.value }; set('experiences', arr) }} placeholder="" />
                  </div>
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.exp.role')}</div>
                    <input className={`pinput${df('experiences')}`} value={exp.role} onChange={e => { const arr = [...form.experiences]; arr[i] = { ...arr[i], role: e.target.value }; set('experiences', arr) }} placeholder="" />
                  </div>
                </div>
                <div className="pfield">
                  <div className="pfield-label">{t('profile.exp.period')}</div>
                  <input className={`pinput${df('experiences')}`} value={exp.period} onChange={e => { const arr = [...form.experiences]; arr[i] = { ...arr[i], period: e.target.value }; set('experiences', arr) }} placeholder="e.g. 2022.03 - 2024.01" />
                </div>
                <div className="pfield">
                  <div className="pfield-label">{t('profile.exp.desc')}</div>
                  <textarea className={`pinput ptextarea${df('experiences')}`} value={exp.desc} onChange={e => { const arr = [...form.experiences]; arr[i] = { ...arr[i], desc: e.target.value }; set('experiences', arr) }} placeholder="" style={{ minHeight: 60 }} />
                </div>
              </div>
            ))}
            {(!form.experiences || form.experiences.length === 0) && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(0,0,0,0.25)', fontSize: 13 }}>{t('profile.exp.empty')}</div>
            )}
          </div>

          {/* Projects */}
          <div className="pcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="pcard-h" style={{ marginBottom: 0 }}>{t('profile.projects')}</div>
              <button type="button" className="pupload-btn" onClick={() => set('projects', [...(form.projects || []), { name: '', desc: '', url: '' }])}>+ {t('profile.add')}</button>
            </div>
            {(form.projects || []).map((proj, i) => (
              <div key={i} className="plist-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.3)' }}>#{i + 1}</span>
                  <button type="button" onClick={() => set('projects', form.projects.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.25)', fontFamily: 'inherit' }}>{t('profile.remove')}</button>
                </div>
                <div className="pfield">
                  <div className="pfield-label">{t('profile.projects.name')}</div>
                  <input className={`pinput${df('projects')}`} value={proj.name} onChange={e => { const arr = [...form.projects]; arr[i] = { ...arr[i], name: e.target.value }; set('projects', arr) }} placeholder="" />
                </div>
                <div className="pfield">
                  <div className="pfield-label">{t('profile.projects.desc')}</div>
                  <textarea className={`pinput ptextarea${df('projects')}`} value={proj.desc} onChange={e => { const arr = [...form.projects]; arr[i] = { ...arr[i], desc: e.target.value }; set('projects', arr) }} placeholder="" style={{ minHeight: 60 }} />
                </div>
                <div className="pfield">
                  <div className="pfield-label">{t('profile.projects.url')}</div>
                  <input className={`pinput${df('projects')}`} value={proj.url} onChange={e => { const arr = [...form.projects]; arr[i] = { ...arr[i], url: e.target.value }; set('projects', arr) }} placeholder="https://" />
                </div>
              </div>
            ))}
            {(!form.projects || form.projects.length === 0) && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(0,0,0,0.25)', fontSize: 13 }}>{t('profile.projects.empty')}</div>
            )}
          </div>

          {msg && <div className="pmsg">{msg}</div>}
        </>)}

        {tab === 'posts' && (<>
          {myPostsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 14 }}>Loading...</div>
          ) : myPosts.length === 0 ? (
            <div className="pcard" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.35)' }}>{t('comm.empty') || '게시물이 없습니다'}</div>
              <a href="/community" style={{ fontSize: 13, color: '#ff6000', marginTop: 8, display: 'inline-block' }}>{t('comm.write') || '글쓰기'}</a>
            </div>
          ) : (
            <div className="pcard">
              {myPosts.map(post => (
                <a key={post.id} href={`/community/${post.id}`} className="pw-post-item">
                  <div className="pw-post-title">{post.title}</div>
                  <div className="pw-post-meta">
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> {post.like_count || 0}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> {post.comment_count || 0}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>)}

        {tab === 'employment' && (<>
          <div className="pcard">
            <div className="pcard-h">{t('profile.employment.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              {t('profile.employment.desc')}
            </div>

            {/* Document Type */}
            <div className="pfield">
              <div className="pfield-label">{t('profile.employment.docType')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['payslip', 'contract', 'tax_return', 'other'].map(dt => (
                  <button key={dt} type="button"
                    className={`psignal-btn${verifyForm.document_type === dt ? ' on' : ''}`}
                    style={{ minWidth: 'auto', flex: 'none', padding: '8px 14px' }}
                    onClick={() => setVerifyForm(prev => ({ ...prev, document_type: dt }))}>
                    {t(`profile.employment.docType.${dt}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Salary Amount */}
            <div className="pfield">
              <div className="pfield-label">{t('profile.employment.salary')}</div>
              <input className="pinput" type="number" value={verifyForm.salary_amount}
                onChange={e => setVerifyForm(prev => ({ ...prev, salary_amount: e.target.value }))}
                placeholder={t('profile.employment.salaryPh')} />
            </div>

            {/* File Upload */}
            <div className="pfield">
              <div className="pfield-label">{t('profile.employment.upload')}</div>
              <input ref={salaryDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }} />
              <button type="button" className="presume-upload-btn" onClick={() => salaryDocRef.current?.click()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {t('profile.employment.upload')}
              </button>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 6 }}>{t('profile.employment.uploadHint')}</div>
            </div>

            {verifyMsg && <div className="pmsg" style={{ background: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>{verifyMsg}</div>}

            <button type="button" onClick={handleVerifyUpload} disabled={verifyUploading}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: '#ff6000', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: verifyUploading ? 0.5 : 1 }}>
              {verifyUploading ? t('profile.employment.submitting') : t('profile.employment.submit')}
            </button>
          </div>

          {/* Verification History */}
          <div className="pcard">
            <div className="pcard-h">{t('profile.employment.history')}</div>
            {verificationsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>Loading...</div>
            ) : verifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>{t('profile.employment.noHistory')}</div>
            ) : (
              <div>
                {verifications.map(v => (
                  <div key={v.id} style={{ padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                        {t(`profile.employment.docType.${v.document_type}`)}
                        {v.salary_amount ? ` — ${(v.salary_amount / 1000000).toLocaleString()} ${t('salary.unitMonthly')}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 2 }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </div>
                      {v.admin_note && (
                        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 4, fontStyle: 'italic' }}>{v.admin_note}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                      ...(v.status === 'pending' ? { background: 'rgba(245,158,11,0.1)', color: '#d97706' }
                        : v.status === 'approved' ? { background: 'rgba(34,197,94,0.1)', color: '#16a34a' }
                        : { background: 'rgba(239,68,68,0.1)', color: '#dc2626' })
                    }}>
                      {t(`profile.employment.status.${v.status}`)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}

        {tab === 'badges' && (<>
          <div className="pcard">
            <div className="pcard-h">{t('profile.badges.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              {t('profile.badges.desc')}
            </div>

            {badgesLoading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>Loading...</div>
            ) : (() => {
              const salaryBadge = badges.find(b => b.badge_type === 'salary_range')
              const userTier = salaryBadge ? getSalaryTier(salaryBadge.salary_amount) : null
              return (<>
                {!salaryBadge && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,96,0,0.05)', border: '1px solid rgba(255,96,0,0.15)', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', lineHeight: 1.5, flex: 1 }}>{t('profile.badges.noBadgesHint')}</div>
                    <button type="button" onClick={() => setTab('employment')}
                      style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,96,0,0.3)', background: '#fff', color: '#ff6000', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {t('profile.tab.employment')}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...SALARY_TIERS].reverse().map(tier => {
                    const unlocked = !!userTier && tier.key === userTier.key
                    return (
                      <div key={tier.key} style={{
                        padding: 14, borderRadius: 12,
                        border: unlocked ? '1px solid rgba(255,96,0,0.3)' : '1px solid rgba(0,0,0,0.06)',
                        background: unlocked ? 'rgba(255,96,0,0.04)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        opacity: unlocked ? 1 : 0.7,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <SalaryBadge tierKey={tier.key} t={t} variant="lg" locked={!unlocked} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: unlocked ? '#111' : 'rgba(0,0,0,0.4)' }}>
                              {t(`salary.tier.${tier.key}`)}
                            </div>
                            <div style={{ fontSize: 11, color: unlocked ? '#ff6000' : 'rgba(0,0,0,0.3)', marginTop: 2, fontWeight: unlocked ? 700 : 400 }}>
                              {unlocked ? t('profile.badges.unlocked') : t('profile.badges.locked')}
                            </div>
                          </div>
                        </div>
                        {unlocked ? (
                          <button type="button" onClick={() => handleToggleBadge('salary_range', salaryBadge.is_active)}
                            style={{
                              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, flexShrink: 0,
                              ...(salaryBadge.is_active
                                ? { background: '#ff6000', color: '#fff' }
                                : { background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.5)' }),
                            }}>
                            {salaryBadge.is_active ? t('profile.badges.active') : t('profile.badges.activate')}
                          </button>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 4 }}>
                            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>

                {salaryBadge && (
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', lineHeight: 1.6, marginTop: 14 }}>
                    {t('profile.badges.communityNote')}
                  </div>
                )}
              </>)
            })()}
          </div>
        </>)}

        {/* Logout — mobile only */}
        <button className="pw-logout" onClick={async () => {
          await supabase.auth.signOut()
          window.location.href = '/'
        }}>
          {t('nav.logout')}
        </button>
      </div>

      {/* Floating Save Button */}
      <div className={`psave-wrap${isDirty ? ' show' : ''}`}>
        <div className="psave-inner">
          <button className="psave" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </div>

      {/* Onboarding Modal — Step-by-step */}
      {showOnboard && <OnboardModal t={t} onClose={() => setShowOnboard(false)} />}

      {showAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowAlert(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, maxWidth: 360, width: '100%', padding: '32px 28px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,96,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{showAlert}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 20, lineHeight: 1.5 }}>{t('profile.completion.incomplete')}</div>
            <button onClick={() => setShowAlert(null)}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#ff6000', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              OK
            </button>
          </div>
        </div>
      )}

      {showPublishPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowPublishPrompt(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%', padding: '32px 28px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,68,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: 24 }}>&#128640;</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 6 }}>{t('profile.publishPrompt.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginBottom: 24, lineHeight: 1.6 }}>{t('profile.publishPrompt.desc')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowPublishPrompt(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.publishPrompt.skip')}
              </button>
              <button onClick={async () => {
                set('hr_visible', true)
                setShowPublishPrompt(false)
                const payload = { ...form, hr_visible: true, skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [], yoe_months: form.yoe_months ? parseInt(form.yoe_months) : null, salary_min: form.salary_min ? parseInt(form.salary_min) * 1000000 : null, salary_max: form.salary_max ? parseInt(form.salary_max) * 1000000 : null }
                delete payload.photo_url; delete payload.resume_url
                await fetch('/api/profile/talent', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
                setInitialForm(prev => ({ ...prev, hr_visible: true }))
                setMsg('Saved!')
                setTimeout(() => setMsg(null), 2000)
              }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#ff4400', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.publishPrompt.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 340, width: '100%', padding: '28px 24px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>{t('profile.leave.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 20, lineHeight: 1.5 }}>{t('profile.leave.desc')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowLeaveConfirm(false); setForm({ ...initialForm }); router.push(pendingRoute.current) }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.leave.no')}
              </button>
              <button onClick={async () => { setShowLeaveConfirm(false); await handleSave(); router.push(pendingRoute.current) }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: '#ff6000', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.leave.yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTabConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 340, width: '100%', padding: '28px 24px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>{t('profile.leave.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 20, lineHeight: 1.5 }}>{t('profile.leave.desc')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowTabConfirm(false); setForm({ ...initialForm }); setTab(pendingTab.current) }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.leave.no')}
              </button>
              <button onClick={async () => { setShowTabConfirm(false); await handleSave(); setTab(pendingTab.current) }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: '#ff6000', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.leave.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
