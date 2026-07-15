import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import Icon from '../components/Icon'
import ApplicationCard, { applicationCardCss } from '../components/ApplicationCard'

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
        const res = await fetch('/api/my-applications', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json()
        if (data.data) {
          setApplications(data.data)
          localStorage.setItem('fyi_my_applications', JSON.stringify(data.data))
        }
      } catch {}
      setLoading(false)
    })
  }, [])

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
        .ma-empty { text-align: center; padding: 60px 20px; }
        .ma-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .ma-empty-h { font-size: 16px; font-weight: 700; color: '#555'; margin-bottom: 8px; }
        .ma-empty-p { font-size: 14px; color: #aaa; margin-bottom: 24px; }
        .ma-empty-btn { padding: 12px 32px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ma-empty-btn:hover { background: #e63d00; }
        ${applicationCardCss}
        @media (max-width: 500px) {
          .ma-wrap { padding: 28px 16px 60px; }
        }
      `}</style>


      <div className="ma-wrap">
        <div className="ma-h">{t('apps.title')}</div>
        <div className="ma-sub">{t('apps.subtitle')}</div>

        {applications.length === 0 ? (
          <div className="ma-empty">
            <div className="ma-empty-icon"><Icon name="clipboard" size={40} color="#ccc" /></div>
            <div className="ma-empty-h">{t('apps.emptyTitle')}</div>
            <div className="ma-empty-p">{t('apps.emptyDesc')}</div>
            <button className="ma-empty-btn" onClick={() => router.push('/jobs')}>
              {t('apps.browseJobs')}
            </button>
          </div>
        ) : (
          applications.map(app => (
            <ApplicationCard key={app.id} app={app} t={t} onClick={() => router.push(`/jobs?jobId=${app.job_id}`)} />
          ))
        )}
      </div>
    </>
  )
}
