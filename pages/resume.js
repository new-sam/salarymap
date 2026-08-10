import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'
import { idbPutCv, idbGetCv, idbClearCv } from '../lib/pendingCv'
import supabaseAdmin from '../lib/supabaseAdmin'
import QuickApplyJobList from '../components/jobs/QuickApplyJobList'

/* /resume — 이력서 등록 페이지.
   /cv 와 문이 둘로 갈린다: /cv 는 "입사 축하금"으로 들어오는 광고 랜딩,
   여기는 "지금 연봉보다 높은 자리 + 열려 있는 공고 수"로 들어오는 내비 상시 문.
   훅을 가른 근거는 소재별 전환 실측 — 같은 랜딩·같은 기간에 축하금 소재(4.4%)가
   일자리 소재(10.3%)의 절반도 안 됐다.

   업로드 흐름은 /cv 에서 검증된 것을 그대로 쓴다(파일 → IndexedDB 보관 → OAuth
   왕복 → ?continue=1 로 복귀해 자동 업로드). 비회원도 여기서 끝까지 갈 수 있어야
   해서 /profile#resume 를 여는 대신 새 라우트로 뒀다 — /profile 은 로그인 필수다. */

function rMeta() {
  if (typeof window === 'undefined') return {}
  return {
    utm_source: sessionStorage.getItem('utm_source') || null,
    utm_medium: sessionStorage.getItem('utm_medium') || null,
    utm_campaign: sessionStorage.getItem('utm_campaign') || null,
    utm_content: sessionStorage.getItem('utm_content') || null,
    utm_term: sessionStorage.getItem('utm_term') || null,
    lang: localStorage.getItem('fyi_lang') || 'ko',
  }
}
function fileMeta(f) {
  if (!f) return {}
  return { file_ext: (f.name.split('.').pop() || '').toLowerCase(), file_size: f.size }
}

const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
)
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
)
const IconGoogle = () => (
  <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C37 41.2 44 36 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
)
const IconLinkedIn = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.59 0 4.25 2.36 4.25 5.44v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
)

