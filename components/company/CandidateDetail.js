import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';
import { formatICT, ictInputToUtc, utcToIctInput, ICT_LABEL } from '../../lib/timezone';

const STAGES = [
  { key: 'pending', emoji: '📥' },
  { key: 'viewed', emoji: '💬' },
  { key: 'reviewing', emoji: '🤝' },
  { key: 'decided', emoji: '🎉' },
];
const STAGE_ORDER = STAGES.map(s => s.key);


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

  const [userId, setUserId] = useState(null);
  const [reviewerName, setReviewerName] = useState('');
  const [mailModal, setMailModal] = useState(null); // { templateKey, withSlots }
  const [rejectModal, setRejectModal] = useState(null); // null | 'new' | 'edit' | 'unreject'
  const [interviewModal, setInterviewModal] = useState(false);
  const [mailLog, setMailLog] = useState([]);

  const reloadMailLog = async (appId) => {
    if (!appId) return;
    const { data } = await supabase
      .from('recruiter_mail_log')
      .select('id, template_key, subject, created_at')
      .eq('application_id', appId)
      .order('created_at', { ascending: false });
    setMailLog(data || []);
  };

  useEffect(() => {
    if (app?.id) reloadMailLog(app.id);
  }, [app?.id]);
  const [evals, setEvals] = useState([]);
  const [expandedStages, setExpandedStages] = useState(new Set());
  const [evalComment, setEvalComment] = useState('');
  const [evalScore, setEvalScore] = useState('');
  const [savingEval, setSavingEval] = useState(false);
  const [editingEval, setEditingEval] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [editScore, setEditScore] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!appId) return;
    (async () => {
      setStatus('loading');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUserId(session.user.id);
      let cid = companyId;
      const { data: rec } = await supabase
        .from('recruiter_users').select('company_id, full_name').eq('user_id', session.user.id).maybeSingle();
      if (!cid) {
        cid = rec?.company_id;
        if (!cid) { setStatus('unauthed'); return; }
      }
      setReviewerName(rec?.full_name || (session.user.email || '').split('@')[0] || t('company.eval.me'));

      const { data: appData, error: appErr } = await supabase
        .from('job_applications')
        .select('*, jobs(id, title, company_id, location, type, created_by, recruiter_companies(name))')
        .eq('id', appId)
        .maybeSingle();
      if (appErr || !appData || appData.jobs?.company_id !== cid) {
        setErr(t('company.candidate.notFound'));
        setStatus('error');
        return;
      }
      setApp(appData);
      setJob(appData.jobs);
      setExpandedStages(new Set([appData.status]));

      if (appData.user_id) {
        const { data: prof } = await supabase
          .from('user_profiles').select('id, email, full_name').eq('id', appData.user_id).maybeSingle();
        if (prof) setProfile(prof);
      }

      const { data: evalData } = await supabase
        .from('application_evaluations')
        .select('*')
        .eq('application_id', appId)
        .order('created_at', { ascending: true });
      setEvals(evalData || []);

      setStatus('ready');
    })();
  }, [appId, companyId, t]);

  const setStage = async (newStatus) => {
    if (!app || app.status === newStatus) return;
    const prev = app.status;
    const fromIdx = STAGE_ORDER.indexOf(prev);
    const toIdx = STAGE_ORDER.indexOf(newStatus);
    const forward = toIdx > fromIdx;
    const hasInterview = !!app.interview_at && (prev === 'viewed' || prev === 'reviewing');
    const resetInterview = forward && hasInterview;

    const patch = { status: newStatus };
    if (resetInterview) {
      patch.interview_at = null;
      patch.interview_location = null;
      patch.interview_interviewer = null;
    }

    setApp({ ...app, ...patch });
    const { error } = await supabase.from('job_applications')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', app.id);
    if (error) {
      setApp({ ...app, status: prev });
      setErr(t('company.err.stageChange') + error.message);
      return;
    }
    onStageChange?.(app.id, patch);
  };

  const moveNext = async () => {
    const i = STAGE_ORDER.indexOf(app.status);
    if (i >= STAGE_ORDER.length - 1) return;
    await setStage(STAGE_ORDER[i + 1]);
  };

  const toggleStage = (key) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const startEditEval = (row) => {
    setEditingEval(row);
    setEditComment(row.comment);
    setEditScore(row.score != null ? String(row.score) : '');
    setErr('');
  };

  const saveEditEval = async () => {
    setErr('');
    const comment = editComment.trim();
    if (!comment) { setErr(t('company.eval.errEmpty')); return; }
    let score = null;
    if (editScore !== '') {
      const n = parseInt(editScore, 10);
      if (Number.isNaN(n) || n < 0 || n > 100) { setErr(t('company.eval.errScore')); return; }
      score = n;
    }
    setSavingEdit(true);
    const { data, error } = await supabase
      .from('application_evaluations')
      .update({ comment, score })
      .eq('id', editingEval.id)
      .select()
      .single();
    setSavingEdit(false);
    if (error) { setErr('수정 실패: ' + error.message); return; }
    setEvals(prev => prev.map(e => e.id === data.id ? data : e));
    setEditingEval(null);
  };

  const deleteEvaluation = async (row) => {
    if (!window.confirm(t('company.eval.confirmDelete'))) return;
    const { error } = await supabase.from('application_evaluations').delete().eq('id', row.id);
    if (error) { setErr('삭제 실패: ' + error.message); return; }
    setEvals(prev => prev.filter(e => e.id !== row.id));
  };

  const submitEvaluation = async () => {
    setErr('');
    const comment = evalComment.trim();
    if (!comment) { setErr(t('company.eval.errEmpty')); return; }
    let score = null;
    if (evalScore !== '') {
      const n = parseInt(evalScore, 10);
      if (Number.isNaN(n) || n < 0 || n > 100) { setErr(t('company.eval.errScore')); return; }
      score = n;
    }
    setSavingEval(true);
    const isOwnerNow = !job?.created_by || job?.created_by === userId;
    const payload = {
      application_id: app.id,
      job_id: app.job_id,
      stage: app.status,
      reviewer_user_id: userId,
      reviewer_name: reviewerName,
      reviewer_role: isOwnerNow ? 'owner' : 'interviewer',
      comment,
      score,
    };
    const { data, error } = await supabase
      .from('application_evaluations')
      .upsert(payload, { onConflict: 'application_id,stage,reviewer_user_id' })
      .select()
      .single();
    setSavingEval(false);
    if (error) { setErr('평가 저장 실패: ' + error.message); return; }
    setEvals(prev => {
      const exists = prev.some(e => e.id === data.id);
      return exists ? prev.map(e => e.id === data.id ? data : e) : [...prev, data];
    });
    setEvalComment('');
    setEvalScore('');
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
  const appliedAtLabel = new Date(app.created_at).toLocaleDateString();
  const isOwner = !job?.created_by || job?.created_by === userId;
  const companyName = job?.recruiter_companies?.name || '';

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
              <> · {t('company.candidate.appliedShort')} {appliedAtLabel}</>
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
          {!isOwner && (
            <div style={local.interviewerHint}>🔒 {t('company.candidate.interviewerHint')}</div>
          )}

          {!app.rejected_at && (app.status === 'viewed' || app.status === 'reviewing') && isOwner && (
            <section style={local.section}>
              <div style={local.stepHead}>
                <span style={{ ...local.stepBadge, background: '#1D4ED8' }}>1</span>
                <span style={local.stepTitle}>{t('company.candidate.step1')}</span>
              </div>
              {app.interview_at ? (
                <div style={local.interviewCard}>
                  <div style={local.interviewCardHead}>
                    <span style={local.interviewCardTitle}>
                      📅 {formatICT(app.interview_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} {ICT_LABEL}
                    </span>
                    <button onClick={() => setInterviewModal(true)} style={local.interviewEditBtn}>
                      {t('company.interview.confirmEditBtn')}
                    </button>
                  </div>
                  {app.interview_location && <div style={local.interviewMeta}>📍 {app.interview_location}</div>}
                  {app.interview_interviewer && <div style={local.interviewMeta}>👤 {app.interview_interviewer}</div>}
                </div>
              ) : (
                <button onClick={() => setInterviewModal(true)} style={local.btnInterview}>
                  {t('company.interview.confirmBtn')}
                </button>
              )}
            </section>
          )}

          <section style={local.section}>
            <div style={local.stepHead}>
              <span style={{ ...local.stepBadge, background: '#7C3AED' }}>{(!app.rejected_at && (app.status === 'viewed' || app.status === 'reviewing') && isOwner) ? 2 : 1}</span>
              <span style={local.stepTitle}>{t('company.candidate.step2')}</span>
            </div>
            <EvaluationSection
            t={t}
            stages={STAGES}
            currentStage={app.status}
            evals={evals}
            expandedStages={expandedStages}
            onToggle={toggleStage}
            currentUserId={userId}
            evalComment={evalComment}
            setEvalComment={setEvalComment}
            evalScore={evalScore}
            setEvalScore={setEvalScore}
            onSubmit={submitEvaluation}
            saving={savingEval}
            onEdit={startEditEval}
            onDelete={deleteEvaluation}
          />
          </section>

          {!app.rejected_at && (
            <section style={local.section}>
              <div style={local.stepHead}>
                <span style={{ ...local.stepBadge, background: '#EA580C' }}>{((app.status === 'viewed' || app.status === 'reviewing') && isOwner) ? 3 : 2}</span>
                <span style={local.stepTitle}>{t('company.candidate.step3')}</span>
                <span style={{ ...local.decisionCurrent, marginLeft: 'auto' }}>
                  {t('company.candidate.currentStage')} <strong>{currentStage?.emoji} {t(`company.stage.${app.status}`)}</strong>
                </span>
              </div>
              <div style={local.stepper}>
                {STAGES.map((s, i) => {
                  const cidx = STAGE_ORDER.indexOf(app.status);
                  const isCurrent = i === cidx;
                  const isPast = i < cidx;
                  return (
                    <Fragment key={s.key}>
                      {i > 0 && <div style={(isPast || isCurrent) ? local.connDone : local.conn} />}
                      <div
                        style={{ ...local.dot, ...(isCurrent ? local.dotCurrent : isPast ? local.dotPast : local.dotFuture) }}
                        title={t(`company.stage.${s.key}`)}
                      >{s.emoji}</div>
                    </Fragment>
                  );
                })}
              </div>
              {app.status === 'decided' ? (
                <div style={local.finalPassCard}>
                  <div style={local.finalPassTitle}>{t('company.candidate.finalPass')}</div>
                  <div style={local.finalPassSub}>{t('company.candidate.finalPassSub')}</div>
                </div>
              ) : (
                <div style={local.decisionRow}>
                  {isOwner ? (
                    <>
                      {nextStage && (
                        <button onClick={moveNext} style={local.btnAdvance}>
                          {t('company.candidate.nextShort', { emoji: nextStage.emoji, label: t(`company.stage.${nextStage.key}`) })}
                        </button>
                      )}
                      <button onClick={() => setRejectModal('new')} style={local.btnRejectSolid}>
                        {t('company.reject.btnShort')}
                      </button>
                    </>
                  ) : (
                    <>
                      {nextStage && (
                        <button disabled style={local.btnDecisionLocked}>
                          {t('company.candidate.nextShortLocked', { label: t(`company.stage.${nextStage.key}`) })}
                        </button>
                      )}
                      <button disabled style={local.btnDecisionLocked}>
                        {t('company.reject.btnShortLocked')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {app.rejected_at && (
            <section style={local.section}>
              <div style={local.rejectedCard}>
                <div style={local.rejectedHead}>
                  <div style={local.rejectedTitle}>
                    {t('company.candidate.rejectedAt', {
                      date: new Date(app.rejected_at).toLocaleDateString(),
                      stage: t(`company.stage.${app.rejected_at_stage || app.status}`),
                    })}
                  </div>
                  {isOwner && (
                    <div style={local.rejectedActions}>
                      <button onClick={() => setRejectModal('edit')} style={local.rejectedEditBtn}>
                        {t('company.reject.editBtn')}
                      </button>
                      <button onClick={() => setRejectModal('unreject')} style={local.rejectedUnrejectBtn}>
                        {t('company.reject.unrejectBtn')}
                      </button>
                    </div>
                  )}
                </div>
                {app.rejection_reason && (
                  <div style={local.rejectedReason}>
                    {t('company.candidate.rejectedReason', {
                      reason: app.rejection_reason === 'other'
                        ? (app.rejection_note || '—')
                        : t(`company.reject.reason.${app.rejection_reason}`),
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {(() => {
            const showInterview = !app.rejected_at && (app.status === 'viewed' || app.status === 'reviewing') && isOwner;
            const lastStep = app.rejected_at ? 2 : (showInterview ? 4 : 3);
            const defaultTpl = app.rejected_at ? 'reject'
              : app.status === 'pending' ? 'received'
              : (app.status === 'viewed' || app.status === 'reviewing') ? 'interview'
              : 'offer';
            return (
              <section style={local.section}>
                <div style={local.stepHead}>
                  <span style={{ ...local.stepBadge, background: '#0891B2' }}>{lastStep}</span>
                  <span style={local.stepTitle}>{t('company.candidate.step4')}</span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setMailModal({ templateKey: defaultTpl, withSlots: defaultTpl === 'interview' })}
                    style={local.btnMailCompose}
                  >
                    {t('company.candidate.mailComposeBtn')}
                  </button>
                )}
                <div style={local.mailLogWrap}>
                  <div style={local.mailLogH}>{t('company.candidate.mailLogH')} ({mailLog.length})</div>
                  {mailLog.length === 0 ? (
                    <div style={local.mailLogEmpty}>{t('company.candidate.mailLogEmpty')}</div>
                  ) : (
                    <div style={local.mailLogList}>
                      {mailLog.map(m => {
                        // template_key는 새 시스템에선 사람이 읽을 수 있는 템플릿 이름, 옛 시스템에선 'received' 같은 키
                        const legacyTpl = m.template_key && ['received', 'interview', 'offer', 'reject'].includes(m.template_key);
                        const tplLabel = legacyTpl ? t(`company.tpl.${m.template_key}.label`) : (m.template_key || '—');
                        const when = new Date(m.created_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={m.id} style={local.mailLogRow}>
                            <span style={local.mailLogTpl}>{tplLabel}</span>
                            <span style={local.mailLogTime}>{when}</span>
                            {m.subject && <div style={local.mailLogSubject}>{m.subject}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })()}
        </aside>
      </div>

      {mailModal && (
        <MailComposer
          candidateName={name}
          candidateEmail={email}
          jobTitle={job.title}
          companyName={companyName}
          companyId={job?.company_id}
          applicationId={app.id}
          stage={app.status}
          stageNote={t('company.ats.stageNote', { stage: t(`company.stage.${app.status}`) })}
          onClose={() => setMailModal(null)}
          onSent={() => { setMailModal(null); reloadMailLog(app.id); }}
        />
      )}

      {interviewModal && (
        <InterviewConfirmModal
          app={app}
          onClose={() => setInterviewModal(false)}
          onSaved={(payload) => {
            setApp({ ...app, ...payload });
            onStageChange?.(app.id, payload);
            setInterviewModal(false);
          }}
        />
      )}

      {rejectModal && (
        <RejectionModal
          app={app}
          stageKey={rejectModal === 'new' ? app.status : (app.rejected_at_stage || app.status)}
          candidateName={name}
          mode={rejectModal}
          initialReason={rejectModal === 'edit' ? app.rejection_reason : ''}
          initialNote={rejectModal === 'edit' ? app.rejection_note : ''}
          onClose={() => setRejectModal(null)}
          onSaved={(payload) => {
            setApp({ ...app, ...payload });
            onStageChange?.(app.id, payload);
            setRejectModal(null);
          }}
        />
      )}

      {editingEval && (
        <div style={modal.overlay} onClick={() => setEditingEval(null)}>
          <div style={modal.box} onClick={(e) => e.stopPropagation()}>
            <header style={modal.head}>
              <h2 style={modal.h}>{t('company.eval.editH')}</h2>
              <button onClick={() => setEditingEval(null)} style={modal.closeBtn}>✕</button>
            </header>
            <div style={modal.body}>
              <div style={modal.field}>
                <label style={modal.label}>{t('company.candidate.note')}</label>
                <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={4} style={{ ...modal.inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={modal.field}>
                <label style={modal.label}>{t('company.eval.scorePh')}</label>
                <input type="number" min={0} max={100} value={editScore} onChange={(e) => setEditScore(e.target.value)} style={{ ...modal.inp, width: 120 }} />
              </div>
            </div>
            <footer style={modal.foot}>
              <button onClick={() => setEditingEval(null)} style={modal.btnGhost}>{t('company.cancel')}</button>
              <button onClick={saveEditEval} disabled={savingEdit} style={savingEdit ? modal.btnDisabled : modal.btnPrimary}>
                {savingEdit ? t('company.savingShort') : t('company.eval.editBtn')}
              </button>
            </footer>
          </div>
        </div>
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

function avgScore(list) {
  const scored = list.filter(e => typeof e.score === 'number');
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length);
}

function formatEvalTime(ts) {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

function EvaluationSection({
  t, stages, currentStage, evals, expandedStages, onToggle, currentUserId,
  evalComment, setEvalComment, evalScore, setEvalScore, onSubmit, saving,
  onEdit, onDelete,
}) {
  const currentStageLabel = t(`company.stage.${currentStage}`);
  const myCurrentEval = evals.find(e => e.stage === currentStage && e.reviewer_user_id === currentUserId);

  return (
    <>
      <div style={ev.cards}>
        {stages.map(s => {
          const stageEvals = evals.filter(e => e.stage === s.key);
          const avg = avgScore(stageEvals);
          const expanded = expandedStages.has(s.key);
          return (
            <div key={s.key} style={ev.stageCard}>
              <button
                onClick={() => onToggle(s.key)}
                style={{ ...ev.stageHead, ...(s.key === currentStage ? ev.stageHeadCurrent : {}) }}
              >
                <span style={ev.stageEmoji}>{s.emoji}</span>
                <span style={ev.stageLabel}>{t(`company.stage.${s.key}`)}</span>
                <span style={avg != null ? ev.avgBadge : ev.notRatedBadge}>
                  {avg != null ? t('company.eval.avgScore', { n: avg }) : t('company.eval.notRated')}
                </span>
                <span style={ev.toggleIcon}>{expanded ? '▾' : '▸'}</span>
              </button>
              {expanded && (
                <div style={ev.stageBody}>
                  {stageEvals.map(e => {
                    const isMe = e.reviewer_user_id === currentUserId;
                    const isOwnerRole = e.reviewer_role === 'owner';
                    return (
                      <div key={e.id} style={ev.reviewer}>
                        <div style={ev.reviewerHead}>
                          <span style={ev.reviewerName}>
                            {isMe ? `${t('company.eval.me')} (${e.reviewer_name || ''})` : (e.reviewer_name || '—')}
                          </span>
                          <span style={isOwnerRole ? ev.roleTagOwner : ev.roleTagInterviewer}>
                            {t(`company.eval.role.${isOwnerRole ? 'owner' : 'interviewer'}`)}
                          </span>
                          <span style={ev.reviewerTime}>{formatEvalTime(e.created_at)}</span>
                          {isMe && (
                            <span style={ev.evalActions}>
                              <button onClick={() => onEdit(e)} style={ev.evalActionBtn}>{t('company.eval.editBtn')}</button>
                              <button onClick={() => onDelete(e)} style={ev.evalActionBtn}>{t('company.eval.deleteBtn')}</button>
                            </span>
                          )}
                        </div>
                        <div style={ev.reviewerBody}>
                          <span style={ev.comment}>{e.comment}</span>
                          {typeof e.score === 'number' && (
                            <span style={ev.scoreBadge}>{e.score}{t('company.eval.scoreUnit')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {stageEvals.length === 0 && s.key !== currentStage && (
                    <div style={ev.empty}>{t('company.eval.empty')}</div>
                  )}
                  {s.key === currentStage && (
                    <div style={ev.form}>
                      <textarea
                        value={evalComment}
                        onChange={(e) => setEvalComment(e.target.value)}
                        placeholder={t('company.eval.placeholder', { stage: currentStageLabel })}
                        rows={3}
                        style={ev.formText}
                      />
                      <div style={ev.formRow}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={evalScore}
                          onChange={(e) => setEvalScore(e.target.value)}
                          placeholder={t('company.eval.scorePh')}
                          style={ev.formScore}
                        />
                        <button
                          onClick={onSubmit}
                          disabled={saving || !evalComment.trim()}
                          style={(saving || !evalComment.trim()) ? ev.submitDisabled : ev.submit}
                        >
                          {saving ? '...' : (myCurrentEval ? t('company.eval.update') : t('company.eval.submit'))}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const ev = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sub: { fontSize: 11, color: '#94A3B8', fontWeight: 600 },
  cards: { display: 'flex', flexDirection: 'column', gap: 6 },
  stageCard: { background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' },
  stageHead: { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#FAFAFA', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  stageHeadCurrent: { background: '#FFF7ED' },
  stageEmoji: { fontSize: 14 },
  stageLabel: { fontSize: 12, fontWeight: 800, color: '#1A1A1A', flex: 1 },
  toggleIcon: { fontSize: 10, color: '#94A3B8' },
  avgBadge: { fontSize: 10.5, fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '3px 7px', borderRadius: 999 },
  notRatedBadge: { fontSize: 10.5, fontWeight: 700, color: '#94A3B8', background: '#fff', border: '1px dashed #D1D5DB', padding: '2px 7px', borderRadius: 999 },
  stageBody: { padding: '8px 10px 10px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 },
  empty: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' },
  reviewer: { background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 9px' },
  reviewerHead: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  reviewerName: { fontSize: 11.5, fontWeight: 700, color: '#1A1A1A' },
  reviewerTime: { marginLeft: 'auto', fontSize: 10.5, color: '#94A3B8' },
  roleTagOwner: { fontSize: 9.5, fontWeight: 800, color: '#EA580C', background: '#FFF7ED', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(249,115,22,0.3)' },
  roleTagInterviewer: { fontSize: 9.5, fontWeight: 800, color: '#0369A1', background: '#F0F9FF', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(14,165,233,0.3)' },
  reviewerBody: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  comment: { fontSize: 12, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap', flex: 1 },
  scoreBadge: { fontSize: 10.5, fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '3px 7px', borderRadius: 4, flexShrink: 0 },
  form: { marginTop: 10, padding: 10, background: '#FAFAFA', border: '1px dashed #D1D5DB', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  formText: { width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fff' },
  formRow: { display: 'flex', gap: 8, alignItems: 'center' },
  formScore: { width: 80, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', boxSizing: 'border-box' },
  submit: { marginLeft: 'auto', padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563EB', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  submitDisabled: { marginLeft: 'auto', padding: '8px 16px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F1F5F9', color: '#94A3B8', fontSize: 12, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' },
  evalActions: { display: 'flex', gap: 4 },
  evalActionBtn: { padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#525252', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' },
};

function InterviewModal({ app, onClose, onSaved }) {
  const { t, lang } = useT();
  const [slots, setSlots] = useState([{ date: '', time: '14:00' }]);
  const [location, setLocation] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const updateSlot = (i, field, value) => {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };
  const addSlot = () => {
    setSlots(prev => prev.length >= 3 ? prev : [...prev, { date: '', time: '14:00' }]);
  };
  const removeSlot = (i) => {
    setSlots(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    const validSlots = slots.filter(s => s.date);
    if (validSlots.length === 0) { setErr(t('company.err.dateRequired')); return; }
    setSaving(true);
    const slotLines = validSlots.map((s, i) => `${i + 1}) ${s.date} ${s.time || '00:00'}`).join('\n');
    const summary = `[Interview]\n📅 ${t('company.interview.slotsTitle')}:\n${slotLines}\n📍 ${location || '—'}\n👤 ${interviewer || '—'}\n\n${app.admin_note || ''}`;
    const first = validSlots[0];
    const { error } = await supabase.from('job_applications').update({
      admin_note: summary,
      interview_at: ictInputToUtc(first.date, first.time || '00:00'),
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
          <div style={modal.field}>
            <label style={modal.label}>{t('company.interview.locLabel')}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('company.interview.locPh')} style={modal.inp} />
          </div>
          <div style={modal.field}>
            <label style={modal.label}>{t('company.interview.interviewerLabel')}</label>
            <input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder={t('company.interview.interviewerPh')} style={modal.inp} />
          </div>
          <div style={modal.field}>
            <label style={modal.label}>{t('company.interview.slotsLabel')}</label>
            {slots.map((s, i) => (
              <div key={i} style={slot.row}>
                <span style={slot.num}>{i + 1}</span>
                <input type="date" lang={lang} value={s.date} onChange={(e) => updateSlot(i, 'date', e.target.value)} style={{ ...modal.inp, flex: 1 }} />
                <input type="time" lang={lang} value={s.time} onChange={(e) => updateSlot(i, 'time', e.target.value)} style={{ ...modal.inp, width: 110 }} />
                {slots.length > 1 && (
                  <button type="button" onClick={() => removeSlot(i)} style={slot.removeBtn} title={t('company.interview.removeSlot')}>✕</button>
                )}
              </div>
            ))}
            {slots.length < 3 && (
              <button type="button" onClick={addSlot} style={slot.addBtn}>{t('company.interview.addSlot')}</button>
            )}
          </div>
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

const slot = {
  row: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  num: { width: 16, fontSize: 12, fontWeight: 800, color: '#525252' },
  removeBtn: { padding: '6px 10px', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { marginTop: 4, padding: '8px 12px', background: '#F8FAFC', border: '1px dashed #D1D5DB', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#525252', cursor: 'pointer', fontFamily: 'inherit' },
};

function formatSlots(slots) {
  const valid = slots.filter(s => s?.date);
  if (valid.length === 0) return '';
  return valid.map((s, i) => `${i + 1}) ${s.date} ${s.time || '00:00'} ${ICT_LABEL}`).join('\n');
}

function fillVars(text, vars) {
  const round = vars.stage === 'viewed' ? (vars.lang === 'vi' ? 'Phỏng vấn vòng 1' : '1차 인터뷰')
              : vars.stage === 'reviewing' ? (vars.lang === 'vi' ? 'Phỏng vấn vòng 2' : '2차 인터뷰')
              : (vars.lang === 'vi' ? 'Phỏng vấn' : '인터뷰');
  return (text || '')
    .split('{후보이름}').join(vars.name)
    .split('{공고명}').join(vars.jobTitle)
    .split('{회사명}').join(vars.companyName || '—')
    .split('{인터뷰일정}').join(vars.slotsText || '')
    .split('{차수인터뷰}').join(round);
}

export function MailComposer({
  candidateName, candidateEmail, jobTitle, companyName, companyId,
  applicationId, stage, stageNote, onClose, onSent,
}) {
  const { t, lang } = useT();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [slots, setSlots] = useState([{ date: '', time: '14:00' }, { date: '', time: '14:00' }, { date: '', time: '14:00' }]);
  const [showSlots, setShowSlots] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      const { data } = await supabase
        .from('recruiter_mail_templates')
        .select('id, created_by, name, subject, body')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      setTemplates(data || []);
    })();
  }, [companyId]);

  const slotsText = showSlots ? formatSlots(slots) : '';
  const vars = { name: candidateName, jobTitle, companyName, slotsText, stage, lang };

  const pickTemplate = (id) => {
    setSelectedId(id);
    if (!id) { setSubject(''); setBody(''); return; }
    const tpl = templates.find(x => x.id === id);
    if (!tpl) return;
    setSubject(fillVars(tpl.subject, { ...vars, slotsText: showSlots ? slotsText : '{인터뷰일정}' }));
    setBody(fillVars(tpl.body, { ...vars, slotsText: showSlots ? slotsText : '{인터뷰일정}' }));
  };

  // 슬롯 변경 시 본문/제목의 {인터뷰일정} 부분 갱신 — 사용자가 직접 편집해도 변수가 남아있으면 치환
  useEffect(() => {
    if (!showSlots) return;
    setSubject(prev => prev.split('{인터뷰일정}').join(slotsText));
    setBody(prev => prev.split('{인터뷰일정}').join(slotsText));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsText, showSlots]);

  const updateSlot = (i, field, value) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const send = async () => {
    setErr('');
    if (!applicationId) { setErr(t('company.err.noAppId')); return; }
    if (!subject.trim() || !body.trim()) { setErr(t('company.mail.tplSaveErrFields')); return; }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tplName = selectedId ? (templates.find(x => x.id === selectedId)?.name || '') : '';
      const res = await fetch('/api/company/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ appId: applicationId, subject, body, templateKey: tplName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error || t('company.err.mailFail')); setSending(false); return; }

      if (showSlots) {
        const valid = slots.filter(s => s?.date);
        if (valid.length > 0) {
          const first = valid[0];
          const slotLines = valid.map((s, i) => `${i + 1}) ${s.date} ${s.time || '00:00'} ${ICT_LABEL}`).join('\n');
          const noteSummary = `[Interview]\n📅 ${t('company.interview.slotsTitle')}:\n${slotLines}`;
          await supabase.from('job_applications').update({
            interview_at: ictInputToUtc(first.date, first.time || '00:00'),
            admin_note: noteSummary,
          }).eq('id', applicationId);
        }
      }

      onSent?.();
      onClose();
    } catch (e) {
      setErr(t('company.err.mailErr') + (e?.message || ''));
      setSending(false);
    }
  };

  const saveAsTemplate = async () => {
    setErr('');
    if (!newTplName.trim()) { setErr(t('company.mail.tplSaveErrName')); return; }
    if (!subject.trim() || !body.trim()) { setErr(t('company.mail.tplSaveErrFields')); return; }
    setSavingTpl(true);
    const { data, error } = await supabase
      .from('recruiter_mail_templates')
      .insert({ company_id: companyId, created_by: userId, name: newTplName.trim(), subject, body })
      .select('id, created_by, name, subject, body').single();
    setSavingTpl(false);
    if (error) { setErr(t('company.mail.tplSaveErr') + error.message); return; }
    setTemplates(prev => [...prev, data]);
    setSelectedId(data.id);
    setShowSaveDialog(false);
    setNewTplName('');
  };

  const deleteTemplate = async (tpl) => {
    if (!tpl.created_by) { setErr(t('company.mail.tplDeleteSystem')); return; }
    if (!window.confirm(t('company.mail.tplDeleteConfirm', { name: tpl.name }))) return;
    const { error } = await supabase.from('recruiter_mail_templates').delete().eq('id', tpl.id);
    if (error) { setErr(error.message); return; }
    setTemplates(prev => prev.filter(x => x.id !== tpl.id));
    if (selectedId === tpl.id) { setSelectedId(''); setSubject(''); setBody(''); }
  };

  const openMailApp = () => {
    window.location.href = `mailto:${encodeURIComponent(candidateEmail)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const selectedTpl = templates.find(x => x.id === selectedId);
  const canDeleteSelected = !!(selectedTpl && selectedTpl.created_by === userId);

  return (
    <div style={modal.overlay} onClick={sending ? undefined : onClose}>
      <div style={{ ...modal.box, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{t('company.mail.h')}</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          {stageNote && <div style={mc.stageNote}>{stageNote}</div>}

          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.tplLabel')}</label>
            <div style={mc.tplPickerRow}>
              <select value={selectedId} onChange={(e) => pickTemplate(e.target.value)} style={{ ...modal.inp, flex: 1 }}>
                <option value="">{t('company.mail.tplBlank')}</option>
                {templates.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name}{!x.created_by ? ` (${t('company.mail.systemTplBadge')})` : ''}
                  </option>
                ))}
              </select>
              {selectedId && canDeleteSelected && (
                <button onClick={() => deleteTemplate(selectedTpl)} style={mc.tplDeleteBtn} title={t('company.mail.tplDeleteBtn')}>🗑</button>
              )}
            </div>
          </div>

          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.to')}</label>
            <input value={candidateEmail} readOnly style={{ ...modal.inp, background: '#F1F5F9', color: '#737373' }} />
          </div>

          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.subject')}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={modal.inp} />
          </div>

          <label style={mc.slotsToggle}>
            <input type="checkbox" checked={showSlots} onChange={(e) => setShowSlots(e.target.checked)} />
            <span>{t('company.mail.slotsToggle')}</span>
          </label>
          {showSlots && (
            <div style={modal.field}>
              {slots.slice(0, 3).map((s, i) => (
                <div key={i} style={slot.row}>
                  <span style={slot.num}>{i + 1}</span>
                  <input type="date" lang={lang} value={s.date} onChange={(e) => updateSlot(i, 'date', e.target.value)} style={{ ...modal.inp, flex: 1 }} />
                  <input type="time" lang={lang} value={s.time} onChange={(e) => updateSlot(i, 'time', e.target.value)} style={{ ...modal.inp, width: 110 }} />
                </div>
              ))}
              <p style={modal.hint}>{t('company.mail.slotsHint')}</p>
            </div>
          )}

          <div style={modal.field}>
            <label style={modal.label}>{t('company.mail.body')}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              style={{ ...modal.inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
            <p style={modal.hint}>{t('company.mail.varsHint')}</p>
          </div>

          {showSaveDialog ? (
            <div style={mc.saveDialog}>
              <div style={mc.saveDialogH}>{t('company.mail.tplSaveTitle')}</div>
              <input
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                placeholder={t('company.mail.tplSaveNamePh')}
                style={modal.inp}
                autoFocus
              />
              <div style={mc.saveDialogActions}>
                <button onClick={() => { setShowSaveDialog(false); setNewTplName(''); setErr(''); }} style={modal.btnGhost} disabled={savingTpl}>
                  {t('company.cancel')}
                </button>
                <button onClick={saveAsTemplate} disabled={savingTpl} style={savingTpl ? modal.btnDisabled : modal.btnPrimary}>
                  {savingTpl ? t('company.savingShort') : t('company.mail.tplSaveSaveBtn')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowSaveDialog(true)} style={mc.saveAsTplBtn}>
              {t('company.mail.tplSaveBtn')}
            </button>
          )}

          {err && <div style={local.errBox}>{err}</div>}
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

export function ConfirmModal({ title, message, confirmLabel, cancelLabel, tone = 'primary', variant = 'confirm', onConfirm, onCancel }) {
  const { t } = useT();
  const isAlert = variant === 'alert';
  const confirmStyle = tone === 'danger' ? modal.btnDanger : modal.btnPrimary;
  return (
    <div style={modal.overlay} onClick={onCancel}>
      <div style={{ ...modal.box, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{title}</h2>
          <button onClick={onCancel} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          <p style={cm.message}>{message}</p>
        </div>
        <footer style={modal.foot}>
          {!isAlert && (
            <button onClick={onCancel} style={modal.btnGhost}>
              {cancelLabel || t('company.cancel')}
            </button>
          )}
          <button onClick={onConfirm} style={confirmStyle || modal.btnPrimary}>
            {confirmLabel || t('company.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
}

const cm = {
  message: { fontSize: 13.5, color: '#1A1A1A', lineHeight: 1.65, whiteSpace: 'pre-line', margin: 0 },
};

export function InterviewConfirmModal({ app, onClose, onSaved }) {
  const { t, lang } = useT();
  const initial = utcToIctInput(app.interview_at);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [location, setLocation] = useState(app.interview_location || '');
  const [interviewer, setInterviewer] = useState(app.interview_interviewer || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!app.interview_at;

  const save = async () => {
    setErr('');
    if (!date) { setErr(t('company.interview.confirmErrDate')); return; }
    setSaving(true);
    const payload = {
      interview_at: ictInputToUtc(date, time || '00:00'),
      interview_location: location.trim() || null,
      interview_interviewer: interviewer.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('job_applications').update(payload).eq('id', app.id);
    setSaving(false);
    if (error) { setErr(t('company.err.saveFailed') + error.message); return; }
    onSaved(payload);
  };

  const clear = async () => {
    if (!window.confirm(t('company.interview.confirmClear') + '?')) return;
    setSaving(true);
    const payload = {
      interview_at: null,
      interview_location: null,
      interview_interviewer: null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('job_applications').update(payload).eq('id', app.id);
    setSaving(false);
    if (error) { setErr(t('company.err.saveFailed') + error.message); return; }
    onSaved(payload);
  };

  return (
    <div style={modal.overlay} onClick={saving ? undefined : onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{t('company.interview.confirmH')}</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          <p style={modal.hint}>{t('company.interview.confirmSub')}</p>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...modal.field, flex: 1 }}>
              <label style={modal.label}>{t('company.interview.confirmDateLabel')}</label>
              <input type="date" lang={lang} value={date} onChange={(e) => setDate(e.target.value)} style={modal.inp} disabled={saving} />
            </div>
            <div style={{ ...modal.field, width: 140 }}>
              <label style={modal.label}>{t('company.interview.confirmTimeLabel')}</label>
              <input type="time" lang={lang} value={time} onChange={(e) => setTime(e.target.value)} style={modal.inp} disabled={saving} />
            </div>
          </div>

          <div style={modal.field}>
            <label style={modal.label}>{t('company.interview.locLabel')}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('company.interview.locPh')} style={modal.inp} disabled={saving} />
          </div>

          <div style={modal.field}>
            <label style={modal.label}>{t('company.interview.interviewerLabel')}</label>
            <input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder={t('company.interview.interviewerPh')} style={modal.inp} disabled={saving} />
          </div>

          {err && <div style={local.errBox}>{err}</div>}
        </div>
        <footer style={modal.foot}>
          {isEdit && (
            <button onClick={clear} style={{ ...modal.btnGhost, color: '#B91C1C', borderColor: '#FCA5A5', marginRight: 'auto' }} disabled={saving}>
              {t('company.interview.confirmClear')}
            </button>
          )}
          <button onClick={onClose} style={modal.btnGhost} disabled={saving}>{t('company.cancel')}</button>
          <button onClick={save} disabled={saving} style={saving ? modal.btnDisabled : modal.btnPrimary}>
            {saving ? t('company.savingShort') : t('company.interview.confirmSave')}
          </button>
        </footer>
      </div>
    </div>
  );
}

const REJECT_REASONS = ['not_fit', 'comp_mismatch', 'withdrew', 'spam', 'other'];

export function RejectionModal({ app, stageKey, candidateName, mode = 'new', initialReason = '', initialNote = '', onClose, onSaved }) {
  const { t } = useT();
  const isEdit = mode === 'edit';
  const isUnreject = mode === 'unreject';
  const [reason, setReason] = useState(initialReason || '');
  const [note, setNote] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const stageLabel = t(`company.stage.${stageKey}`);

  const save = async () => {
    setErr('');
    if (isUnreject) {
      setSaving(true);
      const payload = {
        rejected_at: null,
        rejected_at_stage: null,
        rejection_reason: null,
        rejection_note: null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('job_applications').update(payload).eq('id', app.id);
      setSaving(false);
      if (error) { setErr(t('company.reject.errSave') + error.message); return; }
      onSaved(payload);
      return;
    }
    if (!reason) { setErr(t('company.reject.errReason')); return; }
    if (reason === 'other' && !note.trim()) { setErr(t('company.reject.errNote')); return; }
    setSaving(true);
    const payload = {
      rejection_reason: reason,
      rejection_note: reason === 'other' ? note.trim() : null,
      updated_at: new Date().toISOString(),
    };
    if (!isEdit) {
      payload.rejected_at = new Date().toISOString();
      payload.rejected_at_stage = stageKey;
    }
    const { error } = await supabase.from('job_applications').update(payload).eq('id', app.id);
    setSaving(false);
    if (error) { setErr(t('company.reject.errSave') + error.message); return; }
    onSaved(payload);
  };

  return (
    <div style={modal.overlay} onClick={saving ? undefined : onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{isUnreject ? t('company.reject.unrejectH') : isEdit ? t('company.reject.editH') : t('company.reject.h')}</h2>
          <button onClick={onClose} style={modal.closeBtn}>✕</button>
        </header>
        <div style={modal.body}>
          {isUnreject ? (
            <div style={rj.subBanner}>
              {t('company.reject.unrejectMsg', { name: candidateName, stage: stageLabel })}
            </div>
          ) : (
            <>
              <div style={rj.subBanner}>
                {t('company.reject.sub', { name: candidateName, stage: stageLabel })}
              </div>

              <div style={modal.field}>
                <label style={modal.label}>{t('company.reject.reasonLabel')}</label>
                <div style={rj.radioGroup}>
                  {REJECT_REASONS.map(r => (
                    <label key={r} style={rj.radioRow}>
                      <input
                        type="radio"
                        name="reject-reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        disabled={saving}
                      />
                      <span>{t(`company.reject.reason.${r}`)}</span>
                    </label>
                  ))}
                </div>
                {reason === 'other' && (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('company.reject.notePh')}
                    style={modal.inp}
                    disabled={saving}
                  />
                )}
                <p style={modal.hint}>{t('company.reject.reasonHint')}</p>
              </div>

            </>
          )}

          {err && <div style={local.errBox}>{err}</div>}
        </div>
        <footer style={modal.foot}>
          <button onClick={onClose} style={modal.btnGhost} disabled={saving}>
            {t('company.cancel')}
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={saving ? modal.btnDisabled : modal.btnPrimary}>
            {saving ? t('company.savingShort') : (
              isUnreject
                ? t('company.reject.unrejectConfirm')
                : isEdit
                  ? t('company.reject.editSave')
                  : t('company.reject.confirm')
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

const rj = {
  subBanner: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' },
  radioRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1A1A1A' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1A1A1A', fontWeight: 600, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' },
};

const mc = {
  stageNote: { background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', padding: '9px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 },
  tplPickerRow: { display: 'flex', gap: 6, alignItems: 'center' },
  tplDeleteBtn: { padding: '8px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', color: '#B91C1C', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  slotsToggle: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1A1A1A', fontWeight: 600, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E5E7EB' },
  saveAsTplBtn: { alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8, border: '1px dashed #BFDBFE', background: '#fff', color: '#1D4ED8', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  saveDialog: { padding: '12px 14px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  saveDialogH: { fontSize: 12.5, fontWeight: 800, color: '#0C4A6E' },
  saveDialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 6 },
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

  interviewerHint: { padding: '10px 12px', borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1', fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  btnLocked: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px dashed #D1D5DB', background: '#F8FAFC', color: '#94A3B8', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' },
  btnReject: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#fff', color: '#B91C1C', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  decisionLabel: { fontSize: 11, fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: 0.4 },
  stepHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  stepBadge: { width: 22, height: 22, borderRadius: '50%', color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', fontFamily: 'inherit', flexShrink: 0 },
  stepTitle: { fontSize: 14, fontWeight: 800, color: '#1A1A1A' },
  decisionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  decisionCurrent: { fontSize: 11.5, color: '#525252', fontWeight: 600 },
  stepper: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 12px', gap: 0 },
  dot: { width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 14, background: '#F1F5F9', border: '1.5px solid #E5E7EB', flexShrink: 0 },
  dotCurrent: { background: '#FFF7ED', border: '2px solid #EA580C', boxShadow: '0 0 0 4px rgba(234,88,12,0.18)', transform: 'scale(1.05)' },
  dotPast: { background: '#ECFDF5', border: '1.5px solid #A7F3D0', opacity: 0.95 },
  dotFuture: { opacity: 0.5 },
  conn: { flex: 1, height: 2, background: '#E5E7EB', margin: '0 4px' },
  connDone: { flex: 1, height: 2, background: '#A7F3D0', margin: '0 4px' },
  decisionRow: { display: 'flex', gap: 8 },
  btnAdvance: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnRejectSolid: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#B91C1C)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(185,28,28,0.22)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnDecisionLocked: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 8, border: '1px dashed #D1D5DB', background: '#F8FAFC', color: '#94A3B8', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  finalPassCard: { padding: '16px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', border: '1px solid #6EE7B7', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center' },
  finalPassTitle: { fontSize: 15, fontWeight: 900, color: '#047857' },
  finalPassSub: { fontSize: 11.5, fontWeight: 600, color: '#065F46' },
  rejectedCard: { padding: '12px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: 4 },
  rejectedHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rejectedTitle: { fontSize: 12.5, fontWeight: 800, color: '#991B1B' },
  rejectedReason: { fontSize: 12, fontWeight: 600, color: '#7F1D1D' },
  btnInterview: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  interviewCard: { padding: '12px 14px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', flexDirection: 'column', gap: 4 },
  interviewCardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  interviewCardTitle: { fontSize: 13, fontWeight: 800, color: '#1E3A8A' },
  interviewEditBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#fff', color: '#1D4ED8', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  interviewMeta: { fontSize: 12, color: '#1E40AF', fontWeight: 600 },
  btnMailCompose: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 },
  mailLogWrap: { marginTop: 4 },
  mailLogH: { fontSize: 11, fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  mailLogEmpty: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: '8px 0' },
  mailLogList: { display: 'flex', flexDirection: 'column', gap: 6 },
  mailLogRow: { padding: '8px 10px', background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 2 },
  mailLogTpl: { fontSize: 12, fontWeight: 800, color: '#1A1A1A' },
  mailLogTime: { fontSize: 10.5, color: '#737373', fontWeight: 600 },
  mailLogSubject: { fontSize: 11.5, color: '#525252', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rejectedActions: { display: 'flex', gap: 6, flexShrink: 0 },
  rejectedEditBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#fff', color: '#B91C1C', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  rejectedUnrejectBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#fff', color: '#1D4ED8', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
};

const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 },
  box: { background: '#fff', borderRadius: 14, maxWidth: 480, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 },
  h: { fontSize: 17, fontWeight: 800, color: '#1A1A1A' },
  closeBtn: { padding: 4, background: 'transparent', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1, minHeight: 0 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#525252', fontWeight: 700 },
  inp: { padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit', boxSizing: 'border-box' },
  hint: { fontSize: 11.5, color: '#737373', marginTop: 4, lineHeight: 1.55 },
  foot: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #E5E7EB', flexShrink: 0 },
  btnPrimary: { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#DC2626,#B91C1C)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#E5E7EB', color: '#94A3B8', fontSize: 13, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' },
};
