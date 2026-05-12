import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useKo } from '../../lib/i18n'
import { supabase } from '../../lib/supabaseClient'

// Animated counter
function Counter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
          setCount(Math.floor(eased * end))
          if (progress < 1) requestAnimationFrame(tick)
        }
        tick()
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// Floating card animation
function FloatingCards() {
  const cards = [
    { name: 'Nguyen H.', pos: 'Backend', score: 91, color: '#22c55e', x: 2, y: 15, delay: 0 },
    { name: 'Tran M.', pos: 'Frontend', score: 87, color: '#22c55e', x: 78, y: 8, delay: 0.5 },
    { name: 'Le V.', pos: 'Fullstack', score: 84, color: '#eab308', x: 5, y: 70, delay: 1 },
    { name: 'Pham T.', pos: 'Mobile', score: 79, color: '#eab308', x: 75, y: 65, delay: 1.5 },
    { name: 'Vo A.', pos: 'AI/Data', score: 93, color: '#22c55e', x: 85, y: 38, delay: 0.8 },
  ]
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${c.x}%`, top: `${c.y}%`,
          background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)', borderRadius: 12, padding: '10px 14px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)',
          animation: `hrFloat 8s ease-in-out ${c.delay}s infinite, hrFadeIn 1s ease ${c.delay + 0.5}s both`,
          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', opacity: 0.45,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: c.color, opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{c.score}</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,0,0,0.4)' }}>{c.name}</div>
            <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.25)' }}>{c.pos}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

const POSITIONS = [
  { label: 'Backend', num: 1059, icon: '{}', color: '#ff6000' },
  { label: 'Frontend', num: 827, icon: '<>', color: '#2563eb' },
  { label: 'Fullstack', num: 241, icon: '[]', color: '#7c3aed' },
  { label: 'Mobile', num: 237, icon: '#', color: '#16a34a' },
  { label: 'AI / Data', num: 168, icon: 'AI', color: '#db2777' },
  { label: 'Design', num: 99, icon: 'Ds', color: '#0891b2' },
  { label: 'QA', num: 22, icon: 'QA', color: '#ca8a04' },
  { label: 'DevOps', num: 11, icon: 'Op', color: '#64748b' },
]
const POS_MAX = 1059

function PositionChart({ t, liveTotal }) {
  const ref = useRef(null)
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && visibleCount === 0) {
        let i = 0
        const timer = setInterval(() => {
          i++
          setVisibleCount(i)
          if (i >= POSITIONS.length) clearInterval(timer)
        }, 250)
      }
    }, { threshold: 0.15 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [visibleCount])

  return (
    <section className="hrh-positions" ref={ref}>
      <h2>{t('hr.home.posTitle')}</h2>
      <p className="hrh-positions-sub">{t('hr.home.posSub')}</p>
      <div className="hrh-pos-list">
        {POSITIONS.map((p, i) => {
          const show = i < visibleCount
          return (
            <div key={p.label} className="hrh-pos-row" style={{ opacity: show ? 1 : 0, transform: show ? 'translateX(0)' : 'translateX(-20px)', transition: 'all 0.5s ease' }}>
              <div className="hrh-pos-icon" style={{ background: `${p.color}12`, color: p.color }}>
                <span style={{ fontSize: 11, fontWeight: 900 }}>{p.icon}</span>
              </div>
              <div className="hrh-pos-info">
                <div className="hrh-pos-top">
                  <span className="hrh-pos-label">{p.label}</span>
                  <span className="hrh-pos-num">{show ? p.num.toLocaleString() : ''}</span>
                </div>
                <div className="hrh-pos-bar">
                  <div className="hrh-pos-bar-fill" style={{
                    width: show ? `${(p.num / POS_MAX) * 100}%` : '0%',
                    background: p.color,
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="hrh-pos-total" style={{ opacity: visibleCount >= POSITIONS.length ? 1 : 0, transition: 'opacity 0.6s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="hrh-pos-live-dot" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('hr.home.posLive')}</span>
        </div>
        <div className="hrh-pos-total-num">
          {liveTotal != null ? liveTotal.toLocaleString() : '-'}<em>+</em>
        </div>
        <div className="hrh-pos-total-label">{t('hr.home.statCandidates')}</div>
      </div>
    </section>
  )
}

function HowSteps({ t }) {
  const [active, setActive] = useState(0)
  const [key, setKey] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)

  // Only start cycling when section scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) {
        setStarted(true)
        setActive(0)
        setKey(k => k + 1)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const interval = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % 3
        setKey(k => k + 1)
        return next
      })
    }, 2500)
    return () => clearInterval(interval)
  }, [started])

  const steps = [
    { num: '01', key: 'step1', arrow: true },
    { num: '02', key: 'step2', arrow: true },
    { num: '03', key: 'step3', arrow: false },
  ]

  return (
    <section className="hrh-how" id="how" ref={ref}>
      <div className="hrh-how-inner">
        <h2>{t('hr.home.howTitle')}</h2>
        <div className="hrh-how-steps">
          {steps.map((s, i) => (
            <div key={i} className={`hrh-step${active === i ? ' active' : ''}`}>
              <div className="hrh-step-num">{s.num}</div>
              <h3>{t(`hr.home.${s.key}Title`)}</h3>
              <p>{t(`hr.home.${s.key}Desc`)}</p>
              {s.arrow && <span className="hrh-step-arrow">&rarr;</span>}
              <div className="hrh-step-bar">
                <div className="hrh-step-bar-fill" key={active === i ? key : 'idle'} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HRHome() {
  const { t } = useKo()
  const [liveTotal, setLiveTotal] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/hr/candidate-count').then(r => r.json()).then(d => setLiveTotal(d.count)).catch(() => {})
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user)
    })
  }, [])

  return (
    <>
      <Head>
        <title>FYI for HR - {t('hr.home.title')}</title>
        <meta name="description" content={t('hr.home.desc')} />
      </Head>
      <style>{`
        .hrh { min-height: 100vh; background: #fff; font-family: 'Barlow', system-ui, sans-serif; overflow-x: hidden; }

        /* Animations */
        @keyframes hrFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes hrFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes hrSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes hrPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,96,0,0.3); } 50% { box-shadow: 0 0 0 12px rgba(255,96,0,0); } }
        .hrh-anim { animation: hrSlideUp 0.7s ease both; }
        .hrh-anim-d1 { animation-delay: 0.1s; }
        .hrh-anim-d2 { animation-delay: 0.2s; }
        .hrh-anim-d3 { animation-delay: 0.3s; }
        .hrh-anim-d4 { animation-delay: 0.4s; }

        /* Nav */
        .hrh-nav { display: flex; align-items: center; justify-content: space-between; padding: 16px 48px; position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.04); }
        .hrh-logo { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: #111; text-decoration: none; }
        .hrh-logo img { width: 28px; height: 28px; }
        .hrh-logo span { color: #ff6000; }
        .hrh-nav-r { display: flex; align-items: center; gap: 16px; }
        .hrh-toggle { display: flex; background: #f3f3f3; border-radius: 100px; padding: 2px; }
        .hrh-toggle a { font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 100px; text-decoration: none; transition: all .2s; color: #999; }
        .hrh-toggle a:hover { color: #555; }
        .hrh-toggle .on { background: #ff6000; color: #fff; }
        .hrh-login-btn { font-size: 13px; font-weight: 600; color: #fff; background: #ff6000; padding: 8px 24px; border-radius: 100px; text-decoration: none; transition: opacity .15s; }
        .hrh-login-btn:hover { opacity: 0.85; }

        /* Hero */
        .hrh-hero { position: relative; max-width: 1200px; margin: 0 auto; padding: 100px 24px 120px; text-align: center; min-height: 520px; }
        .hrh-hero-content { position: relative; z-index: 2; }
        .hrh-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #ff6000; background: #fff7ed; padding: 8px 20px; border-radius: 100px; margin-bottom: 28px; border: 1px solid #fed7aa; }
        .hrh-badge img { width: 18px; height: 18px; border-radius: 4px; }
        .hrh-hero h1 { font-size: 48px; font-weight: 900; color: #111; margin: 0 0 20px; line-height: 1.15; letter-spacing: -0.02em; }
        .hrh-hero h1 em { font-style: normal; color: #ff6000; }
        .hrh-hero-sub { font-size: 18px; color: #777; line-height: 1.7; margin: 0 auto 44px; max-width: 580px; }
        .hrh-cta-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
        .hrh-cta { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #fff; background: #ff6000; padding: 16px 40px; border-radius: 12px; text-decoration: none; transition: all .2s; animation: hrPulse 3s infinite; }
        .hrh-cta:hover { background: #e55500; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(255,96,0,0.25); }
        .hrh-cta-sub { font-size: 14px; font-weight: 500; color: #999; text-decoration: none; padding: 16px 24px; border: 1px solid #e5e5e5; border-radius: 12px; transition: all .15s; }
        .hrh-cta-sub:hover { border-color: #ccc; color: #555; }

        /* Trusted by */
        .hrh-trust { text-align: center; padding: 0 24px 80px; }
        .hrh-trust-label { font-size: 12px; font-weight: 600; color: #ccc; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; }
        .hrh-trust-logos { display: flex; align-items: center; justify-content: center; gap: 36px; opacity: 0.4; }

        /* Stats */
        .hrh-stats { display: flex; justify-content: center; gap: 0; max-width: 800px; margin: 0 auto; padding: 0 24px 100px; }
        .hrh-stat { flex: 1; text-align: center; padding: 32px 0; }
        .hrh-stat + .hrh-stat { border-left: 1px solid #f0f0f0; }
        .hrh-stat-num { font-size: 44px; font-weight: 900; color: #111; }
        .hrh-stat-num em { font-style: normal; color: #ff6000; }
        .hrh-stat-label { font-size: 13px; color: #999; margin-top: 6px; }

        /* Value Props */
        .hrh-value { max-width: 1000px; margin: 0 auto; padding: 0 24px 100px; }
        .hrh-value-header { text-align: center; margin-bottom: 56px; }
        .hrh-value-header h2 { font-size: 32px; font-weight: 900; color: #111; margin: 0 0 12px; }
        .hrh-value-header p { font-size: 16px; color: #999; }
        .hrh-value-grid { display: flex; flex-direction: column; gap: 20px; }
        .hrh-val-card { display: flex; align-items: center; gap: 36px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 20px; padding: 32px 36px; transition: all .25s; }
        .hrh-val-card:nth-child(even) { flex-direction: row-reverse; }
        .hrh-val-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.06); border-color: #e0e0e0; }
        .hrh-val-text { flex: 1; min-width: 0; }
        .hrh-val-icon { width: 260px; height: 180px; border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0; }

        /* Val1: Scanning animation */
        @keyframes scanLine { 0%,100% { top: 15%; } 50% { top: 75%; } }
        @keyframes profilePop { 0%,100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes checkPop { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.2) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        .scan-line { position: absolute; left: 15%; right: 15%; height: 2px; background: linear-gradient(90deg, transparent, #ff6000, transparent); animation: scanLine 3s ease-in-out infinite; border-radius: 1px; }
        .scan-card { animation: profilePop 3s ease-in-out infinite; }

        /* Val2: Globe + check */
        @keyframes globeSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pingDot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0; } }
        .globe-ring { animation: globeSpin 12s linear infinite; transform-origin: center; }
        .ping-dot { animation: pingDot 2s ease-in-out infinite; }
        .ping-dot-d1 { animation-delay: 0.7s; }
        .ping-dot-d2 { animation-delay: 1.4s; }

        /* Val3: Calendar check */
        @keyframes calSlide { 0%,100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        @keyframes calCheck { 0%,40% { stroke-dashoffset: 20; } 60%,100% { stroke-dashoffset: 0; } }
        .cal-row { animation: calSlide 4s ease-in-out infinite; }
        .cal-row-d1 { animation-delay: 0.3s; }
        .cal-row-d2 { animation-delay: 0.6s; }
        .cal-check { stroke-dasharray: 20; animation: calCheck 3s ease-in-out infinite; }
        .hrh-val-num { font-size: 12px; font-weight: 800; color: #ff6000; background: #fff7ed; display: inline-block; padding: 3px 10px; border-radius: 100px; margin-bottom: 12px; letter-spacing: 0.03em; }
        .hrh-val-card h3 { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 10px; }
        .hrh-val-card p { font-size: 14px; color: #888; line-height: 1.7; margin: 0; }

        /* How it works */
        .hrh-how { background: #111; color: #fff; padding: 100px 24px; }
        .hrh-how-inner { max-width: 900px; margin: 0 auto; }
        .hrh-how h2 { font-size: 32px; font-weight: 900; text-align: center; margin: 0 0 60px; }
        .hrh-how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
        .hrh-step { position: relative; opacity: 0.3; transition: opacity 0.5s ease, transform 0.5s ease; transform: translateY(4px); }
        .hrh-step.active { opacity: 1; transform: translateY(0); }
        .hrh-step-num { font-size: 64px; font-weight: 900; color: rgba(255,96,0,0.1); line-height: 1; margin-bottom: 12px; transition: color 0.5s ease; }
        .hrh-step.active .hrh-step-num { color: rgba(255,96,0,0.4); }
        .hrh-step h3 { font-size: 17px; font-weight: 700; margin: 0 0 10px; color: rgba(255,255,255,0.4); transition: color 0.5s ease; }
        .hrh-step.active h3 { color: #fff; }
        .hrh-step p { font-size: 13px; color: rgba(255,255,255,0.2); line-height: 1.6; margin: 0; transition: color 0.5s ease; }
        .hrh-step.active p { color: rgba(255,255,255,0.6); }
        .hrh-step-arrow { position: absolute; top: 40px; right: -20px; font-size: 20px; color: rgba(255,255,255,0.08); transition: color 0.5s ease; }
        .hrh-step.active .hrh-step-arrow { color: rgba(255,96,0,0.4); }
        .hrh-step-bar { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; margin-top: 20px; overflow: hidden; }
        .hrh-step-bar-fill { height: 100%; width: 0%; background: #ff6000; border-radius: 2px; }
        .hrh-step.active .hrh-step-bar-fill { animation: hrBarFill 2.5s linear forwards; }
        @keyframes hrBarFill { from { width: 0%; } to { width: 100%; } }

        /* Position breakdown */
        .hrh-positions { max-width: 800px; margin: 0 auto; padding: 100px 24px; }
        .hrh-positions h2 { font-size: 28px; font-weight: 900; color: #111; text-align: center; margin: 0 0 12px; }
        .hrh-positions-sub { font-size: 14px; color: #999; text-align: center; margin: 0 0 48px; }
        .hrh-pos-list { display: flex; flex-direction: column; gap: 14px; }
        .hrh-pos-row { display: flex; align-items: center; gap: 16px; }
        .hrh-pos-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .hrh-pos-info { flex: 1; min-width: 0; }
        .hrh-pos-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
        .hrh-pos-label { font-size: 14px; font-weight: 700; color: #111; }
        .hrh-pos-num { font-size: 14px; font-weight: 800; color: #ff6000; }
        .hrh-pos-bar { height: 8px; background: #f3f3f3; border-radius: 4px; overflow: hidden; }
        .hrh-pos-bar-fill { height: 100%; border-radius: 4px; transition: width 1.2s cubic-bezier(0.16,1,0.3,1); }
        .hrh-pos-total { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0; }
        .hrh-pos-total-num { font-size: 36px; font-weight: 900; color: #111; animation: hrNumBump 0.3s ease; }
        .hrh-pos-total-num em { color: #ff6000; font-style: normal; }
        .hrh-pos-total-label { font-size: 13px; color: #999; margin-top: 4px; }
        @keyframes hrNumBump { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
        .hrh-pos-live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: hrLivePulse 1.5s ease-in-out infinite; }
        @keyframes hrLivePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }

        /* CTA bottom */
        .hrh-bottom-cta { text-align: center; padding: 80px 24px 100px; background: linear-gradient(180deg, #fff 0%, #fff7ed 100%); }
        .hrh-bottom-cta h2 { font-size: 32px; font-weight: 900; color: #111; margin: 0 0 16px; }
        .hrh-bottom-cta p { font-size: 16px; color: #888; margin: 0 0 36px; }

        /* Footer */
        .hrh-footer { display: flex; align-items: center; justify-content: space-between; padding: 32px 48px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #ccc; }
        .hrh-footer a { color: #999; text-decoration: none; }
        .hrh-footer a:hover { color: #555; }

        @media (max-width: 768px) {
          .hrh-nav { padding: 12px 16px; }
          .hrh-hero { padding: 60px 16px 80px; min-height: auto; }
          .hrh-hero h1 { font-size: 30px; }
          .hrh-hero-sub { font-size: 15px; }
          .hrh-cta-row { flex-direction: column; gap: 12px; }
          .hrh-stats { flex-direction: column; gap: 0; }
          .hrh-stat + .hrh-stat { border-left: none; border-top: 1px solid #f0f0f0; }
          .hrh-stat-num { font-size: 32px; }
          .hrh-val-card { flex-direction: column !important; padding: 24px; gap: 20px; }
          .hrh-val-icon { width: 100%; height: 160px; }
          .hrh-how-steps { grid-template-columns: 1fr; }
          .hrh-step-arrow { display: none; }
          .hrh-pos-icon { width: 32px; height: 32px; font-size: 14px; }
          .hrh-footer { flex-direction: column; gap: 8px; text-align: center; }
        }
      `}</style>

      <div className="hrh">
        {/* Nav */}
        <nav className="hrh-nav">
          <a href="/" className="hrh-logo">
            <img src="/logo.png" alt="FYI" />
            FYI <span>for HR</span>
          </a>
          <div className="hrh-nav-r">
            <div className="hrh-toggle">
              <a href="/" onClick={() => sessionStorage.setItem('fyi_view_mode','seeker')}>Seeker</a>
              <a href="/hr/home" className="on">HR</a>
            </div>
            {user ? (<>
              <Link href="/hr" className="hrh-login-btn">{t('hr.home.dashboard')}</Link>
              <button onClick={async () => { await supabase.auth.signOut(); setUser(null); }}
                style={{ fontSize: 12, fontWeight: 600, color: '#999', background: 'none', border: '1px solid #e5e5e5', padding: '8px 16px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('hr.home.logout')}
              </button>
            </>) : (
              <Link href="/hr/login" className="hrh-login-btn">{t('hr.home.loginBtn')}</Link>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="hrh-hero">
          <FloatingCards />
          <div className="hrh-hero-content">
            <div className="hrh-badge hrh-anim">
              <img src="/logo.png" alt="" />
              {t('hr.home.badge')}
            </div>
            <h1 className="hrh-anim hrh-anim-d1">{t('hr.home.h1a')}<br /><em>{t('hr.home.h1b')}</em></h1>
            <p className="hrh-hero-sub hrh-anim hrh-anim-d2">{t('hr.home.desc')}</p>
            <div className="hrh-cta-row hrh-anim hrh-anim-d3">
              <Link href={user ? '/hr' : '/hr/login'} className="hrh-cta">{user ? t('hr.home.dashboard') : t('hr.home.cta')}</Link>
              <a href="#how" className="hrh-cta-sub">{t('hr.home.ctaSub')}</a>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="hrh-stats">
          <div className="hrh-stat">
            <div className="hrh-stat-num"><Counter end={liveTotal || 3700} /><em>+</em></div>
            <div className="hrh-stat-label">{t('hr.home.statCandidates')}</div>
          </div>
          <div className="hrh-stat">
            <div className="hrh-stat-num"><Counter end={1000} /><em>+</em></div>
            <div className="hrh-stat-label">{t('hr.home.statVisitors')}</div>
          </div>
          <div className="hrh-stat">
            <div className="hrh-stat-num"><Counter end={100} /><em>%</em></div>
            <div className="hrh-stat-label">{t('hr.home.statVerified')}</div>
          </div>
          <div className="hrh-stat">
            <div className="hrh-stat-num"><Counter end={48} /><em>h</em></div>
            <div className="hrh-stat-label">{t('hr.home.statSpeed')}</div>
          </div>
        </section>

        {/* Value Props */}
        <section className="hrh-value">
          <div className="hrh-value-header">
            <h2>{t('hr.home.valueTitle')}</h2>
            <p>{t('hr.home.valueSub')}</p>
          </div>
          <div className="hrh-value-grid">
            {/* Card 1: Scanning/vetting profiles */}
            <div className="hrh-val-card">
              <div className="hrh-val-icon" style={{ background: '#fff7ed' }}>
                <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
                  {/* Profile cards */}
                  <g className="scan-card">
                    <rect x="20" y="25" width="50" height="65" rx="8" fill="#fff" stroke="#fed7aa" strokeWidth="1.5" />
                    <circle cx="45" cy="45" r="10" fill="#ffedd5" />
                    <rect x="32" y="60" width="26" height="4" rx="2" fill="#fdba74" opacity="0.5" />
                    <rect x="35" y="68" width="20" height="3" rx="1.5" fill="#fed7aa" opacity="0.4" />
                    <rect x="30" y="75" width="30" height="8" rx="4" fill="#ff6000" opacity="0.15" />
                    <text x="45" y="81" textAnchor="middle" fontSize="6" fontWeight="700" fill="#ff6000">87</text>
                  </g>
                  <g className="scan-card" style={{ animationDelay: '0.5s' }}>
                    <rect x="80" y="20" width="50" height="65" rx="8" fill="#fff" stroke="#fed7aa" strokeWidth="1.5" />
                    <circle cx="105" cy="40" r="10" fill="#ffedd5" />
                    <rect x="92" y="55" width="26" height="4" rx="2" fill="#fdba74" opacity="0.5" />
                    <rect x="95" y="63" width="20" height="3" rx="1.5" fill="#fed7aa" opacity="0.4" />
                    <rect x="90" y="70" width="30" height="8" rx="4" fill="#22c55e" opacity="0.15" />
                    <text x="105" y="76" textAnchor="middle" fontSize="6" fontWeight="700" fill="#22c55e">93</text>
                  </g>
                  <g className="scan-card" style={{ animationDelay: '1s' }}>
                    <rect x="125" y="30" width="40" height="55" rx="7" fill="#fff" stroke="#f0f0f0" strokeWidth="1" opacity="0.5" />
                    <circle cx="145" cy="47" r="8" fill="#f5f5f5" />
                    <rect x="135" y="60" width="20" height="3" rx="1.5" fill="#e5e5e5" opacity="0.5" />
                  </g>
                  {/* Scan line */}
                  <line className="scan-line" x1="15" y1="0" x2="170" y2="0" />
                  {/* Checkmark badge on card 2 */}
                  <g style={{ animation: 'checkPop 3s ease-in-out 1.5s infinite' }}>
                    <circle cx="122" cy="26" r="9" fill="#22c55e" />
                    <path d="M117 26l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </svg>
              </div>
              <div className="hrh-val-text">
                <div className="hrh-val-num">01</div>
                <h3>{t('hr.home.val1Title')}</h3>
                <p>{t('hr.home.val1Desc')}</p>
              </div>
            </div>

            {/* Card 2: Remote/globe */}
            <div className="hrh-val-card">
              <div className="hrh-val-icon" style={{ background: '#f0fdf4' }}>
                <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
                  {/* Job posting card */}
                  <rect x="30" y="20" width="80" height="100" rx="10" fill="#fff" stroke="#bbf7d0" strokeWidth="1.5" />
                  <rect x="40" y="30" width="40" height="6" rx="3" fill="#16a34a" opacity="0.3" />
                  <rect x="40" y="42" width="60" height="4" rx="2" fill="#e5e5e5" />
                  <rect x="40" y="50" width="50" height="4" rx="2" fill="#e5e5e5" />
                  <rect x="40" y="58" width="55" height="4" rx="2" fill="#e5e5e5" />
                  <rect x="40" y="72" width="50" height="14" rx="7" fill="#16a34a" opacity="0.12" />
                  <text x="65" y="82" textAnchor="middle" fontSize="7" fontWeight="700" fill="#16a34a">APPLY</text>
                  {/* Notification badges popping in */}
                  <g className="ping-dot">
                    <circle cx="105" cy="30" r="10" fill="#ff6000" opacity="0.9" />
                    <text x="105" y="33" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">12</text>
                  </g>
                  {/* Applicant avatars sliding in */}
                  <g className="scan-card">
                    <circle cx="130" cy="55" r="12" fill="#bbf7d0" stroke="#fff" strokeWidth="2" />
                    <circle cx="130" cy="52" r="4" fill="#86efac" />
                    <path d="M124 62a6 6 0 0112 0" fill="#86efac" opacity="0.5" />
                  </g>
                  <g className="scan-card" style={{ animationDelay: '0.4s' }}>
                    <circle cx="148" cy="70" r="10" fill="#dbeafe" stroke="#fff" strokeWidth="2" />
                    <circle cx="148" cy="67.5" r="3.5" fill="#93c5fd" />
                    <path d="M143 77a5 5 0 0110 0" fill="#93c5fd" opacity="0.5" />
                  </g>
                  <g className="scan-card" style={{ animationDelay: '0.8s' }}>
                    <circle cx="138" cy="92" r="9" fill="#ffedd5" stroke="#fff" strokeWidth="2" />
                    <circle cx="138" cy="89.5" r="3" fill="#fdba74" />
                    <path d="M133 98a5 5 0 0110 0" fill="#fdba74" opacity="0.5" />
                  </g>
                  {/* Arrow from avatars to card */}
                  <path d="M118 55 L112 55" stroke="#16a34a" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
                  {/* Daily visitors counter */}
                  <rect x="120" y="105" width="50" height="18" rx="9" fill="#16a34a" opacity="0.1" />
                  <text x="145" y="117" textAnchor="middle" fontSize="7" fontWeight="700" fill="#16a34a">1,000+/day</text>
                </svg>
              </div>
              <div className="hrh-val-text">
                <div className="hrh-val-num">02</div>
                <h3>{t('hr.home.val2Title')}</h3>
                <p>{t('hr.home.val2Desc')}</p>
              </div>
            </div>

            {/* Card 3: Calendar/scheduling */}
            <div className="hrh-val-card">
              <div className="hrh-val-icon" style={{ background: '#eff6ff' }}>
                <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
                  {/* Calendar */}
                  <rect x="30" y="25" width="120" height="90" rx="10" fill="#fff" stroke="#bfdbfe" strokeWidth="1.5" />
                  <rect x="30" y="25" width="120" height="24" rx="10" fill="#2563eb" opacity="0.08" />
                  <circle cx="50" cy="37" r="3" fill="#2563eb" opacity="0.3" />
                  <circle cx="60" cy="37" r="3" fill="#2563eb" opacity="0.3" />
                  <rect x="80" y="34" width="50" height="6" rx="3" fill="#bfdbfe" opacity="0.5" />
                  {/* Calendar rows */}
                  <g className="cal-row">
                    <rect x="40" y="58" width="30" height="10" rx="5" fill="#dbeafe" />
                    <text x="55" y="65" textAnchor="middle" fontSize="6" fontWeight="600" fill="#2563eb">9:00</text>
                    <rect x="75" y="58" width="60" height="10" rx="5" fill="#eff6ff" />
                    <text x="105" y="65" textAnchor="middle" fontSize="6" fill="#93c5fd">Interview - Kim</text>
                  </g>
                  <g className="cal-row cal-row-d1">
                    <rect x="40" y="73" width="30" height="10" rx="5" fill="#dbeafe" />
                    <text x="55" y="80" textAnchor="middle" fontSize="6" fontWeight="600" fill="#2563eb">11:00</text>
                    <rect x="75" y="73" width="60" height="10" rx="5" fill="#f0fdf4" />
                    <text x="105" y="80" textAnchor="middle" fontSize="6" fill="#86efac">Offer - Tran</text>
                  </g>
                  <g className="cal-row cal-row-d2">
                    <rect x="40" y="88" width="30" height="10" rx="5" fill="#dbeafe" />
                    <text x="55" y="95" textAnchor="middle" fontSize="6" fontWeight="600" fill="#2563eb">14:00</text>
                    <rect x="75" y="88" width="60" height="10" rx="5" fill="#fff7ed" />
                    <text x="105" y="95" textAnchor="middle" fontSize="6" fill="#fdba74">Meeting - Le</text>
                  </g>
                  {/* Animated checkmark */}
                  <circle cx="142" cy="55" r="10" fill="#22c55e" opacity="0.9" />
                  <path className="cal-check" d="M137 55l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="hrh-val-text">
                <div className="hrh-val-num">03</div>
                <h3>{t('hr.home.val3Title')}</h3>
                <p>{t('hr.home.val3Desc')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <HowSteps t={t} />

        {/* Position breakdown */}
        <PositionChart t={t} liveTotal={liveTotal} />

        {/* Bottom CTA */}
        <section className="hrh-bottom-cta">
          <h2>{t('hr.home.bottomTitle')}</h2>
          <p>{t('hr.home.bottomDesc')}</p>
          <Link href={user ? '/hr' : '/hr/login'} className="hrh-cta">{user ? t('hr.home.dashboard') : t('hr.home.cta')}</Link>
        </section>

        {/* Footer */}
        <footer className="hrh-footer">
          <span>&copy; 2025 FYI Salary &middot; Powered by <a href="https://likelion.net" target="_blank" rel="noopener noreferrer">LIKELION</a></span>
          <span><a href="/">Seeker</a> &middot; <a href="/hr/home">HR</a> &middot; <a href="/hr/login">{t('hr.home.loginBtn')}</a></span>
        </footer>
      </div>
    </>
  )
}
