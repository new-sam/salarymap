import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import { Field, SelectInput, Sidebar, css } from '../new';
import { useT } from '../../../../lib/i18n';
import { toast } from 'sonner';
import { Button as UButton } from '../../../../components/ui/button';
import { Input as UInput } from '../../../../components/ui/input';
import { Badge as UBadge } from '../../../../components/ui/badge';
import { PageHeader } from '../../../../components/ui/page-header';
import { ImageIcon, MapPin, Building2, EyeOff, Eye, Trash2, ExternalLink, Briefcase, CalendarDays, Users, Maximize2, X as XIcon } from 'lucide-react';
import JobPreview from '../../../../components/jobs/JobPreview';

const ROLES = ['Backend', 'Frontend', 'Fullstack', 'Mobile', 'Data', 'DevOps', 'PM', 'Design', 'QA'];
const TYPES = ['remote', 'onsite', 'hybrid'];
const LOCATIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];

export default function EditJobPage() {
  const router = useRouter();
  const { t } = useT();
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
        .select('company_id, recruiter_companies(name)')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!rec?.company_id) { setStatus('unauthed'); return; }
      setCompanyName(rec.recruiter_companies?.name || '');

      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('company_id', rec.company_id)
        .maybeSingle();
      if (jobErr || !job) {
        setErr('공고를 찾을 수 없거나 접근 권한이 없습니다.');
        setStatus('error');
        return;
      }
      // Editing is restricted to the job owner; team members can view via ATS
      // but cannot edit the posting itself.
      if (job.created_by !== session.user.id) {
        setErr('공고를 찾을 수 없거나 접근 권한이 없습니다.');
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
      if (error) { setErr('이미지 업로드 실패: ' + error.message); return; }
      const { data } = supabase.storage.from('job-images').getPublicUrl(path);
      setForm(prev => ({ ...prev, [field]: data.publicUrl }));
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) { setErr('포지션명을 입력해 주세요'); return; }
    if (!form.description.trim()) { setErr('업무 설명을 입력해 주세요'); return; }
    if (Number(form.salary_min) >= Number(form.salary_max)) { setErr('연봉 최소가 최대보다 작아야 합니다'); return; }
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
    };
    const { error } = await supabase.from('jobs').update(payload).eq('id', id);
    if (error) { setErr(error.message); toast.error(error.message); setStatus('ready'); return; }
    toast.success('변경사항 저장됨');
    router.replace('/company/jobs');
  };

  const jobApiHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` };
  };

  const onDelete = async () => {
    if (!confirm('이 공고를 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    setStatus('saving');
    const res = await fetch('/api/company/job', { method: 'DELETE', headers: await jobApiHeaders(), body: JSON.stringify({ jobId: id }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'error'); toast.error(j.error || '삭제 실패'); setStatus('ready'); return; }
    toast.success('공고가 삭제되었습니다');
    router.replace('/company/jobs');
  };

  const toggleActive = async () => {
    const newStatus = origStatus === 'live' ? 'paused' : 'live';
    const res = await fetch('/api/company/job', { method: 'PUT', headers: await jobApiHeaders(), body: JSON.stringify({ jobId: id, action: newStatus === 'live' ? 'activate' : 'deactivate' }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'error'); toast.error(j.error || '변경 실패'); return; }
    setOrigStatus(newStatus);
    toast.success(newStatus === 'live' ? '공고가 활성화 되었습니다' : '공고가 비활성화 되었습니다');
  };

  if (status === 'loading') return <div style={css.loading}>Loading…</div>;
  if (status === 'unauthed') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>로그인 필요</h1>
          <Link href="/company/signup" style={css.btnPrimary}>로그인 / 가입</Link>
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>접근 불가</h1>
          <p style={css.cardP}>{err}</p>
          <Link href="/company/jobs" style={css.btnPrimary}>공고 목록으로</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>공고 수정 · FYI</title></Head>
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

            {/* Preview column — JobPreview faithfully mirrors /jobs/[id] layout. */}
            <aside className="flex-1 overflow-y-auto min-h-0 pl-2 pr-1 pb-10 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-gray-500">{t('company.jobsnew.previewLabel')}</div>
                <UButton type="button" size="sm" variant="outline" onClick={() => setPreviewFull(true)} className="h-7 px-2.5 text-[11.5px]">
                  <Maximize2 className="w-3.5 h-3.5" />
                  {t('company.jobsnew.previewFull')}
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
