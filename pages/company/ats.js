import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import CandidateDetail, { MailComposer, RejectionModal, InterviewConfirmModal } from '../../components/company/CandidateDetail';
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
const STAGE_MAIL = { viewed: 'interview', reviewing: 'interview', decided: 'offer' };

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

  // 카드를 다른 단계 컬럼에 드롭 — 단계 변경 후, 전진 이동이면 메일 작성창을 띄움
  const handleDrop = (newStatus) => {
    const appId = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!appId) return;
    if (!isOwner) { setErr(t('company.ats.lockedDrag')); return; }
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus) return;
    const forward = STAGE_ORDER.indexOf(newStatus) > STAGE_ORDER.indexOf(app.status);
    // 인터뷰 일정 확정된 상태에서 전진 이동 시 합격 확인
    const hasInterview = !!app.interview_at && (app.status === 'viewed' || app.status === 'reviewing');
    if (forward && hasInterview) {
      const ok = window.confirm(t('company.ats.advanceConfirm', {
        from: t(`company.stage.${app.status}`),
        to: t(`company.stage.${newStatus}`),
      }));
      if (!ok) return;
    }
    setStage(appId, newStatus, forward && hasInterview);
    const profile = app.user_id ? profileMap[app.user_id] : null;
    const email = app.applicant_email || profile?.email || '';
    if (forward && STAGE_MAIL[newStatus] && email) {
      setMailFor({
        app, profile, email,
        templateKey: STAGE_MAIL[newStatus],
        stageLabel: t(`company.stage.${newStatus}`),
      });
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
                      ? new Date(app.interview_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
                                  >{interviewWhen ? t('company.interview.confirmEditBtn') : t('company.interview.confirmBtn')}</button>
                                )}
                                {isOwner ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRejectingApp(app); setMenuOpenId(null); }}
                                    style={localCss.kebabItem}
                                  >{t('company.reject.btn')}</button>
                                ) : (
                                  <button disabled style={localCss.kebabItemLocked}>
                                    {t('company.reject.btnLocked')}
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
              onSavedAndMail={(payload) => {
                setApps(prev => prev.map(a => a.id === rejectingApp.id ? { ...a, ...payload } : a));
                setRejectingApp(null);
                if (email) {
                  setMailFor({
                    app: { ...rejectingApp, ...payload }, profile, email,
                    templateKey: 'reject',
                    stageLabel: t(`company.stage.${rejectingApp.status}`),
                  });
                }
              }}
            />
          );
        })()}

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
            applicationId={mailFor.app.id}
            initialTemplateKey={mailFor.templateKey}
            withSlots={mailFor.templateKey === 'interview'}
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

  kanban: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'stretch', minHeight: 'calc(100vh - 240px)' },
  col: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  colHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 12px', borderBottom: '1px solid #E5E7EB' },
  colEmoji: { fontSize: 14 },
  colLabel: { fontSize: 13, fontWeight: 800, color: '#1A1A1A' },
  colCount: { marginLeft: 'auto', background: '#F1F5F9', color: '#525252', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999 },
  colBody: { display: 'flex', flexDirection: 'column', gap: 8 },
  colEmpty: { fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '24px 0' },

  card: { background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'grab', transition: 'all 0.15s', textDecoration: 'none' },
  cardActive: { background: '#FFF7ED', border: '1.5px solid #FCA5A5', boxShadow: '0 4px 12px rgba(234,88,12,0.12)' },
  cardDragging: { opacity: 0.4 },

  toolbar: { display: 'flex', alignItems: 'center', gap: 8 },
  search: { flex: '0 1 320px', padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none' },
  searchClear: { padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', color: '#525252', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  dragHint: { marginLeft: 'auto', fontSize: 11.5, color: '#94A3B8', fontWeight: 600 },
  colOver: { background: '#FFF7ED', borderColor: '#FCA5A5' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50 },
  panel: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, background: '#FAFAFA', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' },
  cardName: { fontSize: 13.5, fontWeight: 800, color: '#1A1A1A' },
  cardMeta: { fontSize: 11.5, color: '#525252' },
  cardSalary: { fontSize: 11.5, color: '#059669', fontWeight: 600 },
  applyDateLow: { alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 999, background: '#F1F5F9', border: '1px solid #E5E7EB', color: '#475569', fontSize: 10.5, fontWeight: 700, marginBottom: 2 },
  applyDateMid: { alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 999, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#C2410C', fontSize: 10.5, fontWeight: 800, marginBottom: 2 },
  applyDateHigh: { alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 999, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: 10.5, fontWeight: 800, marginBottom: 2 },
  interviewSet: { marginTop: 4, padding: '6px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#047857' },
  interviewPending: { marginTop: 4, padding: '6px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#B45309' },

  cardRejected: { background: '#F1F5F9', border: '1px dashed #CBD5E1', opacity: 0.7, cursor: 'pointer' },
  nameRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  rejectedInline: { fontSize: 11, fontWeight: 800, color: '#DC2626', flexShrink: 0 },

  toggleLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#525252', fontWeight: 600, cursor: 'pointer', padding: '6px 10px', background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8 },
  btnNewJob: { padding: '12px 24px', borderRadius: 8, background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', fontSize: 14, fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 12px rgba(234,88,12,0.25)', display: 'inline-flex', alignItems: 'center' },

  kebabWrap: { position: 'absolute', top: 6, right: 6 },
  kebabBtn: { width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: '#94A3B8', fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1, display: 'grid', placeItems: 'center', fontFamily: 'inherit' },
  kebabMenu: { position: 'absolute', top: 28, right: 0, minWidth: 160, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,0.12)', padding: 4, zIndex: 30, display: 'flex', flexDirection: 'column' },
  kebabItem: { padding: '9px 12px', border: 'none', background: 'transparent', color: '#B91C1C', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontFamily: 'inherit' },
  kebabItemNeutral: { padding: '9px 12px', border: 'none', background: 'transparent', color: '#1A1A1A', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontFamily: 'inherit' },
  kebabItemLocked: { padding: '9px 12px', border: 'none', background: 'transparent', color: '#94A3B8', fontSize: 12.5, fontWeight: 700, cursor: 'not-allowed', textAlign: 'left', borderRadius: 6, fontFamily: 'inherit' },
};
