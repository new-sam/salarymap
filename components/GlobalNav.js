import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function GlobalNav({ activePage }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true)
        setUser(session.user)
        try {
          const r = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
          const d = await r.json()
          setIsAdmin(d.isAdmin)
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
        .gnav-jobs-cta { display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(135deg, rgba(255,170,40,0.15), rgba(255,96,0,0.15)); border: 1px solid rgba(255,150,30,0.3); padding: 6px 14px !important; border-radius: 100px; color: #ffb347 !important; font-weight: 600; transition: all .25s; animation: jobsBounce 1.5s ease-in-out infinite; }
        .gnav-jobs-cta:hover { background: linear-gradient(135deg, rgba(255,170,40,0.25), rgba(255,96,0,0.25)); color: #ffc56e !important; border-color: rgba(255,150,30,0.5); }
        .gnav-jobs-cta.on { color: #ffb347 !important; }
        .gnav-jobs-cta.on::after { display: none; }
        @keyframes jobsBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
        .gnav-jobs-badge { font-size: 11px; font-weight: 800; color: #111; background: linear-gradient(135deg, #ffb347, #ff6000); width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
        .gnav-jobs-sub { font-size: 8px; color: rgba(255,179,71,0.5); position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); white-space: nowrap; letter-spacing: 0.05em; font-weight: 500; }
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
        @media (max-width: 768px) {
          .gnav { padding: 0 12px; height: 48px; }
          .gnav-logo { font-size: 11px; gap: 6px; }
          .gnav-logo img { width: 22px; height: 22px; }
          .gnav-r { gap: 8px; }
          .gnav-link { display: none; }
          .gnav-submit { font-size: 10px; padding: 6px 10px; }
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
          <Link href="/" className={`gnav-link${activePage === 'home' ? ' on' : ''}`}>Am I underpaid?</Link>
          <Link href="/jobs" className={`gnav-link gnav-jobs-cta${activePage === 'jobs' ? ' on' : ''}`}>
            💰 Jobs <span className="gnav-jobs-badge">↑</span>
            <span className="gnav-jobs-sub">Earn more</span>
          </Link>

          {!ready ? null : !isLoggedIn ? (
            <>
              <button className="gnav-login" onClick={() => {
                if (typeof window !== 'undefined') localStorage.setItem('fyi_login_return', window.location.pathname)
                supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
              }}>
                Log in
              </button>
              <Link href="/#submit" className="gnav-submit">Submit Salary</Link>
            </>
          ) : (
            <div className="gnav-user" onClick={() => setShowMenu(v => !v)}>
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
                  <a href="/profile" className="gnav-menu-item">My Profile</a>
                  {isAdmin && (
                    <a href="/admin/jobs" className="gnav-menu-item gnav-menu-admin">Admin Dashboard</a>
                  )}
                  <button className="gnav-menu-item" onClick={async () => {
                    await supabase.auth.signOut()
                    setIsLoggedIn(false); setUser(null); setShowMenu(false)
                    window.location.reload()
                  }}>Sign out</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
