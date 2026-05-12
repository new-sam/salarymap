import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

const NAV_ITEMS = [
  { href: '/hr', icon: 'dashboard', label: '대시보드' },
  { href: '/hr/search', icon: 'search', label: '인재 검색' },
  { href: '/hr/saved', icon: 'bookmark', label: '스크랩한 인재' },
  { href: '/hr/hiring', icon: 'work', label: '채용 관리' },
  { href: '/hr/applicants', icon: 'people', label: '지원자 관리' },
]

function NavIcon({ type, size = 18 }) {
  const s = { width: size, height: size, display: 'block' }
  switch (type) {
    case 'dashboard':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    case 'search':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    case 'bookmark':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
    case 'work':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
    case 'people':
      return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    default:
      return null
  }
}

export default function HRLayout({ children, title = '대시보드', meta }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user)
      else router.replace('/hr/login')
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/hr/home')
  }

  const currentPath = router.pathname

  if (!user) return null

  return (
    <>
      <Head>
        <title>{title} - FYI for HR</title>
        {meta}
      </Head>
      <style>{`
        .hr-layout { display: flex; min-height: 100vh; background: #FAFAF8; font-family: 'Barlow', system-ui, sans-serif; }

        /* Sidebar */
        .hr-sidebar { width: 240px; background: #fff; border-right: 1px solid #f0f0f0; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 300; }
        .hr-sidebar-logo { display: flex; align-items: center; gap: 8px; padding: 20px 24px; font-size: 14px; font-weight: 700; color: #111; text-decoration: none; border-bottom: 1px solid #f0f0f0; }
        .hr-sidebar-logo img { width: 24px; height: 24px; }
        .hr-sidebar-logo span { color: #ff6000; }
        .hr-sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; }
        .hr-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #888; text-decoration: none; transition: all .15s; }
        .hr-nav-item:hover { background: #f5f5f5; color: #555; }
        .hr-nav-item.active { background: #ff60000d; color: #ff6000; font-weight: 600; }
        .hr-sidebar-bottom { padding: 16px; border-top: 1px solid #f0f0f0; }
        .hr-user-info { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .hr-user-avatar { width: 32px; height: 32px; border-radius: 50%; background: #ff6000; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0; }
        .hr-user-name { font-size: 12px; font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hr-user-email { font-size: 10px; color: #bbb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hr-logout-btn { width: 100%; font-size: 12px; font-weight: 500; color: #999; background: none; border: 1px solid #eee; padding: 8px; border-radius: 6px; cursor: pointer; font-family: inherit; transition: all .15s; }
        .hr-logout-btn:hover { border-color: #ddd; color: #666; }

        /* Main area */
        .hr-main { flex: 1; margin-left: 240px; min-width: 0; }
        .hr-topbar { display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 32px; background: #fff; border-bottom: 1px solid #f0f0f0; position: sticky; top: 0; z-index: 200; }
        .hr-topbar-title { font-size: 16px; font-weight: 700; color: #111; }
        .hr-topbar-right { display: flex; align-items: center; gap: 12px; }
        .hr-content { padding: 24px 32px; }

        /* Mobile hamburger */
        .hr-hamburger { display: none; background: none; border: none; padding: 4px; cursor: pointer; color: #333; }
        .hr-overlay { display: none; }

        @media (max-width: 768px) {
          .hr-sidebar { transform: translateX(-100%); transition: transform .25s ease; }
          .hr-sidebar.open { transform: translateX(0); }
          .hr-main { margin-left: 0; }
          .hr-hamburger { display: block; }
          .hr-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 250; }
          .hr-overlay.open { display: block; }
          .hr-content { padding: 20px 16px; }
          .hr-topbar { padding: 0 16px; }
        }
      `}</style>

      <div className="hr-layout">
        {/* Mobile overlay */}
        <div className={`hr-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        <aside className={`hr-sidebar${sidebarOpen ? ' open' : ''}`}>
          <Link href="/hr/home" className="hr-sidebar-logo">
            <img src="/logo.png" alt="" />
            FYI <span>for HR</span>
          </Link>
          <nav className="hr-sidebar-nav">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`hr-nav-item${currentPath === item.href ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <NavIcon type={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hr-sidebar-bottom">
            <div className="hr-user-info">
              <div className="hr-user-avatar">
                {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="hr-user-name">{user.user_metadata?.full_name || 'HR User'}</div>
                <div className="hr-user-email">{user.email}</div>
              </div>
            </div>
            <button className="hr-logout-btn" onClick={handleLogout}>로그아웃</button>
          </div>
        </aside>

        {/* Main */}
        <div className="hr-main">
          <header className="hr-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="hr-hamburger" onClick={() => setSidebarOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <span className="hr-topbar-title">{title}</span>
            </div>
            <div className="hr-topbar-right">
              <Link href="/hr/home" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>서비스 소개</Link>
            </div>
          </header>
          <div className="hr-content">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
