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

  const offerMailSent = mailLog.some(m => m.template_key === 'offer');
  const rejectMailSent = mailLog.some(m => m.template_key === 'reject');

  // Rejected — only the rejection mail follow-up matters.
  if (app.rejected_at) {
    if (!rejectMailSent) {
      return { kind: 'send_reject_mail', title: t('company.todoAction.sendRejectMail'), tone: 'red', stage: 'rejected' };
    }
    return null;
  }

  // Interviewer — eval is the only available action.
  if (!isOwner) {
    if (app.status === 'decided') return null;
    if (hasAnyEvalThisStage) return null;
    return {
      kind: 'evaluate',
      title: t('company.todoAction.evaluate', { stage: stageLabel(app.status) || app.status }),
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
export const STAGE_LABEL_KO = { pending: '서류 평가', viewed: '1차 인터뷰', reviewing: '2차 인터뷰' };
