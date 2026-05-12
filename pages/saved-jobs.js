import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import GlobalNav from '../components/GlobalNav'
import { useT } from '../lib/i18n'

export default function SavedJobs() {
  const router = useRouter()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [savedJobs, setSavedJobs] = useState([])
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      setUser(session.user)
      try {
        const res = await fetch(`/api/job-bookmarks?userId=${session.user.id}`)
        const data = await res.json()
        if (data.bookmarks) setSavedJobs(data.bookmarks)
      } catch {}
      setLoading(false)
    })
  }, [])

  const removeSaved = async (jobId) => {
    setSavedJobs(prev => prev.filter(b => b.job_id !== jobId))
    if (user) {
      try {
        await fetch('/api/job-bookmarks', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, jobId }),
        })
        // sync localStorage
        const ids = savedJobs.filter(b => b.job_id !== jobId).map(b => b.job_id)
        localStorage.setItem('fyi_bookmarks', JSON.stringify(ids))
      } catch {}
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f5', fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ fontSize: 14, color: '#aaa' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <Head><title>{t('nav.savedJobs')} — FYI</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
        .sv-wrap { max-width: 600px; margin: 0 auto; padding: 40px 20px 80px; min-height: calc(100vh - 56px); }
        .sv-h { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .sv-sub { font-size: 13px; color: #aaa; margin-bottom: 28px; }
        .sv-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; display: flex; align-items: center; gap: 14px; transition: border-color .15s, box-shadow .15s; }
        .sv-card:hover { border-color: #ff4400; box-shadow: 0 2px 8px rgba(255,68,0,0.1); }
        .sv-logo { width: 44px; height: 44px; border-radius: 10px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; font-size: 14px; font-weight: 800; color: #999; }
        .sv-logo img { width: 100%; height: 100%; object-fit: cover; }
        .sv-info { flex: 1; min-width: 0; cursor: pointer; }
        .sv-title { font-size: 15px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sv-company { font-size: 13px; color: #888; margin-top: 2px; }
        .sv-meta { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .sv-tag { font-size: 11px; color: #666; background: #f5f5f3; padding: 3px 8px; border-radius: 4px; }
        .sv-rm { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #eee; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all .15s; }
        .sv-rm:hover { border-color: #ff4400; background: #fff5f0; }
        .sv-rm svg { width: 16px; height: 16px; }
        .sv-date { font-size: 11px; color: #bbb; flex-shrink: 0; }
        .sv-empty { text-align: center; padding: 60px 20px; }
        .sv-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .sv-empty-h { font-size: 16px; font-weight: 700; color: #555; margin-bottom: 8px; }
        .sv-empty-p { font-size: 14px; color: #aaa; margin-bottom: 24px; }
        .sv-empty-btn { padding: 12px 32px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .sv-empty-btn:hover { background: #e63d00; }
        @media (max-width: 500px) {
          .sv-wrap { padding: 28px 16px 60px; }
          .sv-card { padding: 14px 16px; }
          .sv-title { font-size: 14px; }
          .sv-date { display: none; }
        }
      `}</style>

      <GlobalNav activePage="saved-jobs" />

      <div className="sv-wrap">
        <div className="sv-h">{t('nav.savedJobs')}</div>
        <div className="sv-sub">{t('saved.subtitle')}</div>

        {savedJobs.length === 0 ? (
          <div className="sv-empty">
            <div className="sv-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            </div>
            <div className="sv-empty-h">{t('jobs.noSavedJobs')}</div>
            <div className="sv-empty-p">{t('saved.emptyDesc')}</div>
            <button className="sv-empty-btn" onClick={() => router.push('/jobs')}>
              {t('apps.browseJobs')}
            </button>
          </div>
        ) : (
          savedJobs.map(b => {
            const job = b.jobs
            if (!job) return null
            const salary = job.salary_min && job.salary_max
              ? `${Math.round(job.salary_min / 1e6)}M–${Math.round(job.salary_max / 1e6)}M VND`
              : null
            return (
              <div key={b.job_id} className="sv-card">
                <div className="sv-logo">
                  {job.logo_url
                    ? <img src={job.logo_url} alt="" />
                    : (job.company_initials || (job.company || '').slice(0, 2).toUpperCase())
                  }
                </div>
                <div className="sv-info" onClick={() => router.push(`/jobs?jobId=${b.job_id}`)}>
                  <div className="sv-title">{job.title}</div>
                  <div className="sv-company">{job.company}</div>
                  <div className="sv-meta">
                    {job.role && <span className="sv-tag">{job.role}</span>}
                    {salary && <span className="sv-tag">{salary}</span>}
                    {job.type && <span className="sv-tag">{job.type}</span>}
                  </div>
                </div>
                <div className="sv-date">
                  {new Date(b.created_at).toLocaleDateString()}
                </div>
                <button className="sv-rm" onClick={() => removeSaved(b.job_id)} title={t('jobs.unsaved')}>
                  <svg viewBox="0 0 24 24" fill="#ff4400" stroke="#ff4400" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                </button>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
