import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { track } from '../lib/track'
import { useT } from '../lib/i18n'
import { formatSalaryCard } from '../utils/salary'

// submission role (vd 'Data · AI') → job role (vd 'Data'). Phần tử [0] là khớp chính xác,
// các phần tử sau là role tương tự (điểm thấp hơn).
const ROLE_MAP = {
  'Backend': ['Backend', 'Fullstack'],
  'Frontend': ['Frontend', 'Fullstack'],
  'Mobile': ['Mobile'],
  'Data · AI': ['Data'],
  'DevOps': ['DevOps'],
  'PM · PO': ['PM'],
  'Design': ['Design'],
  'QA': ['QA'],
}

function roleScore(userRole, jobRole) {
  if (!userRole || !jobRole) return 0
  const list = ROLE_MAP[userRole] || [userRole]
  const idx = list.indexOf(jobRole)
  if (idx === 0) return 1      // khớp chính xác
  if (idx > 0) return 0.6      // role tương tự
  return 0
}

function expYears(experience) {
  const n = parseInt(String(experience || '').replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

// Lọc job theo cascade nới lỏng dần. Trả về tier để UI đổi tiêu đề cho khớp dữ liệu thật.
function buildJobSuggestions(allJobs, salaryVnd, role, experience) {
  const years = expYears(experience)
  const now = new Date()
  const active = allJobs.filter(j => !j.deadline || new Date(j.deadline) >= now)
  const salMin = (j) => formatSalaryCard(j).min

  const bumpReason = (j) => {
    const b = ((salMin(j) - salaryVnd) / salaryVnd) * 100
    if (b <= 0) return 0
    if (b <= 80) return 1         // mức nhảy hợp lý
    if (b <= 150) return 0.6
    return 0.3                    // >150% phi thực tế → hạ điểm
  }
  const expScore = (j) => {
    if (j.experience_min == null || j.experience_max == null) return 0.5
    return years >= j.experience_min && years <= j.experience_max ? 1 : 0.2
  }
  const score = (j) =>
    roleScore(role, j.role) * 3 +
    expScore(j) * 1.5 +
    bumpReason(j) +
    (j.is_featured ? 0.3 : 0) +
    (j.created_at && (now - new Date(j.created_at)) < 14 * 864e5 ? 0.2 : 0)
  // Cùng công ty không chiếm nhiều slot hiển thị — công ty mới lên trước, giữ thứ tự điểm.
  const diversify = (sorted) => {
    const seen = new Set(), first = [], rest = []
    for (const j of sorted) {
      const key = (j.company || '').trim().toLowerCase()
      if (key && seen.has(key)) rest.push(j)
      else { seen.add(key); first.push(j) }
    }
    return [...first, ...rest]
  }
  const rank = (pool) => diversify([...pool].sort((a, b) => score(b) - score(a)))

  // T1 — đúng vai trò + trả cao hơn lương hiện tại
  let pool = active.filter(j => roleScore(role, j.role) > 0 && salMin(j) > salaryVnd)
  if (pool.length) return { tier: 'higher', jobs: rank(pool), total: pool.length }

  // T2 — đúng vai trò (mọi mức lương)
  pool = active.filter(j => roleScore(role, j.role) > 0)
  if (pool.length) return { tier: 'role', jobs: rank(pool), total: pool.length }

  // T3 — trả cao hơn nhưng vai trò khác
  pool = active.filter(j => salMin(j) > salaryVnd)
  if (pool.length) return { tier: 'related', jobs: rank(pool), total: pool.length }

  // T4 — không có job nào
  return { tier: 'empty', jobs: [], total: 0 }
}

export default function ResultSection({ salary, role, experience, company, isLoggedIn, anchor }) {
  const { t } = useT()
  const [result, setResult] = useState(null)
  const [jobData, setJobData] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchResult() {
      try {
        const res = await fetch(`/api/result?salary=${salary}&role=${encodeURIComponent(role)}&experience=${encodeURIComponent(experience)}&company=${encodeURIComponent(company)}`)
        if (!res.ok) return
        setResult(await res.json())
      } catch {}
    }
    async function fetchJobs() {
      try {
        const res = await fetch('/api/jobs')
        if (!res.ok) return
        const data = await res.json()
        setJobData(buildJobSuggestions(data, salary * 1000000, role, experience))
      } catch {}
    }
    if (salary) { fetchResult(); fetchJobs(); }
  }, [salary, role, experience, company])

  // 그래프 로드 완료 시 한 번 더 앵커 — 로딩 사이 위쪽 레이아웃이 움직였어도 그래프 상단으로 교정.
  // anchor(방금 제출)일 때만 — 새로고침 복원 시 자동 스크롤 금지
  useEffect(() => {
    if (result && anchor) {
      document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result, anchor])

  if (!result) return (
    <div style={{ padding:'clamp(20px,4vw,32px)', textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', border:'3px solid #ff4400', borderTopColor:'transparent',
        animation:'spin .8s linear infinite', margin:'40px auto 16px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>{t('result.loading')}</div>
    </div>
  )

  const { percentile, userSalary, marketMedian, diff } = result
  const isPositive = diff >= 0
  const state = percentile <= 33 ? 'high' : percentile <= 66 ? 'mid' : 'low'

  const verdictMap = {
    high: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', color: '#4ade80', icon: '✦', text: t('result.high') },
    mid: { bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.25)', color: '#facc15', icon: '◎', text: t('result.mid') },
    low: { bg: 'rgba(255,68,0,0.1)', border: 'rgba(255,68,0,0.25)', color: '#ff6b35', icon: '↓', text: t('result.low') },
  }
  const verdict = verdictMap[state]
  const pctPosition = Math.max(5, Math.min(95, 100 - percentile))

  // Salary distribution bars (simulated from percentile)
  const bars = Array.from({ length: 12 }, (_, i) => {
    const pos = (i + 0.5) / 12
    const userPos = pctPosition / 100
    const dist = Math.abs(pos - 0.5)
    const h = Math.max(15, 100 - dist * 160)
    const isUser = Math.abs(pos - userPos) < 0.05
    return { h, isUser, belowUser: pos < userPos }
  })

  const salaryVnd = salary * 1000000

  const goToJobs = () => {
    if (typeof gtag === 'function') gtag('event', 'cta_click_view_jobs', { source: 'result_jobs' })
    if (typeof fbq === 'function') fbq('trackCustom', 'CTAClickViewJobs', { source: 'result_jobs' })
    if (isLoggedIn) {
      router.push('/jobs?from=salary')
    } else {
      // 바로 OAuth로 리다이렉트하지 않고 공용 로그인 모달(링크드인/구글)을 띄움 —
      // 결과 화면을 벗어나지 않아 뒤로가기로 제출 상태를 잃는 문제 방지
      localStorage.setItem('fyi_login_return', '/jobs?from=salary')
      if (typeof window !== 'undefined' && window.openAuthModal) window.openAuthModal('jobs')
    }
  }

  const goToJob = (id) => {
    if (!id) return goToJobs()
    router.push(`/jobs/${id}`)
  }

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro','Barlow',sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glowPulse { 0%,100% { box-shadow:0 0 12px rgba(255,68,0,0.4); } 50% { box-shadow:0 0 24px rgba(255,68,0,0.6); } }
        .rs-stat-box { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px 12px; text-align:center; }
        .rs-co-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid rgba(255,255,255,0.08); border-radius:12px; background:rgba(255,255,255,0.03); }
        @media(max-width:480px) { .rs-stat-grid { gap:6px !important; } .rs-big-pct { font-size:56px !important; } }
      `}</style>

      {/* Hero */}
      <div style={{ background:'linear-gradient(180deg,#161616 0%,#0d0d0d 100%)', padding:'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', borderRadius:'20px', animation:'fadeSlideUp .5s ease' }}>

        {/* Eyebrow */}
        <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.1em', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', textAlign:'center', marginBottom:'16px' }}>
          {t('result.eyebrow', { role, experience })}
        </div>

        {/* Big percentile */}
        <div style={{ textAlign:'center', marginBottom:'8px' }}>
          <span className="rs-big-pct" style={{ fontSize:'80px', fontWeight:900, fontStyle:'italic', color:'#ff4400', textShadow:'0 0 60px rgba(255,68,0,0.3)', lineHeight:1 }}>
            {percentile <= 50 ? `Top ${percentile}%` : `Bottom ${100 - percentile}%`}
          </span>
        </div>
        <div style={{ textAlign:'center', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'24px' }}>
          {t('result.among', { role, experience })}
        </div>

        {/* 3 stat boxes */}
        <div className="rs-stat-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
          <div className="rs-stat-box">
            <div style={{ fontSize:'24px', fontWeight:900, color:'#fff' }}>{userSalary}M</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>{t('result.yourSalary')}</div>
          </div>
          <div className="rs-stat-box">
            <div style={{ fontSize:'24px', fontWeight:900, color:'#fff' }}>{marketMedian}M</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>{t('result.marketMedian')}</div>
          </div>
          <div className="rs-stat-box" style={{ background:'rgba(255,68,0,0.08)', border:'1px solid rgba(255,68,0,0.25)' }}>
            <div style={{ fontSize:'24px', fontWeight:900, color: isPositive ? '#4ade80' : '#ff4400' }}>
              {isPositive ? '+' : ''}{diff}M
            </div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>{isPositive ? t('result.aboveMedian') : t('result.belowMedian')}</div>
          </div>
        </div>

        {/* Verdict badge */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'24px' }}>
          <div style={{ background:verdict.bg, border:`1px solid ${verdict.border}`, borderRadius:'100px',
            padding:'8px 20px', fontSize:'13px', fontWeight:700, color:verdict.color }}>
            {verdict.icon} {verdict.text}
          </div>
        </div>

        {/* Percentile bar */}
        <div style={{ marginBottom:'20px' }}>
          <div style={{ position:'relative', height:'6px', background:'rgba(255,255,255,0.07)', borderRadius:'3px' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pctPosition}%`,
              background:'linear-gradient(90deg,rgba(255,68,0,0.3),#ff4400)', borderRadius:'3px' }} />
            <div style={{ position:'absolute', left:`${pctPosition}%`, top:'50%', transform:'translate(-50%,-50%)',
              width:'12px', height:'12px', borderRadius:'50%', background:'#ff4400',
              animation:'glowPulse 2s ease-in-out infinite' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.2)' }}>{t('result.lowest')}</span>
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.2)' }}>{t('result.median')}</span>
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.2)' }}>{t('result.highest')}</span>
          </div>
        </div>

        {/* Salary distribution bars */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'60px', marginBottom:'24px' }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex:1, height:`${b.h}%`, borderRadius:'2px 2px 0 0', transition:'all .3s',
              background: b.isUser ? '#ff4400' : b.belowUser ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              boxShadow: b.isUser ? '0 0 8px rgba(255,68,0,0.4)' : 'none' }} />
          ))}
        </div>
      </div>

      {/* 나보다 더 주는 회사 — /api/result topCompanies. 클릭 → 회사 상세 패널(가입 게이트 연동) */}
      {result.topCompanies?.length > 0 && (
        <div style={{ marginTop:'24px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'18px', padding:'18px 16px' }}>
          <div style={{ fontSize:'21px', fontWeight:900, color:'#fff', lineHeight:1.2, letterSpacing:'-.01em', marginBottom:'8px' }}>
            {t('result.topCoHead')}
          </div>
          <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.55)', marginBottom:'16px' }}>
            {t('result.topCoSub', { role })}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {result.topCompanies.map((co, i) => (
              <div key={co.name + i} className="rs-co-row" role="button" tabIndex={0}
                onClick={() => {
                  track('result_company_card_click', { meta: { company: co.name } })
                  if (typeof window !== 'undefined' && window.openCompanyPanel) window.openCompanyPanel(co.name)
                }}
                style={{ cursor:'pointer', transition:'border-color .12s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,68,0,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
                <div style={{ width:38, height:38, borderRadius:'9px', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'12px', fontWeight:800, color:'rgba(255,255,255,0.45)', flexShrink:0, overflow:'hidden' }}>
                  {co.domain
                    ? <img src={`https://www.google.com/s2/favicons?domain=${co.domain}&sz=128`} alt=""
                        style={{ width:'100%', height:'100%', objectFit:'contain', background:'#fafaf8' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    : co.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{co.name}</div>
                  <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginTop:'2px' }}>{role} · {t('result.median')}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>{co.median}M</div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'#4ade80', marginTop:'2px' }}>+{co.premiumPct}%</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => {
              track('result_company_card_click', { meta: { company: '_view_all' } })
              const grid = document.querySelector('.cards-section') || document.getElementById('company-grid-root')
              grid?.scrollIntoView({ behavior:'smooth' })
            }}
            style={{ width:'100%', marginTop:'14px', background:'rgba(255,255,255,0.05)', color:'#fff',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:'12px', padding:'13px', fontSize:'13px', fontWeight:700,
              cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
            {t('result.topCoAll')}
          </button>
        </div>
      )}

      {/* Job suggestions */}
      {jobData && jobData.tier !== 'empty' && (() => {
        const { tier, jobs: jobList, total } = jobData
        const shown = jobList.slice(0, 5)
        const moreCount = Math.max(0, total - shown.length)
        const headKey = { higher:'result.jobsHeadHigher', role:'result.jobsHeadRole', related:'result.jobsHeadRelated' }[tier]
        const subKey = { higher:'result.jobsSubHigher', role:'result.jobsSubRole', related:'result.jobsSubRelated' }[tier]
        const showBump = tier === 'higher' || tier === 'related'
        return (
          <div style={{ marginTop:'24px', background:'linear-gradient(180deg,rgba(255,68,0,0.06),rgba(255,68,0,0))',
            border:'1px solid rgba(255,68,0,0.18)', borderRadius:'18px', padding:'18px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ width:'26px', height:'26px', borderRadius:'8px', background:'rgba(255,68,0,0.15)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4400" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
              </span>
              <span style={{ fontSize:'10px', fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#ff4400' }}>
                {t('result.jobsEyebrow')}
              </span>
            </div>
            <div style={{ fontSize:'21px', fontWeight:900, color:'#fff', lineHeight:1.2, letterSpacing:'-.01em', marginBottom:'8px' }}>
              {t(headKey, { role })}
            </div>
            <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.55)', marginBottom:'16px' }}>
              {t(subKey, { count: total, role })}
            </div>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {shown.map((job, i) => {
                const locked = i >= 2
                const sal = formatSalaryCard(job)
                const min = Math.round(sal.min / 1e6), max = Math.round(sal.max / 1e6)
                const bump = sal.min > salaryVnd ? Math.round(((sal.min - salaryVnd) / salaryVnd) * 100) : null
                return (
                  <div key={job.id || i} onClick={() => !locked && goToJob(job.id)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 4px',
                    borderBottom: i < shown.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', borderRadius:'8px',
                    cursor: locked ? 'default' : 'pointer', transition:'background .12s',
                    ...(locked ? { filter:'blur(5px)', opacity:0.4, pointerEvents:'none', userSelect:'none' } : {}) }}
                    onMouseEnter={e => { if (!locked) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width:38, height:38, borderRadius:'9px', background:'rgba(255,255,255,0.06)',
                      border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'12px', fontWeight:800, color:'rgba(255,255,255,0.45)', flexShrink:0, overflow:'hidden' }}>
                      {job.logo_url
                        ? <img src={job.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : (job.company_initials || job.company?.slice(0, 2) || '–').toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{job.company}</div>
                      <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'2px' }}>
                        {job.title}{job.location ? ` · ${job.location}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>{min}–{max}M</div>
                      {showBump && bump > 0
                        ? <div style={{ fontSize:'11px', fontWeight:700, color:'#ff4400', marginTop:'2px' }}>+{bump}%</div>
                        : <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', marginTop:'2px' }}>{t('result.perMonth')}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={goToJobs} style={{ width:'100%', marginTop:'14px', background:'#ff4400', color:'#fff',
              border:'none', borderRadius:'12px', padding:'13px', fontSize:'13px', fontWeight:700, cursor:'pointer',
              fontFamily:"'Be Vietnam Pro',sans-serif" }}>
              {moreCount > 0 ? t('result.seeMoreJobs', { count: moreCount }) : t('result.jobsEmptyCta')}
            </button>
          </div>
        )
      })()}

      {/* Job suggestions — empty state (T4) */}
      {jobData && jobData.tier === 'empty' && (
        <div style={{ marginTop:'20px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'14px', padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', marginBottom:'4px' }}>{t('result.jobsEmptyHead')}</div>
          <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'14px' }}>{t('result.jobsEmptySub', { role })}</div>
          <button onClick={goToJobs} style={{ width:'100%', background:'rgba(255,68,0,0.1)', color:'#ff4400',
            border:'1px solid rgba(255,68,0,0.25)', borderRadius:'12px', padding:'13px', fontSize:'13px', fontWeight:700,
            cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
            {t('result.jobsEmptyCta')}
          </button>
        </div>
      )}
    </div>
  )
}