export default function ResumePage({ jobCount }) {
  const { t, lang } = useT()
  const router = useRouter()
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)

  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const [pendingHint, setPendingHint] = useState('')
  const [existingResume, setExistingResume] = useState(null)
  const [replacing, setReplacing] = useState(false)
  // 등록 완료 후 보여줄 맞는 공고. matched=false 면 매칭 근거가 없어 최근 공고로 채운 것이라
  // 제목을 "맞는 공고"라고 달지 않는다.
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState([])
  const [matched, setMatched] = useState(false)
  const replacePick = useRef(false)
  const fileRef = useRef(null)
  const formRef = useRef(null)
  // 파일 없이 로그인 CTA를 누르면 파일 선택창을 먼저 열고, 고른 뒤 이어서 OAuth로 넘긴다.
  const oauthAfterPick = useRef(null)

  const showSuccess = status === 'success'
  // 서버·클라이언트가 같은 문자열을 그려야 하이드레이션이 안 깨진다 — 로케일을 고정한다.
  const jobLabel = jobCount.toLocaleString('en-US')

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = p.get(k)
      if (v) sessionStorage.setItem(k, v)
    })
    track('resume_view', { meta: rMeta(), page: '/resume' })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  // OAuth 화면에서 뒤로가기로 돌아오면 iOS가 bfcache로 복원한다 — 자동 OAuth 트리거가
  // armed 로 남아 있으면 재첨부하자마자 다시 튕기므로 해제한다. (/cv 와 동일)
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

  const oauthReturnTracked = useRef(false)

  // OAuth 복귀 — IndexedDB에 넣어둔 파일을 꺼내 자동 업로드한다.
  useEffect(() => {
    if (!user || router.query.continue !== '1') return
    if (!oauthReturnTracked.current) {
      oauthReturnTracked.current = true
      track('resume_oauth_return', { meta: rMeta(), page: '/resume' })
    }
    let cancelled = false
    ;(async () => {
      const stored = await idbGetCv()
      if (cancelled) return
      if (stored?.blob) {
        const f = new File([stored.blob], stored.name, { type: stored.type })
        setFile(f)
        scrollToForm()
        setTimeout(() => doUpload(f), 400)
        return
      }
      // IndexedDB를 못 쓰는 브라우저 — 파일명만 힌트로 남기고 선택창을 다시 연다.
      const hint = sessionStorage.getItem('cv_pending_filename')
      if (hint) {
        setPendingHint(hint)
        sessionStorage.removeItem('cv_pending_filename')
        setTimeout(() => { scrollToForm(); fileRef.current?.click() }, 300)
      }
    })()
    return () => { cancelled = true }
  }, [user, router.query])

  const handleFile = (f) => {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      setErrMsg(t('cv.err.fileTooBig'))
      track('resume_attach_rejected', { meta: { ...rMeta(), ...fileMeta(f), reason: 'too_big' }, page: '/resume' })
      return
    }
    setFile(f)
    setErrMsg('')
    track('resume_attach_file', { meta: { ...rMeta(), ...fileMeta(f) }, page: '/resume' })
    idbPutCv(f).catch(() => {
      try { sessionStorage.setItem('cv_pending_filename', f.name) } catch {}
    })
    // 등록됨 화면에서 "교체"로 고른 경우 — 이미 로그인 상태라 바로 올린다.
    if (replacePick.current && user) {
      replacePick.current = false
      setReplacing(true)
      doUpload(f)
      return
    }
    const pending = oauthAfterPick.current
    if (pending && !user) {
      oauthAfterPick.current = null
      setTimeout(() => startOauth(pending, true), 150)
    }
  }

  // 리다이렉트가 전송 중인 요청을 죽인다 — track 을 기다린 뒤에 넘어간다.
  const startOauth = async (provider, auto) => {
    localStorage.setItem('fyi_login_return', '/resume?continue=1')
    localStorage.setItem('fyi_intent', 'resume_signup')
    await track('resume_oauth_start', { meta: { ...rMeta(), provider, has_file: true, auto }, page: '/resume' })
    if (provider === 'linkedin') {
      supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: window.location.origin + '/auth/callback?intent=resume_signup&return=' + encodeURIComponent('/resume?continue=1'),
          scopes: 'openid profile email',
        },
      })
    } else {
      window.location.href = '/api/auth/google?return=' + encodeURIComponent('/resume?continue=1')
    }
  }

  /* 이력서를 읽어 프로필(직무·연차·스킬)을 채운 다음 그걸로 공고를 고른다. 파싱 없이는
     매칭할 근거가 없다 — 이 페이지는 파일만 받고 직무를 묻지 않는다.
     파싱이 실패해도 매칭은 시도한다: 기존 등록자는 프로필에 이미 값이 있을 수 있다. */
  const loadMatches = async (token) => {
    setMatchLoading(true)
    try {
      try {
        await fetch('/api/profile/parse-resume', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      } catch {}
      const r = await fetch('/api/resume/matched-jobs', { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) return
      const d = await r.json()
      setMatched(!!d.matched)
      setMatchedJobs(d.jobs || [])
      track('resume_match_shown', { meta: { ...rMeta(), matched: !!d.matched, count: (d.jobs || []).length }, page: '/resume' })
    } catch {
      // 목록이 없으면 완료 화면은 기존의 '공고 보기' 버튼으로 떨어진다 — 막을 이유는 없다.
    } finally {
      setMatchLoading(false)
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
        headers: { Authorization: `Bearer ${token}`, 'X-Resume-Source': 'resume' },
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
      // /cv 와 같이 기업 오퍼용으로 공개 처리한다. 웹훅이 느릴 수 있어 기다리지 않는다.
      fetch('/api/profile/share-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set', value: true }),
      }).catch(() => {})
      track('resume_register_success', { meta: { ...rMeta(), ...fileMeta(fileToUpload) }, page: '/resume' })
      await idbClearCv()
      setStatus('success')
      // 완료 화면을 먼저 띄우고 목록은 뒤따라 채운다 — 파싱까지 기다리면 몇 초간 빈 화면이다.
      loadMatches(token)
    } catch (e) {
      const msg = e.message || t('cv.err.generic')
      track('resume_register_error', { meta: { ...rMeta(), ...fileMeta(fileToUpload), error_message: msg }, page: '/resume' })
      setErrMsg(msg)
      setStatus('error')
    } finally {
      setReplacing(false)
    }
  }

  const onSubmit = (provider) => {
    if (!file) {
      if (!user) oauthAfterPick.current = provider
      track('resume_click_cta', { meta: { ...rMeta(), provider, has_file: false }, page: '/resume' })
      fileRef.current?.click()
      return
    }
    if (!user) return startOauth(provider, false)
    doUpload(file)
  }

  const uploading = status === 'uploading'

  return (
    <>
      <Head>
        <title>{t('resume.meta.title')}</title>
        <meta name="description" content={t('resume.meta.description')} />
      </Head>

      <main className="rsm">
        {/* ───── HERO ───── */}
        <section className="rsm-hero">
          <div className="rsm-hero-grid" aria-hidden />
          <div className="rsm-hero-inner">
            <h1 className="rsm-h1">
              <span className="rsm-h1-soft">{t('resume.hero.line1')}</span>
              <span className="rsm-h1-main">
                <em data-text={jobLabel}>{jobLabel}</em>{t('resume.hero.line2Suffix')}
              </span>
            </h1>
            <p className="rsm-hero-sub">{t('resume.hero.sub')}</p>
            <button
              type="button"
              className="rsm-btn rsm-btn-hero"
              onClick={() => {
                track('resume_click_hero_cta', { meta: rMeta(), page: '/resume' })
                scrollToForm()
              }}
            >
              {t('resume.hero.cta')} <IconArrowRight />
            </button>
            <p className="rsm-hero-note">{t('resume.hero.note')}</p>
          </div>
        </section>

        {/* ───── FORM ───── */}
        <section className="rsm-form" ref={formRef}>
          <div className="rsm-form-inner">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              hidden
              onClick={(e) => { e.currentTarget.value = '' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {showSuccess ? (
              <div className="rsm-card rsm-card-done">
                <div className="rsm-done-mark"><IconCheck /></div>
                <h2 className="rsm-card-h">{t('resume.success.heading')}</h2>
                <p className="rsm-card-sub">{t('resume.success.sub')}</p>
                {matchLoading ? (
                  <div className="rsm-match-wait">
                    <div className="rsm-spinner" />
                    <span>{t('resume.match.loading')}</span>
                  </div>
                ) : matchedJobs.length ? (
                  <div className="rsm-match">
                    <div className="rsm-match-h">{matched ? t('resume.match.heading') : t('resume.match.headingRecent')}</div>
                    <QuickApplyJobList jobs={matchedJobs} page="/resume" source="resume_success" />
                  </div>
                ) : (
                  <a href="/jobs" className="rsm-btn">{t('resume.success.cta')} <IconArrowRight /></a>
                )}
              </div>
            ) : existingResume && status === 'idle' && router.query.continue !== '1' ? (
              <div className="rsm-card rsm-card-done">
                <div className="rsm-done-mark"><IconCheck /></div>
                <h2 className="rsm-card-h">{t('resume.existing.heading')}</h2>
                <p className="rsm-card-sub">{t('resume.existing.sub')}</p>
                {errMsg && <div className="rsm-err">{errMsg}</div>}
                <a href="/jobs" className="rsm-btn">{t('resume.success.cta')} <IconArrowRight /></a>
                <button
                  type="button"
                  className="rsm-replace"
                  onClick={() => { replacePick.current = true; fileRef.current?.click() }}
                >
                  {t('resume.existing.replace')}
                </button>
              </div>
            ) : uploading && (router.query.continue === '1' || replacing) ? (
              <div className="rsm-card rsm-card-done">
                <div className="rsm-spinner" />
                <h2 className="rsm-card-h">{t('resume.uploading.heading')}</h2>
                <p className="rsm-card-sub">{t('resume.uploading.sub')}</p>
              </div>
            ) : (
              <div className="rsm-card">
                <h2 className="rsm-card-h">{t('resume.form.heading')}</h2>
                <p className="rsm-card-sub">{t('resume.form.sub')}</p>

                {pendingHint && (
                  <div className="rsm-hint-bubble">
                    <IconCheck />
                    <span>{t('cv.form.pendingPrefix')}<b>{pendingHint}</b>{t('cv.form.pendingSuffix')}</span>
                  </div>
                )}

                {/* STEP 1 — 파일 */}
                <div className={`rsm-step${file ? ' done' : ''}`}>
                  <div className="rsm-step-label">
                    <span className="rsm-step-num">{file ? <IconCheck /> : '1'}</span>
                    {t('resume.form.step1')}
                  </div>
                  {file ? (
                    <div className="rsm-file">
                      <div className="rsm-file-meta">
                        <div className="rsm-file-name">{file.name}</div>
                        <div className="rsm-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                      </div>
                      <button type="button" className="rsm-change" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {t('cv.form.changeFile')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rsm-drop"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
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
                      <span>{t('cv.form.dropZone')}</span>
                    </button>
                  )}
                  <div className="rsm-fine-hint">{t('cv.form.fileHint')}</div>
                </div>

                {/* STEP 2 — 로그인(비회원) 또는 등록(회원) */}
                <div className={`rsm-step${!file ? ' inactive' : ''}`}>
                  <div className="rsm-step-label">
                    <span className="rsm-step-num">2</span>
                    {user ? t('resume.form.step2Member') : t('resume.form.step2Guest')}
                  </div>

                  {errMsg && <div className="rsm-err">{errMsg}</div>}

                  <button className="rsm-btn" onClick={() => onSubmit('google')} disabled={uploading}>
                    {uploading ? t('cv.form.uploading')
                      : user ? <>{t('resume.form.ctaRegister')} <IconArrowRight /></>
                        : <><IconGoogle />{t('cv.form.cta.google')} <IconArrowRight /></>}
                  </button>

                  {!user && (
                    <>
                      <div className="rsm-or"><span>{t('cv.form.or')}</span></div>
                      <button className="rsm-btn-linkedin" onClick={() => onSubmit('linkedin')} disabled={uploading}>
                        <IconLinkedIn />{t('cv.form.cta.linkedin')}
                      </button>
                    </>
                  )}
                </div>

                <div className="rsm-fine">
                  {t('cv.form.fine.body')}
                  <br />
                  <a href="/terms">{t('cv.form.fine.terms')}</a> · <a href="/privacy">{t('cv.form.fine.privacy')}</a>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <style jsx>{`
        .rsm { background: #f7f5f1; }

        /* ── HERO ── */
        .rsm-hero {
          position: relative;
          overflow: hidden;
          padding: clamp(56px, 9vh, 104px) 24px clamp(48px, 7vh, 88px);
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(760px circle at 50% 34%, rgba(255,96,0,0.16), transparent 58%),
            #000;
        }
        .rsm-hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: radial-gradient(ellipse 70% 65% at center, #000 30%, transparent 90%);
          -webkit-mask-image: radial-gradient(ellipse 70% 65% at center, #000 30%, transparent 90%);
          pointer-events: none;
        }
        .rsm-hero-inner {
          position: relative;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .rsm-h1 {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          margin: 0;
          color: #fff;
          font-weight: 900;
          line-height: 1.14;
          letter-spacing: -1.8px;
          font-size: clamp(30px, min(4.6vw, 8vh), 60px);
        }
        .rsm-h1-soft {
          font-size: 0.5em;
          font-weight: 600;
          letter-spacing: -0.6px;
          color: rgba(255,255,255,0.82);
        }
        .rsm-h1-main { display: block; }
        .rsm-h1-main em {
          font-style: normal;
          color: #ff8a40;
          font-variant-numeric: tabular-nums;
          font-size: 1.1em;
          letter-spacing: -2.2px;
          position: relative;
          display: inline-block;
          text-shadow: 0 0 28px rgba(255,138,64,0.5), 0 0 56px rgba(255,96,0,0.3);
        }
        /* 숫자 위로 광택 밴드를 흘려보낸다 — 같은 글자를 한 겹 더 깔고 글자 모양으로 잘라낸다. */
        .rsm-h1-main em::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          pointer-events: none;
          background-image: linear-gradient(100deg, rgba(255,255,255,0) 44%, rgba(255,245,230,0.92) 50%, rgba(255,255,255,0) 56%);
          background-size: 250% 100%;
          background-repeat: no-repeat;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: rsmShine 4.5s ease-in-out infinite;
        }
        @keyframes rsmShine {
          0% { background-position: 120% 0; }
          45%, 100% { background-position: -20% 0; }
        }
        .rsm-hero-sub {
          margin: 22px 0 0;
          max-width: 540px;
          font-size: 16.5px;
          line-height: 1.7;
          color: rgba(250,246,240,0.68);
        }
        .rsm-hero-note {
          margin: 16px 0 0;
          font-size: 12.5px;
          color: rgba(255,255,255,0.45);
          word-break: keep-all;
        }
        .rsm-btn-hero { margin-top: 30px; width: auto; }

        /* ── FORM ── */
        .rsm-form { padding: clamp(40px, 6vh, 72px) 20px clamp(64px, 9vh, 110px); }
        .rsm-form-inner { max-width: 520px; margin: 0 auto; }
        .rsm-card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 20px;
          padding: clamp(24px, 4vw, 36px);
          box-shadow: 0 18px 48px rgba(24,14,8,0.08);
        }
        .rsm-card-done { text-align: center; }
        .rsm-card-h {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.6px;
          color: #111;
        }
        .rsm-card-sub {
          margin: 8px 0 24px;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(0,0,0,0.5);
        }
        .rsm-done-mark {
          width: 46px;
          height: 46px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: #16a34a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rsm-spinner {
          width: 34px;
          height: 34px;
          margin: 0 auto 16px;
          border-radius: 50%;
          border: 3px solid rgba(0,0,0,0.1);
          border-top-color: #ff6000;
          animation: rsmSpin 0.8s linear infinite;
        }
        @keyframes rsmSpin { to { transform: rotate(360deg); } }
        /* 맞는 공고 — 완료 카드는 가운데 정렬이지만 공고 행은 왼쪽으로 읽어야 한다. */
        .rsm-match { margin-top: 26px; padding-top: 22px; border-top: 1px solid rgba(0,0,0,0.07); text-align: left; }
        .rsm-match-h { font-size: 13px; font-weight: 800; color: #1a1612; margin-bottom: 12px; }
        .rsm-match-wait { margin-top: 26px; padding-top: 22px; border-top: 1px solid rgba(0,0,0,0.07); font-size: 13px; color: rgba(0,0,0,0.45); }
        .rsm-match-wait .rsm-spinner { width: 24px; height: 24px; margin-bottom: 10px; }

        .rsm-step { margin-top: 22px; }
        .rsm-step.inactive { opacity: 0.42; pointer-events: none; }
        .rsm-step-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.4px;
          color: rgba(0,0,0,0.6);
        }
        .rsm-step-num {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #111;
          color: #fff;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rsm-step.done .rsm-step-num { background: #16a34a; }

        .rsm-drop {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 28px 16px;
          border: 1.5px dashed rgba(255,96,0,0.45);
          border-radius: 14px;
          background: rgba(255,96,0,0.035);
          color: #111;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .rsm-drop:hover, .rsm-drop.drag { background: rgba(255,96,0,0.09); border-color: #ff6000; }
        .rsm-drop.drag * { pointer-events: none; }
        .rsm-drop:disabled { cursor: default; opacity: 0.6; }

        .rsm-file {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid rgba(34,197,94,0.28);
          background: rgba(34,197,94,0.06);
          border-radius: 12px;
        }
        .rsm-file-meta { min-width: 0; text-align: left; }
        .rsm-file-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #111;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rsm-file-size { font-size: 11.5px; color: rgba(0,0,0,0.45); }
        .rsm-change {
          flex-shrink: 0;
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .rsm-fine-hint { margin-top: 8px; font-size: 11.5px; color: rgba(0,0,0,0.38); }

        .rsm-btn {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 15px 28px;
          border: none;
          border-radius: 100px;
          background: #ff6000;
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(255,96,0,0.32);
        }
        .rsm-btn:disabled { opacity: 0.6; cursor: default; }
        .rsm-btn-hero { padding: 16px 44px; }
        .rsm-btn-linkedin {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px 24px;
          border: 1px solid rgba(0,0,0,0.14);
          border-radius: 100px;
          background: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .rsm-or {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 14px 0;
          color: rgba(0,0,0,0.32);
          font-size: 12px;
        }
        .rsm-or::before, .rsm-or::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(0,0,0,0.1);
        }
        .rsm-replace {
          display: block;
          margin: 14px auto 0;
          border: none;
          background: none;
          font-size: 13px;
          color: rgba(0,0,0,0.5);
          text-decoration: underline;
          cursor: pointer;
        }
        .rsm-err {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(220,38,38,0.07);
          color: #b91c1c;
          font-size: 13px;
          text-align: left;
        }
        .rsm-hint-bubble {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(34,197,94,0.08);
          color: #15803d;
          font-size: 13px;
        }
        .rsm-fine {
          margin-top: 20px;
          font-size: 11.5px;
          line-height: 1.6;
          color: rgba(0,0,0,0.38);
        }
        .rsm-fine a { color: rgba(0,0,0,0.5); }

        @media (max-width: 640px) {
          .rsm-h1 { letter-spacing: -1.2px; }
          .rsm-hero-sub { font-size: 15px; }
          .rsm-btn-hero { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rsm-h1-main em::after { animation: none; opacity: 0; }
        }
      `}</style>
    </>
  )
}

/* 히어로의 공고 수는 빌드/재생성 시점에 서버에서 박아 넣는다 — 클라이언트에서 세면
   숫자가 뒤늦게 튀어 들어와 히어로가 밀리고, 목록 1,000여 건을 통째로 받아야 한다. */
export async function getStaticProps() {
  let jobCount = 1000
  try {
    const { count } = await supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .neq('is_active', false)
    if (count) jobCount = count
  } catch {}
  return { props: { jobCount }, revalidate: 1800 }
}
