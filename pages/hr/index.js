import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useT } from '../../lib/i18n'
import GlobalNav from '../../components/GlobalNav'

export default function HRDashboard() {
  const router = useRouter()
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [hrStatus, setHrStatus] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/hr/login'); return }
      setUser(session.user)

      const res = await fetch(`/api/hr/status?userId=${session.user.id}`)
      const data = await res.json()

      if (!data.isHR) {
        router.replace('/')
        return
      }

      setHrStatus(data.status)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #ff6000', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (hrStatus === 'pending') {
    return (
      <>
        <Head><title>{t('hr.pending.title')}</title></Head>
        <GlobalNav activePage="hr" />
        <style>{`
          .hr-pending { min-height: calc(100vh - 56px); background: #0a0a0a; display: flex; align-items: center; justify-content: center; font-family: 'Barlow', system-ui, sans-serif; }
          .hr-pending-card { background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; }
        `}</style>
        <div className="hr-pending">
          <div className="hr-pending-card">
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#9203;</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f2f0eb', margin: '0 0 12px' }}>{t('hr.pending.title')}</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '0 0 24px' }}>{t('hr.pending.desc')}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>{user?.email}</p>
          </div>
        </div>
      </>
    )
  }

  if (hrStatus === 'rejected') {
    return (
      <>
        <Head><title>{t('hr.rejected.title')}</title></Head>
        <GlobalNav activePage="hr" />
        <div style={{ minHeight: 'calc(100vh - 56px)', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow', system-ui, sans-serif", color: '#f2f0eb', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{t('hr.rejected.title')}</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{t('hr.rejected.desc')}</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>{t('hr.dash.title')} - FYI Salary</title></Head>
      <GlobalNav activePage="hr" />
      <style>{`
        .hr-dash { min-height: calc(100vh - 56px); background: #0a0a0a; font-family: 'Barlow', system-ui, sans-serif; color: #f2f0eb; }
        .hr-dash-body { padding: 40px; max-width: 900px; margin: 0 auto; }
      `}</style>
      <div className="hr-dash">
        <div className="hr-dash-body">
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>{t('hr.dash.title')}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 40px' }}>{t('hr.dash.sub')}</p>
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'rgba(255,255,255,0.25)', fontSize: 15 }}>
            {t('hr.dash.empty')}
          </div>
        </div>
      </div>
    </>
  )
}
