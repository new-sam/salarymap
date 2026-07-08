import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { useT } from '../../lib/i18n'
import Icon from '../../components/Icon'
import { DEFAULT_IMAGES, roleLabel, DEFAULT_WORK_DAYS, DEFAULT_WORK_HOURS, DEFAULT_PAID_LEAVE, DEFAULT_CONTRACT } from '../../constants/jobs'
import { COMPANY_PROFILES } from '../../data/companyProfiles.js'
import { generateCompanyDescription } from '../../utils/companyDescription'
import { getStoredUtm } from '../../lib/utm'

function decodeHTML(str) {
  if (!str || typeof str !== 'string') return str
  const el = typeof document !== 'undefined' && document.createElement('textarea')
  if (!el) return str
  el.innerHTML = str
  return el.value
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

  const [carouselIdx, setCarouselIdx] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [aiSummaryReady, setAiSummaryReady] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [appliedAlready, setAppliedAlready] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAiSummaryReady(true), 1200 + Math.random() * 600)
    if (typeof fbq === 'function') fbq('track', 'ViewContent', { content_name: job.title, content_category: job.company, content_type: 'job' })
    return () => clearTimeout(timer)
  }, [job])

  useEffect(() => {
    try {
      const bm = JSON.parse(localStorage.getItem('fyi_bookmarks') || '[]')
      setBookmarked(bm.includes(job.id))
      const aj = JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]')
      setAppliedAlready(aj.includes(job.id))
    } catch {}
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) { setIsLoggedIn(true); setSession(s); setUser(s.user) }
    })
  }, [job.id])

  const track = (event, page, meta) => {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, page, meta, email: user?.email }) }).catch(() => {})
  }

  const toggleBookmark = () => {
    try {
      const bm = JSON.parse(localStorage.getItem('fyi_bookmarks') || '[]')
      const next = bm.includes(job.id) ? bm.filter(id => id !== job.id) : [...bm, job.id]
      localStorage.setItem('fyi_bookmarks', JSON.stringify(next))
      setBookmarked(!bookmarked)
    } catch {}
  }

  const handleApply = async () => {
    if (!resumeFile || applying) return
    setApplying(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const fd = new FormData()
      fd.append('resume', resumeFile)
      fd.append('jobId', job.id)
      fd.append('jobTitle', job.title)
      fd.append('company', job.company)
      // Attribution captured on landing (router.query is empty by apply time).
      Object.entries(getStoredUtm()).forEach(([k, v]) => { if (v) fd.append(k, v) })
      await fetch('/api/job-applications', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
      setApplied(true)
      const aj = JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]')
      if (!aj.includes(job.id)) localStorage.setItem('fyi_applied_jobs', JSON.stringify([...aj, job.id]))
      setAppliedAlready(true)
      track('submit_application', `/jobs/${job.id}`, { jobId: job.id, title: job.title, company: job.company })
    } catch {}
    setApplying(false)
  }

  const typeLabel = (t) => t === 'remote' ? 'Remote' : t === 'hybrid' ? 'Hybrid' : t === 'onsite' ? 'On-site' : t || ''

  const uploaded = job.images?.length ? job.images : []
  const fallback = job.image_url || DEFAULT_IMAGES[0]
  const heroImages = uploaded.length ? uploaded : [fallback]
  const ogImage = job.image_url || job.images?.[0] || job.logo_url || DEFAULT_IMAGES[0]
  const ogTitle = `${job.title} at ${job.company}`
  const ogDesc = job.salary_min > 0
    ? `${Math.round(job.salary_min / 1e6)}M–${Math.round(job.salary_max / 1e6)}M VND · ${typeLabel(job.type)} · ${job.location || 'Vietnam'}`
    : `${typeLabel(job.type)} · ${job.location || 'Vietnam'}`

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


      <div className="jd-page">
        <div className="jd-page-inner">
          {/* Back link */}
          <Link href="/jobs" className="jd-page-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            {t('jobs.back') || 'Back to Jobs'}
          </Link>

          {/* Hero image / Carousel */}
          <div style={{ position: 'relative' }}>
            <div className="jd-img" style={{
              backgroundImage: `url(${heroImages[carouselIdx % heroImages.length]})`,
            }} />
            {heroImages.length > 1 && (
              <>
                <button onClick={() => setCarouselIdx(i => (i - 1 + heroImages.length) % heroImages.length)} style={{
                  position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                  color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>‹</button>
                <button onClick={() => setCarouselIdx(i => (i + 1) % heroImages.length)} style={{
                  position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                  color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>›</button>
                <div style={{
                  position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: 6,
                }}>
                  {heroImages.map((_, i) => (
                    <div key={i} onClick={() => setCarouselIdx(i)} style={{
                      width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                      background: i === carouselIdx % heroImages.length ? '#fff' : 'rgba(255,255,255,0.4)',
                    }} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="jd-body">
            {/* Company */}
            <div className="jd-company">
              <div className="jd-co-ini">{job.company_initials || job.company.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="jd-co-name">{job.company}</div>
                <div className="jd-co-loc">
                  {job.location} · {typeLabel(job.type)}
                  {job.company_url && <> · <a href={job.company_url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff4400', textDecoration: 'none' }}>Website</a></>}
                </div>
              </div>
            </div>

            {/* Title & Salary */}
            <div className="jd-title">{job.title}</div>
            {job.salary_min > 0 && (
              <div className="jd-salary">{Math.round(job.salary_min / 1e6)}M – {Math.round(job.salary_max / 1e6)}M VND</div>
            )}

            {/* Tech Stack */}
            {job.tech_stack?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {job.tech_stack.map(t => (
                  <span key={t} style={{ fontSize: 12, fontWeight: 600, color: '#333', background: '#f0f0f0', padding: '4px 10px', borderRadius: 5 }}>{t}</span>
                ))}
              </div>
            )}

            {/* Meta grid */}
            <div className="jd-meta-grid">
              <div className="jd-meta-item">
                <div className="jd-meta-label">{t('jobs.experience')}</div>
                <div className="jd-meta-value">{!job.experience_min && !job.experience_max ? t('jobs.yearsAny') : job.experience_max >= 30 ? t('jobs.yearsMin', { min: job.experience_min || 0 }) : t('jobs.years', { min: job.experience_min, max: job.experience_max })}</div>
              </div>
              <div className="jd-meta-item">
                <div className="jd-meta-label">{t('jobs.position')}</div>
                <div className="jd-meta-value">{roleLabel(job.role, lang)}</div>
              </div>
              <div className="jd-meta-item">
                <div className="jd-meta-label">{t('jobs.type')}</div>
                <div className="jd-meta-value">{typeLabel(job.type)}</div>
              </div>
              <div className="jd-meta-item">
                <div className="jd-meta-label">{t('jobs.region')}</div>
                <div className="jd-meta-value" style={{ textTransform: 'capitalize' }}>{job.country}</div>
              </div>
              {job.company_size && (
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Company Size</div>
                  <div className="jd-meta-value">{job.company_size}</div>
                </div>
              )}
              {job.headcount && (
                <div className="jd-meta-item">
                  <div className="jd-meta-label">Headcount</div>
                  <div className="jd-meta-value">{job.headcount}</div>
                </div>
              )}
              <div className="jd-meta-item">
                <div className="jd-meta-label">Deadline</div>
                <div className="jd-meta-value">{job.deadline ? (() => {
                  const days = Math.ceil((new Date(job.deadline) - new Date()) / 86400000)
                  const ddayText = lang === 'vi' ? (days === 0 ? t('jobs.ddayToday') : days > 0 ? t('jobs.dday', { days }) : 'Đã đóng') : days >= 0 ? `D-${days}` : 'Closed'
                  return `${job.deadline} (${ddayText})`
                })() : t('jobs.ongoing')}</div>
              </div>
            </div>

            <div className="jd-divider" />

            {/* Company Overview */}
            <div className="jd-section-title">Company Overview</div>
            <div className="jd-company-overview">
              <div className="jd-co-overview-header">
                <div className={`jd-co-overview-badge ${aiSummaryReady ? '' : 'ai-thinking'}`}>
                  {aiSummaryReady ? 'AI Summary' : 'Analyzing...'}
                </div>
              </div>
              {!aiSummaryReady ? (
                <div className="ai-loading">
                  <div className="ai-loading-line shimmer" style={{ width: '100%' }} />
                  <div className="ai-loading-line shimmer" style={{ width: '92%' }} />
                  <div className="ai-loading-line shimmer" style={{ width: '85%' }} />
                  <div className="ai-loading-line shimmer" style={{ width: '96%' }} />
                  <div className="ai-loading-line shimmer" style={{ width: '70%' }} />
                  <div className="ai-loading-line shimmer" style={{ width: '88%' }} />
                </div>
              ) : (
                <div className="ai-fade-in">
                  <div className="jd-co-overview-text">
                    {generateCompanyDescription(job)}
                  </div>
                  {(() => {
                    const p = COMPANY_PROFILES[job.company]
                    return (
                      <div className="jd-co-overview-stats">
                        <div className="jd-co-stat">
                          <div className="jd-co-stat-num">{p?.employees?.toLocaleString() || job.company_size || '–'}+</div>
                          <div className="jd-co-stat-label">Employees</div>
                        </div>
                        <div className="jd-co-stat">
                          <div className="jd-co-stat-num">{p?.founded || '–'}</div>
                          <div className="jd-co-stat-label">Founded</div>
                        </div>
                        <div className="jd-co-stat">
                          <div className="jd-co-stat-num" style={{ fontSize: p?.revenue?.length > 10 ? 12 : 15 }}>{p?.revenue || 'Undisclosed'}</div>
                          <div className="jd-co-stat-label">Revenue</div>
                        </div>
                        <div className="jd-co-stat">
                          <div className="jd-co-stat-num" style={{ fontSize: p?.funding?.length > 12 ? 11 : 15 }}>{p?.funding || 'Undisclosed'}</div>
                          <div className="jd-co-stat-label">Funding</div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="jd-divider" />

            {/* Work Information */}
            <div className="jd-section-title">Work Information</div>
            <div className="jd-work-info">
              <div className="jd-work-item">
                <div className="jd-work-icon"><Icon name="calendar" size={18} color="#555" /></div>
                <div>
                  <div className="jd-work-label">Work Days</div>
                  <div className="jd-work-value">{job.work_days || DEFAULT_WORK_DAYS}</div>
                </div>
              </div>
              <div className="jd-work-item">
                <div className="jd-work-icon"><Icon name="clock" size={18} color="#555" /></div>
                <div>
                  <div className="jd-work-label">Work Hours</div>
                  <div className="jd-work-value">{job.work_hours || DEFAULT_WORK_HOURS}</div>
                </div>
              </div>
              <div className="jd-work-item">
                <div className="jd-work-icon"><Icon name="mapPin" size={18} color="#555" /></div>
                <div>
                  <div className="jd-work-label">Work Type</div>
                  <div className="jd-work-value">{job.type === 'remote' ? 'Fully Remote' : job.type === 'hybrid' ? 'Hybrid (Office + Remote)' : 'On-site'}</div>
                </div>
              </div>
              <div className="jd-work-item">
                <div className="jd-work-icon"><Icon name="palmTree" size={18} color="#555" /></div>
                <div>
                  <div className="jd-work-label">Paid Leave</div>
                  <div className="jd-work-value">{job.paid_leave || DEFAULT_PAID_LEAVE}</div>
                </div>
              </div>
              <div className="jd-work-item">
                <div className="jd-work-icon"><Icon name="clipboard" size={18} color="#555" /></div>
                <div>
                  <div className="jd-work-label">Contract</div>
                  <div className="jd-work-value">{job.contract_type || DEFAULT_CONTRACT}</div>
                </div>
              </div>
              <div className="jd-work-item">
                <div className="jd-work-icon"><Icon name="hospital" size={18} color="#555" /></div>
                <div>
                  <div className="jd-work-label">Insurance</div>
                  <div className="jd-work-value">Social & Health Insurance</div>
                </div>
              </div>
            </div>

            <div className="jd-divider" />

            {/* Description */}
            <div className="jd-section-title">{t('jobs.about')}</div>
            <div className="jd-desc">
              {decodeHTML(job.description) || `${job.company} is looking for a ${job.title} to join their team in ${job.location}.\n\nThis is a ${job.type} position offering ${Math.round(job.salary_min / 1e6)}M–${Math.round(job.salary_max / 1e6)}M VND, ideal for candidates with ${job.experience_min}–${job.experience_max} years of experience in ${job.role}.\n\nOur headhunter team will personally introduce you and support you throughout the process.`}
            </div>

            {/* Benefits */}
            {job.benefits?.length > 0 && (
              <>
                <div className="jd-divider" />
                <div className="jd-section-title">Benefits</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                  {job.benefits.map(b => (
                    <span key={b} style={{ fontSize: 13, color: '#166534', background: '#f0fff4', border: '1px solid #86efac', padding: '5px 12px', borderRadius: 6 }}>{decodeHTML(b)}</span>
                  ))}
                </div>
              </>
            )}

            {/* Hiring Process */}
            {job.hiring_process && (
              <>
                <div className="jd-divider" />
                <div className="jd-section-title">Hiring Process</div>
                <div style={{ fontSize: 14, color: '#444', marginBottom: 24 }}>{decodeHTML(job.hiring_process)}</div>
              </>
            )}

            <div className="jd-divider" />

            {/* Apply Form */}
            {showApplyForm && !applied && !appliedAlready && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 14 }}>{t('jobs.applyThis')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>{t('jobs.cvRequired') || 'Resume (required)'}</div>
                <div className="ap-up" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && f.size <= 5 * 1024 * 1024) setResumeFile(f)
                    else if (f) alert('Max 5MB')
                  }} />
                  {resumeFile
                    ? <div className="ap-up-f">{resumeFile.name}</div>
                    : <div className="ap-up-t" style={{ whiteSpace: 'pre-line' }}>{t('jobs.dragCV')}</div>
                  }
                </div>
                <button className="jd-apply-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => {
                  if (!isLoggedIn) { localStorage.setItem('fyi_login_return', `/jobs/${job.id}`); supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } }); return; }
                  handleApply()
                }} disabled={applying || !resumeFile}>
                  {!isLoggedIn ? t('jobs.loginToApply') : applying ? t('jobs.sending') : t('jobs.submitApplication')}
                </button>
              </div>
            )}

            {applied && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ff4400', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Icon name="check" size={24} color="#fff" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 6 }}>{t('jobs.applied')}</div>
                <div style={{ fontSize: 14, color: '#777', lineHeight: 1.5 }}>{t('jobs.appliedSub')}</div>
              </div>
            )}
          </div>

          {/* Floating Apply CTA */}
          {!showApplyForm && (
            <div className="jd-apply-float">
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="jd-save-btn" onClick={toggleBookmark} title={bookmarked ? t('jobs.saved') : t('jobs.save')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? '#ff4400' : 'none'} stroke={bookmarked ? '#ff4400' : '#666'} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                </button>
                {appliedAlready ? (
                  <button className="jd-apply-btn" disabled style={{ background: '#ccc', flex: 1 }}>
                    {t('jobs.applied')}
                  </button>
                ) : (
                  <button className="jd-apply-btn" style={{ flex: 1 }} onClick={() => { setShowApplyForm(true); track('click_apply_button', `/jobs/${job.id}`, { jobId: job.id, title: job.title, company: job.company }) }}>
                    {t('jobs.apply')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }

        .jd-page { max-width: 720px; margin: 0 auto; padding: 24px 20px 100px; }
        .jd-page-inner { background: #fafaf8; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
        .jd-page-back { display: flex; align-items: center; gap: 8px; padding: 14px 20px; font-size: 14px; font-weight: 600; color: #333; text-decoration: none; border-bottom: 1px solid #f0f0f0; }
        .jd-page-back:hover { background: #f5f5f5; }

        .jd-img { width: 100%; max-height: 400px; background: #f0f0f0; background-size: contain; background-position: center; background-repeat: no-repeat; aspect-ratio: 16/9; }
        .jd-body { padding: 28px 32px 40px; }
        .jd-company { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .jd-co-ini { width: 44px; height: 44px; border-radius: 10px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #555; flex-shrink: 0; }
        .jd-co-name { font-size: 15px; font-weight: 600; color: #111; }
        .jd-co-loc { font-size: 13px; color: #777; }
        .jd-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px; letter-spacing: -0.3px; }
        .jd-salary { font-size: 16px; font-weight: 700; color: #ff4400; margin-bottom: 24px; }
        .jd-divider { height: 1px; background: #f0f0f0; margin: 24px 0; }
        .jd-section-title { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
        .jd-desc { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 24px; white-space: pre-line; }
        .jd-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .jd-meta-item { background: #f9f9f8; border-radius: 8px; padding: 12px 14px; }
        .jd-meta-label { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .jd-meta-value { font-size: 14px; font-weight: 600; color: #111; }

        .jd-work-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .jd-work-item { display: flex; align-items: center; gap: 10px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px 14px; }
        .jd-work-icon { font-size: 18px; flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #fafaf8; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .jd-work-label { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
        .jd-work-value { font-size: 13px; color: #222; font-weight: 600; margin-top: 2px; }

        .jd-company-overview { background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); border: 1px solid #e0e7ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
        .jd-co-overview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .jd-co-overview-badge { font-size: 11px; font-weight: 700; color: #6366f1; background: #e0e7ff; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; }
        .jd-co-overview-badge::before { content: '\\2726'; font-size: 10px; }
        .jd-co-overview-badge.ai-thinking { animation: aiBadgePulse 1.2s ease-in-out infinite; }
        @keyframes aiBadgePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .jd-co-overview-text { font-size: 13.5px; color: #374151; line-height: 1.7; margin-bottom: 16px; white-space: pre-line; }
        .jd-co-overview-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1px solid #e0e7ff; padding-top: 14px; }
        .jd-co-stat { text-align: center; padding: 8px 0; }
        .jd-co-stat:nth-child(odd) { border-right: 1px solid #e0e7ff; }
        .jd-co-stat-num { font-size: 15px; font-weight: 800; color: #111; }
        .jd-co-stat-label { font-size: 11px; color: #777; margin-top: 2px; }

        .ai-loading { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 16px; }
        .ai-loading-line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #e0e7ff 25%, #ede9fe 50%, #e0e7ff 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .ai-fade-in { animation: aiFadeIn 0.6s ease-out both; }
        @keyframes aiFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .jd-apply-float { position: sticky; bottom: 0; background: #fafaf8; padding: 16px 32px; border-top: 1px solid #f0f0f0; z-index: 2; }
        .jd-apply-btn { width: 100%; padding: 14px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s; font-family: inherit; }
        .jd-apply-btn:hover { background: #e63d00; }
        .jd-apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .jd-save-btn { width: 48px; height: 48px; border-radius: 8px; border: 1px solid #e0e0e0; background: #fafaf8; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; flex-shrink: 0; }
        .jd-save-btn:hover { border-color: #ff4400; background: #fff5f0; }

        .ap-up { border: 1.5px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 20px; transition: border-color .15s; }
        .ap-up:hover { border-color: #999; }
        .ap-up-t { font-size: 13px; color: #999; }
        .ap-up-f { font-size: 13px; color: #111; font-weight: 600; }

        @media (max-width: 768px) {
          .jd-page { padding: 0 0 80px; }
          .jd-page-inner { border-radius: 0; }
          .jd-body { padding: 20px 16px 32px; }
          .jd-img { max-height: 280px; }
          .jd-title { font-size: 18px; }
          .jd-work-info { grid-template-columns: 1fr; }
          .jd-apply-float { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px; background: #fafaf8; border-top: 1px solid #f0f0f0; z-index: 100; }
          .jd-save-btn { width: 44px; height: 44px; }
          .jd-apply-btn { padding: 12px; font-size: 14px; }
        }
      `}</style>
    </>
  )
}
