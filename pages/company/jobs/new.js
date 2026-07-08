import { useState, useEffect, Fragment } from 'react';
import { color as tc, font as tf, space as ts, radius as tr, shadow as tsh, motion as tm } from '../../../lib/theme';
import { cn } from '../../../lib/cn';
import { Plus, Home, CalendarDays, ImageIcon, MapPin, Building2, Briefcase, Users as UsersIcon, CheckSquare, Maximize2, X as XIcon, Settings } from 'lucide-react';
import JobPreview from '../../../components/jobs/JobPreview';
import { nextActionFor } from '../../../lib/smart-hint';
import { loadAccessibleJobIds, loadJobRoles } from '../../../lib/company-access';
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
import { ROLE_GROUPS, LOCATION_OPTIONS, DEFAULT_WORK_DAYS, DEFAULT_WORK_HOURS, DEFAULT_PAID_LEAVE, DEFAULT_CONTRACT } from '../../../constants/jobs';

const TYPES = ['remote', 'onsite', 'hybrid'];
const LOCATIONS = LOCATION_OPTIONS; // 베트남 주요 도시/성 확장

const EMPTY = {
  title: '', description: '', role: 'Backend', type: 'hybrid', country: 'vietnam',
  location: 'Hồ Chí Minh', experience_min: 1, experience_max: 5,
  salary_min: 30000000, salary_max: 50000000, tech_stack: '', benefits: '',
  headcount: '', deadline: '',
  image_url: '', logo_url: '',
  work_days: '', work_hours: '', paid_leave: '', contract_type: '',
};

