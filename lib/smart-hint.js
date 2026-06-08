import { formatInterviewShort } from './timezone';

// Centralized "next action" logic shared between the candidate panel's
// Smart Hint and the to-do feed at /company/todo.
//
// Input: { app, evals, mailLog, isOwner, t }
//   app:     job_applications row (status, interview_at, rejected_at, ...)
//   evals:   application_evaluations rows for this candidate
//   mailLog: mail rows for this candidate
//   isOwner: viewer role (true = 공고 관리자, false = 면접관)
//   t:       useT() translator from the caller (required for i18n)
//
// Returns: { kind, title, tone, stage } | null
//   kind:  'evaluate' | 'decide' | 'advance' | 'schedule' | 'await_interview'
//          | 'send_offer_mail' | 'send_reject_mail' | 'follow_up' | null
//   title: short translated sentence (matches the SmartHint card title)
//   tone:  'primary' | 'green' | 'red' | 'gray' | 'sky'
//   stage: 'pending' | 'viewed' | 'reviewing' | 'decided' | 'rejected'

// Fallback (identity) translator when no `t` is provided — keeps callers that
// haven't been wired up yet from crashing. Uses the Korean string as-is.
const fallbackT = (_key, _vars) => '';

export function nextActionFor({ app, evals = [], mailLog = [], isOwner = true, t = fallbackT }) {
  if (!app) return null;

  const stageLabel = (key) => t(`company.smartStage.${key}`);

  const hasAnyEvalThisStage = evals.some(e => e.stage === app.status);
  const myEvalThisStage = evals.find(e => e.stage === app.status); // any reviewer
  const interviewPast = app.interview_at && new Date(app.interview_at).getTime() < Date.now();
  const hasStagePassRow = evals.some(e => e.stage === `${app.status}_pass`);

  // Mail tracking uses the canonical preset keys saved by MailComposer.send().
  // 'final_offer' = 최종 합격 안내 mail; 'reject' = 불합격 안내 mail. Per-stage
  // pass mails (doc_pass / interview1_pass) are tracked the same way so we can
  // surface "send the pass mail you skipped" when the user picks 나중에 in the
  // post-decision mail prompt.
  const offerMailSent = mailLog.some(m => m.template_key === 'final_offer' || m.template_key === 'offer');
  const rejectMailSent = mailLog.some(m => m.template_key === 'reject');
  const passMailSentFor = (stageKey) => {
    // Stage → preset key mapping mirrors templateKeyForDecision() in CandidateDetail.
    const key = stageKey === 'pending' ? 'doc_pass'
      : stageKey === 'viewed' ? 'interview1_pass'
      : stageKey === 'reviewing' ? 'final_offer'
      : null;
    return key ? mailLog.some(m => m.template_key === key) : false;
  };

  // Rejected — only the rejection mail follow-up matters.
  if (app.rejected_at) {
    if (!rejectMailSent) {
      // Chip shows the stage the candidate was rejected at (e.g. "1차 인터뷰")
      // — "불합격" itself is not a stage. The subtitle ("불합격 안내 메일을 발송하세요")
      // already conveys the rejected status. Falls back to current status only
      // when rejected_at_stage is missing (legacy rows before that column existed).
      return { kind: 'send_reject_mail', title: t('company.todoAction.sendRejectMail'), tone: 'red', stage: app.rejected_at_stage || app.status };
    }
    return null;
  }

  // Interviewer — eval is the only available action.
  if (!isOwner) {
    if (app.status === 'decided') return null;
    if (hasAnyEvalThisStage) return null;
    // Pending stage label is already "서류 평가" — using the generic
    // "{stage} 평가를 작성…" template would produce "서류 평가 평가를 작성…".
    // Use the dedicated docEval copy for pending, writeStageEval for interviews.
    if (app.status === 'pending') {
      return { kind: 'evaluate', title: t('company.todoAction.docEval'), tone: 'primary', stage: 'pending' };
    }
    return {
      kind: 'evaluate',
      title: t('company.todoAction.writeStageEval', { stage: stageLabel(app.status) || app.status }),
      tone: 'primary',
      stage: app.status,
    };
  }

  // Owner — full pipeline.
  if (app.status === 'pending') {
    if (!hasAnyEvalThisStage) {
      return { kind: 'evaluate', title: t('company.todoAction.docEval'), tone: 'primary', stage: 'pending' };
    }
    if (!hasStagePassRow) {
      return { kind: 'decide', title: t('company.todoAction.decideDoc'), tone: 'primary', stage: 'pending' };
    }
    return { kind: 'advance', title: t('company.todoAction.advanceDoc'), tone: 'primary', stage: 'pending' };
  }

  if (app.status === 'viewed' || app.status === 'reviewing') {
    const label = stageLabel(app.status);
    // New policy sync: after a 합격 decision the card auto-advances + the user
    // is prompted to send the pass mail. If they picked "나중에", surface the
    // pending pass mail as the very next action — it announces the next round,
    // so it should ship before the interview is scheduled.
    const prevStage = app.status === 'viewed' ? 'pending' : 'viewed';
    const prevPassRow = evals.some(e => e.stage === `${prevStage}_pass`);
    if (prevPassRow && !passMailSentFor(prevStage)) {
      return {
        kind: 'send_pass_mail',
        title: t('company.todoAction.sendPassMail', { stage: t(`company.smartStage.${prevStage}`) }),
        tone: 'primary',
        stage: prevStage,
      };
    }
    if (!app.interview_at) {
      return { kind: 'schedule', title: t('company.todoAction.scheduleInterview', { stage: label }), tone: 'primary', stage: app.status };
    }
    if (!interviewPast) {
      // Interview is scheduled and waiting — surface it on the to-do feed
      // as a context item (HR likes to see "who's coming up" at a glance).
      return {
        kind: 'await_interview',
        title: t('company.todoAction.awaitInterview', { stage: label, when: formatInterviewShort(app.interview_at) }),
        tone: 'sky',
        stage: app.status,
      };
    }
    if (!hasAnyEvalThisStage) {
      return { kind: 'evaluate', title: t('company.todoAction.writeStageEval', { stage: label }), tone: 'primary', stage: app.status };
    }
    if (!hasStagePassRow) {
      return { kind: 'decide', title: t('company.todoAction.decideStage', { stage: label }), tone: 'primary', stage: app.status };
    }
    const nextKey = app.status === 'viewed' ? 'nextFromViewed' : 'nextFromReviewing';
    return { kind: 'advance', title: t('company.todoAction.advanceStage', { stage: label, next: t(`company.smartStage.${nextKey}`) }), tone: 'primary', stage: app.status };
  }

  if (app.status === 'decided') {
    if (!offerMailSent) {
      return { kind: 'send_offer_mail', title: t('company.todoAction.sendOfferMail'), tone: 'green', stage: 'decided' };
    }
    return { kind: 'follow_up', title: t('company.todoAction.followUp'), tone: 'green', stage: 'decided' };
  }

  return null;
}

// Legacy Korean stage label map — kept for any caller that still imports it
// directly. New code should use t('company.smartStage.<key>') instead.
export const STAGE_LABEL_KO = { pending: '서류 평가', viewed: '1차 인터뷰', reviewing: '2차 인터뷰', decided: '최종 합격', rejected: '불합격' };
