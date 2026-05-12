import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import HRLayout from '../../components/HRLayout'
import { supabase } from '../../lib/supabaseClient'

const JOB_TYPES = {
  'full-time': '정규직', 'contract': '계약직', 'intern': '인턴', 'part-time': '파트타임',
}

// Animated counter
function Counter({ end, duration = 1200 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(eased * end))
      if (p < 1) requestAnimationFrame(tick)
    }
    tick()
  }, [end, duration])

  return <span ref={ref}>{count.toLocaleString()}</span>
}

// Empty state: animated job posting illustration
function EmptyJobsIllustration() {
  return (
    <svg width="220" height="160" viewBox="0 0 220 160" fill="none" style={{ margin: '0 auto 24px', display: 'block' }}>
      {/* Document base */}
      <rect className="hrd-anim-doc" x="50" y="20" width="120" height="120" rx="12" fill="#fff" stroke="#f0f0f0" strokeWidth="1.5" />

      {/* Header bar */}
      <rect className="hrd-anim-slide-r" x="66" y="36" width="60" height="8" rx="4" fill="#ff6000" opacity="0.2" />

      {/* Text lines */}
      <rect className="hrd-anim-slide-r hrd-d1" x="66" y="56" width="88" height="5" rx="2.5" fill="#e5e5e5" />
      <rect className="hrd-anim-slide-r hrd-d2" x="66" y="67" width="72" height="5" rx="2.5" fill="#e5e5e5" />
      <rect className="hrd-anim-slide-r hrd-d3" x="66" y="78" width="80" height="5" rx="2.5" fill="#e5e5e5" />

      {/* CTA button shape */}
      <rect className="hrd-anim-slide-r hrd-d4" x="66" y="96" width="50" height="16" rx="8" fill="#ff6000" opacity="0.15" />
      <text className="hrd-anim-slide-r hrd-d4" x="91" y="107" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ff6000">POST</text>

      {/* Floating plus circle */}
      <g className="hrd-anim-float">
        <circle cx="155" cy="36" r="14" fill="#ff6000" />
        <line x1="149" y1="36" x2="161" y2="36" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="155" y1="30" x2="155" y2="42" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Decorative dots */}
      <circle className="hrd-anim-ping" cx="42" cy="55" r="4" fill="#ff6000" opacity="0.2" />
      <circle className="hrd-anim-ping hrd-d1" cx="185" cy="80" r="3" fill="#2563eb" opacity="0.2" />
      <circle className="hrd-anim-ping hrd-d2" cx="38" cy="110" r="3" fill="#16a34a" opacity="0.2" />
    </svg>
  )
}

// Empty state: no applicants illustration
function EmptyApplicantsIllustration() {
  return (
    <svg width="180" height="120" viewBox="0 0 180 120" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
      {/* Inbox tray */}
      <path className="hrd-anim-doc" d="M40 50 L40 90 Q40 100 50 100 L130 100 Q140 100 140 90 L140 50" stroke="#e0e0e0" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line className="hrd-anim-doc" x1="30" y1="50" x2="150" y2="50" stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round" />

      {/* Arrow pointing down into inbox */}
      <g className="hrd-anim-bounce">
        <line x1="90" y1="15" x2="90" y2="40" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <path d="M82 33 L90 42 L98 33" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Small cards floating in */}
      <g className="hrd-anim-float-card hrd-d1" opacity="0.3">
        <rect x="55" y="60" width="30" height="20" rx="4" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="0.5" />
        <circle cx="65" cy="67" r="3" fill="#93c5fd" />
        <rect x="71" y="65" width="10" height="2" rx="1" fill="#bfdbfe" />
        <rect x="71" y="70" width="8" height="2" rx="1" fill="#dbeafe" />
      </g>
      <g className="hrd-anim-float-card hrd-d2" opacity="0.3">
        <rect x="95" y="65" width="30" height="20" rx="4" fill="#fff7ed" stroke="#fed7aa" strokeWidth="0.5" />
        <circle cx="105" cy="72" r="3" fill="#fdba74" />
        <rect x="111" y="70" width="10" height="2" rx="1" fill="#fed7aa" />
        <rect x="111" y="75" width="8" height="2" rx="1" fill="#ffedd5" />
      </g>
    </svg>
  )
}

