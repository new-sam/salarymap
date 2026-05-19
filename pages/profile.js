import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'
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
    p.resume_url, p.skills,
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
  const [tab, setTab] = useState('profile') // profile | salary
  const [showOnboard, setShowOnboard] = useState(false)
  const [showAlert, setShowAlert] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [percentile, setPercentile] = useState(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiProgress, setAiProgress] = useState({ percent: 0, message: '' })
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const pendingRoute = useRef(null)
  const photoRef = useRef(null)
  const resumeRef = useRef(null)

  // Form state
  const [form, setForm] = useState({})
  const [initialForm, setInitialForm] = useState({})
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
  const df = (k) => { const a = form[k], b = initialForm[k]; const changed = typeof a === 'object' ? JSON.stringify(a) !== JSON.stringify(b) : a !== b; return changed && a ? ' dirty' : '' }
  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty

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
          }
          setForm(formData)
          setInitialForm(formData)
          if (!p.headline && !p.position) {
            setShowOnboard(true)
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
    if (res.ok) { const { profile: p } = await res.json(); setProfile(p) }
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
        .pw-tabs { display: flex; gap: 4px; margin-bottom: 24px; }
        .pw-tab { font-size: 13px; font-weight: 600; color: rgba(0,0,0,0.35); background: none; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .pw-tab.on { color: #111; background: rgba(0,0,0,0.06); }
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
        .pinline { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
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
      `}</style>

      <GlobalNav activePage="profile" />

      <div className="pw">
        {/* Tabs */}
        <div className="pw-tabs">
          <button className={`pw-tab${tab === 'profile' ? ' on' : ''}`} onClick={() => setTab('profile')}>{t('profile.tab.talent')}</button>
          <button className={`pw-tab${tab === 'salary' ? ' on' : ''}`} onClick={() => setTab('salary')}>{t('profile.tab.salary')}</button>
        </div>

        {tab === 'profile' && (<>
          {/* HR Visibility Banner */}
          <div className="phr-banner">
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t('profile.hr.title')}</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5 }}>
                  {t('profile.hr.desc')}
                </div>
              </div>
              <button className={`ptoggle-switch${form.hr_visible ? ' on' : ''}`} onClick={() => {
                if (score < 60 && !form.hr_visible) {
                  setShowAlert(t('profile.hr.need80'))
                  return
                }
                set('hr_visible', !form.hr_visible)
              }} />
            </div>
          </div>

          {/* Job Signal */}
          <div className="pcard">
            <div className="pcard-h">{t('profile.signal')}</div>
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
            {form.job_signal && form.job_signal !== 'passive' && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
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
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.worktype')}</div>
                    <CustomSelect value={form.work_type} options={WORK_TYPES} placeholder={t('profile.worktype.ph')} onChange={v => set('work_type', v)} />
                  </div>
                </div>
              </div>
            )}
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

        </>)}

        {tab === 'salary' && (<>
          {/* Salary tab — existing content */}
          {percentile && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', marginBottom: 16, textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{t('profile.salary.where')}</div>
              <div><span style={{ fontSize: 42, fontWeight: 800, color: '#111' }}>Top </span><span style={{ fontSize: 42, fontWeight: 800, color: '#ff6000' }}>{percentile.percentile}%</span></div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 20 }}>Among {submissions[0]?.role} with {submissions[0]?.experience} experience</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                {[{ l: 'You', v: `${percentile.userSalary}M`, c: '#111' }, { l: 'Median', v: `${percentile.marketMedian}M`, c: 'rgba(0,0,0,0.45)' }, { l: 'Diff', v: `${percentile.diff >= 0 ? '+' : ''}${percentile.diff}M`, c: percentile.diff >= 0 ? '#16a34a' : '#dc2626' }].map((d, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '10px 18px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: 2 }}>{d.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: d.c }}>{d.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submissions.length > 0 && (
            <div className="pcard">
              <div className="pcard-h">My Submissions ({submissions.length})</div>
              {submissions.map((sub, i) => (
                <div key={sub.id} style={{ padding: '14px 0', borderBottom: i < submissions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{sub.role} · {sub.experience}</div>
                    <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>{sub.company || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ff6000' }}>{sub.salary}M VND</div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>{new Date(sub.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {submissions.length === 0 && (
            <div className="pcard" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.35)' }}>{t('profile.salary.none')}</div>
              <a href="/#submit" style={{ fontSize: 13, color: '#ff6000', marginTop: 8, display: 'inline-block' }}>{t('profile.salary.submit')}</a>
            </div>
          )}
        </>)}
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
    </>
  )
}
