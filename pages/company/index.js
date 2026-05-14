import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function CompanyDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | unauthed | ready
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setStatus('unauthed');
        return;
      }
      setUser(data.session.user);
      const sn = typeof window !== 'undefined' ? sessionStorage.getItem('fyi_company_name') : null;
      const fn = typeof window !== 'undefined' ? sessionStorage.getItem('fyi_company_full_name') : null;
      if (sn) setCompanyName(sn);
      if (fn) setFullName(fn);
      setStatus('ready');
    })();
    return () => { mounted = false; };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/for-companies');
  };

  if (status === 'loading') {
    return (
      <div style={css.loading}>
        <div style={css.spinner} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (status === 'unauthed') {
    return (
      <>
        <Head><title>기업 로그인 · FYI</title></Head>
        <div style={css.unauthedShell}>
          <div style={css.unauthedCard}>
            <h1 style={css.h1}>기업 로그인</h1>
            <p style={css.lead}>회사 계정으로 로그인해 주세요.</p>
            <Link href="/company/signup" style={css.btnPrimary}>회사 이메일로 로그인 / 가입</Link>
            <div style={css.legalLine}>
              아직 계정 없으세요? <Link href="/for-companies" style={css.linkAccent}>FYI for Companies 소개 →</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>대시보드 · FYI for Companies</title></Head>
      <div style={css.app}>
        <aside style={css.sidebar}>
          <div style={css.sideHead}>
            <div style={css.sideCompany}>{companyName || '내 회사'}</div>
            <div style={css.sideUser}>{fullName || user?.email} · admin</div>
          </div>
          <nav style={css.sideNav}>
            <a style={{...css.navItem, ...css.navItemActive}}><span style={css.navIco}>🏠</span>대시보드</a>
            <a style={css.navItem}><span style={css.navIco}>📋</span>공고 (0)</a>
            <a style={css.navItem}><span style={css.navIco}>👥</span>팀</a>
            <a style={css.navItem}><span style={css.navIco}>💸</span>빌링</a>
          </nav>
          <button style={css.atsCta} disabled>
            <span style={css.atsIco}>⚡</span>ATS 열기
            <span style={css.atsArr}>잠금</span>
          </button>
          <div style={css.sideBottom}>
            <a onClick={signOut} style={css.signoutLink}>로그아웃</a>
          </div>
        </aside>

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>환영합니다{fullName ? `, ${fullName}님` : ''}</h1>
              <p style={css.mainP}>
                {companyName ? `${companyName} ` : ''}계정이 생성되었습니다. 첫 공고를 등록해 보세요.
              </p>
            </div>
          </header>

          <div style={css.empty}>
            <div style={css.emptyIco}>📋</div>
            <h2 style={css.emptyH}>아직 공고가 없네요</h2>
            <p style={css.emptyP}>
              첫 공고는 운영 검수(24시간) 후 활성됩니다. 이후 공고는 자동 통과.
            </p>
            <button style={css.btnAccent} disabled title="Phase 2에서 구현됩니다">
              + 첫 공고 작성하기 (준비 중)
            </button>
            <div style={css.emptyHint}>Phase 1은 진입·인증 플로우까지. 공고 작성 폼은 다음 단계.</div>
          </div>
        </main>
      </div>
    </>
  );
}

const css = {
  loading: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0a0a0a',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #f97316', borderTopColor: 'transparent',
    animation: 'spin 0.8s linear infinite',
  },

  // Unauthed
  unauthedShell: {
    minHeight: '100vh', background: '#0a0a0a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e5e5e5', padding: 20,
  },
  unauthedCard: {
    maxWidth: 400, width: '100%', padding: '40px 32px', textAlign: 'center',
    background: '#13131a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
  },
  h1: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-0.01em' },
  lead: { fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 24, lineHeight: 1.65 },
  btnPrimary: {
    display: 'inline-block', width: '100%',
    padding: '12px 16px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
    textDecoration: 'none', fontFamily: 'inherit',
  },
  legalLine: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 16, lineHeight: 1.6 },
  linkAccent: { color: '#f97316', fontWeight: 700, textDecoration: 'underline' },

  // App shell
  app: {
    display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh',
    background: '#0a0a0a',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#e5e5e5',
  },
  sidebar: {
    background: '#0f0f15', borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  sideHead: {
    padding: '10px 10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8,
  },
  sideCompany: { fontSize: 13.5, fontWeight: 700, color: '#fff' },
  sideUser: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  sideNav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '8px 10px', borderRadius: 6,
    fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 500, cursor: 'pointer',
  },
  navItemActive: { background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 700 },
  navIco: { width: 14, textAlign: 'center', fontSize: 13 },
  atsCta: {
    marginTop: 12, padding: '10px 12px', borderRadius: 7,
    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)',
    border: '1px dashed rgba(255,255,255,0.12)',
    fontSize: 12, fontWeight: 700, cursor: 'not-allowed',
    display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
  },
  atsIco: { fontSize: 14 },
  atsArr: { marginLeft: 'auto', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },
  sideBottom: { marginTop: 'auto', padding: '10px' },
  signoutLink: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', textDecoration: 'underline' },

  // Main
  main: { padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 },
  mainHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  mainH: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' },
  mainP: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  empty: {
    border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 12,
    padding: '48px 24px', textAlign: 'center',
  },
  emptyIco: { fontSize: 36, marginBottom: 12, opacity: 0.4 },
  emptyH: { fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 8 },
  emptyP: { fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 360, margin: '0 auto 22px', lineHeight: 1.65 },
  btnAccent: {
    padding: '12px 22px', borderRadius: 8, border: 'none',
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
    fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
    fontFamily: 'inherit',
  },
  emptyHint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 14, fontStyle: 'italic' },
};
