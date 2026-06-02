import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';

const STAGES = [
  { key: 'pending', emoji: '📥' },
  { key: 'viewed', emoji: '👀' },
  { key: 'reviewing', emoji: '🗣️' },
  { key: 'decided', emoji: '✅' },
];
const STAGE_ORDER = STAGES.map(s => s.key);

const TPL_KEYS = ['received', 'interview', 'offer', 'reject'];

/**
 * mode: 'page' | 'overlay'
 */
export default function CandidateDetail({ appId, mode = 'page', onClose, companyId, onStageChange }) {
  const { t } = useT();
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
        setErr(t('company.candidate.notFound'));
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
  }, [appId, companyId, t]);

  const setStage = async (newStatus) => {
    if (!app || app.status === newStatus) return;
    const prev = app.status;
    setApp({ ...app, status: newStatus });
    const { error } = await supabase.from('job_applications')
      .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', app.id);
    if (error) {
      setApp({ ...app, status: prev });
      setErr(t('company.err.stageChange') + error.message);
      return;
    }
    onStageChange?.(app.id, newStatus);
    if (newStatus === 'reviewing') setShowInterviewModal(true);
  };

  const moveNext = async () => {
    const i = STAGE_ORDER.indexOf(app.status);
    if (i >= STAGE_ORDER.length - 1) return;
    await setStage(STAGE_ORDER[i + 1]);
  };

  const saveNote = async () => {
    setSavingNote(true);
    const { error } = await supabase.from('job_applications').update({ admin_note: note }).eq('id', app.id);
    setSavingNote(false);
    if (error) { setErr(t('company.err.noteSave') + error.message); return; }
    setApp({ ...app, admin_note: note });
    setNoteSavedAt(new Date());
    setTimeout(() => setNoteSavedAt(null), 3000);
  };

  if (status === 'loading') return <div style={local.loading}>{t('company.loading')}</div>;
  if (status === 'unauthed') return <div style={local.errBox}>{t('company.err.loginRequired')}</div>;
  if (status === 'error') return <div style={local.errBox}>{err}</div>;

  const name = app.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
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
            <Link href={`/company/ats?job=${job.id}`} style={local.crumbLink}>{t('company.candidate.backToKanban', { job: job.title })}</Link>
          </div>
        )}
        <div style={local.headRow}>
          <div>
            <h1 style={local.name}>{name}</h1>
            <div style={local.subline}>
              {email}
              {app.applicant_role && <> · {app.applicant_role}</>}
              {(app.applicant_experience !== null && app.applicant_experience !== undefined) && <> · {app.applicant_experience}{t('company.years')}</>}
              {mode === 'overlay' && <> · {job.title}</>}
            </div>
          </div>
          <div style={local.headRight}>
            <div style={local.stageChip}>
              {t('company.candidate.currentStage')} <strong style={local.stageStrong}>{currentStage?.emoji} {t(`company.stage.${app.status}`)}</strong>
            </div>
            {mode === 'overlay' && (
              <button onClick={onClose} style={local.closeBtn} title="✕">✕</button>
            )}
          </div>
        </div>
      </header>

      {err && <div style={local.errBox}>{err}</div>}

      <div className="company-candidate-grid" style={local.bodyGrid}>
        <section style={local.resumeCol}>
          <div style={local.colHead}>
            <span>{t('company.candidate.resume')}</span>
            {hasResume && <a href={app.resume_url} target="_blank" rel="noopener noreferrer" style={local.openInNew}>{t('company.candidate.openNewTab')}</a>}
          </div>
          {hasResume ? (
            <iframe src={app.resume_url} style={local.iframe} title="resume" />
          ) : (
            <div style={local.resumeEmpty}>
              <div style={{fontSize:40, opacity:0.4, marginBottom:12}}>📄</div>
              <p>{t('company.candidate.noResume')}</p>
              <p style={local.resumeEmptySub}>{t('company.candidate.noResumeSub')}</p>
            </div>
          )}
        </section>

        <aside style={local.sideCol}>
          <section style={local.section}>
            <h3 style={local.sectionH}>{t('company.candidate.applyInfo')}</h3>
            <Info label={t('company.candidate.email')}>{email}</Info>
            {app.applicant_role && <Info label={t('company.candidate.role')}>{app.applicant_role}</Info>}
            {(app.applicant_experience !== null && app.applicant_experience !== undefined) && <Info label={t('company.candidate.exp')}>{app.applicant_experience}{t('company.years')}</Info>}
            {app.applicant_salary && <Info label={t('company.candidate.wishSalary')}>₫{Math.round(app.applicant_salary/1e6)}M/월</Info>}
            {app.applicant_company && <Info label={t('company.candidate.currentCompany')}>{app.applicant_company}</Info>}
            <Info label={t('company.candidate.appliedAt')}>{new Date(app.created_at).toLocaleString()}</Info>
          </section>

          <section style={local.section}>
            <h3 style={local.sectionH}>{t('company.candidate.contactH')}</h3>
            <button
              onClick={() => setShowMailModal(true)}
              disabled={!canEmail}
              style={canEmail ? local.btnMail : local.btnMailDisabled}
            >
              {t('company.candidate.mailBtn')}
            </button>
            {!canEmail && <div style={local.mailHint}>{t('company.candidate.noEmail')}</div>}
          </section>

          <section style={local.section}>
            <h3 style={local.sectionH}>{t('company.candidate.note')}</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('company.candidate.notePh')}
              rows={6}
              style={local.textarea}
            />
            <div style={local.noteFoot}>
              <button onClick={saveNote} disabled={savingNote || note === (app.admin_note || '')}
                style={(savingNote || note === (app.admin_note || '')) ? local.btnSaveDisabled : local.btnSave}>
                {savingNote ? t('company.savingShort') : t('company.candidate.saveNote')}
              </button>
              {noteSavedAt && <span style={local.savedTag}>{t('company.saved')}</span>}
            </div>
          </section>

          <section style={local.section}>
            <h3 style={local.sectionH}>{t('company.candidate.stageH')}</h3>
            <div style={local.stageBtns}>
              {STAGES.map(s => (
                <button key={s.key} onClick={() => setStage(s.key)}
                  style={s.key === app.status ? local.stageBtnActive : local.stageBtn}>
                  {s.emoji} {t(`company.stage.${s.key}`)}
                </button>
              ))}
            </div>
            {nextStage && (
              <button onClick={moveNext} style={local.btnNext}>
                {t('company.candidate.nextStage')} {nextStage.emoji} {t(`company.stage.${nextStage.key}`)}
              </button>
            )}
          </section>

          {(app.status === 'reviewing' || app.status === 'decided') && (
            <section style={local.section}>
              <h3 style={local.sectionH}>{t('company.candidate.actionH')}</h3>
              {app.interview_at && (
                <div style={local.interviewBox}>
                  <div style={local.interviewBoxLabel}>{t('company.interview.scheduledLabel')}</div>
                  <div style={local.interviewLine}>📅 {new Date(app.interview_at).toLocaleString()}</div>
                  {app.interview_location && <div style={local.interviewLine}>📍 {app.interview_location}</div>}
                  {app.interview_interviewer && <div style={local.interviewLine}>👤 {app.interview_interviewer}</div>}
                </div>
              )}
              <button onClick={() => setShowInterviewModal(true)} style={local.btnAction}>
                {app.interview_at ? t('company.interview.editBtn') : t('company.candidate.scheduleInterview')}
              </button>
            </section>
          )}
        </aside>
      </div>

      {showInterviewModal && (
        <InterviewModal
          app={app}
          onClose={() => setShowInterviewModal(false)}
          onSaved={(fields) => {
            setApp({ ...app, ...fields });
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
          applicationId={app.id}
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
  const { t } = useT();
  const pad = (n) => String(n).padStart(2, '0');
  const existing = app.interview_at ? new Date(app.interview_at) : null;
  const [date, setDate] = useState(existing ? `${existing.getFullYear()}-${pad(existing.getMonth() + 1)}-${pad(existing.getDate())}` : '');
  const [time, setTime] = useState(existing ? `${pad(existing.getHours())}:${pad(existing.getMinutes())}` : '14:00');
  const [location, setLocation] = useState(app.interview_location || '');
  const [interviewer, setInterviewer] = useState(app.interview_interviewer || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!date) { setErr(t('company.err.dateRequired')); return; }
    setSaving(true);
    // 면접 일정은 전용 컬럼에만 저장 — 평가 메모(admin_note)는 건드리지 않는다.
    const fields = {
      interview_at: new Date(`${date}T${time || '00:00'}`).toISOString(),
      interview_location: location || null,
      interview_interviewer: interviewer || null,
    };
    const { error } = await supabase.from('job_applications').update(fields).eq('id', app.id);
    setSaving(false);
    if (error) { setErr(t('company.err.saveFailed') + error.message); return; }
    onSaved(fields);
  };

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{t('company.interview.h')}</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          <div style={modal.field}><label style={modal.label}>{t('company.interview.dateLabel')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={modal.inp} /></div>
          <div style={modal.field}><label style={modal.label}>{t('company.interview.timeLabel')}</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={modal.inp} /></div>
          <div style={modal.field}><label style={modal.label}>{t('company.interview.locLabel')}</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('company.interview.locPh')} style={modal.inp} /></div>
          <div style={modal.field}><label style={modal.label}>{t('company.interview.interviewerLabel')}</label><input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder={t('company.interview.interviewerPh')} style={modal.inp} /></div>
          {err && <div style={local.errBox}>{err}</div>}
          <p style={modal.hint}>{t('company.interview.hint')}</p>
        </div>
        <footer style={modal.foot}>
          <button onClick={onClose} style={modal.btnGhost}>{t('company.cancel')}</button>
          <button onClick={save} disabled={saving} style={saving ? modal.btnDisabled : modal.btnPrimary}>
            {saving ? t('company.savingShort') : t('company.interview.saveBtn')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function fillVars(text, vars) {
  return (text || '')
    .split('{후보이름}').join(vars.name)
    .split('{공고명}').join(vars.jobTitle)
    .split('{회사명}').join(vars.companyName || '—');
}

export function MailComposer({
  candidateName, candidateEmail, jobTitle, companyName,
  applicationId, initialTemplateKey, stageNote, onClose, onSent,
}) {
  const { t } = useT();
  const templates = TPL_KEYS.map(key => ({
    key,
    label: t(`company.tpl.${key}.label`),
    subject: t(`company.tpl.${key}.subject`),
    body: t(`company.tpl.${key}.body`),
  }));
  const vars = { name: candidateName, jobTitle, companyName };
  const startTpl = templates.find(x => x.key === initialTemplateKey) || templates[0];
  const [tplKey, setTplKey] = useState(startTpl.key);
  const [subject, setSubject] = useState(fillVars(startTpl.subject, vars));
  const [body, setBody] = useState(fillVars(startTpl.body, vars));
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const pickTemplate = (key) => {
    const tpl = templates.find(x => x.key === key);
    if (!tpl) return;
    setTplKey(key);
    setSubject(fillVars(tpl.subject, vars));
    setBody(fillVars(tpl.body, vars));
  };

  const send = async () => {
    setErr('');
    if (!applicationId) { setErr(t('company.err.noAppId')); return; }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/send-mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ appId: applicationId, subject, body, templateKey: tplKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error || t('company.err.mailFail')); setSending(false); return; }
      onSent?.(tplKey);
      onClose();
    } catch (e) {
      setErr(t('company.err.mailErr') + (e?.message || ''));
      setSending(false);
    }
  };

  const openMailApp = () => {
    window.location.href = `mailto:${encodeURIComponent(candidateEmail)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div style={modal.overlay} onClick={sending ? undefined : onClose}>
      <div style={{ ...modal.box, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{t('company.mail.h')}</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          {stageNote && <div style={mc.stageNote}>{stageNote}</div>}
          <div style={mc.tplRow}>
            {templates.map(x => (
              <button key={x.key} onClick={() => pickTemplate(x.key)}
                style={x.key === tplKey ? mc.tplActive : mc.tpl}>
                {x.label}
              </button>
            ))}
          </div>
          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.to')}</label>
            <input value={candidateEmail} readOnly style={{ ...modal.inp, background: '#F1F5F9', color: '#737373' }} />
          </div>
          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.subject')}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={modal.inp} />
          </div>
          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.body')}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              style={{ ...modal.inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          </div>
          {err && <div style={local.errBox}>{err}</div>}
          <p style={modal.hint}>{t('company.mail.hint')}</p>
        </div>
        <footer style={modal.foot}>
          <button onClick={onClose} style={modal.btnGhost}>{stageNote ? t('company.skip') : t('company.cancel')}</button>
          <button onClick={openMailApp} style={modal.btnGhost}>{t('company.mail.openApp')}</button>
          <button onClick={send} disabled={sending} style={sending ? modal.btnDisabled : modal.btnPrimary}>
            {sending ? t('company.mail.sending') : t('company.mail.send')}
          </button>
        </footer>
      </div>
    </div>
  );
}

const mc = {
  tplRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tpl: { padding: '7px 12px', borderRadius: 999, border: '1px solid #E5E7EB', background: '#fff', color: '#525252', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  tplActive: { padding: '7px 12px', borderRadius: 999, border: '1.5px solid #EA580C', background: '#FFF7ED', color: '#EA580C', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  stageNote: { background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', padding: '9px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 },
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
  interviewBox: { background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 3 },
  interviewBoxLabel: { fontSize: 10.5, fontWeight: 800, color: '#9A3412', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 },
  interviewLine: { fontSize: 12.5, color: '#7C2D12', fontWeight: 600 },
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
