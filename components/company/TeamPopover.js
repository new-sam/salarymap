import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';
import { apiErrorMessage } from '../../lib/apiErrorMessage';
import { ConfirmModal } from './CandidateDetail';
import { cn } from '../../lib/cn';
import { Button as UButton } from '../ui/button';
import { Input as UInput } from '../ui/input';
import { Dialog as UDialog, DialogContent as UDialogContent, DialogHeader as UDialogHeader, DialogTitle as UDialogTitle, DialogDescription as UDialogDescription } from '../ui/dialog';
import { X as XIcon, Check, Mail as MailIcon, Users as UsersIcon } from 'lucide-react';

const AVATAR_COLORS = ['#fb923c', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#22d3ee', '#f87171'];
function colorFor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initialOf = (s = '') => (s.trim()[0] || '?').toUpperCase();
function relTime(iso, t) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return t('company.time.justNow');
  if (diff < 3600) return t('company.time.minsAgo', { n: Math.floor(diff/60) });
  if (diff < 86400) return t('company.time.hoursAgo', { n: Math.floor(diff/3600) });
  return t('company.time.daysAgo', { n: Math.floor(diff/86400) });
}

export default function TeamPopover({ jobId, canInvite = true }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState({ members: [], invites: [], currentUserId: null, ownerUserId: null, currentUserIsAdmin: false });
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState(null);
  const ref = useRef(null);

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

  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch(`/api/company/team?jobId=${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setTeam({
        members: j.members || [],
        invites: j.invites || [],
        currentUserId: j.currentUserId,
        ownerUserId: j.ownerUserId,
        currentUserIsAdmin: !!j.currentUserIsAdmin,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [jobId]);

  const remove = async (payload) => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const res = await fetch('/api/company/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobId, ...payload }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      await showAlert({
        title: t('company.team.removeBtn'),
        message: t('company.team.removeErr') + apiErrorMessage(j, t),
        tone: 'danger',
      });
      return;
    }
    await load();
  };

  const removeMember = async (m) => {
    const name = m.full_name || m.email?.split('@')[0] || '?';
    const ok = await askConfirm({
      title: t('company.team.removeBtn'),
      message: t('company.team.removeConfirm', { name }),
      confirmLabel: t('company.team.removeBtn'),
      tone: 'danger',
    });
    if (!ok) return;
    remove({ userId: m.user_id });
  };
  const cancelInvite = async (iv) => {
    const ok = await askConfirm({
      title: t('company.team.removeBtn'),
      message: t('company.team.cancelInviteConfirm', { email: iv.email }),
      confirmLabel: t('company.team.removeBtn'),
      tone: 'danger',
    });
    if (!ok) return;
    remove({ inviteId: iv.id });
  };

  // Close on outside click — confirm 모달이 열려있으면 무시
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (confirmCfg) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, confirmCfg]);

  const count = team.members.length + team.invites.length;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-card text-[13px] font-bold text-foreground shadow-soft-xs hover:bg-secondary transition-all duration-200 ease-spring active:scale-[0.98]"
      >
        <UsersIcon className="w-3.5 h-3.5" />
        {t('company.team.btn')}
        <span className="text-gray-900 font-extrabold tabular-nums">{count}</span>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-[60] w-[308px] max-h-[440px] overflow-y-auto bg-white rounded-xl border border-border shadow-soft-lg p-3">
          <div className="text-xs font-extrabold text-gray-900 uppercase tracking-[0.02em] mb-2">{t('company.team.title')}</div>

          <div className="flex flex-col gap-2">
            {loading && <div className="py-5 text-center text-[13px] text-gray-400">···</div>}
            {!loading && team.members.length === 0 && team.invites.length === 0 && (
              <div className="py-5 text-center text-[13px] text-gray-400">{t('company.team.empty')}</div>
            )}

            {[...team.members].sort((a, b) => {
              // admin 먼저, 그 다음 면접관
              if (a.role === 'admin' && b.role !== 'admin') return -1;
              if (a.role !== 'admin' && b.role === 'admin') return 1;
              return 0;
            }).map(m => {
              const name = m.full_name || m.email?.split('@')[0] || '?';
              const isMe = m.user_id === team.currentUserId;
              const isAdmin = m.role === 'admin';
              const isCreator = m.user_id === team.ownerUserId; // 공고 만든 사람 — 삭제 불가
              const canRemove = team.currentUserIsAdmin && !isCreator && !isMe;
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 px-1 py-1.5">
                  <div className="shrink-0 w-[30px] h-[30px] rounded-full grid place-items-center text-white text-[13px] font-black" style={{ background: colorFor(m.email || name) }}>{initialOf(name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-extrabold text-gray-900 truncate">{name}{isMe && <span className="font-bold text-gray-400 text-[11.5px]"> ({t('company.team.you')})</span>}</div>
                    <div className="text-[11.5px] text-gray-600 truncate">{m.email}</div>
                  </div>
                  <div className={cn(
                    'shrink-0',
                    isAdmin
                      ? 'text-[10.5px] font-black text-primary-600 bg-primary-50 px-2 py-1 rounded-md border border-primary-500/30'
                      : 'text-[11px] font-extrabold text-gray-600'
                  )}>
                    {t(`company.team.role.${isAdmin ? 'admin' : 'interviewer'}`)}
                  </div>
                  {canRemove && (
                    <button onClick={() => removeMember(m)} className="shrink-0 w-6 h-6 ml-1.5 grid place-items-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50" title={t('company.team.removeBtn')}><XIcon className="w-3 h-3" /></button>
                  )}
                </div>
              );
            })}

            {team.invites.map(iv => (
              <div key={iv.id} className="flex items-center gap-2.5 px-1 py-1.5">
                <div className="shrink-0 w-[30px] h-[30px] rounded-full grid place-items-center text-white text-[13px] font-black bg-gray-400">{initialOf(iv.email)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-extrabold text-gray-900 truncate">{iv.email.split('@')[0]}</div>
                  <div className="text-[11.5px] text-gray-600 truncate">{iv.email}</div>
                  <div className="text-[10.5px] text-gray-400 mt-0.5">{t('company.team.invitedAt', { when: relTime(iv.created_at, t) })}</div>
                </div>
                <div className={cn(
                  'shrink-0',
                  iv.role === 'admin'
                    ? 'text-[10.5px] font-black text-primary-600 bg-primary-50 px-2 py-1 rounded-md border border-primary-500/30'
                    : 'text-[11px] font-extrabold text-primary-500'
                )}>
                  {iv.role === 'admin' ? t('company.team.role.admin') : t('company.team.pending')}
                </div>
                {team.currentUserIsAdmin && (
                  <button onClick={() => cancelInvite(iv)} className="shrink-0 w-6 h-6 ml-1.5 grid place-items-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50" title={t('company.team.removeBtn')}><XIcon className="w-3 h-3" /></button>
                )}
              </div>
            ))}
          </div>

          {canInvite && (
            <button type="button" className="mt-2.5 w-full rounded-lg py-2.5 px-3 bg-primary-50 text-primary-600 text-[13px] font-extrabold border border-dashed border-primary-500/40 hover:bg-primary-100 transition-colors" onClick={() => { setInviteOpen(true); setOpen(false); }}>
              + {t('company.team.invite')}
            </button>
          )}
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          jobId={jobId}
          onClose={() => setInviteOpen(false)}
          onDone={() => { setInviteOpen(false); load(); }}
        />
      )}

      {confirmCfg && <ConfirmModal {...confirmCfg} />}
    </div>
  );
}

function InviteModal({ jobId, onClose, onDone }) {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('interviewer'); // 'admin' | 'interviewer'
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { addedDirectly, mailSent, inviteLink, memberName, role }
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setErr('');
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch('/api/company/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, role, jobId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, t, 'company.invite.errGeneric'));
      setResult(j);
    } catch (e) {
      setErr(e.message || t('company.invite.errGeneric'));
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(result.inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const finish = () => { onDone(); };

  return (
    <UDialog open onOpenChange={(open) => { if (!open && !sending) (result ? finish() : onClose()); }}>
      <UDialogContent className="max-w-md">
        {!result && (
          <>
            <UDialogHeader>
              <UDialogTitle>{t('company.invite.title')}</UDialogTitle>
              <UDialogDescription>{t('company.invite.lead')}</UDialogDescription>
            </UDialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">{t('company.invite.email')}</label>
                <UInput
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && !sending) submit(); }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">{t('company.invite.role')}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={cn(
                      'flex-1 px-3 py-2.5 rounded-lg border text-[13px] font-extrabold text-left transition-colors',
                      role === 'admin' ? 'bg-primary-50 border-primary-400 text-primary-600' : 'bg-white border-input text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {t('company.team.role.admin')}
                    <div className="mt-1 text-[10.5px] font-semibold text-gray-600 leading-snug">{t('company.invite.roleDesc.admin')}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('interviewer')}
                    className={cn(
                      'flex-1 px-3 py-2.5 rounded-lg border text-[13px] font-extrabold text-left transition-colors',
                      role === 'interviewer' ? 'bg-primary-50 border-primary-400 text-primary-600' : 'bg-white border-input text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {t('company.team.role.interviewer')}
                    <div className="mt-1 text-[10.5px] font-semibold text-gray-600 leading-snug">{t('company.invite.roleDesc.interviewer')}</div>
                  </button>
                </div>
              </div>
              {err && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>}
              <UButton type="button" disabled={sending} onClick={submit} className="w-full">
                {sending ? t('company.invite.sending') : t('company.invite.submit')}
              </UButton>
            </div>
          </>
        )}

        {result && result.addedDirectly && (
          <div className="text-center">
            <div className="w-[52px] h-[52px] rounded-full mx-auto mt-1 mb-3.5 grid place-items-center bg-primary-500 text-white"><Check className="w-6 h-6" strokeWidth={3} /></div>
            <UDialogTitle>{t('company.invite.done.added.title')}</UDialogTitle>
            <p className="mt-2 mb-4 text-[13px] leading-relaxed text-gray-600 font-semibold">
              {t(
                result.mailSent ? 'company.invite.done.added.leadMailed' : 'company.invite.done.added.lead',
                { name: result.memberName || email, roleLabel: t(`company.team.role.${result.role || 'interviewer'}`) }
              )}
            </p>
            <UButton type="button" className="w-full" onClick={finish}>{t('company.invite.close')}</UButton>
          </div>
        )}

        {result && !result.addedDirectly && result.mailSent && (
          <div className="text-center">
            <div className="w-[52px] h-[52px] rounded-full mx-auto mt-1 mb-3.5 grid place-items-center bg-primary-500 text-white"><MailIcon className="w-6 h-6" /></div>
            <UDialogTitle>{t('company.invite.done.mailed.title')}</UDialogTitle>
            <p className="mt-2 mb-4 text-[13px] leading-relaxed text-gray-600 font-semibold">
              {t('company.invite.done.mailed.lead', { email, roleLabel: t(`company.team.role.${result.role || 'interviewer'}`) })}
            </p>
            <UButton type="button" className="w-full" onClick={finish}>{t('company.invite.close')}</UButton>
          </div>
        )}

        {result && !result.addedDirectly && !result.mailSent && (
          <div>
            <UDialogTitle>{t('company.invite.done.linkOnly.title')}</UDialogTitle>
            <p className="mt-2 mb-4 text-[13px] leading-relaxed text-gray-600 font-semibold">{t('company.invite.done.linkOnly.lead')}</p>
            <div className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-2 bg-gray-50">
              <span className="flex-1 min-w-0 text-xs text-gray-700 truncate font-mono">{result.inviteLink}</span>
              <UButton type="button" variant="outline" size="sm" onClick={copyLink} className="shrink-0 h-7 px-2.5 text-xs">{copied ? t('company.invite.copied') : t('company.invite.copy')}</UButton>
            </div>
            <UButton type="button" className="w-full mt-3" onClick={finish}>{t('company.invite.close')}</UButton>
          </div>
        )}
      </UDialogContent>
    </UDialog>
  );
}
