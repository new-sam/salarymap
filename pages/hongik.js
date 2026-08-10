import { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'
import GlobalNav from '../components/GlobalNav'

/* /hongik — 홍익대학교 국제언어교육원 현장 QR 랜딩.
   포스터 QR → 설명 + Google 로그인 → 가입만 해도 '한국어 가능' 현장 인증
   (/api/hongik/verify 가 korean_cert 마커 기록) → 이어서 CV 업로드하면
   공개 인재풀 등록(korean-cv 와 같은 /api/profile/upload 경로).
   QR 은 utm 없이 짧은 /hongik 그대로 배포한다 — utm 이 없으면 offline/qr/hongik-kli 로 귀속. */

const CAMPAIGN = 'hongik-kli'

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

export default function HongikPage() {
  const { lang } = useT()
  const router = useRouter()
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)

  const [user, setUser] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [verified, setVerified] = useState(null) // /api/hongik/verify 응답
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | submitting | done
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
          if (j.hasResume) setStatus('done') // 재방문: 이미 등록 끝난 사람은 완료 화면으로
          track('hongik_verified', { meta: { ...hkMeta(), set: j.koreanCert }, page: '/hongik' })
        } else {
          setVerified({ ok: false })
        }
      } catch {
        setVerified({ ok: false })
      }
    })()
  }, [user, router.query])

  // 완료 화면 이탈 방지용 공고 (기업 직접등록 우선 → 지원 많은 순, 회사당 1개)
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
      setStatus('done')
    } catch (e) {
      track('hongik_cv_error', { meta: { ...hkMeta(), error_message: e.message }, page: '/hongik' })
      setErrMsg(e.message || L('등록에 실패했어요. 다시 시도해주세요.', 'Upload failed. Please try again.', 'Đăng ký thất bại. Vui lòng thử lại.'))
      setStatus('idle')
    }
  }

  const steps = [
    {
      n: '1',
      t: L('Google 로그인 — 30초', 'Sign in with Google — 30s', 'Đăng nhập Google — 30 giây'),
      s: L('이 페이지로 가입하면 \'한국어 가능 인재\'로 자동 인증돼요. 시험도, 서류도 필요 없어요.',
        "Sign up through this page and you're automatically verified as a Korean-speaking candidate. No test, no documents.",
        'Đăng ký qua trang này, bạn được tự động xác nhận là ứng viên biết tiếng Hàn. Không cần thi, không cần giấy tờ.'),
    },
    {
      n: '2',
      t: L('CV 업로드 — 1분', 'Upload your CV — 1 min', 'Tải CV lên — 1 phút'),
      s: L('지금 쓰는 CV 그대로 올리면 돼요. 베트남어나 영어여도 괜찮아요.',
        'Your current CV as-is — Vietnamese or English is fine.',
        'Dùng CV hiện tại của bạn — tiếng Việt hay tiếng Anh đều được.'),
    },
    {
      n: '3',
      t: L('우선 추천 받기', 'Get recommended first', 'Được ưu tiên giới thiệu'),
      s: L('한국어가 필요한 한국 기업·베트남 현지 포지션에 담당자가 먼저 추천해드려요. 지금은 학생이어도 OK — 미리 등록하면 가장 먼저 연락받아요.',
        "We recommend you first for Korean-company and Vietnam-based positions that need Korean. Still a student? That's fine — register now and you'll be contacted first later.",
        'Chúng tôi ưu tiên giới thiệu bạn cho các vị trí cần tiếng Hàn tại công ty Hàn Quốc và Việt Nam. Đang là sinh viên cũng không sao — đăng ký trước, bạn sẽ được liên hệ đầu tiên.'),
    },
  ]

  const pageTitle = L(
    '한국어 가능 인재 등록 — 홍익대 국제언어교육원 | FYI',
    'Korean-speaker talent registration — Hongik KLI | FYI',
    'Đăng ký ứng viên biết tiếng Hàn — Hongik KLI | FYI',
  )

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
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
        .hk-page { min-height: 100vh; background: #f4f2ee; color: #1a1612; font-family: 'Barlow', -apple-system, sans-serif; padding: 76px 0 90px; }
        .hk-wrap { max-width: 560px; margin: 0 auto; padding: 0 16px; }
        .hk-badge { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #57504a; background: #fff; border: 1px solid #eee6dc; box-shadow: 0 4px 14px rgba(26,22,18,0.06); border-radius: 100px; padding: 7px 15px; margin-bottom: 18px; }
        .hk-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #ff6000; }
        .hk-hero { text-align: center; padding: 28px 0 8px; }
        .hk-h1 { font-size: 30px; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em; margin: 0 0 14px; }
        .hk-h1 em { font-style: normal; color: #ff6000; }
        .hk-sub { font-size: 15px; color: #57504a; line-height: 1.7; margin: 0 auto; }
        .hk-cta { display: block; width: 100%; margin-top: 24px; background: #ff6000; color: #fff; border: none; border-radius: 12px; padding: 16px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background .15s; }
        .hk-cta:hover { background: #ff7a1a; }
        .hk-cta:disabled { opacity: 0.6; cursor: default; }
        .hk-cta-note { margin-top: 10px; font-size: 12.5px; color: #9a9186; text-align: center; }
        .hk-steps { margin-top: 30px; display: flex; flex-direction: column; gap: 10px; }
        .hk-step { display: flex; gap: 14px; align-items: flex-start; background: #fff; border: 1px solid #e8e2da; border-radius: 16px; padding: 18px 16px; }
        .hk-step-n { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,96,0,0.1); color: #e05400; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hk-step-t { font-size: 15px; font-weight: 700; margin-bottom: 5px; line-height: 1.4; }
        .hk-step-s { font-size: 13px; color: #57504a; line-height: 1.65; }
        .hk-trust { margin-top: 22px; background: #fff; border: 1px solid #e8e2da; border-radius: 16px; padding: 18px 16px; font-size: 13px; color: #57504a; line-height: 1.7; }
        .hk-trust b { color: #1a1612; }
        .hk-card { background: #fff; border: 1px solid #e8e2da; border-radius: 18px; padding: 28px 22px; text-align: center; margin-top: 22px; }
        .hk-ok { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.1); color: #15803d; font-size: 13.5px; font-weight: 700; border-radius: 100px; padding: 8px 16px; margin-bottom: 14px; }
        .hk-card-t { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
        .hk-card-s { font-size: 14px; color: #57504a; line-height: 1.7; margin-bottom: 18px; }
        .hk-card-s b { color: #e05400; }
        .hk-drop { border: 1.5px dashed rgba(255,96,0,0.5); background: #fffaf6; border-radius: 14px; padding: 28px 18px; cursor: pointer; transition: background .15s, border-color .15s; }
        .hk-drop:hover, .hk-drop.over { background: #fff3ea; border-color: #ff6000; }
        .hk-drop-t { font-size: 15.5px; font-weight: 700; margin-bottom: 5px; }
        .hk-drop-s { font-size: 12.5px; color: #9a9186; }
        .hk-file { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; background: #f4f2ee; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
        .hk-file button { background: none; border: none; color: #9a9186; font-size: 12px; cursor: pointer; text-decoration: underline; font-family: inherit; }
        .hk-skip { margin-top: 14px; font-size: 12.5px; color: #9a9186; }
        .hk-skip a { color: #e05400; text-decoration: none; font-weight: 600; }
        .hk-err { margin-top: 14px; background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; font-size: 13.5px; border-radius: 10px; padding: 11px 16px; }
        .hk-jobs { margin-top: 36px; }
        .hk-jobs-h { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
        .hk-jobs-s { font-size: 13px; color: #8a8177; margin-bottom: 14px; }
        .hk-job-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #fff; border: 1px solid #e8e2da; border-radius: 14px; padding: 15px 17px; margin-bottom: 10px; text-decoration: none; color: inherit; transition: border-color .15s; }
        .hk-job-card:hover { border-color: rgba(255,96,0,0.5); }
        .hk-job-t { font-size: 14.5px; font-weight: 700; margin-bottom: 3px; }
        .hk-job-c { font-size: 12.5px; color: #8a8177; }
        .hk-job-sal { font-size: 13px; font-weight: 700; color: #e05400; white-space: nowrap; }
        .hk-jobs-all { display: inline-block; margin-top: 6px; font-size: 13.5px; color: #e05400; text-decoration: none; font-weight: 600; }
        @media (max-width: 768px) {
          .hk-page { padding-top: 64px; }
          .hk-h1 { font-size: 26px; }
        }
      `}</style>

      <div className="hk-page">
        <div className="hk-wrap">

          <div className="hk-hero">
            <div className="hk-badge">
              {L('홍익대학교 국제언어교육원 학생 전용', 'For Hongik University KLI students', 'Dành cho học viên KLI ĐH Hongik')}
            </div>
            <h1 className="hk-h1">
              {L(<>한국어 하세요?<br />이제 <em>기업이 먼저</em> 찾습니다</>,
                <>Speak Korean?<br />Let <em>companies find you</em> first</>,
                <>Biết tiếng Hàn?<br />Hãy để <em>công ty tìm đến bạn</em> trước</>)}
            </h1>
            <p className="hk-sub">
              {L('이 페이지로 가입하면 \'한국어 가능 인재\'로 자동 인증돼요. 한국어가 필요한 한국 기업·베트남 현지 포지션에 우선 추천됩니다.',
                "Sign up through this page to be auto-verified as a Korean-speaking candidate — and get recommended first for positions that need Korean.",
                'Đăng ký qua trang này để được tự động xác nhận biết tiếng Hàn — và được ưu tiên giới thiệu cho các vị trí cần tiếng Hàn.')}
            </p>
          </div>

          {status === 'done' ? (
            <>
              <div className="hk-card">
                <div className="hk-ok">✓ {L('한국어 가능 인증 완료', 'Verified as Korean speaker', 'Đã xác nhận biết tiếng Hàn')}</div>
                <div className="hk-card-t">{L('등록 완료!', 'All done!', 'Hoàn tất đăng ký!')}</div>
                <div className="hk-card-s">
                  {L(<>한국어 가능 인재풀에 들어왔어요. 한국어가 필요한 포지션이 열리면 <b>{user?.email}</b>로 가장 먼저 추천해드릴게요.</>,
                    <>You're now in our Korean-speaker talent pool. When a position needs Korean, we'll recommend you first at <b>{user?.email}</b>.</>,
                    <>Bạn đã vào nhóm ứng viên biết tiếng Hàn. Khi có vị trí cần tiếng Hàn, chúng tôi sẽ giới thiệu bạn đầu tiên qua <b>{user?.email}</b>.</>)}
                </div>
              </div>

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
          ) : user ? (
            <div className="hk-card">
              {!verified ? (
                <div className="hk-card-s">{L('인증 처리 중...', 'Verifying...', 'Đang xác nhận...')}</div>
              ) : (
                <>
                  <div className="hk-ok">✓ {L('한국어 가능 인증 완료', 'Verified as Korean speaker', 'Đã xác nhận biết tiếng Hàn')}</div>
                  <div className="hk-card-t">{L('이제 CV만 올리면 끝!', 'One last step — your CV', 'Bước cuối — tải CV lên')}</div>
                  <div className="hk-card-s">
                    {L('CV를 올리면 담당자가 한국어 필요 포지션에 우선 추천해드려요.',
                      'Upload your CV and we recommend you first for positions that need Korean.',
                      'Tải CV lên để được ưu tiên giới thiệu cho các vị trí cần tiếng Hàn.')}
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
                  <button className="hk-cta" onClick={() => (file ? submitCv() : fileRef.current?.click())} disabled={status === 'submitting'}>
                    {status === 'submitting'
                      ? L('등록 중...', 'Uploading...', 'Đang gửi...')
                      : file
                        ? L('인재풀에 등록하기', 'Register to talent pool', 'Đăng ký vào nhóm ứng viên')
                        : L('CV 선택하기', 'Choose your CV', 'Chọn file CV')}
                  </button>
                  <div className="hk-skip">
                    {L('지금 CV가 없나요? 나중에 ', "Don't have your CV now? Upload later in ", 'Chưa có CV? Bạn có thể tải lên sau trong ')}
                    <a href="/profile">{L('프로필', 'your profile', 'hồ sơ cá nhân')}</a>
                    {L('에서 올릴 수 있어요 — 인증은 이미 완료됐어요.', " — you're already verified.", ' — bạn đã được xác nhận rồi.')}
                  </div>
                  {errMsg && <div className="hk-err">{errMsg}</div>}
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                    onClick={e => { e.currentTarget.value = '' }}
                    onChange={e => handleFile(e.target.files?.[0])} />
                </>
              )}
            </div>
          ) : (
            <>
              <button className="hk-cta" onClick={startLogin} disabled={!sessionReady}>
                {L('Google로 시작하기 — 30초', 'Start with Google — 30s', 'Bắt đầu với Google — 30 giây')}
              </button>
              <div className="hk-cta-note">
                {L('무료예요 · 가입만 해도 한국어 인증이 완료돼요', "Free · signing up alone completes your Korean verification", 'Miễn phí · chỉ cần đăng ký là được xác nhận tiếng Hàn')}
              </div>

              <div className="hk-steps">
                {steps.map((s) => (
                  <div key={s.n} className="hk-step">
                    <div className="hk-step-n">{s.n}</div>
                    <div>
                      <div className="hk-step-t">{s.t}</div>
                      <div className="hk-step-s">{s.s}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hk-trust">
                {L(<>저희는 <b>LIKELION</b>이에요. 한국 정부지원사업 <b>K-Tech College</b>를 3년 연속 운영하며 베트남 인재를 한국 기업과 연결해왔어요. FYI는 LIKELION이 운영하는 채용 플랫폼입니다.</>,
                  <>We are <b>LIKELION</b> — we've run <b>K-Tech College</b>, a Korean-government-backed program, for 3 consecutive years, connecting Vietnamese talent with Korean companies. FYI is the hiring platform LIKELION runs.</>,
                  <>Chúng tôi là <b>LIKELION</b> — đơn vị vận hành <b>K-Tech College</b>, chương trình được chính phủ Hàn Quốc hỗ trợ, 3 năm liên tiếp, kết nối nhân tài Việt với doanh nghiệp Hàn. FYI là nền tảng tuyển dụng do LIKELION vận hành.</>)}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
