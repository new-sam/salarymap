import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'
import { useT } from '../lib/i18n'

const STEPS = ['applied', 'viewed', 'reviewing', 'decided']
const STATUS_TO_STEP = { applied: 'applied', viewed: 'viewed', reviewing: 'reviewing', accepted: 'decided', rejected: 'decided' }

export default function MyApplications() {
  const router = useRouter()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])

  useEffect(() => {
    // Show cached data instantly
    try {
      const cached = JSON.parse(localStorage.getItem('fyi_my_applications') || '[]')
      if (cached.length) { setApplications(cached); setLoading(false) }
    } catch {}

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      try {
        const res = await fetch(`/api/my-applications?userId=${session.user.id}`)
        const data = await res.json()
        if (data.data) {
          setApplications(data.data)
          localStorage.setItem('fyi_my_applications', JSON.stringify(data.data))
        }
      } catch {}
      setLoading(false)
    })
  }, [])

  const stepLabel = (step) => ({
    applied: t('apps.applied'),
    viewed: t('apps.viewed'),
    reviewing: t('apps.reviewing'),
    decided: t('apps.decided'),
  }[step] || step)

  const stepMessage = (status) => ({
    applied: t('apps.msgApplied'),
    viewed: t('apps.msgViewed'),
    reviewing: t('apps.msgReviewing'),
    accepted: t('apps.msgAccepted'),
    rejected: t('apps.msgRejected'),
  }[status] || '')

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f5', fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ fontSize: 14, color: '#aaa' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <Head><title>{t('apps.title')} — FYI</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
        .ma-wrap { max-width: 600px; margin: 0 auto; padding: 40px 20px 80px; min-height: calc(100vh - 56px); }
        .ma-h { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .ma-sub { font-size: 13px; color: #aaa; margin-bottom: 28px; }
        .ma-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px 24px; margin-bottom: 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
        .ma-card:hover { border-color: #ff4400; box-shadow: 0 2px 8px rgba(255,68,0,0.1); }
        .ma-empty { text-align: center; padding: 60px 20px; }
        .ma-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .ma-empty-h { font-size: 16px; font-weight: 700; color: '#555'; margin-bottom: 8px; }
        .ma-empty-p { font-size: 14px; color: #aaa; margin-bottom: 24px; }
        .ma-empty-btn { padding: 12px 32px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ma-empty-btn:hover { background: #e63d00; }
        .ma-top { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .ma-logo { width: 44px; height: 44px; border-radius: 10px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; font-size: 16px; font-weight: 800; color: #999; }
        .ma-logo img { width: 100%; height: 100%; object-fit: cover; }
        .ma-info { flex: 1; min-width: 0; }
        .ma-title { font-size: 15px; font-weight: 700; color: #111; }
        .ma-company { font-size: 13px; color: #888; margin-top: 2px; }
        .ma-date { font-size: 11px; color: #888; background: #f0f0ee; padding: 4px 10px; border-radius: 100px; white-space: nowrap; }
        .ma-stepper { display: flex; align-items: flex-start; }
        .ma-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
        .ma-step-line { position: absolute; top: 11px; right: 50%; width: 100%; height: 2px; z-index: 0; }
        .ma-step-dot { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; font-weight: 700; z-index: 1; position: relative; }
        .ma-step-dot.next { animation: dotPulse 2s ease-in-out infinite; }
        .ma-step-line.next { background: linear-gradient(90deg, #ff4400, #e0e0e0) !important; background-size: 200% 100% !important; animation: lineFill 2s ease-in-out infinite !important; }
        @keyframes dotPulse { 0%,100% { background: #e0e0e0; box-shadow: none; } 50% { background: #ffb088; box-shadow: 0 0 8px rgba(255,68,0,0.3); } }
        @keyframes lineFill { 0%,100% { background-position: 100% 0; } 50% { background-position: 0% 0; } }
        .ma-step-label { font-size: 10px; font-weight: 600; margin-top: 5px; text-align: center; }
        .ma-msg { margin-top: 14px; padding: 10px 14px; background: #f9f9f7; border-radius: 8px; font-size: 13px; color: #666; line-height: 1.5; text-align: center; white-space: pre-line; }
        @media (max-width: 500px) {
          .ma-wrap { padding: 28px 16px 60px; }
          .ma-card { padding: 16px 18px; }
        }
      `}</style>

      <GlobalNav activePage="my-applications" />

      <div className="ma-wrap">
        <div className="ma-h">{t('apps.title')}</div>
        <div className="ma-sub">{t('apps.subtitle')}</div>

        {applications.length === 0 ? (
          <div className="ma-empty">
            <div className="ma-empty-icon">📋</div>
            <div className="ma-empty-h">{t('apps.emptyTitle')}</div>
            <div className="ma-empty-p">{t('apps.emptyDesc')}</div>
            <button className="ma-empty-btn" onClick={() => router.push('/jobs')}>
              {t('apps.browseJobs')}
            </button>
          </div>
        ) : (
          applications.map(app => {
            const st = app.status || 'applied'
            const mappedStep = STATUS_TO_STEP[st] || 'applied'
            const currentStep = Math.max(0, STEPS.indexOf(mappedStep))
            return (
              <div key={app.id} className="ma-card" onClick={() => router.push(`/jobs?jobId=${app.job_id}`)}>
                <div className="ma-top">
                  <div className="ma-logo">
                    {(app.jobs?.logo_url || app.jobs?.image_url)
                      ? <img src={app.jobs.logo_url || app.jobs.image_url} alt="" />
                      : (app.job_company || '?').slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div className="ma-info">
                    <div className="ma-title">{app.job_title}</div>
                    <div className="ma-company">{app.job_company}</div>
                  </div>
                  <div className="ma-date">{t('apps.appliedDate')} {new Date(app.created_at).toLocaleDateString()}</div>
                </div>
                <div className="ma-stepper">
                  {STEPS.map((step, si) => (
                    <div key={step} className="ma-step">
                      {si > 0 && (
                        <div className={`ma-step-line${si === currentStep + 1 ? ' next' : ''}`} style={{ background: si <= currentStep ? '#ff4400' : '#e0e0e0' }} />
                      )}
                      <div className={`ma-step-dot${si === currentStep + 1 ? ' next' : ''}`} style={{ background: si <= currentStep ? '#ff4400' : si === currentStep + 1 ? undefined : '#e0e0e0' }}>
                        {si <= currentStep ? '✓' : ''}
                      </div>
                      <div className="ma-step-label" style={{ color: si <= currentStep ? '#ff4400' : '#bbb' }}>
                        {stepLabel(step)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ma-msg">{stepMessage(st)}
                  {st === 'accepted' && <span style={{ display: 'inline-block', marginLeft: 6, color: '#065F46', fontWeight: 700 }}>🎉</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
