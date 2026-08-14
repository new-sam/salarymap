import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import Icon from '../components/Icon'
import ApplicationCard, { applicationCardCss } from '../components/ApplicationCard'

// 종료 = 최종 합격·불합격(어드민 status 또는 기업 ATS rejected_at)·지원자 취소. 나머지는 진행중.
const isEnded = (app) => ['accepted', 'decided', 'rejected', 'canceled'].includes(app.status) || !!app.rejected_at

export default function MyApplications() {
  const router = useRouter()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])
  const [tab, setTab] = useState('all') // all | active | ended
  const [rejApp, setRejApp] = useState(null) // 불합격 카드 클릭 시 안내 모달

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
        body { background: #f7f7f5; }
        .ma-wrap { max-width: 600px; margin: 0 auto; padding: 40px 20px 80px; min-height: calc(100vh - 56px); }
        .ma-h { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .ma-sub { font-size: 13px; color: #aaa; margin-bottom: 28px; }
        .ma-empty { text-align: center; padding: 60px 20px; }
        .ma-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .ma-empty-h { font-size: 16px; font-weight: 700; color: '#555'; margin-bottom: 8px; }
        .ma-empty-p { font-size: 14px; color: #aaa; margin-bottom: 24px; }
        .ma-empty-btn { padding: 12px 32px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ma-empty-btn:hover { background: #e63d00; }
        .ma-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .ma-tab { padding: 7px 14px; border-radius: 100px; font-size: 13px; font-weight: 600; border: 1px solid #e5e5e2; background: #fff; color: #666; cursor: pointer; }
        .ma-tab.on { background: #ff4400; border-color: #ff4400; color: #fff; }
        .ma-tab-n { margin-left: 4px; opacity: 0.7; font-weight: 700; }
        .ma-filter-empty { text-align: center; padding: 48px 0; font-size: 14px; color: #aaa; }
        .ma-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .ma-modal { background: #fff; border-radius: 16px; padding: 28px 24px; max-width: 420px; width: 100%; }
        .ma-modal-h { font-size: 17px; font-weight: 800; color: #111; margin-bottom: 12px; }
        .ma-modal-p { font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 12px; }
        .ma-modal-btns { display: flex; gap: 8px; margin-top: 20px; }
        .ma-modal-browse { flex: 1; padding: 12px; background: #ff4400; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ma-modal-browse:hover { background: #e63d00; }
        .ma-modal-close { padding: 12px 16px; background: #f0f0ee; color: #555; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
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
        ) : (() => {
          const active = applications.filter(a => !isEnded(a))
          const ended = applications.filter(isEnded)
          const visible = tab === 'active' ? active : tab === 'ended' ? ended : applications
          const tabs = [
            { key: 'all', label: t('apps.tabAll'), n: applications.length },
            { key: 'active', label: t('apps.tabActive'), n: active.length },
            { key: 'ended', label: t('apps.tabEnded'), n: ended.length },
          ]
          return (
            <>
              <div className="ma-tabs">
                {tabs.map(tb => (
                  <button key={tb.key} className={`ma-tab${tab === tb.key ? ' on' : ''}`} onClick={() => setTab(tb.key)}>
                    {tb.label}<span className="ma-tab-n">{tb.n}</span>
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <div className="ma-filter-empty">{t('apps.filterEmpty')}</div>
              ) : (
                visible.map(app => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    t={t}
                    // 불합격 건은 공고 이동 대신 결과 안내 모달
                    onClick={() => (app.status === 'rejected' || app.rejected_at) ? setRejApp(app) : router.push(`/jobs?jobId=${app.job_id}`)}
                  />
                ))
              )}
            </>
          )
        })()}

        {rejApp && (
          <div className="ma-modal-bg" onClick={() => setRejApp(null)}>
            <div className="ma-modal" onClick={e => e.stopPropagation()}>
              <div className="ma-modal-h">{t('apps.rejTitle')}</div>
              <div className="ma-modal-p">{t('apps.rejBody1', { job: rejApp.job_title || '', company: rejApp.job_company || '' })}</div>
              <div className="ma-modal-p">{t('apps.rejBody2')}</div>
              <div className="ma-modal-btns">
                <button className="ma-modal-browse" onClick={() => router.push('/jobs')}>{t('apps.browseJobs')}</button>
                <button className="ma-modal-close" onClick={() => setRejApp(null)}>{t('apps.rejClose')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
