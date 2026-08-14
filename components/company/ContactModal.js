import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useT } from '../../lib/i18n';
import { apiErrorMessage } from '../../lib/apiErrorMessage';
import { Check } from 'lucide-react';

export default function ContactModal({ open, onClose }) {
  const { t } = useT();
  const router = useRouter();
  const [phase, setPhase] = useState('loading'); // loading | guest | form | done
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ companyName: '', contactName: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    setPhase('loading');
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data?.session?.user || null;
      setUser(u);
      setPhase(u ? 'form' : 'guest');
    })();
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setErr('');
    if (!form.contactName.trim() || !form.phone.trim()) {
      setErr(t('company.landing.contact.errRequired'));
      return;
    }
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch('/api/company/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j, t, 'company.landing.contact.errGeneric'));
      setPhase('done');
    } catch (e) {
      setErr(e.message || t('company.landing.contact.errGeneric'));
    } finally {
      setSending(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} style={s.close} aria-label="close">×</button>

        {phase === 'loading' && <div style={s.loading}>···</div>}

        {phase === 'guest' && (
          <>
            <h3 style={s.title}>{t('company.landing.contact.title')}</h3>
            <p style={s.lead}>{t('company.landing.contact.guestLead')}</p>
            <button type="button" style={s.btnPrimary} onClick={() => router.push('/company?mode=signup')}>
              {t('company.landing.contact.guestBtn')}
            </button>
            <button type="button" style={s.btnGhost} onClick={() => router.push('/company')}>
              {t('company.landing.contact.guestLogin')}
            </button>
          </>
        )}

        {phase === 'form' && (
          <>
            <h3 style={s.title}>{t('company.landing.contact.title')}</h3>
            <p style={s.lead}>{t('company.landing.contact.formLead')}</p>
            {user?.email && <div style={s.emailHint}>{user.email}</div>}

            <label style={s.label}>{t('company.landing.contact.fieldCompany')}</label>
            <input style={s.input} value={form.companyName} onChange={set('companyName')} />

            <label style={s.label}>{t('company.landing.contact.fieldName')} *</label>
            <input style={s.input} value={form.contactName} onChange={set('contactName')} />

            <label style={s.label}>{t('company.landing.contact.fieldPhone')} *</label>
            <input style={s.input} value={form.phone} onChange={set('phone')} />

            <label style={s.label}>{t('company.landing.contact.fieldMessage')}</label>
            <textarea style={{ ...s.input, ...s.textarea }} value={form.message} onChange={set('message')} rows={3} />

            {err && <div style={s.err}>{err}</div>}
            <button type="button" style={{ ...s.btnPrimary, opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={submit}>
              {sending ? t('company.landing.contact.sending') : t('company.landing.contact.submit')}
            </button>
          </>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={s.doneIcon}><Check className="w-6 h-6" strokeWidth={3} /></div>
            <h3 style={s.title}>{t('company.landing.contact.doneTitle')}</h3>
            <p style={s.lead}>{t('company.landing.contact.doneLead')}</p>
            <button type="button" style={s.btnPrimary} onClick={onClose}>
              {t('company.landing.contact.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(8,8,8,0.62)', backdropFilter: 'blur(4px)',
    display: 'grid', placeItems: 'center', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 420, position: 'relative',
    background: '#fff', borderRadius: 18, padding: '34px 30px 30px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: 'var(--sm-gray-900)',
  },
  close: {
    position: 'absolute', top: 14, right: 16, border: 0, background: 'transparent',
    fontSize: 26, lineHeight: 1, color: 'var(--sm-gray-400)', cursor: 'pointer',
  },
  loading: { textAlign: 'center', padding: '30px 0', color: 'var(--sm-gray-400)', fontSize: 22 },
  title: { margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' },
  lead: { margin: '10px 0 20px', fontSize: 14, lineHeight: 1.6, color: 'var(--sm-gray-700)', fontWeight: 600, wordBreak: 'keep-all' },
  emailHint: {
    display: 'inline-block', padding: '6px 11px', borderRadius: 8,
    background: 'var(--sm-gray-100)', color: 'var(--sm-gray-700)', fontSize: 12.5, fontWeight: 700, marginBottom: 16,
  },
  label: { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--sm-gray-700)', margin: '12px 0 6px' },
  input: {
    width: '100%', border: '1px solid var(--sm-gray-300)', borderRadius: 9, padding: '11px 13px',
    fontSize: 14, color: 'var(--sm-gray-900)', fontFamily: 'inherit', outline: 'none', background: '#fff',
  },
  textarea: { resize: 'vertical', lineHeight: 1.5 },
  err: {
    marginTop: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    padding: '9px 12px', fontSize: 12.5, color: '#dc2626', fontWeight: 600,
  },
  btnPrimary: {
    width: '100%', marginTop: 18, border: 0, borderRadius: 10, padding: '14px 18px',
    background: 'var(--sm-primary)', color: '#fff',
    fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  },
  btnGhost: {
    width: '100%', marginTop: 10, borderRadius: 10, padding: '12px 18px',
    border: '1px solid var(--sm-gray-200)', background: '#fff', color: 'var(--sm-gray-700)',
    fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
  doneIcon: {
    width: 52, height: 52, borderRadius: '50%', margin: '4px auto 16px',
    display: 'grid', placeItems: 'center', background: 'var(--sm-primary)', color: '#fff',
    fontSize: 26, fontWeight: 800,
  },
};
