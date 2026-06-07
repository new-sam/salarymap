import { useState, useEffect, useRef, Fragment } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';
import { toast } from 'sonner';
import { formatICT, ictInputToUtc, utcToIctInput, ICT_LABEL } from '../../lib/timezone';
import { cn } from '../../lib/cn';
import { Button as UButton } from '../ui/button';
import { Badge as UBadge } from '../ui/badge';
import { Input as UInput } from '../ui/input';
import { Dialog as UDialog, DialogContent as UDialogContent, DialogHeader as UDialogHeader, DialogTitle as UDialogTitle, DialogDescription as UDialogDescription, DialogFooter as UDialogFooter } from '../ui/dialog';
import { Calendar, Mail, Ban, Lock, Check, X as XIcon, Edit3, RotateCcw, Send, Save, Trash2, MapPin, User as UserIcon, Briefcase, AlertCircle, MessageSquare, Star, ChevronRight, ChevronLeft, FileX, Lightbulb, History, MessageCircle as MessageCircleIcon, StickyNote, ThumbsUp, ExternalLink, Trophy, Inbox } from 'lucide-react';
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

const STAGE_DOT_CLASS = {
  pending: 'bg-gray-400',
  viewed: 'bg-blue-500',
  reviewing: 'bg-violet-500',
  decided: 'bg-emerald-500',
};
const STAGE_SOLID_CLASS = {
  pending: 'bg-gray-700',
  viewed: 'bg-blue-600',
  reviewing: 'bg-violet-600',
  decided: 'bg-emerald-600',
};
// Evaluation-section label (different from kanban stage label).
// 'decided' is excluded — no evaluation after the final decision.
const EVAL_STAGE_LABEL = {
  pending: '서류 평가',
  viewed: '1차 인터뷰 평가',
  reviewing: '2차 인터뷰 평가',
};
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

  const [tab, setTab] = useState('eval');
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
        toast.error(json.error || '메모 저장 실패');
        return;
      }
      setApp(prev => ({ ...prev, admin_note: noteDraft, admin_note_updated_at: json.updatedAt }));
      setNoteSavedAt(json.updatedAt);
      setNoteSavedByName(json.updatedByName);
      setNoteDirty(false);
      if (!silent) toast.success('메모가 저장되었습니다');
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
        description: '다른 단계의 후보로 이동했습니다',
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
      else if (key === 'Enter' && app && !app.rejected_at) {
        const ownerNow = !job?.created_by || job?.created_by === userId;
        if (!ownerNow) return;
        const i = STAGE_ORDER.indexOf(app.status);
        if (i < STAGE_ORDER.length - 1) {
          e.preventDefault();
          moveNext();
        }
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
    if (error) { setErr('수정 실패: ' + error.message); toast.error('수정 실패: ' + error.message); return; }
    setEvals(prev => prev.map(e => e.id === data.id ? data : e));
    setEditingEval(null);
    toast.success(t('company.eval.editBtn'));
  };

  const deleteEvaluation = async (row) => {
    if (!window.confirm(t('company.eval.confirmDelete'))) return;
    const { error } = await supabase.from('application_evaluations').delete().eq('id', row.id);
    if (error) { setErr('삭제 실패: ' + error.message); toast.error('삭제 실패: ' + error.message); return; }
    setEvals(prev => prev.filter(e => e.id !== row.id));
    toast.success(t('company.eval.deleteBtn'));
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
    if (error) { setErr('평가 저장 실패: ' + error.message); toast.error('평가 저장 실패: ' + error.message); return; }
    setEvals(prev => {
      const exists = prev.some(e => e.id === data.id);
      return exists ? prev.map(e => e.id === data.id ? data : e) : [...prev, data];
    });
    setEvalComment('');
    setEvalScore('');
    toast.success(t('company.eval.submit'));
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
  // Per-stage decision label, e.g. pending → "서류" → "서류 합격" / "서류 불합격"
  const STAGE_DECISION_LABEL = { pending: '서류', viewed: '1차 인터뷰', reviewing: '2차 인터뷰' };
  const decisionPrefix = STAGE_DECISION_LABEL[app.status] || t(`company.stage.${app.status}`);
  const wishSalaryLabel = app.applicant_salary
    ? `₫${Math.round(app.applicant_salary / 1e6)}M/월`
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
    const evalStageLabel = EVAL_STAGE_LABEL[app.status] || '';
    const myEvalThisStage = evals.find(e => e.stage === app.status && e.reviewer_user_id === userId);
    const hasMyEval = !!myEvalThisStage;
    const stageEvals = evals.filter(e => e.stage === app.status);
    const hasAnyEvalThisStage = stageEvals.length > 0;
    const daysSinceApplied = Math.max(0, Math.floor((Date.now() - new Date(app.created_at).getTime()) / 86400000));

    const interviewWhen = app.interview_at
      ? `${formatICT(app.interview_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} ${ICT_LABEL}`
      : null;
    const interviewPast = app.interview_at && new Date(app.interview_at).getTime() < Date.now();

    // Mail tracking — heuristic: was the relevant template ever sent?
    // For interview mail we only count those sent within 21 days before the
    // current interview_at so a stale 1차 mail doesn't suppress the 2차 prompt.
    const offerMailSent = mailLog.some(m => m.template_key === 'offer');
    const rejectMailSent = mailLog.some(m => m.template_key === 'reject');
    const interviewMailForCurrent = app.interview_at && mailLog.some(m => {
      if (m.template_key !== 'interview') return false;
      const sentAt = new Date(m.created_at).getTime();
      const iv = new Date(app.interview_at).getTime();
      return sentAt <= iv && (iv - sentAt) < 21 * 86400000;
    });

    // ── Rejected (terminal) ────────────────────────────────────────
    if (app.rejected_at) {
      if (!isOwner) {
        return {
          tone: 'gray',
          eyebrow: '면접관 · 종결',
          title: '불합격 처리된 후보입니다',
        };
      }
      if (!rejectMailSent) {
        return {
          tone: 'gray',
          eyebrow: '공고 관리자 · 안내 메일 필요',
          title: '불합격 안내 메일을 발송하세요',
        };
      }
      return {
        tone: 'gray',
        eyebrow: '공고 관리자 · 종결',
        title: '불합격 안내가 완료되었습니다',
      };
    }

    // ── Interviewer flow ──────────────────────────────────────────
    if (!isOwner) {
      if (app.status === 'pending') {
        return {
          tone: 'gray',
          eyebrow: '면접관 · 대기',
          title: '아직 평가 요청을 받지 않았습니다',
        };
      }
      if (app.status === 'decided') {
        return {
          tone: 'emerald',
          eyebrow: '면접관 · 종결',
          title: '이 후보는 최종 합격되었습니다',
        };
      }
      // viewed / reviewing
      if (hasMyEval) {
        return {
          tone: 'emerald',
          eyebrow: '면접관 · 평가 완료',
          title: `${evalStageLabel}를 완료했습니다`,
        };
      }
      return {
        tone: 'blue',
        eyebrow: '면접관 · 평가 필요',
        title: `${evalStageLabel}를 작성해주세요`,
      };
    }

    // ── Owner flow ────────────────────────────────────────────────
    // 지원 접수 — 평가 → 결정
    if (app.status === 'pending') {
      if (!hasAnyEvalThisStage) {
        if (daysSinceApplied >= 7) {
          return {
            tone: 'primary',
            eyebrow: `검토 ${daysSinceApplied}일 경과`,
            title: '빠른 결정이 필요합니다',
          };
        }
        if (!hasResume) {
          return {
            tone: 'primary',
            eyebrow: '공고 관리자 · 서류 검토',
            title: '이력서가 첨부되지 않았습니다',
          };
        }
        return {
          tone: 'primary',
          eyebrow: '공고 관리자 · 서류 평가',
          title: '이력서를 검토하고 서류 평가를 작성하세요',
        };
      }
      // 평가 작성됨 → 결정
      return {
        tone: 'primary',
        eyebrow: '공고 관리자 · 결정 필요',
        title: '서류 합격 또는 불합격을 결정하세요',
      };
    }

    // 1차/2차 인터뷰 — 일정 → 메일 → 인터뷰 → 평가 → 결정
    if (app.status === 'viewed' || app.status === 'reviewing') {
      const tone = app.status === 'viewed' ? 'blue' : 'violet';
      const stageLabel = app.status === 'viewed' ? '1차 인터뷰' : '2차 인터뷰';

      // (1) 일정 없음 → 일정 등록
      if (!app.interview_at) {
        return {
          tone,
          eyebrow: `공고 관리자 · ${stageLabel}`,
          title: `${stageLabel} 일정을 등록하세요`,
        };
      }

      // (2) 일정 미래 + 메일 미발송 → 메일 발송
      if (!interviewPast && !interviewMailForCurrent) {
        return {
          tone,
          eyebrow: `공고 관리자 · 안내 메일 필요`,
          title: `${stageLabel} 안내 메일을 발송하세요`,
        };
      }

      // (3) 일정 미래 + 메일 발송됨 → 인터뷰까지 대기
      if (!interviewPast) {
        return {
          tone,
          eyebrow: '공고 관리자 · 인터뷰 예정',
          title: `${stageLabel}가 ${interviewWhen}에 예정되어 있습니다`,
        };
      }

      // (4) 일정 종료 + 본인 평가 없음 → 평가 작성
      if (!hasMyEval) {
        return {
          tone,
          eyebrow: '공고 관리자 · 평가 필요',
          title: `${stageLabel} 평가를 작성하세요`,
        };
      }

      // (5) 일정 종료 + 평가 있음 → 결정
      return {
        tone,
        eyebrow: '공고 관리자 · 결정 필요',
        title: app.status === 'viewed' ? '다음 단계를 결정하세요' : '최종 결정을 내려주세요',
      };
    }

    // 최종 합격 — 합격 메일 → 처우 협의
    if (app.status === 'decided') {
      if (!offerMailSent) {
        return {
          tone: 'emerald',
          eyebrow: '공고 관리자 · 안내 메일 필요',
          title: '합격 안내 메일을 발송하세요',
        };
      }
      return {
        tone: 'emerald',
        eyebrow: '공고 관리자 · 처우 협의',
        title: '입사 협의를 진행하세요',
      };
    }

    return null;
  })();
  const hintToneClass = {
    primary: 'bg-primary-50 border-primary-200 text-primary-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    violet: 'bg-violet-50 border-violet-200 text-violet-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  }[smartHint?.tone || 'gray'];
  const hintEyebrowClass = {
    primary: 'text-primary-700',
    blue: 'text-blue-700',
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    gray: 'text-gray-500',
  }[smartHint?.tone || 'gray'];

  return (
    <div className={cn(
      mode === 'overlay'
        ? 'flex flex-col h-full bg-[#FAFAFA]'
        : 'min-h-screen bg-gray-50 px-6 py-6 max-w-[1400px] mx-auto'
    )}>
      {/* Hero header — full-width sticky banner with avatar, meta, quick actions, navigation.
          Left-edge color bar reflects current stage so candidate-to-candidate sweeps make
          the stage change immediately visible. */}
      <header className={cn(
        'relative flex flex-col gap-3',
        mode === 'overlay' ? 'px-5 pt-3 pb-3 border-b border-border bg-white' : 'mb-5'
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
              <div className="flex items-center gap-1.5 -mx-1 overflow-x-auto min-w-0 flex-1">
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
                  <UButton variant="outline" size="icon" onClick={onPrev} disabled={!onPrev} className="h-8 w-8" title="이전 후보 (←)">
                    <ChevronLeft className="w-4 h-4" />
                  </UButton>
                  <div className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-gray-50 border border-border">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STAGE_DOT_CLASS[app.status])} />
                    <span className="text-[11.5px] font-bold text-gray-900 truncate">{t(`company.stage.${app.status}`)}</span>
                    {stageTotal != null && stageIndex != null && stageTotal > 0 && (
                      <span className="text-[11px] font-extrabold text-gray-900 tabular-nums">
                        {stageIndex + 1}<span className="text-gray-400">/{stageTotal}</span>
                      </span>
                    )}
                  </div>
                  <UButton variant="outline" size="icon" onClick={onNext} disabled={!onNext} className="h-8 w-8" title="다음 후보 (→)">
                    <ChevronRight className="w-4 h-4" />
                  </UButton>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
              <UButton variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" title="닫기 (Esc)">
                <XIcon className="w-4 h-4" />
              </UButton>
            </div>
          </div>
        )}
        {mode === 'page' && (
          <BackLink href={`/company/ats?job=${job.id}`} className="mb-1.5 w-fit">
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
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight truncate">{name}</h1>
            <div className="mt-1 text-[12.5px] text-gray-900 font-semibold truncate flex items-center flex-wrap gap-x-1.5">
              <span>{email}</span>
              {app.applicant_role && <><span className="text-gray-400">·</span><span>{app.applicant_role}</span></>}
              {(app.applicant_experience !== null && app.applicant_experience !== undefined) && (
                <><span className="text-gray-400">·</span><span>{app.applicant_experience}{t('company.years')}</span></>
              )}
              {wishSalaryLabel && <><span className="text-gray-400">·</span><span className="text-emerald-700">{wishSalaryLabel}</span></>}
              {mode === 'overlay' && <><span className="text-gray-400">·</span><span className="text-gray-500">{job.title}</span></>}
              <span className="text-gray-400">·</span><span className="text-gray-500">{t('company.candidate.appliedShort')} {appliedAtLabel}</span>
            </div>
          </div>

          {/* All actions on the right: communication | divider | decision.
              Aligned to the bottom of Row 1 so they sit below the name/meta block. */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap self-end">
            {canRunQuick && (
              <UButton variant="outline" size="sm" onClick={openMailCompose} title="메일 작성 (E)" className="h-9">
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                {t('company.candidate.mailComposeBtn')}
              </UButton>
            )}
            {canRunQuick && showInterviewStage && (
              <UButton variant="outline" size="sm" onClick={() => setInterviewModal(true)} className="h-9">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                {app.interview_at ? t('company.interview.confirmEditBtn') : t('company.interview.confirmBtn')}
              </UButton>
            )}
            {!canRunQuick && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                <Lock className="w-3 h-3" />
                {t('company.candidate.interviewerHint')}
              </span>
            )}

            {/* Divider between communication and decision groups */}
            {canRunQuick && !app.rejected_at && nextStage && (
              <div className="w-px h-7 bg-border mx-1" />
            )}

            {canRunQuick && !app.rejected_at && nextStage && (
              <div className="inline-flex items-stretch h-9 rounded-md border-2 border-primary-300 bg-white shadow-soft-xs overflow-hidden">
                <button
                  type="button"
                  onClick={moveNext}
                  title="합격 (Enter)"
                  className="inline-flex items-center gap-1.5 px-3 text-[13px] font-bold text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {decisionPrefix} 합격
                </button>
                <div className="w-px bg-primary-300" />
                <button
                  type="button"
                  onClick={() => setRejectModal('new')}
                  title="불합격 (R)"
                  className="inline-flex items-center gap-1.5 px-3 text-[13px] font-bold text-red-700 bg-red-50/60 hover:bg-red-100 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {decisionPrefix} 불합격
                </button>
              </div>
            )}
            {canRunQuick && app.rejected_at && (
              <UButton variant="outline" size="sm" onClick={() => setRejectModal('unreject')} className="h-9">
                <RotateCcw className="w-3.5 h-3.5" />
                {t('company.reject.unrejectBtn')}
              </UButton>
            )}
            {!app.rejected_at && app.status === 'decided' && (
              <UBadge variant="success" className="py-1.5">
                <Trophy className="w-3 h-3" />
                {t('company.candidate.finalPass')}
              </UBadge>
            )}
          </div>
        </div>

        {/* Smart hint — eyebrow + title only.
            Flowchart-driven: surfaces just the single next action for the current role × stage × state. */}
        {smartHint && (
          <div className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2', hintToneClass)}>
            <Lightbulb className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className={cn('text-[10.5px] font-extrabold uppercase tracking-[0.06em]', hintEyebrowClass)}>
                {smartHint.eyebrow}
              </div>
              <div className="text-[13px] font-bold leading-snug">{smartHint.title}</div>
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
        <section className="flex flex-col bg-white rounded-2xl border border-border shadow-soft-xs overflow-hidden min-h-[600px]">
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
              className="flex-1 w-full border-0 min-h-[720px] bg-[#f3f4f6]"
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

        <aside className="flex flex-col min-h-0">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col min-h-0">
            <TabsList>
              <TabsTrigger value="eval"><Star className="w-3.5 h-3.5" />평가</TabsTrigger>
              <TabsTrigger value="mail">
                <Mail className="w-3.5 h-3.5" />메일
                <span className={cn('font-extrabold', tab === 'mail' ? 'text-gray-900' : 'text-gray-400')}>{mailLog.length}</span>
              </TabsTrigger>
              <TabsTrigger value="history"><History className="w-3.5 h-3.5" />히스토리</TabsTrigger>
            </TabsList>

            {/* ─── Eval tab ─── */}
            <TabsContent value="eval">
              <div className="rounded-2xl bg-white border border-border shadow-soft-xs p-4 space-y-3">
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
                  isOwner={isOwner}
                  expanded={noteExpanded}
                  onToggle={() => setNoteExpanded(v => !v)}
                  draft={noteDraft}
                  setDraft={setNoteDraft}
                  saving={savingNote}
                  setSaving={setSavingNote}
                />
              </div>
            </TabsContent>

            {/* ─── History tab — activity timeline ─── */}
            <TabsContent value="history">
              <div className="rounded-2xl bg-white border border-border shadow-soft-xs p-4">
                <ActivityTimeline t={t} app={app} evals={evals} mailLog={mailLog} />
              </div>
            </TabsContent>

            {/* ─── Mail tab — log + compose ─── */}
            <TabsContent value="mail">
              <div className="rounded-2xl bg-white border border-border shadow-soft-xs p-4 space-y-3">
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
                        const when = new Date(m.created_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={m.id} className="rounded-lg border border-border px-2.5 py-2 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-bold text-gray-900">{tplLabel}</span>
                              <span className="text-[10.5px] text-gray-500 font-semibold">{when}</span>
                            </div>
                            {m.subject && <div className="text-[11.5px] text-gray-700 truncate">{m.subject}</div>}
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
                <label className="text-xs font-bold text-gray-700">평점</label>
                <div className="flex items-center gap-2">
                  <UInput
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                    placeholder="0 ~ 100"
                    className="w-28 h-9 text-sm tabular-nums"
                  />
                  <span className="text-[12px] font-bold text-gray-500">점 / 100</span>
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
  const currentStageLabel = EVAL_STAGE_LABEL[currentStage] || t(`company.stage.${currentStage}`);
  const myCurrentEval = evals.find(e => e.stage === currentStage && e.reviewer_user_id === currentUserId);
  const evalStages = stages.filter(s => EVAL_STAGE_LABEL[s.key]);

  return (
    <div className="flex flex-col gap-1.5">
      {evalStages.map(s => {
        const stageEvals = evals.filter(e => e.stage === s.key);
        const avg = avgScore(stageEvals);
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
              <span className="text-xs font-extrabold text-foreground flex-1">{EVAL_STAGE_LABEL[s.key] || t(`company.stage.${s.key}`)}</span>
              {avg != null ? (
                <span className="text-[10.5px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full tabular-nums">
                  평균 {avg}점
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
                    <div key={e.id} className="bg-gray-50/70 border border-border rounded-md px-2.5 py-2">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[11.5px] font-bold text-foreground">
                          {isMe ? `${t('company.eval.me')} (${e.reviewer_name || ''})` : (e.reviewer_name || '—')}
                        </span>
                        <span className={cn(
                          'text-[9.5px] font-extrabold px-1.5 py-0.5 rounded',
                          isOwnerRole
                            ? 'text-primary-700 bg-primary-50 border border-primary-200'
                            : 'text-sky-700 bg-sky-50 border border-sky-200'
                        )}>
                          {t(`company.eval.role.${isOwnerRole ? 'owner' : 'interviewer'}`)}
                        </span>
                        <span className="ml-auto text-[10.5px] text-gray-400 font-medium">{formatEvalTime(e.created_at)}</span>
                        {isMe && (
                          <span className="flex gap-1">
                            <button
                              onClick={() => onEdit(e)}
                              className="px-1.5 py-0.5 text-[10px] font-bold text-gray-700 bg-white border border-border rounded hover:bg-gray-50 transition-colors"
                            >{t('company.eval.editBtn')}</button>
                            <button
                              onClick={() => onDelete(e)}
                              className="px-1.5 py-0.5 text-[10px] font-bold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                            >{t('company.eval.deleteBtn')}</button>
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between gap-2 items-start">
                        <span className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap flex-1">{e.comment}</span>
                        {typeof e.score === 'number' && (
                          <span className="text-[10.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex-shrink-0 tabular-nums">
                            {e.score}점
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
                  <div className="mt-2 p-2.5 bg-gray-50/70 border border-dashed border-border rounded-md flex flex-col gap-2">
                    <textarea
                      value={evalComment}
                      onChange={(e) => setEvalComment(e.target.value)}
                      placeholder={t('company.eval.placeholder', { stage: currentStageLabel })}
                      rows={3}
                      className="w-full px-2.5 py-2 bg-white border border-border rounded-md text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-700">평점</span>
                      <UInput
                        type="number"
                        min={0}
                        max={100}
                        value={evalScore}
                        onChange={(e) => setEvalScore(e.target.value)}
                        placeholder="0 ~ 100"
                        className="w-24 h-8 text-xs tabular-nums"
                      />
                      <span className="text-[11px] font-bold text-gray-500">점 / 100</span>
                      <UButton
                        size="sm"
                        onClick={onSubmit}
                        disabled={saving || !evalComment.trim()}
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
function NoteSection({ app, evals, setEvals, userId, reviewerName, isOwner, expanded, onToggle, draft, setDraft, saving, setSaving }) {
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
      if (!res.ok) { toast.error(json.error || '메모 저장 실패'); return; }
      setEvals(prev => [...prev, json.note]);
      setDraft('');
      toast.success('메모가 추가되었습니다');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (noteId) => {
    if (!window.confirm('이 메모를 삭제하시겠어요?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/company/delete-candidate-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ noteId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json.error || '삭제 실패'); return; }
    setEvals(prev => prev.filter(e => e.id !== noteId));
    toast.success('메모가 삭제되었습니다');
  };

  return (
    <div className="bg-gray-50 border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors bg-amber-50/40 hover:bg-amber-50"
      >
        <StickyNote className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-extrabold text-foreground flex-1">메모</span>
        <span className={cn(
          'text-[10.5px] font-extrabold px-2 py-0.5 rounded-full tabular-nums',
          notes.length > 0
            ? 'text-amber-700 bg-amber-100 border border-amber-200'
            : 'text-gray-400 bg-white border border-dashed border-gray-300',
        )}>
          {notes.length > 0 ? `${notes.length}건` : '없음'}
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
                  <span className="text-[11.5px] font-bold text-foreground">
                    {n.reviewer_name || '익명'}
                  </span>
                  <span className={cn(
                    'text-[9.5px] font-extrabold px-1.5 py-0.5 rounded',
                    isOwnerRole
                      ? 'text-primary-700 bg-primary-50 border border-primary-200'
                      : 'text-sky-700 bg-sky-50 border border-sky-200'
                  )}>
                    {isOwnerRole ? '공고 관리자' : '면접관'}
                  </span>
                  <span className="ml-auto text-[10.5px] text-gray-400 font-medium">{formatEvalTime(n.created_at)}</span>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      className="px-1.5 py-0.5 text-[10px] font-bold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{n.comment}</div>
              </div>
            );
          })}
          {notes.length === 0 && (
            <div className="text-[11px] text-gray-400 italic py-1">아직 메모가 없어요</div>
          )}
          <div className="mt-2 p-2.5 bg-gray-50/70 border border-dashed border-border rounded-md flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder="이 후보자에 대한 메모를 남기세요"
              rows={3}
              className="w-full px-2.5 py-2 bg-white border border-border rounded-md text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <div className="flex justify-end">
              <UButton
                size="sm"
                onClick={submit}
                disabled={saving || !draft.trim()}
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? '저장 중…' : '메모 남기기'}
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
    action: '지원서를 제출했습니다',
  });

  // ② Interview scheduled — actor unknown (not tracked in DB), shown as "관리자"
  if (app.interview_at) {
    const when = formatICT(app.interview_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const interviewerNote = app.interview_interviewer ? ` · 면접관 ${app.interview_interviewer}` : '';
    events.push({
      when: app.interview_at,
      icon: Calendar,
      iconClass: 'text-blue-700 bg-blue-100',
      actor: '공고 관리자',
      action: '인터뷰 일정을 등록했습니다',
      detail: `${when} ${ICT_LABEL}${app.interview_location ? ' · ' + app.interview_location : ''}${interviewerNote}`,
    });
  }

  // ③ Evaluations & internal notes — actor = reviewer / author
  (evals || []).forEach(e => {
    const role = e.reviewer_role === 'owner' ? '공고 관리자' : '면접관';
    const isNote = e.stage === 'note';
    events.push({
      when: e.created_at,
      icon: isNote ? StickyNote : Star,
      iconClass: isNote ? 'text-amber-700 bg-amber-100' : 'text-amber-700 bg-amber-100',
      actor: e.reviewer_name || '익명',
      actorRole: role,
      action: isNote ? '메모를 남겼습니다' : `${t(`company.stage.${e.stage}`)} 평가를 남겼습니다`,
      detail: e.comment || null,
      badge: !isNote && typeof e.score === 'number' ? { text: `${e.score}점`, tone: 'amber' } : null,
    });
  });

  // ④ Mails — actor unknown, shown as "관리자"
  (mailLog || []).forEach(m => {
    const legacyTpl = m.template_key && ['received', 'interview', 'offer', 'reject'].includes(m.template_key);
    const tplLabel = legacyTpl ? t(`company.tpl.${m.template_key}.label`) : (m.template_key || '메일');
    events.push({
      when: m.created_at,
      icon: Send,
      iconClass: 'text-cyan-700 bg-cyan-100',
      actor: '공고 관리자',
      action: '안내 메일을 발송했습니다',
      detail: m.subject || null,
      badge: { text: tplLabel, tone: 'cyan' },
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
      actor: '공고 관리자',
      action: rejectedStage ? `${rejectedStage} 단계에서 불합격 처리했습니다` : '불합격 처리했습니다',
      detail: reason ? `사유: ${reason}` : null,
    });
  }

  // ⑥ Current stage marker (only if past first stage and not rejected)
  if (app.status !== 'pending' && !app.rejected_at) {
    events.push({
      when: app.updated_at || app.created_at,
      icon: ChevronRight,
      iconClass: 'text-primary-700 bg-primary-100',
      actor: '공고 관리자',
      action: `${t(`company.stage.${app.status}`)} 단계로 이동했습니다`,
    });
  }

  events.sort((a, b) => new Date(b.when) - new Date(a.when));

  const fmt = (iso) => new Date(iso).toLocaleString(undefined, {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-6 text-[11.5px] text-gray-400 font-semibold border border-dashed border-gray-200 rounded-md">
        <History className="w-3.5 h-3.5" />
        활동 내역이 없습니다
      </div>
    );
  }

  const badgeToneClass = {
    amber:   'text-amber-700 bg-amber-50 border border-amber-200',
    cyan:    'text-cyan-700 bg-cyan-50 border border-cyan-200',
    emerald: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
    red:     'text-red-700 bg-red-50 border border-red-200',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-extrabold text-gray-500 uppercase tracking-[0.08em]">
          활동 타임라인
        </div>
        <span className="text-[10.5px] font-bold text-gray-400 tabular-nums">{events.length}건</span>
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
              <div className={cn('relative flex-shrink-0 w-7 h-7 rounded-full grid place-items-center', e.iconClass)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 pb-0.5">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="text-[12.5px] leading-snug min-w-0 flex-1">
                    <span className="font-extrabold text-gray-900">{e.actor}</span>
                    {e.actorRole && (
                      <span className="ml-1 text-[10.5px] font-bold text-gray-500">({e.actorRole})</span>
                    )}
                    <span className="text-gray-700 font-medium">{ka(e.actor)} {e.action}.</span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-gray-500 flex-shrink-0 tabular-nums">{fmt(e.when)}</span>
                </div>
                {(e.detail || e.badge) && (
                  <div className="mt-1 flex items-start gap-1.5 flex-wrap">
                    {e.badge && (
                      <span className={cn('text-[10.5px] font-extrabold px-1.5 py-0.5 rounded tabular-nums', badgeToneClass[e.badge.tone] || badgeToneClass.amber)}>
                        {e.badge.text}
                      </span>
                    )}
                    {e.detail && (
                      <span className="text-[11.5px] text-gray-700 leading-relaxed whitespace-pre-line line-clamp-2 flex-1 min-w-0">
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
    <UDialog open onOpenChange={(open) => { if (!open && !sending) onClose(); }}>
      <UDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <UDialogHeader>
          <UDialogTitle>{t('company.mail.h')}</UDialogTitle>
        </UDialogHeader>

        <div className="space-y-4">
          {stageNote && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900 font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{stageNote}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.mail.tplLabel')}</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedId}
                onChange={(e) => pickTemplate(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1">
                <option value="">{t('company.mail.tplBlank')}</option>
                {templates.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name}{!x.created_by ? ` (${t('company.mail.systemTplBadge')})` : ''}
                  </option>
                ))}
              </select>
              {selectedId && canDeleteSelected && (
                <UButton variant="outline" size="icon" onClick={() => deleteTemplate(selectedTpl)} title={t('company.mail.tplDeleteBtn')} className="text-destructive border-red-200 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </UButton>
              )}
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
            <span>{t('company.mail.slotsToggle')}</span>
          </label>
          {showSlots && (
            <div className="space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
              {slots.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <UInput type="date" lang={lang} value={s.date} onChange={(e) => updateSlot(i, 'date', e.target.value)} className="flex-1" />
                  <UInput type="time" lang={lang} value={s.time} onChange={(e) => updateSlot(i, 'time', e.target.value)} className="w-28" />
                </div>
              ))}
              <p className="text-xs text-gray-500 mt-1">{t('company.mail.slotsHint')}</p>
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

          {showSaveDialog ? (
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
          <UButton variant="outline" onClick={onClose}>{stageNote ? t('company.skip') : t('company.cancel')}</UButton>
          <UButton variant="outline" onClick={openMailApp}>
            <Mail className="w-4 h-4" />
            {t('company.mail.openApp')}
          </UButton>
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
    <UDialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <UDialogContent className="max-w-lg">
        <UDialogHeader>
          <UDialogTitle>{t('company.interview.confirmH')}</UDialogTitle>
          <UDialogDescription>{t('company.interview.confirmSub')}</UDialogDescription>
        </UDialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold text-gray-700">{t('company.interview.confirmDateLabel')}</label>
              <UInput type="date" lang={lang} value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
            </div>
            <div className="w-36 space-y-1.5">
              <label className="text-xs font-bold text-gray-700">{t('company.interview.confirmTimeLabel')}</label>
              <UInput type="time" lang={lang} value={time} onChange={(e) => setTime(e.target.value)} disabled={saving} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.interview.locLabel')}</label>
            <UInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('company.interview.locPh')} disabled={saving} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">{t('company.interview.interviewerLabel')}</label>
            <UInput value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder={t('company.interview.interviewerPh')} disabled={saving} />
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
  btnNext: { width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(234,88,12,0.22)' },
  btnAction: { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
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
