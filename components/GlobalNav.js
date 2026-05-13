import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'

export default function GlobalNav({ activePage }) {
  const { t } = useT()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [isHR, setIsHR] = useState(false)
  const [viewMode, setViewMode] = useState('seeker')
  const [profileScore, setProfileScore] = useState(null) // 'seeker' | 'hr'
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true)
        setUser(session.user)
        const cached = sessionStorage.getItem('fyi_is_admin')
        if (cached !== null) {
          setIsAdmin(cached === 'true')
          if (cached === 'true') {
            const savedMode = sessionStorage.getItem('fyi_view_mode')
            if (savedMode === 'hr') setViewMode('hr')
          }
        } else {
          try {
            const r = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
            const d = await r.json()
            setIsAdmin(d.isAdmin)
            sessionStorage.setItem('fyi_is_admin', String(d.isAdmin))
            if (d.isAdmin) {
              const savedMode = sessionStorage.getItem('fyi_view_mode')
              if (savedMode === 'hr') setViewMode('hr')
            }
          } catch {}
        }
        try {
          const bRes = await fetch(`/api/job-bookmarks?userId=${session.user.id}`)
          const bData = await bRes.json()
          if (bData.bookmarks) setSavedCount(bData.bookmarks.length)
        } catch {}
        try {
          const hrRes = await fetch(`/api/hr/status?userId=${session.user.id}`)
          const hrData = await hrRes.json()
          if (hrData.isHR && hrData.status === 'approved') setIsHR(true)
        } catch {}
        try {
          const pRes = await fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${session.access_token}` } })
          if (pRes.ok) {
            const { profile: p } = await pRes.json()
            if (p) {
              const checks = [p.photo_url, p.full_name, p.headline, p.position, p.yoe_months != null, p.intro, p.skills?.length > 0, p.english_cert, p.location, p.university, p.resume_url, p.job_signal && p.job_signal !== 'passive', p.experiences?.length > 0, p.salary_min]
              setProfileScore(Math.round(checks.filter(Boolean).length / checks.length * 100))
            }
          }
        } catch {}
      }
      setReady(true)
    })
  }, [])

  return (
    <>
      <style>{`
        .gnav { position: sticky; top: 0; z-index: 200; height: 56px; background: rgba(12,12,11,0.95); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; padding: 0 52px; font-family: 'Barlow', sans-serif; }
        .gnav-l { display: flex; align-items: center; gap: 10px; }
        .gnav-logo { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #f2f0eb; text-decoration: none; cursor: pointer; }
        .gnav-logo img { width: 28px; height: 28px; object-fit: contain; }
        .gnav-r { display: flex; align-items: center; gap: 24px; }
        .gnav-link { font-size: 13px; color: rgba(242,240,235,0.42); text-decoration: none; background: none; border: none; cursor: pointer; font-family: 'Barlow', sans-serif; padding: 0; transition: color .2s; position: relative; }
        .gnav-link:hover { color: #f0ece4; }
        .gnav-link.on { color: #f0ece4; }
        .gnav-link.on::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background: #ff6000; }
        .gnav-jobs-cta { display: inline-flex; align-items: center; gap: 6px; background: #ff6000; border: none; padding: 7px 16px !important; border-radius: 100px; color: #fff !important; font-weight: 700; transition: all .25s; position: relative; }
        .gnav-jobs-shimmer { position: absolute; inset: 0; border-radius: 100px; overflow: hidden; pointer-events: none; }
        .gnav-jobs-shimmer::before { content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent); animation: jobsShimmer 2.5s ease-in-out infinite; }
        .gnav-jobs-cta:hover { background: #ff7a1a; box-shadow: 0 0 20px rgba(255,96,0,0.4); transform: translateY(-1px); }
        .gnav-jobs-cta.on { color: #fff !important; }
        .gnav-jobs-cta.on::after { display: none; }
        @keyframes jobsShimmer { 0% { left: -100%; } 50% { left: 120%; } 100% { left: 120%; } }
        .gnav-jobs-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
        .gnav-jobs-icon svg { width: 14px; height: 14px; }
        .gnav-jobs-bubble { position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); background: #fff; padding: 5px 12px; border-radius: 8px; white-space: nowrap; font-size: 11px; font-weight: 700; color: #ff6000; pointer-events: none; animation: bubbleFloat 3s ease-in-out infinite; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
        .gnav-jobs-bubble::before { content: ''; position: absolute; top: -4px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 8px; height: 8px; background: #fff; }
        @keyframes bubbleFloat { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-3px); } }
        .gnav-login { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); background: none; border: 1px solid rgba(255,255,255,0.15); padding: 7px 16px; border-radius: 100px; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .gnav-submit { font-size: 12px; font-weight: 600; background: #ff6000; color: #fff; border: none; padding: 8px 18px; border-radius: 2px; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .gnav-user { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.12); cursor: pointer; position: relative; flex-shrink: 0; }
        .gnav-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .gnav-avatar-ini { width: 24px; height: 24px; border-radius: 50%; background: #ff6000; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: black; }
        .gnav-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
        .gnav-caret { font-size: 10px; color: rgba(255,255,255,0.3); }
        .gnav-menu { position: absolute; top: calc(100% + 8px); right: 0; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 6px; min-width: 160px; z-index: 500; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .gnav-menu-email { padding: 10px 14px; font-size: 12px; color: rgba(255,255,255,0.35); border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px; }
        .gnav-menu-item { display: block; width: 100%; padding: 10px 14px; border-radius: 8px; border: none; background: none; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; text-align: left; text-decoration: none; font-family: 'Barlow', sans-serif; transition: background .1s; }
        .gnav-menu-item:hover { background: rgba(255,255,255,0.06); }
        .gnav-menu-admin { color: #ff6000; }
        .gnav-saved-link { display: flex; align-items: center; justify-content: space-between; }
        .gnav-saved-badge { font-size: 10px; font-weight: 700; color: #fff; background: #ff4400; min-width: 18px; height: 18px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; }
        .gnav-toggle { display: flex; align-items: center; gap: 0; background: rgba(255,255,255,0.06); border-radius: 100px; padding: 2px; border: 1px solid rgba(255,255,255,0.08); }
        .gnav-toggle-opt { font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 100px; cursor: pointer; border: none; background: none; color: rgba(255,255,255,0.3); font-family: 'Barlow', sans-serif; transition: all .2s; white-space: nowrap; }
        .gnav-toggle-opt.active { background: rgba(255,96,0,0.2); color: #ff6000; }
        .gnav-toggle-opt:hover:not(.active) { color: rgba(255,255,255,0.5); }
        @media (max-width: 768px) {
          .gnav { padding: 0 12px; height: 48px; }
          .gnav-logo { font-size: 11px; gap: 6px; }
          .gnav-logo img { width: 22px; height: 22px; }
          .gnav-r { gap: 8px; }
          .gnav-link { display: none; }
          .gnav-toggle-opt { font-size: 9px; padding: 3px 8px; }
          .gnav-jobs-cta { display: inline-flex !important; font-size: 10px; padding: 4px 10px !important; gap: 4px; white-space: nowrap; }
          .gnav-jobs-icon svg { width: 12px; height: 12px; }
          .gnav-jobs-bubble { display: none; }
          .gnav-login { font-size: 10px; padding: 4px 10px; white-space: nowrap; }
          .gnav-submit { font-size: 9px; padding: 5px 8px; white-space: nowrap; }
        }
        @media (max-width: 400px) {
          .gnav-name { display: none; }
        }
      `}</style>

      <nav className="gnav">
        <div className="gnav-l">
          <Link href="/" className="gnav-logo">
            <img src="/logo.png" alt="FYI" />
            <span>FOR YOUR <span style={{ color: '#ff6000' }}>'SALARY'</span> INFORMATION</span>
          </Link>
        </div>
        <div className="gnav-r">
          <div className="gnav-toggle">
            <button className={`gnav-toggle-opt${viewMode === 'seeker' ? ' active' : ''}`} onClick={() => {
              setViewMode('seeker')
              sessionStorage.setItem('fyi_view_mode', 'seeker')
              if (window.location.pathname.startsWith('/hr')) window.location.href = '/'
            }}>Seeker</button>
            <button className={`gnav-toggle-opt${viewMode === 'hr' ? ' active' : ''}`} onClick={() => {
              setViewMode('hr')
              sessionStorage.setItem('fyi_view_mode', 'hr')
              if (!window.location.pathname.startsWith('/hr')) window.location.href = '/hr/home'
            }}>HR</button>
          </div>

          {viewMode === 'seeker' ? (<>
            <Link href="/" className={`gnav-link${activePage === 'home' ? ' on' : ''}`}>{t('nav.amIUnderpaid')}</Link>
            <Link href="/jobs" className={`gnav-link gnav-jobs-cta${activePage === 'jobs' ? ' on' : ''}`}>
              <span className="gnav-jobs-shimmer"></span>
              <span className="gnav-jobs-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2"/><path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
              {t('nav.jobs')}
              <span className="gnav-jobs-bubble">{t('nav.jobsSub')}</span>
            </Link>
          </>) : (<>
            <Link href="/hr" className={`gnav-link${activePage === 'hr' ? ' on' : ''}`}>Candidates</Link>
          </>)}

          {!ready ? null : !isLoggedIn ? (
            <>
              <button className="gnav-login" onClick={async () => {
                if (typeof window === 'undefined') return;
                localStorage.setItem('fyi_login_return', window.location.pathname);
                if (window.location.hostname === 'localhost') {
                  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } });
                } else {
                  window.location.href = '/api/auth/google?return=' + encodeURIComponent(window.location.pathname);
                }
              }}>
                {t('nav.login')}
              </button>
              <Link href="/#submit" className="gnav-submit">{t('nav.submitSalary')}</Link>
            </>
          ) : (
            <div className="gnav-user" ref={menuRef} onClick={() => setShowMenu(v => !v)}>
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="gnav-avatar" alt="" />
              ) : (
                <div className="gnav-avatar-ini">
                  {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="gnav-name">
                {(user?.user_metadata?.full_name || user?.user_metadata?.name)?.split(' ')[0] || user?.email?.split('@')[0] || 'Account'}
              </span>
              <span className="gnav-caret">▾</span>

              {showMenu && (
                <div className="gnav-menu" onClick={e => e.stopPropagation()}>
                  <div className="gnav-menu-email">{user?.email}</div>
                  {viewMode === 'seeker' ? (<>
                    <a href="/profile" className="gnav-menu-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{t('nav.myProfile')}</span>
                      {profileScore != null && profileScore < 100 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: profileScore >= 80 ? '#4ade80' : '#fbbf24', background: profileScore >= 80 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 100 }}>{profileScore}%</span>
                      )}
                    </a>
                    <a href="/my-applications" className="gnav-menu-item">{t('nav.myApplications')}</a>
                    <a href="/saved-jobs" className="gnav-menu-item gnav-saved-link">
                      <span>{t('nav.savedJobs')}</span>
                      {savedCount > 0 && <span className="gnav-saved-badge">{savedCount}</span>}
                    </a>
                  </>) : (<>
                    <a href="/hr" className="gnav-menu-item">Candidates</a>
                  </>)}
                  {(isHR && !isAdmin) && (
                    <a href="/hr" className="gnav-menu-item" style={{ color: '#ffb347' }}>HR Dashboard</a>
                  )}
                  {isAdmin && (
                    <a href="/admin/jobs" className="gnav-menu-item gnav-menu-admin">Admin Dashboard</a>
                  )}
                  <button className="gnav-menu-item" onClick={async () => {
                    await supabase.auth.signOut()
                    setIsLoggedIn(false); setUser(null); setShowMenu(false)
                    window.location.reload()
                  }}>{t('nav.logout')}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
