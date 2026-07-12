import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import { Field, SelectInput, UploadInput, Sidebar, css } from '../new';
import { useT } from '../../../../lib/i18n';
import { apiErrorMessage } from '../../../../lib/apiErrorMessage';
import { toast } from 'sonner';
import { Button as UButton } from '../../../../components/ui/button';
import { Input as UInput } from '../../../../components/ui/input';
import { Badge as UBadge } from '../../../../components/ui/badge';
import { PageHeader } from '../../../../components/ui/page-header';
import { ImageIcon, MapPin, Building2, EyeOff, Eye, Trash2, ExternalLink, Briefcase, CalendarDays, Users, Maximize2, X as XIcon } from 'lucide-react';
import JobPreview from '../../../../components/jobs/JobPreview';
import { ROLE_GROUPS, LOCATION_OPTIONS, DEFAULT_WORK_DAYS, DEFAULT_WORK_HOURS, DEFAULT_PAID_LEAVE, DEFAULT_CONTRACT } from '../../../../constants/jobs';

const TYPES = ['remote', 'onsite', 'hybrid'];
const LOCATIONS = LOCATION_OPTIONS;

export default function EditJobPage() {
  const router = useRouter();
  const { t, lang } = useT();
  const { id } = router.query;

  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [form, setForm] = useState(null);
  const [origStatus, setOrigStatus] = useState('draft');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUser(session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name, work_days, work_hours, paid_leave)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!rec?.company_id) { setStatus('unauthed'); return; }
      const co = rec.recruiter_companies;
      setCompanyName(co?.name || '');

      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('company_id', rec.company_id)
        .maybeSingle();
      if (jobErr || !job) {
        setErr(t('company.ats.notFound'));
        setStatus('error');
        return;
      }
      // Editing is restricted to job admins — creator or anyone invited with
      // role='admin' in job_team. Interviewers can view via ATS but cannot edit.
      let canEdit = job.created_by === session.user.id;
      if (!canEdit) {
        const { data: teamRow } = await supabase
          .from('job_team')
          .select('role')
          .eq('job_id', id)
          .eq('user_id', session.user.id)
          .maybeSingle();
        canEdit = teamRow?.role === 'admin';
      }
      if (!canEdit) {
        setErr(t('company.ats.notFound'));
        setStatus('error');
        return;
      }
      setForm({
        title: job.title || '',
        description: job.description || '',
        role: job.role || 'Backend',
        type: job.type || 'hybrid',
        country: job.country || 'vietnam',
        location: job.location || 'Hồ Chí Minh',
        experience_min: job.experience_min ?? 1,
        experience_max: job.experience_max ?? 5,
        salary_min: job.salary_min ?? 30000000,
        salary_max: job.salary_max ?? 50000000,
        tech_stack: (job.tech_stack || []).join(', '),
        benefits: (job.benefits || []).join(', '),
        headcount: job.headcount ?? '',
        deadline: job.deadline || '',
        image_url: job.image_url || '',
        logo_url: job.logo_url || '',
        // 공고에 저장된 값이 없으면(구 공고) 회사 프로필 기본값으로 프리필
        work_days: job.work_days || co?.work_days || '',
        work_hours: job.work_hours || co?.work_hours || '',
        paid_leave: job.paid_leave || co?.paid_leave || '',
        contract_type: job.contract_type || '', // 공고 단위 값만 (회사 폴백 없음)
      });
      setOrigStatus(job.status || 'live');
      setStatus('ready');
    })();
  }, [id]);

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
    };
    const { error } = await supabase.from('jobs').update(payload).eq('id', id);
    if (error) { setErr(error.message); toast.error(error.message); setStatus('ready'); return; }
    toast.success(t('company.editJob.saved'));
    router.replace('/company/jobs');
  };

  const jobApiHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` };
  };

  const onDelete = async () => {
    if (!confirm(t('company.editJob.deleteConfirm'))) return;
    setStatus('saving');
    const res = await fetch('/api/company/job', { method: 'DELETE', headers: await jobApiHeaders(), body: JSON.stringify({ jobId: id }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); const msg = apiErrorMessage(j, t, 'company.editJob.deleteFailed'); setErr(msg); toast.error(msg); setStatus('ready'); return; }
    toast.success(t('company.editJob.deleted'));
    router.replace('/company/jobs');
  };

  const toggleActive = async () => {
    const newStatus = origStatus === 'live' ? 'paused' : 'live';
    const res = await fetch('/api/company/job', { method: 'PUT', headers: await jobApiHeaders(), body: JSON.stringify({ jobId: id, action: newStatus === 'live' ? 'activate' : 'deactivate' }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); const msg = apiErrorMessage(j, t, 'company.editJob.toggleFailed'); setErr(msg); toast.error(msg); return; }
    setOrigStatus(newStatus);
    toast.success(newStatus === 'live' ? t('company.editJob.activated') : t('company.editJob.deactivated'));
  };

  if (status === 'loading') return <div style={css.loading}>{t('company.loading')}</div>;
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
          <Link href="/company/jobs" style={css.btnPrimary}>{t('company.toDashboard')}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{t('company.head.editJob')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" activeJobId={id} />

        <main style={css.main} className="!h-screen !overflow-hidden !pb-0">
          <PageHeader
            title={t('company.editJob.h')}
            subtitle={(
              <span className="inline-flex items-center gap-2">
                {t('company.editJob.statusLabel')}
                <UBadge variant={origStatus === 'live' ? 'success' : 'secondary'}>
                  {origStatus === 'live' ? t('company.editJob.statusLive') : origStatus === 'paused' ? t('company.editJob.statusPaused') : origStatus}
                </UBadge>
              </span>
            )}
            right={(
              <>
                <UButton asChild variant="outline">
                  <a href={`/jobs/${id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('company.editJob.publicPage')}
                  </a>
                </UButton>
                <UButton variant="outline" onClick={toggleActive}>
                  {origStatus === 'live' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {origStatus === 'live' ? t('company.editJob.deactivate') : t('company.editJob.activate')}
                </UButton>
                <UButton variant="outline" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('company.editJob.delete')}
                </UButton>
                <div className="h-6 w-px bg-border mx-1" />
                <UButton asChild variant="outline">
                  <Link href="/company/jobs">{t('company.editJob.cancel')}</Link>
                </UButton>
                <UButton type="submit" form="job-edit-form" disabled={status === 'saving'}>
                  {status === 'saving' ? t('company.editJob.saving') : t('company.editJob.save')}
                </UButton>
              </>
            )}
          />

          {/* Form is a flex row so each column inherits the form's visible height. */}
          <form id="job-edit-form" onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 overflow-hidden">
            <div className="flex-[1.4] flex flex-col overflow-y-auto min-h-0 px-1 pb-10">
              {/* Mirrors /company/jobs/new exactly — same headers, fields, order, and i18n keys. */}
              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mb-3">{t('company.jobsnew.photoH')}</h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label={t('company.jobsnew.imageLabel')}>
                  {form.image_url ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                      <img src={form.image_url} alt="thumbnail" className="h-14 w-24 rounded-md object-cover" />
                      <UButton type="button" variant="outline" size="sm" onClick={() => setF('image_url', '')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">{t('company.remove')}</UButton>
                    </div>
                  ) : (
                    <UploadInput label={t('company.jobsnew.uploadBtn')} disabled={uploading} onFile={(f) => uploadImage(f, 'image_url')} />
                  )}
                </Field>
                <Field label={t('company.jobsnew.logoLabel')}>
                  {form.logo_url ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                      <img src={form.logo_url} alt="logo" className="h-10 w-10 rounded-md object-contain bg-gray-50" />
                      <UButton type="button" variant="outline" size="sm" onClick={() => setF('logo_url', '')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">{t('company.remove')}</UButton>
                    </div>
                  ) : (
                    <UploadInput label={t('company.jobsnew.uploadBtn')} disabled={uploading} onFile={(f) => uploadImage(f, 'logo_url')} />
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
              <div className="flex items-center justify-between flex-shrink-0 gap-2">
                <a href={`/jobs/${router.query.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary-600 hover:underline">
                  {t('company.jobsnew.previewBoardLink')}
                </a>
                <UButton type="button" size="sm" variant="outline"
                  onClick={() => { navigator.clipboard?.writeText(`https://salary-fyi.com/jobs/${router.query.id}`); toast.success(t('company.jobsnew.linkCopied')); }}
                  className="h-7 px-2.5 text-[11.5px]">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t('company.jobsnew.copyLink')}
                </UButton>
              </div>
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
