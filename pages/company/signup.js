import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
]);

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
        sessionStorage.setItem('fyi_company_full_name', fullName.trim());
        sessionStorage.setItem('fyi_company_name', companyName.trim());
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
        <div style={css.card}>
          <h1 style={css.h}>기업 계정 만들기</h1>
          <p style={css.lead}>회사 이메일로 인증 링크를 보냅니다. 1분 내 도착.</p>

          <div style={css.note}>
            <b style={css.noteB}>📌 개인 계정과 별개입니다</b>
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
    background: '#0a0a0a',
    color: '#e5e5e5',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
    padding: '48px 20px 40px',
  },
  card: {
    maxWidth: 440, width: '100%', padding: '36px 32px',
    background: '#13131a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
  },
  h: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-0.01em' },
  lead: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 22, lineHeight: 1.6 },
  note: {
    background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: 7,
    padding: '12px 14px', marginBottom: 22, fontSize: 12.5, lineHeight: 1.55,
  },
  noteB: { display: 'block', color: '#60a5fa', marginBottom: 4, fontSize: 12 },
  noteText: { color: 'rgba(255,255,255,0.7)' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 },
  input: {
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
    padding: '11px 14px', fontSize: 14, color: '#fff',
    fontFamily: 'inherit',
  },
  hint: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)' },
  err: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
    padding: '10px 12px', fontSize: 12.5, color: '#f87171', marginBottom: 14, lineHeight: 1.5,
  },
  btnPrimary: {
    width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDisabled: {
    width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)',
    fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
    fontFamily: 'inherit',
  },
  legal: { fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 18, lineHeight: 1.6 },
  linkDim: { color: 'rgba(255,255,255,0.55)', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' },
  linkAccent: { color: '#f97316', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' },
  bottomNav: {
    maxWidth: 440, width: '100%', marginTop: 24,
    display: 'flex', justifyContent: 'space-between', fontSize: 12,
  },
  // sent state
  sentCard: {
    maxWidth: 440, width: '100%', padding: '48px 32px', textAlign: 'center',
  },
  sentIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'rgba(16,185,129,0.12)', color: '#10b981',
    fontSize: 28, display: 'grid', placeItems: 'center', margin: '0 auto 20px',
  },
  sentH: { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 },
  sentP: { fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 24, lineHeight: 1.7 },
  sentResend: { fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  code: { background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#fbbf24' },
};
