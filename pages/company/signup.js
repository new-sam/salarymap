import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Brand from '../../components/company/Brand';
import { useT } from '../../lib/i18n';

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
]);

export default function CompanySignup() {
  const router = useRouter();
  const { t } = useT();

  const loginWithGoogle = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fyi_intent', 'company');
      localStorage.setItem('fyi_login_return', '/company');
    }
    window.location.href = '/api/auth/google?return=' + encodeURIComponent('/company');
  };

  return (
    <>
      <Head><title>{t('company.signup.headTitle')}</title></Head>
      <div style={css.shell}>
        <Brand style={{ marginBottom: 26 }} />
        <div style={css.card}>
          <h1 style={css.h}>{t('company.signup.title')}</h1>
          <p style={css.lead}>{t('company.signup.lead')}</p>

          <div style={css.note}>
            <b style={css.noteB}>{t('company.signup.noteTitle')}</b>
            <span style={css.noteText}>
              {t('company.signup.noteBody')}
            </span>
          </div>

          <button type="button" onClick={loginWithGoogle} style={css.googleBtn}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {t('company.signup.googleBtn')}
          </button>

          <div style={css.hint}>{t('company.signup.freeMailHint')}</div>

          <div style={css.legal}>
            {t('company.signup.agreePre')}<a style={css.linkDim}>{t('company.signup.terms')}</a> · <a style={css.linkDim}>{t('company.signup.privacy')}</a>{t('company.signup.agreePost')}<br />
            {t('company.signup.haveAccount')} <Link href="/company" style={css.linkAccent}>{t('company.signup.login')}</Link>
          </div>
        </div>

        <div style={css.bottomNav}>
          <Link href="/for-companies" style={css.linkDim}>{t('company.signup.toIntro')}</Link>
          <Link href="/" style={css.linkDim}>{t('company.signup.toPersonal')}</Link>
        </div>
      </div>
    </>
  );
}

const css = {
  shell: {
    minHeight: '100vh',
    background: '#F7F7F8',
    color: '#1a1a1a',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    WebkitFontSmoothing: 'antialiased',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
    padding: '44px 20px 48px',
  },

  card: {
    maxWidth: 460, width: '100%', padding: '40px 36px',
    background: '#fff', borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.05)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 14px 36px rgba(0,0,0,0.07)',
  },
  h: { fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8, letterSpacing: '-0.02em' },
  lead: { fontSize: 13.5, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
  note: {
    background: '#F0F6FF', border: '1px solid #DBE8FF', borderRadius: 10,
    padding: '13px 15px', marginBottom: 24, fontSize: 12.5, lineHeight: 1.55,
  },
  noteB: { display: 'block', color: '#2563eb', marginBottom: 4, fontSize: 12, fontWeight: 700 },
  noteText: { color: '#4b5563' },
  field: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 },
  label: { fontSize: 12.5, color: '#374151', fontWeight: 600 },
  input: {
    background: '#fff', border: '1px solid #D4D7DD', borderRadius: 9,
    padding: '12px 14px', fontSize: 14, color: '#111',
    fontFamily: 'inherit', outline: 'none',
  },
  hint: { fontSize: 11.5, color: '#9ca3af' },
  err: {
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    padding: '10px 13px', fontSize: 12.5, color: '#dc2626', marginBottom: 14, lineHeight: 1.5,
  },
  googleBtn: {
    width: '100%', padding: '13px 16px', borderRadius: 10, border: '1px solid #D1D5DB',
    background: '#fff', color: '#111',
    fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 12,
  },
  legal: { fontSize: 11.5, color: '#9ca3af', textAlign: 'center', marginTop: 20, lineHeight: 1.7 },
  linkDim: { color: '#6b7280', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' },
  linkAccent: { color: '#f97316', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' },
  bottomNav: {
    maxWidth: 460, width: '100%', marginTop: 20,
    display: 'flex', justifyContent: 'space-between', fontSize: 12,
  },
};
