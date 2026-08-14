import { useState, useEffect, useRef, Fragment } from 'react';
import { color as tc, font as tf, space as ts, radius as tr, shadow as tsh, motion as tm } from '../../../lib/theme';
import { cn } from '../../../lib/cn';
import { Plus, Home, CalendarDays, ImageIcon, MapPin, Building2, Briefcase, Users as UsersIcon, CheckSquare, Maximize2, X as XIcon, Settings, ChevronDown, ChevronRight, Check } from 'lucide-react';
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
const EXP_MAX = 15;          // 경력 슬라이더 상한 (년)
const SAL_SLIDER_MAX = 150;  // 급여 슬라이더 상한 (백만 ₫) — 직접 입력으로 초과 가능
// 표시 라벨은 번역 키로 — 값(value)은 DB 저장용 원본 그대로.
const TYPE_KEYS = { remote: 'jobs.typeRemote', onsite: 'jobs.typeOnsite', hybrid: 'jobs.typeHybrid' };
const LOCATIONS = LOCATION_OPTIONS; // 베트남 주요 도시/성 확장

// 자체 온보딩은 이메일 도메인으로 회사를 추정/매칭하므로 free-mail 은 차단.
// (어드민 발급 계정은 recruiter_users 가 이미 연결돼 있어 이 경로를 타지 않음.)
// pages/company/index.js 의 completeCompanySetup 과 동일한 정책.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'naver.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'daum.net', 'kakao.com', 'protonmail.com',
]);

