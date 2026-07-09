import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useT } from '../../lib/i18n'

// 관리자 영역 공유 셸 — 좌측 사이드바 네비게이션(App Store Connect 스타일).
// dashboard(15탭)와 jobs(7탭)의 모든 화면을 URL(?tab=)로 묶어 "페이지처럼" 전환한다.
// 각 페이지 내부 컨텐츠/디자인은 건드리지 않고, 상단 탭바만 이 사이드바로 대체.

const ROUTE_DEFAULT = { '/admin/dashboard': 'trend', '/admin/jobs': 'jobs' }

function buildNav(lang) {
  const L = (ko, en) => (lang === 'ko' ? ko : en)
  return [
    {
      label: 'Performance',
      items: [
        { label: L('추이', 'Trend'), pathname: '/admin/dashboard', tab: 'trend' },
        { label: L('퍼널', 'Funnel'), pathname: '/admin/dashboard', tab: 'funnel' },
        { label: L('지원자', 'Applicants'), pathname: '/admin/dashboard', tab: 'applications' },
        { label: L('이력서', 'Resumes'), pathname: '/admin/dashboard', tab: 'resumes' },
        { label: L('인재풀', 'Talent'), pathname: '/admin/dashboard', tab: 'talent' },
        { label: L('인재 공급', 'Supply'), pathname: '/admin/dashboard', tab: 'supply' },
        { label: L('광고메일', 'Recommend'), pathname: '/admin/dashboard', tab: 'recommend' },
        { label: L('연봉 인증', 'Verifications'), pathname: '/admin/dashboard', tab: 'verifications' },
        { label: L('커뮤니티', 'Community'), pathname: '/admin/dashboard', tab: 'community' },
        { label: L('기업', 'Companies'), pathname: '/admin/dashboard', tab: 'company' },
      ],
    },
    {
      label: L('앱 대시보드', 'App dashboard'),
      items: [
        { label: L('앱 대시보드', 'App dashboard'), pathname: '/admin/dashboard', tab: 'appMetrics' },
      ],
    },
    {
      label: L('영업', 'Sales'),
      items: [
        { label: L('콜드메일 (위승주)', 'Outreach (WSJ)'), pathname: '/admin/dashboard', tab: 'outreach' },
        { label: L('콜드메일 (남영훈)', 'Outreach (YH)'), pathname: '/admin/dashboard', tab: 'outreach-yh' },
      ],
    },
    {
      label: L('공고 관리', 'Job ops'),
      items: [
        { label: L('공고 등록', 'New job'), pathname: '/admin/jobs', tab: 'job-new' },
        { label: L('공고 목록', 'Jobs'), pathname: '/admin/jobs', tab: 'jobs' },
        { label: L('회사', 'Companies'), pathname: '/admin/jobs', tab: 'companies' },
        { label: L('공고 지표', 'Job KPI'), pathname: '/admin/jobs', tab: 'kpi' },
        { label: 'Admins', pathname: '/admin/jobs', tab: 'admins' },
      ],
    },
    {
      label: 'Personal',
      items: [
        { label: L('목표지표 — Sean', 'Goals — Sean'), pathname: '/admin/dashboard', tab: 'goals' },
      ],
    },
  ]
}

export default function AdminLayout({ children }) {
  const router = useRouter()
  const { lang: globalLang, setLang } = useT()
  const lang = globalLang === 'ko' ? 'ko' : 'en'
  const [open, setOpen] = useState(false)

  // 라우트/탭 이동 시 모바일 드로워 닫기
  useEffect(() => { setOpen(false) }, [router.asPath])

  const nav = buildNav(lang)
  const curTab = router.query.tab || ROUTE_DEFAULT[router.pathname]
  const isActive = (it) => router.pathname === it.pathname && curTab === it.tab
  const activeItem = nav.flatMap((g) => g.items).find(isActive)
  const contentMax = router.pathname === '/admin/jobs' ? 900 : 1200
  const contentPad = router.pathname === '/admin/jobs' ? 20 : 16

  return (
    <div className={`al-shell${open ? ' open' : ''}`}>
      <style>{`
        html { scrollbar-gutter: stable; }
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
        .al-brand-dot { width: 9px; height: 9px; border-radius: 50%; background: #ff4400; }
        .al-group { margin-bottom: 2px; }
        .al-group:not(:first-of-type) { margin-top: 16px; padding-top: 16px; border-top: 1px solid #E8E8EA; }
        .al-group-label {
          font-size: 10.5px; font-weight: 800; color: #9AA0A6; text-transform: uppercase;
          letter-spacing: 0.08em; padding: 2px 10px 9px;
        }
        .al-item {
          display: block; padding: 7px 10px; margin: 1px 0; border-radius: 7px;
          font-size: 13.5px; font-weight: 500; color: #1d1d1f; text-decoration: none;
          line-height: 1.3; transition: background 0.12s, color 0.12s; cursor: pointer;
        }
        .al-item:hover { background: #efeff2; }
        .al-item.active { background: #FFF1EC; color: #ff4400; font-weight: 600; }
        .al-main { flex: 1; min-width: 0; }
        .al-pagehead { padding: 40px 0 0; }
        .al-pagehead h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #1d1d1f; }
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
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8, borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#86868b', textDecoration: 'none', border: '1px solid #E8E8EA' }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>←</span>{lang === 'ko' ? '사이트로 돌아가기' : 'Back to site'}
          </a>
          <div style={{ display: 'flex', gap: 2, background: '#EFEFF2', borderRadius: 9, padding: 3 }}>
            {['ko', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: lang === l ? '#fff' : 'transparent',
                color: lang === l ? '#1d1d1f' : '#86868b',
                boxShadow: lang === l ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}>{l === 'ko' ? '한국어' : 'English'}</button>
            ))}
          </div>
        </div>
      </aside>

      <button className="al-burger" aria-label="menu" onClick={() => setOpen((v) => !v)}>
        <span />
      </button>
      <div className="al-scrim" onClick={() => setOpen(false)} />

      <main className="al-main">
        {activeItem && (
          <div className="al-pagehead">
            <div style={{ maxWidth: contentMax, margin: '0 auto', padding: `0 ${contentPad}px` }}>
              <h1>{activeItem.label}</h1>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
