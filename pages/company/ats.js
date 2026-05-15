import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import CandidateDetail from '../../components/company/CandidateDetail';

const STAGES = [
  { key: 'pending', label: '신규 지원', emoji: '📥' },
  { key: 'viewed', label: '열람', emoji: '👀' },
  { key: 'reviewing', label: '검토 / 인터뷰', emoji: '🗣️' },
  { key: 'decided', label: '결정', emoji: '✅' },
];

const STAGE_ORDER = STAGES.map(s => s.key);

export default function CompanyATSPage() {
  const router = useRouter();
  const { job: jobId } = router.query;

  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [job, setJob] = useState(null);
  const [apps, setApps] = useState([]);
  const [err, setErr] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [profileMap, setProfileMap] = useState({});
  const [savingNote, setSavingNote] = useState(false);

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
        .select('id, title, status, location, type, salary_min, salary_max, company_id, created_at')
        .eq('id', jobId)
        .eq('company_id', rec.company_id)
        .maybeSingle();
      if (jobErr || !jobData) {
        setErr('공고를 찾을 수 없거나 접근 권한이 없습니다.');
        setStatus('error');
        return;
      }
      setJob(jobData);

      const { data: appsData } = await supabase
        .from('job_applications')
        .select('id, status, applicant_name, applicant_email, applicant_salary, applicant_role, applicant_experience, applicant_company, resume_url, user_id, created_at, admin_note')
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
  }, [jobId]);

  const moveStage = async (appId, direction) => {
    const app = apps.find(a => a.id === appId);
    if (!app) return;
    const idx = STAGE_ORDER.indexOf(app.status);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= STAGE_ORDER.length) return;
    const newStatus = STAGE_ORDER[newIdx];
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    const { error } = await supabase.from('job_applications').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', appId);
    if (error) {
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: app.status } : a));
      setErr('상태 변경 실패: ' + error.message);
    }
  };

  const setStage = async (appId, newStatus) => {
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus) return;
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    const { error } = await supabase.from('job_applications').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', appId);
    if (error) {
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: app.status } : a));
      setErr('상태 변경 실패: ' + error.message);
    }
  };

  const saveNote = async (appId, note) => {
    setSavingNote(true);
    setApps(prev => prev.map(a => a.id === appId ? { ...a, admin_note: note } : a));
    const { error } = await supabase.from('job_applications').update({ admin_note: note }).eq('id', appId);
    setSavingNote(false);
    if (error) setErr('메모 저장 실패: ' + error.message);
  };

  const grouped = STAGES.map(s => ({ ...s, apps: apps.filter(a => a.status === s.key) }));
  const selectedApp = apps.find(a => a.id === selectedAppId);

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
  if (status === 'error') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>접근 불가</h1>
          <p style={css.cardP}>{err}</p>
          <Link href="/company" style={css.btnPrimary}>대시보드로</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{job.title} · 칸반 · FYI</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" activeJobId={job.id} />

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <div style={localCss.crumb}><Link href="/company" style={localCss.crumbLink}>← 대시보드</Link></div>
              <h1 style={css.mainH}>{job.title}</h1>
              <p style={css.mainP}>
                {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M/월 · 총 지원자 {apps.length}명
              </p>
            </div>
            <Link href={`/company/jobs/${job.id}/edit`} style={css.btnGhost}>공고 수정</Link>
          </header>

          {err && <div style={css.err}>{err}</div>}

          <div style={localCss.kanban}>
            {grouped.map((col) => (
              <div key={col.key} style={localCss.col}>
                <div style={localCss.colHead}>
                  <span style={localCss.colEmoji}>{col.emoji}</span>
                  <span style={localCss.colLabel}>{col.label}</span>
                  <span style={localCss.colCount}>{col.apps.length}</span>
                </div>
                <div style={localCss.colBody}>
                  {col.apps.length === 0 && <div style={localCss.colEmpty}>—</div>}
                  {col.apps.map(app => {
                    const profile = app.user_id ? profileMap[app.user_id] : null;
                    const name = app.applicant_name || profile?.full_name || `후보 #${app.id.slice(-6).toUpperCase()}`;
                    return (
                      <div
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id)}
                        style={{...localCss.card, ...(selectedAppId === app.id ? localCss.cardActive : {})}}
                      >
                        <div style={localCss.cardName}>{name}</div>
                        {app.applicant_role && <div style={localCss.cardMeta}>{app.applicant_role} · {app.applicant_experience || 0}년</div>}
                        {app.applicant_salary && <div style={localCss.cardSalary}>희망 ₫{Math.round(app.applicant_salary/1e6)}M/월</div>}
                        <div style={localCss.cardDate}>{new Date(app.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</div>
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
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function _UnusedDetailPanel({ app, profile, onClose, onSetStage, onMoveNext, onSaveNote, savingNote }) {
  const [note, setNote] = useState(app.admin_note || '');
  useEffect(() => { setNote(app.admin_note || ''); }, [app.id]);

  const name = app.applicant_name || profile?.full_name || `후보 #${app.id.slice(-6).toUpperCase()}`;
  const email = app.applicant_email || profile?.email || '—';
  const currentIdx = STAGE_ORDER.indexOf(app.status);
  const currentStage = STAGES[currentIdx];
  const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;

  return (
    <div style={panelCss.wrap}>
      <header style={panelCss.head}>
        <div>
          <div style={panelCss.name}>{name}</div>
          <div style={panelCss.email}>{email}</div>
        </div>
        <button onClick={onClose} style={panelCss.closeBtn}>✕</button>
      </header>

      <div style={panelCss.statusBar}>
        <span style={panelCss.statusLab}>현재 단계</span>
        <span style={panelCss.statusBadge}>
          {currentStage?.emoji} {currentStage?.label}
        </span>
      </div>

      <section style={panelCss.section}>
        <h3 style={panelCss.sectionH}>📋 지원 정보</h3>
        <div style={panelCss.infoGrid}>
          {app.applicant_role && <Info label="역할">{app.applicant_role}</Info>}
          {app.applicant_experience !== null && app.applicant_experience !== undefined && <Info label="경력">{app.applicant_experience}년</Info>}
          {app.applicant_salary && <Info label="희망 연봉">₫{Math.round(app.applicant_salary/1e6)}M/월</Info>}
          {app.applicant_company && <Info label="현재 회사">{app.applicant_company}</Info>}
          <Info label="지원일">{new Date(app.created_at).toLocaleString('ko-KR')}</Info>
        </div>
      </section>

      <section style={panelCss.section}>
        <h3 style={panelCss.sectionH}>📄 이력서</h3>
        {app.resume_url ? (
          <a href={app.resume_url} target="_blank" rel="noopener noreferrer" style={panelCss.resumeBtn}>
            이력서 열기 / 다운로드 ↗
          </a>
        ) : (
          <div style={panelCss.empty}>제출된 이력서 없음</div>
        )}
      </section>

      <section style={panelCss.section}>
        <h3 style={panelCss.sectionH}>📝 평가 메모</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (app.admin_note || '') && onSaveNote(note)}
          placeholder="이 후보자에 대한 평가나 메모를 남겨주세요"
          rows={5}
          style={panelCss.textarea}
        />
        {savingNote && <div style={panelCss.savingHint}>저장 중...</div>}
      </section>

      <section style={panelCss.section}>
        <h3 style={panelCss.sectionH}>🎯 단계 이동</h3>
        <div style={panelCss.stageBtns}>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => onSetStage(s.key)}
              style={s.key === app.status ? panelCss.stageBtnActive : panelCss.stageBtn}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
        {nextStage && (
          <button onClick={onMoveNext} style={panelCss.nextBtn}>
            다음 단계로 → {nextStage.emoji} {nextStage.label}
          </button>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div style={panelCss.infoRow}>
      <div style={panelCss.infoLab}>{label}</div>
      <div style={panelCss.infoVal}>{children}</div>
    </div>
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

  card: { background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none' },
  cardActive: { background: '#FFF7ED', border: '1.5px solid #FCA5A5', boxShadow: '0 4px 12px rgba(234,88,12,0.12)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50 },
  panel: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, background: '#FAFAFA', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' },
  cardName: { fontSize: 13.5, fontWeight: 800, color: '#1A1A1A' },
  cardMeta: { fontSize: 11.5, color: '#525252' },
  cardSalary: { fontSize: 11.5, color: '#059669', fontWeight: 600 },
  cardDate: { fontSize: 10.5, color: '#94A3B8', marginTop: 2 },
};

const panelCss = {
  wrap: { display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', sans-serif" },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 24px 20px', borderBottom: '1px solid #E5E7EB' },
  name: { fontSize: 20, fontWeight: 800, color: '#1A1A1A' },
  email: { fontSize: 12.5, color: '#525252', marginTop: 3 },
  closeBtn: { padding: '6px 10px', background: 'transparent', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' },

  statusBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', background: '#FAFAFA', borderBottom: '1px solid #E5E7EB' },
  statusLab: { fontSize: 11, color: '#737373', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statusBadge: { fontSize: 13, fontWeight: 800, color: '#1A1A1A', background: '#fff', padding: '4px 12px', borderRadius: 999, border: '1px solid #E5E7EB' },

  section: { padding: '20px 24px', borderBottom: '1px solid #F1F5F9' },
  sectionH: { fontSize: 13, fontWeight: 800, color: '#1A1A1A', marginBottom: 14 },

  infoGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #F1F5F9' },
  infoLab: { fontSize: 12, color: '#737373', fontWeight: 600 },
  infoVal: { fontSize: 13, color: '#1A1A1A', fontWeight: 600 },

  resumeBtn: { display: 'inline-block', padding: '10px 16px', background: '#1A1A1A', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' },
  empty: { fontSize: 12.5, color: '#94A3B8', fontStyle: 'italic' },

  textarea: { width: '100%', minHeight: 100, padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  savingHint: { fontSize: 11, color: '#EA580C', marginTop: 4, fontWeight: 600 },

  stageBtns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 },
  stageBtn: { padding: '10px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#525252', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  stageBtnActive: { padding: '10px 12px', borderRadius: 7, border: '1.5px solid #EA580C', background: '#FFF7ED', color: '#EA580C', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  nextBtn: { width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)' },
};
