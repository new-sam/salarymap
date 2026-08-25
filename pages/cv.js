import { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track, getClientId } from '../lib/track'
import { useFlags } from '../lib/flags'
import { toast } from 'sonner'
import { idbPutCv, idbGetCv, idbClearCv } from '../lib/pendingCv'
import { ROLE_GROUPS } from '../constants/jobs'
import QuickApplyJobList from '../components/jobs/QuickApplyJobList'

/* ── 직접입력 트랙 ──────────────────────────────────────────────
   PDF 가 없는 사람에게서 "콜드메일을 보낼 만큼"만 받는다. 이력서를 다 받으려 하면
   PDF 찾기와 다를 바 없어져 같은 자리에서 또 이탈한다.
   저장 위치는 파서(parseResume)가 채우는 컬럼과 같아서 매칭·추천·어드민이 그대로 쓴다.
   /profile 의 CustomSelect·LanguageCard 는 그 페이지 CSS(pinput/pfield)에 묶여 있어
   여기서 재사용하면 스타일이 깨진다 — 네이티브 select 로 짠다(모바일 OS 피커라 더 빠르다). */
const roleLabel = (o, lang) => o.label[lang] || o.label.en
const roleGroupsFor = (lang) => ROLE_GROUPS.map(g => ({ value: g.key, label: roleLabel(g, lang) }))
const rolesInGroup = (key, lang) => {
  const g = ROLE_GROUPS.find(x => x.key === key)
  return g ? g.roles.map(r => ({ value: r.value, label: roleLabel(r, lang) })) : []
}

/* /profile 의 연차 목록을 광고 랜딩용으로 줄이고 현지화했다(값은 그대로 yoe_months 라
   프로필과 호환된다). 선택지를 늘리면 고르는 시간이 늘어 트랙의 취지가 사라진다. */
const YOE_CHOICES = [
  { value: '0', ko: '신입 · 인턴', en: 'New grad / Intern', vi: 'Mới tốt nghiệp / Thực tập' },
  { value: '12', ko: '1년', en: '1 year', vi: '1 năm' },
  { value: '24', ko: '2년', en: '2 years', vi: '2 năm' },
  { value: '36', ko: '3년', en: '3 years', vi: '3 năm' },
  { value: '60', ko: '5년', en: '5 years', vi: '5 năm' },
  { value: '84', ko: '5~7년', en: '5-7 years', vi: '5-7 năm' },
  { value: '108', ko: '7~10년', en: '7-10 years', vi: '7-10 năm' },
  { value: '120', ko: '10년 이상', en: '10+ years', vi: 'Trên 10 năm' },
]

/* 어학은 "자격증 + 점수" 쌍으로 여러 개 받는다. 저장 포맷은 LanguageCard 와 동일한
   "TOEIC 900" 한 줄 텍스트라 /profile 이 그대로 되읽고 어학 등급(A/B/C) 환산도 붙는다.
   컬럼이 영어/한국어 각 한 칸뿐이라 나머지는 languages(jsonb)로 흘린다 — 기타 언어를
   담는 기존 자리이고 모양도 {name, level} 로 같다. */
const ENGLISH_CERTS = ['TOEIC', 'IELTS', 'TOEFL', 'VSTEP', 'APTIS', 'CEFR']
const KOREAN_CERTS = ['TOPIK']
const CERT_CHOICES = [...ENGLISH_CERTS, ...KOREAN_CERTS]
const CERT_SCORE_PH = { TOEIC: '900', IELTS: '6.5', TOEFL: '100', VSTEP: 'B2', APTIS: 'B2', CEFR: 'B2', TOPIK: '5' }

/* [{cert, score}] → user_profiles 컬럼들. 같은 자격증이 겹치면 첫 줄만 컬럼으로 올리고
   나머지는 languages 로 보낸다 — 덮어쓰기로 조용히 잃는 것보다 낫다. */
function certRowsToProfile(rows) {
  const filled = rows.filter((r) => r.cert && String(r.score).trim())
  const out = { english_cert: null, korean_cert: null, languages: [] }
  for (const r of filled) {
    const text = `${r.cert} ${String(r.score).trim()}`
    if (ENGLISH_CERTS.includes(r.cert) && !out.english_cert) out.english_cert = text
    else if (KOREAN_CERTS.includes(r.cert) && !out.korean_cert) out.korean_cert = text
    else out.languages.push({ name: r.cert, level: String(r.score).trim() })
  }
  return out
}

/* 가입 선행 실험(cv_signup_first) 버킷 — sm_cid 해시로 고정 배정한다.
   같은 브라우저는 늘 같은 쪽이라 새로고침·재방문에도 변이가 안 바뀐다. */
function abBucket() {
  const cid = getClientId()
  if (!cid) return 0
  let h = 0
  for (let i = 0; i < cid.length; i++) h = (h * 31 + cid.charCodeAt(i)) | 0
  return Math.abs(h) % 2
}

/* cvMeta 가 모든 이벤트에 실어 보내는 현재 변이. 컴포넌트가 플래그를 받아 확정한 뒤
   여기에 써 넣는다 — 그래야 퍼널 단계별 이벤트를 변이로 갈라 볼 수 있다. */
let currentVariant = null

/* Funnel-event meta — UTM (sessionStorage) + language preference, attached to
   every /cv event so we can slice by ad campaign and locale in analytics. */
