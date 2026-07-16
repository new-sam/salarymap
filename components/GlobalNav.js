import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'
import { completionScore } from '../lib/profileScore'

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
]

export default function GlobalNav({ activePage, onLogin, onJobsClick, mobileSearch }) {
  const { t, lang, setLang } = useT()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(true)
  const [savedCount, setSavedCount] = useState(0)
  const [profileScore, setProfileScore] = useState(null)
  const [hasResume, setHasResume] = useState(true)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [showLang, setShowLang] = useState(false)
  const menuRef = useRef(null)
  const langRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!showLang) return
    const h = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setShowLang(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showLang])

  useEffect(() => {
    const onProfileUpdate = (e) => {
      const p = e.detail
      setProfileScore(completionScore(p))
      setPhotoUrl(p.photo_url || null)
    }
    window.addEventListener('profile-updated', onProfileUpdate)
    return () => window.removeEventListener('profile-updated', onProfileUpdate)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true)
        setUser(session.user)
        // Cache the admin check per-email so it can't carry over to a
        // different user who logs in later in the same tab (sessionStorage
        // persists across the OAuth redirect and isn't cleared on logout).
        const adminKey = `fyi_is_admin:${session.user.email}`
        const cached = sessionStorage.getItem(adminKey)
        if (cached !== null) {
          setIsAdmin(cached === 'true')
        } else {
          try {
            const r = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
            const d = await r.json()
            setIsAdmin(d.isAdmin)
            sessionStorage.setItem(adminKey, String(d.isAdmin))
          } catch {}
        }
        try {
          const bRes = await fetch('/api/job-bookmarks', { headers: { Authorization: `Bearer ${session.access_token}` } })
          const bData = await bRes.json()
          if (bData.bookmarks) setSavedCount(bData.bookmarks.length)
        } catch {}
        try {
          const pRes = await fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${session.access_token}` } })
          if (pRes.ok) {
            const { profile: p } = await pRes.json()
            if (p) {
              setProfileScore(completionScore(p))
              setHasResume(!!p.resume_url)
              setPhotoUrl(p.photo_url || null)
            }
          }
        } catch {}
      }
      setIsSubmitted(localStorage.getItem('fyi_submitted') === 'true')
      setReady(true)
    })
  }, [])

  return (
    <>
      <style>{`
        .gnav { position: sticky; top: 0; z-index: 200; height: 56px; background: #0c0c0b; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; padding: 0 52px; font-family: 'Barlow', sans-serif; }
        .gnav-l { display: flex; align-items: center; gap: 36px; }
        .gnav-l-menu { display: flex; align-items: center; gap: 22px; }
        @media (max-width: 768px) { .gnav-l-menu { display: none; } }
        .gnav-logo { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 400; color: #f2f0eb; text-decoration: none; cursor: pointer; }
        .gnav-logo img { width: 28px; height: 28px; object-fit: contain; }
        .gnav-logo em { color: #ff6000; font-style: normal; }
        .gnav-r { display: flex; align-items: center; gap: 24px; }
        .gnav-link { font-size: 14px; color: rgba(242,240,235,0.42); text-decoration: none; background: none; border: none; cursor: pointer; font-family: 'Barlow', sans-serif; padding: 0; transition: color .2s; position: relative; }
        .gnav-link:hover { color: #f0ece4; }
        .gnav-link.on { color: #f0ece4; }
        .gnav-link-accent { color: #ff6000 !important; font-weight: 400; }
        .gnav-link-accent:hover { color: #ff8a40 !important; }
        .gnav-link-light { color: #f2f0eb !important; font-weight: 400; }
        .gnav-link-light:hover { color: #f2f0eb !important; opacity: 0.85; }
        /* Welcome-bonus pill CTA — same shimmer as the old jobs CTA */
        .gnav-welcome-cta { position: relative; display: inline-flex; align-items: center; background: #ff6000; padding: 7px 16px !important; border-radius: 100px; color: #fff !important; font-size: 14px; font-weight: 400; transition: background .15s; }
        .gnav-welcome-cta:hover { background: #ff7218; }
        .gnav-welcome-cta.on::after { display: none; }
        /* Floating bubble under the pill */
        .gnav-welcome-bubble {
          position: absolute;
          z-index: 250;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: #fff;
          background: #ff6000;
          padding: 4px 10px;
          border-radius: 100px;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(255,96,0,0.5);
          pointer-events: none;
          animation: gnav-bubbleFloat 2.4s ease-in-out infinite;
        }
        .gnav-welcome-bubble::before {
          content: '';
          position: absolute;
          top: -3px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          width: 6px; height: 6px;
          background: #ff6000;
        }
        @keyframes gnav-bubbleFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
        .gnav-link.on::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 2px; background: #ff6000; }
        /* Buttons (jobs CTA pill, login pill) — never show the active underline */
        .gnav-jobs-cta.on::after { display: none; }
        .gnav-login.on::after { display: none; }
        .gnav-jobs-cta { display: inline-flex; align-items: center; gap: 6px; background: #ff6000; border: none; padding: 7px 16px !important; border-radius: 100px; color: #fff !important; font-weight: 400; font-size: 14px; transition: all .25s; position: relative; }
        .gnav-jobs-shimmer { position: absolute; inset: 0; border-radius: 100px; overflow: hidden; pointer-events: none; }
        .gnav-jobs-shimmer::before { content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent); animation: jobsShimmer 2.5s ease-in-out infinite; }
        .gnav-jobs-cta:hover { background: #ff7a1a; box-shadow: 0 0 20px rgba(255,96,0,0.4); transform: translateY(-1px); }
        .gnav-jobs-cta.on { color: #fff !important; }
        .gnav-jobs-cta.on::after { display: none; }
        @keyframes jobsShimmer { 0% { left: -100%; } 50% { left: 120%; } 100% { left: 120%; } }
        .gnav-jobs-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
        .gnav-jobs-icon svg { width: 14px; height: 14px; }

        .gnav-login { font-size: 14px; font-weight: 400; color: #f2f0eb; background: none; border: 1px solid #f2f0eb; padding: 7px 16px; border-radius: 100px; cursor: pointer; font-family: 'Barlow', sans-serif; transition: background .15s, color .15s; }
        .gnav-login:hover { background: #f2f0eb; color: #0c0c0b; }

        .gnav-lang { position: relative; flex-shrink: 0; }
        .gnav-lang-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; background: none; border: 1px solid #f2f0eb; border-radius: 8px; color: #f2f0eb; cursor: pointer; font-family: 'Barlow', sans-serif; transition: background .15s, color .15s; }
        .gnav-lang-btn:hover { background: #f2f0eb; color: #0c0c0b; }
        .gnav-lang-code { font-size: 11px; font-weight: 400; letter-spacing: 1px; }
        .gnav-lang-menu { position: absolute; top: calc(100% + 6px); right: 0; min-width: 160px; background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 4px; box-shadow: 0 12px 32px rgba(0,0,0,0.45); z-index: 600; }
        .gnav-lang-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 12px; background: none; border: none; border-radius: 6px; cursor: pointer; font-family: 'Barlow', sans-serif; font-size: 13px; color: rgba(242,240,235,0.7); text-align: left; transition: background .12s, color .12s; }
        .gnav-lang-item:hover { background: rgba(242,240,235,0.06); color: #f2f0eb; }
        .gnav-lang-item.on { background: rgba(255,96,0,0.14); color: #ff8a40; font-weight: 400; }
        .gnav-submit { font-size: 12px; font-weight: 600; background: #ff6000; color: #fff; border: none; padding: 8px 18px; border-radius: 2px; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .gnav-user { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.12); cursor: pointer; flex-shrink: 0; }
        .gnav-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .gnav-avatar-ini { width: 24px; height: 24px; border-radius: 50%; background: #ff6000; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: black; }
        .gnav-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }
        .gnav-score { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 100px; line-height: 1; }
        .gnav-caret { font-size: 10px; color: rgba(255,255,255,0.3); }
        .gnav-ai-bubble { position: absolute; top: calc(100% + 10px); right: 0; background: #ff6000; padding: 6px 12px; border-radius: 8px; white-space: nowrap; font-size: 11px; font-weight: 700; color: #fff; cursor: pointer; animation: gnav-aiBounce 3s ease-in-out infinite; box-shadow: 0 2px 12px rgba(255,96,0,0.4); z-index: 201; }
        .gnav-ai-bubble::before { content: ''; position: absolute; top: -4px; right: 16px; width: 8px; height: 8px; background: #ff6000; transform: rotate(45deg); border-radius: 1px; }
        @keyframes gnav-aiBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
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
        .gnav-r-mobile { display: none; }
        @media (max-width: 768px) {
          .gnav { position: fixed; top: 0; left: 0; right: 0; padding: 0 16px; height: 52px; }
          .gnav-logo span { display: none; }
          .gnav-logo img { width: 32px; height: 32px; }
          .gnav-r { display: none; }
          .gnav-r-mobile { display: flex; align-items: center; gap: 10px; }
        }
        .gnav-mobile-login { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); background: none; border: 1px solid rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 100px; cursor: pointer; font-family: 'Barlow', sans-serif; }
        .gnav-mobile-search-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; background: none; cursor: pointer; padding: 0; }
        .gnav-mobile-search-btn svg { width: 16px; height: 16px; color: rgba(255,255,255,0.5); }
      `}</style>

      <nav className="gnav">
        <div className="gnav-l">
          <Link href="/" className="gnav-logo">
            <img src="/logo.png" alt="FYI" />
            <span dangerouslySetInnerHTML={{ __html: t('nav.brandTagline') }} />
          </Link>
          <div className="gnav-l-menu">
            <Link href="/" className={`gnav-link gnav-link-light${activePage === 'home' ? ' on' : ''}`}>{t('nav.salaryCompare')}</Link>
            <Link href="/cv" className={`gnav-link gnav-link-light${activePage === 'cv' ? ' on' : ''}`} onClick={() => track('click_welcome_bonus_nav', { meta: { source: 'web' }, page: activePage || null })}>
              {t('nav.welcomeBonus')}
              <span className="gnav-welcome-bubble">{t('nav.welcomeBonusBubble')}</span>
            </Link>
            <Link href="/jobs" className={`gnav-link gnav-link-light${activePage === 'jobs' ? ' on' : ''}`} onClick={() => onJobsClick?.()}>{t('nav.jobs')}</Link>
            <Link href="/community" className={`gnav-link gnav-link-light${activePage === 'community' ? ' on' : ''}`} onClick={() => track('click_community_nav', { meta: { source: 'web' }, page: activePage || null })}>{t('nav.community')}</Link>
          </div>
        </div>
        <div className="gnav-r-mobile">
          {mobileSearch && (
            <button className="gnav-mobile-search-btn" onClick={() => mobileSearch.onToggle()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </button>
          )}
          {!ready ? null : !isLoggedIn ? (
            <button className="gnav-mobile-login" onClick={async () => {
              if (onLogin) return onLogin();
              if (typeof window === 'undefined') return;
              localStorage.setItem('fyi_login_return', window.location.pathname + window.location.search);
              if (window.location.hostname === 'localhost') {
                await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } });
              } else {
                window.location.href = '/api/auth/google?return=' + encodeURIComponent(window.location.pathname + window.location.search);
              }
            }}>
              {t('nav.login')}
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* 프로필 진입은 하단 My Page 탭으로 이동. 홈에서는 AI 이력서 넛지만 유지 */}
              {!hasResume && activePage === 'home' && (
                <a href="/profile" className="gnav-ai-bubble" style={{ pointerEvents: 'auto', textDecoration: 'none', color: '#fff' }}>✨ {t('nav.aiResume')}</a>
              )}
            </div>
          )}
        </div>
        <div className="gnav-r">
          {!ready ? null : !isLoggedIn ? (
            <button className="gnav-login" onClick={async () => {
              if (onLogin) return onLogin();
              if (typeof window === 'undefined') return;
              localStorage.setItem('fyi_login_return', window.location.pathname + window.location.search);
              if (window.location.hostname === 'localhost') {
                await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } });
              } else {
                window.location.href = '/api/auth/google?return=' + encodeURIComponent(window.location.pathname + window.location.search);
              }
            }}>
              {t('nav.login')}
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
            <div className="gnav-user" ref={menuRef} onClick={() => setShowMenu(v => !v)}>
              {photoUrl ? (
                <img src={photoUrl} className="gnav-avatar" alt="" />
              ) : (
                <div className="gnav-avatar-ini">
                  {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="gnav-name">
                {(user?.user_metadata?.full_name || user?.user_metadata?.name)?.split(' ')[0] || user?.email?.split('@')[0] || 'Account'}
              </span>
              {profileScore != null && profileScore < 100 && (
                <span className="gnav-score" style={{ color: profileScore >= 60 ? '#4ade80' : '#fbbf24', background: profileScore >= 60 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)' }}>{profileScore}%</span>
              )}
              <span className="gnav-caret">▾</span>

              {showMenu && (
                <div className="gnav-menu" onClick={e => e.stopPropagation()}>
                  <div className="gnav-menu-email">{user?.email}</div>
                  <a href="/profile" className="gnav-menu-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{t('nav.myProfile')}</span>
                      {profileScore != null && profileScore < 100 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: profileScore >= 60 ? '#4ade80' : '#fbbf24', background: profileScore >= 60 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 100 }}>{profileScore}%</span>
                      )}
                    </a>
                    <a href="/my-applications" className="gnav-menu-item">{t('nav.myApplications')}</a>
                    <a href="/saved-jobs" className="gnav-menu-item gnav-saved-link">
                      <span>{t('nav.savedJobs')}</span>
                      {savedCount > 0 && <span className="gnav-saved-badge">{savedCount}</span>}
                    </a>
                  {isAdmin && (
                    <a href="/admin/dashboard" className="gnav-menu-item gnav-menu-admin">Admin Dashboard</a>
                  )}
                  <button className="gnav-menu-item" onClick={async () => {
                    await supabase.auth.signOut()
                    setIsLoggedIn(false); setUser(null); setIsAdmin(false); setShowMenu(false)
                    window.location.reload()
                  }}>{t('nav.logout')}</button>
                </div>
              )}
            </div>

            {!hasResume && !showMenu && activePage === 'home' && (
              <a href="/profile" className="gnav-ai-bubble" onClick={e => e.stopPropagation()} style={{ pointerEvents: 'auto', textDecoration: 'none', color: '#fff' }}>✨ {t('nav.aiResume')}</a>
            )}
          </div>
          )}

          <Link href="/for-companies" className={`gnav-link gnav-link-light${activePage === 'forCompanies' ? ' on' : ''}`} onClick={() => track('click_for_companies', { page: activePage || null })}>{t('nav.forCompanies')}</Link>
        </div>
      </nav>
    </>
  )
}
