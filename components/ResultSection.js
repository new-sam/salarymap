import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import NextStepSheet from './NextStepSheet'
import { useT } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

export default function ResultSection({ salary, role, experience, company, isLoggedIn }) {
  const { t } = useT()
  const [result, setResult] = useState(null)
  const [jobs, setJobs] = useState([])
  const [sheetDismissed, setSheetDismissed] = useState(false)
  const [showSheet, setShowSheet] = useState(true)
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
        setJobs(data.filter(j => j.salary_min > (salary * 1000000) && j.role?.toLowerCase().includes(role?.toLowerCase()?.split(' ')[0])))
      } catch {}
    }
    if (salary) { fetchResult(); fetchJobs(); }
  }, [salary, role, experience, company])

  if (!result) return (
    <div style={{ padding:'clamp(20px,4vw,32px)', textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', border:'3px solid #ff4400', borderTopColor:'transparent',
        animation:'spin .8s linear infinite', margin:'40px auto 16px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>{t('result.loading')}</div>
    </div>
  )

  const { percentile, userSalary, marketMedian, diff, topCompanies } = result
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

  const jobCount = jobs.length
  const salaryVnd = salary * 1000000
  const avgBump = jobCount > 0 ? Math.round(jobs.reduce((a, j) => a + ((j.salary_min - salaryVnd) / salaryVnd * 100), 0) / jobCount) : 0

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

      {/* Companies paying more */}
      {topCompanies && topCompanies.length > 0 && (
        <div style={{ marginTop:'20px' }}>
          <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.1em', color:'rgba(255,255,255,0.25)',
            textTransform:'uppercase', marginBottom:'12px' }}>
            {t('result.companiesPayMore')}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {topCompanies.slice(0, 5).map((co, i) => {
              const locked = i >= 2
              return (
                <div key={i} className="rs-co-row" style={locked ? { filter:'blur(4px)', pointerEvents:'none' } : {}}>
                  <div style={{ width:36, height:36, borderRadius:'8px', background:'rgba(255,255,255,0.08)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:800,
                    color:'rgba(255,255,255,0.4)', flexShrink:0 }}>
                    {co.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'14px', fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{co.name}</div>
                  </div>
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#ff4400', background:'rgba(255,68,0,0.1)',
                    padding:'4px 10px', borderRadius:'8px', whiteSpace:'nowrap', flexShrink:0 }}>
                    +{co.premiumPct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Jobs nudge */}
      {state !== 'high' && jobCount > 0 && (
        <div onClick={async () => {
          if (typeof gtag === 'function') gtag('event', 'cta_click_view_jobs', { source: 'result_nudge' })
          if (typeof fbq === 'function') fbq('trackCustom', 'CTAClickViewJobs', { source: 'result_nudge' })
          if (isLoggedIn) {
            router.push('/jobs')
          } else {
            localStorage.setItem('fyi_login_return', '/jobs')
            supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
          }
        }} style={{ marginTop:'16px', background:'rgba(255,68,0,0.06)',
          border:'1px solid rgba(255,68,0,0.2)', borderRadius:'14px', padding:'16px', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>
              {t('result.jobsPayMore', { count: jobCount, bump: avgBump })}
            </div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>
              For {role} with {experience}
            </div>
          </div>
          <span style={{ fontSize:'13px', fontWeight:700, color:'#ff4400', whiteSpace:'nowrap' }}>{t('result.viewJobs')}</span>
        </div>
      )}

      {/* NextStep sheet */}
      {result && !isLoggedIn && showSheet && (
        <NextStepSheet role={role} experience={experience} percentile={percentile} topCompanies={topCompanies}
          onDismiss={() => { setShowSheet(false); setSheetDismissed(true); }} />
      )}
      {/* Reopen button after dismiss */}
      {result && !isLoggedIn && sheetDismissed && !showSheet && (
        <div style={{ marginTop:'16px', textAlign:'center' }}>
          <button onClick={() => { setShowSheet(true); setSheetDismissed(false); }}
            style={{ background:'rgba(0,128,255,0.1)', border:'1px solid rgba(0,128,255,0.3)', borderRadius:'12px',
              padding:'12px 24px', fontSize:'13px', fontWeight:700, color:'#0080FF', cursor:'pointer',
              fontFamily:"'Be Vietnam Pro',sans-serif" }}>
            {t('result.connectHigher')}
          </button>
        </div>
      )}
      {/* Logged-in CTA */}
      {result && isLoggedIn && topCompanies?.length > 0 && (
        <div style={{ marginTop:'16px', background:'linear-gradient(135deg,#1a0d07,#111)', border:'1px solid rgba(255,96,0,0.2)',
          borderRadius:'14px', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>{t('result.companiesHigher', { count: topCompanies.length })}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>{t('result.headhunterIntro')}</div>
          </div>
          <a href="/jobs" style={{ background:'#ff4400', color:'#fff', border:'none', padding:'10px 20px',
            borderRadius:'10px', fontSize:'13px', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
            {t('result.viewJobs')}
          </a>
        </div>
      )}
    </div>
  )
}
