import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const STAGES = [
  { key: 'applied', label: '신규 지원', emoji: '📥' },
  { key: 'viewed', label: '열람', emoji: '👀' },
  { key: 'reviewing', label: '검토 / 인터뷰', emoji: '🗣️' },
  { key: 'decided', label: '결정', emoji: '✅' },
];
const STAGE_ORDER = STAGES.map(s => s.key);

/**
 * mode: 'page' | 'overlay'
 *   page: 풀 페이지 (대시보드 sidebar 포함된 페이지에서 사용)
 *   overlay: 모달 오버레이 — 우상단 ✕ 닫기
 */
export default function CandidateDetail({ appId, mode = 'page', onClose, companyId, onStageChange }) {
  const [status, setStatus] = useState('loading');
  const [app, setApp] = useState(null);
  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);

  useEffect(() => {
    if (!appId) return;
    (async () => {
      setStatus('loading');
      // 권한 체크: companyId가 props로 안 오면 자체적으로 조회
      let cid = companyId;
      if (!cid) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setStatus('unauthed'); return; }
        const { data: rec } = await supabase
          .from('recruiter_users').select('company_id').eq('user_id', session.user.id).maybeSingle();
        cid = rec?.company_id;
        if (!cid) { setStatus('unauthed'); return; }
      }

      const { data: appData, error: appErr } = await supabase
        .from('job_applications')
        .select('*, jobs(id, title, company_id, location, type, recruiter_companies(name))')
        .eq('id', appId)
        .maybeSingle();
      if (appErr || !appData || appData.jobs?.company_id !== cid) {
        setErr('접근 권한이 없거나 지원자를 찾을 수 없습니다.');
        setStatus('error');
        return;
      }
      setApp(appData);
      setJob(appData.jobs);
      setNote(appData.admin_note || '');

      if (appData.user_id) {
        const { data: prof } = await supabase
          .from('user_profiles').select('id, email, full_name').eq('id', appData.user_id).maybeSingle();
        if (prof) setProfile(prof);
      }
      setStatus('ready');
    })();
  }, [appId, companyId]);

  const setStage = async (newStatus) => {
    if (!app || app.status === newStatus) return;
    const prev = app.status;
    setApp({ ...app, status: newStatus });
    const { error } = await supabase.from('job_applications')
      .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', app.id);
    if (error) {
      setApp({ ...app, status: prev });
      setErr('상태 변경 실패: ' + error.message);
      return;
    }
    onStageChange?.(app.id, newStatus);
    if (newStatus === 'reviewing') setShowInterviewModal(true);
  };

  const moveNext = async () => {
    const idx = STAGE_ORDER.indexOf(app.status);
    if (idx >= STAGE_ORDER.length - 1) return;
    await setStage(STAGE_ORDER[idx + 1]);
  };

  const saveNote = async () => {
    setSavingNote(true);
    const { error } = await supabase.from('job_applications').update({ admin_note: note }).eq('id', app.id);
    setSavingNote(false);
    if (error) { setErr('메모 저장 실패: ' + error.message); return; }
    setApp({ ...app, admin_note: note });
    setNoteSavedAt(new Date());
    setTimeout(() => setNoteSavedAt(null), 3000);
  };

  if (status === 'loading') return <div style={local.loading}>Loading…</div>;
  if (status === 'unauthed') return <div style={local.errBox}>로그인이 필요합니다.</div>;
  if (status === 'error') return <div style={local.errBox}>{err}</div>;

  const name = app.applicant_name || profile?.full_name || `후보 #${app.id.slice(-6).toUpperCase()}`;
  const email = app.applicant_email || profile?.email || '—';
  const currentStage = STAGES.find(s => s.key === app.status);
  const idx = STAGE_ORDER.indexOf(app.status);
  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const hasResume = !!app.resume_url;
  const companyName = job?.recruiter_companies?.name || '';
  const canEmail = /@/.test(email);

  return (
    <div style={mode === 'overlay' ? local.overlayBody : local.pageBody}>
      <header style={local.head}>
        {mode === 'page' && (
          <div style={local.crumb}>
            <Link href={`/company/ats?job=${job.id}`} style={local.crumbLink}>← {job.title} 칸반</Link>
          </div>
        )}
        <div style={local.headRow}>
          <div>
            <h1 style={local.name}>{name}</h1>
            <div style={local.subline}>
              {email}
              {app.applicant_role && <> · {app.applicant_role}</>}
              {(app.applicant_experience !== null && app.applicant_experience !== undefined) && <> · {app.applicant_experience}년</>}
              {mode === 'overlay' && <> · {job.title}</>}
            </div>
          </div>
          <div style={local.headRight}>
            <div style={local.stageChip}>
              현재 단계 <strong style={local.stageStrong}>{currentStage?.emoji} {currentStage?.label}</strong>
            </div>
            {mode === 'overlay' && (
              <button onClick={onClose} style={local.closeBtn} title="닫기">✕</button>
            )}
          </div>
        </div>
      </header>

      {err && <div style={local.errBox}>{err}</div>}

      <div style={local.bodyGrid}>
        {/* Center: 이력서 */}
        <section style={local.resumeCol}>
          <div style={local.colHead}>
            <span>📄 이력서</span>
            {hasResume && <a href={app.resume_url} target="_blank" rel="noopener noreferrer" style={local.openInNew}>새 탭으로 ↗</a>}
          </div>
          {hasResume ? (
            <iframe src={app.resume_url} style={local.iframe} title="resume" />
          ) : (
            <div style={local.resumeEmpty}>
              <div style={{fontSize:40, opacity:0.4, marginBottom:12}}>📄</div>
              <p>제출된 이력서 파일이 없습니다.</p>
              <p style={local.resumeEmptySub}>오른쪽 지원 정보를 참고하세요.</p>
            </div>
          )}
        </section>

        {/* Right: 정보 + 메모 + 단계 */}
        <aside style={local.sideCol}>
          <section style={local.section}>
            <h3 style={local.sectionH}>지원 정보</h3>
            <Info label="이메일">{email}</Info>
            {app.applicant_role && <Info label="역할">{app.applicant_role}</Info>}
            {(app.applicant_experience !== null && app.applicant_experience !== undefined) && <Info label="경력">{app.applicant_experience}년</Info>}
            {app.applicant_salary && <Info label="희망 연봉">₫{Math.round(app.applicant_salary/1e6)}M/월</Info>}
            {app.applicant_company && <Info label="현재 회사">{app.applicant_company}</Info>}
            <Info label="지원일">{new Date(app.created_at).toLocaleString('ko-KR')}</Info>
          </section>

          <section style={local.section}>
            <h3 style={local.sectionH}>후보 연락</h3>
            <button
              onClick={() => setShowMailModal(true)}
              disabled={!canEmail}
              style={canEmail ? local.btnMail : local.btnMailDisabled}
            >
              ✉ 메일 보내기
            </button>
            {!canEmail && <div style={local.mailHint}>후보 이메일이 없어 메일을 보낼 수 없습니다.</div>}
          </section>

          <section style={local.section}>
            <h3 style={local.sectionH}>평가 메모</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="이 후보자에 대한 평가, 인터뷰 의견, 다음 액션 등을 자유롭게"
              rows={6}
              style={local.textarea}
            />
            <div style={local.noteFoot}>
              <button onClick={saveNote} disabled={savingNote || note === (app.admin_note || '')}
                style={(savingNote || note === (app.admin_note || '')) ? local.btnSaveDisabled : local.btnSave}>
                {savingNote ? '저장 중…' : '메모 저장'}
              </button>
              {noteSavedAt && <span style={local.savedTag}>✓ 저장됨</span>}
            </div>
          </section>

          <section style={local.section}>
            <h3 style={local.sectionH}>단계 이동</h3>
            <div style={local.stageBtns}>
              {STAGES.map(s => (
                <button key={s.key} onClick={() => setStage(s.key)}
                  style={s.key === app.status ? local.stageBtnActive : local.stageBtn}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            {nextStage && (
              <button onClick={moveNext} style={local.btnNext}>
                다음 단계로 → {nextStage.emoji} {nextStage.label}
              </button>
            )}
          </section>

          {(app.status === 'reviewing' || app.status === 'decided') && (
            <section style={local.section}>
              <h3 style={local.sectionH}>액션</h3>
              <button onClick={() => setShowInterviewModal(true)} style={local.btnAction}>
                📅 면접 일정 잡기
              </button>
            </section>
          )}
        </aside>
      </div>

      {showInterviewModal && (
        <InterviewModal
          app={app}
          onClose={() => setShowInterviewModal(false)}
          onSaved={(updated) => {
            setApp({ ...app, admin_note: updated });
            setNote(updated);
            setShowInterviewModal(false);
          }}
        />
      )}

      {showMailModal && (
        <MailComposer
          candidateName={name}
          candidateEmail={email}
          jobTitle={job.title}
          companyName={companyName}
          onClose={() => setShowMailModal(false)}
        />
      )}
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div style={local.infoRow}>
      <div style={local.infoLab}>{label}</div>
      <div style={local.infoVal}>{children}</div>
    </div>
  );
}

function InterviewModal({ app, onClose, onSaved }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [location, setLocation] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!date) { setErr('날짜를 선택해 주세요'); return; }
    setSaving(true);
    const summary = `[면접 일정]\n📅 ${date} ${time}\n📍 ${location || '미정'}\n👤 면접관: ${interviewer || '미정'}\n\n${app.admin_note ? '── 기존 메모 ──\n' + app.admin_note : ''}`;
    const { error } = await supabase.from('job_applications').update({ admin_note: summary }).eq('id', app.id);
    setSaving(false);
    if (error) { setErr('저장 실패: ' + error.message); return; }
    onSaved(summary);
  };

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>면접 일정 잡기</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          <div style={modal.field}><label style={modal.label}>면접 날짜 *</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={modal.inp} /></div>
          <div style={modal.field}><label style={modal.label}>시간</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={modal.inp} /></div>
          <div style={modal.field}><label style={modal.label}>장소</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="회사 본사 회의실 / Zoom 링크" style={modal.inp} /></div>
          <div style={modal.field}><label style={modal.label}>면접관</label><input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder="이름 / 직책" style={modal.inp} /></div>
          {err && <div style={local.errBox}>{err}</div>}
          <p style={modal.hint}>저장 시 후보자 메모 영역에 일정이 자동 기록됩니다.</p>
        </div>
        <footer style={modal.foot}>
          <button onClick={onClose} style={modal.btnGhost}>취소</button>
          <button onClick={save} disabled={saving} style={saving ? modal.btnDisabled : modal.btnPrimary}>
            {saving ? '저장 중…' : '일정 저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

const MAIL_TEMPLATES = [
  {
    key: 'received', label: '지원 접수',
    subject: '[{회사명}] {공고명} 지원 접수 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션에 지원해 주셔서 감사합니다.
제출해 주신 지원서를 잘 받았으며, 현재 검토하고 있습니다.
결과는 확인되는 대로 다시 안내드리겠습니다.

감사합니다.`,
  },
  {
    key: 'interview', label: '면접 제안',
    subject: '[{회사명}] {공고명} 면접 제안',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션 검토 결과, {후보이름}님과 면접을 진행하고 싶습니다.
아래 시간 중 가능한 일정을 회신해 주시면 확정하겠습니다.

1)
2)
3)

면접 방식과 장소는 일정 확정 후 안내드리겠습니다.
감사합니다.`,
  },
  {
    key: 'offer', label: '합격',
    subject: '[{회사명}] {공고명} 합격 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션에 {후보이름}님을 모시기로 결정했습니다. 축하드립니다.
입사 절차와 처우 조건은 별도로 안내드리겠습니다.

함께하게 되어 기쁩니다.
감사합니다.`,
  },
  {
    key: 'reject', label: '불합격',
    subject: '[{회사명}] {공고명} 전형 결과 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션에 관심을 갖고 지원해 주셔서 감사합니다.
아쉽게도 이번 전형에서는 함께하지 못하게 되었습니다.

지원에 들인 시간과 노력에 깊이 감사드리며, 좋은 기회로 다시 뵙기를 바랍니다.

감사합니다.`,
  },
];

function fillVars(text, vars) {
  return text
    .split('{후보이름}').join(vars.name)
    .split('{공고명}').join(vars.jobTitle)
    .split('{회사명}').join(vars.companyName || '저희 회사');
}

export function MailComposer({ candidateName, candidateEmail, jobTitle, companyName, onClose }) {
  const vars = { name: candidateName, jobTitle, companyName };
  const [tplKey, setTplKey] = useState(MAIL_TEMPLATES[0].key);
  const [subject, setSubject] = useState(fillVars(MAIL_TEMPLATES[0].subject, vars));
  const [body, setBody] = useState(fillVars(MAIL_TEMPLATES[0].body, vars));

  const pickTemplate = (key) => {
    const tpl = MAIL_TEMPLATES.find(t => t.key === key);
    if (!tpl) return;
    setTplKey(key);
    setSubject(fillVars(tpl.subject, vars));
    setBody(fillVars(tpl.body, vars));
  };

  const send = () => {
    const url = `mailto:${encodeURIComponent(candidateEmail)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    onClose();
  };

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={{ ...modal.box, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>후보에게 메일</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          <div style={mc.tplRow}>
            {MAIL_TEMPLATES.map(t => (
              <button key={t.key} onClick={() => pickTemplate(t.key)}
                style={t.key === tplKey ? mc.tplActive : mc.tpl}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={modal.field}>
            <label style={modal.label}>받는 사람</label>
            <input value={candidateEmail} readOnly style={{ ...modal.inp, background: '#F1F5F9', color: '#737373' }} />
          </div>
          <div style={modal.field}>
            <label style={modal.label}>제목</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={modal.inp} />
          </div>
          <div style={modal.field}>
            <label style={modal.label}>본문</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              style={{ ...modal.inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          </div>
          <p style={modal.hint}>'메일 보내기'를 누르면 사용 중인 메일 프로그램이 열립니다. 최종 검토 후 발송하세요.</p>
        </div>
        <footer style={modal.foot}>
          <button onClick={onClose} style={modal.btnGhost}>취소</button>
          <button onClick={send} style={modal.btnPrimary}>메일 보내기</button>
        </footer>
      </div>
    </div>
  );
}

const mc = {
  tplRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tpl: { padding: '7px 12px', borderRadius: 999, border: '1px solid #E5E7EB', background: '#fff', color: '#525252', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  tplActive: { padding: '7px 12px', borderRadius: 999, border: '1.5px solid #EA580C', background: '#FFF7ED', color: '#EA580C', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
};

const local = {
  loading: { display: 'grid', placeItems: 'center', height: '60vh', color: '#525252', fontSize: 14 },
  errBox: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '12px 16px', borderRadius: 8, fontSize: 13 },

  pageBody: { padding: '24px 28px 60px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0, width: '100%' },
  overlayBody: { padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'hidden' },

  head: { display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 },
  crumb: { fontSize: 12.5, color: '#525252' },
  crumbLink: { color: '#525252', textDecoration: 'none' },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  headRight: { display: 'flex', alignItems: 'center', gap: 10 },
  name: { fontSize: 24, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.01em' },
  subline: { fontSize: 13, color: '#525252', marginTop: 4 },
  stageChip: { fontSize: 11.5, color: '#737373', fontWeight: 600, padding: '8px 14px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 999 },
  stageStrong: { color: '#1A1A1A', fontWeight: 800, marginLeft: 6 },
  closeBtn: { padding: '6px 10px', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 14, color: '#737373', cursor: 'pointer' },

  bodyGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 14, alignItems: 'stretch', width: '100%', flex: 1, minHeight: 0 },

  resumeCol: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' },
  colHead: { padding: '13px 18px', fontSize: 12.5, fontWeight: 800, color: '#1A1A1A', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  openInNew: { fontSize: 11.5, color: '#EA580C', fontWeight: 700, textDecoration: 'none' },
  iframe: { flex: 1, width: '100%', height: '100%', border: 'none', minHeight: 0 },
  resumeFallback: { padding: '60px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  resumeFallbackP: { fontSize: 13, color: '#525252' },
  openLink: { padding: '10px 18px', background: '#1A1A1A', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700 },
  resumeEmpty: { padding: '80px 32px', textAlign: 'center', color: '#737373', fontSize: 13 },
  resumeEmptySub: { fontSize: 12, color: '#94A3B8', marginTop: 6 },

  sideCol: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 4 },
  section: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' },
  sectionH: { fontSize: 11.5, fontWeight: 800, color: '#1A1A1A', marginBottom: 10, letterSpacing: '0.02em' },

  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #F1F5F9' },
  infoLab: { fontSize: 11.5, color: '#737373', fontWeight: 600 },
  infoVal: { fontSize: 12.5, color: '#1A1A1A', fontWeight: 600, textAlign: 'right' },

  textarea: { width: '100%', minHeight: 90, padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  noteFoot: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 },
  btnSave: { padding: '8px 14px', borderRadius: 7, border: 'none', background: '#1A1A1A', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSaveDisabled: { padding: '8px 14px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#F1F5F9', color: '#94A3B8', fontSize: 12.5, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' },
  savedTag: { fontSize: 11.5, color: '#059669', fontWeight: 700 },

  stageBtns: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 },
  stageBtn: { padding: '7px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#525252', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  stageBtnActive: { padding: '7px 10px', borderRadius: 6, border: '1.5px solid #EA580C', background: '#FFF7ED', color: '#EA580C', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  btnNext: { width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)' },
  btnAction: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnMail: { width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)' },
  btnMailDisabled: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F1F5F9', color: '#94A3B8', fontSize: 13, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' },
  mailHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
};

const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 },
  box: { background: '#fff', borderRadius: 14, maxWidth: 480, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E5E7EB' },
  h: { fontSize: 17, fontWeight: 800, color: '#1A1A1A' },
  closeBtn: { padding: 4, background: 'transparent', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#525252', fontWeight: 700 },
  inp: { padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit', boxSizing: 'border-box' },
  hint: { fontSize: 11.5, color: '#737373', marginTop: 4, lineHeight: 1.55 },
  foot: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #E5E7EB' },
  btnPrimary: { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#E5E7EB', color: '#94A3B8', fontSize: 13, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' },
};
