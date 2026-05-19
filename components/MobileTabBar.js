import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'

const tabs = [
  { key: 'home', href: '/', label: 'Home', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  )},
  { key: 'jobs', href: '/jobs', label: 'Jobs', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
  )},
  { key: 'applications', href: '/my-applications', label: 'Applied', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  )},
  { key: 'profile', href: '/profile', label: 'Profile', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  )},
]

export default function MobileTabBar() {
  const router = useRouter()
  const { t } = useT()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasResume, setHasResume] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session)
      if (session) {
        try {
          const res = await fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${session.access_token}` } })
          if (res.ok) {
            const { profile } = await res.json()
            if (profile) setHasResume(!!profile.resume_url)
          }
        } catch {}
      }
    })
  }, [])

  const getActiveKey = () => {
    const path = router.pathname
    if (path === '/') return 'home'
    if (path === '/jobs') return 'jobs'
    if (path === '/my-applications' || path === '/saved-jobs') return 'applications'
    if (path === '/profile') return 'profile'
    return ''
  }

  const active = getActiveKey()
  const showBubble = (!isLoggedIn || !hasResume) && active !== 'profile'

  const handleTabClick = async (e, tab) => {
    if ((tab.key === 'profile' || tab.key === 'applications') && !isLoggedIn) {
      e.preventDefault()
      localStorage.setItem('fyi_login_return', tab.href)
      if (window.location.hostname === 'localhost') {
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
      } else {
        window.location.href = '/api/auth/google?return=' + encodeURIComponent(tab.href)
      }
    }
  }

  return (
    <>
      <style>{`
        .mtab { display: none; }
        .mtab-bubble { display: none; }
        @media (max-width: 768px) {
          .mtab { display: flex !important; position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; z-index: 99999; height: 60px; background: rgba(12,12,11,0.97); backdrop-filter: blur(14px); border-top: 1px solid rgba(255,255,255,0.08); align-items: center; justify-content: space-around; padding: 0; margin: 0; padding-bottom: env(safe-area-inset-bottom); font-family: 'Barlow', sans-serif; }
          .mtab-item { display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; padding: 6px 0; flex: 1; position: relative; }
          .mtab-item svg { color: rgba(255,255,255,0.35); }
          .mtab-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.35); }
          .mtab-item.on svg { color: #ff6000; }
          .mtab-item.on .mtab-label { color: #ff6000; }
          .mtab-bubble { display: block; position: fixed; bottom: 68px; right: 8px; z-index: 99998; background: #ff6000; color: #fff; font-size: 11px; font-weight: 700; padding: 8px 14px; border-radius: 10px; box-shadow: 0 2px 12px rgba(255,96,0,0.4); animation: mtabBounce 3s ease-in-out infinite; line-height: 1.4; max-width: 180px; text-align: center; }
          .mtab-bubble::after { content: ''; position: absolute; bottom: -5px; right: 24px; width: 10px; height: 10px; background: #ff6000; transform: rotate(45deg); border-radius: 1px; }
          @keyframes mtabBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        }
      `}</style>

      {showBubble && (
        <div className="mtab-bubble" onClick={async () => {
          if (!isLoggedIn) {
            localStorage.setItem('fyi_login_return', '/profile')
            if (window.location.hostname === 'localhost') {
              await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })
            } else {
              window.location.href = '/api/auth/google?return=' + encodeURIComponent('/profile')
            }
          } else {
            router.push('/profile')
          }
        }}>
          {t('mtab.resumeCta')}
        </div>
      )}

      <nav className="mtab">
        {tabs.map(tab => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`mtab-item${active === tab.key ? ' on' : ''}`}
            onClick={(e) => handleTabClick(e, tab)}
          >
            {tab.icon}
            <span className="mtab-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
