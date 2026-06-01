import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import Brand from '../../components/company/Brand';
import LangToggle from '../../components/company/LangToggle';
import { useT } from '../../lib/i18n';

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
]);

const STATUS_STYLE = {
  draft: { bg: '#F1F5F9', color: '#64748B' },
  pending_review: { bg: '#FFF7ED', color: '#EA580C' },
  live: { bg: '#ECFDF5', color: '#059669' },
  paused: { bg: '#FFFBEB', color: '#D97706' },
  closed: { bg: '#F1F5F9', color: '#94A3B8' },
};

const authResponsiveCss = `
  @media (max-width: 760px) {
    .company-auth-shell {
      padding: 24px 18px 44px !important;
    }
    .company-auth-grid {
      grid-template-columns: 1fr !important;
      gap: 28px !important;
    }
    .company-auth-hero {
      padding-top: 8px !important;
    }
    .company-auth-panel {
      padding: 24px 20px !important;
      width: 100% !important;
      min-width: 0 !important;
    }
    .company-auth-two-cols {
      grid-template-columns: 1fr !important;
    }
  }
`;

export default function CompanyDashboard() {
  const router = useRouter();
  const { t } = useT();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobs, setJobs] = useState([]);
  const [appsCount, setAppsCount] = useState(0);
  const [appsByJob, setAppsByJob] = useState({});
  const [authErr, setAuthErr] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupCompany, setSetupCompany] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);

  const loginWithGoogle = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fyi_intent', 'company');
      localStorage.setItem('fyi_login_return', '/company');
    }
    window.location.href = '/api/auth/google?return=' + encodeURIComponent('/company');
  };

  const completeCompanySetup = async (e) => {
    e.preventDefault();
    setAuthErr('');
    const userEmail = user?.email || '';
    const domain = userEmail.includes('@') ? userEmail.split('@')[1].toLowerCase() : '';
    if (!domain || FREE_MAIL_DOMAINS.has(domain)) {
      setAuthErr(t('company.err.notVerified'));
      return;
    }
    if (!setupName.trim()) { setAuthErr(t('company.err.contactRequired')); return; }
    if (!setupCompany.trim()) { setAuthErr(t('company.err.companyRequired')); return; }

    setSetupBusy(true);
    try {
      const { data: existing } = await supabase
        .from('recruiter_companies')
        .select('id, name')
        .eq('email_domain', domain)
        .limit(1)
        .maybeSingle();

      let companyId = existing?.id || null;
      let resolvedCompanyName = existing?.name || setupCompany.trim();

      if (!companyId) {
        const { data: created, error: companyError } = await supabase
          .from('recruiter_companies')
          .insert({
            name: setupCompany.trim(),
            email_domain: domain,
            created_by: user.id,
          })
          .select('id, name')
          .single();
        if (companyError) throw companyError;
        companyId = created?.id;
        resolvedCompanyName = created?.name || resolvedCompanyName;
      }

      if (!companyId) throw new Error(t('company.err.createFailed'));

      const { error: userError } = await supabase.from('recruiter_users').upsert({
        user_id: user.id,
        company_id: companyId,
        email: userEmail,
        full_name: setupName.trim(),
        role: 'admin',
      }, { onConflict: 'user_id' });
      if (userError) throw userError;

      setCompanyName(resolvedCompanyName);
      setFullName(setupName.trim());
      setJobs([]);
      setAppsCount(0);
      setAppsByJob({});
      setStatus('ready');
    } catch (err) {
      setAuthErr(err?.message || t('company.err.linkFailed'));
    } finally {
      setSetupBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!router.isReady) return;

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) { setStatus('unauthed'); return; }

      const userEmail = data.session.user.email || '';
      const emailDomain = userEmail.includes('@') ? userEmail.split('@')[1].toLowerCase() : '';
      if (!emailDomain || FREE_MAIL_DOMAINS.has(emailDomain)) {
        setAuthErr(t('company.err.freemail'));
        setStatus('unauthed');
        return;
      }
      setUser(data.session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, full_name, recruiter_companies(name)')
        .eq('user_id', data.session.user.id)
        .maybeSingle();
      if (rec?.recruiter_companies?.name) setCompanyName(rec.recruiter_companies.name);
      if (rec?.full_name) setFullName(rec.full_name);

      if (!rec?.company_id) {
        setSetupName(rec?.full_name || '');
        setStatus('needs_company');
        return;
      }

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, location, type, status, salary_min, salary_max, experience_min, experience_max, created_at, is_active')
        .eq('company_id', rec.company_id)
        .order('created_at', { ascending: false });
      const jobList = jobsData || [];
      setJobs(jobList);

      if (jobList.length > 0) {
        const ids = jobList.map(j => j.id);
        const { data: appsData } = await supabase
          .from('job_applications')
          .select('id, job_id, status')
          .in('job_id', ids);

        const apps = appsData || [];
        setAppsCount(apps.length);
        const grouped = {};
        apps.forEach(a => {
          if (!grouped[a.job_id]) grouped[a.job_id] = { total: 0, new: 0 };
          grouped[a.job_id].total += 1;
          if (a.status === 'pending') grouped[a.job_id].new += 1;
        });
        setAppsByJob(grouped);
      }
      setStatus('ready');
    })();
    return () => { mounted = false; };
  }, [router.isReady]);

  if (status === 'loading') return <div style={css.loading}>{t('company.loading')}</div>;

  if (status === 'unauthed') {
    const signupFrame = router.query.mode === 'signup';
    return (
      <>
        <Head><title>{signupFrame ? t('company.head.signup') : t('company.head.login')}</title></Head>
        <style>{authResponsiveCss}</style>
        <div className="company-auth-shell" style={localCss.authShell}>
          <div style={localCss.topRow}>
            <Brand href="/for-companies" />
            <LangToggle />
          </div>

          <div className="company-auth-grid" style={localCss.authGrid}>
            <section className="company-auth-hero" style={localCss.authHero}>
              <div style={localCss.authKicker}>COMPANY ACCESS</div>
              <h1 style={localCss.authTitle}>
                {t('company.heroTitle1')}<br />
                {t('company.heroTitle2')}
              </h1>
              <p style={localCss.authCopy}>
                {t('company.heroDesc1')}<br />
                {t('company.heroDesc2')}
              </p>
              <div style={localCss.authPoints}>
                <span>{t('company.point.free')}</span>
                <span>{t('company.point.fast')}</span>
                <span>{t('company.point.commission')}</span>
              </div>
            </section>

            <section className="company-auth-panel" style={localCss.authPanel}>
              <div style={localCss.form}>
                <h2 style={localCss.panelTitle}>{signupFrame ? t('company.signup') : t('company.login')}</h2>
                <p style={localCss.panelCopy}>
                  {t('company.googleCopy1')}<br />
                  {t('company.googleCopy2')}
                </p>
                {authErr && <div style={localCss.authErr}>{authErr}</div>}
                <button type="button" onClick={loginWithGoogle} style={localCss.googleBtn}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  <span>{t('company.googleLogin')}</span>
                </button>
                <div style={localCss.note}>{t('company.googleNote')}</div>
                <div style={localCss.legalNote}>{t('company.legalNote')}</div>
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  if (status === 'needs_company') {
    return (
      <>
        <Head><title>{t('company.head.setup')}</title></Head>
        <style>{authResponsiveCss}</style>
        <div className="company-auth-shell" style={localCss.authShell}>
          <div style={localCss.topRow}>
            <Brand href="/for-companies" />
            <LangToggle />
          </div>

          <div className="company-auth-grid" style={localCss.authGrid}>
            <section className="company-auth-hero" style={localCss.authHero}>
              <div style={localCss.authKicker}>COMPANY SETUP</div>
              <h1 style={localCss.authTitle}>
                {t('company.setupTitle1')}<br />
                {t('company.setupTitle2')}
              </h1>
              <p style={localCss.authCopy}>
                {user?.email}<br />
                {t('company.setupSub')}
              </p>
            </section>

            <section className="company-auth-panel" style={localCss.authPanel}>
              <form onSubmit={completeCompanySetup} style={localCss.form}>
                <h2 style={localCss.panelTitle}>{t('company.setupH')}</h2>
                <p style={localCss.panelCopy}>{t('company.setupCopy')}</p>
                <div className="company-auth-two-cols" style={localCss.twoCols}>
                  <div>
                    <label style={localCss.label}>{t('company.contactLabel')}</label>
                    <input
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder={t('company.contactPh')}
                      style={localCss.input}
                      required
                    />
                  </div>
                  <div>
                    <label style={localCss.label}>{t('company.companyLabel')}</label>
                    <input
                      value={setupCompany}
                      onChange={(e) => setSetupCompany(e.target.value)}
                      placeholder={t('company.companyPh')}
                      style={localCss.input}
                      required
                    />
                  </div>
                </div>
                {authErr && <div style={localCss.authErr}>{authErr}</div>}
                <button type="submit" disabled={setupBusy} style={localCss.primaryBtn}>
                  {setupBusy ? t('company.connecting') : t('company.connectBtn')}
                </button>
              </form>
            </section>
          </div>
        </div>
      </>
    );
  }

  const activeCount = jobs.filter(j => j.status === 'live').length;
  const goKanban = (jobId) => router.push(`/company/ats?job=${jobId}`);

  return (
    <>
      <Head><title>{t('company.head.dashboard')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="home" />

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>{fullName ? t('company.welcomeName', { name: fullName }) : t('company.welcome')}</h1>
              <p style={css.mainP}>
                {companyName ? `${companyName} ` : ''}— {t('company.dashSub')}
              </p>
            </div>
            <Link href="/company/jobs/new" style={css.btnPrimary}>{t('company.newJobBtn')}</Link>
          </header>

          {jobs.length === 0 ? (
            <div style={localCss.empty}>
              <div style={localCss.emptyIco}>📋</div>
              <h2 style={localCss.emptyH}>{t('company.emptyTitle')}</h2>
              <p style={localCss.emptyP}>{t('company.emptyDesc')}</p>
              <Link href="/company/jobs/new" style={css.btnPrimary}>{t('company.emptyCta')}</Link>
            </div>
          ) : (
            <>
              <div style={localCss.kpiInline}>
                <span><b style={localCss.kpiStrong}>{jobs.length}</b>{t('company.kpiJobs', { n: '' })}</span>
                <span style={localCss.kpiSep}>·</span>
                <span><b style={localCss.kpiStrong}>{activeCount}</b>{t('company.kpiActive', { n: '' })}</span>
                <span style={localCss.kpiSep}>·</span>
                <span><b style={localCss.kpiStrong}>{appsCount}</b>{t('company.kpiApps', { n: '' })}</span>
              </div>

              <div style={localCss.list}>
                {jobs.map(job => {
                  const s = STATUS_STYLE[job.status] || STATUS_STYLE.draft;
                  const stats = appsByJob[job.id] || { total: 0, new: 0 };
                  return (
                    <div
                      key={job.id}
                      onClick={() => goKanban(job.id)}
                      style={localCss.card}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(234,88,12,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={localCss.cardLeft}>
                        <div style={localCss.cardTitleRow}>
                          <span style={localCss.cardTitle}>{job.title}</span>
                          <span style={{...localCss.badge, background: s.bg, color: s.color}}>
                            {t(`company.status.${job.status}`)}
                          </span>
                        </div>
                        <div style={localCss.cardMeta}>
                          {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M/월
                        </div>
                        {job.status === 'pending_review' && (
                          <div style={{ marginTop: 6, fontSize: 12, color: '#EA580C', fontWeight: 700 }}>
                            ⏳ {t('company.job.approval.pendingDesc')}
                          </div>
                        )}
                      </div>
                      <div style={localCss.cardRight}>
                        <div style={localCss.stats}>
                          <div style={localCss.statBox}>
                            <div style={localCss.statVal}>{stats.total}</div>
                            <div style={localCss.statLab}>{t('company.stat.apps')}</div>
                          </div>
                          {stats.new > 0 && (
                            <div style={{...localCss.statBox, ...localCss.statBoxNew}}>
                              <div style={localCss.statVal}>{stats.new}</div>
                              <div style={localCss.statLab}>{t('company.stat.new')}</div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/company/jobs/${job.id}/edit`); }}
                          style={localCss.editBtn}
                        >
                          {t('company.editBtn')}
                        </button>
                        <span style={localCss.arrow}>→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

const localCss = {
  authShell: {
    minHeight: '100vh',
    background: '#F7F7F5',
    color: '#111',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: '34px clamp(18px, 5vw, 64px) 56px',
  },
  topRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 58, gap: 12, flexWrap: 'wrap',
  },
  authGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.95fr) minmax(380px, 0.72fr)',
    gap: 56,
    alignItems: 'start',
    maxWidth: 1120,
    margin: '0 auto',
  },
  authHero: { paddingTop: 36 },
  authKicker: {
    color: '#EA580C',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.16em',
    marginBottom: 18,
  },
  authTitle: {
    margin: 0,
    fontSize: 'clamp(44px, 6vw, 72px)',
    lineHeight: 1.04,
    letterSpacing: '-0.04em',
    fontWeight: 950,
  },
  authCopy: {
    margin: '24px 0 0',
    color: '#525252',
    fontSize: 17,
    lineHeight: 1.7,
    fontWeight: 650,
  },
  authPoints: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 28,
    color: '#525252',
    fontSize: 12.5,
    fontWeight: 850,
  },
  authPanel: {
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 18,
    padding: 30,
    boxShadow: '0 18px 46px rgba(17,17,17,0.08)',
  },
  panelTitle: { margin: 0, fontSize: 23, lineHeight: 1.2, fontWeight: 900, letterSpacing: '-0.02em' },
  panelCopy: { margin: '9px 0 20px', color: '#6B7280', fontSize: 13.5, lineHeight: 1.55, fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: 9 },
  label: { display: 'block', marginBottom: 6, color: '#374151', fontSize: 12, fontWeight: 800 },
  note: {
    margin: '4px 0 2px',
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 650,
  },
  legalNote: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 11.5,
    lineHeight: 1.5,
    textAlign: 'center',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    border: '1px solid #D1D5DB',
    borderRadius: 10,
    padding: '13px 14px',
    color: '#111',
    background: '#fff',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  primaryBtn: {
    marginTop: 5,
    width: '100%',
    border: 'none',
    borderRadius: 999,
    padding: '14px 18px',
    color: '#fff',
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    fontSize: 14.5,
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleBtn: {
    marginTop: 5,
    width: '100%',
    border: '1px solid #D1D5DB',
    borderRadius: 999,
    padding: '13px 18px',
    color: '#111',
    background: '#fff',
    fontSize: 14.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'background 0.15s, box-shadow 0.15s',
  },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  authErr: {
    padding: '10px 12px',
    borderRadius: 9,
    background: '#FEF2F2',
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: 650,
    lineHeight: 1.45,
  },
  sentBox: { textAlign: 'center' },
  sentIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 54,
    height: 54,
    margin: '0 auto 18px',
    borderRadius: '50%',
    color: '#fff',
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    fontSize: 24,
    fontWeight: 900,
  },
  empty: { border: '2px dashed #E5E7EB', borderRadius: 12, padding: '48px 24px', textAlign: 'center', background: '#fff' },
  emptyIco: { fontSize: 36, marginBottom: 12, opacity: 0.5 },
  emptyH: { fontSize: 18, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 },
  emptyP: { fontSize: 13.5, color: '#525252', maxWidth: 380, margin: '0 auto 22px', lineHeight: 1.65 },

  kpiInline: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, color: '#525252', fontWeight: 600 },
  kpiStrong: { color: '#1A1A1A', fontWeight: 900, fontSize: 16, fontVariantNumeric: 'tabular-nums' },
  kpiSep: { color: '#CBD5E1' },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px', background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
  },
  cardLeft: { flex: 1, minWidth: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: '#1A1A1A' },
  cardMeta: { fontSize: 12.5, color: '#525252' },
  cardRight: { display: 'flex', alignItems: 'center', gap: 16 },
  badge: { padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' },

  stats: { display: 'flex', gap: 10 },
  statBox: { textAlign: 'center', minWidth: 40 },
  statBoxNew: { color: '#EA580C' },
  statVal: { fontSize: 18, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' },
  statLab: { fontSize: 10.5, color: '#737373', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },

  editBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#525252', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  arrow: { fontSize: 16, color: '#94A3B8', fontWeight: 800 },
};
