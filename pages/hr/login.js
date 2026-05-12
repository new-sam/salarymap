import Head from 'next/head'
import { useT } from '../../lib/i18n'

export default function HRLoginPage() {
  const { t } = useT()

  const handleLogin = () => {
    if (typeof window === 'undefined') return
    localStorage.setItem('fyi_login_return', '/hr')
    window.location.href = '/api/auth/google?role=hr&return=/hr'
  }

  return (
    <>
      <Head>
        <title>HR Login - FYI Salary</title>
      </Head>
      <style>{`
        .hr-login { min-height: 100vh; background: #0a0a0a; display: flex; align-items: center; justify-content: center; font-family: 'Barlow', system-ui, sans-serif; }
        .hr-login-card { background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 48px 40px; max-width: 420px; width: 100%; text-align: center; }
        .hr-login-badge { display: inline-block; font-size: 11px; font-weight: 700; color: #ff6000; background: rgba(255,96,0,0.12); padding: 4px 12px; border-radius: 100px; margin-bottom: 20px; letter-spacing: 0.05em; text-transform: uppercase; }
        .hr-login-title { font-size: 24px; font-weight: 700; color: #f2f0eb; margin: 0 0 8px; }
        .hr-login-desc { font-size: 14px; color: rgba(255,255,255,0.45); margin: 0 0 32px; line-height: 1.5; }
        .hr-login-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: #1a1a1a; color: #f2f0eb; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .2s; }
        .hr-login-btn:hover { background: #222; border-color: rgba(255,255,255,0.2); }
        .hr-login-btn svg { width: 20px; height: 20px; }
        .hr-login-note { font-size: 12px; color: rgba(255,255,255,0.25); margin-top: 24px; line-height: 1.5; }
        .hr-login-back { display: inline-block; margin-top: 24px; font-size: 13px; color: rgba(255,255,255,0.3); text-decoration: none; }
        .hr-login-back:hover { color: rgba(255,255,255,0.6); }
      `}</style>
      <div className="hr-login">
        <div className="hr-login-card">
          <div className="hr-login-badge">{t('hr.login.badge')}</div>
          <h1 className="hr-login-title">{t('hr.login.title')}</h1>
          <p className="hr-login-desc">{t('hr.login.desc')}</p>
          <button className="hr-login-btn" onClick={handleLogin}>
            <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t('hr.login.btn')}
          </button>
          <p className="hr-login-note">{t('hr.login.note')}</p>
          <a href="/" className="hr-login-back">&larr; {t('hr.login.back')}</a>
        </div>
      </div>
    </>
  )
}
