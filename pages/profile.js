import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Badge, { badgeLabel } from '../components/Badge'
import { badgeVisual } from '../lib/badgeVisuals'
import { useT } from '../lib/i18n'
import Icon from '../components/Icon'
import { ROLE_GROUPS } from '../constants/jobs'
import { completionScore } from '../lib/profileScore'
import ApplicationCard, { applicationCardCss } from '../components/ApplicationCard'
import EmploymentTab from '../components/profile/EmploymentTab'
import BadgesTab from '../components/profile/BadgesTab'

// 프로필 직군 선택 — 공고/ATS와 동일한 ROLE_GROUPS. 대분류→소분류 2단계로 고른다.
// 저장값은 소분류 canonical(r.value) 하나만 form.position에 유지.
const lbl = (o, lang) => o.label[lang] || o.label.en
const groupItems = (lang) => ROLE_GROUPS.map(g => ({ value: g.key, label: lbl(g, lang) }))
const roleItems = (groupKey, lang) => {
  const g = ROLE_GROUPS.find(g => g.key === groupKey)
  return g ? g.roles.map(r => ({ value: r.value, label: lbl(r, lang) })) : []
}
const groupOfRole = (value) => ROLE_GROUPS.find(g => g.roles.some(r => r.value === value))?.key || ''
const groupLabel = (groupKey, lang) => { const g = ROLE_GROUPS.find(g => g.key === groupKey); return g ? lbl(g, lang) : '' }
// 저장값(소분류)의 표시 라벨. 구버전 자유입력 값은 원문 그대로.
const positionLabel = (value, lang) => {
  for (const g of ROLE_GROUPS) { const r = g.roles.find(r => r.value === value); if (r) return lbl(r, lang) }
  return value
}
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

