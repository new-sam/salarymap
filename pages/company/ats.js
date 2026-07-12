import { useState, useEffect, useCallback, memo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import CandidateDetail, { MailComposer, RejectionModal, InterviewConfirmModal, ConfirmModal, templateKeyForDecision, nextStageAfter, defaultComposeTemplate } from '../../components/company/CandidateDetail';
import { formatICT, formatInterviewShort, formatLocalShortDate, ICT_LABEL } from '../../lib/timezone';
import { color, font, space, radius, shadow, motion } from '../../lib/theme';
import TeamPopover from '../../components/company/TeamPopover';
import { useT } from '../../lib/i18n';
import { apiErrorMessage } from '../../lib/apiErrorMessage';
import { toast } from 'sonner';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { MoreVertical, Calendar, Mail, Ban, Lock, Plus, Search as SearchIcon, X as XIcon, Inbox, MessageSquare, Users, Trophy, Activity, CheckCircle2, XCircle, Edit3, Clock, Check, MoveHorizontal, Briefcase, PartyPopper, ChevronLeft } from 'lucide-react';
import { PageHeader } from '../../components/ui/page-header';
import { KanbanSkeleton } from '../../components/ui/page-skeleton';
import Truncate from '../../components/ui/truncate';

const STAGE_ICONS = {
  pending: Inbox,
  viewed: MessageSquare,
  reviewing: Users,
  decided: Trophy,
};
// Neutral palette — only "decided" keeps the brand accent for the final pass moment.
const STAGE_ICON_CLASS = {
  pending:   'text-gray-400',
  viewed:    'text-gray-500',
  reviewing: 'text-gray-600',
  decided:   'text-primary-600',
};
const STAGE_COLORS = {
  pending:   'text-gray-700 bg-gray-100',
  viewed:    'text-gray-700 bg-gray-100',
  reviewing: 'text-gray-700 bg-gray-100',
  decided:   'text-primary-700 bg-primary-50',
};

const STAGES = [
  { key: 'pending', emoji: '' },
  { key: 'viewed', emoji: '' },
  { key: 'reviewing', emoji: '' },
  { key: 'decided', emoji: '' },
];

const STAGE_ORDER = STAGES.map(s => s.key);
// 단계 전진 시 자동으로 띄울 메일 템플릿

export default function CompanyATSPage() {
  const router = useRouter();
  const { t } = useT();
  const { job: jobId, app: appQueryId, stage: stageQuery, from: fromQuery } = router.query;
  // Where the candidate panel close button should send the user. Defaults to
  // staying on the kanban; `?from=todo` returns to the to-do feed so a click
  // from /company/todo round-trips back instead of stranding the user here.
  const closeReturnPath = fromQuery === 'todo' ? '/company/todo' : null;

  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [job, setJob] = useState(null);
  // 이 공고에서 현재 유저의 role. 'admin' | 'interviewer' | null.
  // admin = jobs.created_by 이거나 job_team.role='admin'.
  const [myRole, setMyRole] = useState(null);
  const [apps, setApps] = useState([]);
  const [err, setErr] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [profileMap, setProfileMap] = useState({});
  // Map<appId, Set<stagePassKey>> — which stages each candidate has been
  // marked as "합격 결정" for. Lets the kanban card show a pending-move flag.
  const [stagePassMap, setStagePassMap] = useState({});
  const [query, setQuery] = useState('');
  // Drag-and-drop stage move.
  // - 정방향 +1: 즉시 이동 (확인 X) — 합격/불합격 결정은 카드 케밥/패널에서 별도로 처리.
  // - 역방향 -1: 확인 후 이동. stage_pass(전형 결과) row만 초기화, 평가/메모/메일/인터뷰 등은 그대로.
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [mailFor, setMailFor] = useState(null);
  const [kpiFilter, setKpiFilter] = useState(null); // null | 'new' | 'inProgress' | 'hired' | 'rejected'
  const [mobileStage, setMobileStage] = useState('pending'); // mobile-only stage selector
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [rejectingApp, setRejectingApp] = useState(null);
  const [interviewApp, setInterviewApp] = useState(null);
  const [confirmCfg, setConfirmCfg] = useState(null);

  const askConfirm = (config) => new Promise(resolve => {
    setConfirmCfg({
      ...config,
      onConfirm: () => { setConfirmCfg(null); resolve(true); },
      onCancel: () => { setConfirmCfg(null); resolve(false); },
    });
  });
  const showAlert = (config) => new Promise(resolve => {
    setConfirmCfg({
      variant: 'alert',
      ...config,
      onConfirm: () => { setConfirmCfg(null); resolve(true); },
      onCancel: () => { setConfirmCfg(null); resolve(true); },
    });
  });

  // Pure mail-prompt step: ask whether to draft the result email and (on yes)
  // open MailComposer with the stage-correct preset preloaded. Does NOT move
  // the card. Skipped silently when the candidate has no email on file.
  const promptResultMail = async ({ app, decision, stage }) => {
    const profile = app.user_id ? profileMap[app.user_id] : null;
    const email = app.applicant_email || profile?.email || '';
    if (!email) return;
    const stageLabel = t(`company.stageLabel.short.${stage}`) || t(`company.stage.${stage}`) || stage;
    const name = app.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
    const titleKey = decision === 'reject'
      ? 'company.decision.mailPromptTitleReject'
      : 'company.decision.mailPromptTitlePass';
    const ok = await askConfirm({
      title: t(titleKey, { stage: stageLabel }),
      message: t('company.decision.mailPromptDesc', { name }),
      confirmLabel: t('company.decision.mailPromptConfirm'),
      cancelLabel: t('company.decision.mailPromptCancel'),
    });
    if (!ok) return;
    const tplKey = templateKeyForDecision({ decision, stage });
    if (tplKey) setMailFor({ app, profile, email, templateKey: tplKey, stage });
  };

  // Decision from the kanban kebab or 최종 합격 drop: run the mail prompt and
  // then auto-advance the card to the next stage (pass only).
  // Reject does not advance — rejected_at already takes the card out of the flow.
  const promptDecisionMailFromKanban = async ({ app, decision, stage }) => {
    await promptResultMail({ app, decision, stage });
    if (decision === 'pass') {
      const next = nextStageAfter(stage);
      if (next) await setStage(app.id, next);
    }
  };

  useEffect(() => {
    if (!menuOpenId) return;
    const onDocClick = () => setMenuOpenId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpenId]);

  useEffect(() => {
    if (!jobId) return;
    const cacheKey = `fyi.ats.${jobId}.v2`;

    // 1) Hydrate from cache for instant paint — same-session navigation feels seamless.
    const cached = typeof window !== 'undefined'
      ? (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); } catch { return null; } })()
      : null;
    if (cached) {
      setJob(cached.job);
      setApps(cached.apps || []);
      setProfileMap(cached.profileMap || {});
      setCompanyName(cached.companyName || '');
      const spm = {};
      // Serialized shape: { appId: [[stage_pass_key, rowId], ...] } — reconstruct as Map.
      // Older caches stored flat string arrays (Set values); detect & skip those.
      Object.entries(cached.stagePassMap || {}).forEach(([k, v]) => {
        if (!Array.isArray(v)) return;
        if (v.length > 0 && !Array.isArray(v[0])) return; // legacy Set-shape — ignore
        spm[k] = new Map(v);
      });
      setStagePassMap(spm);
      setStatus('ready');
    }

    (async () => {
      if (!cached) setStatus('loading');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUser(session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!rec?.company_id) { setStatus('unauthed'); return; }
      const cName = rec.recruiter_companies?.name || '';
      setCompanyName(cName);

      // 2) Job header + applications fired in parallel — both depend only on rec/jobId.
      const [jobRes, appsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, title, status, location, type, salary_min, salary_max, company_id, created_at, created_by')
          .eq('id', jobId).eq('company_id', rec.company_id).maybeSingle(),
        supabase
          .from('job_applications')
          .select('id, job_id, status, viewed_at, applicant_name, applicant_email, applicant_salary, applicant_role, applicant_experience, applicant_company, resume_url, user_id, created_at, admin_note, interview_at, interview_location, interview_interviewer, rejected_at, rejected_at_stage, rejection_reason')
          .eq('job_id', jobId).order('created_at', { ascending: true }),
      ]);
      const { data: jobData, error: jobErr } = jobRes;
      if (jobErr || !jobData) { setErr(t('company.ats.notFound')); setStatus('error'); return; }
      // Tenancy + invitation check: must own the job or be invited to it.
      // Same-company doesn't grant blanket ATS access to other people's jobs.
      const isOwnerOfJob = jobData.created_by === session.user.id;
      let resolvedRole = isOwnerOfJob ? 'admin' : null;
      if (!isOwnerOfJob) {
        const { data: teamRow } = await supabase
          .from('job_team').select('role').eq('job_id', jobId).eq('user_id', session.user.id).maybeSingle();
        if (!teamRow) { setErr(t('company.ats.notFound')); setStatus('error'); return; }
        resolvedRole = teamRow.role === 'admin' ? 'admin' : 'interviewer';
      }
      setMyRole(resolvedRole);
      setJob(jobData);
      const { data: appsData, error: appsErr } = appsRes;
      if (appsErr) { console.error('[ats] apps load error:', appsErr); setErr(t('company.ats.errLoad') + appsErr.message); }
      const appsList = appsData || [];
      setApps(appsList);

      // 3) Profiles + stage-pass audit rows in parallel — both depend only on appsList.
      const userIds = [...new Set(appsList.map(a => a.user_id).filter(Boolean))];
      const appIds = appsList.map(a => a.id);
      const [profilesRes, passesRes] = await Promise.all([
        userIds.length > 0
          ? fetch('/api/company/applicant-profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ ids: userIds }),
            }).then(r => r.ok ? r.json() : { profiles: [] }).then(d => ({ data: d.profiles }))
          : Promise.resolve({ data: [] }),
        appIds.length > 0
          ? supabase.from('application_evaluations').select('id, application_id, stage').in('application_id', appIds).in('stage', ['pending_pass', 'viewed_pass', 'reviewing_pass', 'decided_pass'])
          : Promise.resolve({ data: [] }),
      ]);
      const m = {};
      (profilesRes.data || []).forEach(p => { m[p.id] = p; });
      setProfileMap(m);
      const spm = {};
      (passesRes.data || []).forEach(r => {
        if (!spm[r.application_id]) spm[r.application_id] = new Map();
        spm[r.application_id].set(r.stage, r.id);
      });
      setStagePassMap(spm);

      setStatus('ready');

      // 4) Persist for instant paint on next entry to this job.
      // Map serializes to [[k,v], ...] tuples so cache restore can rebuild via `new Map(arr)`.
      try {
        const spmSerialized = {};
        Object.entries(spm).forEach(([k, v]) => { spmSerialized[k] = Array.from(v.entries()); });
        sessionStorage.setItem(cacheKey, JSON.stringify({
          job: jobData, apps: appsList, profileMap: m, stagePassMap: spmSerialized, companyName: cName,
        }));
      } catch {}
    })();
  }, [jobId, t]);

  // Auto-open the candidate panel if /company/ats?app=<id> is passed in
  // (used by the to-do feed for one-click access to the actionable candidate).
  // On mobile, route straight to the full candidate page instead of opening
  // the overlay so the experience matches direct tap-from-kanban.
  useEffect(() => {
    if (!appQueryId || typeof appQueryId !== 'string') return;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      // Forward the `from` hint so the mobile candidate page knows to return
      // to /company/todo on close (matches the desktop overlay behavior).
      const target = fromQuery === 'todo'
        ? `/company/candidates/${appQueryId}?from=todo`
        : `/company/candidates/${appQueryId}`;
      router.replace(target);
    } else {
      setSelectedAppId(appQueryId);
    }
  }, [appQueryId, fromQuery, router]);

  // Honor ?stage=<key> — used when returning from a candidate page so the
  // kanban lands on the stage the candidate sits in (mobile drilldown).
  useEffect(() => {
    if (stageQuery && typeof stageQuery === 'string' && STAGE_ORDER.includes(stageQuery)) {
      setMobileStage(stageQuery);
    }
  }, [stageQuery]);

  // Load stage-pass audit rows (one per stage decision) for every visible
  // candidate. Returns a Map<appId, Map<stage_pass_key, rowId>> — Map (not Set)
  // so the backward-drag rollback flow can fetch the rowId to delete via the
  // unmark-stage-pass endpoint. `.has(stageKey)` still works for the kanban
  // card/kebab consumers that only check existence.
  const loadStagePasses = async (appIds) => {
    if (!appIds || appIds.length === 0) { setStagePassMap({}); return; }
    const { data } = await supabase
      .from('application_evaluations')
      .select('id, application_id, stage')
      .in('application_id', appIds)
      .in('stage', ['pending_pass', 'viewed_pass', 'reviewing_pass', 'decided_pass']);
    const m = {};
    (data || []).forEach(r => {
      if (!m[r.application_id]) m[r.application_id] = new Map();
      m[r.application_id].set(r.stage, r.id);
    });
    setStagePassMap(m);
  };

  // Free stage move with per-stage snapshot persistence.
  //
  // Policy:
  // - On every stage move (forward OR backward), snapshot the leaving stage's
  //   interview info into application_evaluations with stage='${prev}_snap'.
  // - On entering a stage, restore that stage's most recent snapshot
  //   (interview_at / location / interviewer). Falls back to null if none.
  // - Rejected candidates can't move (drag is disabled at the card level).
  // - stage_pass (합격 결정) is *not* auto-cleared on backward moves —
  //   the user can explicitly cancel inside the candidate panel.
  const setStage = async (appId, newStatus) => {
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus || app.rejected_at) return;
    const prevStage = app.status;

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id;
    let reviewerName = t('company.role.owner');
    if (sessionUserId) {
      const { data: rec } = await supabase
        .from('recruiter_users').select('full_name, email').eq('user_id', sessionUserId).maybeSingle();
      reviewerName = rec?.full_name || (rec?.email || '').split('@')[0] || t('company.role.owner');
    }

    // 1) Save the leaving stage's snapshot so future visits restore it.
    const prevSnapshot = {
      interview_at: app.interview_at || null,
      interview_location: app.interview_location || null,
      interview_interviewer: app.interview_interviewer || null,
    };
    if (sessionUserId) {
      await supabase.from('application_evaluations').insert({
        application_id: appId,
        job_id: app.job_id,
        stage: `${prevStage}_snap`,
        reviewer_user_id: sessionUserId,
        reviewer_name: reviewerName,
        reviewer_role: isOwner ? 'owner' : 'interviewer',
        comment: JSON.stringify(prevSnapshot),
        score: null,
      });
    }

    // 2) Load the most recent snapshot for the target stage (if any).
    const { data: snapRows } = await supabase
      .from('application_evaluations')
      .select('comment, created_at')
      .eq('application_id', appId)
      .eq('stage', `${newStatus}_snap`)
      .order('created_at', { ascending: false })
      .limit(1);
    let restored = null;
    if (snapRows && snapRows[0]) {
      try { restored = JSON.parse(snapRows[0].comment); } catch {}
    }

    // 3) Build the patch — restored snapshot or a clean slate.
    const patch = {
      status: newStatus,
      interview_at: restored?.interview_at || null,
      interview_location: restored?.interview_location || null,
      interview_interviewer: restored?.interview_interviewer || null,
    };

    setApps(prev => prev.map(a => a.id === appId ? { ...a, ...patch } : a));
    const { error } = await supabase
      .from('job_applications')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', appId);
    if (error) {
      // Rollback on failure.
      setApps(prev => prev.map(a => a.id === appId ? {
        ...a,
        status: prevStage,
        interview_at: app.interview_at,
        interview_location: app.interview_location,
        interview_interviewer: app.interview_interviewer,
      } : a));
      setErr(t('company.err.stageChange') + error.message);
      toast.error(t('company.err.stageChange') + error.message);
      return;
    }

    // 4) Audit row (stage_move) so the timeline records the transition.
    if (sessionUserId) {
      await supabase.from('application_evaluations').insert({
        application_id: appId,
        job_id: app.job_id,
        stage: 'stage_move',
        reviewer_user_id: sessionUserId,
        reviewer_name: reviewerName,
        reviewer_role: isOwner ? 'owner' : 'interviewer',
        comment: newStatus,
        score: null,
      });
    }
    const name = app.applicant_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
    toast.success(t(`company.stage.${newStatus}`) + ' → ' + name);
  };

  // 공고 관리자(admin) 인가? myRole=null 은 로딩 중이거나 초기값이라 fallback 으로
  // created_by 매칭도 봐준다 (짧은 순간의 UI 깜빡임 방지).
  const isOwner = myRole ? myRole === 'admin' : (!job?.created_by || job?.created_by === user?.id);

  // Drag-and-drop drop handler.
  //
  // Movement policy:
  // - Forward drag (e.g. pending → viewed): if the source stage isn't yet
  //   pass-marked, ask whether to record the pass + draft the result email.
  //   Drag still moves the card either way; the popup only adds the audit
  //   row + mail composer when the user confirms.
  // - Backward drag (e.g. reviewing → viewed): if the destination stage has
  //   an existing pass-mark, ask first whether to clear that decision. On no,
  //   the drag is cancelled (no move). On yes, clear the pass and proceed.
  // - 최종 합격 drop keeps its existing implicit decided_pass auto-mark and
  //   final_offer mail prompt; the new forward popup is skipped to avoid two
  //   stacked mail prompts that resolve to the same template.
  //
  // Each stage still carries its own snapshot, so the destination restores
  // its most recent state. Rejected cards are non-draggable at the source.
  const handleDrop = async (newStatus) => {
    const appId = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!appId || !isOwner) return;
    const app = apps.find(a => a.id === appId);
    if (!app || app.status === newStatus || app.rejected_at) return;

    const prevStage = app.status;
    const prevIdx = STAGE_ORDER.indexOf(prevStage);
    const newIdx = STAGE_ORDER.indexOf(newStatus);
    const isForward = newIdx > prevIdx;
    const isBackward = newIdx < prevIdx;

    // Backward drag with SOURCE stage pass-marked → confirm reset BEFORE moving.
    // The source is the stage being left — its pass-mark is the "result" the
    // user recorded for that stage. Rolling back to a previous stage means
    // discarding that decision. Cards without a source pass-mark move freely
    // (nothing to clear).
    if (isBackward) {
      const sourcePassRowId = stagePassMap[appId]?.get(`${prevStage}_pass`);
      if (sourcePassRowId) {
        const sourceShort = t(`company.stageLabel.short.${prevStage}`) || t(`company.stage.${prevStage}`) || prevStage;
        const destFull = t(`company.stage.${newStatus}`) || newStatus;
        const name = app.applicant_name || (app.user_id ? profileMap[app.user_id]?.full_name : null)
          || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
        const ok = await askConfirm({
          title: t('company.dragBack.title', { stage: sourceShort }),
          message: t('company.dragBack.desc', { name, sourceStage: sourceShort, destStage: destFull }),
          confirmLabel: t('company.dragBack.confirm'),
          cancelLabel: t('company.dragBack.cancel'),
        });
        if (!ok) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/company/unmark-stage-pass', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
            body: JSON.stringify({ rowId: sourcePassRowId }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            toast.error(apiErrorMessage(json, t, 'company.toast.passCancelFailed'));
            return;
          }
        } catch {
          toast.error(t('company.toast.passCancelFailed'));
          return;
        }
      }
    }

    await setStage(appId, newStatus);

    // Special case: dropping into "최종 합격" is itself the final-hire decision —
    // auto-mark decided_pass so the celebration shows without a separate click.
    let triggerDecidedMailPrompt = false;
    if (newStatus === 'decided') {
      const alreadyPassed = stagePassMap[appId]?.has('decided_pass');
      if (!alreadyPassed) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/company/mark-stage-pass', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
            body: JSON.stringify({ appId, stage: 'decided' }),
          });
          if (res.ok) triggerDecidedMailPrompt = true;
        } catch {}
      }
    }
    await loadStagePasses(apps.map(a => a.id));

    if (triggerDecidedMailPrompt) {
      promptDecisionMailFromKanban({ app, decision: 'pass', stage: 'decided' });
      return;
    }

    // Forward drag to a non-decided stage: if source isn't pass-marked yet,
    // offer to record the pass + draft the result mail.
    if (isForward && newStatus !== 'decided') {
      const sourceAlreadyPassed = stagePassMap[appId]?.has(`${prevStage}_pass`);
      if (!sourceAlreadyPassed) {
        await promptForwardDragPass({ app, sourceStage: prevStage });
      }
    }
  };

  // Forward-drag follow-up: after a card has been moved forward, ask whether
  // to also pass-mark the source stage. On yes, record the mark + run the
  // mail prompt for that stage's template (doc_pass / interview1_pass / final_offer).
  // No auto-advance — the card is already at the destination.
  const promptForwardDragPass = async ({ app, sourceStage }) => {
    const sourceLabel = t(`company.stageLabel.short.${sourceStage}`) || t(`company.stage.${sourceStage}`) || sourceStage;
    const name = app.applicant_name || (app.user_id ? profileMap[app.user_id]?.full_name : null)
      || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
    const ok = await askConfirm({
      title: t('company.dragPass.title', { stage: sourceLabel }),
      message: t('company.dragPass.desc', { name, stage: sourceLabel }),
      confirmLabel: t('company.dragPass.confirm'),
      cancelLabel: t('company.dragPass.cancel'),
    });
    if (!ok) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/mark-stage-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ appId: app.id, stage: sourceStage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(json, t, 'company.ats.errStagePass')); return; }
      toast.success(t('company.ats.stagePassedShort', { stage: t(`company.stage.${sourceStage}`) }));
      await loadStagePasses(apps.map(a => a.id));
    } catch {
      toast.error(t('company.ats.errStagePass'));
      return;
    }
    await promptResultMail({ app, decision: 'pass', stage: sourceStage });
  };

  // Stable handlers for memoized KanbanCard — refs only change on real dependency moves.
  // Desktop opens an overlay modal; mobile navigates to a dedicated page so
  // the candidate detail has the full viewport and a real back button.
  const handleSelectApp = useCallback((appId) => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      router.push(`/company/candidates/${appId}`);
    } else {
      setSelectedAppId(appId);
    }
  }, [router]);
  const handleCardDragStart = useCallback((appId) => setDraggingId(appId), []);
  const handleCardDragEnd = useCallback(() => { setDraggingId(null); setDragOverCol(null); }, []);
  const handleOpenInterview = useCallback((app) => setInterviewApp(app), []);
  const handleComposeMail = useCallback((payload) => setMailFor(payload), []);
  const handleRejectApp = useCallback((app) => setRejectingApp(app), []);

  // Quick stage-pass mark from the kanban kebab menu.
  const markStagePassFromKanban = async (appId, stage) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/company/mark-stage-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ appId, stage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(json, t, 'company.ats.errStagePass')); return; }
      toast.success(t('company.ats.stagePassedShort', { stage: t(`company.stage.${stage}`) }));
      await loadStagePasses(apps.map(a => a.id));
      const app = apps.find(a => a.id === appId);
      if (app) promptDecisionMailFromKanban({ app, decision: 'pass', stage });
    } catch (e) {
      toast.error(t('company.ats.errStagePass'));
    }
  };

  // Name-only search — match against the applicant name and the linked
  // user profile name. Email/role/company are intentionally excluded so the
  // filter stays simple and predictable.
  const matchesQuery = (a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const profile = a.user_id ? profileMap[a.user_id] : null;
    return [a.applicant_name, profile?.full_name]
      .filter(Boolean).join(' ').toLowerCase().includes(q);
  };
  // Default view shows every applicant including rejected ones — KPI filters
  // (matchesKpiFilter) narrow it down when selected.
  const visibleApps = apps;
  const activeCount = apps.filter(a => !a.rejected_at).length;
  const rejectedCount = apps.length - activeCount;

  // CPO 추가: 채용 담당자가 화면에서 가장 알아야 하는 5개 지표
  const nowMs = Date.now();
  // "검토 전" = 아직 결정 안 난 서류 단계 지원자 (status='pending').
  // viewed_at 은 담당자가 상세를 한 번이라도 열었는지의 read flag 일 뿐, 검토
  // 완료 여부와 무관하다. 한 번 열었다고 검토가 끝난 게 아니므로 카운트에서 빼지 않는다.
  const newReviewCount = apps.filter(a => !a.rejected_at && a.status === 'pending').length;
  const upcomingInterviewCount = apps.filter(a => !a.rejected_at && a.interview_at && new Date(a.interview_at).getTime() > nowMs).length;
  const hiredCount = apps.filter(a => !a.rejected_at && a.status === 'decided').length;
  const inProgressCount = apps.filter(a => !a.rejected_at && a.status !== 'decided' && a.status !== 'pending').length;

  const matchesKpiFilter = (a) => {
    if (!kpiFilter) return true;
    if (kpiFilter === 'new') return !a.rejected_at && a.status === 'pending';
    if (kpiFilter === 'inProgress') return !a.rejected_at && a.status !== 'decided' && a.status !== 'pending';
    if (kpiFilter === 'hired') return !a.rejected_at && a.status === 'decided';
    if (kpiFilter === 'rejected') return !!a.rejected_at;
    return true;
  };

  const grouped = STAGES.map(s => ({ ...s, apps: visibleApps.filter(a => a.status === s.key && matchesQuery(a) && matchesKpiFilter(a)) }));
  const toggleKpi = (key) => setKpiFilter(prev => prev === key ? null : key);

  if (status === 'loading') {
    return (
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" />
        <KanbanSkeleton />
      </div>
    );
  }
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

        <main className="px-4 md:px-6 pb-3 flex flex-col gap-3 min-w-0 flex-1 h-screen overflow-hidden">
          {/* Mobile top bar — same structure as the candidate detail's brand row
              so the two pages share a unified header look on small screens. */}
          <div className="md:hidden -mx-4 sticky top-0 z-30 bg-white border-b border-gray-100 flex items-center gap-1 px-2 h-12">
            <Link
              href="/company"
              aria-label={t('company.back')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Truncate as="span" className="text-[15px] font-extrabold text-gray-900 tracking-tight min-w-0">
              {job.title}
            </Truncate>
          </div>

          {/* Desktop PageHeader (mobile uses the custom bar above). */}
          <PageHeader
            className="hidden md:flex"
            title={(
              <span className="flex items-center gap-2 md:gap-2.5 text-xl">
                <Briefcase className="w-5 h-5 text-primary-600" />
                {job.title}
              </span>
            )}
            subtitle={(
              <span className="hidden md:inline">
                {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M
              </span>
            )}
            right={(
              <>
                <span className={cn(
                  'hidden md:inline-flex items-center gap-1 h-9 px-2.5 rounded-md border text-[12px] font-extrabold whitespace-nowrap',
                  isOwner
                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                    : 'bg-gray-100 border-gray-200 text-gray-700'
                )}>
                  {isOwner ? t('company.ats.roleOwnerJoined') : t('company.ats.roleInterviewerJoined')}
                </span>
                <span className="hidden md:inline-flex">
                  <TeamPopover jobId={job.id} canInvite={isOwner} />
                </span>
                {/* Edit is owner-only; interviewers don't see the button at all
                    to keep their view focused on evaluation actions. */}
                {isOwner && (
                  <Button asChild variant="outline" className="hidden md:inline-flex">
                    <Link href={`/company/jobs/${job.id}/edit`}>
                      <Edit3 className="h-3.5 w-3.5" />
                      {t('company.ats.editJob')}
                    </Link>
                  </Button>
                )}
              </>
            )}
          />

          {/* KPI cards — desktop only; mobile keeps the kanban-as-list focused on the task,
              not on stats (Greeting-style minimalism). */}
          <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 신규 검토 — 가장 중요. "오늘의 할 일" 강조 */}
            <button
              type="button"
              onClick={() => toggleKpi('new')}
              className={cn(
                'rounded-lg border bg-card px-3 py-2.5 transition-all duration-200 text-left cursor-pointer',
                kpiFilter === 'new'
                  ? 'border-primary-500 ring-2 ring-primary-200'
                  : newReviewCount > 0
                    ? 'border-primary-200 shadow-soft-xs hover:border-primary-400'
                    : 'border-border shadow-soft-xs hover:border-gray-300'
              )}>
              <div className="flex items-center gap-1.5">
                <div className={cn('w-6 h-6 rounded-md grid place-items-center',
                  newReviewCount > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
                )}>
                  <Inbox className="h-3.5 w-3.5" />
                </div>
                <span className={cn('text-[12.5px] font-extrabold uppercase tracking-[0.08em]',
                  newReviewCount > 0 ? 'text-primary-700' : 'text-gray-500'
                )}>{t('company.kpi.new')}</span>
              </div>
              <div className={cn('text-[26px] font-black mt-1.5 leading-none tabular-nums',
                newReviewCount > 0 ? 'text-primary-700' : 'text-gray-900'
              )}>{newReviewCount}</div>
            </button>

            {/* 진행중 */}
            <button
              type="button"
              onClick={() => toggleKpi('inProgress')}
              className={cn(
                'rounded-lg border bg-card px-3 py-2.5 transition-all duration-200 text-left cursor-pointer',
                kpiFilter === 'inProgress'
                  ? 'border-gray-500 shadow-soft-md ring-2 ring-gray-200'
                  : 'border-border shadow-soft-xs hover:border-gray-300'
              )}>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md grid place-items-center bg-gray-100 text-gray-700">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12.5px] font-extrabold text-gray-700 uppercase tracking-[0.08em]">{t('company.kpi.inProgress')}</span>
              </div>
              <div className="text-[26px] font-black mt-1.5 leading-none tabular-nums text-gray-900">{inProgressCount}</div>
            </button>

            {/* 합격 — green accent (matches the platform-wide pass = green rule). */}
            <button
              type="button"
              onClick={() => toggleKpi('hired')}
              className={cn(
                'rounded-lg border bg-card px-3 py-2.5 transition-all duration-200 text-left cursor-pointer',
                kpiFilter === 'hired'
                  ? 'border-green-500 shadow-soft-md ring-2 ring-green-200'
                  : 'border-border shadow-soft-xs hover:border-green-300'
              )}>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md grid place-items-center bg-green-50 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12.5px] font-extrabold text-green-700 uppercase tracking-[0.08em]">{t('company.kpi.hired')}</span>
              </div>
              <div className="text-[26px] font-black mt-1.5 leading-none tabular-nums text-green-700">{hiredCount}</div>
            </button>

            {/* 불합격 — red accent (matches the platform-wide fail = red rule). */}
            <button
              type="button"
              onClick={() => toggleKpi('rejected')}
              className={cn(
                'rounded-lg border bg-card px-3 py-2.5 transition-all duration-200 text-left cursor-pointer',
                kpiFilter === 'rejected'
                  ? 'border-red-400 shadow-soft-md ring-2 ring-red-100'
                  : 'border-border shadow-soft-xs hover:border-red-200'
              )}>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md grid place-items-center bg-red-50 text-red-600">
                  <XCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-[12.5px] font-extrabold text-red-600 uppercase tracking-[0.08em]">{t('company.kpi.rejected')}</span>
              </div>
              <div className="text-[26px] font-black mt-1.5 leading-none tabular-nums text-red-600">{rejectedCount}</div>
            </button>
          </div>

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-semibold">{err}</div>
          )}

          {/* Filter pill removed — the active KPI card / meta tab already shows the state.
              A separate pill just adds vertical noise without informing more. */}

          {/* Toolbar — desktop-only entirely on mobile: search hidden, drag hint hidden, so
              rendering this wrapper just contributes a flex-gap line with no content. */}
          <div className="hidden md:flex items-center gap-3 flex-wrap">
            <div className="hidden md:block relative flex-1 min-w-[260px] max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('company.ats.searchPh')}
                className="pl-9 h-9 text-[13px] font-medium"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="clear"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {isOwner && (
              <span className="hidden md:flex ml-auto text-[12px] text-gray-500 font-semibold items-center gap-1.5 whitespace-nowrap">
                <MoveHorizontal className="h-3.5 w-3.5 text-gray-400" />
                {t('company.ats.dragHintHowto')}
              </span>
            )}
            {!isOwner && (
              <span className="hidden md:flex ml-auto text-[11px] text-gray-400 font-semibold items-center gap-1.5">
                <Lock className="h-3 w-3" />
                {t('company.ats.dragHintLocked')}
              </span>
            )}
          </div>

          {/* Mobile stage tabs — 4 chips, evenly distributed across the viewport width. */}
          <div className="md:hidden flex items-center gap-1">
            {grouped.map((col) => {
              const isActive = mobileStage === col.key;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => setMobileStage(col.key)}
                  className={cn(
                    'flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-1 py-2 rounded-full text-[12px] font-bold transition-all',
                    isActive ? 'bg-primary-500 text-white shadow-brand' : 'bg-white border border-border text-gray-700'
                  )}
                >
                  <span className="truncate">{t(`company.stage.${col.key}`)}</span>
                  <span className={cn('text-[11px] tabular-nums flex-shrink-0', isActive ? 'opacity-80' : 'text-gray-400')}>
                    {col.apps.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kanban — fills remaining viewport, columns scroll internally */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch flex-1 min-h-0">
            {grouped.map((col) => {
              const StageIcon = STAGE_ICONS[col.key];
              const hiddenOnMobile = mobileStage !== col.key;
              const isOver = dragOverCol === col.key;
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col.key) setDragOverCol(col.key); }}
                  onDrop={() => handleDrop(col.key)}
                  className={cn(
                    'rounded-lg border p-2.5 flex flex-col gap-2 transition-all duration-200 min-h-0',
                    isOver ? 'bg-primary-50 border-primary-300 shadow-soft-md' : 'bg-[#F9FAFB] border-[#F2F4F6]',
                    hiddenOnMobile && 'hidden md:flex'
                  )}
                >
                  {/* Column header — hidden on mobile since the stage chip above
                      already shows the same info; redundancy hurts mobile space. */}
                  <div className="hidden md:flex items-center gap-2 px-1 pb-2 border-b border-[#E5E8EB]">
                    <StageIcon className={cn('w-3.5 h-3.5', STAGE_ICON_CLASS[col.key])} />
                    <span className="text-[13px] font-extrabold text-gray-900 tracking-tight flex-1">{t(`company.stage.${col.key}`)}</span>
                    <span className="text-[11px] font-extrabold text-gray-900 tabular-nums bg-white border border-[#E5E8EB] rounded-full min-w-[22px] text-center px-1.5 py-0.5">{col.apps.length}</span>
                  </div>

                  {/* Cards — scrolls internally so column header stays pinned */}
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto overflow-x-visible px-0.5 -mx-0.5 pr-1.5 -mr-1.5 pt-0.5">
                    {col.apps.length === 0 && (
                      <div className="flex items-center justify-center py-10 text-[11px] font-semibold rounded-md border border-dashed text-gray-400 border-gray-200">
                        {t('company.ats.emptyColumn')}
                      </div>
                    )}
                    {col.apps.map(app => (
                      <KanbanCard
                        key={app.id}
                        app={app}
                        profile={app.user_id ? profileMap[app.user_id] : null}
                        isOwner={isOwner}
                        stagePassSet={stagePassMap[app.id]}
                        isSelected={selectedAppId === app.id}
                        isDragging={draggingId === app.id}
                        t={t}
                        onSelect={handleSelectApp}
                        onDragStart={handleCardDragStart}
                        onDragEnd={handleCardDragEnd}
                        onOpenInterview={handleOpenInterview}
                        onComposeMail={handleComposeMail}
                        onMarkStagePass={markStagePassFromKanban}
                        onReject={handleRejectApp}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {selectedAppId && (() => {
          // Flat visible list across columns (driven by current filter/search)
          const flatVisible = grouped.flatMap(c => c.apps);
          const navIds = flatVisible.map(a => a.id);
          const idx = navIds.indexOf(selectedAppId);
          const total = navIds.length;
          const prevId = idx > 0 ? navIds[idx - 1] : null;
          const nextId = idx < total - 1 ? navIds[idx + 1] : null;

          // Stage-level navigation: count per stage + index within current stage
          const selectedApp = flatVisible.find(a => a.id === selectedAppId);
          const stageCounts = grouped.reduce((acc, c) => { acc[c.key] = c.apps.length; return acc; }, {});
          const sameStageList = selectedApp ? grouped.find(c => c.key === selectedApp.status)?.apps || [] : [];
          const stageIdx = sameStageList.findIndex(a => a.id === selectedAppId);
          const stageTotal = sameStageList.length;

          // Shift+arrows: jump to the first app of the prev/next stage (with people in it)
          const orderedStageKeys = grouped.map(c => c.key);
          const currentStageOrderIdx = selectedApp ? orderedStageKeys.indexOf(selectedApp.status) : -1;
          const findNextStageFirstApp = (dir) => {
            if (currentStageOrderIdx < 0) return null;
            let i = currentStageOrderIdx + dir;
            while (i >= 0 && i < orderedStageKeys.length) {
              const col = grouped[i];
              if (col?.apps?.length) return col.apps[0].id;
              i += dir;
            }
            return null;
          };
          const prevStageFirstId = findNextStageFirstApp(-1);
          const nextStageFirstId = findNextStageFirstApp(+1);

          return (
            <div style={localCss.overlay} onClick={() => { setSelectedAppId(null); loadStagePasses(apps.map(a => a.id)); }}>
              <div style={localCss.panel} onClick={(e) => e.stopPropagation()}>
                <CandidateDetail
                  key={selectedAppId}
                  appId={selectedAppId}
                  mode="overlay"
                  companyId={job.company_id}
                  navIndex={idx}
                  navTotal={total}
                  stageIndex={stageIdx}
                  stageTotal={stageTotal}
                  stageCounts={stageCounts}
                  stageOrder={orderedStageKeys}
                  onPrev={prevId ? () => { loadStagePasses(apps.map(a => a.id)); setSelectedAppId(prevId); } : null}
                  onNext={nextId ? () => { loadStagePasses(apps.map(a => a.id)); setSelectedAppId(nextId); } : null}
                  onJumpToStage={(stageKey) => {
                    const first = grouped.find(c => c.key === stageKey)?.apps?.[0]?.id;
                    if (first) { loadStagePasses(apps.map(a => a.id)); setSelectedAppId(first); }
                  }}
                  onPrevStage={prevStageFirstId ? () => { loadStagePasses(apps.map(a => a.id)); setSelectedAppId(prevStageFirstId); } : null}
                  onNextStage={nextStageFirstId ? () => { loadStagePasses(apps.map(a => a.id)); setSelectedAppId(nextStageFirstId); } : null}
                  onClose={() => {
                    setSelectedAppId(null);
                    loadStagePasses(apps.map(a => a.id));
                    if (closeReturnPath) router.push(closeReturnPath);
                  }}
                  onStageChange={(id, patch) => { setApps(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a)); loadStagePasses(apps.map(a => a.id)); }}
                  onAdvanceStage={setStage}
                />
              </div>
            </div>
          );
        })()}

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
                const stageAtReject = rejectingApp.status;
                const appAtReject = rejectingApp;
                setApps(prev => prev.map(a => a.id === rejectingApp.id ? { ...a, ...payload } : a));
                setRejectingApp(null);
                toast.success(t('company.reject.h'));
                promptDecisionMailFromKanban({ app: appAtReject, decision: 'reject', stage: stageAtReject });
              }}
            />
          );
        })()}

        {confirmCfg && <ConfirmModal {...confirmCfg} />}

        {interviewApp && (
          <InterviewConfirmModal
            app={interviewApp}
            onClose={() => setInterviewApp(null)}
            onSaved={(payload) => {
              setApps(prev => prev.map(a => a.id === interviewApp.id ? { ...a, ...payload } : a));
              setInterviewApp(null);
              toast.success(payload.interview_at ? t('company.interview.confirmSave') : t('company.interview.confirmClear'));
            }}
          />
        )}

        {mailFor && (
          <MailComposer
            candidateName={mailFor.app.applicant_name || mailFor.profile?.full_name || `${t('company.candidatePrefix')}${mailFor.app.id.slice(-6).toUpperCase()}`}
            candidateEmail={mailFor.email}
            jobTitle={job.title}
            companyName={companyName}
            companyId={job?.company_id}
            applicationId={mailFor.app.id}
            stage={mailFor.stage || mailFor.app.status}
            templateKey={mailFor.templateKey}
            onClose={() => setMailFor(null)}
            onSent={() => { setMailFor(null); toast.success(t('company.mail.send')); }}
          />
        )}
      </div>
    </>
  );
}

