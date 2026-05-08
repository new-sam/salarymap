import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useT } from '../../lib/i18n'

function Illustration() {
  return (
    <div className="illust">
      {/* Floating code symbols */}
      <div className="illust-sym s1">&lt;/&gt;</div>
      <div className="illust-sym s2">&#123; &#125;</div>
      <div className="illust-sym s3">[ ]</div>
      <div className="illust-sym s4">#</div>
      <div className="illust-sym s5">*</div>
      {/* Center checkmark circle */}
      <svg className="illust-check" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="56" fill="#e8f5e9" stroke="#66bb6a" strokeWidth="3" />
        <path d="M36 62 L52 78 L84 46" stroke="#2e7d32" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <animate attributeName="stroke-dasharray" from="0 100" to="100 0" dur="0.6s" fill="freeze" />
        </path>
      </svg>
      {/* Person avatars */}
      <div className="illust-avatar a1">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="8" fill="#ffab91"/><ellipse cx="20" cy="35" rx="14" ry="10" fill="#ff7043"/></svg>
      </div>
      <div className="illust-avatar a2">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="8" fill="#90caf9"/><ellipse cx="20" cy="35" rx="14" ry="10" fill="#42a5f5"/></svg>
      </div>
      <div className="illust-avatar a3">
        <svg viewBox="0 0 40 40"><circle cx="20" cy="15" r="8" fill="#ce93d8"/><ellipse cx="20" cy="35" rx="14" ry="10" fill="#ab47bc"/></svg>
      </div>
      {/* Grid lines */}
      <svg className="illust-grid" viewBox="0 0 400 200" preserveAspectRatio="none">
        <line x1="0" y1="100" x2="400" y2="100" stroke="#e0e0e0" strokeWidth="0.5"/>
        <line x1="0" y1="50" x2="400" y2="50" stroke="#e0e0e0" strokeWidth="0.5"/>
        <line x1="0" y1="150" x2="400" y2="150" stroke="#e0e0e0" strokeWidth="0.5"/>
        <line x1="100" y1="0" x2="100" y2="200" stroke="#e0e0e0" strokeWidth="0.5"/>
        <line x1="200" y1="0" x2="200" y2="200" stroke="#e0e0e0" strokeWidth="0.5"/>
        <line x1="300" y1="0" x2="300" y2="200" stroke="#e0e0e0" strokeWidth="0.5"/>
      </svg>
    </div>
  )
}

export default function JobApplied() {
  const router = useRouter()
  const { t } = useT()
  const { title, company } = router.query

  useEffect(() => {
    if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: 'job_apply_confirmed', content_category: title || 'unknown' })
    if (typeof gtag === 'function') gtag('event', 'job_apply_confirmed', { event_category: 'conversion', event_label: title || 'unknown', company: company || 'unknown' })
  }, [title, company])

  return (
    <>
      <Head>
        <title>{t('jobs.appliedPageTitle') || 'Application Submitted'} | FYI</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="ap-page">
        <Illustration />
        <h1 className="ap-title">{t('jobs.appliedPageH1')}</h1>
        {title && company && (
          <p className="ap-job">{title} — {company}</p>
        )}
        <p className="ap-desc">{t('jobs.appliedPageDesc')}</p>
        <button className="ap-btn-primary" onClick={() => router.push('/jobs')}>
          {t('jobs.appliedPageBrowse')}
        </button>
      </div>
      <style>{`
        .ap-page {
          min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: #f7f7f5; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px;
        }
        .ap-title { font-size: 28px; font-weight: 800; color: #111; margin: 0 0 8px; text-align: center; }
        .ap-job { font-size: 15px; color: #666; margin: 0 0 12px; text-align: center; }
        .ap-desc { font-size: 15px; color: #888; line-height: 1.6; margin: 0 0 32px; text-align: center; max-width: 400px; }
        .ap-btn-primary {
          padding: 14px 48px; background: #ff4400; color: #fff; border: none; border-radius: 8px;
          font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s;
        }
        .ap-btn-primary:hover { background: #e63d00; }

        /* Illustration */
        .illust { position: relative; width: 320px; height: 200px; margin-bottom: 32px; }
        .illust-grid { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.5; }
        .illust-check { position: absolute; width: 80px; height: 80px; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; filter: drop-shadow(0 4px 12px rgba(46,125,50,0.2)); }

        .illust-sym {
          position: absolute; font-family: 'SF Mono', 'Fira Code', monospace; font-weight: 700;
          color: #ff4400; opacity: 0.7; z-index: 1;
        }
        .s1 { top: 20px; left: 10px; font-size: 18px; animation: float 3s ease-in-out infinite; }
        .s2 { top: 10px; right: 40px; font-size: 20px; animation: float 3.5s ease-in-out infinite 0.5s; }
        .s3 { bottom: 20px; right: 20px; font-size: 16px; animation: float 2.8s ease-in-out infinite 1s; }
        .s4 { bottom: 30px; left: 40px; font-size: 22px; color: #42a5f5; animation: float 3.2s ease-in-out infinite 0.3s; }
        .s5 { top: 50%; left: 20px; font-size: 14px; color: #ab47bc; animation: float 2.6s ease-in-out infinite 0.8s; }

        .illust-avatar {
          position: absolute; width: 44px; height: 44px; border-radius: 50%; overflow: hidden;
          background: #fff; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1;
        }
        .illust-avatar svg { width: 100%; height: 100%; }
        .a1 { top: 30px; left: 60px; animation: float 3s ease-in-out infinite 0.2s; }
        .a2 { bottom: 20px; left: 50%; transform: translateX(-50%); animation: float 3.4s ease-in-out infinite 0.7s; }
        .a3 { top: 40px; right: 50px; animation: float 2.9s ease-in-out infinite 1.2s; }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .a2 {
          animation-name: float2;
        }
        @keyframes float2 {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-8px); }
        }

        @media (max-width: 500px) {
          .ap-title { font-size: 22px; }
          .illust { width: 260px; height: 160px; }
          .illust-check { width: 64px; height: 64px; }
        }
      `}</style>
    </>
  )
}