function CustomSelect({ value, options, items, placeholder, onChange, displayValue, disabled }) {
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
      <button type="button" disabled={disabled} onClick={() => setOpen(v => !v)} style={{
        width: '100%', fontSize: 14, padding: '10px 12px', border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8, background: disabled ? '#f5f5f5' : '#fff', color: value ? '#111' : 'rgba(0,0,0,0.3)',
        fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'border-color .15s', outline: 'none', opacity: disabled ? 0.6 : 1,
        ...(open ? { borderColor: '#ff4400' } : {}),
      }}>
        <span>{displayValue || value || placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10,
          padding: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', scrollbarWidth: 'none',
        }} className="pselect-dropdown">
          {items
            ? items.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }} style={{
                display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 6,
                background: value === o.value ? 'rgba(255,68,0,0.08)' : 'transparent',
                color: value === o.value ? '#ff4400' : 'rgba(0,0,0,0.6)',
                fontSize: 13, fontWeight: value === o.value ? 600 : 400, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', transition: 'background .1s',
              }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                onMouseLeave={e => { if (value !== o.value) e.currentTarget.style.background = 'transparent' }}>
                {o.label}
              </button>
            ))
            : options.map(opt => (
              <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false) }} style={{
                display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 6,
                background: value === opt ? 'rgba(255,68,0,0.08)' : 'transparent',
                color: value === opt ? '#ff4400' : 'rgba(0,0,0,0.6)',
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

export default function ProfilePage() {
  const router = useRouter()
  const { t, lang } = useT()
  const [posGroup, setPosGroup] = useState('') // 직군 대분류 선택(소분류 저장은 form.position)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tab, setTab] = useState('profile') // profile | posts | employment | badges | applications
  const [isAdmin, setIsAdmin] = useState(false)
  // 이력서는 이미 있는데(예: /cv·앱에서 등록) 프로필이 빈 유저 — AI 자동 채움 제안
  const [showAiFill, setShowAiFill] = useState(false)
  const [showAlert, setShowAlert] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [percentile, setPercentile] = useState(null)
  const [aiParsing, setAiParsing] = useState(false)
  const [aiProgress, setAiProgress] = useState({ percent: 0, message: '' })
  // 이탈 확인 — 라우트 이동/탭 전환을 pendingNav 하나로 통합
  const [pendingNav, setPendingNav] = useState(null) // { type: 'route'|'tab', target }
  const [sharingResume, setSharingResume] = useState(false)
  // AI 인식 완료 후 인재풀 공개 제안 — 파싱이 끝난 시점에 물어본다
  const [showSharePrompt, setShowSharePrompt] = useState(false)
  const [myPosts, setMyPosts] = useState([])
  const [myPostsLoading, setMyPostsLoading] = useState(false)
  // Company email verification (work-email ownership -> verified_company badge)
  // cvStep/cvCompany는 헤더 인증칩에 필요해 부모 소유 — 나머지는 EmploymentTab 내부로 이동.
  const [cvStep, setCvStep] = useState('idle') // idle | sent | verified
  const [cvCompany, setCvCompany] = useState(null)
  // 대표 뱃지 — 히어로 헤더 노출용으로 부모 소유, 상세 로직은 BadgesTab.
  const [representativeBadge, setRepresentativeBadge] = useState(null)
  const [applications, setApplications] = useState([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
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
  const formRef = useRef(form)
  formRef.current = form
  const profileRefPublic = useRef(false)
  profileRefPublic.current = !!profile?.is_resume_public

  const handleTabChange = (newTab) => {
    if (newTab === tab) return
    if (isDirty && tab === 'profile') {
      setPendingNav({ type: 'tab', target: newTab })
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
      setPendingNav({ type: 'route', target: url })
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

      // Fetch profile and submissions in parallel. Submissions go through a
      // service-role endpoint (own rows only) since the table's PII columns are
      // no longer readable by the client after the RLS/column lockdown.
      const [profileRes, subsRes] = await Promise.all([
        fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/my-submissions', { headers: { Authorization: `Bearer ${session.access_token}` } }),
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
            portfolio_url: p.portfolio_url || '',
            gpa: p.gpa || '',
            experiences: p.experiences || [],
            projects: p.projects || [],
            is_resume_public: p.is_resume_public || false,
          }
          setForm(formData)
          setInitialForm(formData)
          // Reflect company-verification status in the header
          if (p.company_verified_at) {
            setCvStep('verified')
            setCvCompany(p.verified_company_name || null)
          }
          // Auto-save Google name if DB is empty
          if (!p.full_name && formData.full_name) {
            fetch('/api/profile/talent', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ full_name: formData.full_name }),
            })
          }
          if (!p.headline && !p.position) {
            // 이력서가 이미 등록돼 있으면 일반 온보딩 대신 "이력서로 채워줄까요?" 제안
            if (p.resume_url) setShowAiFill(true)
          }
        }
      }

      const subs = subsRes.ok ? (await subsRes.json()).submissions : []
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

  // 대표 뱃지 — 히어로 노출용 1회 조회 (상세 데이터는 BadgesTab이 자체 fetch).
  useEffect(() => {
    if (!token) return
    fetch('/api/badges', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setRepresentativeBadge(d.representative_badge ?? null))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (tab !== 'applications' || !user?.id || applications.length > 0) return
    setApplicationsLoading(true)
    fetch('/api/my-applications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setApplications(d.data || []))
      .catch(() => {})
      .finally(() => setApplicationsLoading(false))
  }, [tab, user])

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...form,
      skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      yoe_months: form.yoe_months ? parseInt(form.yoe_months) : null,
      salary_min: form.salary_min ? parseInt(form.salary_min) * 1000000 : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) * 1000000 : null,
    }
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
      headers: { Authorization: `Bearer ${token}`, 'X-Resume-Source': 'profile' },
      body: fd,
    })
    if (res.ok) {
      const { url } = await res.json()
      setProfile(prev => {
        const next = { ...prev, [type === 'photo' ? 'photo_url' : 'resume_url']: url }
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: next }))
        return next
      })
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

      // 파싱 결과를 병합해 즉시 저장 — 저장 없이 이탈해도 소실되지 않도록.
      // initialForm까지 동기화해 dirty(플로팅 저장버튼) 미발생.
      const merged = {
        ...formRef.current,
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
      }
      setForm(merged)
      const payload = {
        ...merged,
        skills: merged.skills ? String(merged.skills).split(',').map(x => x.trim()).filter(Boolean) : [],
        yoe_months: merged.yoe_months ? parseInt(merged.yoe_months) : null,
        salary_min: merged.salary_min ? parseInt(merged.salary_min) * 1000000 : null,
        salary_max: merged.salary_max ? parseInt(merged.salary_max) * 1000000 : null,
      }
      await fetch('/api/profile/talent', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
      setInitialForm(merged)

      setAiProgress({ percent: 100, message: t('profile.ai.done') })
      setMsg(t('profile.ai.verify'))
      // Refresh profile for completion score
      const profileRes = await fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${token}` } })
      if (profileRes.ok) { const { profile: p } = await profileRes.json(); setProfile(p); window.dispatchEvent(new CustomEvent('profile-updated', { detail: p })) }
    } catch (err) {
      clearInterval(timer)
      setShowAlert('AI parsing failed: ' + err.message)
    }
    setTimeout(() => {
      setAiParsing(false)
      setAiProgress({ percent: 0, message: '' })
      setShowAiFill(false) // AI 자동 채움 제안 모달에서 시작한 경우 — 완료 후 닫기
      // 인식이 끝난 시점에 인재풀 공개 제안 — 아직 비공개인 경우만
      if (!profileRefPublic.current) setShowSharePrompt(true)
    }, 1500)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f5' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #ff4400', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const score = completionScore({ ...form, resume_url: profile?.resume_url })

  return (
    <>
      <Head><title>Profile — FYI</title></Head>
      <style>{`
        body { background: #f7f7f5; }
        .pw { max-width: 580px; margin: 0 auto; padding: 32px 20px 80px; font-family: 'Barlow', system-ui, sans-serif; }
        .pw-hero { margin-bottom: 20px; }
        .pw-hero-top { display: flex; align-items: center; gap: 16px; }
        .pw-avatar-wrap { position: relative; flex-shrink: 0; cursor: pointer; }
        .pw-avatar-ring { padding: 2.5px; border-radius: 50%; background: linear-gradient(135deg, #ff4400, #ffb088); display: inline-block; }
        .pw-avatar { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; border: 2.5px solid #fff; display: block; }
        .pw-avatar-empty { background: rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; }
        .pw-avatar-cam { position: absolute; bottom: 0; right: 0; width: 22px; height: 22px; border-radius: 50%; background: #111; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; }
        .pw-avatar-x { position: absolute; top: -2px; right: -2px; width: 20px; height: 20px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); cursor: pointer; display: none; align-items: center; justify-content: center; padding: 0; }
        .pw-avatar-wrap:hover .pw-avatar-x { display: flex; }
        .pw-hero-info { flex: 1; min-width: 0; }
        .pw-hero-name-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .pw-hero-name { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #111; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pw-hero-headline { font-size: 13.5px; color: #555; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pw-hero-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #888; margin-top: 4px; flex-wrap: wrap; }
        .pw-hero-dot { color: #ccc; }
        .pw-hero-progress { margin-top: 14px; }
        .pw-hero-bar { height: 6px; border-radius: 3px; background: rgba(0,0,0,0.06); overflow: hidden; }
        .pw-hero-bar-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
        .pw-hero-progress-caption { display: block; font-size: 11.5px; color: rgba(0,0,0,0.45); margin-top: 6px; }
        /* AI 이력서 드롭존 — 핵심 전환 기능. 라이트 페이지에서 유일한 다크 피처 패널(/cv 프로모 무드). */
        .pai-drop { position: relative; border-radius: 16px; padding: 30px 22px 28px; text-align: center; cursor: pointer; overflow: hidden; isolation: isolate;
          background: radial-gradient(340px circle at 15% -20%, rgba(255,68,0,0.42), transparent 60%),
                      radial-gradient(300px circle at 90% 120%, rgba(255,122,77,0.28), transparent 55%),
                      linear-gradient(160deg, #201612, #120d0a 65%);
          transition: transform .15s, box-shadow .15s; box-shadow: 0 10px 30px rgba(24,14,8,0.28); }
        .pai-drop::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
          background-image: linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
          background-size: 26px 26px; mask-image: radial-gradient(closest-side at 50% 40%, #000, transparent); -webkit-mask-image: radial-gradient(closest-side at 50% 40%, #000, transparent); }
        .pai-drop:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(24,14,8,0.36); }
        .pai-chip { display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); color: rgba(255,255,255,0.72); font-size: 10px; font-weight: 800; letter-spacing: 1.2px; padding: 4px 11px; border-radius: 100px; margin-bottom: 13px; }
        .pai-doc { position: relative; width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 14px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .pai-scanline { position: absolute; left: 6px; right: 6px; height: 14px; border-radius: 3px;
          background: linear-gradient(180deg, transparent, rgba(255,122,45,0.45) 45%, rgba(255,170,90,0.9) 50%, rgba(255,122,45,0.45) 55%, transparent);
          animation: paiScan 2.4s ease-in-out infinite; }
        @keyframes paiScan { 0%, 12% { top: -16px; opacity: 0; } 22% { opacity: 1; } 78% { opacity: 1; } 88%, 100% { top: 54px; opacity: 0; } }
        .pai-title { font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 5px; letter-spacing: -0.3px; }
        .pai-sub { font-size: 12.5px; color: rgba(255,255,255,0.55); margin-bottom: 18px; line-height: 1.55; }
        .pai-btn { position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 7px; background: linear-gradient(90deg, #ff4400, #ff6a2b); color: #fff; font-size: 13.5px; font-weight: 800; padding: 12px 24px; border-radius: 100px; box-shadow: 0 8px 22px rgba(255,68,0,0.45); }
        .pai-drop:hover .pai-btn { filter: brightness(1.06); }
        .pai-btn-shine { position: absolute; inset: 0; border-radius: 100px; overflow: hidden; pointer-events: none; }
        .pai-btn-shine::before { content: ''; position: absolute; top: 0; left: -100%; width: 55%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); animation: paiShine 2.8s ease-in-out infinite; }
        @keyframes paiShine { 0% { left: -100%; } 55% { left: 130%; } 100% { left: 130%; } }
        .pw-tabs { display: flex; gap: 2px; margin-bottom: 20px; background: #ecebe8; padding: 3px; border-radius: 12px; overflow-x: auto; scrollbar-width: none; }
        .pw-tabs::-webkit-scrollbar { display: none; }
        .pw-tab { flex: 1; font-size: 13px; font-weight: 700; color: #8a8a86; background: none; border: none; padding: 9px 10px; cursor: pointer; font-family: inherit; border-radius: 9px; white-space: nowrap; transition: color .15s, background .15s; }
        .pw-tab.on { color: #111; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .pw-post-item { display: block; padding: 14px 0; border-bottom: 1px solid rgba(0,0,0,0.06); text-decoration: none; }
        .pw-post-item:last-child { border-bottom: none; }
        .pw-post-title { font-size: 14px; font-weight: 600; color: #111; margin-bottom: 4px; }
        .pw-post-meta { font-size: 12px; color: #aaa; display: flex; gap: 10px; }
        ${applicationCardCss}
        .pcard { background: #fff; border: 1px solid #f0efec; border-radius: 16px; padding: 24px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(17,24,39,0.03); }
        .pcard-h { font-size: 15px; font-weight: 800; color: #111; letter-spacing: -0.2px; margin-bottom: 16px; display: flex; align-items: center; gap: 9px; }
        .pcard-ico { width: 27px; height: 27px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,68,0,0.08); color: #ff4400; flex-shrink: 0; }
        .pfield { margin-bottom: 16px; }
        .pfield:last-child { margin-bottom: 0; }
        .pfield-label { font-size: 12px; font-weight: 700; color: rgba(0,0,0,0.5); letter-spacing: .02em; margin-bottom: 6px; }
        .pfield-value { font-size: 14px; color: #111; }
        .pinput { width: 100%; font-size: 14px; padding: 10px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; outline: none; font-family: inherit; background: #fff; color: #111; transition: border-color .15s; }
        .pinput.dirty { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.03); }
        .pinput:focus { border-color: #ff4400; }
        .pinput::placeholder { color: rgba(0,0,0,0.25); }
        .ptextarea { min-height: 100px; resize: vertical; }
        .psignal-btn { flex: 1; min-width: 120px; padding: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: rgba(0,0,0,0.02); font-size: 12px; font-weight: 600; color: rgba(0,0,0,0.4); cursor: pointer; text-align: center; font-family: inherit; transition: all .15s; }
        .psignal-btn.on { border-color: #ff4400; color: #ff4400; background: rgba(255,68,0,0.06); }
        .pselect-dropdown::-webkit-scrollbar { display: none; }
        .psave-wrap { position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); background: rgba(250,250,250,0.95); backdrop-filter: blur(10px); transform: translateY(100%); transition: transform .25s ease; pointer-events: none; }
        @media (max-width: 768px) { .psave-wrap { bottom: calc(60px + env(safe-area-inset-bottom)); padding: 10px 16px; } }
        .psave-wrap.show { transform: translateY(0); pointer-events: auto; }
        .psave-inner { max-width: 580px; margin: 0 auto; }
        .psave { width: 100%; padding: 14px; background: #ff4400; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 12px rgba(255,68,0,0.3); }
        .psave:disabled { opacity: 0.5; box-shadow: none; }
        .pmsg { background: #fff; color: #111; font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .pprogress { height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; margin-bottom: 8px; overflow: hidden; }
        .pprogress-fill { height: 100%; border-radius: 3px; transition: width .5s; }
        .pphoto-wrap { display: flex; align-items: center; gap: 16px; }
        .pphoto { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(0,0,0,0.08); }
        .pphoto-placeholder { width: 72px; height: 72px; border-radius: 50%; background: rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(0,0,0,0.12); }
        .pupload-btn { font-size: 12px; font-weight: 600; color: #ff4400; background: none; border: 1px solid rgba(255,68,0,0.3); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-family: inherit; }
        .phr-banner { background: linear-gradient(135deg, rgba(255,68,0,0.06), rgba(255,68,0,0.02)); border: 1px solid rgba(255,68,0,0.15); border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
        .ptoggle { display: flex; align-items: center; gap: 12px; }
        .ptoggle-switch { width: 44px; height: 24px; border-radius: 12px; background: rgba(0,0,0,0.12); cursor: pointer; position: relative; transition: background .2s; border: none; padding: 0; }
        .ptoggle-switch.on { background: #ff4400; }
        .ptoggle-switch::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #fff; position: absolute; top: 3px; left: 3px; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
        .ptoggle-switch.on::after { transform: translateX(20px); }
        .pinline { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        @media (max-width: 500px) { .pinline { grid-template-columns: 1fr; } }
        .plist-item { background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.05); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
        .plist-item:last-of-type { margin-bottom: 0; }
        .presume-upload-btn { width: 100%; padding: 16px; border-radius: 10px; border: 2px dashed rgba(255,68,0,0.3); background: rgba(255,68,0,0.04); display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 700; color: #ff4400; transition: all .15s; }
        .presume-upload-btn:hover { border-color: #ff4400; background: rgba(255,68,0,0.08); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pw-resume-cta { display: none; }
        .pw-logout { display: none; }
        @media (max-width: 768px) {
          .pw-resume-cta { display: flex; align-items: center; gap: 10px; padding: 14px 16px; margin-bottom: 16px; background: linear-gradient(135deg, #ff4400, #ff7a1a); border-radius: 12px; color: #fff; font-size: 13px; cursor: pointer; box-shadow: 0 2px 12px rgba(255,68,0,0.3); }
          .pw-logout { display: block; width: 100%; padding: 14px; margin-top: 32px; margin-bottom: 20px; background: none; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; font-size: 14px; font-weight: 600; color: #999; cursor: pointer; font-family: 'Barlow', sans-serif; }
        }
      `}</style>


      <div className="pw">
        {/* Hero header — 사진·이름·헤드라인·인증칩·대표뱃지·완성도 요약 */}
        <div className="pw-hero">
          <div className="pw-hero-top">
            <div className="pw-avatar-wrap" onClick={() => photoRef.current?.click()} title={t('profile.photo.upload')}>
              <span className="pw-avatar-ring">
                {profile?.photo_url ? (
                  <img src={profile.photo_url} className="pw-avatar" alt="" />
                ) : (
                  <div className="pw-avatar pw-avatar-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                )}
              </span>
              <span className="pw-avatar-cam">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </span>
              {profile?.photo_url && (
                <button type="button" className="pw-avatar-x" onClick={(e) => { e.stopPropagation(); setProfile(prev => { const next = { ...prev, photo_url: '' }; window.dispatchEvent(new CustomEvent('profile-updated', { detail: next })); return next }); fetch('/api/profile/talent', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ photo_url: '' }) }) }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>
                </button>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={e => handleUpload('photo', e.target.files[0])} />
            <div className="pw-hero-info">
              <div className="pw-hero-name-row">
                <h1 className="pw-hero-name">{form.full_name || user?.user_metadata?.full_name || ''}</h1>
                {badgeVisual(representativeBadge) && (
                  <span onClick={() => handleTabChange('badges')} title={badgeLabel(representativeBadge, t)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: badgeVisual(representativeBadge).gold ? '#fdf3d8' : '#f4f4f2', borderRadius: 100, padding: '3px 10px 3px 4px', cursor: 'pointer', flexShrink: 0 }}>
                    <img src={`/badges/${representativeBadge}.webp`} alt=""
                      style={{ width: 22, height: 22, objectFit: 'contain', display: 'block' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: badgeVisual(representativeBadge).gold ? '#a16207' : '#555', whiteSpace: 'nowrap' }}>
                      {badgeLabel(representativeBadge, t)}
                    </span>
                  </span>
                )}
              </div>
              {form.headline && <div className="pw-hero-headline">{form.headline}</div>}
              <div className="pw-hero-meta">
                {form.location && <span>{form.location}</span>}
                {form.location && <span className="pw-hero-dot">·</span>}
                {cvStep === 'verified' && cvCompany ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#0a7d4b' }}>
                    {cvCompany}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#0a7d4b" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" stroke="none"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>
                  </span>
                ) : (
                  <button type="button" onClick={() => handleTabChange('employment')}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#ff4400', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                    {t('profile.companyVerifyPrompt') || '회사 인증을 진행해주세요'}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="pw-hero-progress">
            <div className="pw-hero-bar"><div className="pw-hero-bar-fill" style={{ width: `${score}%`, background: score >= 60 ? '#16a34a' : '#f59e0b' }} /></div>
            <span className="pw-hero-progress-caption">
              <b style={{ color: score >= 60 ? '#16a34a' : '#f59e0b' }}>{score}%</b>
              {' · '}{score < 60 ? `${t('profile.completion.incomplete')} (${t('profile.completion.min80')})` : t('profile.completion.done')}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="pw-tabs">
          <button className={`pw-tab${tab === 'profile' ? ' on' : ''}`} onClick={() => handleTabChange('profile')}>{t('profile.tab.talent')}</button>
          {isAdmin && (
            <button className={`pw-tab${tab === 'posts' ? ' on' : ''}`} onClick={() => handleTabChange('posts')}>{t('profile.tab.posts') || '내 게시물'}</button>
          )}
          <button className={`pw-tab${tab === 'employment' ? ' on' : ''}`} onClick={() => handleTabChange('employment')}>{t('profile.tab.employment') || '재직정보'}</button>
          <button className={`pw-tab${tab === 'badges' ? ' on' : ''}`} onClick={() => handleTabChange('badges')}>{t('profile.tab.badges') || '뱃지'}</button>
          <button className={`pw-tab${tab === 'applications' ? ' on' : ''}`} onClick={() => handleTabChange('applications')}>{t('profile.tab.applications') || '지원 현황'}</button>
        </div>

        {tab === 'profile' && (<>

          {msg && <div className="pmsg">{msg}</div>}
          <div className="pcard" style={{ position: 'relative', overflow: 'visible' }}>
            <div className="pcard-h"><span className="pcard-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>{t('profile.resume')}</div>
            {aiParsing && (
              <div style={{ background: 'rgba(255,68,0,0.04)', border: '1px solid rgba(255,68,0,0.12)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #ff4400', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{aiProgress.message}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${aiProgress.percent}%`, background: '#ff4400', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 6, textAlign: 'right' }}>{aiProgress.percent}%</div>
              </div>
            )}
            <div className="pfield">
              <input ref={resumeRef} type="file" accept=".pdf" hidden onChange={e => handleUpload('resume', e.target.files[0])} />
              {aiParsing ? null : profile?.resume_url ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <a href={profile.resume_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#111', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {decodeURIComponent(profile.resume_url.split('/').pop().split('?')[0])}
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button className="pupload-btn" onClick={() => resumeRef.current?.click()} disabled={aiParsing}>{t('profile.resume.change')}</button>
                    <button onClick={() => { setProfile(prev => ({ ...prev, resume_url: '' })); fetch('/api/profile/talent', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ resume_url: '' }) }) }} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pai-drop" onClick={() => !aiParsing && resumeRef.current?.click()}>
                  <div className="pai-doc">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
                    </svg>
                    <span className="pai-scanline" />
                  </div>
                  <div className="pai-chip">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#ff7a2d"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>
                    AI AUTO-FILL
                  </div>
                  <div className="pai-title">{t('profile.resume.ai_title')}</div>
                  <div className="pai-sub">{t('profile.resume.ai_hint')}</div>
                  <span className="pai-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {t('profile.resume.register')}
                    <span className="pai-btn-shine" />
                  </span>
                </div>
              )}
            </div>
            {!aiParsing && profile?.resume_url && (
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
            <div className="pfield">
              <div className="pfield-label">{t('profile.portfolio')}</div>
              <input className={`pinput${df('portfolio_url')}`} value={form.portfolio_url || ''} onChange={e => set('portfolio_url', e.target.value)} placeholder="" />
            </div>
          </div>

          {/* 희망 조건 — 직군·경력·희망연봉·근무형태 */}
          <div className="pcard">
            <div className="pcard-h">
              <span className="pcard-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg></span>
              {t('profile.prefs')}
            </div>
            <div>
                <div className="pinline">
                  <div className="pfield">
                    <div className="pfield-label">{t('profile.position')}</div>
                    {(() => {
                      const effGroup = posGroup || groupOfRole(form.position)
                      const gPh = lang === 'ko' ? '대분류' : lang === 'vi' ? 'Nhóm ngành' : 'Category'
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <CustomSelect value={effGroup} items={groupItems(lang)} displayValue={groupLabel(effGroup, lang)} placeholder={gPh} onChange={g => { setPosGroup(g); set('position', '') }} />
                          <CustomSelect value={form.position} items={roleItems(effGroup, lang)} displayValue={positionLabel(form.position, lang)} placeholder={t('profile.position.ph')} disabled={!effGroup} onChange={v => set('position', v)} />
                        </div>
                      )
                    })()}
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
                <div className="pfield" style={{ marginTop: 4 }}>
                  <div className="pfield-label">{t('profile.worktype.title')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['All', 'Remote', 'On-site'].map(v => {
                      const isOn = form.work_type === v
                      return (
                        <button key={v} onClick={() => set('work_type', isOn ? '' : v)} style={{
                          padding: '8px 16px', borderRadius: 20, border: isOn ? '1.5px solid #ff4400' : '1.5px solid rgba(0,0,0,0.1)',
                          background: isOn ? 'rgba(255,68,0,0.06)' : '#fff', color: isOn ? '#ff4400' : 'rgba(0,0,0,0.5)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                        }}>
                          {t(`profile.worktype.${v.toLowerCase()}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>
            </div>
          </div>

          <div className="pcard">
            <div className="pcard-h"><span className="pcard-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>{t('profile.basic')}</div>
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
            <div className="pfield">
              <div className="pfield-label">{t('profile.intro')}</div>
              <textarea className={`pinput ptextarea${df('intro')}`} value={form.intro || ''} onChange={e => set('intro', e.target.value)} placeholder={t('profile.intro.ph')} style={{ minHeight: 80 }} />
            </div>
            <div className="pfield">
              <div className="pfield-label">{t('profile.skills')}</div>
              <input className={`pinput${df('skills')}`} value={form.skills || ''} onChange={e => set('skills', e.target.value)} placeholder={t('profile.skills.ph')} />
              <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', marginTop: 4 }}>{t('profile.skills.hint')}</div>
            </div>
          </div>


          {/* Experience */}
          <div className="pcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="pcard-h" style={{ marginBottom: 0 }}><span className="pcard-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></span>{t('profile.exp')}</div>
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
              <div className="pcard-h" style={{ marginBottom: 0 }}><span className="pcard-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>{t('profile.projects')}</div>
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

          {/* Education */}
          <div className="pcard">
            <div className="pcard-h"><span className="pcard-ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg></span>{t('profile.edu')}</div>
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

          {msg && <div className="pmsg">{msg}</div>}
        </>)}

        {tab === 'posts' && (<>
          {myPostsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 14 }}>Loading...</div>
          ) : myPosts.length === 0 ? (
            <div className="pcard" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.35)' }}>{t('comm.empty') || '게시물이 없습니다'}</div>
              <a href="/community" style={{ fontSize: 13, color: '#ff4400', marginTop: 8, display: 'inline-block' }}>{t('comm.write') || '글쓰기'}</a>
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

        {tab === 'employment' && (
          <EmploymentTab token={token} t={t} active={tab === 'employment'}
            cvStep={cvStep} setCvStep={setCvStep} cvCompany={cvCompany} setCvCompany={setCvCompany} />
        )}

        {tab === 'badges' && (
          <BadgesTab token={token} t={t} active={tab === 'badges'}
            representativeBadge={representativeBadge} setRepresentativeBadge={setRepresentativeBadge}
            onGoEmployment={() => setTab('employment')} />
        )}

        {tab === 'applications' && (<>
          {applicationsLoading && applications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 14 }}>Loading...</div>
          ) : applications.length === 0 ? (
            <div className="pcard" style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ marginBottom: 12 }}><Icon name="clipboard" size={40} color="#ccc" /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.5)', marginBottom: 6 }}>{t('apps.emptyTitle')}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)', marginBottom: 16 }}>{t('apps.emptyDesc')}</div>
              <a href="/jobs" style={{ fontSize: 13, fontWeight: 700, color: '#ff4400', textDecoration: 'none' }}>{t('apps.browseJobs')}</a>
            </div>
          ) : (
            applications.map(app => (
              <ApplicationCard key={app.id} app={app} t={t} onClick={() => router.push(`/jobs?jobId=${app.job_id}`)} />
            ))
          )}
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

      {/* AI 자동 채움 제안 — 이력서는 있는데 프로필이 빈 유저 */}
      {showAiFill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 20, maxWidth: 400, width: '100%', padding: '30px 24px 22px', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }} aria-hidden>📄</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: '#1a1612' }}>{t('profile.aifill.title')}</h3>
            {aiParsing ? (
              /* 진행 상황을 모달 안에서 보여준다 — 닫아버리면 어디서 진행되는지 알 수 없다 */
              <>
                <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden', margin: '20px 0 12px' }}>
                  <div style={{ height: '100%', width: `${aiProgress.percent}%`, background: '#ff4400', borderRadius: 999, transition: 'width .6s ease' }} />
                </div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'rgba(26,22,18,0.55)', minHeight: 20 }}>{aiProgress.message}</p>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(26,22,18,0.6)', lineHeight: 1.55 }}>{t('profile.aifill.desc')}</p>
                <button
                  onClick={() => runAiParse()}
                  style={{ display: 'block', width: '100%', background: '#ff4400', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t('profile.aifill.confirm')}
                </button>
                <button
                  onClick={() => setShowAiFill(false)}
                  style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', color: 'rgba(26,22,18,0.45)', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t('profile.aifill.decline')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowAlert(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16, maxWidth: 360, width: '100%', padding: '32px 28px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,68,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4400" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{showAlert}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 20, lineHeight: 1.5 }}>{t('profile.completion.incomplete')}</div>
            <button onClick={() => setShowAlert(null)}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#ff4400', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              OK
            </button>
          </div>
        </div>
      )}

      {showSharePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowSharePrompt(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%', padding: '32px 28px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,68,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 6 }}>{t('profile.resume.share.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', marginBottom: 24, lineHeight: 1.6 }}>{t('profile.resume.share.desc')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSharePrompt(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.publishPrompt.skip')}
              </button>
              <button onClick={async () => {
                setShowSharePrompt(false)
                try {
                  const res = await fetch('/api/profile/share-resume', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'set', value: true }) })
                  if (res.ok) {
                    set('is_resume_public', true)
                    setInitialForm(prev => ({ ...prev, is_resume_public: true }))
                    setProfile(prev => ({ ...prev, is_resume_public: true }))
                    setMsg(t('profile.resume.share.on'))
                    setTimeout(() => setMsg(null), 2500)
                  }
                } catch {}
              }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#ff4400', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.publishPrompt.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}


      {pendingNav && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 340, width: '100%', padding: '28px 24px', textAlign: 'center', fontFamily: "'Barlow', system-ui", boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>{t('profile.leave.title')}</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 20, lineHeight: 1.5 }}>{t('profile.leave.desc')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { const nav = pendingNav; setPendingNav(null); setForm({ ...initialForm }); if (nav.type === 'route') router.push(nav.target); else setTab(nav.target) }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: '#111', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.leave.no')}
              </button>
              <button onClick={async () => { const nav = pendingNav; setPendingNav(null); await handleSave(); if (nav.type === 'route') router.push(nav.target); else setTab(nav.target) }}
                style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: '#ff4400', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('profile.leave.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
