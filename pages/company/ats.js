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

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <div style={localCss.crumb}><Link href="/company" style={localCss.crumbLink}>{t('company.backDashboard')}</Link></div>
              <h1 style={css.mainH}>{job.title}</h1>
              <p style={css.mainP}>
                {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M · {t('company.ats.countSplit', { active: activeCount, rejected: rejectedCount })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <TeamPopover jobId={job.id} canInvite={!job.created_by || job.created_by === user?.id} />
              <Link href={`/company/jobs/${job.id}/edit`} style={css.btnGhost}>{t('company.ats.editJob')}</Link>
              <Link href="/company/jobs/new" style={localCss.btnNewJob}>{t('company.ats.newJob')}</Link>
            </div>
          </header>

          {err && <div style={css.err}>{err}</div>}

          <div style={localCss.toolbar}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('company.ats.searchPh')}
              style={localCss.search}
            />
            {query && <button onClick={() => setQuery('')} style={localCss.searchClear}>{t('company.clear')}</button>}
            <label style={localCss.toggleLabel}>
              <input
                type="checkbox"
                checked={showRejected}
                onChange={(e) => setShowRejected(e.target.checked)}
              />
              <span>{t('company.ats.showRejected')} ({rejectedCount})</span>
            </label>
            <span style={localCss.dragHint}>{isOwner ? t('company.ats.dragHint') : t('company.ats.dragHintLocked')}</span>
          </div>

          <div style={localCss.kanban}>
            {grouped.map((col) => (
              <div
                key={col.key}
                style={{...localCss.col, ...(dragOverCol === col.key ? localCss.colOver : {})}}
                onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col.key) setDragOverCol(col.key); }}
                onDrop={() => handleDrop(col.key)}
              >
                <div style={localCss.colHead}>
                  <span style={localCss.colEmoji}>{col.emoji}</span>
                  <span style={localCss.colLabel}>{t(`company.stage.${col.key}`)}</span>
                  <span style={localCss.colCount}>{col.apps.length}</span>
                </div>
                <div style={localCss.colBody}>
                  {col.apps.length === 0 && <div style={localCss.colEmpty}>{dragOverCol === col.key ? t('company.ats.dropHere') : '—'}</div>}
                  {col.apps.map(app => {
                    const profile = app.user_id ? profileMap[app.user_id] : null;
                    const name = app.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
                    const showInterviewBadge = app.status === 'viewed' || app.status === 'reviewing';
                    const interviewWhen = app.interview_at
                      ? `${formatICT(app.interview_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} ${ICT_LABEL}`
                      : null;
                    const isRejected = !!app.rejected_at;
                    const canDrag = isOwner && !isRejected;
                    const menuOpen = menuOpenId === app.id;
                    const appliedAt = new Date(app.created_at);
                    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
                    const appliedMidnight = new Date(appliedAt); appliedMidnight.setHours(0, 0, 0, 0);
                    const daysAgo = Math.max(0, Math.round((todayMidnight.getTime() - appliedMidnight.getTime()) / 86400000));
                    const dateText = appliedAt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
                    const dateLabel = daysAgo === 0
                      ? t('company.ats.appliedToday', { date: dateText })
                      : t('company.ats.appliedDaysAgo', { date: dateText, n: daysAgo });
                    const urgencyStyle = isRejected
                      ? localCss.applyDateLow
                      : (daysAgo >= 8 ? localCss.applyDateHigh : daysAgo >= 4 ? localCss.applyDateMid : localCss.applyDateLow);
                    return (
                      <div
                        key={app.id}
                        draggable={canDrag}
                        onDragStart={() => canDrag && setDraggingId(app.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                        onClick={() => setSelectedAppId(app.id)}
                        style={{
                          ...localCss.card,
                          ...(selectedAppId === app.id ? localCss.cardActive : {}),
                          ...(draggingId === app.id ? localCss.cardDragging : {}),
                          ...(isRejected ? localCss.cardRejected : {}),
                          position: 'relative',
                        }}
                      >
                        {!isRejected && (
                          <div style={localCss.kebabWrap}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpen ? null : app.id); }}
                              style={localCss.kebabBtn}
                              title="더보기"
                            >⋮</button>
                            {menuOpen && (
                              <div style={localCss.kebabMenu} onClick={(e) => e.stopPropagation()}>
                                {isOwner && showInterviewBadge && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setInterviewApp(app); setMenuOpenId(null); }}
                                    style={localCss.kebabItemNeutral}
                                  >
                                    <span style={localCss.kebabIcon}>📅</span>
                                    <span style={localCss.kebabText}>{interviewWhen ? t('company.kebab.interviewEdit') : t('company.kebab.interviewSet')}</span>
                                  </button>
                                )}
                                {isOwner && (() => {
                                  const profile = app.user_id ? profileMap[app.user_id] : null;
                                  const email = app.applicant_email || profile?.email || '';
                                  if (!email) return null;
                                  const defaultTpl = app.status === 'pending' ? 'received'
                                    : (app.status === 'viewed' || app.status === 'reviewing') ? 'interview'
                                    : 'offer';
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMailFor({ app, profile, email, templateKey: defaultTpl, stageLabel: t(`company.stage.${app.status}`) });
                                        setMenuOpenId(null);
                                      }}
                                      style={localCss.kebabItemNeutral}
                                    >
                                      <span style={localCss.kebabIcon}>✉</span>
                                      <span style={localCss.kebabText}>{t('company.kebab.composeMail')}</span>
                                    </button>
                                  );
                                })()}
                                {isOwner ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRejectingApp(app); setMenuOpenId(null); }}
                                    style={localCss.kebabItem}
                                  >
                                    <span style={localCss.kebabIcon}>🚫</span>
                                    <span style={localCss.kebabText}>{t('company.kebab.reject')}</span>
                                  </button>
                                ) : (
                                  <button disabled style={localCss.kebabItemLocked}>
                                    <span style={localCss.kebabIcon}>🔒</span>
                                    <span style={localCss.kebabText}>{t('company.kebab.rejectLocked')}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={urgencyStyle}>{dateLabel}</div>
                        <div style={localCss.nameRow}>
                          <span style={localCss.cardName}>{name}</span>
                          {isRejected && <span style={localCss.rejectedInline}>🚫 {t('company.ats.rejectedBadge')}</span>}
                        </div>
                        {app.applicant_role && <div style={localCss.cardMeta}>{app.applicant_role} · {app.applicant_experience || 0}{t('company.years')}</div>}
                        {app.applicant_salary && <div style={localCss.cardSalary}>{t('company.ats.wishSalary', { n: Math.round(app.applicant_salary/1e6) })}</div>}
                        {!isRejected && showInterviewBadge && (
                          <div
                            style={{
                              ...(interviewWhen ? localCss.interviewSet : localCss.interviewPending),
                              ...(isOwner ? { cursor: 'pointer' } : {}),
                            }}
                            onClick={(e) => { if (isOwner) { e.stopPropagation(); setInterviewApp(app); } }}
                            title={isOwner ? (interviewWhen ? '클릭하여 일정 수정' : '클릭하여 일정 확정') : undefined}
                          >
                            {interviewWhen ? t('company.ats.interviewSet', { when: interviewWhen }) : t('company.ats.interviewPending')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
