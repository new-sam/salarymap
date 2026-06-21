import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';
import { ConfirmModal } from './CandidateDetail';
import { X as XIcon, Check, Mail as MailIcon, Users as UsersIcon } from 'lucide-react';

const AVATAR_COLORS = ['#fb923c', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#22d3ee', '#f87171'];
function colorFor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initialOf = (s = '') => (s.trim()[0] || '?').toUpperCase();
function relTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}

export default function TeamPopover({ jobId, canInvite = true }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState({ members: [], invites: [], currentUserId: null, ownerUserId: null });
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
      if (res.ok) setTeam({ members: j.members || [], invites: j.invites || [], currentUserId: j.currentUserId, ownerUserId: j.ownerUserId });
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
        message: t('company.team.removeErr') + (j.error || ''),
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
        <div style={s.pop}>
          <div style={s.popHead}>{t('company.team.title')}</div>

          <div style={s.list}>
            {loading && <div style={s.empty}>···</div>}
            {!loading && team.members.length === 0 && team.invites.length === 0 && (
              <div style={s.empty}>{t('company.team.empty')}</div>
            )}

            {[...team.members].sort((a, b) => {
              // owner 먼저, 그 다음 면접관
              if (a.role === 'owner' && b.role !== 'owner') return -1;
              if (a.role !== 'owner' && b.role === 'owner') return 1;
              return 0;
            }).map(m => {
              const name = m.full_name || m.email?.split('@')[0] || '?';
              const isMe = m.user_id === team.currentUserId;
              const isOwner = m.role === 'owner';
              const iAmOwner = team.ownerUserId === team.currentUserId;
              const canRemove = iAmOwner && !isOwner && !isMe;
              return (
                <div key={m.user_id} style={s.row}>
                  <div style={{ ...s.av, background: colorFor(m.email || name) }}>{initialOf(name)}</div>
                  <div style={s.rowBody}>
                    <div style={s.rowName}>{name}{isMe && <span style={s.meTag}> ({t('company.team.you')})</span>}</div>
                    <div style={s.rowEmail}>{m.email}</div>
                  </div>
                  <div style={isOwner ? s.ownerTag : s.roleTag}>
                    {t(`company.team.role.${isOwner ? 'owner' : 'interviewer'}`)}
                  </div>
                  {canRemove && (
                    <button onClick={() => removeMember(m)} style={s.removeBtn} title={t('company.team.removeBtn')}><XIcon className="w-3 h-3" /></button>
                  )}
                </div>
              );
            })}

            {team.invites.map(iv => {
              const iAmOwner = team.ownerUserId === team.currentUserId;
              return (
                <div key={iv.id} style={s.row}>
                  <div style={{ ...s.av, background: '#9ca3af' }}>{initialOf(iv.email)}</div>
                  <div style={s.rowBody}>
                    <div style={s.rowName}>{iv.email.split('@')[0]}</div>
                    <div style={s.rowEmail}>{iv.email}</div>
                    <div style={s.rowSub}>{t('company.team.invitedAt', { when: relTime(iv.created_at) })}</div>
                  </div>
                  <div style={s.pendTag}>{t('company.team.pending')}</div>
                  {iAmOwner && (
                    <button onClick={() => cancelInvite(iv)} style={s.removeBtn} title={t('company.team.removeBtn')}><XIcon className="w-3 h-3" /></button>
                  )}
                </div>
              );
            })}
          </div>

          {canInvite && (
            <button type="button" style={s.inviteBtn} onClick={() => { setInviteOpen(true); setOpen(false); }}>
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
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { addedDirectly, mailSent, inviteLink, memberName }
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
        body: JSON.stringify({ email, role: 'interviewer', jobId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'error');
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
    <div style={s.overlay} onClick={result ? finish : onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={result ? finish : onClose} style={s.modalClose} aria-label="close">×</button>

        {!result && (
          <>
            <h3 style={s.modalTitle}>{t('company.invite.title')}</h3>
            <p style={s.modalLead}>{t('company.invite.lead')}</p>
            <label style={s.label}>{t('company.invite.email')}</label>
            <input
              style={s.input} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && !sending) submit(); }}
            />
            {err && <div style={s.err}>{err}</div>}
            <button type="button" disabled={sending} onClick={submit} style={{ ...s.submit, opacity: sending ? 0.6 : 1 }}>
              {sending ? t('company.invite.sending') : t('company.invite.submit')}
            </button>
          </>
        )}

        {result && result.addedDirectly && (
          <div style={{ textAlign: 'center' }}>
            <div style={s.doneIcon}><Check className="w-6 h-6" strokeWidth={3} /></div>
            <h3 style={s.modalTitle}>{t('company.invite.done.added.title')}</h3>
            <p style={s.modalLead}>
              {t(
                result.mailSent ? 'company.invite.done.added.leadMailed' : 'company.invite.done.added.lead',
                { name: result.memberName || email }
              )}
            </p>
            <button type="button" style={s.submit} onClick={finish}>{t('company.invite.close')}</button>
          </div>
        )}

        {result && !result.addedDirectly && result.mailSent && (
          <div style={{ textAlign: 'center' }}>
            <div style={s.doneIcon}><MailIcon className="w-6 h-6" /></div>
            <h3 style={s.modalTitle}>{t('company.invite.done.mailed.title')}</h3>
            <p style={s.modalLead}>{t('company.invite.done.mailed.lead', { email })}</p>
            <button type="button" style={s.submit} onClick={finish}>{t('company.invite.close')}</button>
          </div>
        )}

        {result && !result.addedDirectly && !result.mailSent && (
          <div>
            <h3 style={s.modalTitle}>{t('company.invite.done.linkOnly.title')}</h3>
            <p style={s.modalLead}>{t('company.invite.done.linkOnly.lead')}</p>
            <div style={s.linkBox}>
              <span style={s.linkText}>{result.inviteLink}</span>
              <button type="button" onClick={copyLink} style={s.copyBtn}>{copied ? t('company.invite.copied') : t('company.invite.copy')}</button>
            </div>
            <button type="button" style={{ ...s.submit, marginTop: 12 }} onClick={finish}>{t('company.invite.close')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: { position: 'relative', display: 'inline-block' },
  btn: {
    display: 'inline-flex', alignItems: 'center',
    padding: '8px 14px', borderRadius: 9, border: '1px solid #e5e7eb',
    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 800,
    fontFamily: 'inherit', cursor: 'pointer',
  },
  pop: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
    width: 308, maxHeight: 440, overflowY: 'auto',
    background: '#fff', borderRadius: 12, border: '1px solid rgba(17,24,39,0.06)',
    boxShadow: '0 12px 32px rgba(17,24,39,0.10), 0 2px 6px rgba(17,24,39,0.04)', padding: 12,
    fontFamily: "'Pretendard Variable','Pretendard',sans-serif",
  },
  popHead: { fontSize: 12, fontWeight: 800, color: '#111', marginBottom: 8, letterSpacing: '0.02em', textTransform: 'uppercase' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' },
  av: { flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 900 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 13.5, fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meTag: { fontWeight: 700, color: '#9ca3af', fontSize: 11.5 },
  rowEmail: { fontSize: 11.5, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowSub: { fontSize: 10.5, color: '#9ca3af', marginTop: 2 },
  roleTag: { flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#6b7280' },
  ownerTag: { flexShrink: 0, fontSize: 10.5, fontWeight: 900, color: '#ea580c', background: '#fff7ed', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(249,115,22,0.3)' },
  pendTag: { flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#f97316' },
  removeBtn: { flexShrink: 0, width: 24, height: 24, marginLeft: 6, border: '1px solid #FECACA', background: '#fff', color: '#B91C1C', borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'grid', placeItems: 'center', lineHeight: 1 },
  inviteBtn: {
    marginTop: 10, width: '100%', border: 0, borderRadius: 9, padding: '10px 12px',
    background: '#fff7ed', color: '#ea580c', fontSize: 13, fontWeight: 850, cursor: 'pointer',
    fontFamily: 'inherit', border: '1px dashed rgba(249,115,22,0.4)',
  },

  // Modal
  overlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,8,8,0.62)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 },
  modal: {
    width: '100%', maxWidth: 400, position: 'relative',
    background: '#fff', borderRadius: 16, padding: '30px 28px 26px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#151515',
  },
  modalClose: { position: 'absolute', top: 12, right: 14, border: 0, background: 'transparent', fontSize: 24, color: '#9ca3af', cursor: 'pointer' },
  modalTitle: { margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: '-0.02em' },
  modalLead: { margin: '8px 0 18px', fontSize: 13, lineHeight: 1.55, color: '#6b7280', fontWeight: 600 },
  label: { display: 'block', fontSize: 12, fontWeight: 800, color: '#374151', margin: '10px 0 6px' },
  input: { width: '100%', border: '1px solid #D4D7DD', borderRadius: 9, padding: '11px 13px', fontSize: 14, color: '#111', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  roleRow: { display: 'flex', gap: 8 },
  roleBtn: { flex: 1, padding: '10px 12px', border: '1px solid #D4D7DD', background: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 800, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' },
  roleBtnActive: { background: '#fff7ed', borderColor: '#fb923c', color: '#ea580c' },
  err: { marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: '#dc2626', fontWeight: 600 },
  submit: { width: '100%', marginTop: 16, border: 0, borderRadius: 10, padding: '13px 18px', background: '#EA580C', color: '#fff', fontSize: 14, fontWeight: 850, fontFamily: 'inherit', cursor: 'pointer' },
  doneIcon: {
    width: 52, height: 52, borderRadius: '50%', margin: '4px auto 14px',
    display: 'grid', placeItems: 'center', background: '#EA580C', color: '#fff',
    fontSize: 26, fontWeight: 900,
  },
  linkBox: {
    marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 10px', background: '#f9fafb',
  },
  linkText: { flex: 1, minWidth: 0, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' },
  copyBtn: { flexShrink: 0, border: '1px solid #d1d5db', background: '#fff', borderRadius: 7, padding: '6px 11px', fontSize: 12, fontWeight: 800, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' },
};
