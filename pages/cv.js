import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'

/* ──────── IndexedDB utils for pending CV blob ────────
   Stores the chosen file across OAuth redirect so user doesn't re-pick it.
   sessionStorage can't hold blobs reliably (size + serialization). */
const IDB_NAME = 'fyi-cv'
const IDB_STORE = 'pending'
const IDB_KEY = 'cv-blob'

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'))
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbPutCv(file) {
  try {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put({ name: file.name, type: file.type, blob: file }, IDB_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch { /* IDB unavailable — fallback to sessionStorage name hint */ }
}
async function idbGetCv() {
  try {
    const db = await openIdb()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => { db.close(); resolve(req.result || null) }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch { return null }
}
async function idbClearCv() {
  try {
    const db = await openIdb()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(IDB_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); resolve() }
    })
  } catch {}
}

const TESTIMONIALS = [
  { name: 'Nguyễn Văn Tuấn', role: 'Senior Backend Engineer', company: 'FPT Software', img: '/cv/avatars/01.png', text: '이력서만 올렸는데 한 달 후에 정말 맞는 포지션 제안이 왔어요. 면접 두 번에 합격, 축하금까지 받았네요.' },
  { name: 'Trần Thị Mai Anh', role: 'Product Designer', company: 'MoMo', img: '/cv/avatars/02.png', text: '베트남에서 IT 헤드헌터 만나기 쉽지 않은데, FYI가 정말 정확한 회사를 연결해줬어요.' },
  { name: 'Lê Minh Quân', role: 'UX Designer', company: 'VNG', img: '/cv/avatars/03.png', text: '디자인 시스템 잘 갖춰진 회사 찾기 어려웠는데, FYI가 정확히 추천해줬어요.' },
  { name: 'Vũ Ngọc Linh', role: 'Data Engineer', company: 'Sky Mavis', img: '/cv/avatars/04.png', text: '데이터 인프라 잘 갖춰진 회사로 옮기고 싶었는데, FYI 추천으로 한 번에 합격했어요.' },
  { name: 'Trần Văn Khoa', role: 'QA Engineer', company: 'Garena', img: '/cv/avatars/05.png', text: 'QA 자동화 경험 살릴 수 있는 회사 찾기 까다로웠는데, FYI 매칭이 정확했어요. 축하금까지.' },
  { name: 'Phạm Quốc Đạt', role: 'DevOps Engineer', company: 'Tiki', img: '/cv/avatars/06.png', text: 'AWS·K8s 환경 갖춘 회사로 옮기고 싶었어요. 연봉도 30% 올려서 이직했습니다.' },
  { name: 'Đỗ Thị Phương Anh', role: 'Solutions Engineer', company: 'Techcombank IT', img: '/cv/avatars/07.png', text: 'Solutions Engineer 포지션이 흔치 않은데 FYI에서 딱 맞는 곳을 찾아줬어요.' },
  { name: 'Hoàng Đức Anh', role: 'Mobile Developer', company: 'Shopee', img: '/cv/avatars/08.png', text: 'Hồ Chí Minh에서 일 잘하는 회사 찾기 어려웠는데 좋은 매칭이었어요. 축하금도 두 달 후 정확히 들어왔어요.' },
]

function fmtSal(min, max) {
  if (!min && !max) return ''
  const f = (n) => `${Math.round(n / 1_000_000)}M`
  return `${f(min)}–${f(max)} VND`
}

const IconResume = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="13" y2="17"/>
  </svg>
)
const IconSparkle = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
  </svg>
)
const IconGift = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/>
    <rect x="2" y="7" width="20" height="5"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)
const IconQuote = () => (
  <svg width="36" height="28" viewBox="0 0 32 24" fill="none">
    <path d="M0 24V14C0 6.27 4.27 1 12 0L13 3C8.6 4.13 6 7.07 6 11h6v13H0zm18 0V14C18 6.27 22.27 1 30 0l1 3c-4.4 1.13-7 4.07-7 8h6v13H18z" fill="#ff6000" opacity="0.22"/>
  </svg>
)
const IconVerified = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff6000">
    <path d="M12 1l3.09 2.36L18.9 3l1.36 3.81L24 9.18l-1.46 3.92L23.27 17l-3.81 1.18L18.18 22 14 20.45 12 23l-2-2.55L5.82 22 4.54 18.18.73 17l.73-3.9L0 9.18l3.74-2.37L5.1 3l3.81.36z"/>
    <path d="M9.5 14.5l-2-2L9 11l1.5 1.5L15 8l1.5 1.5z" fill="#fff"/>
  </svg>
)
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
)
const IconCoin = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Drop shadow */}
    <ellipse cx="32" cy="56" rx="20" ry="3" fill="rgba(0,0,0,0.35)"/>
    {/* Coin rim */}
    <circle cx="32" cy="30" r="22" fill="#ff8a40" stroke="#1a1612" strokeWidth="2.5"/>
    {/* Coin inner ring */}
    <circle cx="32" cy="30" r="17" fill="#ff6000" stroke="#1a1612" strokeWidth="1.5"/>
    {/* ₫ symbol (Vietnamese dong) */}
    <text x="32" y="39" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff7ee" style={{ fontFamily: 'Barlow, sans-serif' }}>₫</text>
    {/* Sparkle accents */}
    <path d="M52 14 L53 17 L56 18 L53 19 L52 22 L51 19 L48 18 L51 17 Z" fill="#ffd1a0"/>
    <path d="M10 18 L10.7 20 L13 20.5 L10.7 21 L10 23 L9.3 21 L7 20.5 L9.3 20 Z" fill="#ffd1a0"/>
  </svg>
)
const IconLinkedIn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2" style={{ marginRight: 8 }}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
)

