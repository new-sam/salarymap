import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
]);

function Brand() {
  return (
    <Link href="/for-companies" style={css.brand}>
      <span style={css.brandMark}>F</span>
      <span style={css.brandWord}>FYI <span style={css.brandSub}>for companies</span></span>
    </Link>
  );
}

export default function CompanySignup() {
  const router = useRouter();
  const sent = router.query.sent === '1';

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    const trimmed = email.trim().toLowerCase();
    const domain = trimmed.split('@')[1];
    if (!domain || FREE_MAIL_DOMAINS.has(domain)) {
      setErr('회사 이메일 도메인을 사용해 주세요 (gmail/naver 등 프리메일은 사용 불가)');
      return;
    }
    if (!fullName.trim()) { setErr('본인 이름을 입력해 주세요'); return; }
    if (!companyName.trim()) { setErr('회사명을 입력해 주세요'); return; }

    setBusy(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fyi_intent', 'company');
        localStorage.setItem('fyi_login_return', '/company');
        localStorage.setItem('fyi_company_full_name', fullName.trim());
        localStorage.setItem('fyi_company_name', companyName.trim());
      }
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      router.replace({ pathname: '/company/signup', query: { sent: '1', email: trimmed } });
    } catch (e) {
      setErr(e?.message || '인증 메일 발송 실패');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    const shown = router.query.email || '';
    return (
      <>
        <Head><title>인증 메일 발송됨 · FYI for Companies</title></Head>
        <div style={css.shell}>
          <Brand />
          <div style={css.sentCard}>
            <div style={css.sentIcon}>✉</div>
            <h1 style={css.sentH}>인증 메일을 보냈어요</h1>
            <p style={css.sentP}>
              <b>{shown}</b> 으로 인증 링크를 보냈습니다.<br />
              메일이 안 보이면 스팸함을 확인해 주세요.<br /><br />
              링크를 클릭하면 자동으로 로그인되어 <code style={css.code}>/company</code> 대시보드로 이동합니다.
            </p>
            <div style={css.sentResend}>
              메일이 안 와요. <a onClick={() => router.replace('/company/signup')} style={css.linkAccent}>다시 입력하기</a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>기업 계정 만들기 · FYI for Companies</title></Head>
      <div style={css.shell}>
        <Brand />
        <div style={css.card}>
          <h1 style={css.h}>기업 계정 만들기</h1>
          <p style={css.lead}>회사 이메일로 인증 링크를 보냅니다. 1분 내 도착.</p>

          <div style={css.note}>
            <b style={css.noteB}>개인 계정과 별개입니다</b>
            <span style={css.noteText}>
              기존 salary-fyi.com 후보자 계정을 갖고 있어도, 회사 계정은 새로 만들어야 합니다. (역할 충돌 방지)
            </span>
          </div>

          <form onSubmit={onSubmit}>
            <div style={css.field}>
              <label style={css.label}>회사 이메일</label>
              <input
                type="email"
                placeholder="you@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={css.input}
                required
              />
              <div style={css.hint}>gmail/naver/yahoo 등 프리메일은 사용 불가</div>
            </div>
            <div style={css.field}>
              <label style={css.label}>본인 이름</label>
              <input
                type="text"
                placeholder="홍길동"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={css.input}
                required
              />
            </div>
            <div style={css.field}>
              <label style={css.label}>회사명</label>
              <input
                type="text"
                placeholder="ACME Vietnam Co., Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={css.input}
                required
              />
              <div style={css.hint}>동일 도메인 회사가 이미 가입돼 있으면 안내됩니다</div>
            </div>

            {err && <div style={css.err}>{err}</div>}

            <button type="submit" disabled={busy} style={busy ? css.btnDisabled : css.btnPrimary}>
              {busy ? '메일 발송 중…' : '이메일로 인증 링크 받기'}
            </button>

            <div style={css.legal}>
              버튼 클릭 시 <a style={css.linkDim}>이용약관</a> · <a style={css.linkDim}>개인정보처리방침</a> 동의<br />
              이미 회사 계정 있으세요? <Link href="/company" style={css.linkAccent}>로그인</Link>
            </div>
          </form>
        </div>

        <div style={css.bottomNav}>
          <Link href="/for-companies" style={css.linkDim}>← 소개로</Link>
          <Link href="/" style={css.linkDim}>개인 사이트로 →</Link>
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
  brand: {
    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 26,
    textDecoration: 'none',
  },
  brandMark: {
    width: 30, height: 30, borderRadius: 8,
    background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff',
    display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800,
  },
  brandWord: { fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' },
  brandSub: { fontSize: 12.5, color: '#9ca3af', fontWeight: 500, letterSpacing: 0 },

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
  btnPrimary: {
    width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff',
    fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(249,115,22,0.28)',
  },
  btnDisabled: {
    width: '100%', padding: '13px 16px', borderRadius: 10, border: 'none',
    background: '#E5E7EB', color: '#9CA3AF',
    fontSize: 14.5, fontWeight: 700, cursor: 'not-allowed',
    fontFamily: 'inherit',
  },
  legal: { fontSize: 11.5, color: '#9ca3af', textAlign: 'center', marginTop: 20, lineHeight: 1.7 },
  linkDim: { color: '#6b7280', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' },
  linkAccent: { color: '#f97316', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' },
  bottomNav: {
    maxWidth: 460, width: '100%', marginTop: 20,
    display: 'flex', justifyContent: 'space-between', fontSize: 12,
  },
  // sent state
  sentCard: {
    maxWidth: 460, width: '100%', padding: '48px 36px', textAlign: 'center',
    background: '#fff', borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.05)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 14px 36px rgba(0,0,0,0.07)',
  },
  sentIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#ECFDF5', color: '#10b981',
    fontSize: 28, display: 'grid', placeItems: 'center', margin: '0 auto 20px',
  },
  sentH: { fontSize: 21, fontWeight: 800, color: '#111', marginBottom: 10 },
  sentP: { fontSize: 13.5, color: '#6b7280', marginBottom: 24, lineHeight: 1.7 },
  sentResend: { fontSize: 12.5, color: '#9ca3af' },
  code: { background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#d97706' },
};
