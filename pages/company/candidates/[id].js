import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import { Sidebar, css } from '../jobs/new';
import CandidateDetail from '../../../components/company/CandidateDetail';

export default function CandidatePage() {
  const router = useRouter();
  const { id } = router.query;

  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUser(session.user);
      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name)')
        .eq('user_id', session.user.id).maybeSingle();
      if (!rec?.company_id) { setStatus('unauthed'); return; }
      setCompanyId(rec.company_id);
      setCompanyName(rec.recruiter_companies?.name || '');
      setStatus('ready');
    })();
  }, []);

  if (status === 'loading') return <div style={css.loading}>Loading…</div>;
  if (status === 'unauthed') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>로그인 필요</h1>
          <Link href="/company/signup" style={css.btnPrimary}>로그인 / 가입</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>지원자 · FYI</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" />
        <main style={{minWidth:0}}>
          <CandidateDetail appId={id} mode="page" companyId={companyId} />
        </main>
      </div>
    </>
  );
}