const localCss = {
  crumb: { fontSize: 12, color: '#8B95A1', marginBottom: 4 },
  crumbLink: { color: '#4E5968', textDecoration: 'none' },

  // ── Kanban ──
  kanban: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: space[5], alignItems: 'stretch', minHeight: 'calc(100vh - 240px)' },
  col: { background: color.gray[50], border: `1px solid ${color.border}`, borderRadius: radius.xl, padding: space[5], display: 'flex', flexDirection: 'column', gap: space[3] },
  colOver: { background: color.primary[50], borderColor: color.primary[400], boxShadow: shadow.md },
  colHead: { display: 'flex', alignItems: 'center', gap: space[2], padding: `${space[1]}px ${space[2]}px ${space[3]}px`, borderBottom: `1px solid ${color.border}` },
  colEmoji: { fontSize: font.size.lg },
  colLabel: { fontSize: font.size.lg, fontWeight: font.weight.extra, color: color.textHi, letterSpacing: font.letterSpacing.tight },
  colCount: { marginLeft: 'auto', background: color.surface, color: color.text, fontSize: font.size.sm, fontWeight: font.weight.extra, padding: `3px ${space[3]}px`, borderRadius: radius.full, border: `1px solid ${color.border}`, minWidth: 28, textAlign: 'center' },
  colBody: { display: 'flex', flexDirection: 'column', gap: space[2] },
  colEmpty: { fontSize: font.size.sm, color: color.textMute, textAlign: 'center', padding: `${space[6]}px 0`, fontWeight: font.weight.medium },

  // ── Card (흰색 카드가 회색 컬럼 위에 떠 있는 느낌) ──
  card: { background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space[4], display: 'flex', flexDirection: 'column', gap: space[2], cursor: 'grab', transition: motion.base, textDecoration: 'none', boxShadow: shadow.sm },
  cardActive: { background: color.primary[50], border: `1.5px solid ${color.primary[400]}`, boxShadow: shadow.brand, transform: 'translateY(-2px)' },
  cardDragging: { opacity: 0.4, boxShadow: 'none' },
  cardRejected: { background: color.gray[50], border: `1px dashed ${color.gray[300]}`, opacity: 0.7, cursor: 'pointer', boxShadow: 'none' },

  cardName: { fontSize: font.size.lg, fontWeight: font.weight.extra, color: color.textHi, letterSpacing: font.letterSpacing.tight, lineHeight: font.lineHeight.tight },
  cardMeta: { fontSize: font.size.sm, color: color.textSub, fontWeight: font.weight.medium },
  cardSalary: { fontSize: font.size.sm, color: color.success.fg, fontWeight: font.weight.semi },
  nameRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  rejectedInline: { fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.danger.fg, flexShrink: 0 },

  // ── Card pill: 지원 경과일 ──
  applyDateLow:  { alignSelf: 'flex-start', padding: `3px ${space[2]}px`, borderRadius: radius.full, background: color.gray[100], border: `1px solid ${color.border}`, color: color.gray[700], fontSize: font.size.xs, fontWeight: font.weight.bold, marginBottom: space[1] },
  applyDateMid:  { alignSelf: 'flex-start', padding: `3px ${space[2]}px`, borderRadius: radius.full, background: color.warning.bg, border: `1px solid ${color.warning.border}`, color: color.warning.fg, fontSize: font.size.xs, fontWeight: font.weight.extra, marginBottom: space[1] },
  applyDateHigh: { alignSelf: 'flex-start', padding: `3px ${space[2]}px`, borderRadius: radius.full, background: color.danger.bg, border: `1px solid ${color.danger.border}`, color: color.danger.fg, fontSize: font.size.xs, fontWeight: font.weight.extra, marginBottom: space[1] },

  // ── Card: 인터뷰 뱃지 ──
  interviewSet:     { marginTop: space[1], padding: `${space[2]}px ${space[3]}px`, background: color.success.bg, border: `1px solid ${color.success.border}`, borderRadius: radius.md, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.success.fg },
  interviewPending: { marginTop: space[1], padding: `${space[2]}px ${space[3]}px`, background: color.warning.bg, border: `1px solid ${color.warning.border}`, borderRadius: radius.md, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.warning.fg },

  // ── Toolbar ──
  toolbar: { display: 'flex', alignItems: 'center', gap: space[2] },
  search: { flex: '0 1 320px', padding: `${space[3]}px ${space[4]}px`, border: `1px solid ${color.border}`, borderRadius: radius.md, fontSize: font.size.base, color: color.text, fontFamily: 'inherit', outline: 'none', background: color.surface, transition: motion.base },
  searchClear: { padding: `${space[2]}px ${space[3]}px`, border: `1px solid ${color.border}`, borderRadius: radius.md, background: color.surface, color: color.textSub, fontSize: font.size.sm, fontWeight: font.weight.semi, cursor: 'pointer', fontFamily: 'inherit', transition: motion.base },
  dragHint: { marginLeft: 'auto', fontSize: font.size.sm, color: color.textMute, fontWeight: font.weight.medium },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: space[2], fontSize: font.size.sm, color: color.text, fontWeight: font.weight.semi, cursor: 'pointer', padding: `${space[2]}px ${space[3]}px`, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, transition: motion.base },

  // ── Header buttons ──
  btnNewJob: { padding: `${space[3]}px ${space[6]}px`, borderRadius: radius.md, background: color.primary[600], color: color.white, fontSize: font.size.base, fontWeight: font.weight.extra, textDecoration: 'none', boxShadow: shadow.brand, display: 'inline-flex', alignItems: 'center', transition: motion.base, letterSpacing: font.letterSpacing.tight },

  // ── Candidate detail overlay ──
  overlay: { position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.45)', backdropFilter: 'blur(2px)', zIndex: 50 },
  panel: { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, background: color.bg, borderRadius: radius['2xl'], overflow: 'hidden', boxShadow: shadow.xl, display: 'flex', flexDirection: 'column' },

  // ── Kebab menu ──
  kebabWrap: { position: 'absolute', top: 8, right: 8 },
  kebabBtn: { width: 28, height: 28, borderRadius: radius.md, border: 'none', background: 'transparent', color: color.textMute, fontSize: 18, fontWeight: font.weight.extra, cursor: 'pointer', lineHeight: 1, display: 'grid', placeItems: 'center', fontFamily: 'inherit', transition: motion.base },
  kebabMenu: { position: 'absolute', top: 34, right: 0, minWidth: 220, background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.lg, boxShadow: shadow.lg, padding: space[2], zIndex: 30, display: 'flex', flexDirection: 'column', gap: 2 },
  kebabItem:        { display: 'flex', alignItems: 'center', gap: space[3], padding: `${space[3]}px ${space[3]}px`, width: '100%', border: 'none', background: 'transparent', color: color.danger.fg, cursor: 'pointer', textAlign: 'left', borderRadius: radius.md, fontFamily: 'inherit', transition: motion.base },
  kebabItemNeutral: { display: 'flex', alignItems: 'center', gap: space[3], padding: `${space[3]}px ${space[3]}px`, width: '100%', border: 'none', background: 'transparent', color: color.text, cursor: 'pointer', textAlign: 'left', borderRadius: radius.md, fontFamily: 'inherit', transition: motion.base },
  kebabItemLocked:  { display: 'flex', alignItems: 'center', gap: space[3], padding: `${space[3]}px ${space[3]}px`, width: '100%', border: 'none', background: color.gray[50], color: color.textMute, cursor: 'not-allowed', textAlign: 'left', borderRadius: radius.md, fontFamily: 'inherit' },
  kebabIcon: { width: 18, fontSize: font.size.md, lineHeight: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, fontFamily: 'inherit' },
  kebabText: { fontSize: font.size.base, fontWeight: font.weight.semi, lineHeight: 1.4, flex: 1, fontFamily: 'inherit' },
};

