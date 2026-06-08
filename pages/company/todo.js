import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/cn';
import { PageHeader } from '../../components/ui/page-header';
import { Skeleton } from '../../components/ui/skeleton';
import MobileNav from '../../components/company/MobileNav';
import Truncate from '../../components/ui/truncate';
import { nextActionFor } from '../../lib/smart-hint';
import { CheckSquare, Star, Calendar, Mail, Check, Ban, ChevronRight } from 'lucide-react';

// Map action kind → icon so the row visual matches the meaning at a glance.
const KIND_ICON = {
  evaluate: Star,
  decide: Check,
  advance: ChevronRight,
  schedule: Calendar,
  send_interview_mail: Mail,
  send_pass_mail: Mail,
  send_offer_mail: Mail,
  send_reject_mail: Mail,
  follow_up: Check,
};

// Map action kind → button label key so the CTA names the actual verb
// (예: "평가하기", "메일 보내기") instead of a generic "처리하기".
// Policy: UI 라벨에는 "처리" 단어를 쓰지 않고 액션 동사를 직접 노출한다.
const KIND_LABEL_KEY = {
  evaluate: 'company.todo.go.evaluate',
  decide: 'company.todo.go.decide',
  advance: 'company.todo.go.advance',
  schedule: 'company.todo.go.schedule',
  await_interview: 'company.todo.go.awaitInterview',
  send_interview_mail: 'company.todo.go.sendMail',
  send_pass_mail: 'company.todo.go.sendMail',
  send_offer_mail: 'company.todo.go.sendMail',
  send_reject_mail: 'company.todo.go.sendMail',
  follow_up: 'company.todo.go.followUp',
};

const TONE_CLASS = {
  primary: 'text-primary-700 bg-primary-50 border-primary-200',
  green:   'text-green-700  bg-green-50  border-green-200',
  red:     'text-red-700    bg-red-50    border-red-200',
  gray:    'text-gray-700   bg-gray-100  border-gray-200',
};

// Tone → mobile card left-edge color. Heavier accent on primary/red so urgent
// items pop, neutral on green/gray. Used only on the touch-friendly mobile card.
const TONE_BORDER_L = {
  primary: 'border-l-primary-500',
  green:   'border-l-green-500',
  red:     'border-l-red-500',
  gray:    'border-l-gray-300',
};

