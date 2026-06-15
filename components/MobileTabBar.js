import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'

const baseTabs = [
  { key: 'home', href: '/', label: 'Home', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  )},
  { key: 'jobs', href: '/jobs', label: 'Jobs', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
  )},
  { key: 'applications', href: '/my-applications', label: 'Applied', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  )},
]

const communityTab = { key: 'community', href: '/community', label: 'Community', icon: (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
)}

const adminTab = { key: 'admin', href: '/admin/jobs', label: 'Admin', icon: (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
)}

export default function MobileTabBar() {
  const router = useRouter()
  const { t } = useT()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasResume, setHasResume] = useState(true)
  const [commActivity, setCommActivity] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session)
      if (session) {
        const cached = sessionStorage.getItem('fyi_is_admin')
        if (cached !== null) {
          setIsAdmin(cached === 'true')
        } else {
          try {
            const r = await fetch(`/api/admin/check?email=${encodeURIComponent(session.user.email)}`)
            const d = await r.json()
            setIsAdmin(d.isAdmin)
            sessionStorage.setItem('fyi_is_admin', String(d.isAdmin))
          } catch {}
        }
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

  useEffect(() => {
    fetch('/api/community/activity')
      .then(r => r.json())
      .then(d => setCommActivity(d.count || 0))
      .catch(() => {})
  }, [])

  const getActiveKey = () => {
    const path = router.pathname
    if (path === '/') return 'home'
    if (path === '/jobs') return 'jobs'
    if (path === '/community') return 'community'
    if (path === '/my-applications' || path === '/saved-jobs') return 'applications'
    if (path.startsWith('/admin')) return 'admin'
    return ''
  }

  const active = getActiveKey()
  const tabs = isAdmin ? [...baseTabs, communityTab, adminTab] : [...baseTabs, communityTab]
  const handleTabClick = (e, tab) => {
    if (tab.key === 'community') {
      track('click_community_tab', { meta: { source: 'mobile' }, page: router.pathname })
    }
    if (tab.key === 'applications' && !isLoggedIn) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('fyi-show-login'))
    }
  }

  return (
    <>
      <style>{`
        .mtab { display: none; }
        .mtab-bubble { display: none; }
        @media (max-width: 768px) {
          .mtab { display: flex !important; position: fixed !important; top: auto !important; bottom: 0 !important; left: 0 !important; right: 0 !important; z-index: 99999; height: 60px; background: rgba(12,12,11,0.97); backdrop-filter: blur(14px); border-top: 1px solid rgba(255,255,255,0.08); align-items: center; justify-content: space-around; padding: 0; margin: 0; padding-bottom: env(safe-area-inset-bottom); font-family: 'Barlow', sans-serif; }
          .mtab-item { display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; padding: 6px 0; flex: 1; position: relative; }
          .mtab-item svg { color: rgba(255,255,255,0.35); }
          .mtab-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.35); }
          .mtab-item.on svg { color: #ff6000; }
          .mtab-item.on .mtab-label { color: #ff6000; }
          .mtab-item.admin-tab svg { color: rgba(255,96,0,0.5); }
          .mtab-item.admin-tab .mtab-label { color: rgba(255,96,0,0.5); font-size: 9px; }
          .mtab-item.admin-tab.on svg { color: #ff6000; }
          .mtab-item.admin-tab.on .mtab-label { color: #ff6000; }
          .mtab-badge { position: absolute; top: 2px; left: 50%; margin-left: 6px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #ff6000; color: #fff; font-size: 9px; font-weight: 800; line-height: 16px; text-align: center; box-sizing: border-box; }
          @keyframes mtabBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        }
      `}</style>

      <nav className="mtab">
        {tabs.map(tab => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`mtab-item${active === tab.key ? ' on' : ''}${tab.key === 'admin' ? ' admin-tab' : ''}`}
            onClick={(e) => handleTabClick(e, tab)}
          >
            {tab.icon}
            {tab.key === 'community' && commActivity > 0 && active !== 'community' && (
              <span className="mtab-badge">{commActivity > 99 ? '99+' : commActivity}</span>
            )}
            <span className="mtab-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