function cvMeta() {
  if (typeof window === 'undefined') return {}
  return {
    utm_source: sessionStorage.getItem('utm_source') || null,
    utm_medium: sessionStorage.getItem('utm_medium') || null,
    utm_campaign: sessionStorage.getItem('utm_campaign') || null,
    utm_content: sessionStorage.getItem('utm_content') || null,
    utm_term: sessionStorage.getItem('utm_term') || null,
    lang: localStorage.getItem('fyi_lang') || 'ko',
    variant: currentVariant,
  }
}
function fileMeta(f) {
  if (!f) return {}
  return { file_ext: (f.name.split('.').pop() || '').toLowerCase(), file_size: f.size }
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
  const { t, lang } = useT()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const [pendingHint, setPendingHint] = useState('')
  const [jobs, setJobs] = useState([])
  const [resumeUrl, setResumeUrl] = useState(null)
  // 기존 등록자: user_profiles.resume_url이 이미 있으면 업로드 퍼널 대신 등록됨 화면을 보여준다.
  const [existingResume, setExistingResume] = useState(null)
  const [replacing, setReplacing] = useState(false)
  const replacePick = useRef(false)
  const [showJobModal, setShowJobModal] = useState(false)
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)
  const fileRef = useRef(null)
  const formAnchorRef = useRef(null)
  // 히어로 CTA 와 하단 바는 같은 문구·같은 목적지다 — 둘이 동시에 보이면 같은 버튼이
  // 두 개다. 히어로 CTA 가 화면 위로 사라진 뒤에만 하단 바를 띄우려고 위치를 잰다.
  const heroCtaRef = useRef(null)
  // 스크롤 목적지는 섹션(formAnchorRef)이 아니라 카드다 — 섹션은 padding-top 만
  // 90px(모바일 80px)이라 섹션 맨 위로 보내면 카드가 화면 한참 아래에서 시작한다.
  const formCardRef = useRef(null)
  // 모바일 하단 스크롤 다운 버튼 — 긴 랜딩을 단계별로 넘겨준다
  // (STEP 1 → 2 → 3 카드 → 등록 폼). 폼이 화면 절반 안에 들어오면
  // 폼 자체 CTA와 겹치지 않게 숨긴다.
  const [showScrollDown, setShowScrollDown] = useState(false)
  // 직접입력 트랙 — PDF 없는 사람이 STEP2 에서 고르는 두 번째 경로.
  const [manualMode, setManualMode] = useState(false)
  const [manualGroup, setManualGroup] = useState('')
  const [manual, setManual] = useState({ position: '', yoe_months: '' })
  const [certRows, setCertRows] = useState([{ cert: '', score: '' }])
  const [manualStatus, setManualStatus] = useState('idle') // idle | saving | saved | error
  const setManualField = (k, v) => setManual((prev) => ({ ...prev, [k]: v }))
  const setCertRow = (i, patch) => setCertRows((rows) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  const showSuccess = status === 'success' || (process.env.NODE_ENV !== 'production' && router.query.successPreview === '1')

  // ── 가입 선행 실험 ──────────────────────────────────────────────
  // signupFirst = STEP1 가입 / STEP2 이력서(가입 전엔 잠김). 대조군은 기존 순서 그대로.
  // 플래그를 끄면 버킷과 무관하게 전원 대조군 — 재배포 없는 롤백 스위치다.
  const { flags, loaded: flagsLoaded } = useFlags()
  const [bucket, setBucket] = useState(null)
  // ?variant=signup_first|control 로 버킷을 강제한다 — 해시 배정이라 강제 수단이 없으면
  // QA 도 팀 리뷰도 못 한다. 실사용자 데이터에 섞이지 않게 ?qa=1 과 같이 쓸 것.
  const [forced, setForced] = useState(null)
  useEffect(() => {
    setBucket(abBucket())
    const v = new URLSearchParams(window.location.search).get('variant')
    if (v === 'signup_first' || v === 'control') setForced(v)
  }, [])
  const variantReady = flagsLoaded && bucket !== null
  const signupFirst = variantReady && (
    forced ? forced === 'signup_first' : (!!flags.cv_signup_first && bucket === 1)
  )
  // 이벤트 meta 에 실릴 변이명을 확정한다. cv_view 를 포함한 모든 퍼널 이벤트가
  // 이 값을 읽으므로, 확정 전에는 어떤 이벤트도 쏘지 않는다(아래 cv_view 이펙트).
  // 렌더 중에 모듈 변수를 건드리면 StrictMode 이중 렌더에서 불순해지므로 이펙트에서 쓴다 —
  // 이펙트는 선언 순서대로 도니 아래 cv_view 이펙트보다 항상 먼저 확정된다.
  useEffect(() => {
    if (variantReady) currentVariant = signupFirst ? 'signup_first' : 'control'
  }, [variantReady, signupFirst])
  // 4-step journey to the 1,000,000 VND bonus. The bar grows from 0 to
  // step-1 ("Resume registered") and "lands" on it — at that instant the
  // step label flips to "등록 완료" and a single viewport-wide confetti
  // burst fires. Everything else stays still to keep the hero on the bar.
  const STEP1_FILL_MS = 1100
  const [stepReached, setStepReached] = useState(false)
  useEffect(() => {
    if (!showSuccess || typeof window === 'undefined') {
      setStepReached(false)
      return
    }
    let cancelled = false
    let landTimer
    const landPromise = import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return
      landTimer = setTimeout(() => {
        if (cancelled) return
        setStepReached(true)
        const fire = (x, angle) => confetti({
          particleCount: 60,
          angle,
          spread: 60,
          startVelocity: 52,
          origin: { x, y: 0.82 },
          colors: ['#ff6000', '#ffb36b', '#16a34a', '#fde047'],
          scalar: 0.95,
          gravity: 1.0,
          ticks: 240,
          disableForReducedMotion: true,
          zIndex: 9999,
        })
        fire(0.2, 60)
        fire(0.8, 120)
      }, STEP1_FILL_MS)
    })
    return () => { cancelled = true; if (landTimer) clearTimeout(landTimer); landPromise.catch(() => {}) }
  }, [showSuccess])
  /* When user clicks a sign-in CTA without a file, we open the file picker
     and remember which OAuth to kick off after a file is chosen. */
  const oauthAfterPick = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      const v = p.get(k)
      if (v) sessionStorage.setItem(k, v)
    })
  }, [])

  // cv_view 는 실험 분모다 — 변이가 확정되기 전에 쏘면 variant:null 로 찍혀
  // 어느 쪽 방문자인지 영영 모른다. 플래그·버킷이 정해진 뒤 1회만 기록한다.
  const viewTracked = useRef(false)
  useEffect(() => {
    if (!variantReady || viewTracked.current) return
    viewTracked.current = true
    track('cv_view', { meta: cvMeta(), page: '/cv' })
  }, [variantReady])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  // OAuth 페이지에서 뒤로가기로 돌아오면 iOS가 bfcache로 복원한다 — 이때
  // 자동 OAuth 트리거가 armed 상태로 남아 있으면 재첨부하자마자 다시
  // 구글로 튕기므로 해제한다. (같은 파일 재선택 무반응은 input onClick의
  // value 리셋이 처리)
  useEffect(() => {
    const onPageShow = (e) => { if (e.persisted) oauthAfterPick.current = null }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  useEffect(() => {
    if (!user) { setExistingResume(null); return }
    let cancelled = false
    supabase.from('user_profiles').select('resume_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled && data?.resume_url) setExistingResume(data.resume_url) })
    return () => { cancelled = true }
  }, [user])

  // OAuth 복귀 계측 — cv_oauth_start 대비 "실제로 돌아온 사람"을 재서 로그인 구간 이탈을 잡는다.
  // 이 이펙트는 user/router.query 변화로 여러 번 돌 수 있어 1회만 기록.
  const oauthReturnTracked = useRef(false)

  // Resume after OAuth: retrieve blob from IndexedDB and auto-upload.
  useEffect(() => {
    if (!user) return
    if (router.query.continue !== '1') return
    if (!oauthReturnTracked.current) {
      oauthReturnTracked.current = true
      track('cv_oauth_return', { meta: cvMeta(), page: '/cv' })
    }
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
    fetch('/api/jobs?counts=1')
      .then(r => r.json())
      .then(arr => {
        const list = Array.isArray(arr) ? arr : (arr.jobs || [])
        const sorted = list
          .filter(j => j.is_active !== false)
          .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
        setJobs(sorted)
      })
      .catch(() => {})
  }, [])

  const handleFile = (f) => {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg(t('cv.err.fileTooBig'))
      track('cv_attach_rejected', { meta: { ...cvMeta(), ...fileMeta(f), reason: 'too_big' }, page: '/cv' })
      return
    }
    setFile(f)
    setErrMsg('')
    track('cv_attach_file', { meta: { ...cvMeta(), ...fileMeta(f) }, page: '/cv' })
    idbPutCv(f).catch(() => {
      try { sessionStorage.setItem('cv_pending_filename', f.name) } catch {}
    })
    // 등록됨 화면에서 "교체"로 파일을 고른 경우 — 이미 로그인 상태이므로 바로 업로드
    if (replacePick.current && user) {
      replacePick.current = false
      setReplacing(true)
      doUpload(f)
      return
    }
    /* 로그인한 사람은 파일을 고르는 순간 등록된다. 로그인이 끝난 사람에게 남은 건
       업로드뿐인데, 그걸 'STEP 2'라는 칸에 버튼으로 세워 두면 단계가 하나 헛돈다 —
       화면은 두 단계를 요구하지만 실제로 할 일은 파일 고르기 하나다.
       가입 선행 변이가 이미 이렇게 동작하고 있었고, 대조군만 버튼을 남겨 두었다. */
    if (user) {
      doUpload(f)
      return
    }
    // If the file picker was opened via a sign-in CTA, auto-progress to OAuth
    const pending = oauthAfterPick.current
    if (pending && !user) {
      oauthAfterPick.current = null
      setTimeout(async () => {
        localStorage.setItem('fyi_login_return', '/cv?continue=1')
        localStorage.setItem('fyi_intent', 'cv_signup')
        // 리다이렉트가 전송 중인 요청을 죽인다 — 보내고 나서 넘어간다.
        await track('cv_oauth_start', { meta: { ...cvMeta(), provider: pending, has_file: true, auto: true }, page: '/cv' })
        if (pending === 'linkedin') {
          // Intent/return are also stored in localStorage, but pass them
          // via the callback URL so the destination survives even if the
          // OAuth provider returns fast (existing members) and the
          // callback consumes localStorage before we can read it.
          supabase.auth.signInWithOAuth({
            provider: 'linkedin_oidc',
            options: {
              redirectTo: window.location.origin + '/auth/callback?intent=cv_signup&return=' + encodeURIComponent('/cv?continue=1'),
              scopes: 'openid profile email',
            },
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
      if (!token) throw new Error(t('cv.err.notLoggedIn'))
      const fd = new FormData()
      fd.append('type', 'resume')
      fd.append('file', fileToUpload)
      const r = await fetch('/api/profile/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Resume-Source': 'cv' },
        body: fd,
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Upload failed')
      }
      const up = await r.json().catch(() => ({}))
      if (up.url) setResumeUrl(up.url)
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (uid) {
        await supabase.from('user_profiles').update({ hr_visible: true, job_signal: 'open' }).eq('id', uid)
      }
      // /cv 등록 이력서는 무조건 기업 오퍼용으로 공개(VTM 전송). 웹훅이 느릴 수 있어
      // 등록 완료 모달을 막지 않도록 대기하지 않고, 공개가 확정된 뒤 토스트로 알린다.
      if (token) {
        fetch('/api/profile/share-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'set', value: true }),
        })
          .then((r) => {
            if (r.ok) toast.success(L('이력서가 공개되었어요', 'Your resume is now public', 'CV của bạn đã được công khai'))
            track(r.ok ? 'cv_resume_public' : 'cv_resume_public_error', { meta: cvMeta(), page: '/cv' })
          })
          .catch(() => track('cv_resume_public_error', { meta: cvMeta(), page: '/cv' }))
      }
      if (typeof gtag === 'function') gtag('event', 'cv_register', { source: 'ad-landing' })
      if (typeof fbq === 'function') {
        fbq('trackCustom', 'CVRegister', { source: 'ad-landing' })
        // 표준 이벤트 병행 발사 — MT-lead 캠페인은 커스텀 이벤트로는 최적화 신호를 못 받아
        // 실제 등록 9건이 Meta 리드 1건으로 잡혔다 (2026-08-23). CVReg 캠페인의 최적화
        // 이벤트를 CompleteRegistration 으로 바꾸면 Meta 가 실제 등록 기준으로 배분한다.
        fbq('track', 'CompleteRegistration', { content_name: 'cv_register', source: 'ad-landing' })
      }
      track('cv_register_success', { meta: { ...cvMeta(), ...fileMeta(fileToUpload) }, page: '/cv' })
      await idbClearCv()
      setStatus('success')
      setShowJobModal(true)
    } catch (e) {
      const msg = e.message || t('cv.err.generic')
      track('cv_register_error', { meta: { ...cvMeta(), ...fileMeta(fileToUpload), error_message: msg }, page: '/cv' })
      setErrMsg(msg)
      setStatus('error')
    }
  }

  // 완료 모달에 띄울 공고 3개. 직무 선택을 없앴으므로 개인화 대신 ATS(기업 직접등록)
  // 우선 → 누적 지원 수 많은 순(지원 전환이 잘 되는 공고)으로 고른다. 같은 회사가
  // 목록을 차지하지 않게 회사당 1개.
  const modalJobs = useMemo(() => {
    const seenCompany = new Set()
    return jobs
      .slice()
      .sort((a, b) => (a.source === 'company_self' ? 0 : 1) - (b.source === 'company_self' ? 0 : 1)
        || (b.application_count || 0) - (a.application_count || 0))
      .filter((j) => { if (seenCompany.has(j.company)) return false; seenCompany.add(j.company); return true })
      .slice(0, 3)
  }, [jobs])

  const moreJobsHref = '/jobs'

  // 파일 피커가 열리는 지점은 드롭존과 STEP2 CTA 두 곳인데 드롭존에만 계측이 없었다.
  // 그래서 "피커 열림"이 "파일 선택"보다 작게 집계돼(퍼널 3단계 < 4단계) 첨부 직전
  // 이탈 — PDF 미보유 —을 셀 수가 없었다. 두 경로를 한 이벤트로 묶고 via 로 가른다.
  const openPicker = (via) => {
    track('cv_open_picker', { meta: { ...cvMeta(), via }, page: '/cv' })
    fileRef.current?.click()
  }

  // 가입 선행 변이의 CTA 는 "가입"이지 "첨부"가 아니다 — 파일이 없어도 피커를 열지
  // 않고 곧장 OAuth 로 보낸다. 대조군에서만 파일 먼저 고르게 하는 기존 동작을 쓴다.
  const pickBeforeAuth = !file && !(signupFirst && !user)

  const onSubmit = async () => {
    if (pickBeforeAuth) {
      // remember CTA intent so handleFile auto-progresses to OAuth after pick (미로그인일 때만)
      if (!user) oauthAfterPick.current = 'google'
      track('cv_click_cta', { meta: { ...cvMeta(), provider: 'google', has_file: false }, page: '/cv' })
      openPicker('cta_google')
      return
    }
    if (!user) {
      localStorage.setItem('fyi_login_return', '/cv?continue=1')
      localStorage.setItem('fyi_intent', 'cv_signup')
      await track('cv_oauth_start', { meta: { ...cvMeta(), provider: 'google', has_file: !!file, auto: false }, page: '/cv' })
      window.location.href = '/api/auth/google?return=' + encodeURIComponent('/cv?continue=1')
      return
    }
    await doUpload(file)
  }

  const onLinkedInSubmit = async () => {
    if (pickBeforeAuth) {
      oauthAfterPick.current = 'linkedin'
      track('cv_click_cta', { meta: { ...cvMeta(), provider: 'linkedin', has_file: false }, page: '/cv' })
      openPicker('cta_linkedin')
      return
    }
    if (user) { await doUpload(file); return }
    localStorage.setItem('fyi_login_return', '/cv?continue=1')
    localStorage.setItem('fyi_intent', 'cv_signup')
    await track('cv_oauth_start', { meta: { ...cvMeta(), provider: 'linkedin', has_file: !!file, auto: false }, page: '/cv' })
    await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: window.location.origin + '/auth/callback?intent=cv_signup&return=' + encodeURIComponent('/cv?continue=1'),
        scopes: 'openid profile email',
      }
    })
  }

  /* 직접입력 저장 — 새 API 가 필요 없다. /api/profile/talent PUT 이 position·yoe_months·
     english_cert·korean_cert·hr_visible 를 이미 화이트리스트에 갖고 있다.
     is_resume_public 은 켜지 않는다: 파일 이력서가 없는 프로필이라 기업이 직접 보는
     공개 인재풀 품질 기준을 못 넘는다. 우리 영업·추천(hr_visible)에서만 쓴다. */
  const saveManual = async () => {
    if (!manual.position || !manual.yoe_months) return
    setManualStatus('saving')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error(t('cv.err.notLoggedIn'))
      const certs = certRowsToProfile(certRows)
      const r = await fetch('/api/profile/talent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          position: manual.position,
          yoe_months: parseInt(manual.yoe_months, 10),
          ...certs,
          hr_visible: true,
          job_signal: 'open',
        }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'save failed')
      track('cv_manual_success', {
        meta: { ...cvMeta(), position: manual.position, yoe_months: manual.yoe_months,
          cert_count: certRows.filter((c) => c.cert && String(c.score).trim()).length },
        page: '/cv',
      })
      setManualStatus('saved')
    } catch (e) {
      track('cv_manual_error', { meta: { ...cvMeta(), error_message: e.message }, page: '/cv' })
      setManualStatus('error')
    }
  }

  // STEP 블록의 잠금·완료 판정. JSX 자체는 return 트리 안에 둬야 styled-jsx 가
  // 스코프 클래스를 붙인다 — 변수로 빼면 .cv-stepblock 스타일이 통째로 날아간다.
  // 그래서 순서 교체는 DOM 이 아니라 CSS order 로 한다(.cv-stepwrap.sf).
  // 탭 순서는 DOM 을 따르지만, 가입 선행에서 먼저 오는 드롭존은 disabled 라
  // 포커스를 안 받는다 — 결국 첫 포커스는 화면상 첫 요소인 가입 버튼이다.
  const resumeLocked = signupFirst && !user
  const authLocked = !signupFirst && !file
  // 로그인이 끝났으면 이 칸에 남은 할 일이 없다 — 변이와 무관하게 완료로 접는다.
  const authDone = !!user

  const scrollToForm = () => (formCardRef.current || formAnchorRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // 히어로 CTA가 실제로 일을 하는지 재려면 "버튼을 눌렀다"만으로는 부족하다 —
  // 버튼 없이도 폼까지 내려오는 사람이 얼마인지가 비교군이다. 그래서 도달 자체를
  // cv_form_view 로 한 번 찍고, 어떻게 왔는지를 via 로 구분한다.
  //   hero       = 히어로 '바로 등록하기'
  //   scrolldown = 하단 스크롤다운 버튼
  //   scroll     = 아무것도 안 누르고 직접 스크롤
  const arrivedVia = useRef('scroll')
  const formViewTracked = useRef(false)
  const cvViewAt = useRef(typeof performance !== 'undefined' ? performance.now() : 0)

  useEffect(() => {
    const update = () => {
      const formTop = formAnchorRef.current?.getBoundingClientRect().top ?? Infinity
      // 히어로 CTA 아랫면이 화면 위로 넘어갔는가 — 아직 보이면 하단 바는 중복이다.
      const heroBottom = heroCtaRef.current?.getBoundingClientRect().bottom ?? Infinity
      setShowScrollDown(heroBottom < 0 && formTop >= window.innerHeight * 0.5)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  /* 폼에 닿지 못한 절반이 아예 안 내려간 건지, 내려가다 만 건지 구분한다 —
     둘은 처방이 반대다(거리·신호를 고칠 것인가, 중간 콘텐츠를 고칠 것인가).
     cv_form_view 는 도달한 사람만 찍히므로 이탈한 쪽을 볼 지표가 없었다.
     변이가 확정된 뒤에만 쏜다 — cv_view 와 같은 이유로 분모가 갈려야 한다. */
  useEffect(() => {
    if (!variantReady) return
    const MARKS = [25, 50, 75, 100]
    const fired = new Set()
    let raf = 0
    const check = () => {
      raf = 0
      // 문서가 뷰포트보다 짧으면(완료 화면 등) 비율 자체가 성립하지 않는다.
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = Math.min(100, Math.round((window.scrollY / max) * 100))
      for (const m of MARKS) {
        if (pct < m || fired.has(m)) continue
        fired.add(m)
        track('cv_scroll_depth', {
          meta: {
            ...cvMeta(),
            pct: m,
            ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - cvViewAt.current),
          },
          page: '/cv',
        })
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [variantReady])

  // 등록 폼이 화면에 들어온 순간 1회. 완료·기등록 화면은 등록 폼이 아니라서 제외한다.
  //
  // isIntersecting 은 1px 만 겹쳐도 true 고 threshold 와 무관하다 — threshold 는 콜백을
  // 언제 부를지만 정하고, observe 직후 초기 콜백은 무조건 한 번 온다. 폼은 히어로(78vh)와
  // cv-how 아래라 최상단에서는 절대 안 보이는데, 이미지가 자리를 잡기 전 레이아웃에서는
  // 위로 올라와 있어 그 초기 콜백이 그대로 통과했다(관측된 cv_view→cv_form_view 최단 24ms).
  // 그래서 ① 스크롤이 일어났는지 ② 폼 윗면이 화면 안으로 들어왔는지 둘 다 본다.
  //
  // 그런데 이 가드가 삼킨 게 초기 오발만이 아니었다. threshold:0 은 "교차 중" 상태가
  // 유지되는 한 콜백을 다시 주지 않는다 — 마운트 직후 오발 콜백이 scrollY 가드에 걸려
  // 버려지고 폼이 계속 교차 상태로 남으면, 히어로 CTA 로 폼까지 내려가 도달해도 이벤트가
  // 영영 안 찍힌다. 실제로 파일을 첨부한 205명 중 126명(85명은 히어로 CTA 클릭 기록까지
  // 있다)이 cv_form_view 없이 첨부했다. 같은 판정을 스크롤에서도 돌려 회수한다.
  useEffect(() => {
    const el = formCardRef.current
    if (!el || showSuccess || existingResume) return
    // ratio 로 재면 폼이 뷰포트보다 훨씬 길 때 기준을 영영 못 넘는다. 높이와 무관하게
    // "폼 윗면이 화면 안으로 들어왔는가"로 본다. bottom > 0 이 isIntersecting 을 대신한다.
    const reached = () => {
      if (formViewTracked.current) return false
      // 도달은 언제나 스크롤을 동반한다 — 최상단에서 들어온 신호는 레이아웃 오발이다.
      if (window.scrollY < window.innerHeight * 0.5) return false
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < window.innerHeight * 0.75
    }
    let raf = 0
    let io = null
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; fire() })
    }
    const cleanup = () => {
      io?.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    const fire = () => {
      if (!reached()) return
      formViewTracked.current = true
      // 판정을 나중에 다시 검산할 수 있게 근거를 같이 남긴다 — via 만 있으면 이번처럼
      // 오발이 섞였을 때 걸러낼 방법이 없다.
      track('cv_form_view', {
        meta: {
          ...cvMeta(),
          via: arrivedVia.current,
          ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - cvViewAt.current),
          depth: Math.round(window.scrollY),
        },
        page: '/cv',
      })
      cleanup()
    }
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(fire, { threshold: 0 })
      io.observe(el)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return cleanup
  }, [showSuccess, existingResume])

  // 카드를 한 장씩 거쳐 내려가던 동작을 폼 직행으로 바꾼다 — 모바일 축소로 카드
  // 세 장이 1,404px → 380px 이 되어 한 화면에 다 들어오므로 단계별 이동이 의미가 없다.
  // style 을 meta 에 남겨 교체 전후(icon/bar)를 같은 이벤트 안에서 가른다.
  const onStickyClick = () => {
    track('cv_scrolldown_click', { meta: { ...cvMeta(), style: 'bar' }, page: '/cv' })
    arrivedVia.current = 'scrolldown'
    scrollToForm()
  }

  return (
    <>
      <Head>
        <title>{t('cv.meta.title')}</title>
        <meta name="description" content={t('cv.meta.description')} />
      </Head>

      <main className="cv-page">
        {/* ───── HERO (center-aligned, black bg, white text) ───── */}
        <section className="cv-hero">
          <div className="cv-hero-bg" aria-hidden />
          <div className="cv-hero-inner">
            <h1 className="cv-h1">
              <span className="cv-h1-line cv-h1-soft">
                {t('cv.hero.line1Pre')}
                <img src="/fyi-logo.png" alt="FYI" className="cv-h1-logo" />
                <span>{t('cv.hero.line1Post')}</span>
              </span>
              {/* data-text 는 ::after 가 같은 글자를 겹쳐 그려 광택 밴드를 입히는 데 쓴다 */}
              <span className="cv-h1-line cv-h1-hero"><em data-text="1,000,000 VND">1,000,000 VND</em>{t('cv.hero.line2.suffix')}</span>
            </h1>
            <div className="cv-banknote-showcase" aria-hidden>
              <img src="/cv/banknote-prize-v2.png" alt="" className="cv-banknote-img" />
            </div>
            {/* 히어로 CTA — 스크롤 없이 첫 화면에서 바로 등록 폼으로 */}
            <div className="cv-hero-cta" ref={heroCtaRef}>
              <button
                type="button"
                className="cv-btn cv-btn-hero"
                onClick={() => {
                  track('cv_click_hero_cta', { meta: cvMeta(), page: '/cv' })
                  arrivedVia.current = 'hero'
                  scrollToForm()
                }}
              >
                {t('cv.sticky.cta')} <IconArrowRight />
              </button>
            </div>

            {/* 축하금 지급 조건 — 금액 바로 아래가 조건이 붙을 자리 */}
            <p className="cv-hero-note">{t('cv.how.notice')}</p>
          </div>
        </section>

        {/* ───── HOW IT WORKS ───── */}
        <section className="cv-how">
          <div className="cv-section-inner">
            <h2 className="cv-h2">{t('cv.how.heading')}</h2>

            <div className="cv-flow" aria-label="FYI resume reward flow">
              <article className="cv-flow-card">
                <div className="cv-flow-image">
                  <img src="/cv/flow-step-1.png" alt="STEP 1. CV upload" />
                </div>
                <div className="cv-flow-copy">
                  <h3>{t('cv.how.step1.title')}</h3>
                  <p>{t('cv.how.step1.desc')}</p>
                </div>
              </article>

              <div className="cv-flow-arrow" aria-hidden>→</div>

              <article className="cv-flow-card">
                <div className="cv-flow-image">
                  <img src="/cv/flow-step-2.png" alt="STEP 2. FYI match" />
                </div>
                <div className="cv-flow-copy">
                  <h3>{t('cv.how.step2.title')}</h3>
                  <p>{t('cv.how.step2.desc')}</p>
                </div>
              </article>

              <div className="cv-flow-arrow" aria-hidden>→</div>

              <article className="cv-flow-card">
                <div className="cv-flow-image">
                  <img src="/cv/flow-step-3.png" alt="STEP 3. Hired and reward received" />
                </div>
                <div className="cv-flow-copy">
                  <h3>{t('cv.how.step3.title')}</h3>
                  <p>{t('cv.how.step3.desc')}</p>
                </div>
              </article>
            </div>

            <div className="cv-steps" hidden>
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
                <div className="cv-step-title">{t('cv.how.step1.title')}</div>
                <div className="cv-step-desc">{t('cv.how.step1.desc')}</div>
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
                <div className="cv-step-title">{t('cv.how.step2.title')}</div>
                <div className="cv-step-desc">{t('cv.how.step2.desc')}</div>
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
                <div className="cv-step-title">{t('cv.how.step3.title')}</div>
                <div className="cv-step-desc">{t('cv.how.step3.desc')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── FORM ───── */}
        <section className="cv-form-section" id="cv-form" ref={formAnchorRef}>
          <div className="cv-section-inner cv-form-wrap" ref={formCardRef}>
            {/* 파일 input은 분기 밖에 — 등록됨 화면의 "교체" 버튼에서도 쓴다 */}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf" hidden onClick={(e) => { e.currentTarget.value = '' }} onChange={(e) => handleFile(e.target.files?.[0])} />
            {showSuccess ? (
              <div className="cv-card cv-success-card">
                <div className="cv-success-visual" aria-label="FYI celebration">
                  <img
                    className="cv-success-celebration"
                    src="/cv-fyi-celebration.png"
                    alt=""
                  />
                </div>
                <h3 className="cv-card-h cv-success-h">{t('cv.success.heading')}</h3>
                <div className="cv-journey">
                  <div className="cv-journey-goal-line">
                    <span className="cv-journey-goal-side">{t('cv.success.goalPre')}</span>
                    <span className="cv-journey-goal">{t('cv.success.rewardTitle')}</span>
                    <span className="cv-journey-goal-side">{t('cv.success.goalPost')}</span>
                  </div>
                  <div className="cv-journey-disclaimer">{t('cv.success.rewardSub')}</div>
                  <div className={`cv-stepper${stepReached ? ' is-step1' : ''}`} style={{ '--cv-stepper-fill-ms': STEP1_FILL_MS + 'ms' }}>
                    <div className="cv-stepper-track">
                      <div className="cv-stepper-fill" />
                    </div>
                    <div className="cv-stepper-nodes">
                      {[
                        { k: 'step1', label: stepReached ? t('cv.success.step1Done') : t('cv.success.step1'), done: stepReached, goal: false },
                        { k: 'step2', label: t('cv.success.step2'), done: false, goal: false },
                        { k: 'step4', label: t('cv.success.step4'), done: false, goal: true },
                      ].map((s, i) => (
                        <div key={s.k} className={`cv-stepnode${s.done ? ' done' : ''}${s.goal ? ' goal' : ''}`}>
                          <div className="cv-stepnode-dot">{s.done ? '✓' : i + 1}</div>
                          <div className="cv-stepnode-label">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="cv-success-next">
                  <b>{t('cv.success.nextTitle')}</b>
                  <span>{t('cv.success.nextBody')}</span>
                </div>
                <a href="/jobs" className="cv-btn cv-success-cta">{t('cv.success.cta')} <IconArrowRight /></a>
              </div>
            ) : existingResume && status === 'idle' && router.query.continue !== '1' ? (
              <div className="cv-card cv-success-card">
                <h3 className="cv-card-h cv-success-h">{L('이미 이력서가 등록되어 있어요', 'Your resume is already registered', 'CV của bạn đã được đăng ký')}</h3>
                <p className="cv-card-sub">{L('등록된 이력서로 바로 지원할 수 있어요. 최신 버전이 아니라면 새 파일로 교체하세요.', 'You can apply to jobs with the resume on file. Replace it if you have a newer version.', 'Bạn có thể ứng tuyển ngay với CV đã đăng ký. Thay file mới nếu bạn có bản mới hơn.')}</p>
                {errMsg && <div className="cv-err">{errMsg}</div>}
                <a href="/jobs" className="cv-btn cv-success-cta">{t('cv.success.cta')} <IconArrowRight /></a>
                <button
                  type="button"
                  className="cv-registered-replace"
                  onClick={() => { replacePick.current = true; fileRef.current?.click() }}
                >
                  {L('다른 파일로 교체하기', 'Replace with a new file', 'Thay bằng file khác')}
                </button>
              </div>
            ) : status === 'uploading' && (router.query.continue === '1' || replacing) ? (
              <div className="cv-card cv-interstitial">
                <div className="cv-spinner" />
                <div className="cv-card-step-pill">{t('cv.interstitial.pill')}</div>
                <h3 className="cv-card-h">{t('cv.interstitial.headingPrefix')}<br/><em>{t('cv.interstitial.headingEm')}</em></h3>
                <p className="cv-card-sub">{t('cv.interstitial.sub')}</p>
                {file && (
                  <div className="cv-file">
                    <div className="cv-file-info">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div className="cv-file-meta">
                        <div className="cv-file-name">{file.name}</div>
                        <div className="cv-file-size">{(file.size / 1024 / 1024).toFixed(1)} {t('cv.interstitial.uploadingTag')}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="cv-card">
                <h3 className="cv-card-h">{t('cv.form.card.headingPrefix')}<em>{t('cv.form.card.headingAction')}</em></h3>
                {/* 로그인한 사람에게 남은 단계는 첨부 하나뿐이라 '두 단계'가 거짓이 된다. */}
                <p className="cv-card-sub">{t(user ? 'cv.form.card.subAuthed' : 'cv.form.card.sub')}</p>

                {pendingHint && (
                  <div className="cv-ai-bubble">
                    <div className="cv-ai-bubble-inner">
                      <span className="cv-ai-bubble-icon"><IconCheck /></span>
                      <span>{t('cv.form.pendingPrefix')}<b>{pendingHint}</b>{t('cv.form.pendingSuffix')}</span>
                    </div>
                  </div>
                )}

                {/* ─── 두 STEP 블록 — 변이에 따라 순서와 잠금 대상만 바뀐다 ───
                    대조군   : 1 이력서 첨부(열림) → 2 가입(파일 없으면 잠김)
                    가입선행 : 1 가입(열림)        → 2 이력서 첨부(가입 전엔 잠김) */}
                <div className={`cv-stepwrap ${signupFirst ? 'sf' : ''}`}>
      <div key="resume" className={`cv-stepblock ${file ? 'done' : ''} ${resumeLocked ? 'inactive' : ''}`}>
        <div className="cv-stepblock-label">
          <span className="cv-stepblock-num">{file ? <IconCheck /> : (signupFirst ? 2 : 1)}</span>
          {signupFirst ? t('cv.form.sf.step2Label') : t('cv.form.step1Label')}
        </div>
        {/* 가입 선행에서는 업로드가 파일 선택 즉시 일어나므로 오류도 이 블록에 붙는다. */}
        {signupFirst && errMsg && <div className="cv-err">{errMsg}</div>}
        {/* 파일 / 직접입력 두 경로. 가입 선행 변이에서만, 그리고 로그인 뒤에만 뜬다 —
            직접입력은 저장할 계정이 있어야 성립하고, 대조군은 그대로 둬야 A/B 가 깨끗하다. */}
        {signupFirst && user && manualStatus !== 'saved' && (
          <div className="cv-modetabs">
            <button
              type="button"
              className={`cv-modetab ${!manualMode ? 'on' : ''}`}
              onClick={() => setManualMode(false)}
            >{t('cv.form.sf.tab.file')}</button>
            <button
              type="button"
              className={`cv-modetab ${manualMode ? 'on' : ''}`}
              onClick={() => {
                setManualMode(true)
                track('cv_manual_open', { meta: cvMeta(), page: '/cv' })
              }}
            >{t('cv.form.sf.tab.manual')}</button>
          </div>
        )}

        {/* 잠긴 동안에는 드롭존을 아예 걷어낸다 — 못 누르는 입력란을 보여주는 것보다
            "가입하면 열린다" 한 줄만 남기는 편이 다음 행동이 분명해진다. */}
        {resumeLocked ? null : manualMode ? (
          manualStatus === 'saved' ? (
            /* 완료 화면(컨페티)을 주지 않는다 — 여기서 "다 했다"고 믿으면 이력서를
               영영 안 올리고, 등록 유도 콜드메일도 뜬금없어진다. 다음 할 일을 남긴다. */
            <div className="cv-manual-done">
              <span className="cv-promise-check"><IconCheck /></span>
              <div>
                <b>{t('cv.form.sf.manual.saved')}</b>
                <br />{t('cv.form.sf.manual.savedHint')}
              </div>
            </div>
          ) : (
            <div className="cv-manual">
              <label className="cv-manual-label" htmlFor="cv-role-group">{t('cv.form.sf.manual.role')}</label>
              <div className="cv-manual-two">
                <select
                  id="cv-role-group"
                  className="cv-select"
                  value={manualGroup}
                  onChange={(e) => { setManualGroup(e.target.value); setManualField('position', '') }}
                >
                  <option value="">{t('cv.form.sf.manual.roleGroupPh')}</option>
                  {roleGroupsFor(lang).map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                <select
                  className="cv-select"
                  value={manual.position}
                  disabled={!manualGroup}
                  onChange={(e) => setManualField('position', e.target.value)}
                >
                  <option value="">{t('cv.form.sf.manual.rolePh')}</option>
                  {rolesInGroup(manualGroup, lang).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <label className="cv-manual-label" htmlFor="cv-yoe">{t('cv.form.sf.manual.yoe')}</label>
              <select
                id="cv-yoe"
                className="cv-select"
                value={manual.yoe_months}
                onChange={(e) => setManualField('yoe_months', e.target.value)}
              >
                <option value="">{t('cv.form.sf.manual.yoePh')}</option>
                {YOE_CHOICES.map((o) => <option key={o.value} value={o.value}>{L(o.ko, o.en, o.vi)}</option>)}
              </select>

              {/* 어학은 선택 항목이라 빈 줄로 시작한다 — 안 채우면 그냥 안 저장된다. */}
              <label className="cv-manual-label">
                {t('cv.form.sf.manual.lang')}
                <span className="cv-manual-opt">{t('cv.form.sf.manual.optional')}</span>
              </label>
              {certRows.map((row, i) => (
                <div className="cv-certrow" key={i}>
                  <select
                    className="cv-select"
                    value={row.cert}
                    onChange={(e) => setCertRow(i, { cert: e.target.value })}
                  >
                    <option value="">{t('cv.form.sf.manual.certPh')}</option>
                    {CERT_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    className="cv-input"
                    type="text"
                    inputMode="text"
                    value={row.score}
                    placeholder={CERT_SCORE_PH[row.cert] || t('cv.form.sf.manual.scorePh')}
                    onChange={(e) => setCertRow(i, { score: e.target.value })}
                    aria-label={t('cv.form.sf.manual.scorePh')}
                  />
                  <button
                    type="button"
                    className="cv-certdel"
                    onClick={() => setCertRows((rows) => (rows.length > 1 ? rows.filter((_, n) => n !== i) : [{ cert: '', score: '' }]))}
                    aria-label={t('cv.form.sf.manual.certRemove')}
                  >&times;</button>
                </div>
              ))}
              <button
                type="button"
                className="cv-certadd"
                onClick={() => setCertRows((rows) => [...rows, { cert: '', score: '' }])}
              >+ {t('cv.form.sf.manual.certAdd')}</button>

              {manualStatus === 'error' && <div className="cv-err">{t('cv.form.sf.manual.err')}</div>}

              <button
                className="cv-btn"
                onClick={saveManual}
                disabled={!manual.position || !manual.yoe_months || manualStatus === 'saving'}
              >
                {manualStatus === 'saving' ? t('cv.form.uploading') : <>{t('cv.form.sf.manual.save')} <IconArrowRight /></>}
              </button>
            </div>
          )
        ) : file ? (
          <div className="cv-file">
            <div className="cv-file-info">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div className="cv-file-meta">
                <div className="cv-file-name">{file.name}</div>
                <div className="cv-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
            </div>
            <button type="button" className="cv-change" onClick={() => fileRef.current?.click()} disabled={status === 'uploading'}>{t('cv.form.changeFile')}</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openPicker('dropzone')}
            className="cv-drop"
            disabled={resumeLocked || status === 'uploading'}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag') }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('drag')
              if (resumeLocked) return
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>{status === 'uploading' ? t('cv.form.uploading') : t('cv.form.dropZone')}</span>
          </button>
        )}
        {/* 잠금 안내는 가운데가 아니라 왼쪽 — 가운데 정렬은 드롭존 밑에 붙는 파일 규격
            안내용이고, 드롭존이 사라진 자리에서는 라벨 시작선에 맞아야 읽힌다. */}
        {/* 파일 규격 안내는 파일 경로에서만 뜻이 있다 — 직접입력 중에는 걷어낸다. */}
        {!manualMode && (
          <div className={`cv-hint ${resumeLocked ? 'cv-hint-locked' : ''}`}>
            {resumeLocked ? t('cv.form.sf.locked') : t('cv.form.fileHint')}
          </div>
        )}
      </div>

      <div key="auth" className={`cv-stepblock cv-step-auth ${authDone ? 'done' : ''} ${authLocked ? 'inactive' : ''}`}>
        <div className="cv-stepblock-label">
          <span className="cv-stepblock-num">{authDone ? <IconCheck /> : (signupFirst ? 1 : 2)}</span>
          {signupFirst
            ? t('cv.form.sf.step1Label')
            : (user ? t('cv.form.step2LabelRegister') : t('cv.form.step2LabelSignup'))}
        </div>

        {!signupFirst && errMsg && <div className="cv-err">{errMsg}</div>}

        {!authDone && (
          <>
            <button className="cv-btn" onClick={onSubmit} disabled={status === 'uploading'}>
              {status === 'uploading' ? t('cv.form.uploading') :
                user ? <>{t('cv.form.cta.register')} <IconArrowRight /></> :
                <><IconGoogle />{t('cv.form.cta.google')} <IconArrowRight /></>}
            </button>

            {!user && (
              <>
                <div className="cv-or-divider"><span>{t('cv.form.or')}</span></div>
                <button className="cv-btn-linkedin" onClick={onLinkedInSubmit}>
                  <IconLinkedIn />{t('cv.form.cta.linkedin')}
                </button>
              </>
            )}
          </>
        )}
      </div>
                </div>

                {/* ─── Reassurance footer — 미인증일 때만 ───
                    대조군은 "두 단계가 한 번에 자동 처리"를 약속하지만, 가입 선행에서는
                    두 단계가 차례로 일어나므로 그 문장이 거짓이 된다. 대신 "가입은 금방
                    끝나고 이력서가 바로 이어진다"로 바꿔 순서를 뒤집은 이유에 답한다. */}
                {!user && (
                  <div className="cv-promise">
                    <span className="cv-promise-check"><IconCheck /></span>
                    <div>
                      {t(signupFirst ? 'cv.form.sf.promise.line1' : 'cv.form.promise.line1')}
                      <br/>
                      <b>{t(signupFirst ? 'cv.form.sf.promise.line2Prefix' : 'cv.form.promise.line2Prefix')}</b>
                      {t(signupFirst ? 'cv.form.sf.promise.line2Suffix' : 'cv.form.promise.line2Suffix')}
                    </div>
                  </div>
                )}

                <div className="cv-fine">
                  {t('cv.form.fine.body')}
                  <br/>
                  <a href="/terms">{t('cv.form.fine.terms')}</a> · <a href="/privacy">{t('cv.form.fine.privacy')}</a>
                </div>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* 하단 고정 CTA — 아이콘만 있던 44px 원형 화살표는 무엇을 하는 버튼인지 말하지
          않아 813명 중 3명(0.4%)만 눌렀다. 히어로에서 21.3% 가 누르는 같은 문구를 달고
          같은 목적지로 보낸다. 히어로 CTA 가 화면 위로 사라진 뒤부터 폼이 화면에 들어오기
          전까지만 띄운다 — 히어로가 보이는 동안은 같은 버튼이 두 개고, 폼에 닿으면 더
          필요 없다. 스크롤한다고 숨기지는 않는다(showScrollDown). */}
      {showScrollDown && (
        <div className="cv-sticky">
          <button type="button" className="cv-btn cv-btn-sticky" onClick={onStickyClick}>
            {t('cv.sticky.cta')} <IconArrowRight />
          </button>
        </div>
      )}

      {/* 등록 완료 → 방금 올린 이력서로 맞는 공고 바로 지원 (원탭) */}
      {showJobModal && modalJobs.length > 0 && (
        <div className="cvm-overlay" onClick={() => setShowJobModal(false)}>
          <div className="cvm" onClick={(e) => e.stopPropagation()}>
            <button className="cvm-close" onClick={() => setShowJobModal(false)} aria-label="close">×</button>
            <div className="cvm-head">
              <div className="cvm-title">{L('이력서 등록 완료! 바로 지원해보세요', 'Resume saved — apply in one tap', 'Đã lưu CV — ứng tuyển ngay')}</div>
              <div className="cvm-sub">{L('방금 올린 이력서로 한 번에 지원됩니다', 'We apply with the resume you just uploaded', 'Ứng tuyển bằng CV bạn vừa tải lên')}</div>
            </div>
            <QuickApplyJobList
              jobs={modalJobs}
              page="/cv"
              source="cv_success"
              resumeUrl={resumeUrl}
              moreHref={moreJobsHref}
            />
          </div>
        </div>
      )}

      <style jsx global>{`
        .tabular-nums { font-variant-numeric: tabular-nums lining-nums; }
      `}</style>

      <style jsx>{`
        /* 완료 모달 — 바로 지원 */
        .cvm-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(20,16,12,0.55); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .cvm { position: relative; width: 100%; max-width: 440px; background: #fff; border-radius: 20px; padding: 28px 24px 22px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .cvm-close { position: absolute; top: 14px; right: 16px; border: none; background: none; font-size: 26px; line-height: 1; color: #b5ab9d; cursor: pointer; }
        .cvm-head { margin-bottom: 18px; padding-right: 20px; }
        .cvm-title { font-size: 18px; font-weight: 800; color: #1a1612; letter-spacing: -0.01em; }
        .cvm-sub { font-size: 13px; color: #8a8073; margin-top: 5px; }
        /* 공고 행·지원 버튼·하단 링크 스타일은 QuickApplyJobList 안으로 옮겼다. */

        /* ───────────────────────────────────────
           Design tokens — warm cream system
           Base: linen #faf6f0, Cards: white, Ink: #1a1612
           Brand: #ff6000, Accent muted: #efe7d6
           ─────────────────────────────────────── */
        .cv-page {
          background: #fff;
          color: #1a1612;
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
          /* 히어로 안에 CTA 까지 한 화면에 들어와야 해서 세로 여백은 화면 높이를 따라간다 —
             노트북·웹뷰처럼 세로가 짧은 환경에서 먼저 줄어든다. */
          padding: clamp(48px, 8vh, 96px) 40px clamp(40px, 6vh, 72px);
          overflow: hidden;
          min-height: 78vh;
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
          /* 폭뿐 아니라 높이도 본다 — 와이드하지만 세로가 짧은 노트북에서 78px 은 너무 크다 */
          font-size: clamp(38px, min(5vw, 9vh), 78px);
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
          position: relative;
          display: inline-block;
        }
        /* 광택 밴드 — 같은 글자를 ::after 로 한 겹 더 깔고, 글자 모양으로 잘라낸
           밝은 그라디언트를 왼쪽에서 오른쪽으로 흘려보낸다.
           em 본체에 background-clip 을 쓰지 않는 이유: 배경은 text-shadow 보다
           아래 레이어라, 글로우에 덮여 광택이 뿌옇게 죽는다. */
        .cv-h1 em::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          white-space: nowrap;
          pointer-events: none;
          background-image: linear-gradient(
            100deg,
            rgba(255,255,255,0) 44%,
            rgba(255,245,230,0.92) 50%,
            rgba(255,255,255,0) 56%
          );
          background-size: 250% 100%;
          background-repeat: no-repeat;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: cvHeroShine 4.5s ease-in-out infinite;
        }
        /* background-position 이 커질수록 그라디언트는 왼쪽으로 간다 —
           왼→오른쪽으로 지나가게 하려면 값을 줄여야 한다.
           훑고 지나간 뒤엔 화면 밖(-20%)에서 쉬었다가 다음 주기에 다시 들어온다. */
        @keyframes cvHeroShine {
          0% { background-position: 120% 0; }
          45%, 100% { background-position: -20% 0; }
        }
        .cv-banknote-showcase {
          /* 이미지 비율이 806:648 이라 폭을 50vh 로 묶으면 높이는 약 40vh 를 넘지 않는다 */
          width: min(460px, 100%, 50vh);
          margin: 28px auto 0;
          pointer-events: none;
        }
        .cv-banknote-img {
          display: block;
          width: 100%;
          height: auto;
          filter: drop-shadow(0 38px 64px rgba(0,0,0,0.45));
          /* 글로우(3.6s)와 주기를 어긋나게 둬서 둘이 같이 뛰는 느낌이 안 나게 */
          animation: cvBanknoteFloat 7s ease-in-out infinite;
        }
        @keyframes cvBanknoteFloat {
          0%, 100% {
            transform: translateY(0);
            filter: drop-shadow(0 38px 64px rgba(0,0,0,0.45));
          }
          50% {
            transform: translateY(-12px);
            /* 떠오르면 그림자는 더 멀고 흐리게 — 안 그러면 그림 자체가 커 보인다 */
            filter: drop-shadow(0 50px 72px rgba(0,0,0,0.38));
          }
        }
        /* 애니메이션 최소화 설정을 켠 사용자에겐 정지 상태로 */
        @media (prefers-reduced-motion: reduce) {
          .cv-h1 em::after { animation: none; opacity: 0; }
          .cv-banknote-img { animation: none; }
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
        /* 지폐 에셋과 조건 문구 사이 — 폭은 버튼 자체가 auto 라 이 래퍼로 여백만 준다 */
        .cv-hero-cta {
          margin-top: clamp(18px, 3vh, 30px);
          width: 100%;
          display: flex;
          justify-content: center;
        }
        /* .cv-btn(width:100%) 이 이 파일 뒤쪽에 선언돼 있어 같은 특이도로는 밀린다 —
           클래스 두 개를 겹쳐 특이도를 올려야 width:auto 가 먹는다. */
        .cv-btn.cv-btn-hero {
          display: inline-flex;
          align-items: center;
          width: auto;
          margin-top: 0;
          padding: 16px 52px;
          font-size: 15px;
          gap: 6px;
          /* Stronger glow on dark bg */
          box-shadow:
            0 0 0 1px rgba(255,138,64,0.4),
            0 12px 28px rgba(255,96,0,0.45),
            0 0 40px rgba(255,96,0,0.25);
        }
        .cv-btn.cv-btn-hero:hover {
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
        .cv-flow {
          max-width: 1180px;
          margin: 62px auto 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr) 44px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        .cv-flow-card {
          min-width: 0;
        }
        .cv-flow-image {
          aspect-ratio: 1 / 1;
          border-radius: 28px;
          overflow: hidden;
          background: #fff8ef;
          border: 1px solid rgba(26,22,18,0.06);
          box-shadow:
            0 1px 2px rgba(26,22,18,0.05),
            0 24px 58px -22px rgba(26,22,18,0.2);
        }
        .cv-flow-image img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cv-flow-copy {
          text-align: center;
          margin-top: 18px;
          padding: 0 8px;
        }
        .cv-flow-copy h3 {
          margin: 0 0 8px;
          font-size: 20px;
          line-height: 1.28;
          font-weight: 850;
          letter-spacing: -0.45px;
          color: #1a1612;
        }
        .cv-flow-copy p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(26,22,18,0.58);
          word-break: keep-all;
        }
        .cv-flow-arrow {
          width: 44px;
          height: 44px;
          margin-top: min(13vw, 174px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid rgba(255,96,0,0.16);
          color: #ff6000;
          font-size: 24px;
          font-weight: 900;
          box-shadow: 0 14px 34px -18px rgba(255,96,0,0.4);
        }
        /* 축하금 조건 — 지폐 에셋 바로 아래. 히어로는 검정 배경이라 글자색은 흰색 계열.
           문구 안의 \n 을 살려(pre-line) 조건 두 개를 줄로 나눈다. */
        .cv-hero-note {
          max-width: 560px;
          margin: clamp(12px, 2vh, 20px) auto 0;
          text-align: center;
          font-size: 12px;
          line-height: 1.7;
          color: rgba(255,255,255,0.5);
          word-break: keep-all;
          white-space: pre-line;
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
        .cv-steps[hidden] {
          display: none !important;
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
          /* Korean/Vietnamese line breaks should respect word boundaries —
             keep-all prevents the browser from breaking mid-phrase like
             "FYI가 당신에게 / 맞는 더 좋은" and instead lands the break at
             a natural space. */
          word-break: keep-all;
          overflow-wrap: break-word;
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
          padding: 90px 24px 64px;
          scroll-margin-top: 80px;
          background: #fff;
        }
        .cv-form-wrap {
          display: flex;
          justify-content: center;
          /* 카드가 화면 꼭대기에 딱 붙지 않을 만큼의 여백. /cv 는 광고 랜딩이라
             nav 가 static 이므로 헤더를 피할 오프셋은 필요 없다. */
          scroll-margin-top: 64px;
        }
        .cv-form-wrap .cv-card {
          width: 100%;
          max-width: 720px;
          padding: 56px 52px;
          border-radius: 22px;
        }
        .cv-form-wrap .cv-card-h {
          font-size: 42px;
          letter-spacing: -1.6px;
          margin: 14px 0 18px;
        }
        .cv-form-wrap .cv-card-sub {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 32px;
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
        .cv-hint.cv-hint-locked { text-align: left; margin-top: 4px; }
        /* ── 직접입력 트랙 ── */
        .cv-modetabs {
          display: flex;
          gap: 6px;
          margin: 14px 0 16px;
          padding: 4px;
          background: rgba(26,22,18,0.05);
          border-radius: 10px;
        }
        .cv-modetab {
          flex: 1;
          padding: 8px 10px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: rgba(26,22,18,0.5);
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }
        .cv-modetab.on { background: #fff; color: #1a1612; box-shadow: 0 1px 3px rgba(26,22,18,0.1); }
        .cv-modetab:focus-visible { outline: 2px solid #ff6000; outline-offset: 2px; }
        .cv-manual { margin-top: 0; }
        .cv-manual-label {
          display: block;
          margin: 14px 0 6px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(26,22,18,0.6);
          letter-spacing: 0.2px;
        }
        .cv-manual-label:first-child { margin-top: 0; }
        .cv-manual-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cv-select {
          width: 100%;
          padding: 12px 34px 12px 12px;
          border: 1px solid rgba(26,22,18,0.14);
          border-radius: 10px;
          background: #fff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5l5-5' stroke='%231a1612' stroke-opacity='.45' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          color: #1a1612;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.3;
          appearance: none;
          -webkit-appearance: none;
        }
        .cv-select:disabled { background-color: rgba(26,22,18,0.04); color: rgba(26,22,18,0.35); }
        .cv-select:focus-visible { outline: 2px solid #ff6000; outline-offset: 1px; }
        .cv-manual-opt { font-weight: 500; color: rgba(26,22,18,0.35); letter-spacing: 0; }
        .cv-certrow {
          display: grid;
          grid-template-columns: 1fr 1fr 34px;
          gap: 8px;
          margin-bottom: 8px;
        }
        .cv-input {
          width: 100%;
          padding: 12px;
          border: 1px solid rgba(26,22,18,0.14);
          border-radius: 10px;
          background: #fff;
          color: #1a1612;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.3;
        }
        .cv-input::placeholder { color: rgba(26,22,18,0.3); }
        .cv-input:focus-visible, .cv-certdel:focus-visible, .cv-certadd:focus-visible {
          outline: 2px solid #ff6000;
          outline-offset: 1px;
        }
        .cv-certdel {
          border: 1px solid rgba(26,22,18,0.12);
          border-radius: 10px;
          background: #fff;
          color: rgba(26,22,18,0.4);
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          transition: color .15s ease, border-color .15s ease;
        }
        .cv-certdel:hover { color: #b42318; border-color: rgba(180,35,24,0.3); }
        .cv-certadd {
          margin-top: 2px;
          padding: 6px 2px;
          border: 0;
          background: transparent;
          color: #ff6000;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .cv-manual .cv-btn { margin-top: 18px; }
        .cv-manual-done {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 14px;
          padding: 14px 16px;
          background: #f0fbf3;
          border: 1px solid rgba(22,163,74,0.25);
          border-radius: 12px;
          font-size: 13px;
          color: rgba(26,22,18,0.7);
          line-height: 1.55;
        }
        .cv-manual-done b { color: #1a1612; font-weight: 700; }
        .cv-manual-done .cv-promise-check { background: #16a34a; }
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
        .cv-success-card {
          /* overflow visible so the step pill (top:-12px) and the bonus
             number's text-shadow can bleed past the card edge cleanly. */
          overflow: visible;
          padding: 42px 34px 36px;
          text-align: left;
          /* Lower the ambient orange tint — the medal and the CTA already
             carry the brand color. A near-white surface lets the gold goal
             dot stand out from step #1's orange "done" dot. */
          background:
            radial-gradient(520px circle at 50% 10%, rgba(255,96,0,0.05), transparent 58%),
            #fff;
        }
        .cv-success-visual {
          position: relative;
          z-index: 2;
          width: min(310px, 62%);
          aspect-ratio: 1821 / 864;
          margin: -10px auto 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: cvLevelPop .72s cubic-bezier(.18,.89,.32,1.28) both;
        }
        .cv-success-celebration {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          mix-blend-mode: multiply;
          -webkit-mask-image: radial-gradient(ellipse 72% 82% at 50% 52%, #000 54%, rgba(0,0,0,.78) 72%, transparent 92%);
          mask-image: radial-gradient(ellipse 72% 82% at 50% 52%, #000 54%, rgba(0,0,0,.78) 72%, transparent 92%);
          filter: drop-shadow(0 18px 34px rgba(255,96,0,0.13));
        }
        .cv-success-h,
        .cv-journey,
        .cv-success-next,
        .cv-success-cta {
          position: relative;
          z-index: 2;
        }
        .cv-success-h {
          margin-top: 0;
          text-align: center;
        }
        /* 등록됨 화면의 파일 교체 — CTA 아래 보조 액션(텍스트 버튼) */
        .cv-registered-replace {
          display: block;
          margin: 14px auto 0;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 600;
          color: #a89f92;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .cv-registered-replace:hover { color: #ff6000; }
        /* Journey card — kept near-white so the gold goal dot and the
           orange "completed" dot read as distinct accents instead of
           getting absorbed into an all-orange wash. Subtle warm tint only. */
        .cv-journey {
          margin: 18px 0 22px;
          padding: 22px 22px 18px;
          border-radius: 16px;
          text-align: center;
          background: #fbfaf7;
          border: 1px solid rgba(26,22,18,0.06);
        }
        /* Goal line: small side text on the left + hero number + small side
           text on the right, all baseline-aligned. The hero number stays
           the loudest object. Side text uses the locale's natural word
           order (ko: prefix + suffix; en/vi: prefix only). */
        .cv-journey-goal-line {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin: 4px 0 2px;
        }
        .cv-journey-goal-side {
          font-size: clamp(13px, 1.4vw, 15px);
          font-weight: 700;
          color: rgba(26,22,18,0.55);
          letter-spacing: -0.2px;
        }
        .cv-journey-goal-side:empty { display: none; }
        .cv-journey-goal {
          display: inline-block;
          font-family: 'Geist', sans-serif;
          font-weight: 900;
          font-size: clamp(32px, 5.2vw, 48px);
          letter-spacing: -1px;
          line-height: 1.2;
          font-variant-numeric: tabular-nums;
          padding: 0 2px;
          /* Solid brand orange — no gradient clipping, no comma artifacts,
             cleaner read against the near-white card surface. */
          color: #ff6000;
          animation:
            cvRewardPop .8s cubic-bezier(.18,.89,.32,1.28) both,
            cvRewardBreathe 2.6s 1.4s ease-in-out infinite;
          transform-origin: center bottom;
        }
        /* Bonus payout disclaimer — sits directly under the hero number as
           a fine-print qualifier, not a separate centered note. */
        .cv-journey-disclaimer {
          font-size: 11.5px;
          color: rgba(26,22,18,0.45);
          margin-top: 4px;
        }
        /* Stepper: track + fill behind 4 evenly-spaced step nodes. The fill
           grows from 0 to the position of node #1 in STEP1_FILL_MS, "lands"
           on it, and that instant flips node #1 to its done state + fires
           the confetti burst (see useEffect in cv.js). */
        /* Desktop: horizontal stepper. Mobile: switches to vertical via the
           media query at the bottom of this block so labels stay readable
           on narrow viewports. */
        .cv-stepper {
          position: relative;
          margin: 22px 0 6px;
          padding: 22px 0 0;
        }
        .cv-stepper-track {
          position: absolute;
          top: 38px;
          left: calc(16.66% + 4px);
          right: calc(16.66% + 4px);
          height: 6px;
          border-radius: 999px;
          background: rgba(26,22,18,0.09);
          overflow: visible;
          box-shadow: inset 0 1px 2px rgba(26,22,18,0.06);
          z-index: 0;
        }
        .cv-stepper-fill {
          position: absolute;
          left: 0;
          top: 0;
          width: 0;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #ff8a40 0%, #ff6000 50%, #d44a00 100%);
          transition: width var(--cv-stepper-fill-ms, 1100ms) cubic-bezier(.4, .0, .2, 1),
                      height var(--cv-stepper-fill-ms, 1100ms) cubic-bezier(.4, .0, .2, 1);
          box-shadow: 0 0 14px rgba(255,96,0,0.42);
        }
        /* 3-stage journey, evenly spaced — completing step #1 fills the
           first half of the bar exactly to the middle dot. */
        .cv-stepper.is-step1 .cv-stepper-fill { width: 50%; }
        /* Each step = a dot + a label, evenly distributed across 3 columns.
           In horizontal mode the track sits behind the dot row. */
        .cv-stepper-nodes {
          position: relative;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          z-index: 1;
        }
        .cv-stepnode {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
        }
        .cv-stepnode-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(26,22,18,0.18);
          color: rgba(26,22,18,0.4);
          font-family: 'Geist Mono', monospace;
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform .25s, border-color .25s, color .25s, background .25s, box-shadow .25s;
          flex-shrink: 0;
        }
        .cv-stepnode.done .cv-stepnode-dot {
          border-color: #ff8a40;
          background: #ff8a40;
          color: #fff;
          transform: scale(1.08);
          box-shadow: 0 8px 20px rgba(255,138,64,0.5), 0 0 0 6px rgba(255,138,64,0.16);
        }
        .cv-stepnode.goal .cv-stepnode-dot {
          width: 42px;
          height: 42px;
          border: none;
          background: #d44a00;
          color: #fff;
          font-size: 15px;
          box-shadow:
            0 10px 26px rgba(212,74,0,0.55),
            0 0 0 8px rgba(212,74,0,0.16);
          animation: cvGoalPulse 2.4s ease-in-out infinite;
        }
        .cv-stepnode-label {
          font-size: 13.5px;
          font-weight: 700;
          color: rgba(26,22,18,0.55);
          letter-spacing: -0.1px;
          word-break: keep-all;
          line-height: 1.3;
        }
        .cv-stepnode.done .cv-stepnode-label {
          color: #ff8a40;
          font-weight: 800;
        }
        .cv-stepnode.goal .cv-stepnode-label {
          color: #d44a00;
          font-weight: 900;
          font-size: 14.5px;
        }
        /* Mobile: rotate the stepper 90deg into a vertical list. Each step
           gets its own row (dot on the left, label on the right), the
           track becomes a vertical spine, and the fill grows downward. */
        @media (max-width: 640px) {
          .cv-stepper { padding: 6px 0 0; }
          .cv-stepper-track {
            top: 22px;
            bottom: 22px;
            left: 21px;
            right: auto;
            width: 6px;
            height: auto;
          }
          .cv-stepper-fill {
            width: 100%;
            height: 0;
          }
          .cv-stepper.is-step1 .cv-stepper-fill {
            width: 100%;
            height: 50%;
          }
          .cv-stepper-fill {
            background: linear-gradient(180deg, #ff8a40 0%, #ff6000 50%, #d44a00 100%);
          }
          .cv-stepper-nodes {
            display: flex;
            flex-direction: column;
            gap: 22px;
          }
          .cv-stepnode {
            flex-direction: row;
            align-items: center;
            gap: 16px;
            text-align: left;
          }
          .cv-stepnode-dot {
            width: 32px;
            height: 32px;
          }
          .cv-stepnode.goal .cv-stepnode-dot {
            width: 38px;
            height: 38px;
            margin-left: -3px;
          }
          .cv-stepnode-label {
            font-size: 14.5px;
            text-align: left;
            white-space: normal;
          }
          .cv-stepnode.goal .cv-stepnode-label {
            font-size: 15.5px;
          }
        }
        .cv-success-next {
          margin: 20px 0 24px;
          padding: 16px 18px;
          border-radius: 14px;
          background: #fafaf7;
          border: 1px solid rgba(26,22,18,0.07);
          color: rgba(26,22,18,0.62);
          line-height: 1.62;
          font-size: 14px;
        }
        .cv-success-next b {
          display: block;
          color: #1a1612;
          font-size: 14.5px;
          margin-bottom: 4px;
        }
        /* DOM-based fireworks/confetti removed — viewport-wide single-shot
           burst now handled by canvas-confetti (see useEffect in cv.js). */
        @keyframes cvLevelPop {
          0% { transform: scale(.72); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cvProgressGrow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes cvProgressShine {
          0% { transform: translateX(-110%); }
          55%, 100% { transform: translateX(120%); }
        }
        @keyframes cvDotPop {
          to { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes cvRewardPop {
          0%   { transform: scale(.4) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.08) translateY(0);  opacity: 1; }
          100% { transform: scale(1) translateY(0);     opacity: 1; }
        }
        @keyframes cvRewardBreathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.02); }
        }
        @keyframes cvGoalPulse {
          0%, 100% { box-shadow: 0 10px 26px rgba(212,74,0,0.55), 0 0 0 8px  rgba(212,74,0,0.16); }
          50%      { box-shadow: 0 12px 32px rgba(212,74,0,0.68), 0 0 0 18px rgba(212,74,0,0.05); }
        }
        @keyframes cvDotPulse {
          0%, 100% { box-shadow: 0 12px 28px rgba(255,96,0,0.45), 0 0 0 6px rgba(255,96,0,0.15); }
          50%      { box-shadow: 0 12px 28px rgba(255,96,0,0.55), 0 0 0 14px rgba(255,96,0,0.05); }
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
        /* 가입 선행 변이의 STEP 순서 교체 — DOM 은 이력서→가입 그대로 두고 시각 순서만
           뒤집는다. JSX 를 변수로 빼면 styled-jsx 스코프 클래스가 안 붙어 .cv-stepblock
           스타일이 통째로 날아가므로, DOM 재배치 대신 order 를 쓴다. */
        .cv-stepwrap {
          display: flex;
          flex-direction: column;
        }
        .cv-stepwrap.sf .cv-step-auth {
          order: -1;
        }
        /* 가입이 끝난 STEP 은 라벨 한 줄만 남는데, 라벨 아래 여백(12px)과 블록 하단
           패딩(20px)이 그대로 남아 아래가 텅 빈 상자로 보인다. 라벨 높이에 맞춰 조인다.
           .done 은 파일을 붙인 이력서 블록에도 붙으므로 auth 블록으로 한정한다. */
        .cv-stepblock.done.cv-step-auth { padding-top: 16px; padding-bottom: 16px; }
        .cv-stepblock.done.cv-step-auth .cv-stepblock-label { margin-bottom: 0; }
        /* Step block — visual chunking inside form card */
        .cv-stepblock {
          margin-top: 18px;
          padding: 18px 18px 20px;
          background: #fafaf7;
          border: 1px solid rgba(26,22,18,0.07);
          border-radius: 14px;
          transition: border-color .15s ease, background .15s ease, opacity .15s ease;
        }
        /* 파일 첨부 시 num 배지만 체크(초록)로. 블록 전체를 초록 틴트하면 아직 안 고른
           직무선택까지 완료된 것처럼 보여 어색해서 배경/테두리는 그대로 둔다. */
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
          /* 숫자가 원 안에서 위로 떠 보이던 문제. 상속 line-height(1.55)로 line box 가
             글자보다 커진 데다, 숫자는 디센더가 없어 남는 아래 여백만큼 시각 중심이
             올라간다. line box 를 글자 크기에 맞추고 1px 내려 광학 중심을 맞춘다. */
          line-height: 1;
          padding-top: 1px;
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
        /* 하단 탭바(.mtab, 60px) 바로 위에 앉는다. 스크롤을 내리면 _app.js 가
           data-chrome-hidden 을 켜고 탭바가 translateY(100%) 로 빠지는데, 그때 비는
           60px 를 그대로 물려받아 화면 맨 아래로 내려온다. 탭바와 같은 .25s ease 를
           쓰므로 둘이 어긋나 보이지 않는다(스크롤을 올리면 탭바가 돌아오며 같이 복귀). */
        .cv-sticky {
          display: none;
          position: fixed;
          bottom: calc(60px + env(safe-area-inset-bottom));
          left: 0; right: 0;
          padding: 12px 16px;
          background: rgba(250,246,240,0.94);
          backdrop-filter: blur(14px);
          border-top: 1px solid rgba(26,22,18,0.08);
          z-index: 90;
          transition: bottom .25s ease, padding-bottom .25s ease;
        }
        /* 탭바가 빠진 자리로 내려앉을 때는 홈 인디케이터 여백을 이쪽이 떠안는다 —
           탭바가 갖고 있던 padding-bottom 이 같이 사라지기 때문이다.
           body 는 :global 로 감싼다 — 안 감싸면 styled-jsx 가 body 에도 스코프 클래스를
           붙여(body[...].jsx-xxx) 그 클래스가 없는 실제 body 와 영영 안 맞는다. */
        :global(body[data-chrome-hidden="1"]) .cv-sticky {
          bottom: 0;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
        }
        .cv-btn-sticky { margin-top: 0; padding: 16px; box-shadow: 0 -4px 18px rgba(255,96,0,0.22); }


        /* ───── Responsive ───── */
        @media (max-width: 960px) {
          .cv-hero {
            padding: clamp(44px, 7vh, 72px) 28px clamp(36px, 5vh, 60px);
            background:
              radial-gradient(700px circle at 50% 32%, rgba(255,96,0,0.13), transparent 56%),
              radial-gradient(700px circle at 50% 70%, rgba(0,0,0,0.98), transparent 68%),
              linear-gradient(180deg, #1f1813 0%, #181410 100%);
          }
          /* gap 은 자식이 제목·지폐 둘뿐이던 시절 값이다. CTA·조건 문구가 붙으면서
             56px 이 세 군데로 늘어나 히어로가 168px 길어졌다 — 간격은 각 요소의
             margin 으로만 잡는다. */
          .cv-hero-inner { gap: 0; }
          .cv-banknote-showcase {
            width: min(400px, 100%, 44vh);
            margin-top: clamp(18px, 3vh, 30px);
            margin-bottom: -2%;
          }
          .cv-hero-cta { margin-top: clamp(10px, 1.6vh, 20px); }
          .cv-prize { min-height: 340px; }
          /* 1열로 떨어지면 이미지가 aspect-ratio:1/1 이라 카드 폭만큼 높이를 먹는다
             — 390px 화면에서 장당 420px(그중 이미지 350px), 세 장이면 1,404px 이라
             등록 폼이 2.85 화면 아래로 밀렸다. 세로로 쌓지 말고 가로로 눕힌다. */
          .cv-flow {
            /* 460px 상한이 뷰포트보다 넓어 실질 전폭이 된다 — 좌우 여백이 0이라
               사진이 화면 왼쪽 끝에 붙는다. 섹션 자체에 가로 패딩이 없어 여기서 준다. */
            max-width: 460px;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-top: 30px;
            padding: 0 22px;
          }
          /* 제목 → 사진 → 설명 순으로 쌓는다. h3/p 가 .cv-flow-copy 안에 묶여 있어
             그대로는 이미지를 둘 사이에 못 넣는다 — copy 를 display:contents 로 풀어
             세 요소를 카드의 직접 자식으로 만든 뒤 order 로 배치한다(마크업은 그대로라
             데스크톱 3열 레이아웃은 영향 없다). */
          /* 사진 왼쪽 · 제목+설명 오른쪽. 세로로 쌓으면 이미지가 카드 폭만큼 높이를
             먹고(390px 화면에서 장당 420px) 제목·사진·설명이 따로 떠 보인다 —
             가로로 나란히 두면 한 줄이 곧 한 덩어리라 따로 묶어줄 필요도 없다. */
          .cv-flow-card {
            display: grid;
            grid-template-columns: 108px 1fr;
            gap: 16px;
            align-items: center;
          }
          .cv-flow-image {
            border-radius: 18px;
            box-shadow: 0 1px 2px rgba(26,22,18,0.05), 0 10px 22px -14px rgba(26,22,18,0.18);
          }
          .cv-flow-copy {
            margin-top: 0;
            padding: 0;
            text-align: left;
          }
          .cv-flow-copy h3 { margin-bottom: 5px; }
          /* 가로 카드로 눕히면 순서는 목록 자체가 말해준다 — 사이 화살표는 높이만 먹는다. */
          .cv-flow-arrow { display: none; }
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
          .cv-hero { padding: clamp(36px, 6vh, 56px) 20px clamp(28px, 4vh, 44px); }
          .cv-section-inner { padding: 0 20px; }
          .cv-how, .cv-test, .cv-jobs, .cv-form-section { padding: 80px 0 64px; }
          /* 폼 카드 — 데스크톱 패딩(56/52px)·타이틀(42px) 그대로면 콘텐츠 폭이
             ~250pt로 구겨져 제목이 단어 중간에서 꺾인다. 모바일은 전부 축소. */
          .cv-form-wrap.cv-section-inner { padding: 0 12px; }
          .cv-form-wrap .cv-card { padding: 30px 18px; }
          .cv-form-wrap .cv-card-h { font-size: 27px; letter-spacing: -0.8px; }
          .cv-form-wrap .cv-card-sub { font-size: 14px; margin-bottom: 24px; }
          .cv-stepblock { padding: 16px 14px 18px; }
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
          .cv-h1-hero { margin-top: 12px; }
          .cv-banknote-showcase {
            width: min(300px, 78%, 34vh);
            margin-top: clamp(14px, 2.5vh, 26px);
            /* 지폐 PNG 아래쪽에 투명 여백이 있어 실제보다 훨씬 떠 보인다 —
               그만큼 끌어올려 CTA 를 이미지에 붙인다. */
            margin-bottom: -2%;
          }
          /* 앱 웹뷰는 하단 탭바(60px)에 가려 실제 가용 높이가 짧다 — 간격 최소로 */
          .cv-hero-cta { margin-top: 10px; }
          .cv-hero-note { margin-top: 12px; font-size: 11.5px; }
          .cv-h2 { letter-spacing: -0.8px; }
          .cv-success-card {
            padding: 34px 18px 92px;
            margin-bottom: 28px;
          }
          .cv-success-visual {
            width: min(250px, 86%);
            margin: -4px auto 14px;
          }
          .cv-success-h {
            font-size: 29px;
            letter-spacing: -1px;
          }
          .cv-success-sub {
            font-size: 14px;
            margin-bottom: 20px;
          }
          .cv-success-reward {
            padding: 18px 16px 16px;
            margin-bottom: 18px;
          }
          .cv-success-reward .cv-reward-title {
            font-size: 22px;
          }
          .cv-progress {
            height: 16px;
            margin-top: 16px;
          }
          .cv-progress-dot {
            width: 26px;
            height: 26px;
            border-width: 6px;
          }
          .cv-success-next {
            margin: 18px 0 20px;
            padding: 15px 16px;
            font-size: 13.5px;
          }
          .cv-success-cta {
            font-size: 14px;
            padding-left: 14px;
            padding-right: 14px;
          }
          .fw-1 { right: 42px; }
          .fw-2 { left: 38px; }
          .cv-flow {
            margin-top: 26px;
            gap: 18px;
          }
          .cv-flow-image {
            border-radius: 16px;
          }
          .cv-flow-copy h3 {
            font-size: 17px;
            letter-spacing: -0.3px;
          }
          .cv-flow-copy p {
            font-size: 13px;
            line-height: 1.5;
          }
          .cv-test-card { flex-basis: 290px; padding: 26px 22px 20px; }
          .cv-jobs-grid { padding: 0 20px; }
          .cv-sticky { display: block; }
          /* 히어로 CTA 는 모바일에서도 화면 폭을 다 먹지 않고 글자 폭에 맞춘다 —
             풀폭이면 하단 스티키 바와 구분이 안 되고 가로로 늘어져 보인다. */
          .cv-btn.cv-btn-hero { width: auto; max-width: 86%; padding: 16px 44px; font-size: 15px; }
          .cv-trust-line { gap: 18px; }
          .cv-trust-divider { display: none; }
          .cv-conds { padding: 24px; }
        }
      `}</style>
    </>
  )
}
