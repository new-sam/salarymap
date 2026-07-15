import Icon from './Icon'

// 지원 현황 카드 + 진행 stepper — /my-applications 페이지와 프로필 applications 탭이 공유.
// 스타일(.ma-*)도 여기서 export해 양쪽 <style>에 주입 (중복 정의 해소).

export const STEPS = ['applied', 'viewed', 'reviewing', 'decided']
export const STATUS_TO_STEP = { pending: 'applied', applied: 'applied', viewed: 'viewed', reviewing: 'reviewing', decided: 'decided', accepted: 'decided', rejected: 'decided' }

export const applicationCardCss = `
  .ma-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px 24px; margin-bottom: 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .ma-card:hover { border-color: #ff4400; box-shadow: 0 2px 8px rgba(255,68,0,0.1); }
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
    .ma-card { padding: 16px 18px; }
  }
`

export default function ApplicationCard({ app, t, onClick }) {
  const st = app.status || 'applied'
  const mappedStep = STATUS_TO_STEP[st] || 'applied'
  const currentStep = Math.max(0, STEPS.indexOf(mappedStep))

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

  return (
    <div className="ma-card" onClick={onClick}>
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
              {si <= currentStep ? <Icon name="check" size={12} color="#fff" /> : ''}
            </div>
            <div className="ma-step-label" style={{ color: si <= currentStep ? '#ff4400' : '#bbb' }}>
              {stepLabel(step)}
            </div>
          </div>
        ))}
      </div>
      <div className="ma-msg">{stepMessage(st)}
        {st === 'accepted' && <span style={{ display: 'inline-block', marginLeft: 6 }}><Icon name="party" size={16} color="#065F46" /></span>}
      </div>
    </div>
  )
}