export default function CvLanding() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const [pendingHint, setPendingHint] = useState('')
  const [jobs, setJobs] = useState([])
  const fileRef = useRef(null)
  const formAnchorRef = useRef(null)
  /* When user clicks a sign-in CTA without a file, we open the file picker
     and remember which OAuth to kick off after a file is chosen. */
  const oauthAfterPick = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    ;['utm_source', 'utm_medium', 'utm_campaign'].forEach(k => {
      const v = p.get(k)
      if (v) sessionStorage.setItem(k, v)
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Resume after OAuth: retrieve blob from IndexedDB and auto-upload.
  useEffect(() => {
    if (!user) return
    if (router.query.continue !== '1') return
    let cancelled = false
    ;(async () => {
      const stored = await idbGetCv()
      if (cancelled) return
      if (stored?.blob) {
        const f = new File([stored.blob], stored.name, { type: stored.type })
        setFile(f)
        formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // small delay so the user sees the form briefly before auto-upload
        setTimeout(() => doUpload(f), 400)
        return
      }
      // Fallback: filename hint (IndexedDB unavailable / cleared)
      const hint = sessionStorage.getItem('cv_pending_filename')
      if (hint) {
        setPendingHint(hint)
        sessionStorage.removeItem('cv_pending_filename')
        setTimeout(() => {
          formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          fileRef.current?.click()
        }, 300)
      }
    })()
    return () => { cancelled = true }
  }, [user, router.query])

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(arr => {
        const list = Array.isArray(arr) ? arr : (arr.jobs || [])
        const seen = new Set()
        const sorted = list
          .filter(j => j.is_active !== false)
          .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
          .filter(j => { if (seen.has(j.company)) return false; seen.add(j.company); return true })
          .slice(0, 6)
        setJobs(sorted)
      })
      .catch(() => {})
  }, [])

  const handleFile = (f) => {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { setErrMsg('파일이 너무 큽니다 (최대 10MB)'); return }
    setFile(f)
    setErrMsg('')
    idbPutCv(f).catch(() => {
      try { sessionStorage.setItem('cv_pending_filename', f.name) } catch {}
    })
    // If the file picker was opened via a sign-in CTA, auto-progress to OAuth
    const pending = oauthAfterPick.current
    if (pending && !user) {
      oauthAfterPick.current = null
      setTimeout(() => {
        localStorage.setItem('fyi_login_return', '/cv?continue=1')
        localStorage.setItem('fyi_intent', 'cv_signup')
        if (pending === 'linkedin') {
          supabase.auth.signInWithOAuth({
            provider: 'linkedin_oidc',
            options: { redirectTo: window.location.origin + '/auth/callback', scopes: 'openid profile email' },
          })
        } else {
          window.location.href = '/api/auth/google?return=' + encodeURIComponent('/cv?continue=1')
        }
      }, 150)
    }
  }

  const doUpload = async (fileToUpload) => {
    if (!fileToUpload) return
    setStatus('uploading')
    setErrMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('로그인이 필요해요. 다시 시도해주세요.')
      const fd = new FormData()
      fd.append('type', 'resume')
      fd.append('file', fileToUpload)
      const r = await fetch('/api/profile/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Upload failed')
      }
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (uid) {
        await supabase.from('user_profiles').update({ hr_visible: true, job_signal: 'open' }).eq('id', uid)
      }
      if (typeof gtag === 'function') gtag('event', 'cv_register', { source: 'ad-landing' })
      if (typeof fbq === 'function') fbq('trackCustom', 'CVRegister', { source: 'ad-landing' })
      await idbClearCv()
      setStatus('success')
    } catch (e) {
      setErrMsg(e.message || '오류가 발생했어요. 다시 시도해주세요.')
      setStatus('error')
    }
  }

  const onSubmit = async () => {
    if (!file) {
      // remember CTA intent so handleFile auto-progresses to OAuth after pick
      oauthAfterPick.current = 'google'
      fileRef.current?.click()
      return
    }
    if (!user) {
      localStorage.setItem('fyi_login_return', '/cv?continue=1')
      localStorage.setItem('fyi_intent', 'cv_signup')
      window.location.href = '/api/auth/google?return=' + encodeURIComponent('/cv?continue=1')
      return
    }
    await doUpload(file)
  }

  const onLinkedInSubmit = async () => {
    if (!file) {
      oauthAfterPick.current = 'linkedin'
      fileRef.current?.click()
      return
    }
    if (user) { await doUpload(file); return }
    localStorage.setItem('fyi_login_return', '/cv?continue=1')
    localStorage.setItem('fyi_intent', 'cv_signup')
    await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
        scopes: 'openid profile email',
      }
    })
  }

  const scrollToForm = () => formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <Head>
        <title>이력서만 등록하세요 — 합격 시 2,000,000 VND | FYI</title>
        <meta name="description" content="FYI에서 이력서 등록하고 이직, 취업하면 합격 축하금 2,000,000 VND를 드려요." />
      </Head>

      <GlobalNav />

      <main className="cv-page">
        {/* ───── HERO (center-aligned, black bg, white text) ───── */}
        <section className="cv-hero">
          <div className="cv-hero-bg" aria-hidden />
          <div className="cv-hero-inner">
            <h1 className="cv-h1">
              <span className="cv-h1-line cv-h1-soft">
                <img src="/fyi-logo.png" alt="FYI" className="cv-h1-logo" />
                <span>통해 이직, 취업하면</span>
              </span>
              <span className="cv-h1-line cv-h1-hero"><em>2,000,000 VND</em> 드려요</span>
            </h1>
            <div className="cv-banknote-showcase" aria-hidden>
              <img src="/cv/banknote-prize-v1.png" alt="" className="cv-banknote-img" />
            </div>
          </div>
        </section>

        {/* ───── HOW IT WORKS ───── */}
        <section className="cv-how">
          <div className="cv-section-inner">
            <h2 className="cv-h2">이력서만 등록하면 끝.</h2>

            <div className="cv-steps">
              <div className="cv-step cv-step-upload">
                <div className="cv-step-art" aria-hidden>
                  <div className="cv-person scene-upload">
                    <div className="cv-person-head" />
                    <div className="cv-person-body" />
                    <div className="cv-person-arm arm-left" />
                    <div className="cv-person-arm arm-right" />
                  </div>
                  <div className="cv-scene-doc"><span /><span /><span /></div>
                  <div className="cv-scene-tray" />
                </div>
                <div className="cv-step-num">01</div>
                <div className="cv-step-title">FYI에 이력서 등록</div>
                <div className="cv-step-desc">PDF 한 장이면 충분해요.<br/>1분 안에 끝납니다.</div>
              </div>

              <div className="cv-step cv-step-match">
                <div className="cv-step-art" aria-hidden>
                  <div className="cv-person scene-match">
                    <div className="cv-person-head" />
                    <div className="cv-person-body" />
                    <div className="cv-person-arm arm-left" />
                    <div className="cv-person-arm arm-right" />
                  </div>
                  <div className="cv-scene-offer">
                    <span />
                    <span />
                    <b />
                  </div>
                  <div className="cv-scene-bubble">✓</div>
                </div>
                <div className="cv-step-num">02</div>
                <div className="cv-step-title">맞는 포지션 제안</div>
                <div className="cv-step-desc">당신의 경력에 딱 맞는 회사·포지션을<br/>FYI가 직접 제안합니다.</div>
              </div>

              <div className="cv-step cv-step-prize">
                <div className="cv-step-art" aria-hidden>
                  <div className="cv-person scene-prize">
                    <div className="cv-person-head" />
                    <div className="cv-person-body" />
                    <div className="cv-person-arm arm-left" />
                    <div className="cv-person-arm arm-right" />
                  </div>
                  <div className="cv-scene-ticket"><span>2M</span><b>VND</b></div>
                  <div className="cv-scene-coin c1">₫</div>
                  <div className="cv-scene-coin c2">₫</div>
                </div>
                <div className="cv-step-num">03</div>
                <div className="cv-step-title">합격 시 <em>2,000,000 VND</em></div>
                <div className="cv-step-desc">FYI를 통해 받은 오퍼로 입사하면<br/>축하금을 드려요.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── FORM ───── */}
        <section className="cv-form-section" id="cv-form" ref={formAnchorRef}>
          <div className="cv-section-inner cv-form-wrap">
            <div className="cv-form-side">
              <h2 className="cv-h2">이력서 한 장으로<br/>모든 게 시작돼요.</h2>
              <ul className="cv-bullets">
                <li>
                  <span className="cv-bullet-check"><IconCheck /></span>
                  <div>
                    <div className="cv-bullet-title">회원가입은 간단히</div>
                    <div className="cv-bullet-desc">구글 계정으로 바로 시작해요</div>
                  </div>
                </li>
                <li>
                  <span className="cv-bullet-check"><IconCheck /></span>
                  <div>
                    <div className="cv-bullet-title">이력서에 딱 맞는 포지션 제안</div>
                    <div className="cv-bullet-desc">FYI가 직접 매칭해 알려드려요</div>
                  </div>
                </li>
                <li>
                  <span className="cv-bullet-check"><IconCheck /></span>
                  <div>
                    <div className="cv-bullet-title">검증된 기업 담당자가 직접 열람</div>
                    <div className="cv-bullet-desc">신원이 확인된 채용 담당자만 볼 수 있어요</div>
                  </div>
                </li>
              </ul>
            </div>

            {status === 'success' ? (
              <div className="cv-card">
                <div className="cv-check-circle">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="cv-card-step-pill">완료</div>
                <h3 className="cv-card-h">감사합니다.<br/><em>곧 연락드릴게요.</em></h3>
                <p className="cv-card-sub">당신의 이력서에 딱 맞는 포지션이 생기면, 이메일로 알려드릴게요.</p>
                <div className="cv-reward">
                  <div className="cv-reward-meta">
                    <div className="cv-reward-title">합격 축하금 2,000,000 VND</div>
                    <div className="cv-reward-sub">*수습 2개월 통과 시 지급</div>
                  </div>
                </div>
                <a href="/jobs" className="cv-btn">채용 공고 보러가기 <IconArrowRight /></a>
              </div>
            ) : status === 'uploading' && router.query.continue === '1' ? (
              <div className="cv-card cv-interstitial">
                <div className="cv-spinner" />
                <div className="cv-card-step-pill">등록 중</div>
                <h3 className="cv-card-h">잠시만요...<br/><em>이력서를 등록하고 있어요.</em></h3>
                <p className="cv-card-sub">Google 계정으로 가입과 이력서 등록을 처리 중입니다. 5초도 안 걸려요.</p>
                {file && (
                  <div className="cv-file">
                    <div className="cv-file-info">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div className="cv-file-meta">
                        <div className="cv-file-name">{file.name}</div>
                        <div className="cv-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB · 업로드 중</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="cv-card">
                <h3 className="cv-card-h">이력서 <em>업로드</em></h3>
                <p className="cv-card-sub">아래 두 단계만 따라하시면 끝나요.</p>

                {pendingHint && (
                  <div className="cv-ai-bubble">
                    <div className="cv-ai-bubble-inner">
                      <span className="cv-ai-bubble-icon"><IconCheck /></span>
                      <span>로그인 완료. <b>{pendingHint}</b> 파일을 다시 선택해주세요.</span>
                    </div>
                  </div>
                )}

                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf" hidden onChange={(e) => handleFile(e.target.files?.[0])} />

                {/* ─── STEP 1: 이력서 첨부 ─── */}
                <div className={`cv-stepblock ${file ? 'done' : ''}`}>
                  <div className="cv-stepblock-label">
                    <span className="cv-stepblock-num">{file ? <IconCheck /> : '1'}</span>
                    STEP 1 · 이력서 첨부
                  </div>
                  {file ? (
                    <div className="cv-file">
                      <div className="cv-file-info">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div className="cv-file-meta">
                          <div className="cv-file-name">{file.name}</div>
                          <div className="cv-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                      </div>
                      <button type="button" className="cv-change" onClick={() => fileRef.current?.click()} disabled={status === 'uploading'}>다른 파일</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="cv-drop"
                      disabled={status === 'uploading'}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag') }}
                      onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('drag')
                        const f = e.dataTransfer.files?.[0]
                        if (f) handleFile(f)
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>이력서를 드래그하거나 선택하세요</span>
                    </button>
                  )}
                  <div className="cv-hint">PDF / DOCX · 최대 10MB</div>
                </div>

                {/* ─── STEP 2: 회원가입 + 등록 ─── */}
                <div className={`cv-stepblock ${!file ? 'inactive' : ''}`}>
                  <div className="cv-stepblock-label">
                    <span className="cv-stepblock-num">2</span>
                    STEP 2 · 회원가입
                  </div>

                  {errMsg && <div className="cv-err">{errMsg}</div>}

                  <button className="cv-btn" onClick={onSubmit} disabled={status === 'uploading'}>
                    {status === 'uploading' ? '업로드 중...' :
                      user && file ? <>이력서 등록 <IconArrowRight /></> :
                      <><IconGoogle />Google 계정으로 시작 <IconArrowRight /></>}
                  </button>

                  {!user && (
                    <>
                      <div className="cv-or-divider"><span>또는</span></div>
                      <button className="cv-btn-linkedin" onClick={onLinkedInSubmit}>
                        <IconLinkedIn />LinkedIn으로 시작
                      </button>
                    </>
                  )}
                </div>

                {/* ─── Reassurance footer (Step 3 아님 — action 없는 promise) ─── */}
                <div className="cv-promise">
                  <span className="cv-promise-check"><IconCheck /></span>
                  <div>
                    위 두 단계만 완료하시면
                    <br/>
                    <b>가입과 이력서 등록이 한 번에</b> 자동 처리돼요.
                  </div>
                </div>

                <div className="cv-fine">
                  등록 시 인증된 채용 담당자가 FYI 인재풀에서 당신의 이력서를 열람할 수 있어요.
                  <br/>
                  <a href="/terms">이용약관</a> · <a href="/privacy">개인정보처리방침</a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ───── JOBS (rail) — moved above testimonials ───── */}
        {jobs.length > 0 && (
          <section className="cv-jobs">
            <div className="cv-section-inner">
              <div className="cv-section-kicker"><span className="kdot" />지금 적극 채용 중</div>
              <h2 className="cv-h2">이런 회사들이 인재를 찾고 있어요.</h2>
              <p className="cv-h2-sub">이력서만 등록해두면 이 중 맞는 포지션을 제안해드려요.</p>
            </div>
            <div className="cv-jobs-rail-wrap">
              <div className="cv-jobs-rail">
                {[...jobs, ...jobs].map((j, i) => (
                  <a key={`${j.id}-${i}`} href={`/jobs/${j.id}`} className="cv-job">
                    <div className="cv-job-accent" aria-hidden />
                    {j.logo_url ? (
                      <img src={j.logo_url} alt={j.company} className="cv-job-logo" />
                    ) : (
                      <div className="cv-job-logo cv-job-logo-fallback">{(j.company || '').slice(0, 2).toUpperCase()}</div>
                    )}
                    <div className="cv-job-meta">
                      <div className="cv-job-co">{j.company}</div>
                      <div className="cv-job-title">{j.title}</div>
                      <div className="cv-job-tags">
                        {j.location && <span className="cv-job-tag">{j.location}</span>}
                        {(j.salary_min || j.salary_max) && <span className="cv-job-tag cv-job-tag-sal tabular-nums">{fmtSal(j.salary_min, j.salary_max)}</span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ───── TESTIMONIALS ───── */}
        <section className="cv-test">
          <div className="cv-section-inner">
            <div className="cv-section-kicker"><span className="kdot" />합격 축하금 받은 분들</div>
            <h2 className="cv-h2">실제로 받은 분들의 이야기.</h2>
            <p className="cv-h2-sub">FYI 매칭으로 합격하고 축하금까지 받은 베트남 IT 인재들.</p>
          </div>

          <div className="cv-test-rail-wrap">
            <div className="cv-test-rail">
              {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                <div key={i} className="cv-test-card">
                  <div className="cv-test-quote-mark"><IconQuote /></div>
                  <div className="cv-test-quote">{t.text}</div>
                  <div className="cv-test-footer">
                    <img src={t.img} alt={t.name} className="cv-test-avatar-img" />
                    <div className="cv-test-author">
                      <div className="cv-test-name">
                        {t.name}
                        <span className="cv-test-verified" title="FYI 매칭으로 합격"><IconVerified /></span>
                      </div>
                      <div className="cv-test-role">{t.role} · <span className="cv-test-co">{t.company}</span></div>
                    </div>
                  </div>
                  <div className="cv-test-badge">FYI 매칭 · 2,000,000 VND 수령</div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <div className="cv-sticky">
        <button className="cv-btn cv-btn-sticky" onClick={scrollToForm}>1분만에 이력서 등록 <IconArrowRight /></button>
      </div>

      <style jsx global>{`
        .tabular-nums { font-variant-numeric: tabular-nums lining-nums; }
      `}</style>

      <style jsx>{`
        /* ───────────────────────────────────────
           Design tokens — warm cream system
           Base: linen #faf6f0, Cards: white, Ink: #1a1612
           Brand: #ff6000, Accent muted: #efe7d6
           ─────────────────────────────────────── */
        .cv-page {
          background: #faf6f0;
          color: #1a1612;
          padding-bottom: 80px;
        }
        .kdot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ff6000;
          box-shadow: 0 0 8px rgba(255,96,0,0.5);
          animation: cvGlow 2s ease-in-out infinite;
        }
        @keyframes cvGlow {
          0%,100% { box-shadow: 0 0 6px rgba(255,96,0,0.4); }
          50% { box-shadow: 0 0 16px rgba(255,96,0,0.8); }
        }

        /* ───── Hero ─────
           Full dark hero. Prize image floats on dark with strong warm glow.
           Page rhythm: Hero (dark) → How (cream) → ... → Final (dark) closer. */
        .cv-hero {
          position: relative;
          padding: 116px 40px 104px;
          overflow: hidden;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(780px circle at 50% 39%, rgba(255,96,0,0.14), transparent 58%),
            radial-gradient(860px circle at 50% 68%, rgba(0,0,0,0.98), transparent 68%),
            #000;
        }
        .cv-hero-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: radial-gradient(ellipse 70% 65% at center, #000 30%, transparent 90%);
          pointer-events: none;
        }
        .cv-hero-inner {
          position: relative;
          max-width: 1480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .cv-hero-picto {
          margin-bottom: 22px;
          filter: drop-shadow(0 14px 32px rgba(255,96,0,0.45));
          animation: cvPrizeFloat 6s ease-in-out infinite;
        }
        .cv-kicker {
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          color: #ff6000;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          margin-bottom: 26px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
        }
        /* Hero kicker — orange, centered */
        .cv-hero .cv-kicker { color: #ff8a40; justify-content: center; }
        .cv-h1 {
          font-size: clamp(38px, 5vw, 78px);
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -2.4px;
          color: #ffffff;
          margin-bottom: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: center;
        }
        .cv-h1-line {
          display: block;
          white-space: nowrap;
        }
        /* 위 한 줄: 작게 + 적당한 weight (frame role, breathable) */
        .cv-h1-soft {
          font-size: 0.42em;
          font-weight: 600;
          letter-spacing: -0.8px;
          color: #ffffff;
          margin-bottom: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .cv-h1-logo {
          width: auto;
          height: 1.72em;
          object-fit: contain;
          transform: translateY(0.02em);
          filter: drop-shadow(0 5px 14px rgba(0,0,0,0.42));
        }
        /* 마지막 줄: visual center (full size + glow), 여백으로 격리 */
        .cv-h1-hero {
          font-weight: 900;
        }
        .cv-h1 em {
          font-style: normal;
          color: #ff8a40;
          font-variant-numeric: tabular-nums;
          text-shadow:
            0 0 28px rgba(255,138,64,0.5),
            0 0 56px rgba(255,96,0,0.3);
          white-space: nowrap;
          font-size: 1.08em;
          letter-spacing: -2.8px;
        }
        .cv-banknote-showcase {
          position: relative;
          width: min(820px, 100%);
          height: 310px;
          margin: 104px auto 0;
          pointer-events: none;
          isolation: isolate;
        }
        .cv-banknote-showcase::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 28px;
          width: 680px;
          height: 190px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.98), transparent 72%);
          filter: blur(22px);
          z-index: -2;
        }
        .cv-banknote-showcase::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 32px;
          width: 510px;
          height: 58px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.58), transparent 70%);
          filter: blur(14px);
          z-index: -1;
        }
        .cv-banknote-img {
          position: absolute;
          left: 50%;
          bottom: 58px;
          width: min(620px, 100%);
          height: auto;
          transform: translateX(-50%);
          mix-blend-mode: lighten;
          -webkit-mask-image: radial-gradient(ellipse 66% 58% at 50% 52%, #000 56%, rgba(0,0,0,0.58) 68%, transparent 82%);
          mask-image: radial-gradient(ellipse 66% 58% at 50% 52%, #000 56%, rgba(0,0,0,0.58) 68%, transparent 82%);
          filter:
            sepia(0.06)
            saturate(0.96)
            contrast(1.1)
            brightness(1.03)
            drop-shadow(0 38px 64px rgba(0,0,0,0.52))
            drop-shadow(0 0 28px rgba(0,0,0,0.72));
        }
        .cv-hero-sub {
          font-size: 17.5px;
          color: rgba(250,246,240,0.65);
          line-height: 1.65;
          margin-bottom: 38px;
          max-width: 500px;
          font-weight: 400;
        }
        .cv-hero-cta-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .cv-hero-fine {
          font-size: 12.5px;
          color: rgba(250,246,240,0.42);
          line-height: 1.5;
        }
        .cv-btn-hero {
          display: inline-flex;
          align-items: center;
          width: auto;
          margin-top: 0;
          padding: 19px 34px;
          font-size: 15.5px;
          /* Stronger glow on dark bg */
          box-shadow:
            0 0 0 1px rgba(255,138,64,0.4),
            0 12px 28px rgba(255,96,0,0.45),
            0 0 40px rgba(255,96,0,0.25);
        }
        .cv-btn-hero:hover {
          box-shadow:
            0 0 0 1px rgba(255,138,64,0.55),
            0 16px 36px rgba(255,96,0,0.55),
            0 0 60px rgba(255,96,0,0.35);
        }
        .cv-trust-line {
          display: flex;
          align-items: center;
          gap: 26px;
          padding-top: 32px;
          border-top: 1px solid rgba(250,246,240,0.12);
          flex-wrap: wrap;
        }
        .cv-trust-item { display: flex; flex-direction: column; gap: 3px; }
        .cv-trust-num {
          font-family: 'Barlow', sans-serif;
          font-size: 19px;
          font-weight: 800;
          color: #faf6f0;
          letter-spacing: -0.5px;
          font-variant-numeric: tabular-nums;
        }
        .cv-trust-label { font-size: 11.5px; color: rgba(250,246,240,0.48); letter-spacing: 0.5px; }
        .cv-trust-divider { width: 1px; height: 26px; background: rgba(250,246,240,0.16); }

        /* Prize image */
        .cv-prize {
          position: relative;
          width: 100%;
          min-height: 460px;
          display: flex;
          align-items: center;
          justify-content: center;
          /* lift to balance against shorter carry copy */
          transform: translateY(-60px);
        }
        .cv-prize-img {
          width: 100%;
          max-width: 540px;
          height: auto;
          object-fit: contain;
          filter:
            drop-shadow(0 30px 60px rgba(255,96,0,0.45))
            drop-shadow(0 0 40px rgba(255,96,0,0.25));
          animation: cvPrizeFloat 6s ease-in-out infinite;
        }
        @keyframes cvPrizeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        /* ───── Section common ───── */
        .cv-section-inner {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 40px;
        }
        .cv-section-kicker {
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          color: #ff6000;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
        }
        .cv-h2 {
          font-size: clamp(28px, 3.2vw, 44px);
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -1.4px;
          color: #1a1612;
          margin-bottom: 14px;
        }
        .cv-h2 em { font-style: normal; color: #ff6000; font-variant-numeric: tabular-nums; }
        .cv-h2-sub {
          font-size: 16px;
          color: rgba(26,22,18,0.55);
          line-height: 1.65;
          margin-bottom: 48px;
        }

        /* ───── How it works ───── */
        .cv-how {
          padding: 110px 0;
          background: #fbf8f3;
          border-top: 1px solid rgba(26,22,18,0.06);
          border-bottom: 1px solid rgba(26,22,18,0.06);
        }
        .cv-how .cv-section-kicker {
          justify-content: center;
        }
        .cv-how .cv-h2,
        .cv-how .cv-h2-sub {
          text-align: center;
        }
        .cv-steps {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 680px);
          gap: 18px;
          align-items: start;
          margin-top: 58px;
          margin-left: auto;
          margin-right: auto;
          justify-content: center;
        }
        .cv-step {
          position: relative;
          display: grid;
          grid-template-columns: 170px 1fr;
          column-gap: 24px;
          align-items: center;
          background: #fff;
          border: 1px solid rgba(26,22,18,0.07);
          border-radius: 22px;
          padding: 18px 24px 18px 18px;
          min-height: 188px;
          overflow: hidden;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
          box-shadow: 0 1px 2px rgba(26,22,18,0.04), 0 8px 32px -8px rgba(26,22,18,0.06);
        }
        .cv-step::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(260px circle at 50% 22%, rgba(255,96,0,0.08), transparent 62%),
            linear-gradient(180deg, rgba(255,250,245,0.92), rgba(255,255,255,0));
          pointer-events: none;
        }
        .cv-step:hover {
          transform: translateY(-5px);
          border-color: rgba(255,96,0,0.25);
          box-shadow: 0 1px 2px rgba(26,22,18,0.04), 0 20px 50px -10px rgba(255,96,0,0.15);
        }
        .cv-step-prize {
          background: linear-gradient(160deg, #fff8f0 0%, #fff 100%);
          border-color: rgba(255,96,0,0.28);
          box-shadow: 0 1px 2px rgba(26,22,18,0.04), 0 20px 50px -10px rgba(255,96,0,0.18);
        }
        .cv-step-num {
          position: relative;
          z-index: 2;
          grid-column: 2;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 28px;
          border-radius: 999px;
          background: rgba(255,96,0,0.09);
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          font-weight: 800;
          color: #ff6000;
          letter-spacing: 1.2px;
          margin: 0 0 14px;
        }
        .cv-step-title {
          position: relative;
          z-index: 2;
          grid-column: 2;
          font-size: 20px;
          font-weight: 800;
          color: #1a1612;
          letter-spacing: -0.5px;
          margin-bottom: 10px;
          line-height: 1.3;
        }
        .cv-step-title em { font-style: normal; color: #ff6000; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .cv-step-desc {
          position: relative;
          z-index: 2;
          grid-column: 2;
          font-size: 14px;
          color: rgba(26,22,18,0.55);
          line-height: 1.65;
        }
        .cv-step-art {
          position: relative;
          z-index: 2;
          grid-column: 1;
          grid-row: 1 / 4;
          height: 148px;
          margin-bottom: 0;
          border-radius: 18px;
          background:
            radial-gradient(circle at 50% 42%, rgba(255,96,0,0.14), transparent 56%),
            linear-gradient(180deg, #fff7ee 0%, #fff 100%);
          border: 1px solid rgba(255,96,0,0.08);
          overflow: hidden;
        }
        .cv-step-art::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 14px;
          width: 150px;
          height: 26px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(26,22,18,0.16), transparent 70%);
          filter: blur(7px);
        }
        .cv-person {
          position: absolute;
          left: 32px;
          bottom: 20px;
          width: 82px;
          height: 110px;
          z-index: 2;
          animation: cvPersonBreathe 4s ease-in-out infinite;
        }
        .cv-person-head {
          position: absolute;
          left: 25px;
          top: 2px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 38% 36%, rgba(255,255,255,0.65), transparent 18%),
            linear-gradient(135deg, #ffd0a0, #ff9f62);
          box-shadow: 0 10px 18px rgba(26,22,18,0.12);
        }
        .cv-person-head::before,
        .cv-person-head::after {
          content: "";
          position: absolute;
          top: 15px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #1a1612;
          opacity: .78;
        }
        .cv-person-head::before { left: 10px; }
        .cv-person-head::after { right: 10px; }
        .cv-person-body {
          position: absolute;
          left: 16px;
          top: 38px;
          width: 52px;
          height: 62px;
          border-radius: 22px 22px 16px 16px;
          background: linear-gradient(135deg, #1a1612 0%, #3b2b20 48%, #ff6000 100%);
          box-shadow: 0 18px 24px rgba(26,22,18,0.16);
        }
        .cv-person-body::after {
          content: "";
          position: absolute;
          left: 14px;
          bottom: -12px;
          width: 24px;
          height: 18px;
          border-radius: 0 0 12px 12px;
          background: #ff6000;
        }
        .cv-person-arm {
          position: absolute;
          top: 50px;
          width: 14px;
          height: 48px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffd0a0, #ff9f62);
          transform-origin: top center;
        }
        .cv-person-arm.arm-left {
          left: 8px;
          transform: rotate(18deg);
        }
        .cv-person-arm.arm-right {
          right: 6px;
          transform: rotate(-34deg);
          animation: cvWave 2.7s ease-in-out infinite;
        }
        .scene-match {
          left: 42px;
        }
        .scene-match .cv-person-body {
          background: linear-gradient(135deg, #14532d 0%, #0f766e 46%, #ff6000 100%);
        }
        .scene-prize {
          left: 28px;
          bottom: 18px;
          z-index: 3;
        }
        .scene-prize .cv-person-body {
          background: linear-gradient(135deg, #4a2512 0%, #ff6000 52%, #ff9a45 100%);
        }
        .scene-prize .arm-left {
          transform: rotate(-118deg);
          left: 5px;
          top: 46px;
        }
        .scene-prize .arm-right {
          transform: rotate(118deg);
          right: 4px;
          top: 46px;
        }
        .cv-scene-doc {
          position: absolute;
          right: 34px;
          top: 28px;
          width: 72px;
          height: 88px;
          border-radius: 14px;
          background: #fff;
          border: 1px solid rgba(26,22,18,0.08);
          box-shadow: 0 18px 32px rgba(26,22,18,0.13);
          transform: rotate(5deg);
          animation: cvDocHandOff 3.4s ease-in-out infinite;
        }
        .cv-scene-doc::before {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          border-style: solid;
          border-width: 0 20px 20px 0;
          border-color: transparent #ffe1c7 transparent transparent;
        }
        .cv-scene-doc span {
          display: block;
          width: 42px;
          height: 5px;
          margin-left: 15px;
          border-radius: 999px;
          background: rgba(255,96,0,0.22);
        }
        .cv-scene-doc span:first-child { margin-top: 34px; width: 48px; }
        .cv-scene-doc span + span { margin-top: 10px; }
        .cv-scene-tray {
          position: absolute;
          right: 28px;
          bottom: 24px;
          width: 90px;
          height: 14px;
          border-radius: 999px;
          background: rgba(255,96,0,0.18);
        }
        .cv-scene-offer {
          position: absolute;
          right: 28px;
          top: 31px;
          width: 112px;
          height: 86px;
          border-radius: 18px;
          background: #fff;
          border: 1px solid rgba(26,22,18,0.08);
          box-shadow: 0 18px 32px rgba(26,22,18,0.13);
          animation: cvOfferFloat 3.8s ease-in-out infinite;
        }
        .cv-scene-offer span {
          display: block;
          width: 62px;
          height: 7px;
          margin-left: 18px;
          border-radius: 999px;
          background: rgba(26,22,18,0.12);
        }
        .cv-scene-offer span:first-child { margin-top: 23px; width: 76px; background: rgba(255,96,0,0.28); }
        .cv-scene-offer span + span { margin-top: 12px; }
        .cv-scene-offer b {
          position: absolute;
          left: 18px;
          bottom: 14px;
          width: 46px;
          height: 18px;
          border-radius: 999px;
          background: #ff6000;
        }
        .cv-scene-bubble {
          position: absolute;
          right: 18px;
          top: 18px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #16a34a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          box-shadow: 0 12px 22px rgba(22,163,74,0.2);
          animation: cvBubblePop 2.8s ease-in-out infinite;
        }
        .cv-scene-ticket {
          position: absolute;
          right: 10px;
          top: 44px;
          width: 126px;
          height: 62px;
          z-index: 1;
          border-radius: 18px;
          background: linear-gradient(135deg, #fff1df 0%, #ff9a45 42%, #ff6000 100%);
          box-shadow: 0 18px 34px rgba(255,96,0,0.24);
          transform: rotate(-4deg);
          animation: cvTicketFloat 4s ease-in-out infinite;
        }
        .cv-scene-ticket span {
          position: absolute;
          left: 42px;
          top: 14px;
          font-family: 'Barlow', sans-serif;
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -1px;
        }
        .cv-scene-ticket b {
          position: absolute;
          left: 88px;
          top: 26px;
          font-size: 12px;
          color: rgba(255,255,255,0.78);
          letter-spacing: 1px;
        }
        .cv-scene-coin {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffbe7a, #ff6000);
          color: #fff;
          font-family: 'Barlow', sans-serif;
          font-size: 22px;
          font-weight: 900;
          z-index: 4;
          box-shadow: inset 0 0 0 4px rgba(255,255,255,0.2), 0 14px 26px rgba(255,96,0,0.22);
        }
        .cv-scene-coin.c1 { left: 86px; top: 28px; animation: cvCoinBob 3.1s ease-in-out infinite; }
        .cv-scene-coin.c2 { right: 34px; bottom: 20px; width: 34px; height: 34px; font-size: 17px; animation: cvCoinBob 3.1s .5s ease-in-out infinite; }
        @keyframes cvPersonBreathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes cvWave {
          0%, 100% { transform: rotate(-34deg); }
          50% { transform: rotate(-48deg); }
        }
        @keyframes cvDocHandOff {
          0%, 100% { transform: translateY(0) rotate(5deg); }
          50% { transform: translateY(-7px) rotate(2deg); }
        }
        @keyframes cvOfferFloat {
          0%, 100% { transform: translateY(0) rotate(1deg); }
          50% { transform: translateY(-7px) rotate(-1deg); }
        }
        @keyframes cvBubblePop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .cv-art-doc {
          position: absolute;
          left: 50%;
          top: 30px;
          width: 76px;
          height: 92px;
          transform: translateX(-50%);
          border-radius: 14px;
          background: #fff;
          border: 1px solid rgba(26,22,18,0.08);
          box-shadow: 0 18px 36px rgba(26,22,18,0.12);
          animation: cvDocFloat 4.2s ease-in-out infinite;
        }
        .cv-art-doc::before {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          border-style: solid;
          border-width: 0 22px 22px 0;
          border-color: transparent #ffe1c7 transparent transparent;
        }
        .cv-art-doc span {
          display: block;
          width: 42px;
          height: 5px;
          margin-left: 16px;
          border-radius: 999px;
          background: rgba(255,96,0,0.22);
        }
        .cv-art-doc span:first-child { margin-top: 34px; width: 48px; }
        .cv-art-doc span + span { margin-top: 10px; }
        .cv-art-upload-arrow {
          position: absolute;
          left: 50%;
          bottom: 24px;
          width: 22px;
          height: 38px;
          transform: translateX(-50%);
          color: #ff6000;
          animation: cvArrowLift 1.9s ease-in-out infinite;
        }
        .cv-art-upload-arrow::before {
          content: "";
          position: absolute;
          left: 9px;
          top: 9px;
          width: 4px;
          height: 28px;
          border-radius: 999px;
          background: currentColor;
        }
        .cv-art-upload-arrow::after {
          content: "";
          position: absolute;
          left: 4px;
          top: 6px;
          width: 14px;
          height: 14px;
          border-left: 4px solid currentColor;
          border-top: 4px solid currentColor;
          transform: rotate(45deg);
          border-radius: 2px;
        }
        .cv-art-upload-base {
          position: absolute;
          left: 50%;
          bottom: 20px;
          width: 76px;
          height: 12px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: rgba(255,96,0,0.18);
        }
        .cv-art-node {
          position: absolute;
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: #fff;
          border: 1px solid rgba(26,22,18,0.08);
          box-shadow: 0 16px 30px rgba(26,22,18,0.1);
        }
        .cv-art-node::after {
          content: "";
          position: absolute;
          inset: 15px;
          border-radius: 50%;
          background: #ff6000;
        }
        .cv-art-node.n1 { left: 34px; top: 30px; animation: cvNodePulse 3.2s ease-in-out infinite; }
        .cv-art-node.n2 { right: 40px; top: 22px; animation: cvNodePulse 3.2s .35s ease-in-out infinite; }
        .cv-art-node.n3 { left: 84px; bottom: 22px; animation: cvNodePulse 3.2s .7s ease-in-out infinite; }
        .cv-art-line {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, rgba(255,96,0,0), rgba(255,96,0,0.55), rgba(255,96,0,0));
          transform-origin: left center;
        }
        .cv-art-line.l1 { left: 86px; top: 57px; width: 114px; transform: rotate(-6deg); }
        .cv-art-line.l2 { left: 104px; top: 94px; width: 94px; transform: rotate(-28deg); }
        .cv-art-target {
          position: absolute;
          right: 28px;
          bottom: 22px;
          width: 66px;
          height: 66px;
          border-radius: 50%;
          border: 2px solid rgba(255,96,0,0.28);
          animation: cvTargetScan 2.7s ease-in-out infinite;
        }
        .cv-art-target::before,
        .cv-art-target::after {
          content: "";
          position: absolute;
          inset: 14px;
          border-radius: inherit;
          border: 2px solid rgba(255,96,0,0.42);
        }
        .cv-art-target::after {
          inset: 28px;
          background: #ff6000;
          border: 0;
        }
        .cv-art-ticket {
          position: absolute;
          left: 50%;
          top: 42px;
          width: 142px;
          height: 70px;
          transform: translateX(-50%) rotate(-4deg);
          border-radius: 18px;
          background: linear-gradient(135deg, #fff1df 0%, #ff9a45 42%, #ff6000 100%);
          box-shadow: 0 18px 36px rgba(255,96,0,0.24);
          animation: cvTicketFloat 4s ease-in-out infinite;
        }
        .cv-art-ticket::before,
        .cv-art-ticket::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fffaf5;
          transform: translateY(-50%);
        }
        .cv-art-ticket::before { left: -10px; }
        .cv-art-ticket::after { right: -10px; }
        .cv-art-ticket span {
          position: absolute;
          left: 24px;
          top: 17px;
          font-family: 'Barlow', sans-serif;
          font-size: 34px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -1px;
        }
        .cv-art-coin {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffbe7a, #ff6000);
          color: #fff;
          font-family: 'Barlow', sans-serif;
          font-size: 24px;
          font-weight: 900;
          box-shadow: inset 0 0 0 4px rgba(255,255,255,0.2), 0 14px 26px rgba(255,96,0,0.22);
        }
        .cv-art-coin.c1 { left: 42px; bottom: 28px; animation: cvCoinBob 3.1s ease-in-out infinite; }
        .cv-art-coin.c2 { right: 46px; top: 24px; width: 40px; height: 40px; font-size: 20px; animation: cvCoinBob 3.1s .5s ease-in-out infinite; }
        .cv-art-spark {
          position: absolute;
          right: 64px;
          bottom: 42px;
          width: 8px;
          height: 32px;
          border-radius: 999px;
          background: #ff6000;
          box-shadow: 0 0 14px rgba(255,96,0,0.45);
          transform: rotate(42deg);
        }
        .cv-art-spark::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: inherit;
          transform: rotate(90deg);
        }
        @keyframes cvDocFloat {
          0%, 100% { transform: translateX(-50%) translateY(0) rotate(-1deg); }
          50% { transform: translateX(-50%) translateY(-8px) rotate(1deg); }
        }
        @keyframes cvArrowLift {
          0%, 100% { transform: translateX(-50%) translateY(4px); opacity: .55; }
          50% { transform: translateX(-50%) translateY(-6px); opacity: 1; }
        }
        @keyframes cvNodePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes cvTargetScan {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,96,0,0.08); }
          50% { box-shadow: 0 0 0 12px rgba(255,96,0,0.08); }
        }
        @keyframes cvTicketFloat {
          0%, 100% { transform: translateX(-50%) translateY(0) rotate(-4deg); }
          50% { transform: translateX(-50%) translateY(-8px) rotate(-2deg); }
        }
        @keyframes cvCoinBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        /* ───── Form section ───── */
        .cv-form-section {
          padding: 110px 0;
          scroll-margin-top: 80px;
          background: #fff;
        }
        .cv-form-wrap {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }
        .cv-bullets {
          list-style: none;
          padding: 0;
          margin: 16px 0 0;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .cv-bullets li {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .cv-bullet-check {
          width: 30px; height: 30px;
          border-radius: 9px;
          background: #fff5ec;
          color: #ff6000;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(255,96,0,0.2);
        }
        .cv-bullet-title {
          font-size: 15px;
          font-weight: 700;
          color: #1a1612;
          margin-bottom: 3px;
        }
        .cv-bullet-desc {
          font-size: 13px;
          color: rgba(26,22,18,0.5);
          line-height: 1.55;
        }

        /* Form card */
        .cv-card {
          position: relative;
          z-index: 5;             /* sit above any drifting siblings */
          background: #fff;
          border: 1px solid rgba(26,22,18,0.08);
          border-radius: 18px;
          padding: 36px 34px;
          box-shadow:
            0 2px 4px rgba(26,22,18,0.03),
            0 40px 80px -20px rgba(255,96,0,0.18);
        }
        .cv-drop.drag {
          border-color: #ff6000;
          background: #fff3e7;
        }
        .cv-card-step-pill {
          position: absolute;
          top: -12px; left: 32px;
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          background: #ff6000;
          color: #fff;
          padding: 6px 12px;
          border-radius: 7px;
          box-shadow: 0 8px 18px rgba(255,96,0,0.35);
        }
        .cv-card-h {
          font-size: 32px;
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: -1.3px;
          color: #1a1612;
          margin: 10px 0 14px;
        }
        .cv-card-h em { font-style: normal; color: #ff6000; }
        .cv-card-sub {
          font-size: 14.5px;
          color: rgba(26,22,18,0.55);
          line-height: 1.6;
          margin-bottom: 26px;
        }
        .cv-reward {
          display: flex;
          align-items: center;
          gap: 14px;
          background: linear-gradient(135deg, #fff3e7, #fffaf5);
          border: 1px solid rgba(255,96,0,0.22);
          padding: 16px 18px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
        .cv-reward-meta { flex: 1; }
        .cv-reward-title { font-size: 14.5px; font-weight: 800; color: #1a1612; }
        .cv-reward-sub { font-size: 12px; color: rgba(26,22,18,0.55); margin-top: 3px; }
        .cv-ai-bubble {
          background: #ff6000;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 18px;
          box-shadow: 0 8px 22px rgba(255,96,0,0.3);
        }
        .cv-ai-bubble-inner { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #fff; line-height: 1.4; }
        .cv-ai-bubble-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: rgba(255,255,255,0.22); color: #fff; flex-shrink: 0; }
        .cv-drop {
          width: 100%;
          padding: 22px;
          border-radius: 14px;
          border: 2px dashed rgba(255,96,0,0.32);
          background: #fffaf5;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14.5px;
          font-weight: 700;
          color: #ff6000;
          transition: all .15s;
        }
        .cv-drop:hover { border-color: #ff6000; background: #fff3e7; }
        .cv-drop:disabled,
        .cv-drop[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
        /* Anything visible inside .cv-drop (icon, text) must NOT swallow clicks —
           let them pass through to the transparent <input type="file"> on top. */
        .cv-drop > svg,
        .cv-drop > span { pointer-events: none; }
        .cv-file {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f1faf0;
          border: 1px solid #c8e8c2;
          border-radius: 12px;
          padding: 14px 16px;
        }
        .cv-file-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .cv-file-meta { min-width: 0; }
        .cv-file-name { font-size: 13.5px; font-weight: 600; color: #1a1612; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cv-file-size { font-size: 11px; color: rgba(26,22,18,0.45); margin-top: 2px; }
        .cv-change {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12.5px;
          font-weight: 600;
          color: #ff6000;
          background: none;
          border: 1px solid rgba(255,96,0,0.32);
          padding: 7px 14px;
          border-radius: 7px;
          cursor: pointer;
          font-family: inherit;
          user-select: none;
        }
        .cv-change:hover { background: #fff5ec; }
        .cv-change[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
        .cv-hint { font-size: 11.5px; color: rgba(26,22,18,0.4); text-align: center; margin-top: 10px; letter-spacing: 0.2px; }
        .cv-err {
          margin-top: 14px;
          padding: 12px 14px;
          background: #fef2f2;
          border: 1px solid #fbcfcf;
          border-radius: 10px;
          color: #b91c1c;
          font-size: 13px;
        }
        .cv-fine {
          font-size: 11.5px;
          color: rgba(26,22,18,0.45);
          line-height: 1.65;
          margin-top: 18px;
          text-align: center;
        }
        .cv-fine a { color: rgba(26,22,18,0.7); text-decoration: underline; }
        .cv-check-circle {
          width: 60px; height: 60px;
          margin: 0 auto 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6000, #ff8a40);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 14px 32px rgba(255,96,0,0.4);
        }
        /* Interstitial (auto-upload after OAuth return) */
        .cv-interstitial { text-align: left; }
        .cv-spinner {
          width: 48px; height: 48px;
          margin: 0 auto 22px;
          border-radius: 50%;
          border: 4px solid rgba(255,96,0,0.18);
          border-top-color: #ff6000;
          animation: cvSpin 0.8s linear infinite;
        }
        @keyframes cvSpin { to { transform: rotate(360deg); } }
        /* Step block — visual chunking inside form card */
        .cv-stepblock {
          margin-top: 18px;
          padding: 18px 18px 20px;
          background: #fafaf7;
          border: 1px solid rgba(26,22,18,0.07);
          border-radius: 14px;
          transition: border-color .15s ease, background .15s ease, opacity .15s ease;
        }
        .cv-stepblock.done {
          background: rgba(34,197,94,0.04);
          border-color: rgba(34,197,94,0.22);
        }
        .cv-stepblock.inactive {
          opacity: 0.65;
        }
        .cv-stepblock-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          color: rgba(26,22,18,0.55);
          letter-spacing: 1.4px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .cv-stepblock-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #ff6000;
          color: #fff;
          font-family: 'Barlow', sans-serif;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          flex-shrink: 0;
        }
        .cv-stepblock.done .cv-stepblock-num {
          background: #16a34a;
        }
        /* Reassurance footer (promise, not a step) */
        .cv-promise {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 18px;
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(255,96,0,0.07), rgba(255,96,0,0.02));
          border: 1px solid rgba(255,96,0,0.18);
          border-radius: 12px;
          font-size: 13px;
          color: rgba(26,22,18,0.7);
          line-height: 1.55;
        }
        .cv-promise b { color: #1a1612; font-weight: 700; }
        .cv-promise-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #ff6000;
          color: #fff;
          flex-shrink: 0;
          margin-top: 1px;
        }
        /* "or" divider between primary CTA and LinkedIn */
        .cv-or-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 14px 0 10px;
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          color: rgba(26,22,18,0.4);
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .cv-or-divider::before, .cv-or-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(26,22,18,0.10);
        }
        .cv-or-divider span { padding: 0 4px; }
        /* LinkedIn secondary CTA */
        .cv-btn-linkedin {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 13px 18px;
          background: #fff;
          color: #1a1612;
          border: 1px solid rgba(26,22,18,0.14);
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: border-color .15s ease, background .15s ease, transform .08s;
        }
        .cv-btn-linkedin:hover {
          border-color: #0A66C2;
          background: #f5faff;
        }
        .cv-btn-linkedin:active { transform: translateY(1px); }
        /* Reassurance line under CTA */
        .cv-reassurance {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          padding: 12px 14px;
          background: linear-gradient(135deg, rgba(255,96,0,0.06), rgba(255,96,0,0.02));
          border: 1px solid rgba(255,96,0,0.16);
          border-radius: 10px;
          font-size: 12.5px;
          color: rgba(26,22,18,0.65);
          line-height: 1.5;
        }
        .cv-reassurance b { color: #1a1612; font-weight: 700; }
        .cv-reassurance-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ff6000;
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(255,96,0,0.5);
        }

        /* Primary CTA */
        .cv-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          margin-top: 20px;
          padding: 18px 24px;
          background: #ff6000;
          color: #fff;
          border: 0;
          border-radius: 12px;
          font-size: 15.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 10px 24px rgba(255,96,0,0.32);
          text-align: center;
          text-decoration: none;
          transition: background .15s, transform .08s, box-shadow .15s;
        }
        .cv-btn:hover {
          background: #ff7218;
          box-shadow: 0 14px 32px rgba(255,96,0,0.4);
        }
        .cv-btn:active { transform: translateY(1px); }
        .cv-btn:disabled { opacity: 0.5; box-shadow: none; cursor: not-allowed; }

        /* ───── Testimonials ───── */
        .cv-test {
          padding: 110px 0 90px;
          background: linear-gradient(180deg, #fbf8f3 0%, #faf6f0 100%);
          border-top: 1px solid rgba(26,22,18,0.06);
          border-bottom: 1px solid rgba(26,22,18,0.06);
        }
        .cv-test-rail-wrap {
          margin-top: 50px;
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
        }
        .cv-test-rail {
          display: flex;
          gap: 18px;
          animation: cvSlide 60s linear infinite;
          width: fit-content;
        }
        .cv-test-rail:hover { animation-play-state: paused; }
        @keyframes cvSlide {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .cv-test-card {
          flex: 0 0 370px;
          position: relative;
          background: #fff;
          border: 1px solid rgba(26,22,18,0.06);
          border-radius: 20px;
          padding: 30px 28px 22px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 2px 4px rgba(26,22,18,0.03), 0 12px 32px -8px rgba(26,22,18,0.08);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .cv-test-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255,96,0,0.22);
          box-shadow: 0 2px 4px rgba(26,22,18,0.03), 0 24px 50px -10px rgba(255,96,0,0.18);
        }
        .cv-test-quote-mark {
          position: absolute;
          top: 22px; right: 24px;
        }
        .cv-test-quote {
          font-size: 15px;
          color: #1a1612;
          line-height: 1.7;
          font-weight: 500;
          min-height: 100px;
          padding-right: 10px;
        }
        .cv-test-footer {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cv-test-avatar-img {
          width: 54px; height: 54px;
          border-radius: 50%;
          object-fit: cover;
          object-position: top center;
          flex-shrink: 0;
          background: #fbf8f3;
          box-shadow: 0 0 0 2px rgba(255,96,0,0.18), 0 4px 12px rgba(26,22,18,0.08);
        }
        .cv-test-author { flex: 1; min-width: 0; }
        .cv-test-name {
          font-size: 14px;
          font-weight: 800;
          color: #1a1612;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cv-test-verified { display: inline-flex; align-items: center; }
        .cv-test-role { font-size: 12px; color: rgba(26,22,18,0.5); margin-top: 2px; }
        .cv-test-co { color: rgba(26,22,18,0.75); font-weight: 700; }
        .cv-test-badge {
          align-self: flex-start;
          font-family: 'Geist Mono', monospace;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #ff6000;
          background: #fff3e7;
          border: 1px solid rgba(255,96,0,0.25);
          padding: 6px 12px;
          border-radius: 100px;
        }

        /* ───── Jobs (cream section, dark cards for emphasis) ───── */
        .cv-jobs {
          padding: 110px 0 90px;
          background: #fff;
        }
        .cv-jobs-rail-wrap {
          margin-top: 50px;
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
        }
        .cv-jobs-rail {
          display: flex;
          gap: 16px;
          animation: cvSlide 70s linear infinite;
          width: fit-content;
          padding: 0 8px;
        }
        .cv-jobs-rail:hover { animation-play-state: paused; }
        .cv-job {
          flex: 0 0 360px;
          position: relative;
          background: linear-gradient(135deg, #1f1813 0%, #181410 100%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 18px;
          padding: 24px;
          display: flex;
          gap: 16px;
          color: inherit;
          text-decoration: none;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(26,22,18,0.04),
            0 18px 40px -12px rgba(26,22,18,0.20);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .cv-job-accent {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #ff6000, #ff8a40);
          transform: scaleY(0);
          transform-origin: top;
          transition: transform .25s ease;
        }
        .cv-job:hover {
          transform: translateY(-3px);
          border-color: rgba(255,96,0,0.42);
          box-shadow:
            0 1px 2px rgba(26,22,18,0.04),
            0 24px 50px -10px rgba(255,96,0,0.32);
        }
        .cv-job:hover .cv-job-accent { transform: scaleY(1); }
        .cv-job-logo {
          width: 52px; height: 52px;
          border-radius: 12px;
          background: #fff;
          object-fit: contain;
          padding: 6px;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .cv-job-logo-fallback {
          background: rgba(255,96,0,0.12);
          border-color: rgba(255,96,0,0.32);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Barlow', sans-serif;
          font-weight: 800;
          font-size: 15px;
          color: #ff8a40;
        }
        .cv-job-meta { min-width: 0; flex: 1; }
        .cv-job-co {
          font-size: 12.5px;
          color: rgba(250,246,240,0.55);
          font-weight: 600;
          margin-bottom: 5px;
        }
        .cv-job-title {
          font-size: 15px;
          font-weight: 800;
          color: #faf6f0;
          line-height: 1.4;
          margin-bottom: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .cv-job-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .cv-job-tag {
          font-size: 11.5px;
          font-weight: 600;
          color: rgba(250,246,240,0.55);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 4px 10px;
          border-radius: 7px;
        }
        .cv-job-tag-sal {
          color: #ff8a40;
          border-color: rgba(255,96,0,0.35);
          background: rgba(255,96,0,0.12);
        }

        /* ───── Final CTA (dark closer) ───── */
        .cv-final {
          position: relative;
          padding: 130px 40px 120px;
          overflow: hidden;
          background:
            radial-gradient(900px circle at 50% 50%, rgba(255,96,0,0.18), transparent 65%),
            #1a1612;
        }
        .cv-final-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: radial-gradient(ellipse at center, #000 35%, transparent 80%);
          pointer-events: none;
        }
        .cv-kicker-dark { color: #ff8a40; }
        .cv-final-inner {
          position: relative;
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }
        .cv-final-h {
          font-size: clamp(32px, 4.4vw, 56px);
          font-weight: 900;
          letter-spacing: -2px;
          color: #faf6f0;
          margin: 8px 0 18px;
          line-height: 1.15;
        }
        .cv-final-h em { font-style: normal; color: #ff8a40; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .cv-final-sub {
          font-size: 17px;
          color: rgba(250,246,240,0.55);
          margin-bottom: 36px;
        }
        .cv-btn-final {
          width: auto;
          padding: 20px 42px;
          font-size: 16.5px;
          box-shadow: 0 14px 40px rgba(255,96,0,0.45);
        }
        .cv-conds {
          margin-top: 64px;
          padding: 28px 32px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          text-align: left;
          backdrop-filter: blur(4px);
        }
        .cv-conds-title {
          font-family: 'Geist Mono', monospace;
          font-size: 11px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(250,246,240,0.55);
          font-weight: 700;
          margin-bottom: 18px;
        }
        .cv-conds-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 13px;
        }
        .cv-conds-list li {
          font-size: 14px;
          color: rgba(250,246,240,0.78);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          line-height: 1.55;
        }
        .cv-conds-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(255,96,0,0.18);
          color: #ff8a40;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .cv-conds-link {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 12.5px;
          color: rgba(250,246,240,0.5);
        }
        .cv-conds-link a { color: #ff8a40; text-decoration: none; font-weight: 700; }
        .cv-conds-link a:hover { text-decoration: underline; }

        /* ───── Sticky CTA (mobile) ───── */
        .cv-sticky {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
          background: rgba(250,246,240,0.94);
          backdrop-filter: blur(14px);
          border-top: 1px solid rgba(26,22,18,0.08);
          z-index: 90;
        }
        .cv-btn-sticky { margin-top: 0; padding: 16px; box-shadow: 0 -4px 18px rgba(255,96,0,0.22); }

        /* ───── Responsive ───── */
        @media (max-width: 960px) {
          .cv-hero {
            padding: 80px 28px 80px;
            background:
              radial-gradient(700px circle at 50% 32%, rgba(255,96,0,0.13), transparent 56%),
              radial-gradient(700px circle at 50% 70%, rgba(0,0,0,0.98), transparent 68%),
              linear-gradient(180deg, #1f1813 0%, #181410 100%);
          }
          .cv-hero-inner { grid-template-columns: 1fr; gap: 56px; }
          .cv-banknote-showcase {
            width: min(680px, 100%);
            height: 230px;
            margin-top: 62px;
          }
          .cv-banknote-img { width: min(560px, 100%); }
          .cv-prize { min-height: 340px; }
          .cv-steps {
            grid-template-columns: 1fr;
            gap: 18px;
            margin-top: 40px;
          }
          .cv-step,
          .cv-step:nth-child(2),
          .cv-step:nth-child(3) {
            margin-top: 0;
            min-height: auto;
            grid-template-columns: 1fr;
            padding: 18px 18px 22px;
          }
          .cv-step-art,
          .cv-step-num,
          .cv-step-title,
          .cv-step-desc {
            grid-column: 1;
          }
          .cv-step-art {
            grid-row: auto;
            margin-bottom: 18px;
          }
          .cv-step-connector { height: 32px; padding: 0 20px; }
          .cv-step-connector svg { transform: rotate(90deg); width: 28px; height: 100%; }
          .cv-step-connector-dot { right: 50%; top: auto; bottom: -4px; transform: translateX(50%); }
          .cv-form-wrap { grid-template-columns: 1fr; gap: 44px; }
          .cv-jobs-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .cv-hero { padding: 64px 20px 48px; }
          .cv-section-inner { padding: 0 20px; }
          .cv-how, .cv-test, .cv-jobs, .cv-form-section { padding: 80px 0 64px; }
          .cv-final { padding: 90px 20px 120px; }
          .cv-h1 {
            letter-spacing: -1.2px;
            gap: 8px;
          }
          .cv-h1-line { white-space: normal; }
          .cv-h1-soft {
            font-size: 0.46em;
            gap: 5px;
          }
          .cv-h1-logo { height: 1.55em; }
          .cv-h1-hero { margin-top: 18px; }
          .cv-banknote-showcase {
            height: 188px;
            margin-top: 64px;
          }
          .cv-banknote-showcase::before {
            width: 340px;
            height: 82px;
            bottom: 18px;
          }
          .cv-banknote-showcase::after {
            width: 300px;
            bottom: 24px;
          }
          .cv-banknote-img { width: 360px; }
          .cv-h2 { letter-spacing: -0.8px; }
          .cv-test-card { flex-basis: 290px; padding: 26px 22px 20px; }
          .cv-jobs-grid { padding: 0 20px; }
          .cv-sticky { display: block; }
          .cv-btn-hero { width: 100%; }
          .cv-trust-line { gap: 18px; }
          .cv-trust-divider { display: none; }
          .cv-conds { padding: 24px; }
        }
      `}</style>
    </>
  )
}
