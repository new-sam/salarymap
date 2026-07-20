import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabaseClient'
import { useT } from '../lib/i18n'
import { track } from '../lib/track'

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
]

// 전용 풀페이지 로그인. 예전 다크 모달(+"나중에")을 대체 — 이탈을 줄이려 페이지로 커밋시킨다.
// fyi-show-login 이벤트가 _app.js에서 /login?return=<원래경로> 로 라우팅한다.
// 로그인 흐름은 기존 모달과 동일: LinkedIn(localStorage return + /auth/callback), Google(/api/auth/google?return=).
export default function LoginPage() {
  const { t, lang, setLang } = useT()
  const router = useRouter()
  const [langOpen, setLangOpen] = useState(false)
  const returnTo = typeof router.query.return === 'string' && router.query.return ? router.query.return : '/'

  useEffect(() => {
    // 이미 로그인된 상태로 들어오면 원래 자리로 돌려보낸다.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(returnTo)
    })
    track('view_login_page', { page: '/login', meta: { return: returnTo } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loginLinkedIn = () => {
    track('click_login', { page: '/login', meta: { provider: 'linkedin' } })
    localStorage.setItem('fyi_login_return', returnTo)
    supabase.auth.signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo: window.location.origin + '/auth/callback', scopes: 'openid profile email' } })
  }
  const loginGoogle = () => {
    track('click_login', { page: '/login', meta: { provider: 'google' } })
    window.location.href = '/api/auth/google?return=' + encodeURIComponent(returnTo)
  }

  return (
    <>
      <Head><title>{`${t('auth.title')} · FYI`}</title></Head>
      <div className="lg">
        <button className="lg-x" aria-label="close" onClick={() => router.replace(returnTo)}>×</button>
        <header className="lg-header">
          <img className="lg-header-logo" src="/fyi-logo-dark.png" alt="FYI" />
          <span className="lg-header-title">{t('auth.title')}</span>
        </header>
        <div className="lg-inner">
          <div className="lg-logo"><img src="/fyi-logo-dark.png" alt="FYI" /></div>
          <h1 className="lg-title">{t('auth.pageTitle')}</h1>
          <p className="lg-sub">{t('auth.pageSub')}</p>
          <div className="lg-btns">
            <button className="lg-btn lg-linkedin" onClick={loginLinkedIn}>
              <span className="lg-ic">in</span> {t('auth.linkedin')}
            </button>
            <button className="lg-btn lg-google" onClick={loginGoogle}>
              <span className="lg-ic">G</span> {t('auth.google')}
            </button>
          </div>
        </div>
        <footer className="lg-footer">
          <div className="lg-lang">
            {langOpen && <div className="lg-lang-backdrop" onClick={() => setLangOpen(false)} />}
            {langOpen && (
              <div className="lg-lang-menu" role="listbox">
                {LANGS.map(l => (
                  <button key={l.code} type="button" role="option" aria-selected={l.code === lang}
                    className={`lg-lang-opt${l.code === lang ? ' on' : ''}`}
                    onClick={() => { setLang(l.code); setLangOpen(false) }}>
                    {l.label}
                    {l.code === lang && <span className="lg-lang-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="lg-lang-btn" aria-haspopup="listbox" aria-expanded={langOpen}
              onClick={() => setLangOpen(o => !o)}>
              {(LANGS.find(l => l.code === lang) || LANGS[0]).label}
              <svg className={`lg-lang-caret${langOpen ? ' up' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
          <nav className="lg-foot-links">
            <a href="/terms">{t('footer.terms')}</a>
            <a href="/privacy">{t('footer.privacy')}</a>
          </nav>
          <span className="lg-copy">{t('footer.copyright')}</span>
        </footer>
      </div>
      <style>{`
        .lg { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Barlow', sans-serif; overflow: hidden;
          background: radial-gradient(130% 90% at 50% -10%, #fff2ea 0%, #fdf6f2 32%, #fafaf8 60%); }
        /* 상단 중앙 부드러운 주황 글로우 */
        .lg::before { content: ''; position: absolute; top: -140px; left: 50%; transform: translateX(-50%); width: 620px; height: 520px; max-width: 130vw; background: radial-gradient(ellipse at center, rgba(255,96,0,0.16), rgba(255,96,0,0) 68%); pointer-events: none; z-index: 0; }
        /* 흐릿한 FYI 마크 워터마크 */
        .lg::after { content: ''; position: absolute; right: -80px; bottom: -90px; width: 460px; height: 490px; background: url('/fyi-mark.png') no-repeat center/contain; opacity: 0.05; pointer-events: none; z-index: 0; }
        .lg-inner { position: relative; z-index: 1; }
        .lg-header, .lg-footer, .lg-x { z-index: 1; }
        .lg-x { position: absolute; top: 16px; left: 16px; width: 40px; height: 40px; background: none; border: none; color: #c4c4c4; font-size: 26px; line-height: 1; cursor: pointer; border-radius: 50%; }
        .lg-x:hover { background: #f0f0ee; color: #999; }
        /* 헤더 바는 데스크톱 전용 (모바일은 숨김) */
        .lg-header { display: none; }
        .lg-header-logo { height: 28px; width: auto; object-fit: contain; }
        .lg-header-title { font-size: 15px; font-weight: 700; color: #333; }
        .lg-inner { width: 100%; max-width: 380px; text-align: center; }
        .lg-logo { margin-bottom: 30px; }
        .lg-logo img { height: 66px; width: auto; object-fit: contain; display: block; margin: 0 auto; }
        .lg-title { font-size: 32px; font-weight: 900; letter-spacing: -1px; color: #111; line-height: 1.18; margin: 0 0 14px; white-space: pre-line; word-break: keep-all; }
        .lg-sub { font-size: 15px; color: #8a8a8a; line-height: 1.6; margin: 0 0 40px; word-break: keep-all; }
        .lg-btns { display: flex; flex-direction: column; gap: 12px; }
        .lg-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; border: 1px solid transparent; }
        .lg-ic { font-weight: 900; font-size: 17px; }
        .lg-linkedin { background: #0A66C2; color: #fff; }
        .lg-google { background: #fff; color: #111; border-color: #e2e2df; }
        .lg-google:hover { background: #f7f7f5; }
        /* 하단 푸터(모바일: 세로 중앙 정렬 스택 / 데스크톱: 가로 바) */
        .lg-footer { position: absolute; left: 0; right: 0; bottom: calc(22px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .lg-foot-links { display: flex; gap: 16px; }
        .lg-foot-links a { font-size: 12px; color: #999; text-decoration: none; }
        .lg-foot-links a:hover { text-decoration: underline; }
        .lg-copy { font-size: 11px; color: #bbb; font-family: 'Barlow', sans-serif; }
        .lg-lang { position: relative; }
        .lg-lang-backdrop { position: fixed; inset: 0; z-index: 1; }
        .lg-lang-btn { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e2df; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600; color: #555; font-family: 'Barlow', sans-serif; cursor: pointer; }
        .lg-lang-btn:hover { background: #f7f7f5; }
        .lg-lang-caret { color: #999; transition: transform .18s ease; }
        .lg-lang-caret.up { transform: rotate(180deg); }
        .lg-lang-menu { position: absolute; z-index: 2; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); min-width: 150px; background: #fff; border: 1px solid #ececea; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.12); padding: 6px; }
        .lg-lang-opt { display: flex; align-items: center; width: 100%; gap: 8px; background: none; border: none; border-radius: 8px; padding: 10px 12px; font-size: 13px; font-weight: 500; color: #555; font-family: 'Barlow', sans-serif; cursor: pointer; text-align: left; white-space: nowrap; }
        .lg-lang-opt:hover { background: #f5f5f3; }
        .lg-lang-opt.on { color: #ff4400; font-weight: 700; }
        .lg-lang-check { margin-left: auto; }
        /* 데스크톱: 원티드식 상단 헤더바 + 하단 푸터바(저작권 좌·언어 우) */
        @media (min-width: 768px) {
          .lg-x { display: none; }
          .lg-logo { display: none; }
          .lg-header { display: flex; position: absolute; top: 0; left: 0; right: 0; height: 64px; align-items: center; gap: 10px; padding: 0 40px; border-bottom: 1px solid #ececea; }
          .lg-footer { flex-direction: row; justify-content: flex-end; align-items: center; gap: 24px; height: 64px; bottom: 0; padding: 0 40px; border-top: 1px solid #ececea; }
          .lg-copy { order: -1; margin-right: auto; font-size: 12px; }
          .lg-foot-links { order: 0; }
          .lg-foot-links a { font-size: 13px; }
          .lg-lang { order: 1; }
        }
      `}</style>
    </>
  )
}
