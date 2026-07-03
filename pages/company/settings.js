import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import MobileNav from '../../components/company/MobileNav';
import { useT } from '../../lib/i18n';
import { PageHeader } from '../../components/ui/page-header';
import { Button as UButton } from '../../components/ui/button';
import { Settings } from 'lucide-react';

export default function CompanySettings() {
  const router = useRouter();
  const { t } = useT();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) { router.replace('/company'); return; }
      setUser(data.session.user);
      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('recruiter_companies(name)')
        .eq('user_id', data.session.user.id)
        .maybeSingle();
      if (rec?.recruiter_companies?.name) setCompanyName(rec.recruiter_companies.name);
      setStatus('ready');
    })();
    return () => { mounted = false; };
  }, []);

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) { setMsg({ type: 'err', text: t('company.settings.errShort') }); return; }
    if (newPw !== confirmPw) { setMsg({ type: 'err', text: t('company.settings.errMismatch') }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setBusy(false);
    if (error) { setMsg({ type: 'err', text: t('company.settings.errFailed') }); return; }
    setNewPw('');
    setConfirmPw('');
    setMsg({ type: 'ok', text: t('company.settings.saved') });
  };

  if (status === 'loading') return null;

  return (
    <>
      <Head><title>{t('company.settings.head')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="settings" />
        <main style={css.main}>
          <MobileNav active="settings" companyName={companyName} userEmail={user?.email} />
          <div className="hidden md:block">
            <PageHeader
              title={(
                <span className="flex items-center gap-2.5">
                  <Settings className="w-5 h-5 text-primary-600" />
                  {t('company.settings.title')}
                </span>
              )}
            />
          </div>

          <div className="max-w-[520px] flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="text-[11px] font-extrabold text-gray-500 uppercase tracking-[0.08em]">{t('company.settings.emailLabel')}</div>
              <div className="mt-1 text-[14px] font-bold text-foreground">{user?.email}</div>
            </div>

            <form onSubmit={changePassword} className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3">
              <div className="text-[15px] font-extrabold text-foreground">{t('company.settings.pwTitle')}</div>
              <div>
                <label style={fcss.label}>{t('company.settings.newPw')}</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={fcss.input} required />
              </div>
              <div>
                <label style={fcss.label}>{t('company.settings.confirmPw')}</label>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={fcss.input} required />
              </div>
              {msg && (
                <div style={msg.type === 'ok' ? fcss.okBox : fcss.errBox}>{msg.text}</div>
              )}
              <UButton type="submit" disabled={busy} className="w-full">
                {busy ? t('company.settings.saving') : t('company.settings.save')}
              </UButton>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}

const fcss = {
  label: { display: 'block', marginBottom: 6, color: '#374151', fontSize: 12, fontWeight: 800 },
  input: {
    width: '100%', border: '1px solid #D1D5DB', borderRadius: 10,
    padding: '12px 14px', color: '#111', background: '#fff', fontSize: 14,
    fontFamily: 'inherit', outline: 'none',
  },
  okBox: { padding: '10px 12px', borderRadius: 9, background: '#F0FDF4', color: '#16A34A', fontSize: 12.5, fontWeight: 700 },
  errBox: { padding: '10px 12px', borderRadius: 9, background: '#FEF2F2', color: '#DC2626', fontSize: 12.5, fontWeight: 700 },
};
