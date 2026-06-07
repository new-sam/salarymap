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
import { ImageIcon, MapPin, Building2, EyeOff, Eye, Trash2, ExternalLink, Briefcase, CalendarDays, Users } from 'lucide-react';

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

  const onDelete = async () => {
    if (!confirm('이 공고를 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    setStatus('saving');
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) { setErr(error.message); toast.error(error.message); setStatus('ready'); return; }
    toast.success('공고가 삭제되었습니다');
    router.replace('/company/jobs');
  };

  const toggleActive = async () => {
    const newStatus = origStatus === 'live' ? 'paused' : 'live';
    const { error } = await supabase.from('jobs').update({ status: newStatus, is_active: newStatus === 'live' }).eq('id', id);
    if (error) { setErr(error.message); toast.error(error.message); return; }
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
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" />

        <main style={css.main}>
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

          <form id="job-edit-form" onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
            <div className="flex flex-col">
              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mb-3">기본 정보</h2>
              <Field label="포지션명"><UInput value={form.title} onChange={e => setF('title', e.target.value)} /></Field>
              <Field label="업무 설명">
                <textarea
                  value={form.description}
                  onChange={e => setF('description', e.target.value)}
                  rows={4}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y min-h-[110px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="역할 카테고리"><SelectInput value={form.role} onChange={e => setF('role', e.target.value)}>{ROLES.map(r => <option key={r}>{r}</option>)}</SelectInput></Field>
                <Field label="근무 형태"><SelectInput value={form.type} onChange={e => setF('type', e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</SelectInput></Field>
              </div>
              <Field label="근무지"><SelectInput value={form.location} onChange={e => setF('location', e.target.value)}>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</SelectInput></Field>

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-3">경력 · 연봉</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="경력 최소 (년)"><UInput type="number" value={form.experience_min} onChange={e => setF('experience_min', e.target.value)} /></Field>
                <Field label="경력 최대 (년)"><UInput type="number" value={form.experience_max} onChange={e => setF('experience_max', e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="연봉 최소 (VND, 월)">
                  <UInput type="number" value={form.salary_min} onChange={e => setF('salary_min', e.target.value)} />
                  <div className="text-xs text-gray-500 mt-1">{Math.round(form.salary_min / 1e6)}M VND/월</div>
                </Field>
                <Field label="연봉 최대 (VND, 월)">
                  <UInput type="number" value={form.salary_max} onChange={e => setF('salary_max', e.target.value)} />
                  <div className="text-xs text-gray-500 mt-1">{Math.round(form.salary_max / 1e6)}M VND/월</div>
                </Field>
              </div>

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-3">이미지</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="회사 로고">
                  {form.logo_url ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                      <img src={form.logo_url} alt="logo" className="h-10 w-10 rounded-md object-contain bg-gray-50" />
                      <UButton type="button" variant="outline" size="sm" onClick={() => setF('logo_url', '')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">제거</UButton>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo_url')}
                      className="text-xs text-gray-700 border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50 cursor-pointer w-full" />
                  )}
                </Field>
                <Field label="공고 대표 이미지">
                  {form.image_url ? (
                    <div className="flex items-center gap-2.5 p-2.5 border border-border rounded-lg bg-white">
                      <img src={form.image_url} alt="thumbnail" className="h-14 w-24 rounded-md object-cover" />
                      <UButton type="button" variant="outline" size="sm" onClick={() => setF('image_url', '')} className="ml-auto h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">제거</UButton>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'image_url')}
                      className="text-xs text-gray-700 border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50 cursor-pointer w-full" />
                  )}
                </Field>
              </div>
              {uploading && <div className="text-xs text-primary-600 font-semibold mb-3">업로드 중...</div>}

              <h2 className="text-[12px] font-extrabold text-gray-500 uppercase tracking-[0.08em] mt-5 mb-3">스킬·복지·기타</h2>
              <Field label="기술 스택 (콤마 구분)"><UInput value={form.tech_stack} onChange={e => setF('tech_stack', e.target.value)} /></Field>
              <Field label="복지 (콤마 구분, 선택)"><UInput value={form.benefits} onChange={e => setF('benefits', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="채용 인원 (선택)"><UInput type="number" value={form.headcount} onChange={e => setF('headcount', e.target.value)} /></Field>
                <Field label="마감일 (선택)"><UInput type="date" value={form.deadline} onChange={e => setF('deadline', e.target.value)} /></Field>
              </div>
            </div>

            <aside className="bg-white border border-border rounded-2xl p-4 pb-5 flex flex-col gap-3 sticky top-[88px] shadow-soft-xs max-h-[calc(100vh-100px)] overflow-y-auto">
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-gray-500">미리보기</div>

              {/* Public job card preview — mirrors /jobs/[id] */}
              <div className="bg-white border border-border rounded-xl overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-32 object-cover block" />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-[11px] text-gray-400 font-semibold gap-2">
                    <ImageIcon className="w-3.5 h-3.5" />
                    공고 대표 이미지 영역
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
                      <div className="text-[13px] text-gray-900 font-bold truncate">{companyName || '회사명'}</div>
                      <div className="text-[11.5px] text-gray-900 font-semibold truncate">{form.location} · {form.type}</div>
                    </div>
                  </div>

                  <div className="text-[17px] font-extrabold text-foreground leading-tight tracking-tight">
                    {form.title || '포지션명'}
                  </div>

                  <div className="text-[16px] font-extrabold text-emerald-600 tabular-nums leading-none">
                    {Math.round(form.salary_min/1e6)}M – {Math.round(form.salary_max/1e6)}M VND
                  </div>

                  {(form.tech_stack || '').trim() && (
                    <div className="flex flex-wrap gap-1">
                      {form.tech_stack.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6).map(tag => (
                        <span key={tag} className="text-[11.5px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {tag}
                        </span>
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
                      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1">
                        경력
                      </div>
                      <div className="text-[13px] font-bold text-foreground tabular-nums">{form.experience_min}–{form.experience_max}년</div>
                    </div>
                    {form.headcount && (
                      <div>
                        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-gray-400 mb-1 flex items-center gap-1">
                          <Users className="w-3 h-3" />
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
                실시간 입력값이 반영됩니다. 저장 후 상단의 "공개 페이지" 버튼으로 실제 화면을 확인할 수 있습니다.
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
