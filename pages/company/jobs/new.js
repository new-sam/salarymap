import { useState, useEffect, Fragment } from 'react';
import { color as tc, font as tf, space as ts, radius as tr, shadow as tsh, motion as tm } from '../../../lib/theme';
import { cn } from '../../../lib/cn';
import { Plus, Home, CalendarDays, ImageIcon, MapPin, Building2, Briefcase, Users as UsersIcon } from 'lucide-react';
import { Button as UButton } from '../../../components/ui/button';
import { Input as UInput } from '../../../components/ui/input';
import { PageHeader } from '../../../components/ui/page-header';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import Brand from '../../../components/company/Brand';
import LangToggle from '../../../components/company/LangToggle';
import { useT } from '../../../lib/i18n';
import { toast } from 'sonner';

const ROLES = ['Backend', 'Frontend', 'Fullstack', 'Mobile', 'Data', 'DevOps', 'PM', 'Design', 'QA'];
const TYPES = ['remote', 'onsite', 'hybrid'];
const LOCATIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];

const EMPTY = {
  title: '', description: '', role: 'Backend', type: 'hybrid', country: 'vietnam',
  location: 'Hồ Chí Minh', experience_min: 1, experience_max: 5,
  salary_min: 30000000, salary_max: 50000000, tech_stack: '', benefits: '',
  headcount: '', deadline: '',
  image_url: '', logo_url: '',
};

