import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import CandidateDetail, { MailComposer } from '../../components/company/CandidateDetail';
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

      const { data: appsData } = await supabase
        .from('job_applications')
        .select('id, status, applicant_name, applicant_email, applicant_salary, applicant_role, applicant_experience, applicant_company, resume_url, user_id, created_at, admin_note, interview_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
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

  const setStage = async (appId, newStatus) => {
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus) return;
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    const { error } = await supabase.from('job_applications').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', appId);
    if (error) {
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: app.status } : a));
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
    setStage(appId, newStatus);
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
  const grouped = STAGES.map(s => ({ ...s, apps: apps.filter(a => a.status === s.key && matchesQuery(a)) }));

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
                {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M · {t('company.ats.totalApps', { n: apps.length })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <TeamPopover jobId={job.id} canInvite={!job.created_by || job.created_by === user?.id} />
              <Link href={`/company/jobs/${job.id}/edit`} style={css.btnGhost}>{t('company.ats.editJob')}</Link>
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
                    return (
                      <div
                        key={app.id}
                        draggable={isOwner}
                        onDragStart={() => isOwner && setDraggingId(app.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                        onClick={() => setSelectedAppId(app.id)}
                        style={{...localCss.card, ...(selectedAppId === app.id ? localCss.cardActive : {}), ...(draggingId === app.id ? localCss.cardDragging : {})}}
                      >
                        <div style={localCss.cardName}>{name}</div>
                        {app.applicant_role && <div style={localCss.cardMeta}>{app.applicant_role} · {app.applicant_experience || 0}{t('company.years')}</div>}
                        {app.applicant_salary && <div style={localCss.cardSalary}>{t('company.ats.wishSalary', { n: Math.round(app.applicant_salary/1e6) })}</div>}
                        {showInterviewBadge && (
                          <div style={interviewWhen ? localCss.interviewSet : localCss.interviewPending}>
                            {interviewWhen ? t('company.ats.interviewSet', { when: interviewWhen }) : t('company.ats.interviewPending')}
                          </div>
                        )}
                        <div style={localCss.cardDate}>{new Date(app.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
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
                onStageChange={(id, st) => setApps(prev => prev.map(a => a.id === id ? { ...a, status: st } : a))}
              />
            </div>
          </div>
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

  kanban: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'flex-start' },
  col: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 240 },
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
  cardDate: { fontSize: 10.5, color: '#94A3B8', marginTop: 2 },
  interviewSet: { marginTop: 4, padding: '6px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#047857' },
  interviewPending: { marginTop: 4, padding: '6px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#B45309' },
};
