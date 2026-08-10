import { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'
import GlobalNav from '../components/GlobalNav'

/* /hongik — 홍익대학교 국제언어교육원 현장 QR 랜딩.
   포스터 QR → 설명 + Google 로그인 → 가입만 해도 '한국어 가능' 현장 인증
   (/api/hongik/verify 가 korean_cert 마커 기록) → TOPIK 급수 원탭 입력(있으면
   "TOPIK n" 정식 포맷으로 승격) → 완료. CV 업로드는 완료 화면의 선택 카드다 —
   어학당 학생은 CV 가 없는 경우가 많아 필수로 걸면 현장 이탈만 는다.
   QR 은 utm 없이 짧은 /hongik 그대로 배포한다 — utm 이 없으면 offline/qr/hongik-kli 로 귀속. */

const CAMPAIGN = 'hongik-kli'

// 신뢰 로고 스트립 — /ktc 페이지(Organization.js)와 같은 에셋을 쓴다.
// SVG 3종은 283x50 박스 공유, K-Tech College 워드마크는 198x28 이라 높이를 달리 준다.
const TRUST_LOGOS = [
  { src: '/ktc/mss.svg', alt: 'Ministry of SMEs and Startups', h: 22 },
  { src: '/ktc/kosme.svg', alt: 'KOSME', h: 22 },
  { src: '/ktc/likelion.svg', alt: 'LIKELION', h: 22 },
  { src: '/ktc/logo.svg', alt: 'K-Tech College', h: 17 },
]

function hkMeta() {
  if (typeof window === 'undefined') return {}
  return {
    utm_source: sessionStorage.getItem('utm_source') || null,
    utm_medium: sessionStorage.getItem('utm_medium') || null,
    utm_campaign: sessionStorage.getItem('utm_campaign') || null,
    lang: localStorage.getItem('fyi_lang') || 'vi',
  }
}
function fileMeta(f) {
  if (!f) return {}
  return { file_ext: (f.name.split('.').pop() || '').toLowerCase(), file_size: f.size }
}
function fmtSal(min, max) {
  if (!min && !max) return ''
  const f = (n) => `${Math.round(n / 1_000_000)}M`
  return `${f(min)}–${f(max)} VND`
}

// Google 공식 4색 G — OAuth 버튼임을 한눈에 알린다
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function HongikPage() {
  const { lang } = useT()
  const router = useRouter()
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)

  const [user, setUser] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [verified, setVerified] = useState(null) // /api/hongik/verify 응답
  const [topikDone, setTopikDone] = useState(false)
  const [topikSaving, setTopikSaving] = useState(null) // 저장 중인 선택값
  const [cvDone, setCvDone] = useState(false)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | submitting (CV 업로드)
  const [errMsg, setErrMsg] = useState('')
  const [jobs, setJobs] = useState([])
  const fileRef = useRef(null)
  const verifyOnce = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      const v = p.get(k)
      if (v) sessionStorage.setItem(k, v)
    })
    // QR 인쇄물은 짧은 주소 그대로 — utm 이 없으면 오프라인 QR 기본값으로 귀속한다
    if (!sessionStorage.getItem('utm_campaign')) {
      sessionStorage.setItem('utm_source', 'offline')
      sessionStorage.setItem('utm_medium', 'qr')
      sessionStorage.setItem('utm_campaign', CAMPAIGN)
    }
    track('hongik_view', { meta: hkMeta(), page: '/hongik' })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setSessionReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  // 로그인 확인 즉시 현장 인증 — 가입만 해도 한국어 가능 마커가 박히는 게 이 랜딩의 핵심
  useEffect(() => {
    if (!user || verifyOnce.current) return
    verifyOnce.current = true
    ;(async () => {
      if (router.query.continue === '1') track('hongik_oauth_return', { meta: hkMeta(), page: '/hongik' })
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const r = await fetch('/api/hongik/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ meta: hkMeta() }),
        })
        const j = await r.json()
        if (r.ok) {
          setVerified(j)
          if (j.hasResume) setCvDone(true)
          // 이미 정식 TOPIK 값이 있는 사람(재방문 포함)에게 급수를 또 묻지 않는다
          if (/^topik/i.test(j.koreanCert || '')) setTopikDone(true)
          track('hongik_verified', { meta: { ...hkMeta(), set: j.koreanCert }, page: '/hongik' })
        } else {
          setVerified({ ok: false })
        }
      } catch {
        setVerified({ ok: false })
      }
    })()
  }, [user, router.query])

  // '이렇게 진행돼요' 타임라인 — 스크롤로 섹션에 들어오면 .in 이 붙고,
  // 번호 점등 → 카드 슬라이드 → 연결선 드로잉이 1→2→3 시퀀스로 이어진다(kcv-steps 패턴).
  useEffect(() => {
    if (user || !sessionReady || typeof window === 'undefined') return
    const el = document.querySelector('.hk-flow')
    if (!el) return
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return }
    // 하단 -38% 마진 = 섹션 상단이 화면 위쪽 62% 안으로 들어와야 발동.
    // 모바일에서 섹션이 첫 화면 하단에 몇 px 걸친 채 로드되면 스크롤도 하기 전에
    // 시퀀스가 다 돌아버려서, 트리거 라인을 화면 중턱까지 끌어올렸다.
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0, rootMargin: '0px 0px -38% 0px' })
    io.observe(el)
    // 안전망: 트리거를 영영 못 받는 환경에서도 카드가 opacity 0 으로 숨은 채 남지 않게
    const t = setTimeout(() => el.classList.add('in'), 6000)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [user, sessionReady])

  // 완료 화면 이탈 방지용 공고 (기업 직접등록 우선 → 지원 많은 순, 회사당 1개)
  useEffect(() => {
    if (!topikDone) return
    fetch('/api/jobs?counts=1')
      .then(r => r.json())
      .then(arr => {
        const list = Array.isArray(arr) ? arr : (arr.jobs || [])
        setJobs(list.filter(j => j.is_active !== false))
      })
      .catch(() => {})
  }, [topikDone])

  const topJobs = useMemo(() => {
    const seen = new Set()
    return jobs
      .slice()
      .sort((a, b) => (a.source === 'company_self' ? 0 : 1) - (b.source === 'company_self' ? 0 : 1)
        || (b.application_count || 0) - (a.application_count || 0))
      .filter(j => { if (seen.has(j.company)) return false; seen.add(j.company); return true })
      .slice(0, 3)
  }, [jobs])

  const startLogin = async () => {
    localStorage.setItem('fyi_login_return', '/hongik?continue=1')
    localStorage.setItem('fyi_intent', 'hongik_signup')
    await track('hongik_oauth_start', { meta: { ...hkMeta(), provider: 'google' }, page: '/hongik' })
    if (window.location.hostname === 'localhost') {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
    } else {
      window.location.href = '/api/auth/google?return=' + encodeURIComponent('/hongik?continue=1')
    }
  }

  // TOPIK 원탭 저장 — 서버가 events(hongik_topik)에 남기므로 클라이언트 track 은 안 쏜다(이중집계 방지).
  // 네트워크가 실패해도 완료 화면으로 보낸다 — 현장에서 학생을 에러로 세워두지 않는다.
  const saveTopik = async (val) => {
    if (topikSaving) return
    setTopikSaving(val)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/hongik/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topik: val, meta: hkMeta() }),
      })
    } catch {}
    setTopikSaving(null)
    setTopikDone(true)
  }

  const handleFile = (f) => {
    if (!f) return
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      setErrMsg(L('PDF 또는 Word 파일만 올릴 수 있어요.', 'Only PDF or Word files are supported.', 'Chỉ hỗ trợ file PDF hoặc Word.'))
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg(L('파일이 너무 커요 (최대 10MB).', 'File too big (max 10MB).', 'File quá lớn (tối đa 10MB).'))
      return
    }
    setErrMsg('')
    setFile(f)
    track('hongik_attach_file', { meta: { ...hkMeta(), ...fileMeta(f) }, page: '/hongik' })
  }

  const submitCv = async () => {
    if (!file || status === 'submitting') return
    setStatus('submitting')
    setErrMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error(L('로그인이 필요해요.', 'Please sign in.', 'Vui lòng đăng nhập.'))
      const fd = new FormData()
      fd.append('type', 'resume')
      fd.append('file', file)
      const r = await fetch('/api/profile/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Resume-Source': 'hongik' },
        body: fd,
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Upload failed')
      }
      const uid = session.user?.id
      if (uid) await supabase.from('user_profiles').update({ hr_visible: true, job_signal: 'open' }).eq('id', uid)
      fetch('/api/profile/share-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set', value: true }),
      }).catch(() => {})
      if (typeof gtag === 'function') gtag('event', 'hongik_cv_success', { source: 'hongik' })
      if (typeof fbq === 'function') fbq('trackCustom', 'HongikCvRegister', { source: 'hongik' })
      track('hongik_cv_success', { meta: { ...hkMeta(), ...fileMeta(file) }, page: '/hongik' })
      setStatus('idle')
      setCvDone(true)
    } catch (e) {
      track('hongik_cv_error', { meta: { ...hkMeta(), error_message: e.message }, page: '/hongik' })
      setErrMsg(e.message || L('등록에 실패했어요. 다시 시도해주세요.', 'Upload failed. Please try again.', 'Đăng ký thất bại. Vui lòng thử lại.'))
      setStatus('idle')
    }
  }

  const steps = [
    {
      n: '1',
      t: L('Google 로그인', 'Sign in with Google', 'Đăng nhập Google'),
      time: L('30초', '30s', '30 giây'),
      s: L('이 페이지로 가입하면 \'한국어 가능 인재\'로 자동 인증돼요. 시험도, 서류도 필요 없어요.',
        "Sign up through this page and you're automatically verified as a Korean-speaking candidate. No test, no documents.",
        'Đăng ký qua trang này, bạn được tự động xác nhận là ứng viên biết tiếng Hàn. Không cần thi, không cần giấy tờ.'),
    },
    {
      n: '2',
      t: L('TOPIK 급수 선택', 'Pick your TOPIK level', 'Chọn cấp TOPIK'),
      time: L('10초', '10s', '10 giây'),
      s: L('급수가 있으면 탭 한 번으로 프로필에 반영돼요. 아직 없어도 괜찮아요 — 인증은 그대로예요.',
        "If you have a TOPIK level, one tap adds it to your profile. Don't have one yet? No problem — you stay verified.",
        'Nếu có TOPIK, chỉ một chạm là được lưu vào hồ sơ. Chưa có cũng không sao — bạn vẫn được xác nhận.'),
    },
    {
      n: '3',
      t: L('우선 추천 받기', 'Get recommended first', 'Được ưu tiên giới thiệu'),
      time: null,
      s: L('한국어가 필요한 한국 기업·베트남 현지 포지션에 담당자가 먼저 추천해드려요. 지금은 학생이어도 OK — 미리 등록하면 가장 먼저 연락받아요.',
        "We recommend you first for Korean-company and Vietnam-based positions that need Korean. Still a student? That's fine — register now and you'll be contacted first later.",
        'Chúng tôi ưu tiên giới thiệu bạn cho các vị trí cần tiếng Hàn tại công ty Hàn Quốc và Việt Nam. Đang là sinh viên cũng không sao — đăng ký trước, bạn sẽ được liên hệ đầu tiên.'),
    },
  ]

  const chipKo = L('한국어 가능 · 인증됨', 'Korean · Verified', 'Tiếng Hàn · Đã xác nhận')
  const chipPri = L('우선 추천 대상', 'Priority pick', 'Ưu tiên giới thiệu')
  const okChip = <>✓ {L('한국어 가능 인증 완료', 'Verified as Korean speaker', 'Đã xác nhận biết tiếng Hàn')}</>

  const pageTitle = L(
    '한국어 가능 인재 등록 — 홍익대 국제언어교육원 | FYI',
    'Korean-speaker talent registration — Hongik KLI | FYI',
    'Đăng ký ứng viên biết tiếng Hàn — Hongik KLI | FYI',
  )

  const loginCta = (
    <>
      <button className="hk-cta hk-cta-g" onClick={startLogin} disabled={!sessionReady}>
        <span className="hk-gball"><GoogleG /></span>
        {L('Google로 시작하기 — 30초', 'Start with Google — 30s', 'Bắt đầu với Google — 30 giây')}
      </button>
      <div className="hk-cta-note">
        {L('무료예요 · 가입만 해도 한국어 인증이 완료돼요', 'Free · signing up alone completes your Korean verification', 'Miễn phí · chỉ cần đăng ký là được xác nhận tiếng Hàn')}
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content={L(
          '이 페이지로 가입하면 한국어 가능 인재로 자동 인증 — 한국 기업·베트남 현지 포지션에 우선 추천받으세요.',
          'Sign up here to be auto-verified as a Korean speaker and get recommended first for jobs that need Korean.',
          'Đăng ký tại đây để được xác nhận biết tiếng Hàn và được ưu tiên giới thiệu việc làm cần tiếng Hàn.',
        )} />
      </Head>
      <GlobalNav />

      <style>{`
        /* 현장 QR 랜딩 — 모바일 헤더의 K-company 칩은 숨긴다(이탈 경로 최소화). */
        .gnav-zone-m { display: none !important; }
        .hk-page { min-height: 100vh; background: #f4f2ee; color: #1a1612; font-family: 'Barlow', -apple-system, sans-serif; padding: 72px 0 90px; overflow-x: hidden; }
        .hk-wrap { max-width: 560px; margin: 0 auto; padding: 0 18px; }

        /* ─ 히어로 ─ */
        .hk-hero { text-align: center; padding: 34px 0 6px; position: relative; }
        .hk-hero::before { content: ''; position: absolute; inset: -80px -60px auto; height: 460px; background: radial-gradient(400px 300px at 50% 16%, rgba(255,96,0,0.14), transparent 70%); pointer-events: none; }
        .hk-hero > * { position: relative; }
        @keyframes hkRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .hk-hero > * { animation: hkRise .6s cubic-bezier(.22,.7,.3,1) both; }
        .hk-hero > *:nth-child(2) { animation-delay: .08s; }
        .hk-hero > *:nth-child(3) { animation-delay: .16s; }
        .hk-hero > *:nth-child(4) { animation-delay: .26s; }
        .hk-badge { display: inline-flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 700; color: #3d3831; background: #fff; border: 1px solid #eee6dc; box-shadow: 0 6px 18px rgba(26,22,18,0.07); border-radius: 100px; padding: 8px 16px 8px 9px; margin-bottom: 20px; }
        .hk-badge img { width: 26px; height: 26px; display: block; }
        .hk-h1 { font-size: 31px; font-weight: 800; line-height: 1.28; letter-spacing: -0.01em; margin: 0 0 14px; }
        .hk-h1 em { font-style: normal; color: #ff6000; }
        .hk-sub { font-size: 15px; color: #57504a; line-height: 1.7; margin: 0 auto; max-width: 460px; }

        /* 프로필 카드 목업 — "가입 = 인증 배지"를 말 대신 그림으로 보여준다 */
        .hk-art { position: relative; width: 264px; margin: 30px auto 10px; }
        .hk-art-card { background: #fff; border: 1px solid rgba(255,96,0,0.28); border-radius: 18px; padding: 18px 18px 16px; text-align: left; box-shadow: 0 22px 48px rgba(255,96,0,0.16); animation: hkFloat 3.8s ease-in-out infinite; }
        @keyframes hkFloat { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(-1deg); } }
        .hk-art-head { display: flex; gap: 12px; align-items: center; margin-bottom: 13px; }
        .hk-art-ava { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #ffd9bf, #ffb385); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 19px; }
        .hk-art-line { height: 8px; border-radius: 4px; background: #ece6dd; }
        .hk-art-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .hk-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; border-radius: 100px; padding: 6px 11px; }
        .hk-chip-ko { background: rgba(34,197,94,0.13); color: #15803d; }
        .hk-chip-pri { background: rgba(255,96,0,0.11); color: #e05400; }
        .hk-art-spark { position: absolute; color: #ffb36b; font-size: 15px; animation: hkTwinkle 2.2s ease-in-out infinite; pointer-events: none; }
        .hk-art-spark.s1 { top: -12px; left: -18px; }
        .hk-art-spark.s2 { bottom: 2px; right: -16px; font-size: 11px; animation-delay: 1.1s; }
        @keyframes hkTwinkle { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.12); } }

        /* ─ CTA ─ */
        .hk-cta { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 22px; background: #ff6000; color: #fff; border: none; border-radius: 14px; padding: 17px; font-size: 16.5px; font-weight: 800; cursor: pointer; font-family: inherit; box-shadow: 0 10px 26px rgba(255,96,0,0.3); transition: background .15s, transform .12s; }
        .hk-cta:hover { background: #ff7a1a; transform: translateY(-1px); }
        .hk-cta:disabled { opacity: 0.6; cursor: default; }
        .hk-gball { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; background: #fff; flex-shrink: 0; }
        .hk-cta-note { margin-top: 11px; font-size: 12.5px; color: #9a9186; text-align: center; }

        /* ─ 3단계 타임라인 — 진입 시 번호 점등 → 카드 슬라이드 → 연결선 드로잉 시퀀스 ─ */
        .hk-sec-h { font-size: 20px; font-weight: 800; text-align: center; margin: 42px 0 18px; }
        .hk-flow { display: flex; flex-direction: column; }
        .hk-flow-row { display: flex; gap: 14px; }
        .hk-flow-rail { display: flex; flex-direction: column; align-items: center; width: 36px; flex-shrink: 0; }
        .hk-flow-n { width: 36px; height: 36px; border-radius: 50%; background: #fff; border: 1.5px solid #e3dcd2; color: #b0a496; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hk-flow-line { width: 2.5px; flex: 1; min-height: 22px; background: #e3dcd2; border-radius: 2px; margin: 6px 0; position: relative; overflow: hidden; }
        .hk-flow-line::after { content: ''; position: absolute; inset: 0; background: #ff6000; transform: scaleY(0); transform-origin: top; }
        .hk-flow-card { flex: 1; background: #fff; border: 1px solid #e8e2da; border-radius: 16px; padding: 17px 16px; margin-bottom: 14px; box-shadow: 0 3px 12px rgba(26,22,18,0.04); opacity: 0; }
        .hk-flow-row:last-child .hk-flow-card { margin-bottom: 0; }
        /* 마지막 스텝 = 보상 카드. 살짝 오렌지로 띄워 "여기가 목적지"를 표시한다 */
        .hk-flow-row:last-child .hk-flow-card { border-color: rgba(255,96,0,0.4); background: linear-gradient(180deg, #fffdfb, #fff6ef); box-shadow: 0 8px 22px rgba(255,96,0,0.1); }
        .hk-flow-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap; }
        .hk-flow-t { font-size: 15.5px; font-weight: 800; line-height: 1.4; }
        .hk-flow-time { font-size: 11.5px; font-weight: 800; color: #e05400; background: rgba(255,96,0,0.09); border-radius: 100px; padding: 3px 9px; }
        .hk-flow-s { font-size: 13px; color: #57504a; line-height: 1.65; }
        @keyframes hkNPop { 0% { transform: scale(.4); } 60% { transform: scale(1.22); } 100% { transform: scale(1); background: #ff6000; border-color: #ff6000; color: #fff; box-shadow: 0 6px 14px rgba(255,96,0,0.35); } }
        @keyframes hkCardIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: none; } }
        @keyframes hkLineDraw { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .hk-flow.in .hk-flow-row:nth-child(1) .hk-flow-n { animation: hkNPop .5s .05s both; }
        .hk-flow.in .hk-flow-row:nth-child(1) .hk-flow-card { animation: hkCardIn .5s .15s cubic-bezier(.22,.7,.3,1) both; }
        .hk-flow.in .hk-flow-row:nth-child(1) .hk-flow-line::after { animation: hkLineDraw .35s .5s ease both; }
        .hk-flow.in .hk-flow-row:nth-child(2) .hk-flow-n { animation: hkNPop .5s .8s both; }
        .hk-flow.in .hk-flow-row:nth-child(2) .hk-flow-card { animation: hkCardIn .5s .9s cubic-bezier(.22,.7,.3,1) both; }
        .hk-flow.in .hk-flow-row:nth-child(2) .hk-flow-line::after { animation: hkLineDraw .35s 1.25s ease both; }
        .hk-flow.in .hk-flow-row:nth-child(3) .hk-flow-n { animation: hkNPop .5s 1.55s both; }
        .hk-flow.in .hk-flow-row:nth-child(3) .hk-flow-card { animation: hkCardIn .5s 1.65s cubic-bezier(.22,.7,.3,1) both; }

        /* ─ 신뢰(로고 스트립) ─ */
        .hk-trust { margin-top: 26px; background: #fff; border: 1px solid #e8e2da; border-radius: 18px; padding: 24px 20px 22px; text-align: center; box-shadow: 0 3px 12px rgba(26,22,18,0.04); }
        .hk-trust-t { font-size: 15.5px; font-weight: 800; margin-bottom: 7px; }
        .hk-trust-s { font-size: 13px; color: #57504a; line-height: 1.7; max-width: 420px; margin: 0 auto; }
        .hk-logos { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 18px 26px; margin-top: 18px; padding-top: 18px; border-top: 1px solid #f0ebe3; }
        .hk-logos img { display: block; opacity: 0.85; }

        /* ─ 상태 카드(인증/TOPIK/완료) ─ */
        .hk-card { background: #fff; border: 1px solid #e8e2da; border-radius: 20px; padding: 30px 22px; text-align: center; margin-top: 24px; box-shadow: 0 10px 32px rgba(26,22,18,0.07); }
        .hk-ok { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.11); color: #15803d; font-size: 13.5px; font-weight: 800; border-radius: 100px; padding: 9px 17px; margin-bottom: 15px; animation: hkPop .55s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes hkPop { 0% { transform: scale(.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .hk-card-t { font-size: 21px; font-weight: 800; margin-bottom: 8px; }
        .hk-card-s { font-size: 14px; color: #57504a; line-height: 1.7; margin-bottom: 18px; }
        .hk-card-s b { color: #e05400; }

        /* TOPIK 급수 원탭 그리드 */
        .hk-topik-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        .hk-topik-btn { padding: 14px 0; border-radius: 12px; border: 1.5px solid #e8e2da; background: #fff; font-size: 15px; font-weight: 800; color: #1a1612; cursor: pointer; font-family: inherit; transition: border-color .12s, background .12s, color .12s; }
        .hk-topik-btn:hover { border-color: #ff6000; color: #e05400; background: #fffaf6; }
        .hk-topik-btn:disabled { opacity: 0.55; cursor: default; }
        .hk-topik-none { grid-column: 1 / -1; font-weight: 600; color: #57504a; }
        .hk-topik-note { margin-top: 12px; font-size: 12px; color: #9a9186; }

        /* CV 업로드(선택) */
        .hk-drop { border: 1.5px dashed rgba(255,96,0,0.5); background: #fffaf6; border-radius: 14px; padding: 26px 18px; cursor: pointer; transition: background .15s, border-color .15s; }
        .hk-drop:hover, .hk-drop.over { background: #fff3ea; border-color: #ff6000; }
        .hk-drop-t { font-size: 15.5px; font-weight: 700; margin-bottom: 5px; }
        .hk-drop-s { font-size: 12.5px; color: #9a9186; }
        .hk-file { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; background: #f4f2ee; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
        .hk-file button { background: none; border: none; color: #9a9186; font-size: 12px; cursor: pointer; text-decoration: underline; font-family: inherit; }
        .hk-err { margin-top: 14px; background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; font-size: 13.5px; border-radius: 10px; padding: 11px 16px; }

        /* ─ 완료 후 공고 ─ */
        .hk-jobs { margin-top: 36px; }
        .hk-jobs-h { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
        .hk-jobs-s { font-size: 13px; color: #8a8177; margin-bottom: 14px; }
        .hk-job-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #fff; border: 1px solid #e8e2da; border-radius: 14px; padding: 15px 17px; margin-bottom: 10px; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; }
        .hk-job-card:hover { border-color: rgba(255,96,0,0.5); box-shadow: 0 4px 16px rgba(26,22,18,0.07); }
        .hk-job-t { font-size: 14.5px; font-weight: 700; margin-bottom: 3px; }
        .hk-job-c { font-size: 12.5px; color: #8a8177; }
        .hk-job-sal { font-size: 13px; font-weight: 700; color: #e05400; white-space: nowrap; }
        .hk-jobs-all { display: inline-block; margin-top: 6px; font-size: 13.5px; color: #e05400; text-decoration: none; font-weight: 600; }

        @media (max-width: 768px) {
          .hk-page { padding-top: 60px; }
          .hk-h1 { font-size: 26px; }
          .hk-logos { gap: 14px 20px; }
          .hk-logos img { transform: scale(0.86); transform-origin: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hk-hero > *, .hk-art-card, .hk-art-spark, .hk-ok { animation: none; }
          .hk-flow-card { opacity: 1 !important; animation: none !important; }
          .hk-flow-n { animation: none !important; background: #ff6000; border-color: #ff6000; color: #fff; }
          .hk-flow-line::after { animation: none !important; transform: none; }
        }
      `}</style>

      <div className="hk-page">
        <div className="hk-wrap">

          <div className="hk-hero">
            <div className="hk-badge">
              <img src="/hongik/emblem.svg" alt="Hongik University" />
              {L('홍익대학교 국제언어교육원 학생 전용', 'For Hongik University KLI students', 'Dành cho học viên KLI ĐH Hongik')}
            </div>
            <h1 className="hk-h1">
              {L(<>한국어 하세요?<br />이제 <em>기업이 먼저</em> 찾습니다</>,
                <>Speak Korean?<br />Let <em>companies find you</em> first</>,
                <>Biết tiếng Hàn?<br />Hãy để <em>công ty tìm đến bạn</em> trước</>)}
            </h1>
            <p className="hk-sub">
              {L('이 페이지로 가입하면 \'한국어 가능 인재\'로 자동 인증돼요. 한국어가 필요한 한국 기업·베트남 현지 포지션에 우선 추천됩니다.',
                'Sign up through this page to be auto-verified as a Korean-speaking candidate — and get recommended first for positions that need Korean.',
                'Đăng ký qua trang này để được tự động xác nhận biết tiếng Hàn — và được ưu tiên giới thiệu cho các vị trí cần tiếng Hàn.')}
            </p>
            <div className="hk-art" aria-hidden="true">
              <span className="hk-art-spark s1">✦</span>
              <span className="hk-art-spark s2">✦</span>
              <div className="hk-art-card">
                <div className="hk-art-head">
                  <div className="hk-art-ava">🧑‍🎓</div>
                  <div style={{ flex: 1 }}>
                    <div className="hk-art-line" style={{ width: '72%' }} />
                    <div className="hk-art-line" style={{ width: '48%', marginTop: 7 }} />
                  </div>
                </div>
                <div className="hk-art-chips">
                  <span className="hk-chip hk-chip-ko">✓ {chipKo}</span>
                  <span className="hk-chip hk-chip-pri">★ {chipPri}</span>
                </div>
              </div>
            </div>
          </div>

          {!user ? (
            <>
              {loginCta}

              <div className="hk-sec-h">{L('이렇게 진행돼요', 'How it works', 'Cách thức hoạt động')}</div>
              <div className="hk-flow">
                {steps.map((s, i) => (
                  <div key={s.n} className="hk-flow-row">
                    <div className="hk-flow-rail">
                      <div className="hk-flow-n">{s.n}</div>
                      {i < steps.length - 1 && <div className="hk-flow-line" />}
                    </div>
                    <div className="hk-flow-card">
                      <div className="hk-flow-head">
                        <span className="hk-flow-t">{s.t}</span>
                        {s.time && <span className="hk-flow-time">{s.time}</span>}
                      </div>
                      <div className="hk-flow-s">{s.s}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hk-trust">
                <div className="hk-trust-t">
                  {L('정부지원사업 K-Tech College를 3년 연속 운영해요', "We've run K-Tech College for 3 straight years", 'Vận hành K-Tech College 3 năm liên tiếp')}
                </div>
                <div className="hk-trust-s">
                  {L('FYI는 LIKELION이 운영하는 채용 플랫폼이에요. 한국 정부 지원으로 베트남 인재를 선발·교육해 한국 기업과 연결해왔어요.',
                    'FYI is the hiring platform run by LIKELION. With Korean-government backing, we select and train Vietnamese talent and connect them with Korean companies.',
                    'FYI là nền tảng tuyển dụng do LIKELION vận hành. Với sự hỗ trợ của chính phủ Hàn Quốc, chúng tôi tuyển chọn, đào tạo và kết nối nhân tài Việt với doanh nghiệp Hàn.')}
                </div>
                <div className="hk-logos">
                  {TRUST_LOGOS.map(l => <img key={l.src} src={l.src} alt={l.alt} style={{ height: l.h }} />)}
                </div>
              </div>
            </>
          ) : !verified ? (
            <div className="hk-card">
              <div className="hk-card-s" style={{ marginBottom: 0 }}>{L('인증 처리 중...', 'Verifying...', 'Đang xác nhận...')}</div>
            </div>
          ) : !topikDone ? (
            <div className="hk-card">
              <div className="hk-ok">{okChip}</div>
              <div className="hk-card-t">{L('TOPIK 급수가 있으세요?', 'Do you have a TOPIK level?', 'Bạn có cấp TOPIK chưa?')}</div>
              <div className="hk-card-s">
                {L('탭 한 번이면 프로필에 반영돼요 — 추천 우선순위가 올라가요.',
                  'One tap adds it to your profile — it boosts your recommendation priority.',
                  'Chỉ một chạm để lưu vào hồ sơ — tăng độ ưu tiên khi giới thiệu.')}
              </div>
              <div className="hk-topik-grid">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} className="hk-topik-btn" disabled={!!topikSaving}
                    onClick={() => saveTopik(n)}>
                    {topikSaving === n ? '...' : L(`${n}급`, `Level ${n}`, `Cấp ${n}`)}
                  </button>
                ))}
                <button className="hk-topik-btn hk-topik-none" disabled={!!topikSaving}
                  onClick={() => saveTopik('none')}>
                  {topikSaving === 'none' ? '...' : L('아직 없어요 · 준비 중', "Not yet · preparing", 'Chưa có · đang chuẩn bị')}
                </button>
              </div>
              <div className="hk-topik-note">
                {L('없어도 인증은 그대로 유지돼요.', "No TOPIK? You stay verified either way.", 'Chưa có TOPIK? Bạn vẫn được xác nhận.')}
              </div>
            </div>
          ) : (
            <>
              <div className="hk-card">
                <div className="hk-ok">{okChip}</div>
                <div className="hk-card-t">{L('등록 완료!', 'All done!', 'Hoàn tất đăng ký!')}</div>
                <div className="hk-card-s">
                  {L(<>한국어 가능 인재풀에 들어왔어요. 한국어가 필요한 포지션이 열리면 <b>{user?.email}</b>로 가장 먼저 추천해드릴게요.</>,
                    <>You're now in our Korean-speaker talent pool. When a position needs Korean, we'll recommend you first at <b>{user?.email}</b>.</>,
                    <>Bạn đã vào nhóm ứng viên biết tiếng Hàn. Khi có vị trí cần tiếng Hàn, chúng tôi sẽ giới thiệu bạn đầu tiên qua <b>{user?.email}</b>.</>)}
                </div>
              </div>

              {!cvDone && (
                <div className="hk-card">
                  <div className="hk-card-t" style={{ fontSize: 18 }}>
                    {L('CV가 있다면 지금 올려두세요', 'Have a CV? Upload it now', 'Có CV? Tải lên ngay')}
                  </div>
                  <div className="hk-card-s">
                    {L('CV가 있으면 추천이 훨씬 빨라져요. 없으면 나중에 프로필에서 올려도 돼요.',
                      "A CV makes recommendations much faster. Don't have one? You can add it later in your profile.",
                      'Có CV sẽ được giới thiệu nhanh hơn nhiều. Chưa có? Bạn có thể thêm sau trong hồ sơ cá nhân.')}
                  </div>
                  <div
                    className="hk-drop"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                    onDragLeave={e => e.currentTarget.classList.remove('over')}
                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); handleFile(e.dataTransfer.files?.[0]) }}
                  >
                    <div className="hk-drop-t">📎 {L('CV 파일 올리기', 'Upload your CV', 'Tải file CV lên')}</div>
                    <div className="hk-drop-s">{L('PDF, DOC, DOCX · 최대 10MB', 'PDF, DOC, DOCX · max 10MB', 'PDF, DOC, DOCX · tối đa 10MB')}</div>
                  </div>
                  {file && (
                    <div className="hk-file">
                      <span>📄 {file.name}</span>
                      <button onClick={() => setFile(null)}>{L('삭제', 'remove', 'xóa')}</button>
                    </div>
                  )}
                  {file && (
                    <button className="hk-cta" onClick={submitCv} disabled={status === 'submitting'}>
                      {status === 'submitting'
                        ? L('등록 중...', 'Uploading...', 'Đang gửi...')
                        : L('인재풀에 등록하기', 'Register to talent pool', 'Đăng ký vào nhóm ứng viên')}
                    </button>
                  )}
                  {errMsg && <div className="hk-err">{errMsg}</div>}
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                    onClick={e => { e.currentTarget.value = '' }}
                    onChange={e => handleFile(e.target.files?.[0])} />
                </div>
              )}

              {topJobs.length > 0 && (
                <div className="hk-jobs">
                  <div className="hk-jobs-h">{L('지금 열려 있는 공고', 'Jobs open right now', 'Việc làm đang tuyển')}</div>
                  <div className="hk-jobs-s">{L('지금 채용 중인 한국계 기업 공고예요.', 'Korean companies hiring right now.', 'Các công ty Hàn Quốc đang tuyển dụng.')}</div>
                  {topJobs.map(j => (
                    <a key={j.id} href={`/jobs/${j.id}?from=hongik`} className="hk-job-card"
                      onClick={() => track('hongik_job_click', { meta: { ...hkMeta(), job_id: j.id }, page: '/hongik' })}>
                      <div>
                        <div className="hk-job-t">{j.title}</div>
                        <div className="hk-job-c">{j.company}{j.location ? ` · ${j.location}` : ''}</div>
                      </div>
                      {fmtSal(j.salary_min, j.salary_max) && <div className="hk-job-sal">{fmtSal(j.salary_min, j.salary_max)}</div>}
                    </a>
                  ))}
                  <a href="/jobs" className="hk-jobs-all">{L('전체 공고 보기 →', 'See all jobs →', 'Xem tất cả việc làm →')}</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
