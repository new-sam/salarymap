import { useEffect, useState, Fragment } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { loadAccessibleJobIds } from '../../lib/company-access';
import { Sidebar, css } from './jobs/new';
import MobileNav from '../../components/company/MobileNav';
import Truncate from '../../components/ui/truncate';
import Brand from '../../components/company/Brand';
import LangToggle from '../../components/company/LangToggle';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/cn';
import { Button as UButton } from '../../components/ui/button';
import { Badge as UBadge } from '../../components/ui/badge';
import { Plus, FileText, Edit3, ArrowRight, Briefcase, CheckCircle2, Users, Home } from 'lucide-react';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { DashboardSkeleton } from '../../components/ui/page-skeleton';

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
]);

// Neutral status palette — only "pending_review" keeps the brand accent
// because it's the one state that calls for the user's attention.
const STATUS_STYLE = {
  draft: { bg: '#F2F4F6', color: '#6B7684' },
  pending_review: { bg: '#FFF7ED', color: '#EA580C' },
  live: { bg: '#F2F4F6', color: '#191F28' },
  paused: { bg: '#F2F4F6', color: '#6B7684' },
  closed: { bg: '#F2F4F6', color: '#B0B8C1' },
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
  // Cached values hydrate inside useEffect to avoid SSR/CSR mismatch.
  const [jobs, setJobs] = useState([]);
  const [appsCount, setAppsCount] = useState(0);
  const [appsByJob, setAppsByJob] = useState({});
  const [authErr, setAuthErr] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupCompany, setSetupCompany] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);

  const loginWithGoogle = async () => {
    // 로그인 후 복귀 경로: ?next 가 있으면 거기로(랜딩 '공고 올리기' → /company/jobs/new), 없으면 대시보드
    const next = router.query.next ? String(router.query.next) : '';
    const returnTo = next.startsWith('/company') ? next : '/company';
    if (typeof window !== 'undefined') {
      localStorage.setItem('fyi_intent', 'company');
      localStorage.setItem('fyi_login_return', returnTo);
    }
    window.location.href = '/api/auth/google?return=' + encodeURIComponent(returnTo);
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
    // Hydrate from sessionStorage after mount (avoids SSR/CSR mismatch).
    try {
      const cached = JSON.parse(sessionStorage.getItem('fyi.dashboard.v1') || 'null');
      if (cached) {
        setJobs(cached.jobs || []);
        setAppsCount(cached.appsCount || 0);
        setAppsByJob(cached.appsByJob || {});
        setStatus('ready');
      }
    } catch {}
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

      // Only surface jobs the user owns or was invited to. Same likelion.net
      // tenant ≠ shared visibility.
      const accessibleIds = await loadAccessibleJobIds(data.session.user.id, rec.company_id);
      let jobsData = [];
      if (accessibleIds.size > 0) {
        const { data } = await supabase
          .from('jobs')
          .select('id, title, location, type, status, salary_min, salary_max, experience_min, experience_max, created_at, is_active, created_by')
          .in('id', Array.from(accessibleIds))
          .order('created_at', { ascending: true });
        jobsData = data || [];
      }
      const jobList = jobsData;
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
        try {
          sessionStorage.setItem('fyi.dashboard.v1', JSON.stringify({
            jobs: jobList, appsCount: apps.length, appsByJob: grouped,
          }));
        } catch {}
      }
      setStatus('ready');
    })();
    return () => { mounted = false; };
  }, [router.isReady]);

  if (status === 'loading') {
    return (
      <div style={css.app}>
        <Sidebar companyName="" userEmail="" activePage="home" />
        <DashboardSkeleton />
      </div>
    );
  }

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

  const statusBadgeVariant = (s) => {
    if (s === 'live') return 'success';
    if (s === 'pending_review') return 'warning';
    if (s === 'paused') return 'warning';
    return 'secondary';
  };

  return (
    <>
      <Head><title>{t('company.head.dashboard')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="home" />

        <main style={css.main}>
          <MobileNav active="home" companyName={companyName} userEmail={user?.email} />
          {/* PageHeader hides on mobile — MobileNav already carries company context
              and the welcome line just eats vertical space on small screens. */}
          <div className="hidden md:block">
          <PageHeader
            title={(
              <span className="flex items-center gap-2.5">
                <Home className="w-5 h-5 text-primary-600" />
                {fullName ? t('company.welcomeName', { name: fullName }) : t('company.welcome')}
              </span>
            )}
            subtitle={`${companyName ? `${companyName} ` : ''}— ${t('company.dashSub')}`}
            right={(
              <UButton asChild className="hidden md:inline-flex">
                <Link href="/company/jobs/new">
                  <Plus className="w-4 h-4" />
                  {t('company.newJobBtn')}
                </Link>
              </UButton>
            )}
          />
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white">
              <EmptyState
                icon={FileText}
                tone="brand"
                title={t('company.emptyTitle')}
                description={t('company.emptyDesc')}
                className="py-14"
                action={(
                  <UButton asChild>
                    <Link href="/company/jobs/new">
                      <Plus className="w-4 h-4" />
                      {t('company.emptyCta')}
                    </Link>
                  </UButton>
                )}
              />
            </div>
          ) : (
            <>
              {/* Dashboard KPI — desktop only; mobile MVP is a focused job list à la Greeting,
                  not a dashboard. Recruiters open mobile to drill into jobs, not skim stats. */}
              <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
                {/* 공고 (총) — gray */}
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-soft-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md grid place-items-center bg-gray-100 text-gray-700">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12.5px] font-extrabold text-gray-700 uppercase tracking-[0.08em]">{t('company.kpiJobs')}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 text-gray-900">
                    <span className="text-[26px] font-black leading-none tracking-tight tabular-nums">{jobs.length}</span>
                    <span className="text-[13px] font-bold text-gray-900">{t('company.unit.count')}</span>
                  </div>
                </div>
                {/* 활성 공고 — green (positive state) */}
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-soft-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md grid place-items-center bg-green-50 text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12.5px] font-extrabold text-green-700 uppercase tracking-[0.08em]">{t('company.kpiActive')}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 text-green-700">
                    <span className="text-[26px] font-black leading-none tracking-tight tabular-nums">{activeCount}</span>
                    <span className="text-[13px] font-bold text-green-700">{t('company.unit.count')}</span>
                  </div>
                </div>
                {/* 지원자 — primary (action target) */}
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-soft-xs">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-6 h-6 rounded-md grid place-items-center',
                      appsCount > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
                    )}>
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <span className={cn('text-[12.5px] font-extrabold uppercase tracking-[0.08em]',
                      appsCount > 0 ? 'text-primary-700' : 'text-gray-500'
                    )}>{t('company.kpiApps')}</span>
                  </div>
                  <div className={cn('mt-1.5 flex items-baseline gap-1',
                    appsCount > 0 ? 'text-primary-700' : 'text-gray-900'
                  )}>
                    <span className="text-[26px] font-black leading-none tracking-tight tabular-nums">{appsCount}</span>
                    <span className={cn('text-[13px] font-bold',
                      appsCount > 0 ? 'text-primary-700' : 'text-gray-900'
                    )}>{t('company.unit.people')}</span>
                  </div>
                </div>
              </div>

              {(() => {
                // Approval policy is dropped for this sprint — no more 'pending' group.
                // Legacy pending_review jobs collapse into 'inactive'.
                const groupOf = (s) => s === 'live' ? 'active' : 'inactive';
                const grouped = { active: [], inactive: [] };
                jobs.forEach(j => { grouped[groupOf(j.status)].push(j); });
                const renderCard = (job) => {
                  const stats = appsByJob[job.id] || { total: 0, new: 0 };
                  const isJobOwner = job.created_by && user?.id && job.created_by === user.id;
                  return (
                    <div
                      key={job.id}
                      onClick={() => goKanban(job.id)}
                      className="group flex items-center justify-between gap-4 rounded-xl bg-white border border-border px-4 py-3 cursor-pointer transition-all duration-200 ease-spring hover:border-primary-300 hover:shadow-soft-sm hover:-translate-y-px"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Title row — full info on desktop, just the title on mobile. */}
                        <div className="flex items-center gap-2 md:mb-1 flex-wrap">
                          <Truncate className="text-[15px] font-bold text-foreground tracking-tight">{job.title}</Truncate>
                          <UBadge variant={statusBadgeVariant(job.status)} className="hidden md:inline-flex flex-shrink-0">
                            {t(`company.status.${job.status}`)}
                          </UBadge>
                          <span className={cn(
                            'hidden md:inline-flex items-center gap-1 text-[10.5px] font-extrabold px-1.5 py-0.5 rounded border flex-shrink-0',
                            isJobOwner
                              ? 'bg-primary-50 border-primary-200 text-primary-700'
                              : 'bg-gray-100 border-gray-200 text-gray-700'
                          )}>
                            {isJobOwner ? t('company.role.ownerJoined') : t('company.role.interviewerJoined')}
                          </span>
                        </div>
                        {/* Desktop secondary info */}
                        <div className="hidden md:block text-[12px] text-gray-900 font-semibold truncate">
                          {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M/tháng
                        </div>
                        <div className="hidden md:block text-[11px] text-gray-500 font-semibold mt-1 truncate">
                          {t('company.card.postedAt', { date: new Date(job.created_at).toLocaleDateString() })}
                        </div>
                        {/* Mobile minimal info — just total applicant count. */}
                        <div className="md:hidden flex items-center gap-1.5 mt-1 text-[12px] text-gray-600 font-bold">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span className="tabular-nums">{t('company.card.appliedCount', { n: stats.total })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Desktop stats + edit (mobile uses inline count above). */}
                        <div className="hidden md:flex gap-4">
                          <div className="text-center min-w-[44px]">
                            <div className="text-xl font-extrabold text-foreground tabular-nums leading-none">{stats.total}</div>
                            <div className="text-[10px] text-gray-500 font-extrabold uppercase tracking-[0.08em] mt-1.5">{t('company.stat.apps')}</div>
                          </div>
                          <div className="text-center min-w-[44px]">
                            <div className={cn('text-xl font-extrabold tabular-nums leading-none', stats.new > 0 ? 'text-primary-600' : 'text-gray-300')}>{stats.new || '—'}</div>
                            <div className={cn('text-[10px] font-extrabold uppercase tracking-[0.08em] mt-1.5', stats.new > 0 ? 'text-primary-600' : 'text-gray-300')}>{t('company.stat.new')}</div>
                          </div>
                        </div>
                        {/* Edit is owner-only — interviewers viewing this job from
                            the dashboard don't see the button. */}
                        {isJobOwner && (
                          <UButton
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); router.push(`/company/jobs/${job.id}/edit`); }}
                            className="hidden md:inline-flex"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {t('company.editBtn')}
                          </UButton>
                        )}
                      </div>
                    </div>
                  );
                };
                return ['active', 'inactive'].map(g => (
                  <section key={g} className={cn('mb-3 md:mb-6', g === 'inactive' && 'hidden md:block')}>
                    <h2 className={cn(
                      'text-[15px] font-extrabold text-gray-800 tracking-tight pl-3 mb-3 border-l-[3px] border-primary-500',
                      // Group header is redundant on mobile when only active is shown.
                      g === 'active' && 'hidden md:block'
                    )}>
                      {t(`company.jobGroup.${g}`, { n: grouped[g].length })}
                    </h2>
                    {grouped[g].length === 0 ? (
                      <div className="text-[13.5px] text-gray-400 font-medium px-3 py-2">
                        —
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {grouped[g].map(renderCard)}
                      </div>
                    )}
                  </section>
                ));
              })()}
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
    background: '#EA580C',
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
    background: '#EA580C',
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
  groupSection: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 },
  groupTitle: { fontSize: 14, fontWeight: 800, color: '#1A1A1A', margin: 0, padding: '4px 2px', borderLeft: '3px solid #EA580C', paddingLeft: 10 },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px', background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
  },
  cardLeft: { flex: 1, minWidth: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: '#1A1A1A' },
  cardMeta: { fontSize: 12.5, color: '#525252' },
  cardPosted: { fontSize: 11.5, color: '#94A3B8', fontWeight: 600, marginTop: 4 },
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
