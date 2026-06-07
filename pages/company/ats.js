import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import CandidateDetail, { MailComposer, RejectionModal, InterviewConfirmModal, ConfirmModal } from '../../components/company/CandidateDetail';
import { formatICT, ICT_LABEL } from '../../lib/timezone';
import { color, font, space, radius, shadow, motion } from '../../lib/theme';
import TeamPopover from '../../components/company/TeamPopover';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { MoreVertical, Calendar, Mail, Ban, Lock, Plus, Search as SearchIcon, X as XIcon, ArrowLeft, Inbox, MessageCircle, Handshake, PartyPopper } from 'lucide-react';

const STAGE_ICONS = {
  pending: Inbox,
  viewed: MessageCircle,
  reviewing: Handshake,
  decided: PartyPopper,
};
const STAGE_COLORS = {
  pending:   'text-gray-700 bg-gray-100',
  viewed:    'text-blue-700 bg-blue-50',
  reviewing: 'text-purple-700 bg-purple-50',
  decided:   'text-emerald-700 bg-emerald-50',
};

const STAGES = [
  { key: 'pending', emoji: '📥' },
  { key: 'viewed', emoji: '💬' },
  { key: 'reviewing', emoji: '🤝' },
  { key: 'decided', emoji: '🎉' },
];

const STAGE_ORDER = STAGES.map(s => s.key);
// 단계 전진 시 자동으로 띄울 메일 템플릿