// ─────────────────────────────────────────────────────────────────────────────
// KanbanCard — extracted + memoized so per-card hover/drag/select state on one
// card doesn't re-render every sibling card. Parent passes stable callbacks
// (useCallback'd) and `isSelected` / `isDragging` booleans so the diff is cheap.
// ─────────────────────────────────────────────────────────────────────────────
const KanbanCard = memo(function KanbanCard({
  app, profile, isOwner, stagePassSet, isSelected, isDragging, t,
  onSelect, onDragStart, onDragEnd, onOpenInterview, onComposeMail, onMarkStagePass, onReject,
}) {
  const name = app.applicant_name || profile?.full_name || `${t('company.candidatePrefix')}${app.id.slice(-6).toUpperCase()}`;
  const showInterviewBadge = app.status === 'viewed' || app.status === 'reviewing';
  const interviewWhen = app.interview_at ? formatInterviewShort(app.interview_at) : null;
  const interviewPast = app.interview_at && new Date(app.interview_at).getTime() < Date.now();
  const isRejected = !!app.rejected_at;
  const appliedAt = new Date(app.created_at);
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const appliedMidnight = new Date(appliedAt); appliedMidnight.setHours(0, 0, 0, 0);
  const daysAgo = Math.max(0, Math.round((todayMidnight.getTime() - appliedMidnight.getTime()) / 86400000));
  const dateText = formatLocalShortDate(appliedAt);
  const dateLabel = daysAgo === 0
    ? t('company.ats.appliedToday', { date: dateText })
    : t('company.ats.appliedDaysAgo', { date: dateText, n: daysAgo });
  const urgencyClass = 'bg-amber-50 text-amber-700 border-amber-200';
  const email = app.applicant_email || profile?.email || '';
  const defaultTpl = defaultComposeTemplate(app.status, app.rejected_at);
  const hasStagePassed = stagePassSet?.has(`${app.status}_pass`);
  const canDragCard = isOwner && !isRejected;

  return (
    <div
      draggable={canDragCard}
      onDragStart={() => canDragCard && onDragStart(app.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(app.id)}
      className={cn(
        'relative rounded-md border p-2.5 flex flex-col gap-1 cursor-pointer transition-all duration-200 ease-spring',
        !hasStagePassed && !isRejected && 'bg-white border-[#E5E8EB] hover:border-primary-300 hover:bg-primary-50/30 hover:shadow-soft-sm hover:-translate-y-px',
        !isRejected && hasStagePassed && 'bg-green-50/60 border-green-300 hover:border-green-400 hover:shadow-soft-sm hover:-translate-y-px',
        isRejected && 'bg-red-50/40 border-red-200 opacity-65',
        isSelected && !hasStagePassed && !isRejected && 'bg-primary-50/70 border-primary-500 ring-2 ring-primary-200 -translate-y-0.5 shadow-soft-md',
        isSelected && hasStagePassed && !isRejected && 'border-green-500 ring-2 ring-green-200 -translate-y-0.5 shadow-soft-md',
        isSelected && isRejected && 'border-red-500 ring-2 ring-red-200 -translate-y-0.5 shadow-soft-md',
        isDragging && 'opacity-40',
        canDragCard && !isSelected && 'active:cursor-grabbing'
      )}
    >
      <div className="absolute top-2 right-2 hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded-md text-gray-900 hover:bg-gray-100 grid place-items-center transition-colors" aria-label="more">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {isOwner && showInterviewBadge && !isRejected && (
              <DropdownMenuItem onClick={() => onOpenInterview(app)}>
                <Calendar className="h-4 w-4 text-gray-500" />
                {interviewWhen ? t('company.kebab.interviewEdit') : t('company.kebab.interviewSet')}
              </DropdownMenuItem>
            )}
            {isOwner && email && (
              <DropdownMenuItem onClick={() => onComposeMail({ app, profile, email, templateKey: defaultTpl, stageLabel: t(`company.stage.${app.status}`) })}>
                <Mail className="h-4 w-4 text-gray-500" />
                {t('company.kebab.composeMail')}
              </DropdownMenuItem>
            )}
            {isOwner && !hasStagePassed && !isRejected && app.status !== 'decided' && (
              <DropdownMenuItem onClick={() => onMarkStagePass(app.id, app.status)}>
                <Check className="h-4 w-4 text-green-600" />
                {t('company.ats.stagePass', { stage: t(`company.stage.${app.status}`) })}
              </DropdownMenuItem>
            )}
            {isOwner && !isRejected && (
              <DropdownMenuItem tone="danger" onClick={() => onReject(app)}>
                <Ban className="h-4 w-4" />
                {t('company.ats.stageReject', { stage: t(`company.stage.${app.status}`) })}
              </DropdownMenuItem>
            )}
            {isOwner && isRejected && (
              <DropdownMenuItem onClick={() => onSelect(app.id)}>
                <Edit3 className="h-4 w-4 text-gray-500" />
                {t('company.ats.viewDetails')}
              </DropdownMenuItem>
            )}
            {!isOwner && (
              <DropdownMenuItem disabled>
                <Lock className="h-4 w-4 text-gray-400" />
                {t('company.kebab.rejectLocked')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn('self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border', urgencyClass)}>
        <Clock className="h-2.5 w-2.5" />
        {dateLabel}
      </div>

      <div className="flex items-center justify-between gap-2 md:pr-6">
        <Truncate className="text-[15px] font-extrabold text-gray-900 tracking-tight leading-tight">{name}</Truncate>
        {isRejected && (
          <span className="text-[10.5px] font-extrabold text-red-600 shrink-0 inline-flex items-center gap-0.5 uppercase tracking-wider">
            <Ban className="h-2.5 w-2.5" />
            {t('company.ats.rejectedBadge')}
          </span>
        )}
        {!isRejected && hasStagePassed && app.status !== 'decided' && (
          <span className="text-[10.5px] font-extrabold text-green-700 bg-green-100 border border-green-200 shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded">
            {t('company.ats.passBadge')}
          </span>
        )}
      </div>

      {app.applicant_role && (
        <div className="text-[13px] text-gray-900 font-semibold truncate">
          {app.applicant_role} · {app.applicant_experience || 0}{t('company.years')}
        </div>
      )}
      {app.applicant_salary && (
        <div className="text-[13px] text-gray-700 font-bold tabular-nums">
          {t('company.ats.wishSalary', { n: Math.round(app.applicant_salary/1e6) })}
        </div>
      )}

      {!isRejected && showInterviewBadge && (
        <button
          onClick={(e) => {
            // Mobile: let the parent card click handle (or do nothing) — no edit modal.
            if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) return;
            if (isOwner) { e.stopPropagation(); onOpenInterview(app); }
          }}
          disabled={!isOwner}
          className={cn(
            'mt-1 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] font-bold border w-full',
            interviewWhen && interviewPast && 'bg-green-50 border-green-200 text-green-800',
            interviewWhen && !interviewPast && 'bg-sky-50 border-sky-200 text-sky-800',
            !interviewWhen && 'bg-white border-dashed border-gray-300 text-gray-500',
            // Cursor / hover only on desktop — mobile lets the card-level tap handle.
            isOwner && 'md:cursor-pointer md:hover:opacity-80 transition-opacity'
          )}
        >
          {interviewWhen && interviewPast
            ? <Check className="h-3.5 w-3.5" />
            : <Calendar className="h-3.5 w-3.5" />}
          {interviewWhen
            ? `${interviewPast ? t('company.ats.interviewDone') : t('company.ats.interviewWord')} ${interviewWhen}`
            : t('company.ats.interviewPending')}
        </button>
      )}

      {app.status === 'decided' && !isRejected && (
        <div className="mt-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-primary-50 border border-primary-200 text-primary-700 text-[12px] font-extrabold w-full">
          <PartyPopper className="w-3.5 h-3.5" />
          {t('company.candidate.finalPass')}
        </div>
      )}
    </div>
  );
});
