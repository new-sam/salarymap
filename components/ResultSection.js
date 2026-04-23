import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import NextStepSheet from './NextStepSheet'

export default function ResultSection({ salary, role, experience, company, isLoggedIn }) {
  const [result, setResult] = useState(null)
  const [jobs, setJobs] = useState([])
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
        setJobs(data.filter(j => j.salary_min > salary && j.role?.toLowerCase().includes(role?.toLowerCase()?.split(' ')[0])))
      } catch {}
    }
    if (salary) { fetchResult(); fetchJobs(); }
  }, [salary, role, experience, company])

  if (!result) return (
    <div style={{ padding:'clamp(20px,4vw,32px)', textAlign:'center' }}>
      <div style={{ width:60, height:60, borderRadius:'50%', border:'3px solid #ff4400', borderTopColor:'transparent',
        animation:'spin .8s linear infinite', margin:'40px auto 16px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>Đang tính thứ hạng...</div>
    </div>
  )

  const { percentile, userSalary, marketMedian, diff, topCompanies } = result
  const isPositive = diff >= 0
  const state = percentile <= 33 ? 'high' : percentile <= 66 ? 'mid' : 'low'

  const verdictMap = {
    high: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', color: '#4ade80', icon: '✦', text: "Bạn đang kiếm được cao hơn thị trường" },
    mid: { bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.25)', color: '#facc15', icon: '◎', text: "Bạn gần với mức thị trường" },
    low: { bg: 'rgba(255,68,0,0.1)', border: 'rgba(255,68,0,0.25)', color: '#ff6b35', icon: '↓', text: 'Bạn có thể đang bị trả thấp' },
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
  const avgBump = jobCount > 0 ? Math.round(jobs.reduce((a, j) => a + ((j.salary_min - salary) / salary * 100), 0) / jobCount) : 0

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
          KẾT QUẢ CỦA BẠN · {role} · {experience}
        </div>

        {/* Big percentile */}
        <div style={{ textAlign:'center', marginBottom:'8px' }}>
          <span className="rs-big-pct" style={{ fontSize:'80px', fontWeight:900, fontStyle:'italic', color:'#ff4400', textShadow:'0 0 60px rgba(255,68,0,0.3)', lineHeight:1 }}>
            {percentile <= 50 ? `Top ${percentile}%` : `Bottom ${100 - percentile}%`}
          </span>
        </div>
        <div style={{ textAlign:'center', fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'24px' }}>
          Trong số các kỹ sư {role} với {experience} tại Việt Nam
        </div>

        {/* 3 stat boxes */}
        <div className="rs-stat-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
          <div className="rs-stat-box">
            <div style={{ fontSize:'24px', fontWeight:900, color:'#fff' }}>{userSalary}M</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>Lương của bạn</div>
          </div>
          <div className="rs-stat-box">
            <div style={{ fontSize:'24px', fontWeight:900, color:'#fff' }}>{marketMedian}M</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>Trung vị thị trường</div>
          </div>
          <div className="rs-stat-box" style={{ background:'rgba(255,68,0,0.08)', border:'1px solid rgba(255,68,0,0.25)' }}>
            <div style={{ fontSize:'24px', fontWeight:900, color: isPositive ? '#4ade80' : '#ff4400' }}>
              {isPositive ? '+' : ''}{diff}M
            </div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>{isPositive ? 'Trên' : 'Dưới'} trung vị</div>
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
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.2)' }}>Thấp nhất</span>
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.2)' }}>Trung vị</span>
            <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.2)' }}>Cao nhất</span>
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
            CÔNG TY TRẢ CAO HƠN CHO VỊ TRÍ CỦA BẠN
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
        <div onClick={() => router.push('/jobs')} style={{ marginTop:'16px', background:'rgba(255,68,0,0.06)',
          border:'1px solid rgba(255,68,0,0.2)', borderRadius:'14px', padding:'16px', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>
              {jobCount} việc làm trả cao hơn +{avgBump}%
            </div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>
              For {role} with {experience}
            </div>
          </div>
          <span style={{ fontSize:'13px', fontWeight:700, color:'#ff4400', whiteSpace:'nowrap' }}>Xem việc làm →</span>
        </div>
      )}

      {/* NextStep sheet */}
      {result && !isLoggedIn && (
        <NextStepSheet role={role} experience={experience} percentile={percentile} topCompanies={topCompanies} />
      )}
      {/* Logged-in CTA */}
      {result && isLoggedIn && topCompanies?.length > 0 && (
        <div style={{ marginTop:'16px', background:'linear-gradient(135deg,#1a0d07,#111)', border:'1px solid rgba(255,96,0,0.2)',
          borderRadius:'14px', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>{topCompanies.length} công ty trả cao hơn cho vị trí của bạn</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>Headhunter của chúng tôi có thể giới thiệu bạn.</div>
          </div>
          <a href="/jobs" style={{ background:'#ff4400', color:'#fff', border:'none', padding:'10px 20px',
            borderRadius:'10px', fontSize:'13px', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
            Xem việc làm →
          </a>
        </div>
      )}
    </div>
  )
}
