import { useState, useEffect, useRef, Fragment } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';
import { toast } from 'sonner';
import { formatICT, formatInterviewShort, formatLocalShort, ictInputToUtc, utcToIctInput, ICT_LABEL } from '../../lib/timezone';
import { cn } from '../../lib/cn';
import { Button as UButton } from '../ui/button';
import { Badge as UBadge } from '../ui/badge';
import { Input as UInput } from '../ui/input';
import { Dialog as UDialog, DialogContent as UDialogContent, DialogHeader as UDialogHeader, DialogTitle as UDialogTitle, DialogDescription as UDialogDescription, DialogFooter as UDialogFooter } from '../ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import Truncate from '../ui/truncate';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Calendar, Mail, Ban, Lock, Check, X as XIcon, Edit3, RotateCcw, Send, Save, Trash2, MapPin, User as UserIcon, Briefcase, AlertCircle, MessageSquare, Star, ChevronRight, ChevronLeft, FileX, Lightbulb, History, MessageCircle as MessageCircleIcon, StickyNote, ThumbsUp, ExternalLink, Trophy, Inbox, MoreVertical, Plus, PartyPopper } from 'lucide-react';
import { EmptyState } from '../ui/empty-state';
import { CandidateDetailSkeleton } from '../ui/page-skeleton';
import { BackLink } from '../ui/back-link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { StarRating } from '../ui/star-rating';
import { avatarColorFor, initialOf } from '../../lib/avatar-color';
import { ka, eul, ro } from '../../lib/josa';

const STAGES = [
  { key: 'pending', emoji: '' },
  { key: 'viewed', emoji: '' },
  { key: 'reviewing', emoji: '' },
  { key: 'decided', emoji: '' },
];

// All stage dots/solids share a single neutral palette.
// Stage identity comes from the label text, not arbitrary hue.
// Only "decided" (final pass) keeps the primary accent so success is recognisable.
const STAGE_DOT_CLASS = {
  pending: 'bg-gray-300',
  viewed: 'bg-gray-400',
  reviewing: 'bg-gray-500',
  decided: 'bg-primary-500',
};
const STAGE_SOLID_CLASS = {
  pending: 'bg-gray-500',
  viewed: 'bg-gray-600',
  reviewing: 'bg-gray-700',
  decided: 'bg-primary-600',
};
// Evaluation-section labels are resolved via t('company.stageLabel.eval.<key>').
// We still expose the set of stages that have evaluations so the eval section
// can filter (decided has no evaluation step).
const EVAL_STAGE_KEYS = ['pending', 'viewed', 'reviewing'];
const STAGE_ORDER = STAGES.map(s => s.key);


/**
 * mode: 'page' | 'overlay'
 * navIndex / navTotal / onPrev / onNext drive ←/→ candidate navigation
 *   when rendered inside ATS overlay. Optional — fall back to no nav.
 */
