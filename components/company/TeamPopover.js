import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';

const AVATAR_COLORS = ['#fb923c', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#22d3ee', '#f87171'];
function colorFor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initialOf = (s = '') => (s.trim()[0] || '?').toUpperCase();

export default function TeamPopover({ jobId, canInvite = true }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState({ members: [], invites: [], currentUserId: null, ownerUserId: null });
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const ref = useRef(null);

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = team.members.length + team.invites.length;

  return (
    <div ref={ref} style={s.wrap}>
      <button type="button" onClick={() => setOpen(v => !v)} style={s.btn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        {t('company.team.btn')} {count}
      </button>

      {open && (
        <div style={s.pop}>
          <div style={s.popHead}>{t('company.team.title')}</div>

          <div style={s.list}>
            {loading && <div style={s.empty}>···</div>}
            {!loading && team.members.length === 0 && team.invites.length === 0 && (
              <div style={s.empty}>{t('company.team.empty')}</div>
            )}

            {team.members.map(m => {
              const name = m.full_name || m.email?.split('@')[0] || '?';
              const isMe = m.user_id === team.currentUserId;
              const isOwner = m.role === 'owner';
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
                </div>
              );
            })}

            {team.invites.map(iv => (
              <div key={iv.id} style={s.row}>
                <div style={{ ...s.av, background: '#9ca3af' }}>{initialOf(iv.email)}</div>
                <div style={s.rowBody}>
                  <div style={s.rowName}>{iv.email.split('@')[0]}</div>
                  <div style={s.rowEmail}>{iv.email}</div>
                </div>
                <div style={s.pendTag}>{t('company.team.pending')}</div>
              </div>
            ))}
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
    </div>
  );
}

function InviteModal({ jobId, onClose, onDone }) {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

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
      onDone();
    } catch (e) {
      setErr(e.message || t('company.invite.errGeneric'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} style={s.modalClose} aria-label="close">×</button>
        <h3 style={s.modalTitle}>{t('company.invite.title')}</h3>
        <p style={s.modalLead}>{t('company.invite.lead')}</p>

        <label style={s.label}>{t('company.invite.email')}</label>
        <input style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />

        {err && <div style={s.err}>{err}</div>}
        <button type="button" disabled={sending} onClick={submit} style={{ ...s.submit, opacity: sending ? 0.6 : 1 }}>
          {sending ? t('company.invite.sending') : t('company.invite.submit')}
        </button>
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
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
    width: 320, maxHeight: 440, overflowY: 'auto',
    background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.18)', padding: 14,
  },
  popHead: { fontSize: 13, fontWeight: 900, color: '#111', marginBottom: 8, letterSpacing: '-0.01em' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' },
  av: { flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 900 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 13.5, fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meTag: { fontWeight: 700, color: '#9ca3af', fontSize: 11.5 },
  rowEmail: { fontSize: 11.5, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  roleTag: { flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#6b7280' },
  ownerTag: { flexShrink: 0, fontSize: 10.5, fontWeight: 900, color: '#ea580c', background: '#fff7ed', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(249,115,22,0.3)' },
  pendTag: { flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#f97316' },
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
  submit: { width: '100%', marginTop: 16, border: 0, borderRadius: 10, padding: '13px 18px', background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff', fontSize: 14, fontWeight: 850, fontFamily: 'inherit', cursor: 'pointer' },
};
