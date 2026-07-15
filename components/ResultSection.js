import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { track } from '../lib/track'
import { useT } from '../lib/i18n'
import { formatSalaryCard } from '../utils/salary'
import { useFlags } from '../lib/flags'

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
  // 하드 게이트 (2026-07-14~): 로그인 전엔 결과 전체 블러 + 로그인 CTA.
  // hard_gate 플래그로 원클릭 롤백 — 기본 잠금이라 플래그 로드 전 결과가 새지 않음.
  const { flags } = useFlags()
  const gateLocked = !isLoggedIn && flags.hard_gate
  const gateViewFired = useRef(false)

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

  // 게이트 노출 계측 — 결과가 준비됐는데 잠겨 있으면 세션당 1회 발화 (노출→클릭→로그인 퍼널의 분모).
  // sessionStorage 가드: 리마운트/새로고침 중복 발화로 분모가 부풀지 않게.
  useEffect(() => {
    if (result && gateLocked && !gateViewFired.current) {
      gateViewFired.current = true
      try {
        if (sessionStorage.getItem('fyi_rgv')) return
        sessionStorage.setItem('fyi_rgv', '1')
      } catch {}
      track('result_gate_view', { page: '/' })
    }
  }, [result, gateLocked])

  if (!result) return (
    <div style={{ padding:'clamp(20px,4vw,32px)', textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', border:'3px solid var(--sm-accent)', borderTopColor:'transparent',
        animation:'spin .8s linear infinite', margin:'40px auto 16px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize:14, color:'var(--sm-text-sub)' }}>{t('result.loading')}</div>
    </div>
  )

  const { percentile, userSalary, marketMedian, diff } = result
  const isPositive = diff >= 0
  const state = percentile <= 33 ? 'high' : percentile <= 66 ? 'mid' : 'low'

  const verdictMap = {
    high: { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)', color: 'var(--sm-green)', icon: '✦', text: t('result.high') },
    mid: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.25)', color: 'var(--sm-amber)', icon: '◎', text: t('result.mid') },
    low: { bg: 'var(--sm-accent-tint)', border: 'var(--sm-accent-border)', color: 'var(--sm-accent)', icon: '↓', text: t('result.low') },
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
    <div style={{ fontFamily: "inherit", WebkitFontSmoothing: 'antialiased', position: 'relative' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glowPulse { 0%,100% { box-shadow:0 0 12px rgba(255,68,0,0.4); } 50% { box-shadow:0 0 24px rgba(255,68,0,0.6); } }
        .rs-stat-box { background:var(--sm-surface-sub); border:1px solid var(--sm-line); border-radius:14px; padding:16px 12px; text-align:center; }
        .rs-co-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--sm-line); border-radius:12px; background:var(--sm-surface); }
        @media(max-width:480px) { .rs-stat-grid { gap:6px !important; } .rs-big-pct { font-size:56px !important; } }
      `}</style>

      {/* 하드 게이트: 로그인 전엔 결과를 블러 티저로만 노출 */}
      <div aria-hidden={gateLocked} style={gateLocked
        ? { filter: 'blur(14px)', pointerEvents: 'none', userSelect: 'none', maxHeight: '460px', overflow: 'hidden' }
        : undefined}>

      {/* Hero */}
      <div style={{ background:'linear-gradient(180deg,var(--sm-surface) 0%,var(--sm-surface-sub) 100%)', padding:'clamp(20px,4vw,32px) clamp(16px,4vw,24px)', borderRadius:'20px', animation:'fadeSlideUp .5s ease' }}>

        {/* Eyebrow */}
        <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.1em', color:'var(--sm-text-mute)', textTransform:'uppercase', textAlign:'center', marginBottom:'16px' }}>
          {t('result.eyebrow', { role, experience })}
        </div>

        {/* Big percentile */}
        <div style={{ textAlign:'center', marginBottom:'8px' }}>
          <span className="rs-big-pct" style={{ fontSize:'80px', fontWeight:900, fontStyle:'italic', color:'var(--sm-accent)', textShadow:'0 0 60px rgba(255,68,0,0.15)', lineHeight:1 }}>
            {percentile <= 50 ? `Top ${percentile}%` : `Bottom ${100 - percentile}%`}
          </span>
        </div>
        <div style={{ textAlign:'center', fontSize:'13px', color:'var(--sm-text-sub)', marginBottom:'24px' }}>
          {t('result.among', { role, experience })}
        </div>

        {/* 3 stat boxes */}
        <div className="rs-stat-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
          <div className="rs-stat-box">
            <div style={{ fontSize:'24px', fontWeight:900, color:'var(--sm-ink)' }}>{userSalary}M</div>
            <div style={{ fontSize:'11px', color:'var(--sm-text-mute)', marginTop:'4px' }}>{t('result.yourSalary')}</div>
          </div>
          <div className="rs-stat-box">
            <div style={{ fontSize:'24px', fontWeight:900, color:'var(--sm-ink)' }}>{marketMedian}M</div>
            <div style={{ fontSize:'11px', color:'var(--sm-text-mute)', marginTop:'4px' }}>{t('result.marketMedian')}</div>
          </div>
          <div className="rs-stat-box" style={{ background:'var(--sm-accent-tint2)', border:'1px solid var(--sm-accent-border)' }}>
            <div style={{ fontSize:'24px', fontWeight:900, color: isPositive ? 'var(--sm-green)' : 'var(--sm-accent)' }}>
              {isPositive ? '+' : ''}{diff}M
            </div>
            <div style={{ fontSize:'11px', color:'var(--sm-text-mute)', marginTop:'4px' }}>{isPositive ? t('result.aboveMedian') : t('result.belowMedian')}</div>
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
          <div style={{ position:'relative', height:'6px', background:'var(--sm-line)', borderRadius:'3px' }}>
            <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pctPosition}%`,
              background:'linear-gradient(90deg,rgba(255,68,0,0.3),var(--sm-accent))', borderRadius:'3px' }} />
            <div style={{ position:'absolute', left:`${pctPosition}%`, top:'50%', transform:'translate(-50%,-50%)',
              width:'12px', height:'12px', borderRadius:'50%', background:'var(--sm-accent)',
              animation:'glowPulse 2s ease-in-out infinite' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
            <span style={{ fontSize:'9px', color:'var(--sm-text-mute)' }}>{t('result.lowest')}</span>
            <span style={{ fontSize:'9px', color:'var(--sm-text-mute)' }}>{t('result.median')}</span>
            <span style={{ fontSize:'9px', color:'var(--sm-text-mute)' }}>{t('result.highest')}</span>
          </div>
        </div>

        {/* Salary distribution bars */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'60px', marginBottom:'24px' }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex:1, height:`${b.h}%`, borderRadius:'2px 2px 0 0', transition:'all .3s',
              background: b.isUser ? 'var(--sm-accent)' : b.belowUser ? 'var(--sm-line-strong)' : 'var(--sm-line)',
              boxShadow: b.isUser ? '0 0 8px rgba(255,68,0,0.4)' : 'none' }} />
          ))}
        </div>
      </div>

      {/* 나보다 더 주는 회사 — /api/result topCompanies. 클릭 → 회사 상세 패널(가입 게이트 연동) */}
      {result.topCompanies?.length > 0 && (
        <div style={{ marginTop:'24px', background:'var(--sm-surface)', border:'1px solid var(--sm-line)', borderRadius:'18px', padding:'18px 16px' }}>
          <div style={{ fontSize:'21px', fontWeight:900, color:'var(--sm-ink)', lineHeight:1.2, letterSpacing:'-.01em', marginBottom:'8px' }}>
            {t('result.topCoHead')}
          </div>
          <div style={{ fontSize:'13px', color:'var(--sm-text-sub)', marginBottom:'16px' }}>
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
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--sm-line)' }}>
                <div style={{ width:38, height:38, borderRadius:'9px', background:'var(--sm-surface-sub)',
                  border:'1px solid var(--sm-line)', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'12px', fontWeight:800, color:'var(--sm-text-mute)', flexShrink:0, overflow:'hidden' }}>
                  {co.domain
                    ? <img src={`https://www.google.com/s2/favicons?domain=${co.domain}&sz=128`} alt=""
                        style={{ width:'100%', height:'100%', objectFit:'contain', background:'#fafaf8' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    : co.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:'var(--sm-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{co.name}</div>
                  <div style={{ fontSize:'11px', color:'var(--sm-text-sub)', marginTop:'2px' }}>{role} · {t('result.median')}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:'var(--sm-ink)', whiteSpace:'nowrap' }}>{co.median}M</div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'var(--sm-green)', marginTop:'2px' }}>+{co.premiumPct}%</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => {
              track('result_company_card_click', { meta: { company: '_view_all' } })
              const grid = document.querySelector('.cards-section') || document.getElementById('company-grid-root')
              grid?.scrollIntoView({ behavior:'smooth' })
            }}
            style={{ width:'100%', marginTop:'14px', background:'var(--sm-surface-sub)', color:'var(--sm-ink)',
              border:'1px solid var(--sm-line-strong)', borderRadius:'12px', padding:'13px', fontSize:'13px', fontWeight:700,
              cursor:'pointer', fontFamily:"inherit" }}>
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
          <div style={{ marginTop:'24px', background:'linear-gradient(180deg,var(--sm-accent-tint2),rgba(255,68,0,0))',
            border:'1px solid var(--sm-accent-border)', borderRadius:'18px', padding:'18px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ width:'26px', height:'26px', borderRadius:'8px', background:'var(--sm-accent-tint)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sm-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
              </span>
              <span style={{ fontSize:'10px', fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--sm-accent)' }}>
                {t('result.jobsEyebrow')}
              </span>
            </div>
            <div style={{ fontSize:'21px', fontWeight:900, color:'var(--sm-ink)', lineHeight:1.2, letterSpacing:'-.01em', marginBottom:'8px' }}>
              {t(headKey, { role })}
            </div>
            <div style={{ fontSize:'13px', color:'var(--sm-text-sub)', marginBottom:'16px' }}>
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
                    borderBottom: i < shown.length - 1 ? '1px solid var(--sm-line)' : 'none', borderRadius:'8px',
                    cursor: locked ? 'default' : 'pointer', transition:'background .12s',
                    ...(locked ? { filter:'blur(5px)', opacity:0.4, pointerEvents:'none', userSelect:'none' } : {}) }}
                    onMouseEnter={e => { if (!locked) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width:38, height:38, borderRadius:'9px', background:'var(--sm-surface-sub)',
                      border:'1px solid var(--sm-line)', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'12px', fontWeight:800, color:'var(--sm-text-mute)', flexShrink:0, overflow:'hidden' }}>
                      {job.logo_url
                        ? <img src={job.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : (job.company_initials || job.company?.slice(0, 2) || '–').toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'14px', fontWeight:700, color:'var(--sm-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{job.company}</div>
                      <div style={{ fontSize:'11px', color:'var(--sm-text-sub)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'2px' }}>
                        {job.title}{job.location ? ` · ${job.location}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:'14px', fontWeight:700, color:'var(--sm-ink)', whiteSpace:'nowrap' }}>{min}–{max}M</div>
                      {showBump && bump > 0
                        ? <div style={{ fontSize:'11px', fontWeight:700, color:'var(--sm-accent)', marginTop:'2px' }}>+{bump}%</div>
                        : <div style={{ fontSize:'10px', color:'var(--sm-text-mute)', marginTop:'2px' }}>{t('result.perMonth')}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={goToJobs} style={{ width:'100%', marginTop:'14px', background:'var(--sm-accent)', color:'#fff',
              border:'none', borderRadius:'12px', padding:'13px', fontSize:'13px', fontWeight:700, cursor:'pointer',
              fontFamily:"inherit" }}>
              {moreCount > 0 ? t('result.seeMoreJobs', { count: moreCount }) : t('result.jobsEmptyCta')}
            </button>
          </div>
        )
      })()}

      {/* Job suggestions — empty state (T4) */}
      {jobData && jobData.tier === 'empty' && (
        <div style={{ marginTop:'20px', background:'var(--sm-surface)', border:'1px solid var(--sm-line)',
          borderRadius:'14px', padding:'20px', textAlign:'center' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:'var(--sm-ink)', marginBottom:'4px' }}>{t('result.jobsEmptyHead')}</div>
          <div style={{ fontSize:'12px', color:'var(--sm-text-sub)', marginBottom:'14px' }}>{t('result.jobsEmptySub', { role })}</div>
          <button onClick={goToJobs} style={{ width:'100%', background:'var(--sm-accent-tint)', color:'var(--sm-accent)',
            border:'1px solid var(--sm-accent-border)', borderRadius:'12px', padding:'13px', fontSize:'13px', fontWeight:700,
            cursor:'pointer', fontFamily:"inherit" }}>
            {t('result.jobsEmptyCta')}
          </button>
        </div>
      )}
      </div>

      {/* 하드 게이트 오버레이 — CTA 클릭 계측/귀속은 openLoginGate('result')가 담당 */}
      {gateLocked && (
        <div style={{ position:'absolute', inset:0, zIndex:5, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'10px', padding:'24px', textAlign:'center',
          background:'linear-gradient(180deg, rgba(8,8,8,0.15) 0%, rgba(8,8,8,0.55) 100%)', borderRadius:'20px' }}>
          <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(255,68,0,0.15)',
            border:'1px solid rgba(255,68,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sm-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <div style={{ fontSize:'22px', fontWeight:900, color:'#fff', letterSpacing:'-.01em' }}>{t('result.gateTitle')}</div>
          <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.6)', lineHeight:1.5, maxWidth:'320px' }}>{t('result.gateSub')}</div>
          <button onClick={() => {
              if (typeof window !== 'undefined') {
                if (window.openLoginGate) window.openLoginGate('result')
                else if (window.openAuthModal) window.openAuthModal('gate')
              }
            }}
            style={{ marginTop:'6px', background:'var(--sm-accent)', color:'#fff', border:'none', borderRadius:'14px',
              padding:'15px 28px', fontSize:'15px', fontWeight:800, cursor:'pointer',
              fontFamily:"inherit", boxShadow:'0 8px 32px rgba(255,68,0,0.35)' }}>
            {t('result.gateCta')}
          </button>
          <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)' }}>{t('result.gateHint')}</div>
        </div>
      )}
    </div>
  )
}
