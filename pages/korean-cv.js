import { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'
import { idbPutCv, idbGetCv, idbClearCv } from '../lib/pendingCv'
import GlobalNav from '../components/GlobalNav'

/* /korean-cv — "담당자가 직접 만들어주는 한국식 이력서" 서비스 랜딩.
   즉석 AI 변환이 아니라 컨시어지: CV 업로드+가입 → 요청 접수(events.kcv_request)
   → 어드민(/admin/korean-cv)에서 AI 초안 + 사람이 첨삭 → 이메일로 전달.
   업로드는 /cv 와 같은 인재풀 등록(공개 ON)이라 요청 자체가 인재풀 유입이 된다. */

function kcvMeta() {
  if (typeof window === 'undefined') return {}
  return {
    utm_source: sessionStorage.getItem('utm_source') || null,
    utm_medium: sessionStorage.getItem('utm_medium') || null,
    utm_campaign: sessionStorage.getItem('utm_campaign') || null,
    utm_content: sessionStorage.getItem('utm_content') || null,
    utm_term: sessionStorage.getItem('utm_term') || null,
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

export default function KoreanCvPage() {
  const { lang } = useT()
  const router = useRouter()
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)

  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | submitting | done
  const [reqPending, setReqPending] = useState(false) // 재방문 시 이미 접수된 요청
  const [errMsg, setErrMsg] = useState('')
  const [jobs, setJobs] = useState([])
  const [trustIdx, setTrustIdx] = useState(0) // 모바일 캐러셀 도트 인디케이터
  const fileRef = useRef(null)
  const uploadRef = useRef(null)
  const stepsRef = useRef(null)
  const trustRef = useRef(null)
  const submittedOnce = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      const v = p.get(k)
      if (v) sessionStorage.setItem(k, v)
    })
    track('kcv_view', { meta: kcvMeta(), page: '/korean-cv' })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  // 재방문: 아직 발송 안 된 요청이 있으면 접수됨 화면을 바로 보여준다
  useEffect(() => {
    if (!user) { setReqPending(false); return }
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const r = await fetch('/api/korean-cv/request', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const j = await r.json()
        if (!cancelled && j.requested && !j.sent) { setReqPending(true); setStatus('done') }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [user])

  // OAuth 복귀: 스태시된 파일 복원 → 자동 제출
  useEffect(() => {
    if (!user || router.query.continue !== '1' || submittedOnce.current) return
    submittedOnce.current = true
    ;(async () => {
      track('kcv_oauth_return', { meta: kcvMeta(), page: '/korean-cv' })
      const stored = await idbGetCv()
      if (stored?.blob) {
        const f = new File([stored.blob], stored.name, { type: stored.type })
        setFile(f)
        uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => submitRequest(f), 400)
      } else {
        track('kcv_stash_lost', { meta: kcvMeta(), page: '/korean-cv' })
        uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })()
  }, [user, router.query])

  // 1 page 1 info — 아래 섹션들은 스크롤로 진입할 때 순차적으로 드러난다.
  // 뷰포트에 이미 들어와 있는 요소는 observe 즉시 콜백이 와서 바로 보인다.
  useEffect(() => {
    if (status === 'done' || typeof window === 'undefined') return
    // .kcv-steps 는 컨테이너에 .in 이 붙으면 자식 카드들이 1→2→3 시퀀스로 켜진다
    const els = document.querySelectorAll('.kcv-reveal, .kcv-steps')
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [status])

  // 접수 후 대기시간 이탈 방지용 공고 (기업 직접등록 우선 → 지원 많은 순, 회사당 1개)
  useEffect(() => {
    if (status !== 'done') return
    fetch('/api/jobs?counts=1')
      .then(r => r.json())
      .then(arr => {
        const list = Array.isArray(arr) ? arr : (arr.jobs || [])
        setJobs(list.filter(j => j.is_active !== false))
      })
      .catch(() => {})
  }, [status])

  const topJobs = useMemo(() => {
    const seen = new Set()
    return jobs
      .slice()
      .sort((a, b) => (a.source === 'company_self' ? 0 : 1) - (b.source === 'company_self' ? 0 : 1)
        || (b.application_count || 0) - (a.application_count || 0))
      .filter(j => { if (seen.has(j.company)) return false; seen.add(j.company); return true })
      .slice(0, 3)
  }, [jobs])

  const handleFile = (f) => {
    if (!f) return
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      setErrMsg(L('PDF 또는 Word 파일만 올릴 수 있어요.', 'Only PDF or Word files are supported.', 'Chỉ hỗ trợ file PDF hoặc Word.'))
      track('kcv_attach_rejected', { meta: { ...kcvMeta(), ...fileMeta(f), reason: 'bad_ext' }, page: '/korean-cv' })
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg(L('파일이 너무 커요 (최대 10MB).', 'File too big (max 10MB).', 'File quá lớn (tối đa 10MB).'))
      track('kcv_attach_rejected', { meta: { ...kcvMeta(), ...fileMeta(f), reason: 'too_big' }, page: '/korean-cv' })
      return
    }
    setErrMsg('')
    setFile(f)
    idbPutCv(f).catch(() => {})
    track('kcv_attach_file', { meta: { ...kcvMeta(), ...fileMeta(f) }, page: '/korean-cv' })
  }

  const submitRequest = async (fileToUpload) => {
    if (!fileToUpload || status === 'submitting') return
    setStatus('submitting')
    setErrMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error(L('로그인이 필요해요.', 'Please sign in.', 'Vui lòng đăng nhập.'))
      const fd = new FormData()
      fd.append('type', 'resume')
      fd.append('file', fileToUpload)
      const r = await fetch('/api/profile/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Resume-Source': 'korean-cv' },
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
      const reqRes = await fetch('/api/korean-cv/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ meta: kcvMeta() }),
      })
      if (!reqRes.ok) throw new Error('request failed')
      if (typeof gtag === 'function') gtag('event', 'korean_cv_request', { source: 'korean-cv' })
      if (typeof fbq === 'function') fbq('trackCustom', 'KoreanCVRequest', { source: 'korean-cv' })
      track('kcv_request_success', { meta: { ...kcvMeta(), ...fileMeta(fileToUpload) }, page: '/korean-cv' })
      await idbClearCv()
      setStatus('done')
    } catch (e) {
      track('kcv_request_error', { meta: { ...kcvMeta(), error_message: e.message }, page: '/korean-cv' })
      setErrMsg(e.message || L('요청에 실패했어요. 다시 시도해주세요.', 'Request failed. Please try again.', 'Yêu cầu thất bại. Vui lòng thử lại.'))
      setStatus('idle')
    }
  }

  const onCta = async () => {
    if (!file) { fileRef.current?.click(); return }
    if (!user) {
      localStorage.setItem('fyi_login_return', '/korean-cv?continue=1')
      localStorage.setItem('fyi_intent', 'kcv_signup')
      await track('kcv_oauth_start', { meta: { ...kcvMeta(), provider: 'google' }, page: '/korean-cv' })
      if (window.location.hostname === 'localhost') {
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
      } else {
        window.location.href = '/api/auth/google?return=' + encodeURIComponent('/korean-cv?continue=1')
      }
      return
    }
    await submitRequest(file)
  }

  const scrollToUpload = () => uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const steps = [
    {
      n: '1',
      t: L('CV 업로드 & 로그인', 'Upload your CV & sign in', 'Tải CV lên & đăng nhập'),
      s: L('1분이면 끝나요. 지금 쓰는 CV 그대로 — 베트남어나 영어여도 괜찮아요. PDF, Word 다 돼요.',
        'Takes 1 minute. Your current CV as-is — Vietnamese or English is fine. PDF or Word.',
        'Chỉ mất 1 phút. Dùng CV hiện tại của bạn — tiếng Việt hay tiếng Anh đều được. PDF hay Word đều OK.'),
    },
    {
      n: '2',
      t: L('시니어 HR이 번역하고 다듬어요', 'A senior HR pro translates & polishes it', 'HR cấp cao dịch & chỉnh sửa'),
      s: L('한국 기업에 인재를 매칭하는 시니어 HR이 직접 한국식 이력서로 번역하고, 한국어 실력과 경력이 돋보이게 첨삭해요.',
        'A senior HR professional who matches candidates with Korean companies translates it into the Korean resume format and edits it so your Korean skills and experience stand out.',
        'Chuyên viên HR cấp cao trực tiếp kết nối ứng viên với công ty Hàn sẽ dịch CV sang mẫu 이력서 chuẩn Hàn và chỉnh sửa để năng lực tiếng Hàn cùng kinh nghiệm của bạn nổi bật hơn.'),
    },
    {
      n: '3',
      t: L('이메일로 받아요 + 커리어 피드백', 'Receive it by email + career feedback', 'Nhận qua email + nhận xét nghề nghiệp'),
      s: L('1~2 영업일 안에 완성된 한국식 이력서(PDF)와 함께 커리어 피드백을 보내드려요.',
        'Within 1–2 business days you get the finished Korean resume (PDF) plus career feedback.',
        'Trong 1–2 ngày làm việc, bạn nhận 이력서 hoàn chỉnh (PDF) kèm nhận xét định hướng nghề nghiệp.'),
    },
  ]

  const trust = [
    {
      img: '/korean-cv/trust-2.png',
      t: L('저희는 LIKELION이에요', 'We are LIKELION', 'Chúng tôi là LIKELION'),
      s: L('LIKELION은 베트남과 미국에 법인을 둔 한국 기업이에요. 한국 정부 지원으로 베트남 인재를 선발·교육해 한국 기업과 연결하는 K-Tech College도 운영하고 있어요.',
        'LIKELION is a Korean company with entities in Vietnam and the US. We also run K-Tech College, a Korean-government-backed program that selects and trains Vietnamese talent for Korean companies.',
        'LIKELION là công ty Hàn Quốc có pháp nhân tại Việt Nam và Mỹ. Chúng tôi cũng vận hành K-Tech College — chương trình được chính phủ Hàn Quốc hỗ trợ, tuyển chọn và đào tạo nhân tài Việt để kết nối với doanh nghiệp Hàn.'),
    },
    {
      img: '/korean-cv/trust-1.png',
      t: L('아까운 탈락을 너무 많이 봤어요', 'We saw too many good candidates rejected', 'Quá nhiều ứng viên giỏi bị loại đáng tiếc'),
      s: L('FYI는 LIKELION이 운영하는 채용 플랫폼이에요. 실력과 스펙은 충분한데 이력서가 한국식이 아니라서 서류에서 탈락하는 경우를 너무 많이 봤어요. 그래서 이 서비스를 시작했어요.',
        'FYI is the hiring platform LIKELION runs. We kept seeing candidates with great skills fail screening simply because their resume wasn\'t written the Korean way — so we started this service.',
        'FYI là nền tảng tuyển dụng do LIKELION vận hành. Chúng tôi thấy quá nhiều ứng viên đủ năng lực nhưng bị loại từ vòng hồ sơ chỉ vì CV không viết theo chuẩn Hàn — vì vậy chúng tôi bắt đầu dịch vụ này.'),
    },
    {
      img: '/korean-cv/trust-3.png',
      t: L('AI가 아니라 시니어 HR이 직접 봐요', 'A senior HR pro — not AI', 'HR cấp cao trực tiếp làm — không phải AI'),
      s: L('시간이 더 걸리더라도 시니어 HR 담당자가 한 부씩 직접 검토·첨삭해요. 완성된 이력서와 함께 커리어 피드백까지 보내드려요.',
        'Even if it takes longer, a senior HR professional personally reviews and edits every resume — and sends it back with career feedback.',
        'Dù mất nhiều thời gian hơn, chuyên viên HR cấp cao sẽ trực tiếp xem và chỉnh sửa từng bản — gửi lại cho bạn kèm nhận xét định hướng nghề nghiệp.'),
    },
  ]

  const pageTitle = L(
    'TOPIK 다음의 차별점, 한국식 이력서 무료 제작 | FYI',
    'The edge after TOPIK — free Korean resume service | FYI',
    'Lợi thế sau TOPIK — làm 이력서 chuẩn Hàn miễn phí | FYI',
  )
  const pageDesc = L(
    'TOPIK 급수는 이력서의 한 줄, 제대로 쓴 한국식 이력서는 그 자체가 실력 증명. AI가 아니라 시니어 HR이 무료로 번역·첨삭해서 커리어 피드백과 함께 보내드려요.',
    'TOPIK is one line on a resume — a properly written Korean resume is proof of your Korean itself. A senior HR professional (not AI) makes yours for free, with career feedback, by email.',
    'Điểm TOPIK chỉ là một dòng trong hồ sơ — bản 이력서 viết đúng chuẩn Hàn mới là bằng chứng thật cho năng lực của bạn. Chuyên viên HR cấp cao (không phải AI) làm miễn phí, kèm nhận xét nghề nghiệp, gửi qua email.',
  )

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        {/* 커뮤니티(페북 등) 공유 링크 프리뷰용 */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
      </Head>
      <GlobalNav activePage="koreanCv" />

      <style>{`
        /* 광고 랜딩 — 모바일 헤더의 K-company 칩은 이 페이지에서 숨긴다(이탈 경로 최소화). */
        .gnav-zone-m { display: none !important; }
        .kcv-page { min-height: 100vh; background: #f4f2ee; color: #1a1612; font-family: 'Barlow', -apple-system, sans-serif; padding-bottom: 90px; }
        .kcv-wrap { max-width: 760px; margin: 0 auto; padding: 0 16px; }
        .kcv-hero { text-align: center; padding: 64px 0 24px; position: relative; }
        /* 배경 글로우 — 밋밋한 단색 위에 브랜드 오렌지 온기를 깐다 */
        .kcv-hero::before { content: ''; position: absolute; inset: -60px -40px auto; height: 420px; background: radial-gradient(420px 300px at 50% 20%, rgba(255,96,0,0.13), transparent 70%); pointer-events: none; }
        .kcv-hero > * { position: relative; }
        /* CV → 이력서 변환 비주얼 (순수 CSS 목업) */
        .kcv-hero-art { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 32px auto 4px; }
        .kcv-art-card { width: 132px; background: #fff; border: 1px solid #eee6dc; border-radius: 12px; padding: 12px 12px 14px; text-align: left; }
        .kcv-art-cv { transform: rotate(-5deg); box-shadow: 0 12px 28px rgba(26,22,18,0.1); animation: kcvFloatA 3.6s ease-in-out infinite; }
        .kcv-art-ko { transform: rotate(4deg); box-shadow: 0 16px 38px rgba(255,96,0,0.18); border-color: rgba(255,96,0,0.35); animation: kcvFloatB 3.6s ease-in-out 0.5s infinite; }
        @keyframes kcvFloatA { 0%, 100% { transform: rotate(-5deg) translateY(0); } 50% { transform: rotate(-5deg) translateY(-6px); } }
        @keyframes kcvFloatB { 0%, 100% { transform: rotate(4deg) translateY(0); } 50% { transform: rotate(4deg) translateY(-8px); } }
        .kcv-art-label { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px; }
        .kcv-art-label.cv { color: #3b5bd6; }
        .kcv-art-label.ko { color: #ff6000; }
        .kcv-art-head { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
        .kcv-art-ava { width: 26px; height: 26px; border-radius: 50%; background: #dbe3f7; flex-shrink: 0; }
        .kcv-art-photo { width: 24px; height: 32px; border-radius: 3px; background: rgba(255,96,0,0.14); border: 1px solid rgba(255,96,0,0.35); flex-shrink: 0; }
        .kcv-art-line { height: 5px; border-radius: 3px; background: #ece6dd; margin-top: 6px; }
        .kcv-art-cell { height: 7px; border-radius: 2px; background: #f6efe6; border: 1px solid #eadfcf; margin-top: 5px; }
        .kcv-art-arrow { color: #ff6000; flex-shrink: 0; animation: kcvNudge 1.6s ease-in-out infinite; }
        @keyframes kcvNudge { 0%, 100% { transform: translateX(0); opacity: 0.75; } 50% { transform: translateX(5px); opacity: 1; } }
        .kcv-art-spark { position: absolute; color: #ffb36b; font-size: 13px; animation: kcvTwinkle 2.2s ease-in-out infinite; pointer-events: none; }
        .kcv-art-spark.s1 { top: -8px; left: calc(50% - 130px); }
        .kcv-art-spark.s2 { bottom: -2px; right: calc(50% - 138px); font-size: 10px; animation-delay: 1.1s; }
        @keyframes kcvTwinkle { 0%, 100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
        .kcv-badge { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #57504a; background: #fff; border: 1px solid #eee6dc; box-shadow: 0 4px 14px rgba(26,22,18,0.06); border-radius: 100px; padding: 7px 15px; margin-bottom: 18px; }
        .kcv-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #ff6000; }
        .kcv-h1 { font-size: 38px; font-weight: 800; line-height: 1.28; letter-spacing: -0.01em; margin: 0 0 16px; }
        .kcv-h1 em { font-style: normal; color: #ff6000; }
        .kcv-sub { font-size: 16px; color: #57504a; line-height: 1.7; max-width: 600px; margin: 0 auto; }
        .kcv-hero-cta { display: inline-block; margin-top: 28px; background: #ff6000; color: #fff; border: none; border-radius: 100px; padding: 15px 34px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s, transform .12s; }
        .kcv-hero-cta:hover { background: #ff7a1a; transform: translateY(-1px); }
        .kcv-hero-note { margin-top: 12px; font-size: 12.5px; color: #9a9186; }
        /* 첫 화면 진입 모션 — 히어로 요소가 순서대로 떠오른다 */
        @keyframes kcvRise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .kcv-hero > * { animation: kcvRise .65s cubic-bezier(.22,.7,.3,1) both; }
        .kcv-hero > *:nth-child(2) { animation-delay: .08s; }
        .kcv-hero > *:nth-child(3) { animation-delay: .16s; }
        .kcv-hero > *:nth-child(4) { animation-delay: .24s; }
        .kcv-hero > *:nth-child(5) { animation-delay: .32s; }
        .kcv-hero > *:nth-child(6) { animation-delay: .45s; }
        .kcv-scroll-hint { display: none; }
        /* 1 page 1 info — 스크롤 진입 시 섹션이 순차적으로 드러난다 */
        .kcv-reveal { opacity: 0; transform: translateY(26px); transition: opacity .65s cubic-bezier(.22,.7,.3,1), transform .65s cubic-bezier(.22,.7,.3,1); }
        .kcv-reveal.in { opacity: 1; transform: none; }
        .kcv-reveal-d1 { transition-delay: .05s; }
        .kcv-reveal-d2 { transition-delay: .15s; }
        .kcv-reveal-d3 { transition-delay: .25s; }
        @media (prefers-reduced-motion: reduce) {
          .kcv-hero > * { animation: none; }
          .kcv-art-cv, .kcv-art-ko, .kcv-art-arrow, .kcv-art-spark { animation: none; }
          .kcv-reveal { opacity: 1; transform: none; transition: none; }
          .kcv-steps .kcv-step { opacity: 1; transform: none; transition: none; }
          .kcv-steps.in .kcv-step-n { animation: none; }
        }

        /* scroll-margin — 고정/스티키 헤더 밑에 제목이 깔리지 않게 앵커 스크롤 위치 보정 */
        .kcv-sec { margin-top: 56px; scroll-margin-top: 76px; }
        .kcv-sec-h { font-size: 22px; font-weight: 800; margin: 0 0 18px; text-align: center; }
        .kcv-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .kcv-step { background: #fff; border: 1px solid #e8e2da; border-radius: 16px; padding: 22px 18px; }
        .kcv-step-n { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,96,0,0.1); color: #e05400; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        /* 1→2→3 시퀀스 — 섹션 진입 시 카드가 차례로 슬라이드인, 번호가 팝 하며 점등 */
        .kcv-steps .kcv-step { opacity: 0; transform: translateX(-18px); transition: opacity .5s cubic-bezier(.22,.7,.3,1), transform .5s cubic-bezier(.22,.7,.3,1); }
        .kcv-steps.in .kcv-step { opacity: 1; transform: none; }
        .kcv-steps.in .kcv-step:nth-child(1) { transition-delay: .1s; }
        .kcv-steps.in .kcv-step:nth-child(2) { transition-delay: .6s; }
        .kcv-steps.in .kcv-step:nth-child(3) { transition-delay: 1.1s; }
        .kcv-steps.in .kcv-step:nth-child(1) .kcv-step-n { animation: kcvPop .5s .25s both; }
        .kcv-steps.in .kcv-step:nth-child(2) .kcv-step-n { animation: kcvPop .5s .75s both; }
        .kcv-steps.in .kcv-step:nth-child(3) .kcv-step-n { animation: kcvPop .5s 1.25s both; }
        @keyframes kcvPop {
          0% { transform: scale(.3); }
          55% { transform: scale(1.25); }
          100% { transform: scale(1); background: #ff6000; color: #fff; }
        }
        .kcv-step-t { font-size: 15px; font-weight: 700; margin-bottom: 7px; line-height: 1.4; }
        .kcv-step-s { font-size: 13px; color: #57504a; line-height: 1.65; }

        .kcv-trust { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .kcv-trust-card { background: #fff; border: 1px solid #e8e2da; border-radius: 18px; padding: 22px 18px 24px; display: flex; flex-direction: column; }
        .kcv-trust-img { height: 220px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 16px; }
        .kcv-trust-img img { max-height: 100%; max-width: 100%; object-fit: contain; }
        .kcv-trust-t { font-size: 14.5px; font-weight: 800; margin-bottom: 7px; text-align: center; }
        .kcv-trust-s { font-size: 12.5px; color: #57504a; line-height: 1.65; }
        .kcv-trust-dots { display: none; }

        .kcv-upload { background: #fff; border: 1px solid #e8e2da; border-radius: 18px; padding: 30px 24px; text-align: center; }
        .kcv-drop { border: 1.5px dashed rgba(255,96,0,0.5); background: #fffaf6; border-radius: 14px; padding: 34px 20px; cursor: pointer; transition: background .15s, border-color .15s; }
        .kcv-drop:hover, .kcv-drop.over { background: #fff3ea; border-color: #ff6000; }
        .kcv-drop-ico { height: 108px; display: block; margin: 0 auto 12px; }
        .kcv-drop-t { font-size: 16px; font-weight: 700; margin-bottom: 5px; }
        .kcv-drop-s { font-size: 12.5px; color: #9a9186; }
        .kcv-file { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: #1a1612; background: #f4f2ee; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
        .kcv-file button { background: none; border: none; color: #9a9186; font-size: 12px; cursor: pointer; text-decoration: underline; font-family: inherit; }
        .kcv-cta { display: block; width: 100%; margin-top: 16px; background: #ff6000; color: #fff; border: none; border-radius: 12px; padding: 16px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s; }
        .kcv-cta:hover { background: #ff7a1a; }
        .kcv-cta:disabled { opacity: 0.6; cursor: default; }
        .kcv-cta-note { margin-top: 12px; font-size: 12px; color: #9a9186; line-height: 1.6; }
        .kcv-err { margin-top: 14px; background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; font-size: 13.5px; border-radius: 10px; padding: 11px 16px; }

        .kcv-done { background: #fff; border: 1px solid #e8e2da; border-radius: 18px; padding: 44px 28px; text-align: center; margin-top: 48px; }
        .kcv-done-ico { font-size: 40px; margin-bottom: 14px; }
        .kcv-done-t { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
        .kcv-done-s { font-size: 14.5px; color: #57504a; line-height: 1.7; max-width: 440px; margin: 0 auto; }
        .kcv-done-s b { color: #e05400; }

        .kcv-jobs { margin-top: 44px; }
        .kcv-jobs-h { font-size: 19px; font-weight: 800; margin-bottom: 4px; }
        .kcv-jobs-s { font-size: 13.5px; color: #8a8177; margin-bottom: 16px; }
        .kcv-job-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #fff; border: 1px solid #e8e2da; border-radius: 14px; padding: 16px 18px; margin-bottom: 10px; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; }
        .kcv-job-card:hover { border-color: rgba(255,96,0,0.5); box-shadow: 0 4px 16px rgba(26,22,18,0.07); }
        .kcv-job-t { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
        .kcv-job-c { font-size: 12.5px; color: #8a8177; }
        .kcv-job-sal { font-size: 13px; font-weight: 700; color: #e05400; white-space: nowrap; }
        .kcv-jobs-all { display: inline-block; margin-top: 8px; font-size: 13.5px; color: #e05400; text-decoration: none; font-weight: 600; }

        @media (max-width: 768px) {
          .kcv-page { padding-top: 52px; }
          /* 히어로 = 첫 화면 한 장. 아래 내용은 스크롤해야 드러난다. */
          .kcv-hero {
            min-height: calc(100vh - 52px); min-height: calc(100dvh - 52px);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 0 0 20px;
          }
          .kcv-h1 { font-size: 27px; }
          .kcv-sub { font-size: 14.5px; }
          /* 화살표는 절대위치가 아니라 각 섹션의 마지막 요소로 흐름에 둔다 —
             콘텐츠가 화면보다 길어져도 항상 그 섹션 끝에 자연스럽게 붙는다. */
          .kcv-scroll-hint {
            display: flex; align-items: center; justify-content: center;
            align-self: center; margin: 14px auto 0; flex-shrink: 0;
            width: 44px; height: 44px; border: none; background: none; color: #b0a496; cursor: pointer;
            animation: kcvBob 1.8s ease-in-out infinite;
          }
          @keyframes kcvBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
          /* 첫 요소와 화살표에 auto 마진 → 남는 공간을 위/아래로 똑같이 나눠
             콘텐츠는 중앙, 화살표는 화면 하단. 콘텐츠가 길면 자동으로 0이 된다. */
          .kcv-hero > :first-child, .kcv-sec-steps > :first-child, .kcv-sec-trust > :first-child { margin-top: auto; }
          .kcv-hero .kcv-scroll-hint, .kcv-sec-steps .kcv-scroll-hint, .kcv-sec-trust .kcv-scroll-hint { margin-top: auto; padding-top: 12px; }
          .kcv-sec { margin-top: 40px; scroll-margin-top: 64px; }
          /* 진행 3단계 = 두 번째 화면 한 장 (모바일은 번호+텍스트 가로 배치로 압축) */
          .kcv-sec-steps {
            min-height: calc(100vh - 52px); min-height: calc(100dvh - 52px);
            display: flex; flex-direction: column; justify-content: center; margin-top: 0; padding: 16px 0 20px;
            scroll-margin-top: 52px;
          }
          .kcv-steps { grid-template-columns: 1fr; }
          .kcv-step { display: flex; gap: 14px; align-items: flex-start; padding: 18px 16px; }
          .kcv-step-n { margin-bottom: 0; flex-shrink: 0; }
          /* 신뢰 카드 = 좌우 스와이프 캐러셀 (다음 카드가 살짝 보여 스와이프를 유도) */
          .kcv-trust {
            display: flex; overflow-x: auto; scroll-snap-type: x mandatory;
            gap: 12px; margin: 0 -16px; padding: 4px 16px 8px;
            scrollbar-width: none; -webkit-overflow-scrolling: touch;
          }
          .kcv-trust::-webkit-scrollbar { display: none; }
          .kcv-trust-card { flex: 0 0 82%; scroll-snap-align: center; }
          /* 가로 스크롤 캐러셀에선 스크롤 리빌을 끈다(스와이프 중 페이드는 어색) */
          .kcv-trust .kcv-reveal { opacity: 1; transform: none; transition: none; }
          .kcv-trust-img { height: 190px; }
          .kcv-trust-dots { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
          .kcv-trust-dots span { width: 6px; height: 6px; border-radius: 100px; background: #d8d0c6; transition: all .25s; }
          .kcv-trust-dots span.on { width: 18px; background: #ff6000; }
          /* 신뢰 섹션도 한 화면 한 장 + 하단 화살표 */
          .kcv-sec-trust {
            min-height: calc(100vh - 52px); min-height: calc(100dvh - 52px);
            display: flex; flex-direction: column; justify-content: center; margin-top: 0; padding: 16px 0 20px;
            scroll-margin-top: 52px;
          }
          /* 업로드 = 마지막 화면 한 장 */
          .kcv-sec-upload {
            min-height: calc(100vh - 52px); min-height: calc(100dvh - 52px);
            display: flex; flex-direction: column; justify-content: center; margin-top: 0;
            scroll-margin-top: 52px;
          }
        }
      `}</style>

      <div className="kcv-page">
        <div className="kcv-wrap">

          {status === 'done' ? (
            <>
              <div className="kcv-done">
                <div className="kcv-done-ico">✅</div>
                <div className="kcv-done-t">
                  {reqPending
                    ? L('이력서 작업이 진행 중이에요', 'Your resume is being worked on', 'Hồ sơ của bạn đang được xử lý')
                    : L('접수 완료!', 'Request received!', 'Đã tiếp nhận yêu cầu!')}
                </div>
                <div className="kcv-done-s">
                  {L(<>시니어 HR이 CV를 한국식 이력서로 번역·첨삭해서 <b>{user?.email}</b>로 보내드려요. 보통 1~2 영업일이 걸려요.</>,
                    <>A senior HR professional is translating and polishing your CV into a Korean resume. We'll email it to <b>{user?.email}</b> — usually within 1–2 business days.</>,
                    <>Chuyên viên HR cấp cao sẽ dịch và chỉnh sửa CV của bạn thành 이력서 chuẩn Hàn, rồi gửi đến <b>{user?.email}</b> — thường trong 1–2 ngày làm việc.</>)}
                </div>
              </div>

              {topJobs.length > 0 && (
                <div className="kcv-jobs">
                  <div className="kcv-jobs-h">{L('기다리는 동안 둘러보세요', 'While you wait', 'Trong lúc chờ đợi')}</div>
                  <div className="kcv-jobs-s">{L('지금 채용 중인 한국계 기업 공고예요.', 'Korean companies hiring right now.', 'Các công ty Hàn Quốc đang tuyển dụng.')}</div>
                  {topJobs.map(j => (
                    <a key={j.id} href={`/jobs/${j.id}?from=korean-cv`} className="kcv-job-card"
                      onClick={() => track('kcv_job_click', { meta: { ...kcvMeta(), job_id: j.id }, page: '/korean-cv' })}>
                      <div>
                        <div className="kcv-job-t">{j.title}</div>
                        <div className="kcv-job-c">{j.company}{j.location ? ` · ${j.location}` : ''}</div>
                      </div>
                      {fmtSal(j.salary_min, j.salary_max) && <div className="kcv-job-sal">{fmtSal(j.salary_min, j.salary_max)}</div>}
                    </a>
                  ))}
                  <a href="/jobs" className="kcv-jobs-all">{L('전체 공고 보기 →', 'See all jobs →', 'Xem tất cả việc làm →')}</a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="kcv-hero">
                <div className="kcv-badge">{L('무료 서비스', 'Free service', 'Dịch vụ miễn phí')}</div>
                <h1 className="kcv-h1">
                  {L(<>TOPIK 다음의 차별점,<br /><em>한국식 이력서</em></>,
                    <>The edge after TOPIK —<br />a <em>Korean-style resume</em></>,
                    <>Lợi thế sau TOPIK —<br /><em>이력서 chuẩn Hàn Quốc</em></>)}
                </h1>
                <p className="kcv-sub">
                  {L(<>TOPIK 급수는 이력서의 한 줄일 뿐이에요.<br />제대로 쓴 한국식 이력서는 그 자체가 한국어 실력 증명 — AI가 아니라 시니어 HR이 직접 만들어드려요.</>,
                    <>Your TOPIK level is just one line on a resume.<br />A properly written Korean resume is proof of your Korean itself — made for you by a senior HR professional, not AI.</>,
                    <>Điểm TOPIK chỉ là một dòng trong hồ sơ.<br />Một bản 이력서 viết đúng chuẩn Hàn mới là bằng chứng thật cho tiếng Hàn của bạn — do chuyên viên HR cấp cao trực tiếp làm, không phải AI.</>)}
                </p>
                <div className="kcv-hero-art" aria-hidden="true">
                  <span className="kcv-art-spark s1">✦</span>
                  <span className="kcv-art-spark s2">✦</span>
                  <div className="kcv-art-card kcv-art-cv">
                    <div className="kcv-art-label cv">CV</div>
                    <div className="kcv-art-head">
                      <div className="kcv-art-ava" />
                      <div style={{ flex: 1 }}>
                        <div className="kcv-art-line" style={{ width: '85%' }} />
                        <div className="kcv-art-line" style={{ width: '60%' }} />
                      </div>
                    </div>
                    <div className="kcv-art-line" style={{ width: '100%' }} />
                    <div className="kcv-art-line" style={{ width: '92%' }} />
                    <div className="kcv-art-line" style={{ width: '70%' }} />
                  </div>
                  <svg className="kcv-art-arrow" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  <div className="kcv-art-card kcv-art-ko">
                    <div className="kcv-art-label ko">이력서</div>
                    <div className="kcv-art-head">
                      <div className="kcv-art-photo" />
                      <div style={{ flex: 1 }}>
                        <div className="kcv-art-cell" style={{ width: '90%' }} />
                        <div className="kcv-art-cell" style={{ width: '90%' }} />
                      </div>
                    </div>
                    <div className="kcv-art-cell" style={{ width: '100%' }} />
                    <div className="kcv-art-cell" style={{ width: '100%' }} />
                    <div className="kcv-art-cell" style={{ width: '78%' }} />
                  </div>
                </div>
                <button className="kcv-hero-cta" onClick={scrollToUpload}>
                  {L('무료로 요청하기', 'Request for free', 'Yêu cầu miễn phí')}
                </button>
                <div className="kcv-hero-note">{L('CV 업로드 + 로그인, 1분이면 접수 끝', 'Upload + sign in — done in 1 minute', 'Tải CV + đăng nhập — chỉ 1 phút')}</div>
                <button className="kcv-scroll-hint" aria-label="scroll down"
                  onClick={() => stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </div>

              <div className="kcv-sec kcv-sec-steps" ref={stepsRef}>
                <h2 className="kcv-sec-h kcv-reveal">{L('이렇게 진행돼요', 'How it works', 'Cách thức hoạt động')}</h2>
                <div className="kcv-steps">
                  {steps.map((s) => (
                    <div key={s.n} className="kcv-step">
                      <div className="kcv-step-n">{s.n}</div>
                      <div className="kcv-step-body">
                        <div className="kcv-step-t">{s.t}</div>
                        <div className="kcv-step-s">{s.s}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="kcv-scroll-hint" aria-label="scroll down"
                  onClick={() => trustRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </div>

              <div className="kcv-sec kcv-sec-trust" ref={trustRef}>
                <h2 className="kcv-sec-h kcv-reveal">{L('왜 무료로 해주나요?', 'Why is it free?', 'Sao lại miễn phí?')}</h2>
                <div className="kcv-trust" onScroll={(e) => {
                  const el = e.currentTarget
                  const step = (el.children[0]?.offsetWidth || 1) + 12
                  const idx = Math.min(2, Math.max(0, Math.round(el.scrollLeft / step)))
                  if (idx !== trustIdx) setTrustIdx(idx)
                }}>
                  {trust.map((item, i) => (
                    <div key={i} className={`kcv-trust-card kcv-reveal kcv-reveal-d${i + 1}`}>
                      <div className="kcv-trust-img"><img src={item.img} alt="" loading="lazy" /></div>
                      <div className="kcv-trust-t">{item.t}</div>
                      <div className="kcv-trust-s">{item.s}</div>
                    </div>
                  ))}
                </div>
                <div className="kcv-trust-dots" aria-hidden="true">
                  {trust.map((_, i) => <span key={i} className={i === trustIdx ? 'on' : ''} />)}
                </div>
                <button className="kcv-scroll-hint" aria-label="scroll down"
                  onClick={scrollToUpload}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </div>

              <div className="kcv-sec kcv-sec-upload" ref={uploadRef}>
                <h2 className="kcv-sec-h kcv-reveal">{L('지금 CV를 올려두세요', 'Upload your CV now', 'Tải CV của bạn lên ngay')}</h2>
                <div className="kcv-upload kcv-reveal kcv-reveal-d1">
                  <div
                    className="kcv-drop"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                    onDragLeave={e => e.currentTarget.classList.remove('over')}
                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); handleFile(e.dataTransfer.files?.[0]) }}
                  >
                    <img src="/korean-cv/upload.png" className="kcv-drop-ico" alt="" />
                    <div className="kcv-drop-t">{L('CV 파일 올리기', 'Upload your CV', 'Tải file CV lên')}</div>
                    <div className="kcv-drop-s">{L('클릭 또는 드래그 · PDF, DOC, DOCX · 최대 10MB', 'Click or drag & drop · PDF, DOC, DOCX · max 10MB', 'Nhấp hoặc kéo thả · PDF, DOC, DOCX · tối đa 10MB')}</div>
                  </div>
                  {file && (
                    <div className="kcv-file">
                      <span>📎 {file.name}</span>
                      <button onClick={() => { setFile(null); idbClearCv().catch(() => {}) }}>{L('삭제', 'remove', 'xóa')}</button>
                    </div>
                  )}
                  <button className="kcv-cta" onClick={onCta} disabled={status === 'submitting'}>
                    {status === 'submitting'
                      ? L('접수 중...', 'Submitting...', 'Đang gửi...')
                      : !file
                        ? L('CV 선택하기', 'Choose your CV', 'Chọn file CV')
                        : !user
                          ? L('Google 로그인하고 요청하기', 'Sign in with Google & request', 'Đăng nhập Google & gửi yêu cầu')
                          : L('무료로 요청하기', 'Request for free', 'Gửi yêu cầu miễn phí')}
                  </button>
                  <div className="kcv-cta-note">
                    {L('무료예요. 완성된 이력서는 이메일로 보내드리고, 채용 중인 한국 기업 매칭에도 활용돼요.',
                      "It's free. The finished resume is emailed to you and also used to match you with Korean companies hiring now.",
                      'Hoàn toàn miễn phí. Hồ sơ hoàn chỉnh sẽ được gửi qua email và dùng để kết nối bạn với các công ty Hàn đang tuyển.')}
                  </div>
                  {errMsg && <div className="kcv-err">{errMsg}</div>}
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                    onClick={e => { e.currentTarget.value = '' }}
                    onChange={e => handleFile(e.target.files?.[0])} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
