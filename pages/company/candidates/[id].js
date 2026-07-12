import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import { Sidebar, css } from '../jobs/new';
import CandidateDetail from '../../../components/company/CandidateDetail';
import { useT } from '../../../lib/i18n';

export default function CandidatePage() {
  const router = useRouter();
  const { t } = useT();
  const { id, from } = router.query;

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

  if (status === 'loading') return <div style={css.loading}>{t('company.loading')}</div>;
  if (status === 'unauthed') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>{t('company.loginRequired')}</h1>
          <Link href="/company" style={css.btnPrimary}>{t('company.loginOrSignup')}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{t('company.head.candidate')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" />
        <main style={{minWidth:0, flex:1}}>
          <CandidateDetail
            appId={id}
            mode="page"
            companyId={companyId}
            onClose={from === 'todo' ? () => router.push('/company/todo') : undefined}
          />
        </main>
      </div>
    </>
  );
}
