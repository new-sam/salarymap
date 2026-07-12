import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css, UploadInput } from './jobs/new';
import MobileNav from '../../components/company/MobileNav';
import { useT } from '../../lib/i18n';
import { PageHeader } from '../../components/ui/page-header';
import { Button as UButton } from '../../components/ui/button';
import { Settings } from 'lucide-react';
import { DEFAULT_WORK_DAYS, DEFAULT_WORK_HOURS, DEFAULT_PAID_LEAVE } from '../../constants/jobs';

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

  // 회사 프로필 — 공고에 매번 반복 입력하지 않도록 회사 단위로 저장하는 값들.
  const [companyId, setCompanyId] = useState(null);
  const [origName, setOrigName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [workHours, setWorkHours] = useState('');
  const [paidLeave, setPaidLeave] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pBusy, setPBusy] = useState(false);
  const [pMsg, setPMsg] = useState(null); // { type: 'ok' | 'err', text }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) { router.replace('/company'); return; }
      setUser(data.session.user);
      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name, logo_url, work_days, work_hours, paid_leave)')
        .eq('user_id', data.session.user.id)
        .maybeSingle();
      const co = rec?.recruiter_companies;
      if (rec?.company_id) setCompanyId(rec.company_id);
      if (co?.name) { setCompanyName(co.name); setOrigName(co.name); }
      if (co?.logo_url) setLogoUrl(co.logo_url);
      if (co?.work_days) setWorkDays(co.work_days);
      if (co?.work_hours) setWorkHours(co.work_hours);
      if (co?.paid_leave) setPaidLeave(co.paid_leave);
      setStatus('ready');
    })();
    return () => { mounted = false; };
  }, []);

  const uploadLogo = async (file) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `company/${user.id}/profile-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('job-images').upload(path, file);
      if (error) { setPMsg({ type: 'err', text: t('company.profile.saveFailed') }); return; }
      const { data } = supabase.storage.from('job-images').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setPMsg(null);
    if (!companyName.trim()) { setPMsg({ type: 'err', text: t('company.profile.errName') }); return; }
    if (!companyId) return;
    setPBusy(true);
    const trimmedName = companyName.trim();
    const { error } = await supabase
      .from('recruiter_companies')
      .update({
        name: trimmedName,
        logo_url: logoUrl || null,
        work_days: workDays.trim() || null,
        work_hours: workHours.trim() || null,
        paid_leave: paidLeave.trim() || null,
      })
      .eq('id', companyId);
    if (error) { setPBusy(false); setPMsg({ type: 'err', text: t('company.profile.saveFailed') }); return; }
    // 회사명이 바뀌면 기존 공고 스냅샷(jobs.company)에도 반영 — 공개 상세/목록이 옛 이름으로
    // 남지 않도록. (jobs.company 는 생성 시 회사명을 복사해 둔 값)
    if (trimmedName !== origName) {
      await supabase.from('jobs').update({ company: trimmedName }).eq('company_id', companyId);
      setOrigName(trimmedName);
    }
    setPBusy(false);
    setPMsg({ type: 'ok', text: t('company.profile.saved') });
  };

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
            <form onSubmit={saveProfile} className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3.5">
              <div>
                <div className="text-[15px] font-extrabold text-foreground">{t('company.profile.title')}</div>
                <div className="text-[12px] text-gray-500 mt-0.5 font-medium">{t('company.profile.desc')}</div>
              </div>

              <div>
                <label style={fcss.label}>{t('company.profile.nameLabel')}</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={fcss.input} />
              </div>

              <div>
                <label style={fcss.label}>{t('company.profile.logoLabel')}</label>
                {logoUrl ? (
                  <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                    <img src={logoUrl} alt="logo" className="h-10 w-10 rounded-md object-contain bg-gray-50" />
                    <UButton type="button" variant="outline" size="sm" onClick={() => setLogoUrl('')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">{t('company.remove')}</UButton>
                  </div>
                ) : (
                  <UploadInput label={t('company.jobsnew.uploadBtn')} disabled={uploading} onFile={(f) => uploadLogo(f)} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={fcss.label}>{t('company.profile.workDaysLabel')}</label>
                  <input value={workDays} onChange={(e) => setWorkDays(e.target.value)} placeholder={DEFAULT_WORK_DAYS} style={fcss.input} />
                </div>
                <div>
                  <label style={fcss.label}>{t('company.profile.workHoursLabel')}</label>
                  <input value={workHours} onChange={(e) => setWorkHours(e.target.value)} placeholder={DEFAULT_WORK_HOURS} style={fcss.input} />
                </div>
                <div>
                  <label style={fcss.label}>{t('company.profile.paidLeaveLabel')}</label>
                  <input value={paidLeave} onChange={(e) => setPaidLeave(e.target.value)} placeholder={DEFAULT_PAID_LEAVE} style={fcss.input} />
                </div>
              </div>

              {pMsg && (
                <div style={pMsg.type === 'ok' ? fcss.okBox : fcss.errBox}>{pMsg.text}</div>
              )}
              <UButton type="submit" disabled={pBusy || uploading} className="w-full">
                {pBusy ? t('company.profile.saving') : uploading ? t('company.uploading') : t('company.profile.save')}
              </UButton>
            </form>

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
  label: { display: 'block', marginBottom: 6, color: '#4E5968', fontSize: 12, fontWeight: 800 },
  input: {
    width: '100%', border: '1px solid #D1D6DB', borderRadius: 10,
    padding: '12px 14px', color: '#191F28', background: '#fff', fontSize: 14,
    fontFamily: 'inherit', outline: 'none',
  },
  okBox: { padding: '10px 12px', borderRadius: 9, background: '#F0FDF4', color: '#16A34A', fontSize: 12.5, fontWeight: 700 },
  errBox: { padding: '10px 12px', borderRadius: 9, background: '#FEF2F2', color: '#DC2626', fontSize: 12.5, fontWeight: 700 },
};
