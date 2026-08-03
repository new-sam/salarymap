import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { useT } from '../../lib/i18n'
import Icon from '../../components/Icon'
import { DEFAULT_IMAGES, roleLabel, DEFAULT_WORK_DAYS, DEFAULT_WORK_HOURS, DEFAULT_PAID_LEAVE, DEFAULT_CONTRACT } from '../../constants/jobs'
import { Meta } from '../../components/ktc/JobBoard'
import { BRAND, c, s } from '../../components/ktc/ktcStyles'
import { getStoredUtm } from '../../lib/utm'
import { isSalaryNegotiable } from '../../utils/salary'
import { track as trackVisit, getClientId, mirrorClarity } from '../../lib/track'
import { confirmAppliedInline } from '../../lib/applyConversion'
import { idbPutCv, idbGetCv, idbClearCv } from '../../lib/pendingCv'

// 스토리지 URL에서 원본 이력서 파일명 복원 (업로드 시 `${timestamp}_${safeName}`로 저장됨)
function resumeNameFromUrl(url) {
  try { return decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/^\d+_/, '') } catch { return 'resume' }
}

function decodeHTML(str) {
  if (!str || typeof str !== 'string') return str
  const el = typeof document !== 'undefined' && document.createElement('textarea')
  if (!el) return str
  el.innerHTML = str
  return el.value
}

/* 근무형태 칩 — /ktc 상세와 같은 규칙. 나머지 메타 칩과 크기·모양은 같고 색으로만
   구분해 회색 줄 맨 앞에서 먼저 읽히게 한다. 주황은 급여 전용이라 여기 쓰지 않는다. */
const WORK_TYPE_TONE = {
  Remote: { bg: '#E7F7EF', border: '#A3E0C4', text: '#0B7A4B' },
  Hybrid: { bg: '#F1ECFE', border: '#CDBDF7', text: '#6429CE' },
  'On-site': { bg: '#EAF2FE', border: '#B7D3FB', text: '#1B64DA' },
}

function WorkType({ value }) {
  if (!value) return null
  const tone = WORK_TYPE_TONE[value] || WORK_TYPE_TONE['On-site']
  return (
    <span style={{
      padding: '4px 9px', borderRadius: 6, background: tone.bg,
      border: `1px solid ${tone.border}`, fontSize: 11.5, fontWeight: 700, color: tone.text,
    }}>
      {value}
    </span>
  )
}

export async function getServerSideProps({ params }) {
  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: job } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!job) return { notFound: true }

  return { props: { job } }
}