export default function CompanyATSPage() {
  const router = useRouter();
  const { t } = useT();
  const { job: jobId } = router.query;

  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [job, setJob] = useState(null);
  const [apps, setApps] = useState([]);
  const [err, setErr] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [profileMap, setProfileMap] = useState({});
  const [query, setQuery] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [mailFor, setMailFor] = useState(null);
  const [showRejected, setShowRejected] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [rejectingApp, setRejectingApp] = useState(null);
  const [interviewApp, setInterviewApp] = useState(null);
  const [confirmCfg, setConfirmCfg] = useState(null);

  const askConfirm = (config) => new Promise(resolve => {
    setConfirmCfg({
      ...config,
      onConfirm: () => { setConfirmCfg(null); resolve(true); },
      onCancel: () => { setConfirmCfg(null); resolve(false); },
    });
  });
  const showAlert = (config) => new Promise(resolve => {
    setConfirmCfg({
      variant: 'alert',
      ...config,
      onConfirm: () => { setConfirmCfg(null); resolve(true); },
      onCancel: () => { setConfirmCfg(null); resolve(true); },
    });
  });

  useEffect(() => {
    if (!menuOpenId) return;
    const onDocClick = () => setMenuOpenId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpenId]);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setStatus('loading');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUser(session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!rec?.company_id) { setStatus('unauthed'); return; }
      setCompanyName(rec.recruiter_companies?.name || '');

      const { data: jobData, error: jobErr } = await supabase
        .from('jobs')
        .select('id, title, status, location, type, salary_min, salary_max, company_id, created_at, created_by')
        .eq('id', jobId)
        .eq('company_id', rec.company_id)
        .maybeSingle();
      if (jobErr || !jobData) {
        setErr(t('company.ats.notFound'));
        setStatus('error');
        return;
      }
      setJob(jobData);

      const { data: appsData, error: appsErr } = await supabase
        .from('job_applications')
        .select('id, status, applicant_name, applicant_email, applicant_salary, applicant_role, applicant_experience, applicant_company, resume_url, user_id, created_at, admin_note, interview_at, rejected_at, rejected_at_stage, rejection_reason')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (appsErr) { console.error('[ats] apps load error:', appsErr); setErr('지원자 로드 실패: ' + appsErr.message); }
      setApps(appsData || []);

      const userIds = [...new Set((appsData || []).map(a => a.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        const m = {};
        (profiles || []).forEach(p => { m[p.id] = p; });
        setProfileMap(m);
      }
      setStatus('ready');
    })();
  }, [jobId, t]);

  const setStage = async (appId, newStatus, resetInterview = false) => {
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus) return;
    const patch = { status: newStatus };
    if (resetInterview) {
      patch.interview_at = null;
      patch.interview_location = null;
      patch.interview_interviewer = null;
    }
    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...patch } : a));
    const { error } = await supabase.from('job_applications').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', appId);
    if (error) {
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: app.status, interview_at: app.interview_at, interview_location: app.interview_location, interview_interviewer: app.interview_interviewer } : a));
      setErr(t('company.err.stageChange') + error.message);
    }
  };

  const isOwner = !job?.created_by || job?.created_by === user?.id;

  // 카드를 다른 단계 컬럼에 드롭 — 정책:
  // (1) 같은 단계: 무시 (2) +2 이상 / -2 이상: 차단
  // (3) 정방향 +1: 합격 확인 → 인터뷰 일정 초기화 → 메일 모달
  // (4) 역방향 -1: 되돌리기 확인 → 인터뷰 일정 초기화 (메일 없음)
  const handleDrop = async (newStatus) => {
    const appId = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!appId) return;
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus) return;

    if (!isOwner) {
      await showAlert({
        title: t('company.ats.lockedDragTitle'),
        message: t('company.ats.lockedDrag'),
        tone: 'danger',
      });
      return;
    }

    const fromIdx = STAGE_ORDER.indexOf(app.status);
    const toIdx = STAGE_ORDER.indexOf(newStatus);
    const diff = toIdx - fromIdx;
    const fromLabel = t(`company.stage.${app.status}`);
    const toLabel = t(`company.stage.${newStatus}`);
    const hasInterview = !!app.interview_at && (app.status === 'viewed' || app.status === 'reviewing');

    if (diff > 0) {
      const ok = await askConfirm({
        title: t('company.ats.advanceTitle'),
        message: t('company.ats.advanceConfirmBasic', { from: fromLabel, to: toLabel }),
        confirmLabel: t('company.ats.advanceTitle'),
      });
      if (!ok) return;
      setStage(appId, newStatus, hasInterview);
      return;
    }

    if (diff < 0) {
      const msgKey = hasInterview ? 'company.ats.backConfirmWithInterview' : 'company.ats.backConfirmBasic';
      const ok = await askConfirm({
        title: t('company.ats.backTitle'),
        message: t(msgKey, { from: fromLabel, to: toLabel }),
        confirmLabel: t('company.ats.backTitle'),
      });
      if (!ok) return;
      setStage(appId, newStatus, hasInterview);
      return;
    }
  };

  const matchesQuery = (a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const profile = a.user_id ? profileMap[a.user_id] : null;
    return [a.applicant_name, a.applicant_email, a.applicant_role, a.applicant_company, profile?.full_name, profile?.email]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  };
  const visibleApps = apps.filter(a => showRejected || !a.rejected_at);
  const activeCount = apps.filter(a => !a.rejected_at).length;
  const rejectedCount = apps.length - activeCount;
  const grouped = STAGES.map(s => ({ ...s, apps: visibleApps.filter(a => a.status === s.key && matchesQuery(a)) }));

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
  if (status === 'error') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>{t('company.noAccess')}</h1>
          <p style={css.cardP}>{err}</p>
          <Link href="/company" style={css.btnPrimary}>{t('company.toDashboard')}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{job.title} · FYI</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" activeJobId={job.id} />

        <main className="px-8 py-7 pb-16 flex flex-col gap-6 min-w-0">
          {/* Header */}
          <header className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <Link href="/company" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors mb-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('company.backDashboard')}
              </Link>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">{job.title}</h1>
              <p className="text-sm text-gray-600 mt-2 font-medium">
                {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M
              </p>
              {/* KPI inline */}
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">진행중</div>
                  <div className="text-3xl font-black text-gray-900 leading-none mt-1 tabular-nums">{activeCount}</div>
                </div>
                <div className="h-10 w-px bg-gray-200" />
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">불합격</div>
                  <div className="text-3xl font-black text-gray-400 leading-none mt-1 tabular-nums">{rejectedCount}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center shrink-0">
              <TeamPopover jobId={job.id} canInvite={!job.created_by || job.created_by === user?.id} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/company/jobs/${job.id}/edit`}>{t('company.ats.editJob')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/company/jobs/new"><Plus className="h-4 w-4 mr-1" />{t('company.ats.newJob')}</Link>
              </Button>
            </div>
          </header>

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-semibold">{err}</div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('company.ats.searchPh')}
                className="pl-9 h-10"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="clear"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 px-3 h-10 bg-card border border-border rounded-lg text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={showRejected}
                onChange={(e) => setShowRejected(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span>{t('company.ats.showRejected')}</span>
              <Badge variant="secondary" className="ml-1">{rejectedCount}</Badge>
            </label>
            <span className="ml-auto text-xs text-gray-400 font-semibold flex items-center gap-1.5">
              {!isOwner && <Lock className="h-3 w-3" />}
              {isOwner ? t('company.ats.dragHint') : t('company.ats.dragHintLocked')}
            </span>
          </div>

          {/* Kanban */}
          <div className="grid grid-cols-4 gap-5 items-stretch" style={{ minHeight: 'calc(100vh - 320px)' }}>
            {grouped.map((col) => {
              const StageIcon = STAGE_ICONS[col.key];
              const isOver = dragOverCol === col.key;
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col.key) setDragOverCol(col.key); }}
                  onDrop={() => handleDrop(col.key)}
                  className={cn(
                    'rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-200',
                    isOver ? 'bg-primary-50 border-primary-300 shadow-soft-md' : 'bg-gray-50 border-gray-200'
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', STAGE_COLORS[col.key])}>
                      <StageIcon className="h-4 w-4" />
                    </div>
                    <span className="text-base font-extrabold text-gray-900 tracking-tight flex-1">{t(`company.stage.${col.key}`)}</span>
                    <span className="bg-card border border-border text-gray-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full min-w-[28px] text-center tabular-nums">{col.apps.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2.5">
                    {col.apps.length === 0 && (
                      <div className="text-center py-10 text-sm text-gray-400 font-semibold">
                        {isOver ? t('company.ats.dropHere') : '—'}
                      </div>
                    )}
                    {col.apps.map(app => {
                      const profile = app.user_id ? profileMap[app.user_id] : null;
                      const name = app.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
                      const showInterviewBadge = app.status === 'viewed' || app.status === 'reviewing';
                      const interviewWhen = app.interview_at
                        ? `${formatICT(app.interview_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} ${ICT_LABEL}`
                        : null;
                      const isRejected = !!app.rejected_at;
                      const canDrag = isOwner && !isRejected;
                      const appliedAt = new Date(app.created_at);
                      const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
                      const appliedMidnight = new Date(appliedAt); appliedMidnight.setHours(0, 0, 0, 0);
                      const daysAgo = Math.max(0, Math.round((todayMidnight.getTime() - appliedMidnight.getTime()) / 86400000));
                      const dateText = appliedAt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
                      const dateLabel = daysAgo === 0
                        ? t('company.ats.appliedToday', { date: dateText })
                        : t('company.ats.appliedDaysAgo', { date: dateText, n: daysAgo });
                      const urgencyClass = isRejected ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : daysAgo >= 8 ? 'bg-red-50 text-red-700 border-red-200'
                        : daysAgo >= 4 ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200';
                      const profileForMail = app.user_id ? profileMap[app.user_id] : null;
                      const email = app.applicant_email || profileForMail?.email || '';
                      const defaultTpl = app.status === 'pending' ? 'received'
                        : (app.status === 'viewed' || app.status === 'reviewing') ? 'interview'
                        : 'offer';

                      return (
                        <div
                          key={app.id}
                          draggable={canDrag}
                          onDragStart={() => canDrag && setDraggingId(app.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                          onClick={() => setSelectedAppId(app.id)}
                          className={cn(
                            'relative rounded-xl border p-4 flex flex-col gap-2 cursor-pointer transition-all duration-200 ease-spring',
                            'bg-card border-border shadow-soft-sm hover:shadow-soft-md hover:-translate-y-0.5',
                            selectedAppId === app.id && 'bg-primary-50 border-primary-400 shadow-brand -translate-y-0.5',
                            draggingId === app.id && 'opacity-40 shadow-none',
                            isRejected && 'bg-gray-50 border-dashed border-gray-300 opacity-70 shadow-none hover:translate-y-0',
                            canDrag && !selectedAppId && 'active:cursor-grabbing'
                          )}
                        >
                          {/* Kebab */}
                          {!isRejected && (
                            <div className="absolute top-2.5 right-2.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 grid place-items-center transition-colors"
                                    aria-label="more"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  {isOwner && showInterviewBadge && (
                                    <DropdownMenuItem onClick={() => { setInterviewApp(app); }}>
                                      <Calendar className="h-4 w-4 text-blue-600" />
                                      {interviewWhen ? t('company.kebab.interviewEdit') : t('company.kebab.interviewSet')}
                                    </DropdownMenuItem>
                                  )}
                                  {isOwner && email && (
                                    <DropdownMenuItem onClick={() => setMailFor({ app, profile: profileForMail, email, templateKey: defaultTpl, stageLabel: t(`company.stage.${app.status}`) })}>
                                      <Mail className="h-4 w-4 text-emerald-600" />
                                      {t('company.kebab.composeMail')}
                                    </DropdownMenuItem>
                                  )}
                                  {isOwner ? (
                                    <DropdownMenuItem tone="danger" onClick={() => setRejectingApp(app)}>
                                      <Ban className="h-4 w-4" />
                                      {t('company.kebab.reject')}
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem disabled>
                                      <Lock className="h-4 w-4 text-gray-400" />
                                      {t('company.kebab.rejectLocked')}
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}

                          {/* Date pill */}
                          <div className={cn('self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border', urgencyClass)}>
                            <Calendar className="h-3 w-3" />
                            {dateLabel.replace('📅 ', '')}
                          </div>

                          {/* Name row */}
                          <div className="flex items-center justify-between gap-2 pr-6">
                            <span className="text-base font-extrabold text-gray-900 tracking-tight leading-tight truncate">{name}</span>
                            {isRejected && (
                              <span className="text-xs font-extrabold text-red-600 shrink-0 inline-flex items-center gap-1">
                                <Ban className="h-3 w-3" />
                                {t('company.ats.rejectedBadge')}
                              </span>
                            )}
                          </div>

                          {/* Meta */}
                          {app.applicant_role && (
                            <div className="text-sm text-gray-600 font-medium">
                              {app.applicant_role} · {app.applicant_experience || 0}{t('company.years')}
                            </div>
                          )}
                          {app.applicant_salary && (
                            <div className="text-sm text-emerald-600 font-bold">
                              {t('company.ats.wishSalary', { n: Math.round(app.applicant_salary/1e6) })}
                            </div>
                          )}

                          {/* Interview badge */}
                          {!isRejected && showInterviewBadge && (
                            <button
                              onClick={(e) => { if (isOwner) { e.stopPropagation(); setInterviewApp(app); } }}
                              disabled={!isOwner}
                              className={cn(
                                'mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border w-full',
                                interviewWhen
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700',
                                isOwner && 'cursor-pointer hover:opacity-80 transition-opacity'
                              )}
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              {interviewWhen ? t('company.ats.interviewSet', { when: interviewWhen }) : t('company.ats.interviewPending')}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {selectedAppId && (
          <div style={localCss.overlay} onClick={() => setSelectedAppId(null)}>
            <div style={localCss.panel} onClick={(e) => e.stopPropagation()}>
              <CandidateDetail
                appId={selectedAppId}
                mode="overlay"
                companyId={job.company_id}
                onClose={() => setSelectedAppId(null)}
                onStageChange={(id, patch) => setApps(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))}
              />
            </div>
          </div>
        )}

        {rejectingApp && (() => {
          const profile = rejectingApp.user_id ? profileMap[rejectingApp.user_id] : null;
          const name = rejectingApp.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${rejectingApp.id.slice(-6).toUpperCase()}`;
          const email = rejectingApp.applicant_email || profile?.email || '';
          return (
            <RejectionModal
              app={rejectingApp}
              stageKey={rejectingApp.status}
              candidateName={name}
              mode="new"
              onClose={() => setRejectingApp(null)}
              onSaved={(payload) => {
                setApps(prev => prev.map(a => a.id === rejectingApp.id ? { ...a, ...payload } : a));
                setRejectingApp(null);
              }}
            />
          );
        })()}

        {confirmCfg && <ConfirmModal {...confirmCfg} />}

        {interviewApp && (
          <InterviewConfirmModal
            app={interviewApp}
            onClose={() => setInterviewApp(null)}
            onSaved={(payload) => {
              setApps(prev => prev.map(a => a.id === interviewApp.id ? { ...a, ...payload } : a));
              setInterviewApp(null);
            }}
          />
        )}

        {mailFor && (
          <MailComposer
            candidateName={mailFor.app.applicant_name || mailFor.profile?.full_name || `${t('company.candidatePrefix')}${mailFor.app.id.slice(-6).toUpperCase()}`}
            candidateEmail={mailFor.email}
            jobTitle={job.title}
            companyName={companyName}
            companyId={job?.company_id}
            applicationId={mailFor.app.id}
            stage={mailFor.stage || mailFor.app.status}
            stageNote={t('company.ats.stageNote', { stage: mailFor.stageLabel })}
            onClose={() => setMailFor(null)}
            onSent={() => setMailFor(null)}
          />
        )}
      </div>
    </>
  );
}