export default function HRDashboard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const r = await fetch('/api/hr/my-jobs', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (r.ok) {
          const data = await r.json()
          setJobs(data.jobs || [])
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const activeJobs = jobs.filter(j => j.is_active)
  const totalApplicants = jobs.reduce((sum, j) => sum + j.applications.total, 0)
  const newApplicants = jobs.reduce((sum, j) => sum + j.applications.applied, 0)

  return (
    <HRLayout title="대시보드">
      <style>{`
        /* Animations */
        @keyframes hrdSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes hrdSlideR { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes hrdFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes hrdPing { 0%,100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(2); opacity: 0; } }
        @keyframes hrdBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        @keyframes hrdFloatCard { 0%,100% { transform: translateY(0) rotate(0deg); opacity: 0.3; } 50% { transform: translateY(-4px) rotate(1deg); opacity: 0.5; } }
        @keyframes hrdBarGrow { from { width: 0%; } }
        @keyframes hrdPulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(255,96,0,0.15); } 50% { box-shadow: 0 0 0 10px rgba(255,96,0,0); } }

        .hrd-anim-doc { animation: hrdSlideUp 0.8s ease both; }
        .hrd-anim-slide-r { animation: hrdSlideR 0.7s ease both; }
        .hrd-anim-float { animation: hrdFloat 3s ease-in-out infinite; }
        .hrd-anim-ping { animation: hrdPing 3s ease-in-out infinite; }
        .hrd-anim-bounce { animation: hrdBounce 2s ease-in-out infinite; }
        .hrd-anim-float-card { animation: hrdFloatCard 4s ease-in-out infinite; }
        .hrd-d1 { animation-delay: 0.15s; }
        .hrd-d2 { animation-delay: 0.3s; }
        .hrd-d3 { animation-delay: 0.45s; }
        .hrd-d4 { animation-delay: 0.6s; }

        /* Loading skeleton */
        @keyframes hrdShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .hrd-skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #fafafa 50%, #f0f0f0 75%); background-size: 200% 100%; animation: hrdShimmer 1.5s ease infinite; border-radius: 12px; }

        /* Empty state */
        .hrd-empty { text-align: center; padding: 48px 20px; background: #fff; border: 1px solid #f0f0f0; border-radius: 16px; animation: hrdSlideUp 0.6s ease both; }
        .hrd-empty h3 { font-size: 18px; font-weight: 800; color: #111; margin: 0 0 8px; letter-spacing: -0.02em; }
        .hrd-empty p { font-size: 13px; color: #999; margin: 0 0 28px; line-height: 1.7; }
        .hrd-cta { display: inline-flex; align-items: center; gap: 8px; background: #ff6000; color: #fff; border-radius: 12px; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; transition: all .2s; animation: hrdPulseGlow 3s infinite; }
        .hrd-cta:hover { background: #e55500; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,96,0,0.25); }

        /* Summary cards */
        .hrd-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }
        .hrd-sum-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 22px 20px; animation: hrdSlideUp 0.5s ease both; transition: all .2s; position: relative; overflow: hidden; }
        .hrd-sum-card:nth-child(2) { animation-delay: 0.1s; }
        .hrd-sum-card:nth-child(3) { animation-delay: 0.2s; }
        .hrd-sum-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.05); border-color: #e0e0e0; }
        .hrd-sum-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .hrd-sum-num { font-size: 32px; font-weight: 900; color: #111; letter-spacing: -0.02em; }
        .hrd-sum-label { font-size: 12px; font-weight: 500; color: #999; margin-top: 4px; }
        .hrd-sum-accent { position: absolute; top: 0; right: 0; width: 80px; height: 80px; border-radius: 0 14px 0 80px; opacity: 0.04; }

        /* Section */
        .hrd-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; animation: hrdSlideUp 0.5s ease 0.3s both; }
        .hrd-section-title { font-size: 15px; font-weight: 800; color: #111; }

        /* Job cards */
        .hrd-jobs { display: flex; flex-direction: column; gap: 12px; }
        .hrd-job { background: #fff; border: 1px solid #eee; border-radius: 16px; padding: 22px; transition: all .25s; animation: hrdSlideUp 0.5s ease both; }
        .hrd-job:nth-child(2) { animation-delay: 0.08s; }
        .hrd-job:nth-child(3) { animation-delay: 0.16s; }
        .hrd-job:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.06); border-color: #ddd; transform: translateY(-1px); }
        .hrd-job-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .hrd-job-title { font-size: 16px; font-weight: 800; color: #111; letter-spacing: -0.01em; }
        .hrd-job-meta { font-size: 12px; color: #999; margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
        .hrd-job-badge { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 100px; letter-spacing: 0.02em; }
        .hrd-job-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .hrd-job-btn { font-size: 12px; font-weight: 600; padding: 8px 16px; border-radius: 8px; text-decoration: none; transition: all .15s; cursor: pointer; font-family: inherit; border: none; }
        .hrd-job-btn:hover { transform: translateY(-1px); }

        /* Pipeline bar */
        .hrd-pipe { display: flex; gap: 8px; padding-top: 16px; border-top: 1px solid #f5f5f5; }
        .hrd-pipe-item { flex: 1; border-radius: 10px; padding: 12px 8px; text-align: center; position: relative; overflow: hidden; transition: all .2s; }
        .hrd-pipe-item:hover { transform: scale(1.03); }
        .hrd-pipe-num { font-size: 20px; font-weight: 900; margin-bottom: 2px; }
        .hrd-pipe-label { font-size: 10px; font-weight: 600; letter-spacing: 0.01em; }
        .hrd-pipe-bar { height: 3px; border-radius: 2px; margin-top: 8px; background: rgba(0,0,0,0.04); overflow: hidden; }
        .hrd-pipe-bar-fill { height: 100%; border-radius: 2px; animation: hrdBarGrow 1s ease both; }

        /* No applicants */
        .hrd-no-app { text-align: center; padding: 16px 0 4px; border-top: 1px solid #f5f5f5; }

        @media (max-width: 768px) {
          .hrd-summary { grid-template-columns: 1fr; }
          .hrd-job-top { flex-direction: column; }
          .hrd-job-actions { width: 100%; }
          .hrd-pipe { flex-wrap: wrap; }
          .hrd-pipe-item { min-width: calc(50% - 6px); }
        }
      `}</style>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div className="hrd-skeleton" style={{ height: 100 }} />
            <div className="hrd-skeleton" style={{ height: 100 }} />
            <div className="hrd-skeleton" style={{ height: 100 }} />
          </div>
          <div className="hrd-skeleton" style={{ height: 140 }} />
          <div className="hrd-skeleton" style={{ height: 140 }} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="hrd-empty">
          <EmptyJobsIllustration />
          <h3>채용 공고를 등록하고 지원자를 받아보세요</h3>
          <p>공고를 등록하면 매일 1,000명 이상의 구직자에게 노출됩니다.<br />등록 후 이 대시보드에서 지원자를 바로 관리할 수 있습니다.</p>
          <Link href="/hr/hiring" className="hrd-cta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            첫 공고 등록하기
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="hrd-summary">
            <div className="hrd-sum-card">
              <div className="hrd-sum-accent" style={{ background: '#2563eb' }} />
              <div className="hrd-sum-icon" style={{ background: '#eff6ff' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
              </div>
              <div className="hrd-sum-num"><Counter end={activeJobs.length} /><span style={{ fontSize: 16, color: '#bbb', fontWeight: 500 }}> / {jobs.length}</span></div>
              <div className="hrd-sum-label">진행중 공고</div>
            </div>
            <div className="hrd-sum-card">
              <div className="hrd-sum-accent" style={{ background: '#16a34a' }} />
              <div className="hrd-sum-icon" style={{ background: '#f0fdf4' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div className="hrd-sum-num"><Counter end={totalApplicants} /></div>
              <div className="hrd-sum-label">총 지원자</div>
            </div>
            <div className="hrd-sum-card">
              <div className="hrd-sum-accent" style={{ background: '#ff6000' }} />
              <div className="hrd-sum-icon" style={{ background: '#fff7ed' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div className="hrd-sum-num" style={{ color: newApplicants > 0 ? '#ff6000' : '#111' }}><Counter end={newApplicants} /></div>
              <div className="hrd-sum-label">신규 지원 (확인 필요)</div>
            </div>
          </div>

          {/* Job list */}
          <div className="hrd-section-header">
            <span className="hrd-section-title">내 채용 공고</span>
            <Link href="/hr/hiring" style={{ fontSize: 12, color: '#ff6000', textDecoration: 'none', fontWeight: 700 }}>공고 관리 →</Link>
          </div>

          <div className="hrd-jobs">
            {jobs.map(job => {
              const apps = job.applications
              const isExpired = job.deadline && new Date(job.deadline) < new Date()
              const active = job.is_active && !isExpired
              const hasApps = apps.total > 0
              const maxPipe = Math.max(apps.applied, apps.viewed, apps.reviewing, apps.decided, 1)

              return (
                <div key={job.id} className="hrd-job">
                  <div className="hrd-job-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="hrd-job-title">{job.title}</span>
                        <span className="hrd-job-badge" style={active
                          ? { color: '#16a34a', background: '#f0fdf4' }
                          : { color: '#999', background: '#f5f5f5' }
                        }>{active ? '진행중' : '마감'}</span>
                      </div>
                      <div className="hrd-job-meta">
                        <span>{job.company}</span>
                        {job.location && <><span>·</span><span>{job.location}</span></>}
                        {job.job_type && <><span>·</span><span>{JOB_TYPES[job.job_type] || job.job_type}</span></>}
                        {job.deadline && <><span>·</span><span>마감 {new Date(job.deadline).toLocaleDateString('ko-KR')}</span></>}
                      </div>
                    </div>
                    <div className="hrd-job-actions">
                      <Link href={`/hr/applicants?jobId=${job.id}`} className="hrd-job-btn"
                        style={{ background: '#ff6000', color: '#fff' }}>
                        지원자 보기
                      </Link>
                      <Link href="/hr/hiring" className="hrd-job-btn"
                        style={{ background: '#f5f5f5', color: '#666' }}>
                        수정
                      </Link>
                    </div>
                  </div>

                  {hasApps ? (
                    <div className="hrd-pipe">
                      {[
                        { key: 'applied', label: '신규 지원', color: '#2563eb', bg: '#eff6ff' },
                        { key: 'viewed', label: '검토중', color: '#f59e0b', bg: '#fff7ed' },
                        { key: 'reviewing', label: '면접 진행', color: '#7c3aed', bg: '#faf5ff' },
                        { key: 'decided', label: '결정 완료', color: '#16a34a', bg: '#f0fdf4' },
                      ].map(s => (
                        <div key={s.key} className="hrd-pipe-item" style={{ background: s.bg }}>
                          <div className="hrd-pipe-num" style={{ color: s.color }}>{apps[s.key] || 0}</div>
                          <div className="hrd-pipe-label" style={{ color: s.color }}>{s.label}</div>
                          <div className="hrd-pipe-bar">
                            <div className="hrd-pipe-bar-fill" style={{ width: `${((apps[s.key] || 0) / maxPipe) * 100}%`, background: s.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="hrd-no-app">
                      <EmptyApplicantsIllustration />
                      <div style={{ fontSize: 12, color: '#bbb' }}>아직 지원자가 없습니다</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </HRLayout>
  )
}
