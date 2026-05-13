import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useKo } from '../../lib/i18n'

export default function HRLoginPage() {
  const { t } = useKo()
  const [activeStep, setActiveStep] = useState(-1)

  useEffect(() => {
    let step = -1
    const advance = () => {
      step++
      if (step > 4) {
        step = -1
        setActiveStep(-1)
        timeout = setTimeout(advance, 800)
      } else {
        setActiveStep(step)
        timeout = setTimeout(advance, step === 3 ? 2400 : 1200)
      }
    }
    let timeout = setTimeout(advance, 600)
    return () => clearTimeout(timeout)
  }, [])

  const handleLogin = () => {
    if (typeof window === 'undefined') return
    localStorage.setItem('fyi_login_return', '/hr')
    localStorage.setItem('fyi_intent', 'hr')
    window.location.href = '/api/auth/google?role=hr&return=/hr'
  }

  const steps = [
    { num: '1', key: 'step1' },
    { num: '2', key: 'step2' },
    { num: '3', key: 'step3' },
    { num: '4', key: 'step4' },
  ]

  return (
    <>
      <Head><title>HR Login - FYI Salary</title></Head>
      <style>{`
        .hrl { min-height: 100vh; background: #f8f8f8; font-family: 'Barlow', system-ui, sans-serif; display: flex; }

        /* Left — login */
        .hrl-left { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .hrl-card { max-width: 420px; width: 100%; }
        .hrl-logo { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #111; margin-bottom: 40px; text-decoration: none; }
        .hrl-logo img { width: 24px; height: 24px; }
        .hrl-logo span { color: #ff6000; }
        .hrl-badge { display: inline-block; font-size: 11px; font-weight: 700; color: #ff6000; background: #fff7ed; border: 1px solid #fed7aa; padding: 4px 14px; border-radius: 100px; margin-bottom: 20px; }
        .hrl-title { font-size: 28px; font-weight: 900; color: #111; margin: 0 0 8px; line-height: 1.2; }
        .hrl-desc { font-size: 14px; color: #888; margin: 0 0 32px; line-height: 1.6; }
        .hrl-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; border-radius: 10px; border: 1px solid #e5e5e5; background: #fff; color: #111; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .2s; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .hrl-btn:hover { background: #fafafa; border-color: #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .hrl-btn svg { width: 20px; height: 20px; }
        .hrl-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: #ccc; font-size: 12px; }
        .hrl-divider::before, .hrl-divider::after { content: ''; flex: 1; height: 1px; background: #e5e5e5; }
        .hrl-note { font-size: 12px; color: #bbb; line-height: 1.6; text-align: center; }
        .hrl-back { display: inline-block; margin-top: 32px; font-size: 13px; color: #bbb; text-decoration: none; transition: color .15s; }
        .hrl-back:hover { color: #888; }

        /* Right — roadmap */
        .hrl-right { flex: 1; background: #fff; border-left: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: center; padding: 40px 48px; }
        .hrl-roadmap { max-width: 380px; width: 100%; }
        .hrl-roadmap-title { font-size: 13px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 32px; }
        .hrl-steps { display: flex; flex-direction: column; gap: 0; }
        .hrl-step { display: flex; gap: 16px; position: relative; }
        .hrl-step-line { display: flex; flex-direction: column; align-items: center; width: 32px; flex-shrink: 0; }
        .hrl-step-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; z-index: 1; transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .hrl-step-dot.active { background: #ff6000; color: #fff; border: 2px solid #ff6000; }
        .hrl-step-dot.current { background: #ff6000; color: #fff; border: 2px solid #ff6000; transform: scale(1.15); box-shadow: 0 0 0 6px rgba(255, 96, 0, 0.15); }
        .hrl-step-dot.inactive { background: #f3f3f3; color: #ccc; border: 2px solid #e5e5e5; transform: scale(1); box-shadow: none; }
        .hrl-step-connector { width: 2px; flex: 1; min-height: 20px; transition: background 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        .hrl-step-connector.active { background: #ff6000; }
        .hrl-step-connector.inactive { background: #e5e5e5; }
        .hrl-step-content { padding: 4px 0 28px; transition: opacity 0.5s ease; }
        .hrl-step-content.dimmed { opacity: 0.4; }
        .hrl-step-label { font-size: 11px; font-weight: 700; color: #ff6000; margin-bottom: 2px; transition: color 0.5s ease; }
        .hrl-step-label.inactive { color: #ccc; }
        .hrl-step-name { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 4px; transition: color 0.5s ease; }
        .hrl-step-name.inactive { color: #bbb; }
        .hrl-step-desc { font-size: 12px; color: #999; line-height: 1.5; transition: color 0.5s ease; }
        .hrl-step-desc.inactive { color: #ccc; }
        .hrl-step:last-child .hrl-step-content { padding-bottom: 0; }

        .hrl-roadmap-note { margin-top: 32px; padding: 16px; background: #f9f9f9; border-radius: 10px; border: 1px solid #f0f0f0; }
        .hrl-roadmap-note p { font-size: 12px; color: #999; line-height: 1.5; margin: 0; }
        .hrl-roadmap-note strong { color: #666; }

        @media (max-width: 900px) {
          .hrl { flex-direction: column; }
          .hrl-right { border-left: none; border-top: 1px solid #f0f0f0; }
        }
      `}</style>

      <div className="hrl">
        {/* Left — Login */}
        <div className="hrl-left">
          <div className="hrl-card">
            <a href="/hr/home" className="hrl-logo">
              <img src="/logo.png" alt="FYI" />
              FYI <span>for HR</span>
            </a>
            <div className="hrl-badge">{t('hr.login.badge')}</div>
            <h1 className="hrl-title">{t('hr.login.title')}</h1>
            <p className="hrl-desc">{t('hr.login.desc')}</p>
            <button className="hrl-btn" onClick={handleLogin}>
              <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {t('hr.login.btn')}
            </button>
            <div className="hrl-divider">{t('hr.login.or')}</div>
            <p className="hrl-note">{t('hr.login.note')}</p>
            <a href="/hr/home" className="hrl-back">&larr; {t('hr.login.back')}</a>
          </div>
        </div>

        {/* Right — Roadmap */}
        <div className="hrl-right">
          <div className="hrl-roadmap">
            <div className="hrl-roadmap-title">{t('hr.login.roadmapTitle')}</div>
            <div className="hrl-steps">
              {steps.map((s, i) => {
                const isActive = i <= activeStep
                const isCurrent = i === activeStep
                const isLast = i === steps.length - 1
                const dotClass = isCurrent ? 'current' : isActive ? 'active' : 'inactive'
                return (
                  <div className="hrl-step" key={i}>
                    <div className="hrl-step-line">
                      <div className={`hrl-step-dot ${dotClass}`}>{s.num}</div>
                      {!isLast && <div className={`hrl-step-connector ${i < activeStep ? 'active' : 'inactive'}`} />}
                    </div>
                    <div className={`hrl-step-content${isActive ? '' : ' dimmed'}`}>
                      <div className={`hrl-step-label ${isActive ? '' : 'inactive'}`}>
                        {isCurrent ? t('hr.login.current') : isActive ? t('hr.login.current') : t('hr.login.upcoming')}
                      </div>
                      <div className={`hrl-step-name ${isActive ? '' : 'inactive'}`}>{t(`hr.login.road${s.key}`)}</div>
                      <div className={`hrl-step-desc ${isActive ? '' : 'inactive'}`}>{t(`hr.login.road${s.key}Desc`)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hrl-roadmap-note">
              <p dangerouslySetInnerHTML={{ __html: t('hr.login.roadmapNote') }} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
