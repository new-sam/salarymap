import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useT } from '../../lib/i18n'
import { track } from '../../lib/track'
import { formatSalaryCard } from '../../utils/salary'
import { confirmAppliedInline } from '../../lib/applyConversion'

/* 이력서 등록 직후 "방금 올린 이력서로 원탭 지원" 목록.
   원래 /cv 완료 모달 안에만 있던 것을, /resume 완료 화면도 같은 목록을 쓰게 되면서
   여기로 뺐다. 마크업만 옮기면 styled-jsx 스코프가 끊겨 스타일이 죽으므로 CSS도 함께 왔다.

   오터치 방지 2탭(첫 탭 = 확인 상태, 두 번째 탭 = 실제 지원)은 그대로 둔다 — 한 번에
   지원되면 잘못 눌렀을 때 되돌릴 방법이 없다. */
export default function QuickApplyJobList({ jobs, page, source, resumeUrl = null, moreHref = '/jobs' }) {
  const { lang } = useT()
  const L = (ko, en, vi) => (lang === 'vi' ? vi : lang === 'en' ? en : ko)

  const [applied, setApplied] = useState({})
  const [applyingId, setApplyingId] = useState(null)
  const [armedId, setArmedId] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const apply = async (job) => {
    if (applied[job.id] || applyingId) return
    setApplyingId(job.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      let ru = resumeUrl
      if (!ru && session?.user?.id) {
        const { data } = await supabase.from('user_profiles').select('resume_url').eq('id', session.user.id).maybeSingle()
        ru = data?.resume_url || null
      }
      const res = await fetch('/api/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: job.id, jobTitle: job.title, jobCompany: job.company, resumeUrl: ru, applicationSource: source }),
      })
      // 409 = 이미 지원한 공고(서버 dedup) — 실패가 아니라 지원됨 상태로 맞춘다.
      if (res.status === 409) { setApplied((a) => ({ ...a, [job.id]: true })); return }
      if (!res.ok) throw new Error('apply_failed')
      setApplied((a) => ({ ...a, [job.id]: true }))
      track('submit_application', { meta: { job_id: job.id, source }, page })
      confirmAppliedInline({ title: job.title, company: job.company, source })
    } catch {
      setErrMsg(L('지원에 실패했어요. 잠시 후 다시 시도해 주세요.', 'Application failed. Please try again.', 'Ứng tuyển thất bại. Vui lòng thử lại.'))
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <>
      {errMsg && <div className="cvm-err">{errMsg}</div>}
      <div className="cvm-jobs">
        {jobs.map((j) => {
          const isApplied = !!applied[j.id]
          const isApplying = applyingId === j.id
          const thumb = j.logo_url || j.image_url || j.images?.[0] || null
          const sal = formatSalaryCard(j)
          const salTxt = sal?.min && sal?.max ? `${Math.round(sal.min / 1e6)}–${Math.round(sal.max / 1e6)}M VND` : null
          const expTxt = (!j.experience_min && !j.experience_max)
            ? L('경력무관', 'Any exp', 'KN bất kỳ')
            : (!j.experience_max || j.experience_max >= 30)
              ? L(`${j.experience_min || 0}년+`, `${j.experience_min || 0}y+`, `${j.experience_min || 0} năm+`)
              : L(`${j.experience_min}–${j.experience_max}년`, `${j.experience_min}–${j.experience_max}y`, `${j.experience_min}–${j.experience_max} năm`)
          const typeMap = { remote: L('재택', 'Remote', 'Remote'), hybrid: L('하이브리드', 'Hybrid', 'Hybrid'), onsite: L('출근', 'On-site', 'Tại VP') }
          const typeTxt = j.type ? (typeMap[j.type] || j.type) : null
          const meta = [typeTxt, expTxt, salTxt].filter(Boolean).join(' · ')
          return (
            <div key={j.id} className="cvm-job">
              <div className="cvm-job-logo" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}>
                {!thumb && (j.company_initials || (j.company || '?').charAt(0).toUpperCase())}
              </div>
              <div className="cvm-job-main">
                <div className="cvm-job-title">{j.title}</div>
                <div className="cvm-job-company">{j.company}</div>
                <div className="cvm-job-meta">{meta}</div>
              </div>
              <button
                className={`cvm-apply${isApplied ? ' done' : ''}${isApplying ? ' applying' : ''}${armedId === j.id ? ' arm' : ''}`}
                disabled={isApplied || isApplying}
                onClick={() => { if (armedId === j.id) { setArmedId(null); apply(j) } else setArmedId(j.id) }}
              >
                {isApplied ? L('지원 완료 ✓', 'Applied ✓', 'Đã ứng tuyển ✓')
                  : isApplying ? L('지원 중', 'Applying', 'Đang gửi')
                  : armedId === j.id ? L('한 번 더 누르면 지원돼요', 'Tap again to apply', 'Nhấn lần nữa để nộp')
                  : L('바로 지원', 'Apply', 'Ứng tuyển')}
              </button>
            </div>
          )
        })}
      </div>
      {Object.keys(applied).length > 0 ? (
        <a href={moreHref} className="cvm-more">{L('공고 더 보러가기', 'Browse more jobs', 'Xem thêm việc làm')} →</a>
      ) : (
        <a href={moreHref} className="cvm-all">{L('전체 공고 보기', 'Browse all jobs', 'Xem tất cả việc làm')} →</a>
      )}

      <style jsx>{`
        .cvm-err { font-size: 13px; color: #d92d20; background: #fef3f2; border: 1px solid #fecdc9; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
        .cvm-jobs { display: flex; flex-direction: column; gap: 10px; }
        .cvm-job { display: flex; align-items: center; gap: 12px; border: 1px solid #ece5db; border-radius: 12px; padding: 12px 13px; }
        .cvm-job-logo { flex-shrink: 0; width: 42px; height: 42px; border-radius: 10px; background-color: #f3eee6; background-size: cover; background-position: center; background-repeat: no-repeat; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: #b09a7f; }
        .cvm-job-main { flex: 1; min-width: 0; }
        .cvm-job-title { font-size: 14px; font-weight: 700; color: #1a1612; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cvm-job-company { font-size: 12.5px; color: #8a8073; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cvm-job-meta { font-size: 11.5px; color: #a89f92; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cvm-apply { flex-shrink: 0; min-width: 84px; text-align: center; font-size: 13px; font-weight: 700; color: #fff; background: #ff6000; border: none; border-radius: 9px; padding: 9px 14px; cursor: pointer; font-family: inherit; transition: opacity .15s; }
        .cvm-apply:disabled { cursor: default; }
        .cvm-apply.applying { opacity: 0.55; }
        /* 오터치 방지 2탭: 첫 탭에서 확인 상태로 전환 */
        .cvm-apply.arm { background: #fff1e8; color: #ff6000; box-shadow: inset 0 0 0 1.5px #ff6000; }
        .cvm-apply.done { background: #E7F6EC; color: #16a34a; }
        .cvm-all { display: block; text-align: center; margin-top: 16px; font-size: 13px; font-weight: 600; color: #8a8073; text-decoration: none; }
        .cvm-more { display: block; text-align: center; margin-top: 16px; padding: 13px 0; font-size: 14px; font-weight: 700; color: #ff6000; background: #fff1e8; border: 1px solid #ffd7c2; border-radius: 11px; text-decoration: none; }
      `}</style>
    </>
  )
}