const localCss = {
  crumb: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  crumbLink: { color: '#525252', textDecoration: 'none' },

  // ── Kanban ──
  kanban: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: space[5], alignItems: 'stretch', minHeight: 'calc(100vh - 240px)' },
  col: { background: color.gray[50], border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: space[5], display: 'flex', flexDirection: 'column', gap: space[3] },
  colOver: { background: color.primary[50], borderColor: color.primary[400], boxShadow: shadow.md },
  colHead: { display: 'flex', alignItems: 'center', gap: space[2], padding: `${space[1]}px ${space[2]}px ${space[3]}px`, borderBottom: `1px solid ${color.border}` },
  colEmoji: { fontSize: font.size.lg },
  colLabel: { fontSize: font.size.lg, fontWeight: font.weight.extra, color: color.textHi, letterSpacing: font.letterSpacing.tight },
  colCount: { marginLeft: 'auto', background: color.surface, color: color.text, fontSize: font.size.sm, fontWeight: font.weight.extra, padding: `3px ${space[3]}px`, borderRadius: radius.full, border: `1px solid ${color.border}`, minWidth: 28, textAlign: 'center' },
  colBody: { display: 'flex', flexDirection: 'column', gap: space[2] },
  colEmpty: { fontSize: font.size.sm, color: color.textMute, textAlign: 'center', padding: `${space[6]}px 0`, fontWeight: font.weight.medium },

  // ── Card (흰색 카드가 회색 컬럼 위에 떠 있는 느낌) ──
  card: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space[4], display: 'flex', flexDirection: 'column', gap: space[2], cursor: 'grab', transition: motion.base, textDecoration: 'none', boxShadow: shadow.sm },
  cardActive: { background: color.primary[50], border: `1.5px solid ${color.primary[400]}`, boxShadow: shadow.brand, transform: 'translateY(-2px)' },
  cardDragging: { opacity: 0.4, boxShadow: 'none' },
  cardRejected: { background: color.gray[50], border: `1px dashed ${color.gray[300]}`, opacity: 0.7, cursor: 'pointer', boxShadow: 'none' },

  cardName: { fontSize: font.size.lg, fontWeight: font.weight.extra, color: color.textHi, letterSpacing: font.letterSpacing.tight, lineHeight: font.lineHeight.tight },
  cardMeta: { fontSize: font.size.sm, color: color.textSub, fontWeight: font.weight.medium },
  cardSalary: { fontSize: font.size.sm, color: color.success.fg, fontWeight: font.weight.semi },
  nameRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  rejectedInline: { fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.danger.fg, flexShrink: 0 },

  // ── Card pill: 지원 경과일 ──
  applyDateLow:  { alignSelf: 'flex-start', padding: `3px ${space[2]}px`, borderRadius: radius.full, background: color.gray[100], border: `1px solid ${color.border}`, color: color.gray[700], fontSize: font.size.xs, fontWeight: font.weight.bold, marginBottom: space[1] },
  applyDateMid:  { alignSelf: 'flex-start', padding: `3px ${space[2]}px`, borderRadius: radius.full, background: color.warning.bg, border: `1px solid ${color.warning.border}`, color: color.warning.fg, fontSize: font.size.xs, fontWeight: font.weight.extra, marginBottom: space[1] },
  applyDateHigh: { alignSelf: 'flex-start', padding: `3px ${space[2]}px`, borderRadius: radius.full, background: color.danger.bg, border: `1px solid ${color.danger.border}`, color: color.danger.fg, fontSize: font.size.xs, fontWeight: font.weight.extra, marginBottom: space[1] },

  // ── Card: 인터뷰 뱃지 ──
  interviewSet:     { marginTop: space[1], padding: `${space[2]}px ${space[3]}px`, background: color.success.bg, border: `1px solid ${color.success.border}`, borderRadius: radius.md, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.success.fg },
  interviewPending: { marginTop: space[1], padding: `${space[2]}px ${space[3]}px`, background: color.warning.bg, border: `1px solid ${color.warning.border}`, borderRadius: radius.md, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.warning.fg },

  // ── Toolbar ──
  toolbar: { display: 'flex', alignItems: 'center', gap: space[2] },
  search: { flex: '0 1 320px', padding: `${space[3]}px ${space[4]}px`, border: `1px solid ${color.border}`, borderRadius: radius.md, fontSize: font.size.base, color: color.text, fontFamily: 'inherit', outline: 'none', background: color.surface, transition: motion.base },
  searchClear: { padding: `${space[2]}px ${space[3]}px`, border: `1px solid ${color.border}`, borderRadius: radius.md, background: color.surface, color: color.textSub, fontSize: font.size.sm, fontWeight: font.weight.semi, cursor: 'pointer', fontFamily: 'inherit', transition: motion.base },
  dragHint: { marginLeft: 'auto', fontSize: font.size.sm, color: color.textMute, fontWeight: font.weight.medium },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: space[2], fontSize: font.size.sm, color: color.text, fontWeight: font.weight.semi, cursor: 'pointer', padding: `${space[2]}px ${space[3]}px`, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, transition: motion.base },

  // ── Header buttons ──
  btnNewJob: { padding: `${space[3]}px ${space[6]}px`, borderRadius: radius.md, background: `linear-gradient(135deg, ${color.primary[400]}, ${color.primary[600]})`, color: color.white, fontSize: font.size.base, fontWeight: font.weight.extra, textDecoration: 'none', boxShadow: shadow.brand, display: 'inline-flex', alignItems: 'center', transition: motion.base, letterSpacing: font.letterSpacing.tight },

  // ── Candidate detail overlay ──
  overlay: { position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.45)', backdropFilter: 'blur(2px)', zIndex: 50 },
  panel: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, background: color.bg, borderRadius: radius['2xl'], overflow: 'hidden', boxShadow: shadow.xl, display: 'flex', flexDirection: 'column' },

  // ── Kebab menu ──
  kebabWrap: { position: 'absolute', top: 8, right: 8 },
  kebabBtn: { width: 28, height: 28, borderRadius: radius.md, border: 'none', background: 'transparent', color: color.textMute, fontSize: 18, fontWeight: font.weight.extra, cursor: 'pointer', lineHeight: 1, display: 'grid', placeItems: 'center', fontFamily: 'inherit', transition: motion.base },
  kebabMenu: { position: 'absolute', top: 34, right: 0, minWidth: 220, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, boxShadow: shadow.lg, padding: space[2], zIndex: 30, display: 'flex', flexDirection: 'column', gap: 2 },
  kebabItem:        { display: 'flex', alignItems: 'center', gap: space[3], padding: `${space[3]}px ${space[3]}px`, width: '100%', border: 'none', background: 'transparent', color: color.danger.fg, cursor: 'pointer', textAlign: 'left', borderRadius: radius.md, fontFamily: 'inherit', transition: motion.base },
  kebabItemNeutral: { display: 'flex', alignItems: 'center', gap: space[3], padding: `${space[3]}px ${space[3]}px`, width: '100%', border: 'none', background: 'transparent', color: color.text, cursor: 'pointer', textAlign: 'left', borderRadius: radius.md, fontFamily: 'inherit', transition: motion.base },
  kebabItemLocked:  { display: 'flex', alignItems: 'center', gap: space[3], padding: `${space[3]}px ${space[3]}px`, width: '100%', border: 'none', background: color.gray[50], color: color.textMute, cursor: 'not-allowed', textAlign: 'left', borderRadius: radius.md, fontFamily: 'inherit' },
  kebabIcon: { width: 18, fontSize: font.size.md, lineHeight: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit' },
  kebabText: { fontSize: font.size.base, fontWeight: font.weight.semi, lineHeight: 1.4, flex: 1, fontFamily: 'inherit' },
};