export default function CompanyTodoPage() {
  const router = useRouter();
  const { t } = useT();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [items, setItems] = useState([]); // [{ job, candidate, action }]
  const [profileMap, setProfileMap] = useState({});

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
      setCompanyName(rec.recruiter_companies?.name || '');

      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, status, created_by')
        .eq('company_id', rec.company_id)
        .neq('status', 'closed');
      const jobMap = {};
      (jobs || []).forEach(j => { jobMap[j.id] = j; });

      const jobIds = (jobs || []).map(j => j.id);
      if (jobIds.length === 0) { setItems([]); setStatus('ready'); return; }

      const { data: apps } = await supabase
        .from('job_applications')
        .select('id, job_id, status, applicant_name, applicant_email, applicant_role, user_id, interview_at, rejected_at, created_at')
        .in('job_id', jobIds);

      const appIds = (apps || []).map(a => a.id);
      let evalsByApp = {};
      let mailsByApp = {};
      if (appIds.length > 0) {
        const { data: evals } = await supabase
          .from('application_evaluations')
          .select('application_id, stage')
          .in('application_id', appIds);
        (evals || []).forEach(e => {
          if (!evalsByApp[e.application_id]) evalsByApp[e.application_id] = [];
          evalsByApp[e.application_id].push(e);
        });
        const { data: mails } = await supabase
          .from('recruiter_mail_log')
          .select('application_id, template_key')
          .in('application_id', appIds);
        (mails || []).forEach(m => {
          if (!mailsByApp[m.application_id]) mailsByApp[m.application_id] = [];
          mailsByApp[m.application_id].push(m);
        });
      }

      // Fetch linked user_profiles for nicer applicant names.
      const userIds = [...new Set((apps || []).map(a => a.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        const pm = {};
        (profiles || []).forEach(p => { pm[p.id] = p; });
        setProfileMap(pm);
      }

      const list = [];
      for (const app of (apps || [])) {
        const job = jobMap[app.job_id];
        if (!job) continue;
        const isOwner = job.created_by === session.user.id;
        const action = nextActionFor({
          app,
          evals: evalsByApp[app.id] || [],
          mailLog: mailsByApp[app.id] || [],
          isOwner,
          t,
        });
        if (!action) continue;
        list.push({ job, candidate: app, action, isOwner });
      }
      // Order: oldest application first inside each job — gives the longest-waiting first.
      list.sort((a, b) => new Date(a.candidate.created_at) - new Date(b.candidate.created_at));
      setItems(list);
      setStatus('ready');
    })();
    // Re-run when lang changes so Smart Hint titles (resolved inside nextActionFor)
    // pick up the new language. `t` is memoized per-lang in useT.
  }, [t]);

  // Route based on action kind:
  // - 'advance' (다음 전형으로 넘기세요) → kanban only, so the user can drag.
  // - everything else → kanban + auto-open the candidate panel.
  // `from=todo` lets the ATS page (and the mobile candidate detail route) know
  // to return here on close instead of leaving the user stranded on the kanban.
  const openAction = (jobId, appId, kind) => {
    if (kind === 'advance') router.push(`/company/ats?job=${jobId}&from=todo`);
    else router.push(`/company/ats?job=${jobId}&app=${appId}&from=todo`);
  };

  // Group items by job for the feed.
  const byJob = items.reduce((acc, it) => {
    if (!acc[it.job.id]) acc[it.job.id] = { job: it.job, items: [] };
    acc[it.job.id].items.push(it);
    return acc;
  }, {});
  const jobIdsSorted = Object.keys(byJob);

  if (status === 'loading') {
    return (
      <div style={css.app}>
        <Sidebar companyName="" userEmail="" activePage="todo" />
        <main style={css.main}>
          <div className="space-y-2 mb-3 pb-3 border-b border-border">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-[480px] rounded-xl" />
        </main>
      </div>
    );
  }
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
      <Head><title>{t('company.todo.h')} · FYI</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="todo" />

        <main style={css.main} className="!pb-10">
          <MobileNav active="todo" companyName={companyName} userEmail={user?.email} />
          {/* PageHeader hides on mobile — MobileNav already labels the page. */}
          <div className="hidden md:block">
            <PageHeader
              title={(
                <span className="flex items-center gap-2.5">
                  <CheckSquare className="w-5 h-5 text-primary-600" />
                  {t('company.todo.h')}
                  {items.length > 0 && (
                    <span className="inline-flex items-center min-w-[28px] h-[22px] px-2 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-[12px] font-extrabold tabular-nums">
                      {t('company.todo.count', { n: items.length })}
                    </span>
                  )}
                </span>
              )}
              subtitle={t('company.todo.sub')}
            />
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <div className="text-[15px] font-extrabold text-gray-800 mb-1">{t('company.todo.empty')}</div>
              <div className="text-[13px] text-gray-500">{t('company.todo.allClear')}</div>
            </div>
          ) : (
            <div className="flex flex-col">
              {jobIdsSorted.map((jid, sIdx) => {
                const { job, items: jobItems } = byJob[jid];
                return (
                  <section
                    key={jid}
                    className={cn(
                      'flex flex-col gap-2 py-3 md:py-5',
                      // First section has no top padding on mobile so it hugs the
                      // top nav like the dashboard does.
                      sIdx === 0 && 'pt-0 md:pt-5',
                      sIdx > 0 && 'border-t border-gray-300'
                    )}
                  >
                    <header className="flex items-center gap-2 mb-1">
                      <h2 className="text-[15px] font-extrabold text-gray-900 tracking-tight">{job.title}</h2>
                      <span className="inline-flex items-center min-w-[30px] h-[20px] px-2 rounded-full bg-gray-900 text-white text-[10.5px] font-extrabold tabular-nums">
                        {t('company.todo.count', { n: jobItems.length })}
                      </span>
                      <Link
                        href={`/company/ats?job=${jid}`}
                        className="hidden md:inline-block ml-auto text-[12px] font-bold text-primary-700 hover:text-primary-900 underline underline-offset-2"
                      >
                        {t('company.todo.openJob')}
                      </Link>
                    </header>
                    {/* Mobile: separate touch-friendly cards with tone-colored left edge + press feedback.
                        Desktop: traditional divided list for dense scanning. */}
                    <div className="flex flex-col gap-2 md:gap-0 md:rounded-xl md:border md:border-border md:bg-white md:overflow-hidden md:divide-y md:divide-border">
                      {jobItems.map(({ candidate, action, isOwner }) => {
                        const Icon = KIND_ICON[action.kind] || Star;
                        const profile = candidate.user_id ? profileMap[candidate.user_id] : null;
                        const name = candidate.applicant_name || profile?.full_name || `지원자 ${candidate.id.slice(-6).toUpperCase()}`;
                        // Use t() directly so the chip respects the language
                        // setting — STAGE_LABEL_KO was hardcoded Korean and
                        // shadowed the en/vi translations.
                        const stageLabel = t(`company.stage.${action.stage}`) || action.stage;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => openAction(job.id, candidate.id, action.kind)}
                            className={cn(
                              'w-full flex items-center gap-3 text-left transition-all',
                              // Mobile: subtle card — radius + soft border + tap shrink (no tone-color edge)
                              'bg-white rounded-xl border border-border px-4 py-3.5 shadow-soft-xs active:scale-[0.98] active:bg-gray-50',
                              // Desktop: revert to flat list row inside the wrapper
                              'md:rounded-none md:border-0 md:shadow-none md:px-4 md:py-3 md:hover:bg-gray-50 md:active:scale-100'
                            )}
                          >
                            {/* Action-kind icon — hidden on mobile to give text full width. */}
                            <span className={cn(
                              'hidden md:grid w-8 h-8 rounded-md place-items-center flex-shrink-0 border',
                              TONE_CLASS[action.tone] || TONE_CLASS.gray
                            )}>
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <Truncate className="text-[13.5px] font-extrabold text-gray-900" stopPropagation={false}>{name}</Truncate>
                                <span className="hidden md:inline-flex text-[10.5px] font-extrabold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-700">
                                  {stageLabel}
                                </span>
                                <span className={cn(
                                  'hidden md:inline-flex text-[10.5px] font-extrabold px-1.5 py-0.5 rounded border',
                                  isOwner
                                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                                    : 'bg-gray-100 border-gray-200 text-gray-700'
                                )}>
                                  {isOwner ? t('company.todo.roleOwner') : t('company.todo.roleInterviewer')}
                                </span>
                              </div>
                              <Truncate as="div" className="text-[13px] text-gray-700 font-semibold" stopPropagation={false}>{action.title}</Truncate>
                            </div>
                            {/* Mobile: just a chevron as a tap affordance. Desktop: full action-verb button. */}
                            <ChevronRight className="md:hidden w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="hidden md:inline-flex items-center gap-1 h-8 px-3 rounded-md border border-gray-200 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
                              {t(KIND_LABEL_KEY[action.kind] || 'company.todo.go')}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