const EMPTY = {
  title: '', description: '', responsibilities: '', requirements: '', preferred: '',
  role: '', type: 'hybrid', country: 'vietnam',
  location: 'Hồ Chí Minh', experience_min: 1, experience_max: 5,
  salary_min: 30000000, salary_max: 50000000, salary_negotiable: false, tech_stack: '', benefits: '',
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

  const setF = (k, v) => {
    setForm({ ...form, [k]: v });
    // 입력을 고치기 시작하면 필드 에러 표시를 걷어낸다.
    if (err) { setErr(''); setErrField(null); }
  };

  const [uploading, setUploading] = useState(false);
  const [previewFull, setPreviewFull] = useState(false);
  // 선택 필드(근무조건·스킬·사진)는 접어서 최초 노출 필드 수를 줄인다.
  const [showMore, setShowMore] = useState(false);
  // 직군은 옵션이 많아 드롭다운 대신 2단(대분류→소분류) 모달로 고른다.
  const [roleModal, setRoleModal] = useState(false);
  const [roleGroup, setRoleGroup] = useState(ROLE_GROUPS[0]?.key);
  const openRoleModal = () => {
    // 이미 선택된 직군이 있으면 그 직군이 속한 대분류를 펼친 채로 연다.
    const g = ROLE_GROUPS.find(x => x.roles.some(r => r.value === form.role));
    setRoleGroup(g?.key || ROLE_GROUPS[0]?.key);
    setRoleModal(true);
  };
  const roleLabelOf = (v) => {
    for (const g of ROLE_GROUPS) {
      const r = g.roles.find(x => x.value === v);
      if (r) return r.label[lang] || r.label.en;
    }
    return '';
  };
  // 토스식 단계 입력 — 한 번에 한 묶음만 보여주고, 단계별 검증 후 진행.
  const [step, setStep] = useState(0);
  // 에러는 박스 대신 해당 필드의 빨간 테두리 + 필드 아래 안내 문구로 표시.
  const [errField, setErrField] = useState(null);
  const validateStep = (s) => {
    if (s === 0 && !form.title.trim()) return ['title', t('company.err.titleRequired')];
    if (s === 0 && !form.role) return ['role', t('company.err.roleRequired')];
    if (s === 1 && !form.salary_negotiable && Number(form.salary_min) >= Number(form.salary_max)) return ['salary', t('company.err.salaryRange')];
    if (s === 2 && !form.responsibilities.trim()) return ['responsibilities', t('company.err.respRequired')];
    if (s === 2 && !form.requirements.trim()) return ['requirements', t('company.err.reqRequired')];
    if (s === 3 && !form.description.trim()) return ['description', t('company.err.descRequired')];
    return null;
  };
  const goNext = () => {
    const v = validateStep(step);
    if (v) { setErrField(v[0]); setErr(v[1]); return; }
    setErr(''); setErrField(null);
    setStep(s => s + 1);
  };
  // 필수 미기입/오류가 있으면 다음(게재) 버튼 비활성화. 검증 로직과 동일 기준.
  const stepComplete = (s) => {
    if (s === 0) return !!form.title.trim() && !!form.role;
    if (s === 1) return form.salary_negotiable
      || (form.salary_min > 0 && form.salary_max > 0 && Number(form.salary_min) < Number(form.salary_max));
    if (s === 2) return !!form.responsibilities.trim() && !!form.requirements.trim();
    if (s === 3) return !!form.description.trim();
    return true;
  };
  // 급여 직접 입력은 역전(최소≥최대)이 가능하므로 입력 즉시 인라인 경고.
  // 둘 다 값이 있을 때만 검사 — 한쪽을 지우고 다시 치는 중엔 조용히 둔다.
  const setSalary = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (!next.salary_negotiable && next.salary_min > 0 && next.salary_max > 0
        && Number(next.salary_min) >= Number(next.salary_max)) {
      setErrField('salary'); setErr(t('company.err.salaryRange'));
    } else if (err) { setErr(''); setErrField(null); }
  };
  // 최종 제출에서 걸리면 해당 필드가 있는 단계로 점프해 인라인 에러를 보여준다.
  const failAt = (field, msg, s) => {
    setErrField(field); setErr(msg);
    if (s !== undefined && s !== step) setStep(s);
  };
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
    if (!emailDomain || FREE_MAIL_DOMAINS.has(emailDomain)) { setErr(t('company.err.notVerified')); return; }
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
    // 마지막 단계 전에는 Enter/제출이 "다음"으로 동작 — 토스식 진행.
    if (step < 3) { goNext(); return; }
    if (!form.title.trim()) { failAt('title', t('company.err.titleRequired'), 0); return; }
    if (!form.role) { failAt('role', t('company.err.roleRequired'), 0); return; }
    if (!form.responsibilities.trim()) { failAt('responsibilities', t('company.err.respRequired'), 2); return; }
    if (!form.requirements.trim()) { failAt('requirements', t('company.err.reqRequired'), 2); return; }
    if (!form.description.trim()) { failAt('description', t('company.err.descRequired'), 3); return; }
    if (!form.salary_negotiable && Number(form.salary_min) >= Number(form.salary_max)) { failAt('salary', t('company.err.salaryRange'), 1); return; }
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
      responsibilities: form.responsibilities.trim() || null,
      requirements: form.requirements.trim() || null,
      preferred: form.preferred.trim() || null,
      role: form.role, type: form.type, country: form.country, location: form.location,
      experience_min: Number(form.experience_min), experience_max: Number(form.experience_max),
      // 급여 협의: 0-0 저장 → 지면에서는 '협의 가능'으로 표시 (utils/salary.js isSalaryNegotiable)
      salary_min: form.salary_negotiable ? 0 : Number(form.salary_min),
      salary_max: form.salary_negotiable ? 0 : Number(form.salary_max),
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
    // /company/jobs 는 /company 로 넘기는 껍데기 — 직접 보내 이중 리다이렉트 제거
    router.replace('/company');
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
                {step === 3 && (
                  <UButton type="submit" form="job-new-form" disabled={status === 'saving' || !stepComplete(3)}>
                    {status === 'saving' ? t('company.saving') : t('company.jobsnew.publish')}
                  </UButton>
                )}
              </>
            )}
          />

          {/* Form is a flex row so each column gets the form's full visible
              height. `min-h-0` on every child lets overflow-y-auto engage. */}
          <form id="job-new-form" onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 overflow-hidden">
            {/* [scrollbar-gutter:stable] + pr-3 keep the scrollbar out of the
                content; the white card gives fields a surface instead of
                sitting bare on the gray page background. */}
            <div className="flex-[1.4] overflow-y-auto min-h-0 pr-3 pb-10 [scrollbar-gutter:stable]">
            <div className="bg-white border border-border rounded-xl shadow-soft-xs p-5 flex flex-col">
              {/* 단계 제목 + 진행 바 */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[17px] font-bold text-gray-900">{t(`company.jobsnew.stepTitle${step + 1}`)}</h2>
                <span className="text-[12px] font-semibold text-gray-400 tabular-nums">{step + 1} / 4</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full mb-6 overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / 4) * 100}%` }} />
              </div>

              {step === 0 && (<>
              <Field label={t('company.jobsnew.title')} required error={errField === 'title' ? err : undefined}>
                <UInput value={form.title} onChange={e => setF('title', e.target.value)} placeholder="ex) Senior Backend Engineer"
                  className={errField === 'title' ? 'border-red-400 focus-visible:ring-red-300' : undefined} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('company.jobsnew.role')} error={errField === 'role' ? err : undefined}>
                  <button type="button" onClick={openRoleModal}
                    className={cn('flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                      errField === 'role' ? 'border-red-400' : 'border-input')}>
                    <span className={form.role ? 'text-gray-900' : 'text-gray-400'}>
                      {form.role ? roleLabelOf(form.role) : t('company.jobsnew.rolePh')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </Field>
                <Field label={t('company.jobsnew.type')}>
                  <StyledSelect value={form.type}
                    onChange={v => {
                      // 원격 선택 시 근무지는 'Remote'로 고정하고 필드를 숨긴다.
                      // 출근형으로 되돌리면 기본 도시로 복원.
                      setForm(f => ({
                        ...f, type: v,
                        location: v === 'remote' ? 'Remote' : (f.location === 'Remote' ? 'Hồ Chí Minh' : f.location),
                      }));
                      if (err) { setErr(''); setErrField(null); }
                    }}
                    options={TYPES.map(tp => ({ value: tp, label: t(TYPE_KEYS[tp]) }))} />
                </Field>
              </div>

              {/* 원격 근무는 근무지 필드 자체가 무의미 — 숨기고 'Remote'로 저장 */}
              {form.type !== 'remote' && (
                <Field label={t('company.jobsnew.location')}>
                  <StyledSelect value={form.location} onChange={v => setF('location', v)}
                    options={LOCATIONS.filter(l => l !== 'Remote').map(l => ({ value: l, label: t(`company.loc.${l}`) }))} />
                </Field>
              )}

              </>)}

              {step === 1 && (<>

              <Field label={t('company.jobsnew.expLabel')}>
                <div className="text-[13px] font-semibold text-primary-600 tabular-nums">
                  {Number(form.experience_min) === 0 ? t('company.jobsnew.expNew') : t('company.jobsnew.expYears', { n: form.experience_min })}
                  {' – '}
                  {Number(form.experience_max) === 0 ? t('company.jobsnew.expNew') : t('company.jobsnew.expYears', { n: form.experience_max })}
                </div>
                <RangeSlider min={0} max={EXP_MAX} valueMin={Number(form.experience_min)} valueMax={Number(form.experience_max)}
                  onChange={([a, b]) => {
                    setForm(f => ({ ...f, experience_min: a, experience_max: b }));
                    if (err) { setErr(''); setErrField(null); }
                  }} />
              </Field>

              {/* 급여: 경력과 같은 문법의 라벨 있는 그룹 — 범위 텍스트 + 슬라이더 + 직접 입력. DB엔 원 단위 그대로. */}
              <div className="h-px bg-border my-4" />
              <Field label={t('company.jobsnew.salaryLabel')}>
                <div className={form.salary_negotiable ? 'opacity-40 pointer-events-none' : ''}>
                  <div className="text-[13px] font-semibold text-primary-600 tabular-nums">
                    ₫{Math.round((form.salary_min || 0) / 1e6)}M – ₫{Math.round((form.salary_max || 0) / 1e6)}M
                  </div>
                  <RangeSlider min={0} max={SAL_SLIDER_MAX}
                    valueMin={Math.min(Math.round((form.salary_min || 0) / 1e6), SAL_SLIDER_MAX)}
                    valueMax={Math.min(Math.round((form.salary_max || 0) / 1e6), SAL_SLIDER_MAX)}
                    onChange={([a, b]) => {
                      setForm(f => ({ ...f, salary_min: a * 1e6, salary_max: b * 1e6 }));
                      if (err) { setErr(''); setErrField(null); }
                    }} />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <div className="text-[12px] font-semibold text-gray-500 mb-1">{t('company.jobsnew.salMinShort')}</div>
                    <div className="relative">
                      <UInput type="number" min={0} value={form.salary_min ? form.salary_min / 1e6 : ''}
                        onChange={e => setSalary('salary_min', Math.round(Number(e.target.value || 0) * 1e6))}
                        disabled={form.salary_negotiable}
                        className={cn('pr-14', errField === 'salary' && 'border-red-400 focus-visible:ring-red-300')} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-gray-400 pointer-events-none">M ₫</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 tabular-nums">₫{Number(form.salary_min || 0).toLocaleString()}/{t('company.jobsnew.perMonth')}</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-gray-500 mb-1">{t('company.jobsnew.salMaxShort')}</div>
                    <div className="relative">
                      <UInput type="number" min={0} value={form.salary_max ? form.salary_max / 1e6 : ''}
                        onChange={e => setSalary('salary_max', Math.round(Number(e.target.value || 0) * 1e6))}
                        disabled={form.salary_negotiable}
                        className={cn('pr-14', errField === 'salary' && 'border-red-400 focus-visible:ring-red-300')} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-gray-400 pointer-events-none">M ₫</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 tabular-nums">₫{Number(form.salary_max || 0).toLocaleString()}/{t('company.jobsnew.perMonth')}</div>
                  </div>
                </div>
              </Field>
              {errField === 'salary' && (
                <div className="text-[12px] text-red-600 font-medium mt-1">{err}</div>
              )}

              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.salary_negotiable} onChange={e => setF('salary_negotiable', e.target.checked)} className="accent-[var(--sm-primary)]" />
                <span className="text-sm text-gray-700">{t('company.jobsnew.negotiable')}</span>
              </label>
              {form.salary_negotiable && (
                <div className="text-xs text-gray-500 mt-1">{t('company.jobsnew.negotiableHint')}</div>
              )}

              </>)}

              {step === 2 && (<>
              <Field label={t('company.jobsnew.respLabel')} required error={errField === 'responsibilities' ? err : undefined}>
                <textarea value={form.responsibilities} onChange={e => setF('responsibilities', e.target.value)} rows={4}
                  placeholder={t('company.jobsnew.respPh')}
                  className={cn('flex w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y min-h-[110px] focus:outline-none focus:ring-2 focus:ring-offset-1',
                    errField === 'responsibilities' ? 'border-red-400 focus:ring-red-300' : 'border-input focus:ring-ring')} />
              </Field>

              <Field label={t('company.jobsnew.reqLabel')} required error={errField === 'requirements' ? err : undefined}>
                <textarea value={form.requirements} onChange={e => setF('requirements', e.target.value)} rows={4}
                  placeholder={t('company.jobsnew.reqPh')}
                  className={cn('flex w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y min-h-[110px] focus:outline-none focus:ring-2 focus:ring-offset-1',
                    errField === 'requirements' ? 'border-red-400 focus:ring-red-300' : 'border-input focus:ring-ring')} />
              </Field>

              <Field label={t('company.jobsnew.prefLabel')}>
                <textarea value={form.preferred} onChange={e => setF('preferred', e.target.value)} rows={3}
                  placeholder={t('company.jobsnew.prefPh')}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1" />
              </Field>

              </>)}

              {step === 3 && (<>
              <Field label={t('company.jobsnew.descLabel')} required error={errField === 'description' ? err : undefined}>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={3}
                  placeholder={t('company.jobsnew.descPh')}
                  className={cn('flex w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-medium leading-relaxed resize-y min-h-[84px] focus:outline-none focus:ring-2 focus:ring-offset-1',
                    errField === 'description' ? 'border-red-400 focus:ring-red-300' : 'border-input focus:ring-ring')} />
              </Field>

              {/* 선택 필드 접기 — 근무조건·스킬·마감·사진은 없어도 게재 가능 */}
              <button type="button" onClick={() => setShowMore(v => !v)}
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-gray-600 hover:text-gray-900 self-start">
                <ChevronDown className={cn('w-4 h-4 transition-transform', showMore && 'rotate-180')} />
                {t('company.jobsnew.moreH')}
              </button>

              {showMore && (<>
              <h2 className="text-[12px] font-bold text-gray-500 mt-5 mb-1">{t('company.jobsnew.workH')}</h2>
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

              <h2 className="text-[12px] font-bold text-gray-500 mt-5 mb-3">{t('company.jobsnew.skillH')}</h2>

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

              <h2 className="text-[12px] font-bold text-gray-500 mt-5 mb-3">{t('company.jobsnew.photoH')}</h2>

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
                : (
                  <div className="text-xs text-gray-400 font-semibold mb-5">
                    {t('company.jobsnew.photoHint')}{' '}
                    <Link href="/company/settings" className="text-primary-600 hover:underline">{t('company.jobsnew.profileHint')}</Link>
                  </div>
                )}
              </>)}
              </>)}

              {/* 필드에 귀속되지 않는 에러(API 실패 등)만 박스로 */}
              {err && !errField && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 font-semibold mt-4">{err}</div>
              )}

              {/* 이전/다음 내비게이션 — 마지막 단계에서만 게재 버튼 */}
              <div className="flex items-center justify-between mt-5">
                {step > 0 ? (
                  <UButton type="button" variant="outline" onClick={() => { setErr(''); setStep(s => s - 1); }}>
                    {t('company.jobsnew.prev')}
                  </UButton>
                ) : <span />}
                {step < 3 ? (
                  <UButton type="button" onClick={goNext} disabled={!stepComplete(step)}>{t('company.jobsnew.next')}</UButton>
                ) : (
                  <UButton type="submit" disabled={status === 'saving' || !stepComplete(3)}>
                    {status === 'saving' ? t('company.saving') : t('company.jobsnew.publish')}
                  </UButton>
                )}
              </div>
            </div>
            </div>

            {/* Preview column — JobPreview faithfully mirrors /jobs/[id] layout. */}
            <aside className="flex-1 overflow-y-auto min-h-0 pl-2 pr-3 pb-10 flex flex-col gap-3 [scrollbar-gutter:stable]">
              <div className="flex items-center justify-between flex-shrink-0">
                <div className="text-[10.5px] font-bold text-gray-500">{t('company.jobsnew.previewLabel')}</div>
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

          </form>
        </main>

        {/* 직군 선택 모달 — 대분류 섹션 + 칩, 클릭 즉시 선택·닫힘 */}
        {roleModal && (
          <div className="fixed inset-0 z-50 bg-gray-900/55 backdrop-blur-[2px] overflow-y-auto" onClick={() => setRoleModal(false)}>
            <div className="min-h-full flex items-start justify-center py-10 px-4">
              <div className="relative w-full max-w-[560px] bg-white rounded-xl border border-border shadow-soft-lg p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-gray-900">{t('company.jobsnew.roleModalTitle')}</h3>
                  <button type="button" onClick={() => setRoleModal(false)}
                    className="w-8 h-8 rounded-md hover:bg-gray-100 grid place-items-center text-gray-500" aria-label="close">
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
                {/* 2단 선택: 좌측 대분류(10개, 전부 노출) → 우측 소분류 칩. 내부 스크롤 없음. */}
                <div className="flex border border-border rounded-lg overflow-hidden">
                  <div className="w-[150px] flex-shrink-0 border-r border-border bg-gray-50">
                    {ROLE_GROUPS.map(g => (
                      <button key={g.key} type="button" onClick={() => setRoleGroup(g.key)}
                        className={cn('block w-full text-left px-3 py-2.5 text-[12.5px] font-semibold border-b border-border/60 transition-colors',
                          roleGroup === g.key ? 'bg-white text-primary-600' : 'text-gray-600 hover:bg-gray-100')}>
                        {g.label[lang] || g.label.en}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 p-3">
                    <div className="flex flex-wrap gap-1.5 content-start">
                      {(ROLE_GROUPS.find(g => g.key === roleGroup)?.roles || []).map(r => (
                        <button key={r.value} type="button"
                          onClick={() => { setF('role', r.value); setRoleModal(false); }}
                          className={cn('px-3 h-8 rounded-md border text-[12.5px] font-semibold transition-colors',
                            form.role === r.value
                              ? 'border-primary-500 bg-primary-50 text-primary-600'
                              : 'border-border bg-white text-gray-700 hover:bg-gray-50')}>
                          {r.label[lang] || r.label.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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

// 듀얼 핸들 레인지 슬라이더 — 겹친 native range 두 개(.sm-range, globals.css).
// 드래그 시 min/max 역전은 서로 클램프.
export function RangeSlider({ min, max, step = 1, valueMin, valueMax, onChange }) {
  const pct = (v) => ((v - min) / (max - min)) * 100;
  const lo = Math.min(Math.max(valueMin, min), max);
  const hi = Math.min(Math.max(valueMax, min), max);
  return (
    <div className="relative h-9 flex items-center">
      <div className="absolute left-0 right-0 h-1.5 rounded-full bg-gray-100" />
      <div className="absolute h-1.5 rounded-full bg-primary-500"
        style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      <input type="range" min={min} max={max} step={step} value={lo}
        onChange={e => onChange([Math.min(Number(e.target.value), hi), hi])}
        className="sm-range absolute w-full" />
      <input type="range" min={min} max={max} step={step} value={hi}
        onChange={e => onChange([lo, Math.max(Number(e.target.value), lo)])}
        className="sm-range absolute w-full" />
    </div>
  );
}

// 네이티브 <select> 팝업은 OS 모양이라 스타일이 안 먹는다 — 우리 디자인의
// 커스텀 셀렉트. 바깥 클릭으로 닫히고, 선택 항목에 체크 표시.
export function StyledSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  const cur = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1">
        <span className={cur ? 'text-gray-900' : 'text-gray-400'}>{cur ? cur.label : placeholder}</span>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-white shadow-soft-md py-1 max-h-60 overflow-y-auto">
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn('flex w-full items-center justify-between px-3 py-2 text-[13px] font-medium text-left hover:bg-gray-50',
                o.value === value ? 'text-primary-600' : 'text-gray-700')}>
              {o.label}
              {o.value === value && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Field({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5 mb-3.5">
      <label className="text-[13px] font-bold text-gray-700">
        {label}{required && <span className="text-primary-500"> *</span>}
      </label>
      {children}
      {error && <div className="text-[12px] text-red-600 font-medium">{error}</div>}
    </div>
  );
}

// Styled replacement for a bare <input type="file"> — the native control
// renders the OS-default "파일 선택" button, which no CSS can restyle.
export function UploadInput({ label, disabled, onFile }) {
  return (
    <label className={cn(
      'flex h-[58px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[12.5px] font-bold text-gray-600 transition-colors',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 hover:text-primary-600'
    )}>
      <ImageIcon className="w-4 h-4" />
      {label}
      <input
        type="file" accept="image/*" className="hidden" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </label>
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

const DOT_COLOR = { live: '#10b981', paused: '#f59e0b', closed: 'var(--sm-gray-500)', draft: 'var(--sm-gray-300)', pending_review: 'var(--sm-primary)' };

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
        <div className="text-[13px] font-bold text-white tracking-tight truncate">{companyName || t('company.sidebar.myCompany')}</div>
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
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[11.5px] font-bold tabular-nums">
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
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[11.5px] font-bold tabular-nums">
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
            <div className="px-2.5 pt-0.5 pb-1.5 text-[11.5px] font-bold text-gray-400">
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
  loading: { display: 'grid', placeItems: 'center', height: '100vh', background: 'var(--sm-gray-50)', color: 'var(--sm-gray-700)', fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif" },

  fullCenter: { minHeight: '100vh', background: 'var(--sm-gray-50)', display: 'grid', placeItems: 'center', padding: 20, fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif" },
  lightCard: { maxWidth: 420, width: '100%', padding: '40px 32px', textAlign: 'center', background: '#fff', border: '1px solid var(--sm-gray-200)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.05)' },
  cardH: { fontSize: 20, fontWeight: 700, color: 'var(--sm-gray-900)', marginBottom: 8 },
  cardP: { fontSize: 13.5, color: 'var(--sm-gray-700)', marginBottom: 22, lineHeight: 1.65 },

  app: { display: 'flex', minHeight: '100vh', background: 'var(--sm-gray-50)', color: 'var(--sm-gray-900)', fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif" },

  // Sidebar (light)
  sidebar: { background: '#fff', borderRight: '1px solid var(--sm-gray-200)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  sideHead: { padding: '8px 10px 14px', borderBottom: '1px solid var(--sm-gray-200)', marginBottom: 10 },
  sideCompany: { fontSize: 14, fontWeight: 700, color: 'var(--sm-gray-900)' },
  sideUser: { fontSize: 11, color: 'var(--sm-gray-600)', marginTop: 3 },
  sideNav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 7, fontSize: 13, color: 'var(--sm-gray-700)', fontWeight: 600, textDecoration: 'none' },
  navItemActive: { background: 'var(--sm-primary-50)', color: 'var(--sm-primary-600)', fontWeight: 700 },
  navIco: { width: 14, textAlign: 'center', fontSize: 13 },
  sideBottom: { marginTop: 'auto', padding: 10 },
  signoutLink: { fontSize: 11.5, color: 'var(--sm-gray-600)', cursor: 'pointer', textDecoration: 'underline' },

  sideDivider: { height: 1, background: 'var(--sm-gray-200)', margin: '12px 8px' },
  sideSectionTitle: { fontSize: 10.5, color: 'var(--sm-gray-500)', fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px 6px' },
  sideSubGroupTitle: { fontSize: 11, color: 'var(--sm-gray-700)', fontWeight: 700, padding: '8px 10px 4px' },
  sideJobList: { display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 360, overflowY: 'auto' },
  sideJobItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, fontSize: 12.5, color: 'var(--sm-gray-700)', fontWeight: 600, textDecoration: 'none' },
  sideJobItemActive: { background: 'var(--sm-primary-50)', color: 'var(--sm-primary-600)', fontWeight: 700 },
  sideJobDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  sideJobTitle: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  // Main — flex-1 min-w-0 so it lives nicely in flex shell. Top padding kept thin since PageHeader is sticky.
  main: { flex: 1, minWidth: 0, paddingLeft: 'clamp(16px, 3vw, 28px)', paddingRight: 'clamp(16px, 3vw, 28px)', paddingTop: 0, paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 14 },
  mainHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  mainH: { fontSize: 26, fontWeight: 700, color: 'var(--sm-gray-900)', letterSpacing: '-0.01em' },
  mainP: { fontSize: 13.5, color: 'var(--sm-gray-700)', marginTop: 4 },

  formShell: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'flex-start' },
  formCol: { display: 'flex', flexDirection: 'column' },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--sm-gray-600)', letterSpacing: '0.06em', marginBottom: 14 },

  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: 'var(--sm-gray-700)', fontWeight: 700 },
  inp: { background: '#fff', border: '1px solid var(--sm-gray-300)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--sm-gray-900)', fontFamily: 'inherit' },
  hint: { fontSize: 11, color: 'var(--sm-gray-600)' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

  previewCol: { background: '#fff', border: '1px solid var(--sm-gray-200)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 20 },
  previewLabel: { fontSize: 10.5, color: 'var(--sm-gray-600)', fontWeight: 700, letterSpacing: '0.05em' },
  previewCard: { background: 'var(--sm-gray-50)', border: '1px solid var(--sm-gray-200)', borderRadius: 8, padding: 14 },
  pTitle: { fontSize: 14, fontWeight: 700, color: 'var(--sm-gray-900)', marginBottom: 5 },
  pMeta: { fontSize: 11.5, color: 'var(--sm-gray-700)', marginTop: 2 },
  pLoc: { fontSize: 11.5, color: 'var(--sm-gray-600)', marginTop: 6 },

  err: { gridColumn: '1 / -1', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#B91C1C' },

  formFoot: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--sm-gray-200)', marginTop: 8 },

  // Matches the shadcn Button default/outline variants (ui/button.js) so
  // inline-styled pages read as the same system.
  btnPrimary: { padding: '12px 24px', borderRadius: 8, border: 'none', background: 'var(--sm-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block', boxShadow: '0 6px 16px rgba(var(--sm-primary-rgb),0.25)' },
  btnGhost: { padding: '12px 24px', borderRadius: 8, border: '1px solid var(--sm-gray-200)', background: '#fff', color: 'var(--sm-gray-900)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block', boxShadow: '0 1px 2px rgba(17,24,39,0.04)' },
  btnDisabled: { padding: '12px 24px', borderRadius: 8, border: 'none', background: 'var(--sm-gray-200)', color: 'var(--sm-gray-500)', fontSize: 14, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' },
  btnDanger: { padding: '12px 22px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};

const localCss = {
  fileInp: { padding: '8px 10px', fontSize: 12.5, color: 'var(--sm-gray-700)', border: '1px dashed var(--sm-gray-300)', borderRadius: 7, background: 'var(--sm-gray-50)', cursor: 'pointer', fontFamily: 'inherit' },
  imgRow: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--sm-gray-200)', borderRadius: 7, background: '#fff' },
  logoPreview: { height: 40, width: 40, borderRadius: 6, objectFit: 'contain', background: 'var(--sm-gray-50)' },
  imgPreview: { height: 60, width: 100, borderRadius: 6, objectFit: 'cover' },
  imgRemove: { marginLeft: 'auto', padding: '5px 10px', fontSize: 11, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  uploadHint: { fontSize: 12, color: 'var(--sm-primary-600)', fontWeight: 600, marginTop: -8, marginBottom: 14 },
  photoHint: { fontSize: 11.5, color: 'var(--sm-gray-500)', marginTop: -8, marginBottom: 14, fontWeight: 600 },

  // 미리보기 — 실제 /jobs 피드 카드 형태
  pvCard: { background: '#fff', border: '1px solid var(--sm-gray-200)', borderRadius: 10, overflow: 'hidden' },
  pvImg: { width: '100%', height: 140, objectFit: 'cover', display: 'block' },
  pvImgEmpty: { width: '100%', height: 140, background: 'var(--sm-gray-100)', display: 'grid', placeItems: 'center', color: 'var(--sm-gray-500)', fontSize: 12.5, fontWeight: 700 },
  pvBody: { padding: 14 },
  pvCompanyRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 },
  pvLogo: { width: 20, height: 20, borderRadius: 5, objectFit: 'contain', background: 'var(--sm-gray-100)' },
  pvLogoEmpty: { width: 20, height: 20, borderRadius: 5, background: 'var(--sm-gray-200)' },
  pvCompany: { fontSize: 11.5, color: 'var(--sm-gray-600)', fontWeight: 700 },
  pvTitle: { fontSize: 15, fontWeight: 700, color: 'var(--sm-gray-900)', marginBottom: 6, lineHeight: 1.3 },
  pvSalary: { fontSize: 13, color: 'var(--sm-primary-600)', fontWeight: 700, marginBottom: 7 },
  pvTags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  pvTag: { fontSize: 10.5, fontWeight: 700, color: 'var(--sm-gray-700)', background: 'var(--sm-gray-100)', padding: '3px 8px', borderRadius: 999 },
  pvLoc: { fontSize: 11.5, color: 'var(--sm-gray-600)' },
};
