import { useState, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'
import { idbPutCv, idbGetCv, idbClearCv } from '../lib/pendingCv'
import GlobalNav from '../components/GlobalNav'

/* /korean-cv — CV 업로드 → AI가 한국식 이력서로 변환해주는 무료 툴.
   변환 미리보기까지는 익명, PDF 다운로드에 가입 게이트(다운로드 = 인재풀 등록).
   플로우: 업로드 → /api/korean-cv/parse(익명) → A4 템플릿 미리보기(하단 블러)
   → Google 가입(파일은 IndexedDB, 파싱 결과는 sessionStorage 스태시)
   → 복귀(?continue=1) → /api/profile/upload + 이력서 공개 → 언락 + 인쇄(PDF 저장). */

const DOC_W = 794 // A4 @96dpi

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

const DEGREE_KO = { Associate: '전문학사', Bachelor: '학사', Master: '석사', PhD: '박사' }

function fmtYm(months) {
  const m = Number(months)
  if (!m || m <= 0) return ''
  const y = Math.floor(m / 12)
  const r = m % 12
  if (!y) return `${r}개월`
  return r ? `${y}년 ${r}개월` : `${y}년`
}

/* 미리보기에서 바로 고칠 수 있는 셀 — 파싱 결과가 state 로 한 번만 렌더되므로
   React 가 이후 DOM 텍스트를 건드리지 않아 사용자의 수정이 보존된다.
   빈 값은 CSS(:empty::before)로 회색 placeholder 를 보여주고 인쇄 시엔 숨긴다. */
const Ed = ({ v, ph }) => (
  <span className="kcv-ed" contentEditable suppressContentEditableWarning data-ph={ph || ''}>{v || ''}</span>
)

export default function KoreanCvPage() {
  const { lang } = useT()
  const router = useRouter()
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)

  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | parsing | preview
  const [errMsg, setErrMsg] = useState('')
  const [profile, setProfile] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [regState, setRegState] = useState('idle') // idle | saving | done | error
  const [loadStep, setLoadStep] = useState(0)
  const [jobs, setJobs] = useState([])
  const [scale, setScale] = useState(1)
  const [docH, setDocH] = useState(1123)
  const fileRef = useRef(null)
  const photoRef = useRef(null)
  const docWrapRef = useRef(null)
  const docRef = useRef(null)
  const registeredOnce = useRef(false)

  // 가입만 마치면 언락 — 등록 저장 실패로 다운로드를 인질 잡지 않는다(에러 배너로 재시도 안내).
  const unlocked = !!user && regState !== 'idle'

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

  // 파싱 대기 중 단계 문구 로테이션
  useEffect(() => {
    if (phase !== 'parsing') { setLoadStep(0); return }
    const iv = setInterval(() => setLoadStep(s => Math.min(s + 1, 2)), 3500)
    return () => clearInterval(iv)
  }, [phase])

  // OAuth 복귀: 스태시(파싱 결과 + 파일) 복원 → 자동 등록
  useEffect(() => {
    if (!user || router.query.continue !== '1' || registeredOnce.current) return
    registeredOnce.current = true
    ;(async () => {
      let stashedProfile = null
      try { stashedProfile = JSON.parse(sessionStorage.getItem('kcv_profile') || 'null') } catch {}
      if (!stashedProfile) return
      track('kcv_oauth_return', { meta: kcvMeta(), page: '/korean-cv' })
      setProfile(stashedProfile)
      setPhoto(sessionStorage.getItem('kcv_photo') || null)
      setPhase('preview')
      const stored = await idbGetCv()
      if (stored?.blob) {
        const f = new File([stored.blob], stored.name, { type: stored.type })
        setFile(f)
        doRegister(f)
      } else {
        // 파일 스태시 유실 — 가입은 마쳤으니 다운로드는 열어주고 유실만 기록
        track('kcv_stash_lost', { meta: kcvMeta(), page: '/korean-cv' })
        setRegState('done')
      }
    })()
  }, [user, router.query])

  // 언락 후 지원 유도용 공고 (기업 직접등록 우선 → 지원 많은 순, 회사당 1개)
  useEffect(() => {
    if (!unlocked) return
    fetch('/api/jobs?counts=1')
      .then(r => r.json())
      .then(arr => {
        const list = Array.isArray(arr) ? arr : (arr.jobs || [])
        setJobs(list.filter(j => j.is_active !== false))
      })
      .catch(() => {})
  }, [unlocked])

  const topJobs = useMemo(() => {
    const seen = new Set()
    return jobs
      .slice()
      .sort((a, b) => (a.source === 'company_self' ? 0 : 1) - (b.source === 'company_self' ? 0 : 1)
        || (b.application_count || 0) - (a.application_count || 0))
      .filter(j => { if (seen.has(j.company)) return false; seen.add(j.company); return true })
      .slice(0, 3)
  }, [jobs])

  // A4 폭을 화면에 맞춰 축소 (모바일)
  useEffect(() => {
    if (phase !== 'preview') return
    const calc = () => {
      const w = docWrapRef.current?.clientWidth || DOC_W
      setScale(Math.min(1, w / DOC_W))
      if (docRef.current) setDocH(docRef.current.offsetHeight)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [phase, profile])

  const handleFile = async (f) => {
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
    setPhase('parsing')
    track('kcv_attach_file', { meta: { ...kcvMeta(), ...fileMeta(f) }, page: '/korean-cv' })
    idbPutCv(f).catch(() => {})
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await fetch('/api/korean-cv/parse', { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        throw new Error(j.error === 'unreadable'
          ? L('파일에서 텍스트를 읽지 못했어요. 스캔 이미지가 아닌 텍스트 PDF/Word 파일을 올려주세요.',
              "Couldn't read text from this file. Please upload a text-based PDF/Word file, not a scanned image.",
              'Không đọc được nội dung file. Vui lòng tải lên file PDF/Word dạng văn bản, không phải ảnh scan.')
          : L('변환에 실패했어요. 잠시 후 다시 시도해주세요.', 'Conversion failed. Please try again.', 'Chuyển đổi thất bại. Vui lòng thử lại sau.'))
      }
      setProfile(j.profile)
      setPhoto(j.photo || null)
      try {
        sessionStorage.setItem('kcv_profile', JSON.stringify(j.profile))
        if (j.photo) sessionStorage.setItem('kcv_photo', j.photo)
      } catch {}
      setPhase('preview')
      track('kcv_parse_success', { meta: { ...kcvMeta(), ...fileMeta(f) }, page: '/korean-cv' })
      // 이미 로그인 상태면 게이트 없이 바로 인재풀 등록
      if (user) doRegister(f)
    } catch (e) {
      setErrMsg(e.message)
      setPhase('idle')
      track('kcv_parse_error', { meta: { ...kcvMeta(), ...fileMeta(f), error_message: e.message }, page: '/korean-cv' })
    }
  }

  // 가입 후: 이력서를 프로필에 저장 + 공개(오퍼 수신) — /cv 등록 플로우와 동일한 동작
  const doRegister = async (fileToUpload) => {
    if (!fileToUpload) return
    setRegState('saving')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('not logged in')
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
        throw new Error(e.error || 'upload failed')
      }
      const uid = session.user?.id
      if (uid) await supabase.from('user_profiles').update({ hr_visible: true, job_signal: 'open' }).eq('id', uid)
      fetch('/api/profile/share-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set', value: true }),
      }).catch(() => {})
      if (typeof gtag === 'function') gtag('event', 'korean_cv_register', { source: 'korean-cv' })
      if (typeof fbq === 'function') fbq('trackCustom', 'KoreanCVRegister', { source: 'korean-cv' })
      track('kcv_register_success', { meta: { ...kcvMeta(), ...fileMeta(fileToUpload) }, page: '/korean-cv' })
      await idbClearCv()
      setRegState('done')
    } catch (e) {
      track('kcv_register_error', { meta: { ...kcvMeta(), error_message: e.message }, page: '/korean-cv' })
      setRegState('error')
    }
  }

  const startOauth = async () => {
    localStorage.setItem('fyi_login_return', '/korean-cv?continue=1')
    localStorage.setItem('fyi_intent', 'kcv_signup')
    await track('kcv_oauth_start', { meta: { ...kcvMeta(), provider: 'google' }, page: '/korean-cv' })
    if (window.location.hostname === 'localhost') {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
    } else {
      window.location.href = '/api/auth/google?return=' + encodeURIComponent('/korean-cv?continue=1')
    }
  }

  const download = () => {
    track('kcv_download', { meta: kcvMeta(), page: '/korean-cv' })
    const name = profile?.full_name || 'FYI'
    const prev = document.title
    document.title = `이력서_${name}`
    window.onafterprint = () => { document.title = prev; window.onafterprint = null }
    window.print()
    setTimeout(() => { if (document.title !== prev) document.title = prev }, 3000)
  }

  const reset = () => {
    setPhase('idle'); setProfile(null); setPhoto(null); setFile(null)
    setRegState(user && regState !== 'idle' ? regState : 'idle')
    setErrMsg('')
    try { sessionStorage.removeItem('kcv_profile'); sessionStorage.removeItem('kcv_photo') } catch {}
  }

  const onPickPhoto = (f) => {
    if (!f || !f.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result)
      try { sessionStorage.setItem('kcv_photo', reader.result) } catch {}
    }
    reader.readAsDataURL(f)
  }

  const p = profile || {}
  const rs = p.resume_summary || {}
  const nameLine = rs.name_ko ? `${rs.name_ko} (${p.full_name || ''})` : (p.full_name || '')
  const experiences = Array.isArray(p.experiences) && p.experiences.length
    ? p.experiences
    : [{ company: '', title: '', start: '', end: '', months: 0 }]
  const today = typeof window === 'undefined' ? null : new Date()
  const dateLine = today ? `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일` : ''

  const loadMsgs = [
    L('CV를 읽고 있어요...', 'Reading your CV...', 'Đang đọc CV của bạn...'),
    L('한국식 이력서 양식으로 옮기는 중...', 'Converting to Korean resume format...', 'Đang chuyển sang mẫu hồ sơ chuẩn Hàn Quốc...'),
    L('한국어 요약을 작성하는 중...', 'Writing your Korean summary...', 'Đang viết phần tóm tắt bằng tiếng Hàn...'),
  ]

  return (
    <>
      <Head>
        <title>{L('한국식 이력서 무료 변환 | FYI', 'Free Korean-style Resume Converter | FYI', 'Chuyển CV sang mẫu Hàn Quốc miễn phí | FYI')}</title>
        <meta name="description" content={L(
          'CV를 올리면 AI가 한국 기업이 익숙한 이력서 양식으로 무료 변환해드려요. 한국어 요약 포함.',
          'Upload your CV and AI converts it into the resume format Korean companies expect. Korean summary included. Free.',
          'Tải CV lên, AI sẽ chuyển thành mẫu hồ sơ mà công ty Hàn Quốc quen thuộc — kèm tóm tắt tiếng Hàn. Hoàn toàn miễn phí.',
        )} />
      </Head>
      <GlobalNav activePage="koreanCv" />

      <style>{`
        .kcv-page { min-height: 100vh; background: #f4f2ee; color: #1a1612; font-family: 'Barlow', -apple-system, sans-serif; padding-bottom: 90px; }
        .kcv-wrap { max-width: 900px; margin: 0 auto; padding: 0 16px; }
        .kcv-hero { text-align: center; padding: 64px 0 36px; }
        .kcv-badge { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; color: #e05400; border: 1px solid rgba(255,96,0,0.4); background: rgba(255,96,0,0.08); border-radius: 100px; padding: 5px 14px; margin-bottom: 18px; }
        .kcv-h1 { font-size: 40px; font-weight: 800; line-height: 1.25; letter-spacing: -0.01em; margin: 0 0 14px; }
        .kcv-h1 em { font-style: normal; color: #ff6000; }
        .kcv-sub { font-size: 16px; color: #57504a; line-height: 1.65; max-width: 560px; margin: 0 auto 8px; }
        .kcv-benefits { display: flex; justify-content: center; gap: 22px; flex-wrap: wrap; margin: 26px 0 0; font-size: 13.5px; color: #57504a; }
        .kcv-benefits span::before { content: '✓ '; color: #e05400; font-weight: 800; }
        .kcv-drop { max-width: 560px; margin: 34px auto 0; border: 1.5px dashed rgba(255,96,0,0.5); background: #fff; border-radius: 18px; padding: 42px 24px; text-align: center; cursor: pointer; transition: background .15s, border-color .15s; box-shadow: 0 4px 18px rgba(26,22,18,0.05); }
        .kcv-drop:hover, .kcv-drop.over { background: #fff7f2; border-color: #ff6000; }
        .kcv-drop-ico { font-size: 34px; margin-bottom: 12px; }
        .kcv-drop-t { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
        .kcv-drop-s { font-size: 13px; color: #9a9186; }
        .kcv-err { max-width: 560px; margin: 14px auto 0; background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.3); color: #b91c1c; font-size: 13.5px; border-radius: 10px; padding: 11px 16px; text-align: center; }
        .kcv-loading { max-width: 560px; margin: 60px auto; text-align: center; padding: 48px 24px; background: #fff; border: 1px solid #e8e2da; border-radius: 18px; }
        .kcv-spinner { width: 34px; height: 34px; border: 3px solid rgba(255,96,0,0.18); border-top-color: #ff6000; border-radius: 50%; margin: 0 auto 20px; animation: kcvSpin 0.9s linear infinite; }
        @keyframes kcvSpin { to { transform: rotate(360deg); } }
        .kcv-loading-t { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .kcv-loading-s { font-size: 13px; color: #9a9186; }

        .kcv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 34px 0 16px; }
        .kcv-toolbar-hint { font-size: 13px; color: #57504a; }
        .kcv-toolbar-hint b { color: #e05400; font-weight: 700; }
        .kcv-btns { display: flex; gap: 10px; }
        .kcv-btn { border: none; border-radius: 100px; padding: 11px 22px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all .15s; }
        .kcv-btn-primary { background: #ff6000; color: #fff; }
        .kcv-btn-primary:hover { background: #ff7a1a; }
        .kcv-btn-ghost { background: #fff; color: #57504a; border: 1px solid #d8d0c6; }
        .kcv-btn-ghost:hover { color: #1a1612; border-color: #b6ac9f; }
        .kcv-reg-err { margin: 0 0 14px; background: #fff7e6; border: 1px solid #ecd9ab; color: #8a6a15; font-size: 13px; border-radius: 10px; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .kcv-reg-err button { background: none; border: 1px solid #d4b978; color: #8a6a15; border-radius: 100px; padding: 5px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }

        .kcv-doc-outer { position: relative; }
        .kcv-doc { width: ${DOC_W}px; min-height: 1123px; background: #fff; color: #1c1712; padding: 52px 58px; box-shadow: 0 18px 60px rgba(26,22,18,0.16); border: 1px solid #e8e2da; border-radius: 3px; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', sans-serif; }
        .kcv-doc-title { font-size: 30px; font-weight: 800; letter-spacing: 20px; text-indent: 20px; text-align: center; margin: 0 0 30px; }
        .kcv-h { display: flex; align-items: baseline; gap: 8px; font-size: 14.5px; font-weight: 800; margin: 26px 0 8px; }
        .kcv-h small { font-size: 11px; font-weight: 600; color: #9a8f83; }
        .kcv-tb { width: 100%; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
        .kcv-tb th, .kcv-tb td { border: 1px solid #8f877d; padding: 8px 10px; text-align: left; vertical-align: middle; word-break: break-word; }
        .kcv-tb th { background: #f4f0ea; font-weight: 700; width: 92px; }
        .kcv-tb thead th { width: auto; text-align: center; }
        .kcv-photo-cell { width: 116px !important; text-align: center !important; padding: 6px !important; }
        .kcv-photo { width: 96px; height: 128px; object-fit: cover; display: block; margin: 0 auto; cursor: pointer; }
        .kcv-photo-ph { width: 96px; height: 128px; margin: 0 auto; border: 1px dashed #b6ac9f; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px; color: #a79b8d; cursor: pointer; }
        .kcv-photo-hint { font-size: 10px; color: #b0a496; margin-top: 4px; }
        .kcv-skills { border: 1px solid #8f877d; padding: 10px 12px; font-size: 12.5px; line-height: 1.7; }
        .kcv-bullets { margin: 0; padding: 0 0 0 4px; list-style: none; }
        .kcv-bullets li { font-size: 12.5px; line-height: 1.7; padding: 3px 0 3px 16px; position: relative; }
        .kcv-bullets li::before { content: '•'; position: absolute; left: 2px; color: #1c1712; }
        .kcv-foot { margin-top: 44px; text-align: center; font-size: 12.5px; line-height: 2; }
        .kcv-foot .kcv-sign { margin-top: 8px; }
        .kcv-ed { display: block; width: 100%; min-height: 1em; outline: none; border-radius: 2px; }
        .kcv-ed:hover { background: rgba(255,96,0,0.06); }
        .kcv-ed:focus { background: rgba(255,96,0,0.09); box-shadow: inset 0 0 0 1px rgba(255,96,0,0.4); }
        .kcv-ed:empty::before { content: attr(data-ph); color: #b9ae9f; }

        .kcv-gate { position: absolute; left: 0; right: 0; bottom: 0; top: 38%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); background: linear-gradient(180deg, rgba(244,242,238,0) 0%, rgba(244,242,238,0.85) 26%, rgba(244,242,238,0.97) 100%); border-radius: 3px; }
        .kcv-gate-card { text-align: center; max-width: 400px; padding: 0 20px; }
        .kcv-gate-t { font-size: 21px; font-weight: 800; line-height: 1.4; margin-bottom: 10px; color: #1a1612; }
        .kcv-gate-s { font-size: 13.5px; color: #57504a; line-height: 1.65; margin-bottom: 22px; }
        .kcv-gate-btn { display: inline-flex; align-items: center; gap: 10px; background: #fff; color: #1c1712; border: 1px solid #d8d0c6; border-radius: 100px; padding: 14px 26px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 16px rgba(26,22,18,0.1); transition: transform .12s, box-shadow .12s; }
        .kcv-gate-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(26,22,18,0.16); }

        .kcv-jobs { margin-top: 52px; }
        .kcv-jobs-h { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
        .kcv-jobs-s { font-size: 13.5px; color: #8a8177; margin-bottom: 18px; }
        .kcv-job-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #fff; border: 1px solid #e8e2da; border-radius: 14px; padding: 16px 18px; margin-bottom: 10px; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; }
        .kcv-job-card:hover { border-color: rgba(255,96,0,0.5); box-shadow: 0 4px 16px rgba(26,22,18,0.07); }
        .kcv-job-t { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
        .kcv-job-c { font-size: 12.5px; color: #8a8177; }
        .kcv-job-sal { font-size: 13px; font-weight: 700; color: #e05400; white-space: nowrap; }
        .kcv-jobs-all { display: inline-block; margin-top: 8px; font-size: 13.5px; color: #e05400; text-decoration: none; font-weight: 600; }

        @media (max-width: 768px) {
          .kcv-page { padding-top: 52px; }
          .kcv-hero { padding: 40px 0 26px; }
          .kcv-h1 { font-size: 28px; }
          .kcv-sub { font-size: 14.5px; }
          .kcv-toolbar { flex-direction: column; align-items: stretch; }
          .kcv-btns { justify-content: stretch; }
          .kcv-btn { flex: 1; }
        }

        @media print {
          body * { visibility: hidden !important; }
          .kcv-doc, .kcv-doc * { visibility: visible !important; }
          /* outer 를 static 으로 풀어야 doc 의 absolute 기준이 페이지가 되어
             위쪽 내비/툴바 공간 없이 1페이지 맨 위부터 찍힌다. */
          .kcv-doc-outer { position: static !important; height: auto !important; }
          .kcv-doc { position: absolute; left: 0; top: 0; width: 100%; min-height: 0; margin: 0; padding: 0; box-shadow: none; border-radius: 0; transform: none !important; }
          .kcv-gate, .kcv-photo-hint { display: none !important; }
          .kcv-ed:empty::before { content: '' !important; }
          .kcv-ed:hover, .kcv-ed:focus { background: none !important; box-shadow: none !important; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>

      <div className="kcv-page">
        <div className="kcv-wrap">

          {phase === 'idle' && (
            <div className="kcv-hero">
              <div className="kcv-badge">{L('100% 무료', '100% FREE', 'MIỄN PHÍ 100%')}</div>
              <h1 className="kcv-h1">
                {L(<>내 CV를 <em>한국식 이력서</em>로</>, <>Turn your CV into a <em>Korean-style resume</em></>, <>Biến CV của bạn thành <em>hồ sơ chuẩn Hàn Quốc</em></>)}
              </h1>
              <p className="kcv-sub">
                {L('AI가 CV를 한국식 이력서로 바꿔주는 건 시작일 뿐이에요. 완성된 프로필은 FYI에서 채용 중인 한국 기업들에 전달되고, 기업이 먼저 연락해요.',
                  'AI converting your CV is just the start. Your finished profile reaches Korean companies hiring on FYI — and they contact you first.',
                  'AI chuyển CV của bạn sang mẫu Hàn Quốc chỉ là bước đầu. Hồ sơ hoàn chỉnh sẽ được gửi đến các công ty Hàn Quốc đang tuyển trên FYI — và nhà tuyển dụng sẽ chủ động liên hệ với bạn.')}
              </p>
              <div className="kcv-benefits">
                <span>{L('한국 표준 양식 + 한국어 요약', 'Korean format + Korean summary', 'Mẫu chuẩn Hàn + tóm tắt tiếng Hàn')}</span>
                <span>{L('채용 중인 한국 기업에 프로필 전달', 'Sent to Korean companies hiring now', 'Gửi đến công ty Hàn đang tuyển')}</span>
                <span>{L('PDF 다운로드 무료', 'Free PDF download', 'Tải PDF miễn phí')}</span>
              </div>

              <div
                className="kcv-drop"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                onDragLeave={e => e.currentTarget.classList.remove('over')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); handleFile(e.dataTransfer.files?.[0]) }}
              >
                <div className="kcv-drop-ico">📄</div>
                <div className="kcv-drop-t">{L('CV 파일 올리기', 'Upload your CV', 'Tải file CV lên')}</div>
                <div className="kcv-drop-s">{L('클릭 또는 드래그 · PDF, DOC, DOCX · 최대 10MB', 'Click or drag & drop · PDF, DOC, DOCX · max 10MB', 'Nhấp hoặc kéo thả · PDF, DOC, DOCX · tối đa 10MB')}</div>
              </div>
              {errMsg && <div className="kcv-err">{errMsg}</div>}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                onClick={e => { e.currentTarget.value = '' }}
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {phase === 'parsing' && (
            <div className="kcv-loading">
              <div className="kcv-spinner" />
              <div className="kcv-loading-t">{loadMsgs[loadStep]}</div>
              <div className="kcv-loading-s">{L('10~20초 정도 걸려요', 'Takes about 10–20 seconds', 'Mất khoảng 10–20 giây')}</div>
            </div>
          )}

          {phase === 'preview' && profile && (
            <>
              <div className="kcv-toolbar">
                <div className="kcv-toolbar-hint">
                  {unlocked
                    ? L(<><b>완성!</b> 이력서의 아무 칸이나 눌러 바로 수정할 수 있어요.</>,
                        <><b>Done!</b> Click any field on the resume to edit it before downloading.</>,
                        <><b>Xong!</b> Nhấp vào bất kỳ ô nào trên hồ sơ để chỉnh sửa trước khi tải.</>)
                    : L('변환이 끝났어요 — 아래에서 미리보기를 확인하세요.',
                        'Conversion complete — preview your resume below.',
                        'Chuyển đổi hoàn tất — xem trước hồ sơ của bạn bên dưới.')}
                </div>
                <div className="kcv-btns">
                  <button className="kcv-btn kcv-btn-ghost" onClick={reset}>{L('다른 파일로 다시', 'Start over', 'Làm lại với file khác')}</button>
                  {unlocked && (
                    <button className="kcv-btn kcv-btn-primary" onClick={download}>
                      {regState === 'saving' ? L('저장 중...', 'Saving...', 'Đang lưu...') : L('PDF 다운로드', 'Download PDF', 'Tải PDF')}
                    </button>
                  )}
                </div>
              </div>

              {regState === 'error' && (
                <div className="kcv-reg-err">
                  <span>{L('이력서를 프로필에 저장하지 못했어요.', "Couldn't save the resume to your profile.", 'Chưa lưu được CV vào hồ sơ của bạn.')}</span>
                  <button onClick={() => doRegister(file)}>{L('다시 시도', 'Retry', 'Thử lại')}</button>
                </div>
              )}

              <div ref={docWrapRef}>
                <div className="kcv-doc-outer" style={{ height: docH * scale }}>
                  <div ref={docRef} className="kcv-doc" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <h2 className="kcv-doc-title">이력서</h2>

                    <table className="kcv-tb">
                      <tbody>
                        <tr>
                          <td className="kcv-photo-cell" rowSpan={4}>
                            {photo ? (
                              <img src={photo} className="kcv-photo" alt="" onClick={() => photoRef.current?.click()} />
                            ) : (
                              <div className="kcv-photo-ph" onClick={() => photoRef.current?.click()}>
                                <span style={{ fontSize: 20 }}>+</span>
                                <span>{L('사진 추가', 'Add photo', 'Thêm ảnh')}</span>
                              </div>
                            )}
                            <div className="kcv-photo-hint">{L('클릭해서 교체', 'Click to change', 'Nhấp để đổi ảnh')}</div>
                          </td>
                          <th>성명</th>
                          <td><Ed v={nameLine} ph={L('이름', 'Name', 'Họ tên')} /></td>
                          <th>생년월일</th>
                          <td><Ed v="" ph="YYYY.MM.DD" /></td>
                        </tr>
                        <tr>
                          <th>연락처</th>
                          <td><Ed v="" ph="+84 " /></td>
                          <th>이메일</th>
                          <td><Ed v={user?.email || ''} ph="email" /></td>
                        </tr>
                        <tr>
                          <th>거주지</th>
                          <td><Ed v={p.location} ph={L('도시, 국가', 'City, Country', 'Thành phố, Quốc gia')} /></td>
                          <th>총 경력</th>
                          <td><Ed v={fmtYm(p.yoe_months)} ph={L('신입', 'Entry level', 'Chưa có kinh nghiệm')} /></td>
                        </tr>
                        <tr>
                          <th>희망 직무</th>
                          <td colSpan={3}><Ed v={p.headline || p.position} ph={L('직무', 'Role', 'Vị trí mong muốn')} /></td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="kcv-h">학력사항 <small>Học vấn</small></div>
                    <table className="kcv-tb">
                      <thead>
                        <tr><th>졸업연도</th><th>학교명</th><th>전공</th><th>학위</th></tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'center' }}><Ed v={p.graduation_year} ph="YYYY" /></td>
                          <td><Ed v={p.university} ph={L('학교명', 'School', 'Tên trường')} /></td>
                          <td><Ed v={p.major} ph={L('전공', 'Major', 'Chuyên ngành')} /></td>
                          <td style={{ textAlign: 'center' }}><Ed v={DEGREE_KO[rs.degree] || rs.degree} ph="학사" /></td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="kcv-h">경력사항 <small>Kinh nghiệm làm việc</small></div>
                    <table className="kcv-tb">
                      <thead>
                        <tr><th style={{ width: 150 }}>기간</th><th>회사명</th><th>직위</th><th style={{ width: 100 }}>근무기간</th></tr>
                      </thead>
                      <tbody>
                        {experiences.map((e, i) => (
                          <tr key={i}>
                            <td><Ed v={[e.start, e.end === 'Present' ? '재직중' : e.end].filter(Boolean).join(' ~ ')} ph="YYYY.MM ~" /></td>
                            <td><Ed v={e.company} ph={L('회사명', 'Company', 'Công ty')} /></td>
                            <td><Ed v={e.title} ph={L('직위', 'Title', 'Chức vụ')} /></td>
                            <td style={{ textAlign: 'center' }}><Ed v={fmtYm(e.months)} ph="-" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="kcv-h">어학 및 자격 <small>Ngoại ngữ & Chứng chỉ</small></div>
                    <table className="kcv-tb">
                      <tbody>
                        <tr>
                          <th>한국어</th>
                          <td><Ed v={p.korean_cert} ph={L('예: TOPIK 5급', 'e.g. TOPIK Level 5', 'VD: TOPIK cấp 5')} /></td>
                          <th>영어</th>
                          <td><Ed v={p.english_cert} ph={L('예: TOEIC 900', 'e.g. TOEIC 900', 'VD: TOEIC 900')} /></td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="kcv-h">보유 기술 <small>Kỹ năng</small></div>
                    <div className="kcv-skills">
                      <Ed v={(p.skills || []).join(', ')} ph={L('기술을 입력하세요', 'List your skills', 'Nhập kỹ năng của bạn')} />
                    </div>

                    {Array.isArray(rs.bullets) && rs.bullets.length > 0 && (
                      <>
                        <div className="kcv-h">핵심 역량 <small>Điểm mạnh nổi bật</small></div>
                        <ul className="kcv-bullets">
                          {rs.bullets.map((b, i) => <li key={i}><Ed v={b} /></li>)}
                        </ul>
                      </>
                    )}

                    <div className="kcv-foot">
                      <div>위 기재 내용은 사실과 다름이 없습니다.</div>
                      <div>{dateLine}</div>
                      <div className="kcv-sign">작성자: {p.full_name || ''} (인)</div>
                    </div>
                  </div>

                  {!unlocked && (
                    <div className="kcv-gate">
                      <div className="kcv-gate-card">
                        <div className="kcv-gate-t">
                          {L('이력서가 완성됐어요!', 'Your Korean resume is ready!', 'Hồ sơ chuẩn Hàn của bạn đã sẵn sàng!')}
                        </div>
                        <div className="kcv-gate-s">
                          {L('무료 로그인하면 PDF 다운로드는 물론, 이 프로필이 채용 중인 한국 기업들에 전달돼 면접 제안을 받을 수 있어요.',
                            'Sign in free to download the PDF — and your profile reaches Korean companies hiring now, so interview offers come to you.',
                            'Đăng nhập miễn phí để tải PDF — hồ sơ của bạn cũng sẽ đến tay các công ty Hàn Quốc đang tuyển, và lời mời phỏng vấn sẽ tự tìm đến bạn.')}
                        </div>
                        <button className="kcv-gate-btn" onClick={startOauth}>
                          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                          {L('Google로 무료 다운로드', 'Free download with Google', 'Tải miễn phí với Google')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }}
                onClick={e => { e.currentTarget.value = '' }}
                onChange={e => onPickPhoto(e.target.files?.[0])} />

              {unlocked && topJobs.length > 0 && (
                <div className="kcv-jobs">
                  <div className="kcv-jobs-h">{L('이 이력서로 바로 지원해보세요', 'Apply now with your new resume', 'Ứng tuyển ngay với hồ sơ mới của bạn')}</div>
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
          )}
        </div>
      </div>
    </>
  )
}