export default function NewJobPage() {
  const router = useRouter();
  const { t, lang } = useT();
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
        .select('company_id, full_name, recruiter_companies(name, logo_url, work_days, work_hours, paid_leave)')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!rec?.company_id) {
        setTmpFullName(rec?.full_name || '');
        setStatus('needs_onboarding');
        return;
      }
      setCompanyId(rec.company_id);
      const co = rec.recruiter_companies;
      setCompanyName(co?.name || '');
      // 회사 프로필에 저장된 로고·근무정보를 새 공고 폼 기본값으로 프리필 (매번 재입력 방지).
      // 이 공고만 다르게 하려면 폼에서 수정하면 됨.
      setForm(prev => ({
        ...prev,
        logo_url: co?.logo_url || prev.logo_url,
        work_days: co?.work_days || prev.work_days,
        work_hours: co?.work_hours || prev.work_hours,
        paid_leave: co?.paid_leave || prev.paid_leave,
        // contract_type 은 회사 단위 기본값을 두지 않음 — 공고마다 정규직/계약직/인턴이
        // 다르므로 폼에서 직접 지정(미입력 시 상세페이지에서 기본값 폴백).
      }));
      setStatus('ready');
    })();
  }, []);

  const setF = (k, v) => setForm({ ...form, [k]: v });

  const [uploading, setUploading] = useState(false);
  const [previewFull, setPreviewFull] = useState(false);
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

    // 내부(likelion) 계정은 즉시 게시, 외부 기업은 어드민 승인 대기
    const submitDomain = (user?.email || '').split('@')[1]?.toLowerCase();
    const isInternal = submitDomain === 'likelion.net';

    const payload = {
      title: form.title.trim(),
      company: companyName,
      company_id: companyId,
      status: isInternal ? 'live' : 'pending_review',
      is_active: isInternal,
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
      work_days: form.work_days.trim() || null,
      work_hours: form.work_hours.trim() || null,
      paid_leave: form.paid_leave.trim() || null,
      contract_type: form.contract_type.trim() || null,
      source: 'company_self',
    };

    const { data, error } = await supabase.from('jobs').insert(payload).select('id').single();
    if (error) { setErr(error.message); setStatus('ready'); return; }
    // 작성자를 그 공고의 공고 관리자(admin)로 등록. 정책: "누구든 새 공고를
    // 만들면 그 공고의 공고 관리자가 됨". 실패해도 공고 생성 자체는 성공으로
    // 처리한다 (jobs.created_by 로 fallback 게이팅됨 — job-team-role.js 참고).
    if (data?.id && user?.id) {
      await supabase
        .from('job_team')
        .upsert(
          { job_id: data.id, user_id: user.id, role: 'admin', added_by: user.id },
          { onConflict: 'job_id,user_id' }
        );
    }
    // 기업 공고 등록 알림 (베스트에포트) — 외부=승인대기 메일+Slack, 내부=Slack
    if (data?.id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/admin/notify-pending-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ jobId: data.id }),
        });
      } catch (_) {}
    }
    toast.success(isInternal ? t('company.jobsnew.publish') : t('company.jobsnew.pendingReview'));
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

        <main style={css.main} className="!h-screen !overflow-hidden !pb-0">
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

          {/* Form is a flex row so each column gets the form's full visible
              height. `min-h-0` on every child lets overflow-y-auto engage. */}
          <form id="job-new-form" onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 overflow-hidden">
            <div className="flex-[1.4] flex flex-col overflow-y-auto min-h-0 px-1 pb-10">
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
                    {ROLE_GROUPS.map(g => (
                      <optgroup key={g.key} label={g.label[lang] || g.label.en}>
                        {g.roles.map(r => <option key={r.value} value={r.value}>{r.label[lang] || r.label.en}</option>)}
                      </optgroup>
                    ))}
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

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-1">{t('company.jobsnew.workH')}</h2>
              <div className="text-xs text-gray-400 font-semibold mb-3">{t('company.jobsnew.workHint')}</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('company.jobsnew.workDays')}>
                  <UInput value={form.work_days} onChange={e => setF('work_days', e.target.value)} placeholder={DEFAULT_WORK_DAYS} />
                </Field>
                <Field label={t('company.jobsnew.workHours')}>
                  <UInput value={form.work_hours} onChange={e => setF('work_hours', e.target.value)} placeholder={DEFAULT_WORK_HOURS} />
                </Field>
                <Field label={t('company.jobsnew.paidLeave')}>
                  <UInput value={form.paid_leave} onChange={e => setF('paid_leave', e.target.value)} placeholder={DEFAULT_PAID_LEAVE} />
                </Field>
                <Field label={t('company.jobsnew.contract')}>
                  <UInput value={form.contract_type} onChange={e => setF('contract_type', e.target.value)} placeholder={DEFAULT_CONTRACT} />
                </Field>
              </div>

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
                <div className="text-xs text-gray-500 mt-1">{t('company.jobsnew.techHint')}</div>
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

            {/* Preview column — JobPreview faithfully mirrors /jobs/[id] layout. */}
            <aside className="flex-1 overflow-y-auto min-h-0 pl-2 pr-1 pb-10 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-gray-500">{t('company.jobsnew.previewLabel')}</div>
                <UButton type="button" size="sm" variant="outline" onClick={() => setPreviewFull(true)} className="h-7 px-2.5 text-[11.5px]">
                  <Maximize2 className="w-3.5 h-3.5" />
                  {t('company.jobsnew.previewFull')}
                </UButton>
              </div>
              <a href="/jobs" target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary-600 hover:underline">
                {t('company.jobsnew.previewBoardLink')}
              </a>
              <JobPreview form={form} companyName={companyName} />
            </aside>

            {err && (
              <div className="col-span-full rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold">{err}</div>
            )}
          </form>
        </main>

        {previewFull && (
          <div
            className="fixed inset-0 z-50 bg-gray-900/55 backdrop-blur-[2px] overflow-y-auto"
            onClick={() => setPreviewFull(false)}
          >
            <div className="min-h-full flex items-start justify-center py-8 px-4">
              <div className="relative w-full max-w-[760px]" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setPreviewFull(false)}
                  className="absolute -top-2 right-0 w-9 h-9 rounded-full bg-white shadow-md border border-border flex items-center justify-center text-gray-700 hover:bg-gray-50"
                  title={t('company.jobsnew.previewClose')}
                >
                  <XIcon className="w-4 h-4" />
                </button>
                <JobPreview form={form} companyName={companyName} fullscreen />
              </div>
            </div>
          </div>
        )}
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
  // Counts/jobs hydrate from sessionStorage AFTER mount (inside useEffect)
  // to avoid SSR/CSR mismatch — initial render must equal server's empty state.
  const [jobs, setJobs] = useState([]);
  const [todoCount, setTodoCount] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);

  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem('fyi.sidebar.v1') || 'null');
      if (cached) {
        setJobs(cached.jobs || []);
        setTodoCount(cached.todoCount || 0);
        setInterviewCount(cached.interviewCount || 0);
      }
    } catch {}
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!rec?.company_id) return;
      // Per-recruiter scoping: only show jobs the user owns or was invited to,
      // not every job in the workspace. Shared company tenancy (likelion.net)
      // doesn't imply visibility.
      const accessibleIds = await loadAccessibleJobIds(session.user.id, rec.company_id);
      let jobsData = [];
      if (accessibleIds.size > 0) {
        const { data } = await supabase
          .from('jobs')
          .select('id, title, status, created_by, is_active')
          .in('id', Array.from(accessibleIds))
          .order('created_at', { ascending: true });
        jobsData = data || [];
      }
      setJobs(jobsData);

      // To-do + interview counts — re-uses the same nextActionFor logic the to-do page renders.
      let nextTodoCount = 0;
      let nextInterviewCount = 0;
      try {
        const jobIds = (jobsData || []).map(j => j.id);
        // To-do badge only counts actions on active jobs — matches /company/todo.
        // Paused/closed jobs contribute zero actions. Interview count still spans
        // all jobs since a scheduled interview is a real event regardless of
        // whether the posting is currently active.
        const activeJobIds = new Set((jobsData || []).filter(j => j.is_active).map(j => j.id));
        // Role lookup — admin 이면 owner 흐름(advance/메일 액션 포함), 면접관이면 evaluate-only.
        const jobRoles = await loadJobRoles(session.user.id, rec.company_id);
        if (jobIds.length > 0) {
          // Include rejected apps too — they still drive a to-do action
          // ("send the reject mail") until that mail is sent, so the sidebar
          // count must match the to-do page's count (which doesn't filter).
          const { data: apps } = await supabase
            .from('job_applications')
            .select('id, job_id, status, interview_at, rejected_at, rejected_at_stage')
            .in('job_id', jobIds);
          const nowMs = Date.now();
          // Upcoming-interview count excludes rejected candidates — their
          // scheduled interview no longer counts as a future event.
          nextInterviewCount = (apps || []).filter(a => !a.rejected_at && a.interview_at && new Date(a.interview_at).getTime() > nowMs).length;
          const appIds = (apps || []).map(a => a.id);
          const evalsByApp = {};
          const mailsByApp = {};
          if (appIds.length > 0) {
            // Parallelize evals + mails — these two queries are independent.
            const [evalsRes, mailsRes] = await Promise.all([
              supabase.from('application_evaluations').select('application_id, stage').in('application_id', appIds),
              supabase.from('recruiter_mail_log').select('application_id, template_key').in('application_id', appIds),
            ]);
            (evalsRes.data || []).forEach(e => {
              (evalsByApp[e.application_id] ||= []).push(e);
            });
            (mailsRes.data || []).forEach(m => {
              (mailsByApp[m.application_id] ||= []).push(m);
            });
          }
          for (const app of (apps || [])) {
            if (!activeJobIds.has(app.job_id)) continue;
            const isOwner = jobRoles.get(app.job_id) === 'admin';
            const action = nextActionFor({
              app,
              evals: evalsByApp[app.id] || [],
              mailLog: mailsByApp[app.id] || [],
              isOwner,
              t,
            });
            if (action) nextTodoCount++;
          }
        }
        setTodoCount(nextTodoCount);
        setInterviewCount(nextInterviewCount);
        // Persist for instant paint on the next navigation.
        try {
          sessionStorage.setItem('fyi.sidebar.v1', JSON.stringify({
            jobs: jobsData || [],
            todoCount: nextTodoCount,
            interviewCount: nextInterviewCount,
          }));
        } catch {}
      } catch (e) {
        console.error('[Sidebar] count refresh failed:', e);
      }
    })();
    // Re-run when lang changes so Smart Hint–driven todo count picks up
    // the new language (nextActionFor uses t internally).
  }, [t]);

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
          href="/company/todo"
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors',
            isActive('todo')
              ? 'bg-primary-500/15 text-primary-300'
              : 'text-gray-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span className="flex-1">{t('company.sidebar.todo')}</span>
          {todoCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[11.5px] font-extrabold tabular-nums">
              {t('company.unit.items', { n: todoCount })}
            </span>
          )}
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
          <span className="flex-1">{t('company.sidebar.calendar')}</span>
          {interviewCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[11.5px] font-extrabold tabular-nums">
              {t('company.unit.items', { n: interviewCount })}
            </span>
          )}
        </Link>
        <Link
          href="/company/settings"
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors',
            isActive('settings')
              ? 'bg-primary-500/15 text-primary-300'
              : 'text-gray-300 hover:bg-white/5 hover:text-white'
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          {t('company.sidebar.settings')}
        </Link>
      </nav>

      {/* Always render the section skeleton — 내 공고 / 활성화된 공고 / 비활성화된 공고
          headers stay visible even when the recruiter has zero jobs so the
          left rail doesn't look broken. Each group falls back to "—". */}
      {(() => {
        // Approval policy is dropped for this sprint — no more 'pending' group.
        // Legacy pending_review jobs collapse into 'inactive'.
        const groupOf = (s) => s === 'live' ? 'active' : 'inactive';
        const grouped = { active: [], inactive: [] };
        jobs.forEach(j => { grouped[groupOf(j.status)].push(j); });
        return (
          <>
            {/* Section divider with title — myJobs */}
            <div className="h-px bg-white/15 my-3 mx-1" />
            <div className="px-2.5 pt-0.5 pb-1.5 text-[11.5px] font-extrabold text-gray-400 uppercase tracking-[0.08em]">
              {t('company.sidebar.myJobs', { n: jobs.length })}
            </div>
            <div className="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto">
              {['active', 'inactive'].map(g => (
                <Fragment key={g}>
                  <div className="px-2.5 pt-1.5 pb-0.5 text-[12px] font-bold text-gray-300">
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
  pLoc: { fontSize: 11.5, color: '#6B7684', marginTop: 6 },

  err: { gridColumn: '1 / -1', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#B91C1C' },

  formFoot: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E7EB', marginTop: 8 },

  btnPrimary: { padding: '12px 24px', borderRadius: 8, border: 'none', background: '#EA580C', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 12px rgba(234,88,12,0.18)' },
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
  pvSalary: { fontSize: 13, color: '#EA580C', fontWeight: 800, marginBottom: 7 },
  pvTags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  pvTag: { fontSize: 10.5, fontWeight: 700, color: '#525252', background: '#F1F5F9', padding: '3px 8px', borderRadius: 999 },
  pvLoc: { fontSize: 11.5, color: '#737373' },
};
