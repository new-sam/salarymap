import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useT } from '../../lib/i18n'

// 관리자 영역 공유 셸 — 좌측 사이드바 네비게이션(App Store Connect 스타일).
// dashboard(14탭)와 jobs(7탭)의 모든 화면을 URL(?tab=)로 묶어 "페이지처럼" 전환한다.
// 각 페이지 내부 컨텐츠/디자인은 건드리지 않고, 상단 탭바만 이 사이드바로 대체.

const ROUTE_DEFAULT = { '/admin/dashboard': 'trend', '/admin/jobs': 'jobs' }

function buildNav(lang) {
  const L = (ko, en) => (lang === 'ko' ? ko : en)
  return [
    {
      label: L('성과 · 지표', 'Metrics'),
      items: [
        { label: L('추이', 'Trend'), pathname: '/admin/dashboard', tab: 'trend' },
        { label: L('퍼널', 'Funnel'), pathname: '/admin/dashboard', tab: 'funnel' },
      ],
    },
    {
      label: L('성과 · 유저', 'Users'),
      items: [
        { label: L('가입자', 'Signups'), pathname: '/admin/dashboard', tab: 'users' },
        { label: L('리텐션', 'Retention'), pathname: '/admin/dashboard', tab: 'retention' },
        { label: L('커뮤니티', 'Community'), pathname: '/admin/dashboard', tab: 'community' },
        { label: L('신고/피드백', 'Reports'), pathname: '/admin/dashboard', tab: 'reports' },
      ],
    },
    {
      label: L('성과 · 채용', 'Recruiting'),
      items: [
        { label: L('지원자', 'Applicants'), pathname: '/admin/dashboard', tab: 'applications' },
        { label: L('이력서', 'Resumes'), pathname: '/admin/dashboard', tab: 'resumes' },
        { label: L('인재풀', 'Talent'), pathname: '/admin/dashboard', tab: 'talent' },
        { label: L('연봉 인증', 'Verifications'), pathname: '/admin/dashboard', tab: 'verifications' },
      ],
    },
    {
      label: L('성과 · 앱', 'App'),
      items: [
        { label: L('앱 지표', 'App metrics'), pathname: '/admin/dashboard', tab: 'appMetrics' },
      ],
    },
    {
      label: L('공고 관리', 'Job ops'),
      items: [
        { label: L('공고', 'Jobs'), pathname: '/admin/jobs', tab: 'jobs' },
        { label: L('회사', 'Companies'), pathname: '/admin/jobs', tab: 'companies' },
        { label: 'Applications', pathname: '/admin/jobs', tab: 'applications' },
        { label: L('공고 지표', 'Job KPI'), pathname: '/admin/jobs', tab: 'kpi' },
        { label: L('로그', 'Log'), pathname: '/admin/jobs', tab: 'log' },
        { label: 'Crawl', pathname: '/admin/jobs', tab: 'crawl' },
        { label: 'Admins', pathname: '/admin/jobs', tab: 'admins' },
      ],
    },
  ]
}

export default function AdminLayout({ children }) {
  const router = useRouter()
  const { lang: globalLang } = useT()
  const lang = globalLang === 'ko' ? 'ko' : 'en'
  const [open, setOpen] = useState(false)

  // 라우트/탭 이동 시 모바일 드로워 닫기
  useEffect(() => { setOpen(false) }, [router.asPath])

  const nav = buildNav(lang)
  const curTab = router.query.tab || ROUTE_DEFAULT[router.pathname]
  const isActive = (it) => router.pathname === it.pathname && curTab === it.tab

  return (
    <div className={`al-shell${open ? ' open' : ''}`}>
      <style>{`
        .al-shell {
          display: flex; min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #fff; color: #1d1d1f;
        }
        .al-sidebar {
          width: 232px; flex-shrink: 0; background: #fbfbfd; border-right: 1px solid #e3e3e6;
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
          display: flex; flex-direction: column; padding: 18px 12px 24px;
        }
        .al-brand {
          display: flex; align-items: center; gap: 8px; padding: 4px 10px 16px;
          font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: #1d1d1f;
        }
        .al-brand-dot { width: 9px; height: 9px; border-radius: 50%; background: #0071e3; }
        .al-group { margin-bottom: 14px; }
        .al-group-label {
          font-size: 11px; font-weight: 700; color: #86868b; text-transform: uppercase;
          letter-spacing: 0.04em; padding: 6px 10px 4px;
        }
        .al-item {
          display: block; padding: 7px 10px; margin: 1px 0; border-radius: 7px;
          font-size: 13.5px; font-weight: 500; color: #1d1d1f; text-decoration: none;
          line-height: 1.3; transition: background 0.12s, color 0.12s; cursor: pointer;
        }
        .al-item:hover { background: #efeff2; }
        .al-item.active { background: #e8f0fe; color: #0066cc; font-weight: 600; }
        .al-main { flex: 1; min-width: 0; }
        .al-burger {
          display: none; position: fixed; top: 12px; left: 12px; z-index: 50;
          width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e3e3e6;
          background: #fff; cursor: pointer; align-items: center; justify-content: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .al-burger span { display: block; width: 18px; height: 2px; background: #1d1d1f; position: relative; }
        .al-burger span::before, .al-burger span::after { content: ''; position: absolute; left: 0; width: 18px; height: 2px; background: #1d1d1f; }
        .al-burger span::before { top: -6px; } .al-burger span::after { top: 6px; }
        .al-scrim { display: none; }
        @media (max-width: 900px) {
          .al-sidebar {
            position: fixed; top: 0; left: 0; z-index: 60; transform: translateX(-100%);
            transition: transform 0.22s ease; box-shadow: 2px 0 16px rgba(0,0,0,0.12);
          }
          .al-shell.open .al-sidebar { transform: translateX(0); }
          .al-burger { display: flex; }
          .al-shell.open .al-scrim {
            display: block; position: fixed; inset: 0; z-index: 55; background: rgba(0,0,0,0.35);
          }
          .al-main { width: 100%; padding-top: 52px; }
        }
      `}</style>

      <aside className="al-sidebar">
        <div className="al-brand"><span className="al-brand-dot" />FYI Admin</div>
        <nav>
          {nav.map((g) => (
            <div key={g.label} className="al-group">
              <div className="al-group-label">{g.label}</div>
              {g.items.map((it) => (
                <Link
                  key={it.pathname + it.tab}
                  href={{ pathname: it.pathname, query: { tab: it.tab } }}
                  className={`al-item${isActive(it) ? ' active' : ''}`}
                >
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <button className="al-burger" aria-label="menu" onClick={() => setOpen((v) => !v)}>
        <span />
      </button>
      <div className="al-scrim" onClick={() => setOpen(false)} />

      <main className="al-main">{children}</main>
    </div>
  )
}