export default function CandidateDetail({
  appId, mode = 'page', onClose, companyId, onStageChange,
  navIndex = null, navTotal = null, onPrev = null, onNext = null,
  stageIndex = null, stageTotal = null, stageCounts = null, stageOrder = null,
  onJumpToStage = null, onPrevStage = null, onNextStage = null,
}) {
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
  const [editingEval, setEditingEval] = useState(null);
  // In-app confirmation modal payload. Replaces window.confirm everywhere.
  // Shape: { title, description, confirmLabel, destructive, onConfirm }
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [tab, setTab] = useState('eval');
  // Mobile-only 3-tab nav: info / eval / history. On mobile we hide
  // everything else and let the user drill into just these three areas.
  const [mobileTab, setMobileTabState] = useState('info');
  const setMobileTab = (mt) => {
    setMobileTabState(mt);
    if (mt === 'eval' || mt === 'history') setTab(mt);
  };
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSavedAt, setNoteSavedAt] = useState(null);
  const [noteSavedByName, setNoteSavedByName] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Reset the draft buffer whenever we switch candidates.
  useEffect(() => {
    setNoteDraft('');
    setNoteDirty(false);
    setNoteSavedAt(null);
    setNoteSavedByName(null);
    setNoteExpanded(false);
  }, [app?.id]);

  // Save note via secure API endpoint (service role, bypass RLS)
  const saveNote = async (silent = false) => {
    setSavingNote(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/save-candidate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ appId: app.id, note: noteDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || t('company.toast.noteSaveFailed'));
        return;
      }
      setApp(prev => ({ ...prev, admin_note: noteDraft, admin_note_updated_at: json.updatedAt }));
      setNoteSavedAt(json.updatedAt);
      setNoteSavedByName(json.updatedByName);
      setNoteDirty(false);
      if (!silent) toast.success(t('company.toast.noteSaved'));
    } finally {
      setSavingNote(false);
    }
  };

  // Toast when navigating to a candidate in a different stage — prevents
  // mis-clicks when sweeping through candidates with ← / →.
  const prevStageRef = useRef(null);
  useEffect(() => {
    if (mode !== 'overlay' || !app?.status) return;
    const prevStage = prevStageRef.current;
    const currentStage = app.status;
    if (prevStage && prevStage !== currentStage) {
      const fromLabel = t(`company.stage.${prevStage}`);
      const toLabel = t(`company.stage.${currentStage}`);
      toast(`${fromLabel} → ${toLabel}`, {
        description: t('company.toast.stageMovedDesc'),
        duration: 1500,
      });
    }
    prevStageRef.current = currentStage;
  }, [app?.id, app?.status, mode, t]);

  const reloadMailLog = async (appId) => {
    if (!appId) return;
    const { data } = await supabase
      .from('recruiter_mail_log')
      .select('id, template_key, subject, created_at')
      .eq('application_id', appId)
      .order('created_at', { ascending: false });
    setMailLog(data || []);
  };

  // Keyboard shortcuts in overlay mode:
  //   ← / →        prev / next candidate (within current visible list)
  //   Shift + ←/→  jump to first candidate of prev / next stage
  //   Esc          close
  //   E            open mail compose
  //   R            open reject modal (owner only)
  //   Enter        advance to next stage (owner only)
  //   J / K        vim-style next / prev
  useEffect(() => {
    if (mode !== 'overlay') return;
    const handler = (e) => {
      const target = e.target;
      const tag = (target?.tagName || '').toLowerCase();
      const isFormField = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
      if (isFormField) return;
      // Skip when an inner modal is already open (interview/reject/mail/edit)
      if (mailModal || rejectModal || interviewModal || editingEval) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      // Shift + arrows → cross-stage jump
      if (e.shiftKey) {
        if (key === 'ArrowLeft' && onPrevStage) { e.preventDefault(); onPrevStage(); return; }
        if (key === 'ArrowRight' && onNextStage) { e.preventDefault(); onNextStage(); return; }
      }
      if (key === 'ArrowLeft' || key === 'k' || key === 'K') { if (onPrev) { e.preventDefault(); onPrev(); } }
      else if (key === 'ArrowRight' || key === 'j' || key === 'J') { if (onNext) { e.preventDefault(); onNext(); } }
      else if (key === 'Escape') { if (onClose) { e.preventDefault(); onClose(); } }
      else if ((key === 'e' || key === 'E') && app && !app.rejected_at) {
        // Only the job owner can compose mail — same gate as the toolbar button.
        const ownerNow = !job?.created_by || job?.created_by === userId;
        if (!ownerNow) return;
        e.preventDefault();
        const defaultTpl = app.status === 'pending' ? 'received'
          : (app.status === 'viewed' || app.status === 'reviewing') ? 'interview'
          : 'offer';
        setMailModal({ templateKey: defaultTpl, withSlots: defaultTpl === 'interview' });
      }
      else if ((key === 'r' || key === 'R') && app && !app.rejected_at) {
        const ownerNow = !job?.created_by || job?.created_by === userId;
        if (!ownerNow) return;
        e.preventDefault();
        setRejectModal('new');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, onPrev, onNext, onPrevStage, onNextStage, onClose, mailModal, rejectModal, interviewModal, editingEval, app, job, userId]);

  useEffect(() => {
    if (app?.id) reloadMailLog(app.id);
  }, [app?.id]);
  const [evals, setEvals] = useState([]);
  const [expandedStages, setExpandedStages] = useState(new Set());
  const [evalComment, setEvalComment] = useState('');
  const [evalScore, setEvalScore] = useState('');
  const [savingEval, setSavingEval] = useState(false);
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

  // Stage moves are handled exclusively from the kanban (drag-and-drop).
  // The panel only manages evaluation, mail, interview schedule, and the
  // 합격/불합격 decisions for the *current* stage.

  // Mark this stage as "합격 결정" — decision only, no stage move yet.
  // The next step ("다음 전형으로 넘기기") is the explicit move.
  // Goes through the server endpoint so RLS doesn't block the audit insert
  // and so the actor name resolves consistently from recruiter_users.
  const markStagePass = async () => {
    if (!app || app.rejected_at) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/mark-stage-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ appId: app.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || t('company.toast.passFailed')); return; }
      if (json.row) setEvals(prev => [...prev, json.row]);
      toast.success(t('company.toast.passDecided', { stage: t(`company.stageLabel.short.${app.status}`) || app.status }));
    } catch (e) {
      toast.error(t('company.toast.passFailed'));
    }
  };

  const unmarkStagePass = async () => {
    if (!passedAtCurrentStage) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/unmark-stage-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ rowId: passedAtCurrentStage.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || t('company.toast.passCancelFailed')); return; }
      setEvals(prev => prev.filter(e => e.id !== passedAtCurrentStage.id));
      toast.success(t('company.toast.passCanceled'));
    } catch (e) {
      toast.error(t('company.toast.passCancelFailed'));
    }
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
    // Comment optional, fit/unfit verdict required.
    const comment = editComment.trim();
    if (editScore !== '0' && editScore !== '1' && editScore !== 0 && editScore !== 1) {
      setErr(t('company.eval.errVerdictRequired')); return;
    }
    const score = (editScore === '1' || editScore === 1) ? 1 : 0;
    setSavingEdit(true);
    const { data, error } = await supabase
      .from('application_evaluations')
      .update({ comment, score })
      .eq('id', editingEval.id)
      .select()
      .single();
    setSavingEdit(false);
    if (error) { setErr(t('company.toast.evalUpdateFailed')); toast.error(t('company.toast.evalUpdateFailed')); return; }
    setEvals(prev => prev.map(e => e.id === data.id ? data : e));
    setEditingEval(null);
    toast.success(t('company.toast.evalUpdated'));
  };

  // Open the in-app confirmation modal. The caller passes a handler that
  // runs only after the user confirms; busy state + close are handled here.
  const askConfirm = ({ onConfirm, ...rest }) => {
    setConfirmState({
      ...rest,
      onConfirm: async () => {
        setConfirmBusy(true);
        try { await onConfirm?.(); }
        finally { setConfirmBusy(false); setConfirmState(null); }
      },
    });
  };

  const deleteEvaluation = (row) => {
    askConfirm({
      title: t('company.eval.confirmDelete'),
      confirmLabel: t('company.eval.deleteBtn'),
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('application_evaluations').delete().eq('id', row.id);
        if (error) { toast.error(t('company.toast.evalDeleteFailed')); return; }
        setEvals(prev => prev.filter(e => e.id !== row.id));
        toast.success(t('company.toast.evalDeleted'));
      },
    });
  };

  const submitEvaluation = async () => {
    setErr('');
    // Fit/unfit verdict is required (stored as 1=fit, 0=unfit), comment is optional.
    if (evalScore !== '0' && evalScore !== '1' && evalScore !== 0 && evalScore !== 1) {
      setErr(t('company.eval.errVerdictRequired')); return;
    }
    const score = (evalScore === '1' || evalScore === 1) ? 1 : 0;
    const comment = evalComment.trim();
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
    if (error) { setErr(t('company.toast.evalSaveFailed')); toast.error(t('company.toast.evalSaveFailed')); return; }
    setEvals(prev => {
      const exists = prev.some(e => e.id === data.id);
      return exists ? prev.map(e => e.id === data.id ? data : e) : [...prev, data];
    });
    setEvalComment('');
    setEvalScore('');
    toast.success(t('company.toast.evalSaved'));
  };

  if (status === 'loading') return <CandidateDetailSkeleton mode={mode} />;
  if (status === 'unauthed') return <div className="m-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{t('company.err.loginRequired')}</div>;
  if (status === 'error') return <div className="m-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>;

  const name = app.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
  const email = app.applicant_email || profile?.email || '—';
  const currentStage = STAGES.find(s => s.key === app.status);
  const idx = STAGE_ORDER.indexOf(app.status);
  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  const hasResume = !!app.resume_url;
  const appliedAtLabel = new Date(app.created_at).toLocaleDateString();
  const isOwner = !job?.created_by || job?.created_by === userId;
  const companyName = job?.recruiter_companies?.name || '';

  const avatarPalette = avatarColorFor(email || name);
  const initial = initialOf(name);
  // Per-stage decision label, e.g. pending → "서류" → "서류 합격 처리" / "서류 불합격 처리"
  const decisionPrefix = t(`company.stageLabel.short.${app.status}`) || t(`company.stage.${app.status}`);

  // Stage-pass audit row (separates "결정" from "이동").
  // Once marked, the buttons swap from 합격/불합격 to a pass-badge + "다음 전형으로 넘기기".
  const passedAtCurrentStage = evals.find(e => e.stage === `${app.status}_pass`);
  const hasStagePassed = !!passedAtCurrentStage;

  const wishSalaryLabel = app.applicant_salary
    ? t('company.candidate.salaryMonthly', { n: Math.round(app.applicant_salary / 1e6) })
    : null;
  const canRunQuick = isOwner;
  const showInterviewStage = app.status === 'viewed' || app.status === 'reviewing';
  const defaultMailTpl = app.rejected_at ? 'reject'
    : app.status === 'pending' ? 'received'
    : (app.status === 'viewed' || app.status === 'reviewing') ? 'interview'
    : 'offer';
  const openMailCompose = () => setMailModal({ templateKey: defaultMailTpl, withSlots: defaultMailTpl === 'interview' });

  // ─── Smart Hint flowchart (action-granular) ─────────────────────
  // Always returns { tone, eyebrow, title } — strictly the single next action.
  // Branches drill down to the *next concrete action* at the current state.
  //
  // Owner flow per stage:
  //   pending   ─ no eval → write eval ─ has eval → decide (pass/fail)
  //   viewed    ─ no interview_at → schedule
  //             ─ future interview + mail not sent → send interview mail
  //             ─ future interview + mail sent      → wait until interview
  //             ─ past interview  + no eval         → write eval
  //             ─ past interview  + has eval        → decide (next stage / fail)
  //   reviewing ─ same shape as viewed but for "2차"
  //   decided   ─ offer mail not sent → send offer mail
  //             ─ offer mail sent     → run salary/start-date negotiation
  //   rejected  ─ reject mail not sent → send reject mail
  //             ─ reject mail sent     → terminal
  //
  // Interviewer flow:
  //   pending → waiting (not yet assigned)
  //   viewed/reviewing → write eval / done (waiting on owner decision)
  //   decided → terminal (passed)
  //   rejected → terminal (failed)
  const smartHint = (() => {
    const evalStageLabel = EVAL_STAGE_KEYS.includes(app.status) ? t(`company.stageLabel.eval.${app.status}`) : '';
    const myEvalThisStage = evals.find(e => e.stage === app.status && e.reviewer_user_id === userId);
    const hasMyEval = !!myEvalThisStage;
    const stageEvals = evals.filter(e => e.stage === app.status);
    const hasAnyEvalThisStage = stageEvals.length > 0;
    const daysSinceApplied = Math.max(0, Math.floor((Date.now() - new Date(app.created_at).getTime()) / 86400000));

    const interviewWhen = app.interview_at ? formatInterviewShort(app.interview_at) : null;
    const interviewPast = app.interview_at && new Date(app.interview_at).getTime() < Date.now();

    // Mail tracking — only the offer/reject decision mails are gated by
    // Smart Hint now. Interview scheduling mail is sent at the pass-decision
    // moment of the previous stage, not as a separate step in this stage.
    const offerMailSent = mailLog.some(m => m.template_key === 'offer');
    const rejectMailSent = mailLog.some(m => m.template_key === 'reject');

    // ── Rejected (terminal) ────────────────────────────────────────
    if (app.rejected_at) {
      if (!isOwner) {
        return {
          tone: 'gray',
          eyebrow: t('company.smartHint.eb.interviewerDone'),
          title: t('company.smartHint.title.rejectedFinal'),
        };
      }
      if (!rejectMailSent) {
        return {
          tone: 'gray',
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.sendRejectMail'),
          step: 1, total: 1, steps: [t('company.smartHint.step.mail')],
        };
      }
      return {
        tone: 'gray',
        eyebrow: t('company.smartHint.eb.ownerDone'),
        title: t('company.smartHint.title.rejectComplete'),
      };
    }

    // ── Interviewer flow ──────────────────────────────────────────
    // Policy #2: both 공고 관리자 AND 면접관 evaluate. So the interviewer
    // has an active evaluation step in pending / viewed / reviewing.
    if (!isOwner) {
      if (app.status === 'decided') {
        return {
          tone: 'emerald',
          eyebrow: t('company.smartHint.eb.interviewerDone'),
          title: t('company.smartHint.title.interviewerFinalPass'),
        };
      }
      // pending / viewed / reviewing — interviewer can evaluate at every stage
      if (hasMyEval) {
        return {
          tone: 'emerald',
          eyebrow: t('company.smartHint.eb.interviewerEvalDone'),
          title: t('company.smartHint.title.interviewerEvalDone', { stage: evalStageLabel }),
          step: 1, total: 1, steps: [t('company.smartHint.step.eval')],
        };
      }
      return {
        tone: 'blue',
        eyebrow: t('company.smartHint.eb.todo'),
        title: t('company.smartHint.title.interviewerWriteEval', { stage: evalStageLabel }),
        step: 1, total: 1, steps: [t('company.smartHint.step.eval')],
      };
    }

    // ── Owner flow ────────────────────────────────────────────────
    // 지원 접수 — 2-step: 평가 → 결정 (결정 step 안에서 합격 마킹 → 이동 sub-state)
    if (app.status === 'pending') {
      const pendingSteps = [t('company.smartHint.step.eval'), t('company.smartHint.step.decide')];
      if (!hasAnyEvalThisStage) {
        if (daysSinceApplied >= 7) {
          return {
            tone: 'primary',
            eyebrow: t('company.smartHint.eb.todoOverdue', { days: daysSinceApplied }),
            title: t('company.smartHint.title.fastDecision'),
            step: 1, total: 2, steps: pendingSteps,
          };
        }
        if (!hasResume) {
          return {
            tone: 'primary',
            eyebrow: t('company.smartHint.eb.todo'),
            title: t('company.smartHint.title.noResume'),
            step: 1, total: 2, steps: pendingSteps,
          };
        }
        return {
          tone: 'primary',
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.writeDocEval'),
          step: 1, total: 2, steps: pendingSteps,
        };
      }
      // 평가 작성됨 → 결정 (합격 마킹 안 됨)
      if (!hasStagePassed) {
        return {
          tone: 'primary',
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.decideDoc'),
          step: 2, total: 2, steps: pendingSteps,
        };
      }
      // 합격 마킹 됨 → 다음 전형으로 이동
      return {
        tone: 'primary',
        eyebrow: t('company.smartHint.eb.todo'),
        title: t('company.smartHint.title.advanceDoc'),
        step: 2, total: 2, steps: pendingSteps,
      };
    }

    // 1차/2차 인터뷰 — 3-step: 일정 → 평가 → 결정
    // Owner view uses `hasAnyEvalThisStage` (anyone in the team has rated)
    // so the hint moves on to "결정" as soon as a single evaluation lands —
    // even if the owner themselves hasn't written one yet.
    if (app.status === 'viewed' || app.status === 'reviewing') {
      const tone = app.status === 'viewed' ? 'blue' : 'violet';
      const stageLabel = t(`company.stageLabel.short.${app.status}`);
      const total = 3;
      const interviewSteps = [
        t('company.smartHint.step.schedule'),
        t('company.smartHint.step.eval'),
        t('company.smartHint.step.decide'),
      ];

      // (1) 일정 없음 → 일정 등록
      if (!app.interview_at) {
        return {
          tone,
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.scheduleInterview', { stage: stageLabel }),
          step: 1, total, steps: interviewSteps,
        };
      }

      // (2) 일정 있음 + 아직 누구도 평가 안 함 → 평가 단계
      if (!hasAnyEvalThisStage) {
        if (!interviewPast) {
          return {
            tone,
            eyebrow: t('company.smartHint.eb.todo'),
            title: t('company.smartHint.title.interviewUpcoming', { stage: stageLabel, when: interviewWhen }),
            step: 2, total, steps: interviewSteps,
          };
        }
        return {
          tone,
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.writeInterviewEval', { stage: stageLabel }),
          step: 2, total, steps: interviewSteps,
        };
      }

      // (3) 평가 있음 → 결정 (합격 마킹 전/후 sub-state)
      if (!hasStagePassed) {
        return {
          tone,
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.decideInterview', { stage: stageLabel }),
          step: 3, total, steps: interviewSteps,
        };
      }
      const nextLabel = app.status === 'viewed'
        ? t('company.stageLabel.short.reviewing')
        : t('company.stageLabel.short.decided');
      return {
        tone,
        eyebrow: t('company.smartHint.eb.todo'),
        title: t('company.smartHint.title.advanceInterview', { stage: stageLabel, next: nextLabel }),
        step: 3, total, steps: interviewSteps,
      };
    }

    // 최종 합격 — 2-step: 합격·입사 제안 메일 → 입사 협의
    if (app.status === 'decided') {
      const decidedSteps = [
        t('company.smartHint.step.passNotice'),
        t('company.smartHint.step.onboardTalk'),
      ];
      if (!offerMailSent) {
        return {
          tone: 'emerald',
          eyebrow: t('company.smartHint.eb.todo'),
          title: t('company.smartHint.title.sendOfferMail'),
          step: 1, total: 2, steps: decidedSteps,
        };
      }
      return {
        tone: 'emerald',
        eyebrow: t('company.smartHint.eb.ownerNegotiation'),
        title: t('company.smartHint.title.followUp'),
        step: 2, total: 2, steps: decidedSteps,
      };
    }

    return null;
  })();

  // Checklist missing items for the current stage. Used to soft-gate

  // Smart Hint = the one intentionally accented surface in the panel.
  // It's the "what to do next" cue, so we let the brand color through —
  // soft primary tint + a primary eyebrow + a primary-tinted lightbulb.
  // The rest of the UI stays neutral so this card actually draws the eye.
  const hintToneClass = 'bg-primary-50/70 border-primary-200 text-gray-900';
  const hintEyebrowClass = 'text-primary-700';

  // Mobile-only 3-tab nav definition — kept inside the component so it picks
  // up t() updates on language change.
  const mobileTabs = [
    { key: 'info',    label: t('company.candidate.tab.info') },
    { key: 'eval',    label: t('company.candidate.tab.eval') },
    { key: 'history', label: t('company.candidate.tab.history') },
  ];

  return (
    <div className={cn(
      mode === 'overlay'
        ? 'flex flex-col h-full bg-[#FAFAFA]'
        : 'min-h-screen bg-gray-50 px-4 py-4 md:px-6 md:py-6 max-w-[1400px] mx-auto'
    )}>
      {/* Mobile top bar — icon-only back + 3-tab nav. Replaces hero clutter on small screens. */}
      {mode === 'page' && (
        <div className="md:hidden -mx-4 -mt-4 mb-3 bg-white border-b border-border sticky top-0 z-30">
          <div className="flex items-center gap-1 px-2 h-12 border-b border-gray-100">
            <Link
              href={`/company/ats?job=${job.id}&stage=${app.status}`}
              aria-label={t('company.back')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Truncate as="span" className="text-[15px] font-extrabold text-gray-900 tracking-tight min-w-0">
              {name}
            </Truncate>
            {/* Current-stage chip — primary tone for active stages, red for rejected. */}
            <span className={cn(
              'ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-extrabold flex-shrink-0 border',
              app.rejected_at
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-primary-50 border-primary-200 text-primary-700'
            )}>
              {app.rejected_at ? t('company.ats.rejectedBadge') : t(`company.stage.${app.status}`)}
            </span>
          </div>
          <div className="flex">
            {mobileTabs.map(mt => {
              const isActive = mobileTab === mt.key;
              return (
                <button
                  key={mt.key}
                  type="button"
                  onClick={() => setMobileTab(mt.key)}
                  className={cn(
                    'flex-1 h-10 text-[12.5px] font-extrabold transition-colors border-b-2',
                    isActive ? 'text-gray-900 border-gray-900' : 'text-gray-500 border-transparent'
                  )}
                >
                  {mt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* Hero header — full-width sticky banner with avatar, meta, quick actions, navigation.
          Left-edge color bar reflects current stage so candidate-to-candidate sweeps make
          the stage change immediately visible. */}
      <header className={cn(
        'relative flex flex-col gap-3',
        mode === 'overlay' ? 'px-5 pt-3 pb-3 border-b border-border bg-white' : 'mb-5',
        // Mobile page mode: hero hidden entirely — the top bar already carries
        // the back / name / stage, and 정보 tab is the resume preview only.
        mode === 'page' && 'hidden md:flex'
      )}>
        {mode === 'overlay' && (
          <div
            className={cn(
              'absolute top-0 bottom-0 left-0 w-1.5',
              app.rejected_at ? 'bg-red-400' : STAGE_DOT_CLASS[app.status]?.replace('bg-', 'bg-') || 'bg-gray-400'
            )}
          />
        )}

        {/* Top strip: stage minimap (left) + navigation + close (right).
            Always rendered for overlay mode so close/← → are always at the very top. */}
        {mode === 'overlay' && (
          <div className="flex items-center gap-2 -mt-1">
            {stageCounts && stageOrder && (
              <div className="hidden md:flex items-center gap-1.5 -mx-1 overflow-x-auto min-w-0 flex-1">
                {stageOrder.map((sKey) => {
                  const label = t(`company.stage.${sKey}`);
                  const cnt = stageCounts[sKey] ?? 0;
                  const isActive = sKey === app.status && !app.rejected_at;
                  const clickable = !!onJumpToStage && cnt > 0;
                  return (
                    <button
                      key={sKey}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onJumpToStage(sKey)}
                      className={cn(
                        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap',
                        isActive
                          ? cn('text-white shadow-soft-xs', STAGE_SOLID_CLASS[sKey])
                          : clickable
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400 cursor-default',
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full',
                        isActive ? 'bg-white' : STAGE_DOT_CLASS[sKey]
                      )} />
                      {label}
                      <span className={cn('tabular-nums font-extrabold', isActive ? 'text-white/90' : 'text-gray-900')}>
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
              {(onPrev || onNext) && (
                <>
                  <UButton variant="outline" size="icon" onClick={onPrev} disabled={!onPrev} className="hidden md:inline-flex h-8 w-8" title={t('company.candidate.prevCandidate')}>
                    <ChevronLeft className="w-4 h-4" />
                  </UButton>
                  <div className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-gray-50 border border-border">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STAGE_DOT_CLASS[app.status])} />
                    <span className="text-[11.5px] font-bold text-gray-900 truncate">{t(`company.stage.${app.status}`)}</span>
                    {stageTotal != null && stageIndex != null && stageTotal > 0 && (
                      <span className="text-[11px] font-extrabold text-gray-900 tabular-nums">
                        {stageIndex + 1}<span className="text-gray-400">/{stageTotal}</span>
                      </span>
                    )}
                  </div>
                  <UButton variant="outline" size="icon" onClick={onNext} disabled={!onNext} className="hidden md:inline-flex h-8 w-8" title={t('company.candidate.nextCandidate')}>
                    <ChevronRight className="w-4 h-4" />
                  </UButton>
                  <div className="hidden md:block w-px h-6 bg-border mx-1" />
                </>
              )}
              <UButton variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" title={t('company.candidate.closePanel')}>
                <XIcon className="w-4 h-4" />
              </UButton>
            </div>
          </div>
        )}
        {mode === 'page' && (
          <BackLink href={`/company/ats?job=${job.id}`} className="hidden md:inline-flex mb-1.5 w-fit">
            {t('company.candidate.backToKanban', { job: job.title })}
          </BackLink>
        )}

        {/* Row 1: avatar + name + meta (left) | all actions (right) */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className={cn(
            'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-extrabold',
            avatarPalette.bg, avatarPalette.text
          )}>
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <Truncate as="h1" className="text-hero text-gray-900">{name}</Truncate>
            {/* Compact mobile meta — just email so the line fits without ellipsis. */}
            <div className="mt-1.5 md:hidden text-[13px] text-gray-900 font-semibold break-all">
              {email}
            </div>
            {/* Full desktop meta line */}
            <div className="mt-1.5 hidden md:flex text-[13.5px] text-gray-900 font-semibold truncate items-center flex-wrap gap-x-2">
              <span>{email}</span>
              {app.applicant_role && <><span className="text-gray-400">·</span><span>{app.applicant_role}</span></>}
              {(app.applicant_experience !== null && app.applicant_experience !== undefined) && (
                <><span className="text-gray-400">·</span><span>{app.applicant_experience}{t('company.years')}</span></>
              )}
              {wishSalaryLabel && <><span className="text-gray-400">·</span><span className="text-gray-700 font-bold">{wishSalaryLabel}</span></>}
              {mode === 'overlay' && <><span className="text-gray-400">·</span><span className="text-gray-500">{job.title}</span></>}
              <span className="text-gray-400">·</span><span className="text-gray-500">{t('company.candidate.appliedShort')} {appliedAtLabel}</span>
            </div>
          </div>

          {/* All actions on the right: communication | divider | decision.
              Hidden entirely on mobile — Greeting-style: mobile shows only info/eval/history. */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 flex-wrap self-end">
            {/* Communication actions — ordered by workflow:
                interview scheduling first, then notification mail.
                When a schedule exists, show it as a chip to the LEFT of the button
                so HR can read the confirmed time at a glance. */}
            {canRunQuick && showInterviewStage && app.interview_at && (() => {
              const isPast = new Date(app.interview_at).getTime() < Date.now();
              const when = formatInterviewShort(app.interview_at);
              return (
                <span className={cn(
                  'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[12.5px] font-extrabold tabular-nums whitespace-nowrap',
                  isPast
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-sky-50 border-sky-200 text-sky-800'
                )}>
                  {isPast
                    ? <Check className="w-3.5 h-3.5 text-green-600" />
                    : <Calendar className="w-3.5 h-3.5 text-sky-600" />}
                  <span>{isPast ? t('company.ats.interviewDone') : t('company.ats.interviewWord')} {when}</span>
                </span>
              );
            })()}
            {canRunQuick && showInterviewStage && (
              <UButton variant="outline" size="sm" onClick={() => setInterviewModal(true)} className="h-9">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                {app.interview_at ? t('company.interview.confirmEditBtn') : t('company.interview.confirmBtn')}
              </UButton>
            )}
            {canRunQuick && (
              <UButton variant="outline" size="sm" onClick={openMailCompose} title={t('company.candidate.composeMailTitle')} className="h-9">
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                {t('company.candidate.mailComposeBtn')}
              </UButton>
            )}
            {!canRunQuick && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5">
                <Lock className="w-3 h-3" />
                {t('company.candidate.interviewerHint')}
              </span>
            )}

            {/* Divider between communication and decision groups.
                Shown whenever a decision action follows — pass/fail box or "결정 취소". */}
            {canRunQuick && (nextStage || app.rejected_at) && (
              <div className="w-px h-7 bg-border mx-1" />
            )}

            {/* Decision area — two phases:
                Phase A (결정 전): "{prefix} 합격 처리" + "{prefix} 불합격 처리"
                Phase B (합격 마킹 후): "{prefix} 전형 합격" 뱃지 + "다음 전형으로 넘기기"
                Splitting "결정" from "이동" lets HR explicitly mark the call
                first, then ship the candidate to the next stage. */}
            {canRunQuick && !app.rejected_at && nextStage && !hasStagePassed && (
              <>
                <button
                  type="button"
                  onClick={markStagePass}
                  title={t('company.ats.stagePass', { stage: decisionPrefix })}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-green-200 bg-green-50 text-[14px] font-extrabold text-green-700 hover:bg-green-100 hover:border-green-300 shadow-soft-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {t('company.ats.stagePass', { stage: decisionPrefix })}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModal('new')}
                  title={`${t('company.ats.stageReject', { stage: decisionPrefix })} (R)`}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-red-200 bg-red-50 text-[14px] font-extrabold text-red-700 hover:bg-red-100 hover:border-red-300 shadow-soft-xs transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {t('company.ats.stageReject', { stage: decisionPrefix })}
                </button>
              </>
            )}
            {canRunQuick && !app.rejected_at && nextStage && hasStagePassed && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-green-50 border border-green-200 text-[13px] font-extrabold text-green-800">
                <Check className="w-3.5 h-3.5" />
                {t('company.candidate.stagePassed', { stage: decisionPrefix })}
                <button
                  type="button"
                  onClick={unmarkStagePass}
                  title={t('company.candidate.passCancelTitle')}
                  className="ml-1 text-[11.5px] font-bold text-green-700/70 hover:text-green-900 underline underline-offset-2"
                >
                  {t('company.candidate.cancel')}
                </button>
              </span>
            )}
            {canRunQuick && app.rejected_at && (() => {
              const rejectedStageLabel = app.rejected_at_stage ? t(`company.stage.${app.rejected_at_stage}`) : null;
              const reasonText = app.rejection_reason === 'other'
                ? (app.rejection_note || '').trim()
                : (app.rejection_reason ? t(`company.reject.reason.${app.rejection_reason}`) : null);
              return (
                <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-red-50 border border-red-200 text-[13px] font-extrabold text-red-800 max-w-[320px]">
                  <Ban className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {rejectedStageLabel ? t('company.candidate.rejectedAtStageLabel', { stage: rejectedStageLabel }) : t('company.candidate.rejectedSimple')}
                    {reasonText ? ` · ${reasonText}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRejectModal('unreject')}
                    title={t('company.reject.unrejectBtn')}
                    className="ml-1 text-[11.5px] font-bold text-red-700/70 hover:text-red-900 underline underline-offset-2 flex-shrink-0"
                  >
                    {t('company.candidate.cancel')}
                  </button>
                </span>
              );
            })()}
            {/* Final-hire celebration — being in the 최종 합격 column IS the final-hire state.
                To revert, move the candidate to a different stage on the kanban. */}
            {!app.rejected_at && app.status === 'decided' && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-50 border border-primary-200 text-[13px] font-extrabold text-primary-800">
                <PartyPopper className="w-4 h-4" />
                {t('company.candidate.finalPass')}
              </span>
            )}
          </div>
        </div>

        {/* Smart hint — 2-row layout.
            Row 1: eyebrow | Stage Checklist progress stepper (inline, divider-separated)
            Row 2: numbered title (the single next action to take) */}
        {smartHint && (
          <div className={cn('hidden md:flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5', hintToneClass)}>
            <Lightbulb className="w-[18px] h-[18px] flex-shrink-0 mt-0.5 text-primary-600" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={cn('text-[11.5px] font-extrabold uppercase tracking-[0.06em]', hintEyebrowClass)}>
                  {smartHint.eyebrow}
                </span>
                {smartHint.steps && smartHint.total > 1 && (
                  <>
                    <span className="hidden md:inline w-px h-3.5 bg-current opacity-25" />
                    <div className="hidden md:flex items-center gap-1 flex-wrap text-[12px]">
                      {smartHint.steps.map((label, i) => {
                        const idx = i + 1;
                        const isDone = idx < smartHint.step;
                        const isCurrent = idx === smartHint.step;
                        return (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-gray-300 select-none">›</span>}
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-extrabold transition-colors',
                              isCurrent ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'text-gray-400'
                            )}>
                              <span className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isCurrent ? 'bg-primary-600' : isDone ? 'bg-gray-500' : 'bg-gray-300'
                              )} />
                              <span>{label}</span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="text-[14.5px] font-bold leading-snug text-gray-900">
                {smartHint.title}
              </div>
            </div>
          </div>
        )}
      </header>

      {err && (
        <div className={cn(
          'rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold',
          mode === 'overlay' ? 'mx-6 mt-3' : 'mb-3'
        )}>{err}</div>
      )}

      <div className={cn(
        'grid gap-4 flex-1 min-h-0',
        mode === 'overlay' ? 'grid-cols-1 lg:grid-cols-[1fr_400px] px-5 pt-3 pb-5 overflow-auto' : 'grid-cols-1 lg:grid-cols-[1fr_400px]'
      )}>
        <section className={cn(
          'flex flex-col bg-white rounded-xl border border-border shadow-soft-xs overflow-hidden min-h-[420px] md:min-h-[600px]',
          // Mobile (page mode): visible only when the 정보 tab is active.
          // Mobile (overlay) + non-info mobile tabs: hidden.
          mode === 'page' && mobileTab === 'info' ? '' : 'hidden md:flex'
        )}>
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border bg-gray-50/50">
            <span className="text-[13px] font-bold text-foreground">{t('company.candidate.resume')}</span>
            {hasResume && (
              <a
                href={app.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {t('company.candidate.openNewTab')}
              </a>
            )}
          </div>
          {hasResume ? (
            // #view=FitH forces PDF viewers to fit page width, so the document
            // fills the panel cleanly instead of floating with side gutters.
            <iframe
              src={`${app.resume_url}${app.resume_url.includes('#') ? '&' : '#'}view=FitH`}
              className="flex-1 w-full border-0 min-h-[420px] md:min-h-[720px] bg-[#f3f4f6]"
              title="resume"
            />
          ) : (
            <EmptyState
              icon={FileX}
              title={t('company.candidate.noResume')}
              description={t('company.candidate.noResumeSub')}
              className="flex-1 min-h-[480px]"
            />
          )}
        </section>

        <aside className={cn(
          'flex flex-col min-h-0',
          // On mobile show only when the 평가 or 히스토리 tab is active.
          mode === 'page' && mobileTab === 'info' && 'hidden md:flex'
        )}>
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col min-h-0">
            <TabsList className="hidden md:flex">
              <TabsTrigger value="eval"><Star className="w-3.5 h-3.5" />{t('company.candidate.tab.eval')}</TabsTrigger>
              <TabsTrigger value="mail">
                <Mail className="w-3.5 h-3.5" />{t('company.candidate.tab.mail')}
                <span className={cn('font-extrabold', tab === 'mail' ? 'text-gray-900' : 'text-gray-400')}>{mailLog.length}</span>
              </TabsTrigger>
              <TabsTrigger value="history"><History className="w-3.5 h-3.5" />{t('company.candidate.tab.history')}</TabsTrigger>
            </TabsList>

            {/* ─── Eval tab ─── */}
            <TabsContent value="eval">
              <div className="rounded-xl bg-white border border-border shadow-soft-xs p-4 space-y-3">
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
              </div>

              {/* Internal notes — collapsible card matching evaluation stage cards.
                  Multiple notes are appended (history), not overwritten. */}
              <div className="mt-1.5">
                <NoteSection
                  app={app}
                  evals={evals}
                  setEvals={setEvals}
                  userId={userId}
                  reviewerName={reviewerName}
                  expanded={noteExpanded}
                  onToggle={() => setNoteExpanded(v => !v)}
                  draft={noteDraft}
                  setDraft={setNoteDraft}
                  saving={savingNote}
                  setSaving={setSavingNote}
                  askConfirm={askConfirm}
                />
              </div>
            </TabsContent>

            {/* ─── History tab — activity timeline ─── */}
            <TabsContent value="history">
              <div className="rounded-xl bg-white border border-border shadow-soft-xs p-4">
                <ActivityTimeline t={t} app={app} evals={evals} mailLog={mailLog} />
              </div>
            </TabsContent>

            {/* ─── Mail tab — log + compose ─── */}
            <TabsContent value="mail">
              <div className="rounded-xl bg-white border border-border shadow-soft-xs p-4 space-y-3">
                {isOwner && (
                  <UButton onClick={openMailCompose} variant="outline" className="w-full">
                    <Mail className="w-3.5 h-3.5" />
                    {t('company.candidate.mailComposeBtn')}
                  </UButton>
                )}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-extrabold text-gray-500 uppercase tracking-[0.08em]">
                    {t('company.candidate.mailLogH')} · {mailLog.length}
                  </div>
                  {mailLog.length === 0 ? (
                    <div className="flex items-center justify-center gap-1.5 py-6 text-[11.5px] text-gray-400 font-semibold border border-dashed border-gray-200 rounded-md">
                      <Mail className="w-3.5 h-3.5" />
                      {t('company.candidate.mailLogEmpty')}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {mailLog.map(m => {
                        const legacyTpl = m.template_key && ['received', 'interview', 'offer', 'reject'].includes(m.template_key);
                        const tplLabel = legacyTpl ? t(`company.tpl.${m.template_key}.label`) : (m.template_key || '—');
                        const when = formatLocalShort(m.created_at);
                        return (
                          <div key={m.id} className="rounded-lg border border-border px-2.5 py-2 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-bold text-gray-900">{tplLabel}</span>
                              <span className="text-[10.5px] text-gray-500 font-semibold">{when}</span>
                            </div>
                            {m.subject && <Truncate as="div" className="text-[11.5px] text-gray-700">{m.subject}</Truncate>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── Note tab — internal team-shared note ─── */}
          </Tabs>
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
          onClose={() => setMailModal(null)}
          onSent={() => { setMailModal(null); reloadMailLog(app.id); }}
          askConfirm={askConfirm}
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
          askConfirm={askConfirm}
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
        <UDialog open onOpenChange={(open) => { if (!open && !savingEdit) setEditingEval(null); }}>
          <UDialogContent className="max-w-md">
            <UDialogHeader>
              <UDialogTitle>{t('company.eval.editH')}</UDialogTitle>
            </UDialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">{t('company.candidate.note')}</label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-input rounded-md text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">
                  {t('company.eval.verdictLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEditScore('1')}
                    className={cn(
                      'px-4 h-9 text-[13px] font-extrabold transition-colors',
                      editScore === '1' || editScore === 1
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-green-50/60'
                    )}
                  >
                    {t('company.eval.fit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScore('0')}
                    className={cn(
                      'px-4 h-9 text-[13px] font-extrabold transition-colors border-l border-border',
                      editScore === '0' || editScore === 0
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-red-50/60'
                    )}
                  >
                    {t('company.eval.unfit')}
                  </button>
                </div>
              </div>
            </div>
            <UDialogFooter>
              <UButton variant="outline" onClick={() => setEditingEval(null)} disabled={savingEdit}>
                {t('company.cancel')}
              </UButton>
              <UButton onClick={saveEditEval} disabled={savingEdit}>
                {savingEdit ? t('company.savingShort') : t('company.eval.editBtn')}
              </UButton>
            </UDialogFooter>
          </UDialogContent>
        </UDialog>
      )}

      {/* Platform-native confirmation modal — replaces window.confirm */}
      <ConfirmDialog
        open={!!confirmState}
        onOpenChange={(o) => { if (!o) setConfirmState(null); }}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        destructive={confirmState?.destructive}
        onConfirm={() => confirmState?.onConfirm?.()}
        busy={confirmBusy}
      />
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

// Fit/unfit summary for a stage. Returns null when no one has rated yet.
// Otherwise: { fit, unfit, total } so the UI can show "적합 3 · 부적합 1".
function fitSummary(list) {
  const scored = list.filter(e => typeof e.score === 'number');
  if (scored.length === 0) return null;
  const fit = scored.filter(e => e.score === 1).length;
  const unfit = scored.length - fit;
  return { fit, unfit, total: scored.length };
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
  const currentStageLabel = EVAL_STAGE_KEYS.includes(currentStage) ? t(`company.stageLabel.eval.${currentStage}`) : t(`company.stage.${currentStage}`);
  const myCurrentEval = evals.find(e => e.stage === currentStage && e.reviewer_user_id === currentUserId);
  const evalStages = stages.filter(s => EVAL_STAGE_KEYS.includes(s.key));

  return (
    <div className="flex flex-col gap-1.5">
      {evalStages.map(s => {
        const stageEvals = evals.filter(e => e.stage === s.key);
        const summary = fitSummary(stageEvals);
        const expanded = expandedStages.has(s.key);
        const isCurrent = s.key === currentStage;
        return (
          <div key={s.key} className="bg-gray-50 border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => onToggle(s.key)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                isCurrent ? 'bg-primary-50/50 hover:bg-primary-50' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', STAGE_DOT_CLASS[s.key])} />
              <span className="text-xs font-extrabold text-foreground flex-1">{EVAL_STAGE_KEYS.includes(s.key) ? t(`company.stageLabel.eval.${s.key}`) : t(`company.stage.${s.key}`)}</span>
              {summary ? (
                <span className="flex items-center gap-1 text-[10.5px] font-extrabold tabular-nums">
                  <span className="text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{t('company.eval.fitSummary', { n: summary.fit })}</span>
                  <span className="text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{t('company.eval.unfitSummary', { n: summary.unfit })}</span>
                </span>
              ) : (
                <span className="text-[10.5px] font-bold text-gray-400 bg-white border border-dashed border-gray-300 px-2 py-0.5 rounded-full">
                  {t('company.eval.notRated')}
                </span>
              )}
              <ChevronRight className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', expanded && 'rotate-90')} />
            </button>
            {expanded && (
              <div className="px-3 py-2.5 border-t border-border bg-white flex flex-col gap-1.5">
                {stageEvals.map(e => {
                  const isMe = e.reviewer_user_id === currentUserId;
                  const isOwnerRole = e.reviewer_role === 'owner';
                  return (
                    <div key={e.id} className="bg-gray-50/70 border border-border rounded-md px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-foreground">
                          {isMe ? `${t('company.eval.me')} (${e.reviewer_name || ''})` : (e.reviewer_name || '—')}
                        </span>
                        <span className={cn(
                          'text-[10.5px] font-extrabold px-1.5 py-0.5 rounded border',
                          isOwnerRole
                            ? 'text-gray-700 bg-gray-100 border-gray-200'
                            : 'text-gray-500 bg-white border-gray-200'
                        )}>
                          {t(`company.eval.role.${isOwnerRole ? 'owner' : 'interviewer'}`)}
                        </span>
                        <span className="ml-auto text-[11.5px] text-gray-400 font-medium">{formatEvalTime(e.created_at)}</span>
                        {isMe && (
                          <span className="flex gap-1">
                            <button
                              onClick={() => onEdit(e)}
                              className="px-2 py-0.5 text-[11px] font-bold text-gray-700 bg-white border border-border rounded hover:bg-gray-50 transition-colors"
                            >{t('company.eval.editBtn')}</button>
                            <button
                              onClick={() => onDelete(e)}
                              className="px-2 py-0.5 text-[11px] font-bold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                            >{t('company.eval.deleteBtn')}</button>
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between gap-2 items-start">
                        <span className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap flex-1">{e.comment || <span className="text-gray-400 italic">{t('company.eval.noComment')}</span>}</span>
                        {typeof e.score === 'number' && (
                          <span className={cn(
                            'text-[11.5px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 border whitespace-nowrap',
                            e.score === 1
                              ? 'text-green-700 bg-green-50 border-green-200'
                              : 'text-red-700 bg-red-50 border-red-200'
                          )}>
                            {e.score === 1 ? t('company.eval.fit') : t('company.eval.unfit')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {stageEvals.length === 0 && !isCurrent && (
                  <div className="text-[11px] text-gray-400 italic py-1">{t('company.eval.empty')}</div>
                )}
                {isCurrent && (
                  <div className="mt-2 p-3 bg-gray-50/70 border border-dashed border-border rounded-md flex flex-col gap-2.5">
                    <textarea
                      value={evalComment}
                      onChange={(e) => setEvalComment(e.target.value)}
                      placeholder={t('company.eval.commentPh')}
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-border rounded-md text-[13px] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12.5px] font-bold text-gray-700">
                        {t('company.eval.verdictLabel')} <span className="text-red-500">*</span>
                      </span>
                      <div className="inline-flex rounded-md border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setEvalScore('1')}
                          className={cn(
                            'px-3.5 h-9 text-[13px] font-extrabold transition-colors',
                            evalScore === '1' || evalScore === 1
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-700 hover:bg-green-50/60'
                          )}
                        >
                          {t('company.eval.fit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEvalScore('0')}
                          className={cn(
                            'px-3.5 h-9 text-[13px] font-extrabold transition-colors border-l border-border',
                            evalScore === '0' || evalScore === 0
                              ? 'bg-red-500 text-white'
                              : 'bg-white text-gray-700 hover:bg-red-50/60'
                          )}
                        >
                          {t('company.eval.unfit')}
                        </button>
                      </div>
                      <UButton
                        size="sm"
                        onClick={onSubmit}
                        disabled={saving || (evalScore !== '0' && evalScore !== '1' && evalScore !== 0 && evalScore !== 1)}
                        className="ml-auto"
                      >
                        {saving ? '...' : (myCurrentEval ? t('company.eval.update') : t('company.eval.submit'))}
                      </UButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
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
    }).eq('id', app.id);
    setSaving(false);
    if (error) { setErr(t('company.err.saveFailed') + error.message); return; }
    onSaved(summary);
  };

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <header style={modal.head}>
          <h2 style={modal.h}>{t('company.interview.h')}</h2>
          <button onClick={onClose} style={modal.closeBtn}><XIcon className="w-4 h-4" /></button>
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
                  <button type="button" onClick={() => removeSlot(i)} style={slot.removeBtn} title={t('company.interview.removeSlot')}><XIcon className="w-3 h-3" /></button>
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

// Built-in funnel-ordered presets shown as buttons inside the mail composer.
// `needsSlots: true` auto-opens the interview-slot picker since those mails always
// follow a "결과 + 다음 인터뷰 일정 제안" pattern.
const MAIL_PRESETS = [
  {
    key: 'received',
    labelKey: 'company.mail.preset.received',
    needsSlots: false,
    subject: '[{회사명}] {공고명} 지원 접수 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션에 지원해 주셔서 감사합니다.
제출해 주신 지원서를 잘 받았으며 검토 중입니다. 결과는 확인되는 대로 다시 안내드리겠습니다.

감사합니다.`,
  },
  {
    key: 'doc_pass',
    labelKey: 'company.mail.preset.docPass',
    needsSlots: true,
    subject: '[{회사명}] {공고명} 서류 평가 합격 및 1차 인터뷰 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션 서류 전형 결과, 다음 단계로 함께 진행하고 싶습니다. 축하드립니다.
{후보이름}님과 1차 인터뷰를 진행하고자 합니다. 아래 가능한 일정 중 회신해 주시면 확정하겠습니다.

{인터뷰일정}

장소와 방식은 일정 확정 후 안내드리겠습니다.
감사합니다.`,
  },
  {
    key: 'interview1_pass',
    labelKey: 'company.mail.preset.interview1Pass',
    needsSlots: true,
    subject: '[{회사명}] {공고명} 1차 인터뷰 합격 및 2차 인터뷰 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션 1차 인터뷰 결과, 다음 단계로 함께 진행하고 싶습니다. 축하드립니다.
{후보이름}님과 2차 인터뷰를 진행하고자 합니다. 아래 가능한 일정 중 회신해 주시면 확정하겠습니다.

{인터뷰일정}

장소와 방식은 일정 확정 후 안내드리겠습니다.
감사합니다.`,
  },
  {
    key: 'final_offer',
    labelKey: 'company.mail.preset.interview2Pass',
    needsSlots: false,
    subject: '[{회사명}] {공고명} 최종 합격 안내',
    body: `{후보이름}님, 안녕하세요.
{회사명} 채용 담당자입니다.

{공고명} 포지션에 {후보이름}님을 모시기로 결정했습니다. 축하드립니다.
입사 절차와 처우 조건은 별도로 안내드리겠습니다.

함께하게 되어 기쁩니다.
감사합니다.`,
  },
  {
    key: 'reject',
    labelKey: 'company.mail.preset.reject',
    needsSlots: false,
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

// ─── Note section ──────────────────────────────────────────────────
// Collapsible card styled exactly like the EvaluationSection stage cards.
// Notes are appended (never overwritten) and shown reverse-chronologically.
function NoteSection({ app, evals, setEvals, userId, reviewerName, expanded, onToggle, draft, setDraft, saving, setSaving, askConfirm }) {
  const { t } = useT();
  const notes = (evals || []).filter(e => e.stage === 'note').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/add-candidate-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ appId: app.id, content }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || t('company.toast.noteSaveFailed')); return; }
      setEvals(prev => [...prev, json.note]);
      setDraft('');
      toast.success(t('company.toast.noteCreated'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (noteId) => {
    askConfirm({
      title: t('company.note.confirmDeleteTitle'),
      confirmLabel: t('company.note.confirmDeleteLabel'),
      destructive: true,
      onConfirm: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/company/delete-candidate-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({ noteId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(json.error || t('company.toast.noteDeleteFailed')); return; }
        setEvals(prev => prev.filter(e => e.id !== noteId));
        toast.success(t('company.toast.noteDeleted'));
      },
    });
  };

  return (
    <div className="bg-gray-50 border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors bg-gray-50 hover:bg-gray-100"
      >
        <StickyNote className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-extrabold text-foreground flex-1">{t('company.note.h')}</span>
        <span className={cn(
          'text-[10.5px] font-extrabold px-2 py-0.5 rounded-full tabular-nums',
          notes.length > 0
            ? 'text-gray-700 bg-gray-100 border border-gray-200'
            : 'text-gray-400 bg-white border border-dashed border-gray-300',
        )}>
          {notes.length > 0 ? t('company.note.count', { n: notes.length }) : t('company.note.none')}
        </span>
        <ChevronRight className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className="px-3 py-2.5 border-t border-border bg-white flex flex-col gap-1.5">
          {notes.map(n => {
            const isMine = n.reviewer_user_id === userId;
            const isOwnerRole = n.reviewer_role === 'owner';
            return (
              <div key={n.id} className="bg-gray-50/70 border border-border rounded-md px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[13px] font-bold text-foreground">
                    {n.reviewer_name || t('company.role.anon')}
                  </span>
                  <span className={cn(
                    'text-[10.5px] font-extrabold px-1.5 py-0.5 rounded border',
                    isOwnerRole
                      ? 'text-gray-700 bg-gray-100 border-gray-200'
                      : 'text-gray-500 bg-white border-gray-200'
                  )}>
                    {isOwnerRole ? t('company.role.owner') : t('company.role.interviewer')}
                  </span>
                  <span className="ml-auto text-[11.5px] text-gray-400 font-medium">{formatEvalTime(n.created_at)}</span>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      className="px-2 py-0.5 text-[11px] font-bold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                    >
                      {t('company.note.delete')}
                    </button>
                  )}
                </div>
                <div className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{n.comment}</div>
              </div>
            );
          })}
          {notes.length === 0 && (
            <div className="text-[12.5px] text-gray-400 italic py-1">{t('company.note.empty')}</div>
          )}
          <div className="mt-2 p-3 bg-gray-50/70 border border-dashed border-border rounded-md flex flex-col gap-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder={t('company.note.ph')}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-border rounded-md text-[13px] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <div className="flex justify-end">
              <UButton
                size="sm"
                onClick={submit}
                disabled={saving || !draft.trim()}
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? t('company.note.savingShort') : t('company.note.save')}
              </UButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity timeline ─────────────────────────────────────────────
// Each event = { when, icon, iconClass, actor, action, detail }
//   actor   = who did it (candidate name / reviewer / "관리자" / "시스템")
//   action  = what they did (verb phrase, neutral tone)
//   detail  = optional metadata (score, reason, schedule, subject)
function ActivityTimeline({ t, app, evals, mailLog }) {
  const candidateName = app.applicant_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
  const events = [];

  // ① Applied — actor = candidate themselves
  events.push({
    when: app.created_at,
    icon: Inbox,
    iconClass: 'text-gray-700 bg-gray-100',
    actor: candidateName,
    action: t('company.activity.applied'),
  });

  // ② Interview scheduled — actor unknown (not tracked in DB), shown as "관리자"
  if (app.interview_at) {
    const when = formatInterviewShort(app.interview_at, { withZone: false });
    const interviewerNote = app.interview_interviewer ? ` · ${t('company.activity.interviewerPrefix', { name: app.interview_interviewer })}` : '';
    events.push({
      when: app.interview_at,
      icon: Calendar,
      iconClass: 'text-gray-700 bg-gray-100',
      actor: t('company.role.owner'),
      action: t('company.activity.interviewScheduled'),
      detail: `${when} ${ICT_LABEL}${app.interview_location ? ' · ' + app.interview_location : ''}${interviewerNote}`,
    });
  }

  // ③ Evaluations, internal notes, and system audit rows
  // Audit row stages: 'note' (memo), 'unreject' (rejection reversed),
  // 'stage_move' (stage change), '${stage}_pass' (stage-pass decision).
  (evals || []).forEach(e => {
    // `${stage}_snap` rows store per-stage interview snapshots — internal
    // bookkeeping, not user-facing history. Hide them from the timeline.
    if (typeof e.stage === 'string' && e.stage.endsWith('_snap')) return;
    const role = e.reviewer_role === 'owner' ? t('company.role.owner') : t('company.role.interviewer');
    const isNote = e.stage === 'note';
    const isUnreject = e.stage === 'unreject';
    const isStageMove = e.stage === 'stage_move';
    const isStagePass = typeof e.stage === 'string' && e.stage.endsWith('_pass');
    const isAudit = isNote || isUnreject || isStageMove || isStagePass;
    let icon = Star;
    if (isStageMove) icon = ChevronRight;
    else if (isStagePass) icon = ThumbsUp;
    else if (isUnreject) icon = RotateCcw;
    else if (isNote) icon = StickyNote;
    let action;
    if (isStageMove) {
      // comment may be either a legacy plain stage key ('viewed') or a
      // JSON blob carrying { newStage, prevStage, snapshot }. Handle both.
      let newStageKey = e.comment;
      try {
        const parsed = JSON.parse(e.comment);
        if (parsed && parsed.newStage) newStageKey = parsed.newStage;
      } catch {}
      action = t('company.activity.stageMoved', { stage: t(`company.stage.${newStageKey}`) });
    }
    else if (isStagePass) {
      const stageKey = e.stage.replace('_pass', '');
      const stageLabel = t(`company.stageLabel.short.${stageKey}`) || stageKey;
      action = t('company.activity.stagePassed', { stage: stageLabel });
    }
    else if (isUnreject) action = t('company.activity.unrejected');
    else if (isNote) action = t('company.activity.noteLeft');
    else action = t('company.activity.evalLeft', { stage: t(`company.stage.${e.stage}`) });
    events.push({
      when: e.created_at,
      icon,
      iconClass: 'text-gray-700 bg-gray-100',
      actor: e.reviewer_name || t('company.role.anon'),
      actorRole: role,
      action,
      detail: isAudit ? null : (e.comment || null),
      badge: !isAudit && typeof e.score === 'number'
        ? (e.score === 1 ? { text: t('company.eval.fitShort'), tone: 'fit' } : { text: t('company.eval.unfitShort'), tone: 'red' })
        : null,
    });
  });

  // ④ Mails — actor unknown, shown as "관리자"
  (mailLog || []).forEach(m => {
    const legacyTpl = m.template_key && ['received', 'interview', 'offer', 'reject'].includes(m.template_key);
    const tplLabel = legacyTpl ? t(`company.tpl.${m.template_key}.label`) : (m.template_key || t('company.activity.mailFallback'));
    events.push({
      when: m.created_at,
      icon: Send,
      iconClass: 'text-gray-700 bg-gray-100',
      actor: t('company.role.owner'),
      action: t('company.activity.mailSent'),
      detail: m.subject || null,
      badge: { text: tplLabel, tone: 'gray' },
    });
  });

  // ⑤ Rejected — actor unknown, shown as "관리자"
  if (app.rejected_at) {
    const reason = app.rejection_reason === 'other'
      ? (app.rejection_note || '')
      : (app.rejection_reason ? t(`company.reject.reason.${app.rejection_reason}`) : '');
    const rejectedStage = app.rejected_at_stage ? t(`company.stage.${app.rejected_at_stage}`) : null;
    events.push({
      when: app.rejected_at,
      icon: Ban,
      iconClass: 'text-red-700 bg-red-100',
      actor: t('company.role.owner'),
      action: rejectedStage
        ? t('company.activity.rejectedAtStage', { stage: rejectedStage })
        : t('company.activity.rejectedPlain'),
      detail: reason ? t('company.activity.reasonPrefix', { reason }) : null,
    });
  }

  // ⑥ (removed) — stage moves are now tracked per move via stage_move audit
  // rows in application_evaluations (handled in ③ above), so a single static
  // marker would duplicate or shadow the real history.

  events.sort((a, b) => new Date(b.when) - new Date(a.when));

  const fmt = (iso) => formatLocalShort(iso);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-6 text-[11.5px] text-gray-400 font-semibold border border-dashed border-gray-200 rounded-md">
        <History className="w-3.5 h-3.5" />
        {t('company.activity.empty')}
      </div>
    );
  }

  // Mostly neutral; "red" stays for rejection, "fit" uses green so an
  // "적합" verdict reads as a positive signal next to the gray defaults.
  const badgeToneClass = {
    gray: 'text-gray-700 bg-gray-100 border border-gray-200',
    red:  'text-red-700 bg-red-50 border border-red-200',
    fit:  'text-green-700 bg-green-50 border border-green-200',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-extrabold text-gray-500 uppercase tracking-[0.08em]">
          {t('company.activity.h')}
        </div>
        <span className="text-[10.5px] font-bold text-gray-400 tabular-nums">{t('company.activity.countUnit', { n: events.length })}</span>
      </div>
      <div className="relative space-y-3.5">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="flex gap-2.5 relative">
              {/* connector line */}
              {i < events.length - 1 && (
                <div className="absolute left-[13px] top-7 bottom-[-14px] w-px bg-gray-200" />
              )}
              <div className={cn('relative flex-shrink-0 w-8 h-8 rounded-full grid place-items-center', e.iconClass)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 pb-0.5">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="text-[13.5px] leading-snug min-w-0 flex-1">
                    <span className="font-extrabold text-gray-900">{e.actor}</span>
                    {e.actorRole && (
                      <span className="ml-1 text-[11.5px] font-bold text-gray-500">({e.actorRole})</span>
                    )}
                    <span className="text-gray-700 font-medium">{ka(e.actor)} {e.action}.</span>
                  </div>
                  <span className="text-[11.5px] font-semibold text-gray-500 flex-shrink-0 tabular-nums">{fmt(e.when)}</span>
                </div>
                {(e.detail || e.badge) && (
                  <div className="mt-1.5 flex items-start gap-1.5 flex-wrap">
                    {e.badge && (
                      <span className={cn('text-[11.5px] font-extrabold px-2 py-0.5 rounded tabular-nums', badgeToneClass[e.badge.tone] || badgeToneClass.gray)}>
                        {e.badge.text}
                      </span>
                    )}
                    {e.detail && (
                      <span className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line flex-1 min-w-0 break-words">
                        {e.detail}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MailComposer({
  candidateName, candidateEmail, jobTitle, companyName, companyId,
  applicationId, stage, onClose, onSent, askConfirm,
}) {
  const { t, lang } = useT();
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedPresetKey, setSelectedPresetKey] = useState('');
  // 'blank' when the user picked the 직접 입력 button in the 내 템플릿 row.
  const [pickedBlank, setPickedBlank] = useState(false);
  // When set, the composer is in edit mode for the given custom template id.
  const [editingTplId, setEditingTplId] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [slots, setSlots] = useState([{ date: '', time: '14:00' }]);
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

  // Slots are filled into the body manually via per-row "입력" buttons now,
  // so the placeholder stays in subject/body until the user clicks insert.
  const vars = { name: candidateName, jobTitle, companyName, slotsText: '{인터뷰일정}', stage, lang };

  const pickTemplate = (id) => {
    setSelectedPresetKey('');
    setPickedBlank(false);
    setEditingTplId(null);
    setSelectedId(id);
    if (!id) { setSubject(''); setBody(''); return; }
    const tpl = templates.find(x => x.id === id);
    if (!tpl) return;
    setSubject(fillVars(tpl.subject, vars));
    setBody(fillVars(tpl.body, vars));
  };

  const pickPreset = (preset) => {
    setSelectedId('');
    setPickedBlank(false);
    setEditingTplId(null);
    setSelectedPresetKey(preset.key);
    if (preset.needsSlots && !showSlots) setShowSlots(true);
    setSubject(fillVars(preset.subject, vars));
    setBody(fillVars(preset.body, vars));
  };

  const useBlankTemplate = () => {
    setSelectedId('');
    setSelectedPresetKey('');
    setEditingTplId(null);
    setPickedBlank(true);
    setSubject('');
    setBody('');
  };

  const startEditTemplate = (tpl) => {
    setSelectedPresetKey('');
    setPickedBlank(false);
    setSelectedId(tpl.id);
    setEditingTplId(tpl.id);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const updateTemplate = async () => {
    setErr('');
    if (!subject.trim() || !body.trim()) { setErr(t('company.mail.tplSaveErrFields')); return; }
    setSavingTpl(true);
    const { data, error } = await supabase
      .from('recruiter_mail_templates')
      .update({ subject, body })
      .eq('id', editingTplId)
      .select('id, created_by, name, subject, body').single();
    setSavingTpl(false);
    if (error) { setErr(t('company.mail.tplSaveErr') + error.message); return; }
    setTemplates(prev => prev.map(x => x.id === data.id ? data : x));
    setEditingTplId(null);
  };

  const updateSlot = (i, field, value) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  const addSlot = () => setSlots(prev => [...prev, { date: '', time: '14:00' }]);
  const removeSlot = (i) => setSlots(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i));

  // Insert one slot line into the body. Order of operations so that repeated
  // "입력" clicks stack the slots contiguously:
  //   1) replace the first {인터뷰일정} placeholder, OR
  //   2) splice right after the last existing slot line, OR
  //   3) append to the end.
  // Numbering uses (existing slot count + 1) — independent of which row was clicked.
  const insertSlot = (i) => {
    const s = slots[i];
    if (!s?.date) { setErr(t('company.mail.tplSaveErrFields')); return; }
    setErr('');
    setBody(prev => {
      const SLOT_RE = /\d+\)\s\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}\s\(ICT\)/g;
      const matches = [...prev.matchAll(SLOT_RE)];
      const line = `${matches.length + 1}) ${s.date} ${s.time || '00:00'} ${ICT_LABEL}`;
      if (prev.includes('{인터뷰일정}')) return prev.replace('{인터뷰일정}', line);
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        const insertAt = last.index + last[0].length;
        return prev.slice(0, insertAt) + '\n' + line + prev.slice(insertAt);
      }
      return prev && !prev.endsWith('\n') ? prev + '\n' + line : prev + line;
    });
  };

  const send = async () => {
    setErr('');
    if (!applicationId) { setErr(t('company.err.noAppId')); return; }
    if (!subject.trim() || !body.trim()) { setErr(t('company.mail.tplSaveErrFields')); return; }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tplName = selectedPresetKey
        ? t(MAIL_PRESETS.find(p => p.key === selectedPresetKey)?.labelKey || '')
        : selectedId ? (templates.find(x => x.id === selectedId)?.name || '') : '';
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

  const deleteTemplate = (tpl) => {
    if (!tpl.created_by) { setErr(t('company.mail.tplDeleteSystem')); return; }
    askConfirm?.({
      title: t('company.mail.tplDeleteConfirm', { name: tpl.name }),
      confirmLabel: t('company.mail.tplDeleteBtn') || '삭제',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('recruiter_mail_templates').delete().eq('id', tpl.id);
        if (error) { setErr(error.message); return; }
        setTemplates(prev => prev.filter(x => x.id !== tpl.id));
        if (selectedId === tpl.id) { setSelectedId(''); setSubject(''); setBody(''); }
      },
    });
  };

  const selectedTpl = templates.find(x => x.id === selectedId);
  const canDeleteSelected = !!(selectedTpl && selectedTpl.created_by === userId);
  // Hide system-seeded templates (created_by NULL) from the dropdown — they are
  // superseded by the preset buttons above. Only show user-saved custom ones.
  const customTemplates = templates.filter(x => x.created_by !== null);

  return (
    <UDialog open onOpenChange={(open) => { if (!open && !sending) onClose(); }}>
      <UDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <UDialogHeader>
          <UDialogTitle>{t('company.mail.h')}</UDialogTitle>
        </UDialogHeader>

        <div className="space-y-4">

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.mail.presetH')}</label>
            <div className="flex flex-wrap gap-1.5">
              {MAIL_PRESETS.map(p => {
                const active = selectedPresetKey === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={cn(
                      'h-8 px-3 rounded-full text-[12px] font-bold border transition-colors',
                      active
                        ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    )}
                  >
                    {t(p.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.mail.myTplH')}</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={useBlankTemplate}
                className={cn(
                  'h-8 px-3 rounded-full text-[12px] font-bold border transition-colors',
                  pickedBlank
                    ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700'
                    : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                )}
              >
                {t('company.mail.blank')}
              </button>
              {customTemplates.map(tpl => {
                const active = selectedId === tpl.id;
                const canManage = tpl.created_by === userId;
                return (
                  <div key={tpl.id} className="relative inline-flex">
                    <button
                      type="button"
                      onClick={() => pickTemplate(tpl.id)}
                      className={cn(
                        'h-8 pl-3 rounded-full text-[12px] font-bold border transition-colors',
                        canManage ? 'pr-8' : 'pr-3',
                        active
                          ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-700'
                          : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                      )}
                    >
                      {tpl.name}
                      {editingTplId === tpl.id && (
                        <span className="ml-1.5 text-[10.5px] font-extrabold opacity-80">{t('company.mail.editingBadge')}</span>
                      )}
                    </button>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'absolute right-0.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                              active ? 'text-white/90 hover:bg-white/15' : 'text-gray-500 hover:bg-gray-200'
                            )}
                            title={t('company.mail.tplMore')}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => startEditTemplate(tpl)}>
                            <Edit3 className="h-4 w-4 text-gray-500" />
                            {t('company.mail.tplEdit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteTemplate(tpl)} className="text-red-600 focus:text-red-700">
                            <Trash2 className="h-4 w-4 text-red-500" />
                            {t('company.mail.tplDelete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.mail.to')}</label>
            <UInput value={candidateEmail} readOnly className="bg-gray-100 text-gray-500" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.mail.subject')}</label>
            <UInput value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground py-1">
            <input type="checkbox" checked={showSlots} onChange={(e) => setShowSlots(e.target.checked)} className="w-4 h-4 accent-primary-500" />
            <Calendar className="w-4 h-4 text-primary-600" />
            <span>{t('company.mail.slotsH')}</span>
          </label>
          {showSlots && (
            <div className="space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
              {slots.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <UInput type="date" lang={lang} value={s.date} onChange={(e) => updateSlot(i, 'date', e.target.value)} className="flex-[1.6] min-w-0" />
                  <UInput type="time" lang={lang} value={s.time} onChange={(e) => updateSlot(i, 'time', e.target.value)} className="flex-1 min-w-0" />
                  <UButton type="button" size="sm" variant="outline" onClick={() => insertSlot(i)} disabled={!s.date} className="h-9 px-3 text-xs font-bold flex-shrink-0">
                    {t('company.mail.slotInsert')}
                  </UButton>
                  {slots.length > 1 && (
                    <UButton type="button" size="icon" variant="ghost" onClick={() => removeSlot(i)} className="h-9 w-9 text-gray-500 hover:text-red-600 flex-shrink-0" title={t('company.mail.slotRemove')}>
                      <XIcon className="w-4 h-4" />
                    </UButton>
                  )}
                </div>
              ))}
              <UButton type="button" size="sm" variant="outline" onClick={addSlot} className="h-8 px-3 text-xs font-bold">
                {t('company.mail.slotAdd')}
              </UButton>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.mail.body')}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <p className="text-xs text-gray-500">{t('company.mail.varsHint')}</p>
          </div>

          {editingTplId ? (
            <div className="flex items-center gap-2">
              <UButton variant="outline" size="sm" onClick={() => setEditingTplId(null)} disabled={savingTpl}>
                {t('company.mail.editCancel')}
              </UButton>
              <UButton size="sm" onClick={updateTemplate} disabled={savingTpl}>
                <Save className="w-4 h-4" />
                {savingTpl ? t('company.savingShort') : t('company.mail.editDone')}
              </UButton>
            </div>
          ) : showSaveDialog ? (
            <div className="rounded-lg bg-primary-50/50 border border-primary-200 p-3 space-y-2.5">
              <div className="text-sm font-bold text-primary-800">{t('company.mail.tplSaveTitle')}</div>
              <UInput
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                placeholder={t('company.mail.tplSaveNamePh')}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <UButton variant="outline" size="sm" onClick={() => { setShowSaveDialog(false); setNewTplName(''); setErr(''); }} disabled={savingTpl}>
                  {t('company.cancel')}
                </UButton>
                <UButton size="sm" onClick={saveAsTemplate} disabled={savingTpl}>
                  {savingTpl ? t('company.savingShort') : t('company.mail.tplSaveSaveBtn')}
                </UButton>
              </div>
            </div>
          ) : (
            <UButton variant="ghost" size="sm" onClick={() => setShowSaveDialog(true)} className="text-primary-700 hover:bg-primary-50">
              <Save className="w-4 h-4" />
              {t('company.mail.tplSaveBtn')}
            </UButton>
          )}

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>
          )}
        </div>

        <UDialogFooter>
          <UButton variant="outline" onClick={onClose}>{t('company.cancel')}</UButton>
          <UButton onClick={send} disabled={sending}>
            <Send className="w-4 h-4" />
            {sending ? t('company.mail.sending') : t('company.mail.send')}
          </UButton>
        </UDialogFooter>
      </UDialogContent>
    </UDialog>
  );
}

export function ConfirmModal({ title, message, confirmLabel, cancelLabel, tone = 'primary', variant = 'confirm', onConfirm, onCancel }) {
  const { t } = useT();
  const isAlert = variant === 'alert';
  return (
    <UDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <UDialogContent className="max-w-md">
        <UDialogHeader>
          <UDialogTitle>{title}</UDialogTitle>
        </UDialogHeader>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{message}</p>
        <UDialogFooter>
          {!isAlert && (
            <UButton variant="outline" onClick={onCancel}>
              {cancelLabel || t('company.cancel')}
            </UButton>
          )}
          <UButton variant={tone === 'danger' ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel || t('company.confirm')}
          </UButton>
        </UDialogFooter>
      </UDialogContent>
    </UDialog>
  );
}

export function InterviewConfirmModal({ app, onClose, onSaved, askConfirm }) {
  const { t, lang } = useT();
  const initial = utcToIctInput(app.interview_at);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [location, setLocation] = useState(app.interview_location || '');
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
      // Interviewer selection has been removed from the form; keep the column
      // as-is on edit so legacy data isn't wiped.
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('job_applications').update(payload).eq('id', app.id);
    setSaving(false);
    if (error) { setErr(t('company.err.saveFailed') + error.message); return; }
    onSaved(payload);
  };

  const clear = () => {
    askConfirm?.({
      title: t('company.interview.confirmClear'),
      confirmLabel: t('company.delete') || '삭제',
      destructive: true,
      onConfirm: async () => {
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
      },
    });
  };

  return (
    <UDialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <UDialogContent className="max-w-lg">
        <UDialogHeader>
          <UDialogTitle>{t('company.interview.confirmH')}</UDialogTitle>
          <UDialogDescription>{t('company.interview.confirmSub')}</UDialogDescription>
        </UDialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">
                {t('company.interview.confirmDateLabel')} <span className="text-red-500">*</span>
              </label>
              <UInput type="date" lang={lang} value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">
                {t('company.interview.confirmTimeLabel')} <span className="text-red-500">*</span>
              </label>
              <UInput type="time" lang={lang} value={time} onChange={(e) => setTime(e.target.value)} disabled={saving} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.interview.locLabel')}</label>
            <UInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('company.interview.locPh')} disabled={saving} />
          </div>

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>
          )}
        </div>

        <UDialogFooter>
          {isEdit && (
            <UButton variant="outline" onClick={clear} disabled={saving} className="mr-auto text-destructive border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
              {t('company.interview.confirmClear')}
            </UButton>
          )}
          <UButton variant="outline" onClick={onClose} disabled={saving}>{t('company.cancel')}</UButton>
          <UButton onClick={save} disabled={saving}>
            {saving ? t('company.savingShort') : t('company.interview.confirmSave')}
          </UButton>
        </UDialogFooter>
      </UDialogContent>
    </UDialog>
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
      // Go through server endpoint so an audit row (stage='unreject') is
      // recorded in application_evaluations for the activity timeline.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const r = await fetch('/api/company/unreject-candidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({ appId: app.id }),
        });
        const j = await r.json();
        if (!r.ok) {
          setSaving(false);
          setErr(t('company.reject.errSave') + (j?.error || ''));
          return;
        }
        setSaving(false);
        onSaved({
          rejected_at: null,
          rejected_at_stage: null,
          rejection_reason: null,
          rejection_note: null,
          updated_at: new Date().toISOString(),
        });
        return;
      } catch (e) {
        setSaving(false);
        setErr(t('company.reject.errSave') + (e?.message || ''));
        return;
      }
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
    <UDialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <UDialogContent className="max-w-lg">
        <UDialogHeader>
          <UDialogTitle>{isUnreject ? t('company.reject.unrejectH') : isEdit ? t('company.reject.editH') : t('company.reject.h')}</UDialogTitle>
        </UDialogHeader>

        <div className="space-y-4">
          {isUnreject ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-800 font-semibold leading-relaxed">
              {t('company.reject.unrejectMsg', { name: candidateName, stage: stageLabel })}
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-800 font-semibold leading-relaxed">
                {t('company.reject.sub', { name: candidateName, stage: stageLabel })}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">{t('company.reject.reasonLabel')}</label>
                <div className="flex flex-col gap-2 py-1">
                  {REJECT_REASONS.map(r => (
                    <label key={r} className="flex items-center gap-2.5 cursor-pointer text-sm text-foreground hover:text-primary-700 transition-colors">
                      <input
                        type="radio"
                        name="reject-reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        disabled={saving}
                        className="w-4 h-4 accent-primary-500"
                      />
                      <span>{t(`company.reject.reason.${r}`)}</span>
                    </label>
                  ))}
                </div>
                {reason === 'other' && (
                  <UInput
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('company.reject.notePh')}
                    disabled={saving}
                  />
                )}
                <p className="text-xs text-gray-500">{t('company.reject.reasonHint')}</p>
              </div>
            </>
          )}

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>
          )}
        </div>

        <UDialogFooter>
          <UButton variant="outline" onClick={onClose} disabled={saving}>
            {t('company.cancel')}
          </UButton>
          <UButton
            variant={isUnreject ? 'default' : 'destructive'}
            onClick={save}
            disabled={saving}>
            {saving ? t('company.savingShort') : (
              isUnreject
                ? t('company.reject.unrejectConfirm')
                : isEdit
                  ? t('company.reject.editSave')
                  : t('company.reject.confirm')
            )}
          </UButton>
        </UDialogFooter>
      </UDialogContent>
    </UDialog>
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
  btnNext: { width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: '#EA580C', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)' },
  btnAction: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnMail: { width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: '#EA580C', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)' },
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
  btnAdvance: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 8, border: 'none', background: '#EA580C', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnRejectSolid: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 8, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(185,28,28,0.22)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnDecisionLocked: { flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 8, border: '1px dashed #D1D5DB', background: '#F8FAFC', color: '#94A3B8', fontSize: 13, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  finalPassCard: { padding: '16px 18px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center' },
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
  btnPrimary: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EA580C', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#E5E7EB', color: '#94A3B8', fontSize: 13, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' },
};
