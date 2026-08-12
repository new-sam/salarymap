import Icon from './Icon'

// 지원 현황 카드 + 진행 stepper — /my-applications 페이지와 프로필 applications 탭이 공유.
// 스타일(.ma-*)도 여기서 export해 양쪽 <style>에 주입 (중복 정의 해소).

export const STEPS = ['applied', 'viewed', 'reviewing', 'docs_passed', 'interview', 'accepted']
export const STATUS_TO_STEP = { pending: 'applied', applied: 'applied', viewed: 'viewed', reviewing: 'reviewing', docs_passed: 'docs_passed', interview: 'interview', decided: 'accepted', accepted: 'accepted', canceled: 'applied' }
// 불합격 슬롯: 탈락 시점의 단계(rejected_at_stage) 다음 관문이 '불합격'으로 바뀐다.
// 지원~검토중(0~2)에서 탈락 = 서류 불합격(슬롯 3), 서류합격 후 = 면접 불합격(4), 면접 후 = 최종 불합격(5).
const DOCS_SLOT = STEPS.indexOf('docs_passed')
export function rejectedSlotIndex(stage) {
  const base = STEPS.indexOf(STATUS_TO_STEP[stage] || 'reviewing')
  return Math.min(Math.max(base + 1, DOCS_SLOT), STEPS.length - 1)
}

export const applicationCardCss = `
  .ma-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px 24px; margin-bottom: 12px; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .ma-card:hover { border-color: #ff4400; box-shadow: 0 2px 8px rgba(255,68,0,0.1); }
  .ma-card.rejected { background: #f7f7f5; }
  .ma-card.rejected:hover { border-color: #ccc; box-shadow: none; }
  .ma-card.rejected .ma-title { color: #555; }
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
  @media (max-width: 500px) {
    .ma-card { padding: 16px 18px; }
    .ma-step-label { font-size: 9px; } /* 6단계라 좁은 화면에서 줄바꿈 방지 */
  }
`

export default function ApplicationCard({ app, t, onClick }) {
  const st = app.status || 'applied'
  // 불합격: 어드민(status='rejected') 또는 기업 ATS(rejected_at) — 탈락 단계에 어두운 '불합격' 표시.
  const isRejected = st === 'rejected' || !!app.rejected_at
  const rejSlot = isRejected ? rejectedSlotIndex(app.rejected_at_stage || (st !== 'rejected' ? st : null)) : -1
  const mappedStep = STATUS_TO_STEP[st] || 'applied'
  const currentStep = isRejected ? rejSlot - 1 : Math.max(0, STEPS.indexOf(mappedStep))

  const stepLabel = (step) => ({
    applied: t('apps.applied'),
    viewed: t('apps.viewed'),
    reviewing: t('apps.reviewing'),
    docs_passed: t('apps.docsPassed'),
    interview: t('apps.interview'),
    accepted: t('apps.accepted'),
  }[step] || step)

  return (
    <div className={`ma-card${isRejected ? ' rejected' : ''}`} onClick={onClick}>
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
        {STEPS.map((step, si) => {
          const isFail = isRejected && si === rejSlot
          const done = si <= currentStep
          const pulse = !isRejected && si === currentStep + 1
          // 불합격 카드는 지나온 단계도 무채색으로 죽여 전체를 어둡게 처리한다.
          const doneColor = isRejected ? '#9CA3AF' : '#ff4400'
          return (
            <div key={step} className="ma-step">
              {si > 0 && (
                <div className={`ma-step-line${pulse ? ' next' : ''}`} style={{ background: done || isFail ? doneColor : '#e0e0e0' }} />
              )}
              <div className={`ma-step-dot${pulse ? ' next' : ''}`} style={{ background: isFail ? '#374151' : done ? doneColor : pulse ? undefined : '#e0e0e0' }}>
                {/* bold = 순수 획 — 기본 duotone은 글리프 뒤 반투명 사각 레이어가 옅은 배경처럼 비침 */}
                {isFail ? <Icon name="close" size={12} color="#fff" weight="bold" /> : done ? <Icon name="check" size={12} color="#fff" weight="bold" /> : ''}
              </div>
              <div className="ma-step-label" style={{ color: isFail ? '#374151' : done ? doneColor : '#bbb' }}>
                {isFail ? t('apps.failed') : stepLabel(step)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