export default function JobDetailPage({ job }) {
  const router = useRouter()
  const fileRef = useRef(null)
  const { t, lang } = useT()

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [profileResumeUrl, setProfileResumeUrl] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [appliedAlready, setAppliedAlready] = useState(false)

  useEffect(() => {
    if (typeof fbq === 'function') fbq('track', 'ViewContent', { content_name: job.title, content_category: job.company, content_type: 'job' })
  }, [job])

  useEffect(() => {
    try {
      const bm = JSON.parse(localStorage.getItem('fyi_bookmarks') || '[]')
      setBookmarked(bm.includes(job.id))
      const aj = JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]')
      setAppliedAlready(aj.includes(job.id))
    } catch {}
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setIsLoggedIn(true); setSession(s); setUser(s.user)
        // 프로필에 등록된 이력서가 있으면 파일 업로드 없이 그걸로 지원할 수 있게 한다.
        fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${s.access_token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(p => { if (p?.profile?.resume_url) setProfileResumeUrl(p.profile.resume_url) })
          .catch(() => {})
      }
    })
  }, [job.id])

  // 공고 상세 진입 계측 — SEO 직유입이 많아(랜딩 최상위) 유입→가입 이탈 분석의 분모가 된다.
  // lib/track 경유라 client_id가 붙는다 (아래 로컬 track 헬퍼는 client_id 없음).
  useEffect(() => {
    trackVisit('view_job_detail', {
      page: `/jobs/${job.id}`,
      meta: { jobId: job.id, company: job.company, referrer: document.referrer || null },
    })
  }, [job.id])

  // OAuth 복귀(?continue=1): 로그인 전에 첨부한 CV 를 IndexedDB 에서 복원해 이어서 제출한다.
  const oauthResumeHandled = useRef(false)
  useEffect(() => {
    if (!isLoggedIn || router.query.continue !== '1') return
    if (oauthResumeHandled.current) return
    oauthResumeHandled.current = true
    ;(async () => {
      const stored = await idbGetCv()
      if (!stored?.blob) return
      idbClearCv()
      if (appliedAlready) return
      const f = new File([stored.blob], stored.name, { type: stored.type })
      setResumeFile(f)
      setShowApplyForm(true)
      // 유저가 로그인 직전에 이미 제출을 눌렀던 흐름이라 복원한 파일로 자동 제출한다.
      // (짧은 지연은 복원된 폼을 잠깐 보여주기 위함 — /cv 의 auto-upload 와 동일)
      setTimeout(() => handleApply(f), 400)
    })()
  }, [isLoggedIn, router.query])

  const track = (event, page, meta) => {
    // clientId/userId 포함 — 익명 방문자 단위 퍼널 dedup용 (jobs.js 목록 헬퍼와 동일 기준)
    mirrorClarity(event)
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, page, meta, email: user?.email, userId: user?.id || null, clientId: getClientId() }) }).catch(() => {})
  }

  const toggleBookmark = () => {
    try {
      const bm = JSON.parse(localStorage.getItem('fyi_bookmarks') || '[]')
      const next = bm.includes(job.id) ? bm.filter(id => id !== job.id) : [...bm, job.id]
      localStorage.setItem('fyi_bookmarks', JSON.stringify(next))
      setBookmarked(!bookmarked)
    } catch {}
  }

  // 이력서 파일은 jobs.js와 같은 방식으로 클라이언트에서 스토리지에 올리고 URL만 JSON으로
  // 보낸다. (기존 multipart FormData는 /api/job-applications가 JSON 파서만 써서 400으로
  // 전부 유실됐고, 응답 체크도 없어 유저에겐 지원 완료로 보였음)
  // fileOverride: OAuth 복귀 직후 state 반영을 기다리지 않고 복원한 파일로 바로 제출할 때 사용
  const handleApply = async (fileOverride) => {
    const file = fileOverride || resumeFile
    if ((!file && !profileResumeUrl) || applying) return
    setApplying(true)
    try {
      const s = (await supabase.auth.getSession()).data.session
      const token = s?.access_token
      let resumeUrl = profileResumeUrl
      if (file && s) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${s.user.id}/${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage.from('resumes').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        })
        if (upErr) {
          alert(t('jobs.cvUploadError', { error: upErr.message }))
          setApplying(false)
          return
        }
        resumeUrl = supabase.storage.from('resumes').getPublicUrl(path).data.publicUrl
      }
      // Attribution captured on landing (router.query is empty by apply time).
      const res = await fetch('/api/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ jobId: job.id, jobTitle: job.title, jobCompany: job.company, resumeUrl, ...getStoredUtm() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(t('jobs.applyError', { error: err.error || 'unknown error' }))
        setApplying(false)
        return
      }
      setApplied(true)
      const aj = JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]')
      if (!aj.includes(job.id)) localStorage.setItem('fyi_applied_jobs', JSON.stringify([...aj, job.id]))
      setAppliedAlready(true)
      track('submit_application', `/jobs/${job.id}`, { jobId: job.id, title: job.title, company: job.company })
      confirmAppliedInline({ title: job.title, company: job.company, source: 'job_detail' })
    } catch {}
    setApplying(false)
  }

  const typeLabel = (t) => t === 'remote' ? 'Remote' : t === 'hybrid' ? 'Hybrid' : t === 'onsite' ? 'On-site' : t || ''

  const ogImage = job.image_url || job.images?.[0] || job.logo_url || DEFAULT_IMAGES[0]
  const ogTitle = `${job.title} at ${job.company}`
  const ogDesc = job.salary_min > 0
    ? `${Math.round(job.salary_min / 1e6)}M–${Math.round(job.salary_max / 1e6)}M VND · ${typeLabel(job.type)} · ${job.location || 'Vietnam'}`
    : `${typeLabel(job.type)} · ${job.location || 'Vietnam'}`

  // ── 상세 표시값 (/ktc 상세와 같은 순서: 급여 → 칩 줄 → 본문 블록) ──
  const salaryText = job.salary_min > 0
    ? `${Math.round(job.salary_min / 1e6)}M – ${Math.round(job.salary_max / 1e6)}M VND`
    : isSalaryNegotiable(job) ? t('jobs.salaryNegotiable') : ''

  const expText = !job.experience_min && !job.experience_max
    ? t('jobs.yearsAny')
    : job.experience_max >= 30
      ? t('jobs.yearsMin', { min: job.experience_min || 0 })
      : t('jobs.years', { min: job.experience_min, max: job.experience_max })

  const deadlineText = job.deadline
    ? (() => {
        const days = Math.ceil((new Date(job.deadline) - new Date()) / 86400000)
        return lang === 'vi'
          ? (days === 0 ? t('jobs.ddayToday') : days > 0 ? t('jobs.dday', { days }) : 'Đã đóng')
          : days >= 0 ? `D-${days}` : 'Closed'
      })()
    : t('jobs.ongoing')

  const descText = decodeHTML(job.description)
    || `${job.company} is looking for a ${job.title} to join their team in ${job.location}.`

  // 업로드된 실제 사진만 쓴다 — DEFAULT_IMAGES 스톡 사진은 정보가 없는데 첫 화면을
  // 통째로 먹어서 공고 본문을 접히게 만들던 원인이다. 사진은 본문 아래 갤러리로 내린다.
  const gallery = job.images?.length ? job.images : (job.image_url ? [job.image_url] : [])

  const workItems = [
    { icon: 'calendar', label: 'Work Days', value: job.work_days || DEFAULT_WORK_DAYS },
    { icon: 'clock', label: 'Work Hours', value: job.work_hours || DEFAULT_WORK_HOURS },
    { icon: 'mapPin', label: 'Work Type', value: job.type === 'remote' ? 'Fully Remote' : job.type === 'hybrid' ? 'Hybrid (Office + Remote)' : 'On-site' },
    { icon: 'palmTree', label: 'Paid Leave', value: job.paid_leave || DEFAULT_PAID_LEAVE },
    { icon: 'clipboard', label: 'Contract', value: job.contract_type || DEFAULT_CONTRACT },
    { icon: 'hospital', label: 'Insurance', value: 'Social & Health Insurance' },
  ]

  const openApply = () => {
    setShowApplyForm(true)
    track('click_apply_button', `/jobs/${job.id}`, { jobId: job.id, title: job.title, company: job.company })
    // 모바일에선 지원 패널이 본문 아래에 있다 — 바 버튼을 눌렀을 때 거기로 데려간다.
    setTimeout(() => document.getElementById('jd-apply')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  return (
    <>
      <Head>
        <title>{ogTitle} | FYI Jobs</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://fyivietnam.com/jobs/${job.id}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Head>


      <div className="jd-page" style={{ background: c.bg, color: c.text, minHeight: '100vh' }}>
        <div className="jd-pad" style={{ ...s.container, padding: '28px clamp(18px, 4vw, 40px) var(--jd-pb)' }}>
          <Link href="/jobs" className="jd-back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            {t('jobs.back') || 'Back to Jobs'}
          </Link>

          <div className="jd-grid">
            {/* 본문 */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {job.logo_url ? (
                  <img src={job.logo_url} alt={job.company} style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'contain', border: `1px solid ${c.line}`, background: '#fff', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: 10, border: `1px solid ${c.line}`, background: c.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: c.textFaint, flexShrink: 0 }}>
                    {job.company_initials || job.company.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 750, color: BRAND }}>{job.company}</p>
                  <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: c.textFaint }}>
                    {job.location && <span>{job.location}</span>}
                    {job.location && job.company_url && <span aria-hidden="true">·</span>}
                    {job.company_url && (
                      <a href={job.company_url} target="_blank" rel="noreferrer noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: c.textDim, fontWeight: 600 }}>
                        Website
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <h1 className="jd-h1">{job.title}</h1>

              {/* 급여 — 구직자가 가장 먼저 찾는 값. 색만으로는 칩 줄에 묻혀서
                  브랜드 톤 배경 + 좌측 액센트 바로 한 덩어리로 떼어 놓는다. */}
              {salaryText && (
                <div className="jd-salary">
                  <span className="jd-salary-k">{t('jobs.salary') || 'Salary'}</span>
                  <strong className="jd-salary-v">{salaryText}</strong>
                </div>
              )}

              <div className="jd-chips">
                <WorkType value={typeLabel(job.type)} />
                <Meta>{roleLabel(job.role, lang)}</Meta>
                <Meta>{expText}</Meta>
                {job.headcount ? <Meta>{`×${job.headcount}`}</Meta> : null}
                <Meta>{deadlineText}</Meta>
              </div>

              {job.tech_stack?.length > 0 && (
                <div className="jd-chips">
                  {job.tech_stack.map(x => <Meta key={x}>{x}</Meta>)}
                </div>
              )}

              <div className="jd-blocks">
                <section>
                  <h2 className="jd-h2">{t('jobs.about')}</h2>
                  <p className="jd-text">{descText}</p>
                </section>

                {job.benefits?.length > 0 && (
                  <section>
                    <h2 className="jd-h2">Benefits</h2>
                    <div className="jd-chips" style={{ marginTop: 10 }}>
                      {job.benefits.map(b => <Meta key={b}>{decodeHTML(b)}</Meta>)}
                    </div>
                  </section>
                )}

                {job.hiring_process && (
                  <section>
                    <h2 className="jd-h2">Hiring Process</h2>
                    <p className="jd-text">{decodeHTML(job.hiring_process)}</p>
                  </section>
                )}

                <section>
                  <h2 className="jd-h2">Work Information</h2>
                  <div className="jd-work">
                    {workItems.map(w => (
                      <div key={w.label} className="jd-work-item">
                        <div className="jd-work-icon"><Icon name={w.icon} size={16} color={c.textDim} /></div>
                        <div style={{ minWidth: 0 }}>
                          <div className="jd-work-label">{w.label}</div>
                          <div className="jd-work-value">{w.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {gallery.length > 0 && (
                  <section>
                    <h2 className="jd-h2">Photos</h2>
                    <div className="jd-gallery">
                      {gallery.map((src, i) => (
                        <img key={i} src={src} alt="" loading="lazy" />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* 지원 패널 — 넓은 화면에서는 오른쪽에 붙어 따라오고, 모바일에서는 본문 아래로 내려온다 */}
            <aside className="jd-side" id="jd-apply">
              <div style={{ ...s.card, padding: 22 }}>
                {applied ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Icon name="check" size={22} color="#fff" />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>{t('jobs.applied')}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: c.textDim, lineHeight: 1.6 }}>{t('jobs.appliedSub')}</div>
                  </div>
                ) : appliedAlready ? (
                  <>
                    <p style={{ fontSize: 13.5, lineHeight: 1.7, color: c.textDim }}>{t('jobs.appliedSub')}</p>
                    <button className="jd-btn" disabled style={{ marginTop: 16, background: c.lineStrong, cursor: 'default' }}>{t('jobs.applied')}</button>
                  </>
                ) : showApplyForm ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 800, color: c.text }}>{t('jobs.applyThis')}</div>
                    <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: c.textDim }}>{t('jobs.cvRequired') || 'Resume (required)'}</div>
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f && f.size <= 5 * 1024 * 1024) setResumeFile(f)
                      else if (f) alert('Max 5MB')
                    }} />
                    {(resumeFile || profileResumeUrl) ? (
                      <>
                        <div className="jd-file">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="jd-file-name">{resumeFile ? resumeFile.name : resumeNameFromUrl(profileResumeUrl)}</div>
                            {!resumeFile && <div className="jd-file-sub">{t('jobs.registeredResume')}</div>}
                          </div>
                        </div>
                        <button type="button" className="jd-file-swap" onClick={() => fileRef.current?.click()}>{t('jobs.uploadOtherResume')}</button>
                      </>
                    ) : (
                      <div className="jd-up" onClick={() => fileRef.current?.click()}>
                        <div style={{ fontSize: 12.5, color: c.textFaint, whiteSpace: 'pre-line' }}>{t('jobs.dragCV')}</div>
                      </div>
                    )}
                    <button className="jd-btn" onClick={async () => {
                      if (!isLoggedIn) {
                        // 첨부 파일은 OAuth 리다이렉트에서 state 가 날아가므로 IndexedDB 에
                        // 보관했다가 복귀(?continue=1) 후 복원해 이어서 제출한다. (/cv 와 같은 패턴)
                        if (resumeFile) await idbPutCv(resumeFile).catch(() => {})
                        const dest = `/jobs/${job.id}?continue=1`
                        localStorage.setItem('fyi_login_return', dest)
                        window.location.href = '/api/auth/google?return=' + encodeURIComponent(dest)
                        return
                      }
                      handleApply()
                    }} disabled={applying || (!resumeFile && !profileResumeUrl)}>
                      {!isLoggedIn ? t('jobs.loginToApply') : applying ? t('jobs.sending') : t('jobs.submitApplication')}
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13.5, lineHeight: 1.7, color: c.textDim }}>{t('jobs.applyThis')}</p>
                    <button className="jd-btn" style={{ marginTop: 16 }} onClick={openApply}>{t('jobs.apply')}</button>
                    <button className="jd-save" onClick={toggleBookmark}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? BRAND : 'none'} stroke={bookmarked ? BRAND : c.textFaint} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                      {bookmarked ? t('jobs.saved') : t('jobs.save')}
                    </button>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* 모바일 — 사이드 패널 대신 하단 고정 바. 본문 공간을 뺏지 않으면서 항상 손에 닿는다. */}
      {!applied && !appliedAlready && !showApplyForm && (
        <div className="jd-bar">
          <button className="jd-save jd-save-bar" onClick={toggleBookmark} aria-label={bookmarked ? t('jobs.saved') : t('jobs.save')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? BRAND : 'none'} stroke={bookmarked ? BRAND : c.textFaint} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          </button>
          <button className="jd-btn" style={{ flex: 1, marginTop: 0 }} onClick={openApply}>{t('jobs.apply')}</button>
        </div>
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${c.bg}; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }

        .jd-back { display: inline-flex; align-items: center; gap: 6; font-size: 13.5px; font-weight: 700; color: ${c.textDim}; text-decoration: none; }
        .jd-back:hover { color: ${c.text}; }

        .jd-h1 { margin-top: 16px; font-size: clamp(22px, 3.2vw, 32px); font-weight: 800; letter-spacing: -0.025em; line-height: 1.3; color: ${c.text}; word-break: keep-all; }

        /* 급여 — 페이지에서 가장 강한 단일 정보. 좌측 액센트 바 + 브랜드 틴트 배경 */
        .jd-salary {
          margin-top: 16px; display: inline-flex; align-items: baseline; gap: 10px;
          padding: 12px 18px 12px 16px; border-radius: 12px;
          background: rgba(255,96,0,0.07); border: 1px solid rgba(255,96,0,0.22);
          border-left: 4px solid ${BRAND};
        }
        .jd-salary-k { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,96,0,0.75); }
        .jd-salary-v { font-size: clamp(20px, 2.4vw, 26px); font-weight: 900; letter-spacing: -0.02em; color: ${BRAND}; font-variant-numeric: tabular-nums; }

        .jd-chips { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }

        .jd-blocks { margin-top: 34px; display: grid; gap: 26px; }
        .jd-h2 { font-size: 15.5px; font-weight: 800; color: ${c.text}; }
        .jd-text { margin-top: 10px; font-size: 14.5px; line-height: 1.8; color: ${c.textDim}; white-space: pre-line; }

        .jd-work { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .jd-work-item { display: flex; align-items: center; gap: 10px; background: ${c.surface}; border: 1px solid ${c.line}; border-radius: 10px; padding: 12px 14px; }
        .jd-work-icon { flex-shrink: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: ${c.surfaceHi}; border-radius: 8px; }
        .jd-work-label { font-size: 10.5px; font-weight: 700; color: ${c.textFaint}; text-transform: uppercase; letter-spacing: .04em; }
        .jd-work-value { font-size: 13px; font-weight: 600; color: ${c.text}; margin-top: 2px; }

        .jd-gallery { margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .jd-gallery img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: 10px; border: 1px solid ${c.line}; background: ${c.surfaceHi}; }

        .jd-btn {
          display: block; width: 100%; padding: 14px; border: none; border-radius: 10px;
          background: ${BRAND}; color: #fff; font-size: 15px; font-weight: 750;
          cursor: pointer; font-family: inherit; margin-top: 12px;
        }
        .jd-btn:hover:not(:disabled) { background: #e65600; }
        .jd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .jd-save {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; margin-top: 8px; padding: 11px; border-radius: 10px;
          border: 1px solid ${c.lineStrong}; background: transparent;
          font-size: 13.5px; font-weight: 700; color: ${c.textDim}; cursor: pointer; font-family: inherit;
        }
        .jd-save:hover { border-color: ${c.textFaint}; }

        .jd-up { margin-top: 8px; border: 1.5px dashed ${c.lineStrong}; border-radius: 10px; padding: 20px; text-align: center; cursor: pointer; }
        .jd-up:hover { border-color: ${c.textFaint}; }
        .jd-file { margin-top: 8px; display: flex; align-items: center; gap: 10px; border: 1px solid ${c.line}; background: ${c.surfaceHi}; border-radius: 10px; padding: 12px 14px; }
        .jd-file-name { font-size: 13px; font-weight: 600; color: ${c.text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jd-file-sub { font-size: 11.5px; color: ${c.textFaint}; margin-top: 2px; }
        .jd-file-swap { display: block; width: 100%; margin-top: 8px; padding: 10px; background: ${c.surface}; border: 1px solid ${c.line}; border-radius: 10px; font-size: 13px; font-weight: 600; color: ${c.textDim}; cursor: pointer; font-family: inherit; }
        .jd-file-swap:hover { border-color: ${c.textFaint}; }

        /* 모바일 기본: 1단 + 하단 고정 바. 바 높이만큼 본문 아래 여백을 준다. */
        :root { --jd-bar: 72px; }
        .jd-grid { display: grid; grid-template-columns: 1fr; gap: 28px; margin-top: 20px; }
        .jd-pad { --jd-pb: calc(40px + var(--jd-bar)); }
        .jd-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 300;
          display: flex; align-items: center; gap: 10px;
          padding: 10px clamp(16px, 4vw, 24px) calc(10px + env(safe-area-inset-bottom));
          background: rgba(255,255,255,0.94); backdrop-filter: blur(12px);
          border-top: 1px solid ${c.line};
        }
        .jd-save-bar { width: 46px; margin-top: 0; flex-shrink: 0; }
        .gfooter { margin-top: 0 !important; }

        @media (max-width: 899px) {
          .jd-work { grid-template-columns: 1fr; }
          footer { padding-bottom: calc(24px + var(--jd-bar) + env(safe-area-inset-bottom)) !important; }
        }

        @media (min-width: 900px) {
          .jd-grid { grid-template-columns: minmax(0, 1fr) 320px; gap: 40px; align-items: start; }
          /* 헤더(56) + 여유 — 본문이 길어도 지원 버튼이 따라온다 */
          .jd-side { position: sticky; top: 80px; }
          .jd-bar { display: none; }
          .jd-pad { --jd-pb: clamp(64px, 8vw, 104px); }
        }
      `}</style>
    </>
  )
}