export default function NewJobPage() {
  const router = useRouter();
  const { t } = useT();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [tmpCompanyName, setTmpCompanyName] = useState('');
  const [tmpFullName, setTmpFullName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUser(session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, full_name, recruiter_companies(name)')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!rec?.company_id) {
        setTmpFullName(rec?.full_name || '');
        setStatus('needs_onboarding');
        return;
      }
      setCompanyId(rec.company_id);
      setCompanyName(rec.recruiter_companies?.name || '');
      setStatus('ready');
    })();
  }, []);

  const setF = (k, v) => setForm({ ...form, [k]: v });

  const [uploading, setUploading] = useState(false);
  const uploadImage = async (file, field) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `company/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('job-images').upload(path, file);
      if (error) { setErr(t('company.err.imgUpload') + error.message); return; }
      const { data } = supabase.storage.from('job-images').getPublicUrl(path);
      setForm(prev => ({ ...prev, [field]: data.publicUrl }));
    } finally {
      setUploading(false);
    }
  };

  const completeOnboarding = async (e) => {
    e.preventDefault();
    setErr('');
    if (!tmpCompanyName.trim()) { setErr(t('company.err.companyRequired')); return; }
    if (!tmpFullName.trim()) { setErr(t('company.err.contactRequired')); return; }
    const emailDomain = (user.email || '').split('@')[1]?.toLowerCase();
    if (!emailDomain) { setErr(t('company.err.notVerified')); return; }
    setStatus('saving');

    let cid = null;
    const { data: existing } = await supabase
      .from('recruiter_companies').select('id')
      .eq('email_domain', emailDomain).maybeSingle();
    if (existing?.id) cid = existing.id;
    else {
      const { data: created, error: createErr } = await supabase
        .from('recruiter_companies')
        .insert({ name: tmpCompanyName.trim(), email_domain: emailDomain, created_by: user.id })
        .select('id').single();
      if (createErr) { setErr(t('company.err.createFailed') + ': ' + createErr.message); setStatus('needs_onboarding'); return; }
      cid = created.id;
    }

    const { error: updErr } = await supabase
      .from('recruiter_users')
      .upsert({ user_id: user.id, company_id: cid, email: user.email, full_name: tmpFullName.trim(), role: 'admin' }, { onConflict: 'user_id' });
    if (updErr) { setErr(t('company.err.linkFailed') + ': ' + updErr.message); setStatus('needs_onboarding'); return; }

    setCompanyId(cid);
    setCompanyName(tmpCompanyName.trim());
    setStatus('ready');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) { setErr(t('company.err.titleRequired')); return; }
    if (!form.description.trim()) { setErr(t('company.err.descRequired')); return; }
    if (Number(form.salary_min) >= Number(form.salary_max)) { setErr(t('company.err.salaryRange')); return; }
    setStatus('saving');

    const techArr = form.tech_stack.split(',').map(s => s.trim()).filter(Boolean);
    const benefitsArr = form.benefits.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      title: form.title.trim(),
      company: companyName,
      company_id: companyId,
      // TODO: 게재 검토 어드민 구축 후 'pending_review' + is_active=false 로 복원
      status: 'live',
      is_active: true,
      created_by: user?.id || null,
      description: form.description.trim(),
      role: form.role, type: form.type, country: form.country, location: form.location,
      experience_min: Number(form.experience_min), experience_max: Number(form.experience_max),
      salary_min: Number(form.salary_min), salary_max: Number(form.salary_max),
      tech_stack: techArr, benefits: benefitsArr,
      headcount: form.headcount ? Number(form.headcount) : null,
      deadline: form.deadline || null,
      image_url: form.image_url || null,
      logo_url: form.logo_url || null,
      source: 'company_self',
    };

    const { data, error } = await supabase.from('jobs').insert(payload).select('id').single();
    if (error) { setErr(error.message); setStatus('ready'); return; }
    // 작성자를 채용팀 오너로 등록 (실패해도 공고 생성 자체는 성공으로 처리)
    if (data?.id && user?.id) {
      await supabase.from('job_team').insert({ job_id: data.id, user_id: user.id, role: 'owner' });
    }
    toast.success(t('company.jobsnew.publish'));
    router.replace('/company/jobs');
  };

  if (status === 'loading') return <div style={css.loading}>{t('company.loading')}</div>;

  if (status === 'unauthed') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>{t('company.loginRequired')}</h1>
          <p style={css.cardP}>{err || t('company.err.loginRequired')}</p>
          <Link href="/company" style={css.btnPrimary}>{t('company.loginOrSignup')}</Link>
        </div>
      </div>
    );
  }

  if (status === 'needs_onboarding' || (status === 'saving' && !companyId)) {
    return (
      <div style={css.fullCenter}>
        <div style={{...css.lightCard, maxWidth: 460}}>
          <h1 style={css.cardH}>{t('company.jobsnew.onboardH')}</h1>
          <p style={css.cardP}>{t('company.jobsnew.onboardCopy')}</p>
          <form onSubmit={completeOnboarding} style={{ textAlign: 'left' }}>
            <Field label={t('company.companyLabel')}>
              <input value={tmpCompanyName} onChange={e => setTmpCompanyName(e.target.value)} placeholder={t('company.companyPh')} style={css.inp} />
            </Field>
            <Field label={t('company.contactLabel')}>
              <input value={tmpFullName} onChange={e => setTmpFullName(e.target.value)} placeholder={t('company.contactPh')} style={css.inp} />
            </Field>
            {err && <div style={css.err}>{err}</div>}
            <button type="submit" disabled={status === 'saving'} style={status === 'saving' ? css.btnDisabled : css.btnPrimary}>
              {status === 'saving' ? t('company.saving') : t('company.jobsnew.onboardSave')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{t('company.head.newJob')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="new" />

        <main style={css.main}>
          <PageHeader
            title={t('company.jobsnew.h')}
            subtitle={t('company.jobsnew.sub')}
            right={(
              <>
                <UButton asChild variant="outline">
                  <Link href="/company/jobs">{t('company.cancel')}</Link>
                </UButton>
                <UButton type="submit" form="job-new-form" disabled={status === 'saving'}>
                  {status === 'saving' ? t('company.saving') : t('company.jobsnew.publish')}
                </UButton>
              </>
            )}
          />

          <form id="job-new-form" onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
            <div className="flex flex-col">
              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mb-3">{t('company.jobsnew.photoH')}</h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label={t('company.jobsnew.imageLabel')}>
                  {form.image_url ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                      <img src={form.image_url} alt="thumbnail" className="h-14 w-24 rounded-md object-cover" />
                      <UButton type="button" variant="outline" size="sm" onClick={() => setF('image_url', '')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">{t('company.remove')}</UButton>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'image_url')}
                      className="text-xs text-gray-700 border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50 cursor-pointer w-full" />
                  )}
                </Field>
                <Field label={t('company.jobsnew.logoLabel')}>
                  {form.logo_url ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                      <img src={form.logo_url} alt="logo" className="h-10 w-10 rounded-md object-contain bg-gray-50" />
                      <UButton type="button" variant="outline" size="sm" onClick={() => setF('logo_url', '')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">{t('company.remove')}</UButton>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo_url')}
                      className="text-xs text-gray-700 border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50 cursor-pointer w-full" />
                  )}
                </Field>
              </div>
              {uploading
                ? <div className="text-xs text-primary-600 font-semibold mb-3">{t('company.uploading')}</div>
                : <div className="text-xs text-gray-400 font-semibold mb-5">{t('company.jobsnew.photoHint')}</div>}

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-3 mb-3">{t('company.jobsnew.basicH')}</h2>

              <Field label={t('company.jobsnew.title')}>
                <UInput value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Senior Backend Engineer" />
              </Field>

              <Field label={t('company.jobsnew.descLabel')}>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={4}
                  placeholder={t('company.jobsnew.descPh')}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y min-h-[110px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('company.jobsnew.role')}>
                  <SelectInput value={form.role} onChange={e => setF('role', e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </SelectInput>
                </Field>
                <Field label={t('company.jobsnew.type')}>
                  <SelectInput value={form.type} onChange={e => setF('type', e.target.value)}>
                    {TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                  </SelectInput>
                </Field>
              </div>

              <Field label={t('company.jobsnew.location')}>
                <SelectInput value={form.location} onChange={e => setF('location', e.target.value)}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </SelectInput>
              </Field>

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-3">{t('company.jobsnew.expSalH')}</h2>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('company.jobsnew.expMin')}>
                  <UInput type="number" value={form.experience_min} onChange={e => setF('experience_min', e.target.value)} />
                </Field>
                <Field label={t('company.jobsnew.expMax')}>
                  <UInput type="number" value={form.experience_max} onChange={e => setF('experience_max', e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('company.jobsnew.salaryMin')}>
                  <UInput type="number" value={form.salary_min} onChange={e => setF('salary_min', e.target.value)} />
                  <div className="text-xs text-gray-500 mt-1">{t('company.jobsnew.vndHint', { n: Math.round(form.salary_min / 1e6) })}</div>
                </Field>
                <Field label={t('company.jobsnew.salaryMax')}>
                  <UInput type="number" value={form.salary_max} onChange={e => setF('salary_max', e.target.value)} />
                  <div className="text-xs text-gray-500 mt-1">{t('company.jobsnew.vndHint', { n: Math.round(form.salary_max / 1e6) })}</div>
                </Field>
              </div>

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-3">{t('company.jobsnew.skillH')}</h2>

              <Field label={t('company.jobsnew.tech')}>
                <UInput value={form.tech_stack} onChange={e => setF('tech_stack', e.target.value)} placeholder="Node.js, PostgreSQL, AWS" />
              </Field>

              <Field label={t('company.jobsnew.benefits')}>
                <UInput value={form.benefits} onChange={e => setF('benefits', e.target.value)} placeholder="13th-month, Health insurance" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('company.jobsnew.headcount')}>
                  <UInput type="number" value={form.headcount} onChange={e => setF('headcount', e.target.value)} placeholder="1" />
                </Field>
                <Field label={t('company.jobsnew.deadline')}>
                  <UInput type="date" value={form.deadline} onChange={e => setF('deadline', e.target.value)} />
                </Field>
              </div>
            </div>

            <aside className="bg-white border border-border rounded-2xl p-4 pb-5 flex flex-col gap-3 sticky top-[88px] shadow-soft-xs max-h-[calc(100vh-100px)] overflow-y-auto">
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-gray-500">{t('company.jobsnew.previewLabel')}</div>

              <div className="bg-white border border-border rounded-xl overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-32 object-cover block" />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-[11px] text-gray-400 font-semibold gap-2">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {t('company.jobsnew.previewEmpty')}
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="" className="w-8 h-8 rounded-md object-contain bg-gray-50 border border-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center border border-border">
                        <Building2 className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] text-gray-900 font-bold truncate">{companyName || t('company.previewCompanyDef')}</div>
                      <div className="text-[11.5px] text-gray-900 font-semibold truncate">{form.location} · {form.type}</div>
                    </div>
                  </div>

                  <div className="text-[17px] font-extrabold text-foreground leading-tight tracking-tight">
                    {form.title || t('company.previewTitleDef')}
                  </div>

                  <div className="text-[16px] font-extrabold text-emerald-600 tabular-nums leading-none">
                    {Math.round(form.salary_min/1e6)}M – {Math.round(form.salary_max/1e6)}M VND
                  </div>

                  {(form.tech_stack || '').trim() && (
                    <div className="flex flex-wrap gap-1">
                      {form.tech_stack.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6).map(tg => (
                        <span key={tg} className="text-[11.5px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{tg}</span>
                      ))}
                    </div>
                  )}

                  {(form.description || '').trim() && (
                    <div className="pt-3 border-t border-border">
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1.5">업무 설명</div>
                      <div className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-line max-h-20 overflow-y-auto pr-1">
                        {form.description}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div>
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        포지션
                      </div>
                      <div className="text-[13px] font-bold text-foreground">{form.role}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1">경력</div>
                      <div className="text-[13px] font-bold text-foreground tabular-nums">{form.experience_min}–{form.experience_max}년</div>
                    </div>
                    {form.headcount && (
                      <div>
                        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1 flex items-center gap-1">
                          <UsersIcon className="w-3 h-3" />
                          채용 인원
                        </div>
                        <div className="text-[13px] font-bold text-foreground tabular-nums">{form.headcount}명</div>
                      </div>
                    )}
                    {form.deadline && (
                      <div>
                        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          마감
                        </div>
                        <div className="text-[13px] font-bold text-foreground tabular-nums">{form.deadline}</div>
                      </div>
                    )}
                  </div>

                  {(form.benefits || '').trim() && (
                    <div className="pt-3 border-t border-border">
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1.5">복지</div>
                      <div className="flex flex-wrap gap-1">
                        {form.benefits.split(',').map(s => s.trim()).filter(Boolean).map(b => (
                          <span key={b} className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10.5px] text-gray-400 font-medium leading-relaxed">
                실시간 입력값이 반영됩니다. 저장 후 공개 페이지에서 실제 화면을 확인할 수 있습니다.
              </div>
            </aside>

            {err && (
              <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>
            )}
          </form>
        </main>
      </div>
    </>
  );
}

export function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5 mb-3.5">
      <label className="text-[13px] font-bold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export function SelectInput({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
    >
      {children}
    </select>
  );
}

const DOT_COLOR = { live: '#10b981', paused: '#f59e0b', closed: '#94a3b8', draft: '#cbd5e1', pending_review: '#f97316' };

export function Sidebar({ companyName, userEmail, activePage = 'home', activeJobId = null }) {
  const router = useRouter();
  const { t } = useT();
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!rec?.company_id) return;
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, status')
        .eq('company_id', rec.company_id)
        .order('created_at', { ascending: true });
      setJobs(jobsData || []);
    })();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); router.replace('/for-companies'); };
  const isActive = (k) => activePage === k;

  return (
    <aside className="hidden md:flex bg-[#0A0A0A] border-r border-white/5 px-2 py-3 flex-col gap-0.5 w-[210px] shrink-0 h-screen sticky top-0 overflow-y-auto">
      {/* Brand + user */}
      <div className="px-2 pb-2.5 mb-1.5 border-b border-white/8">
        <div className="flex items-center justify-between gap-1.5 mb-2">
          <Brand href="/company" size="sm" />
          <LangToggle align="right" />
        </div>
        <div className="text-[13px] font-extrabold text-white tracking-tight truncate">{companyName || t('company.sidebar.myCompany')}</div>
        <div className="text-[11px] text-gray-500 mt-0.5 truncate font-medium">{userEmail}</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5">
        <Link
          href="/company/jobs/new"
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors',
            isActive('new')
              ? 'bg-primary-500/15 text-primary-300'
              : 'text-gray-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('company.sidebar.newJob')}
        </Link>
        <Link
          href="/company"
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors',
            isActive('home')
              ? 'bg-primary-500/15 text-primary-300'
              : 'text-gray-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <Home className="h-3.5 w-3.5" />
          {t('company.sidebar.dashboard')}
        </Link>
        <Link
          href="/company/calendar"
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors',
            isActive('calendar')
              ? 'bg-primary-500/15 text-primary-300'
              : 'text-gray-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {t('company.sidebar.calendar')}
        </Link>
      </nav>

      {jobs.length > 0 && (() => {
        const groupOf = (s) => s === 'live' ? 'active' : s === 'pending_review' ? 'pending' : 'inactive';
        const grouped = { active: [], pending: [], inactive: [] };
        jobs.forEach(j => { grouped[groupOf(j.status)].push(j); });
        return (
          <>
            {/* Section divider with title — myJobs */}
            <div className="h-px bg-white/15 my-3 mx-1" />
            <div className="px-2.5 pt-0.5 pb-1.5 text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.08em]">
              {t('company.sidebar.myJobs', { n: jobs.length })}
            </div>
            <div className="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto">
              {['active', 'pending', 'inactive'].map(g => (
                <Fragment key={g}>
                  <div className="px-2.5 pt-1.5 pb-0.5 text-[10.5px] font-bold text-gray-500">
                    {t(`company.jobGroup.${g}`, { n: grouped[g].length })}
                  </div>
                  {grouped[g].length === 0 && (
                    <div className="px-2.5 py-1 text-[11.5px] text-gray-600 font-medium">
                      —
                    </div>
                  )}
                  {grouped[g].map(j => {
                    const dotColor = DOT_COLOR[j.status] || DOT_COLOR.draft;
                    const isCurrent = activeJobId === j.id;
                    return (
                      <Link
                        key={j.id}
                        href={`/company/ats?job=${j.id}`}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors',
                          isCurrent
                            ? 'bg-primary-500/15 text-primary-300'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        )}
                        title={j.title}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                        <span className="truncate">{j.title}</span>
                      </Link>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </>
        );
      })()}

      <div className="mt-auto pt-3 px-2.5">
        <button onClick={signOut} className="text-[11px] text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline transition-colors">
          {t('company.sidebar.signOut')}
        </button>
      </div>
    </aside>
  );
}

export const css = {
  loading: { display: 'grid', placeItems: 'center', height: '100vh', background: '#FAFAFA', color: '#525252', fontFamily: "'Pretendard', sans-serif" },

  fullCenter: { minHeight: '100vh', background: '#FAFAFA', display: 'grid', placeItems: 'center', padding: 20, fontFamily: "'Pretendard', sans-serif" },
  lightCard: { maxWidth: 420, width: '100%', padding: '40px 32px', textAlign: 'center', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.05)' },
  cardH: { fontSize: 20, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 },
  cardP: { fontSize: 13.5, color: '#525252', marginBottom: 22, lineHeight: 1.65 },

  app: { display: 'flex', minHeight: '100vh', background: '#FAFAFA', color: '#1A1A1A', fontFamily: "'Pretendard', sans-serif" },

  // Sidebar (light)
  sidebar: { background: '#fff', borderRight: '1px solid #E5E7EB', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  sideHead: { padding: '8px 10px 14px', borderBottom: '1px solid #E5E7EB', marginBottom: 10 },
  sideCompany: { fontSize: 14, fontWeight: 800, color: '#1A1A1A' },
  sideUser: { fontSize: 11, color: '#737373', marginTop: 3 },
  sideNav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 7, fontSize: 13, color: '#525252', fontWeight: 600, textDecoration: 'none' },
  navItemActive: { background: '#FFF7ED', color: '#EA580C', fontWeight: 800 },
  navIco: { width: 14, textAlign: 'center', fontSize: 13 },
  sideBottom: { marginTop: 'auto', padding: 10 },
  signoutLink: { fontSize: 11.5, color: '#737373', cursor: 'pointer', textDecoration: 'underline' },

  sideDivider: { height: 1, background: '#E5E7EB', margin: '12px 8px' },
  sideSectionTitle: { fontSize: 10.5, color: '#94A3B8', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px 6px' },
  sideSubGroupTitle: { fontSize: 11, color: '#525252', fontWeight: 700, padding: '8px 10px 4px' },
  sideJobList: { display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 360, overflowY: 'auto' },
  sideJobItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, fontSize: 12.5, color: '#525252', fontWeight: 600, textDecoration: 'none' },
  sideJobItemActive: { background: '#FFF7ED', color: '#EA580C', fontWeight: 800 },
  sideJobDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  sideJobTitle: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  // Main — flex-1 min-w-0 so it lives nicely in flex shell. Top padding kept thin since PageHeader is sticky.
  main: { flex: 1, minWidth: 0, paddingLeft: 'clamp(16px, 3vw, 28px)', paddingRight: 'clamp(16px, 3vw, 28px)', paddingTop: 0, paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 14 },
  mainHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  mainH: { fontSize: 26, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.01em' },
  mainP: { fontSize: 13.5, color: '#525252', marginTop: 4 },

  formShell: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'flex-start' },
  formCol: { display: 'flex', flexDirection: 'column' },
  sectionTitle: { fontSize: 12, fontWeight: 800, color: '#737373', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: '#525252', fontWeight: 700 },
  inp: { background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#1A1A1A', fontFamily: 'inherit' },
  hint: { fontSize: 11, color: '#737373' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

  previewCol: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 20 },
  previewLabel: { fontSize: 10.5, color: '#737373', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
  previewCard: { background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 },
  pTitle: { fontSize: 14, fontWeight: 800, color: '#1A1A1A', marginBottom: 5 },
  pMeta: { fontSize: 11.5, color: '#525252', marginTop: 2 },
  pLoc: { fontSize: 11.5, color: '#10b981', marginTop: 6 },

  err: { gridColumn: '1 / -1', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#B91C1C' },

  formFoot: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E7EB', marginTop: 8 },

  btnPrimary: { padding: '12px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#EF4444,#F97316)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 12px rgba(234,88,12,0.25)' },
  btnGhost: { padding: '12px 24px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' },
  btnDisabled: { padding: '12px 24px', borderRadius: 8, border: 'none', background: '#E5E7EB', color: '#94A3B8', fontSize: 14, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' },
  btnDanger: { padding: '12px 22px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};

const localCss = {
  fileInp: { padding: '8px 10px', fontSize: 12.5, color: '#525252', border: '1px dashed #D1D5DB', borderRadius: 7, background: '#FAFAFA', cursor: 'pointer', fontFamily: 'inherit' },
  imgRow: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff' },
  logoPreview: { height: 40, width: 40, borderRadius: 6, objectFit: 'contain', background: '#F8F8F8' },
  imgPreview: { height: 60, width: 100, borderRadius: 6, objectFit: 'cover' },
  imgRemove: { marginLeft: 'auto', padding: '5px 10px', fontSize: 11, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  uploadHint: { fontSize: 12, color: '#EA580C', fontWeight: 600, marginTop: -8, marginBottom: 14 },
  photoHint: { fontSize: 11.5, color: '#94A3B8', marginTop: -8, marginBottom: 14, fontWeight: 600 },

  // 미리보기 — 실제 /jobs 피드 카드 형태
  pvCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' },
  pvImg: { width: '100%', height: 140, objectFit: 'cover', display: 'block' },
  pvImgEmpty: { width: '100%', height: 140, background: '#F1F5F9', display: 'grid', placeItems: 'center', color: '#94A3B8', fontSize: 12.5, fontWeight: 700 },
  pvBody: { padding: 14 },
  pvCompanyRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 },
  pvLogo: { width: 20, height: 20, borderRadius: 5, objectFit: 'contain', background: '#F4F4F5' },
  pvLogoEmpty: { width: 20, height: 20, borderRadius: 5, background: '#E5E7EB' },
  pvCompany: { fontSize: 11.5, color: '#737373', fontWeight: 700 },
  pvTitle: { fontSize: 15, fontWeight: 800, color: '#1A1A1A', marginBottom: 6, lineHeight: 1.3 },
  pvSalary: { fontSize: 13, color: '#059669', fontWeight: 800, marginBottom: 7 },
  pvTags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  pvTag: { fontSize: 10.5, fontWeight: 700, color: '#525252', background: '#F1F5F9', padding: '3px 8px', borderRadius: 999 },
  pvLoc: { fontSize: 11.5, color: '#737373' },
};
