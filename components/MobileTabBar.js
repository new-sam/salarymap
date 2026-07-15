import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'

/* Tab icons live at module scope (heavy JSX), labels are pulled from i18n
   inside the component so they react to the language switcher. */
const TAB_ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  cv: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="14" x2="13" y2="14"/>
      <line x1="8" y1="18" x2="11" y2="18"/>
      <path d="M16.5 15l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor" stroke="none"/>
    </svg>
  ),
  jobs: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
  ),
}

TAB_ICONS.community = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
)
TAB_ICONS.mypage = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)
TAB_ICONS.admin = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
)

export default function MobileTabBar() {
  const router = useRouter()
  const { t } = useT()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasResume, setHasResume] = useState(true)

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

  const getActiveKey = () => {
    const path = router.pathname
    if (path === '/') return 'home'
    if (path === '/cv') return 'cv'
    if (path === '/jobs') return 'jobs'
    if (path === '/community') return 'community'
    if (path === '/profile' || path === '/my-applications' || path === '/saved-jobs') return 'mypage'
    if (path.startsWith('/admin')) return 'admin'
    return ''
  }

  const active = getActiveKey()
  const tabs = [
    { key: 'home', href: '/', label: t('nav.tabs.home'), icon: TAB_ICONS.home },
    { key: 'cv', href: '/cv', label: t('nav.tabs.cv'), icon: TAB_ICONS.cv },
    { key: 'jobs', href: '/jobs', label: t('nav.tabs.jobs'), icon: TAB_ICONS.jobs },
    { key: 'community', href: '/community', label: t('nav.tabs.community'), icon: TAB_ICONS.community },
    { key: 'mypage', href: '/profile', label: t('nav.tabs.mypage'), icon: TAB_ICONS.mypage },
  ]
  if (isAdmin) tabs.push({ key: 'admin', href: '/admin/dashboard', label: t('nav.tabs.admin'), icon: TAB_ICONS.admin })
  const handleTabClick = (e, tab) => {
    if (tab.key === 'community') {
      track('click_community_tab', { meta: { source: 'mobile' }, page: router.pathname })
    }
    if (tab.key === 'cv') {
      track('click_welcome_bonus_tab', { meta: { source: 'mobile' }, page: router.pathname })
    }
    if (tab.key === 'mypage' && !isLoggedIn) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('fyi-show-login'))
    }
  }

  return (
    <>
      <style>{`
        .mtab-bubble { display: none; }
        @media (max-width: 768px) {
          /* 바 셸(.mtab) 스타일은 styles/globals.css가 단일 소유 — 여기는 아이템만. */
          .mtab-item { display: flex; flex-direction: column; align-items: center; gap: 2px; text-decoration: none; padding: 6px 0; flex: 1; position: relative; min-width: 0; }
          .mtab-item svg { color: var(--sm-text-mute); }
          .mtab-label { font-size: 10px; font-weight: 600; color: var(--sm-text-mute); line-height: 1.15; text-align: center; word-break: keep-all; max-width: 100%; padding: 0 2px; }
          .mtab-item.on svg { color: var(--sm-accent); }
          .mtab-item.on .mtab-label { color: var(--sm-accent); }
          .mtab-item.admin-tab svg { color: var(--sm-accent); opacity: .65; }
          .mtab-item.admin-tab .mtab-label { color: var(--sm-accent); opacity: .65; font-size: 9px; }
          .mtab-item.admin-tab.on svg { color: var(--sm-accent); opacity: 1; }
          .mtab-item.admin-tab.on .mtab-label { color: var(--sm-accent); opacity: 1; }
          /* /cv tab — floating orange bubble above the icon */
          .mtab-bubble {
            display: block;
            position: absolute;
            bottom: calc(100% - 2px);
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.2px;
            color: #fff;
            background: var(--sm-accent);
            padding: 3px 8px;
            border-radius: 100px;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(255,68,0,0.35);
            pointer-events: none;
            animation: mtab-bubbleFloat 2.4s ease-in-out infinite;
            z-index: 1;
          }
          .mtab-bubble::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
            width: 6px; height: 6px;
            background: var(--sm-accent);
          }
          @keyframes mtab-bubbleFloat {
            0%, 100% { transform: translateX(-50%) translateY(0); }
            50% { transform: translateX(-50%) translateY(-3px); }
          }
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
            {tab.key === 'cv' && (
              <span className="mtab-bubble">{t('nav.welcomeBonusBubble')}</span>
            )}
            {tab.icon}
            <span className="mtab-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
