import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import Brand from '../../../components/company/Brand';
import LangToggle from '../../../components/company/LangToggle';
import { useT } from '../../../lib/i18n';

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
      status: 'pending_review',
      is_active: false,
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
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="jobs" />

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>{t('company.jobsnew.h')}</h1>
              <p style={css.mainP}>{t('company.jobsnew.sub')}</p>
            </div>
          </header>

          <form onSubmit={onSubmit} style={css.formShell}>
            <div style={css.formCol}>
              <h2 style={css.sectionTitle}>{t('company.jobsnew.photoH')}</h2>

              <div style={css.row2}>
                <Field label={t('company.jobsnew.imageLabel')}>
                  {form.image_url ? (
                    <div style={localCss.imgRow}>
                      <img src={form.image_url} alt="thumbnail" style={localCss.imgPreview} />
                      <button type="button" onClick={() => setF('image_url', '')} style={localCss.imgRemove}>{t('company.remove')}</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'image_url')}
                      style={localCss.fileInp} />
                  )}
                </Field>
                <Field label={t('company.jobsnew.logoLabel')}>
                  {form.logo_url ? (
                    <div style={localCss.imgRow}>
                      <img src={form.logo_url} alt="logo" style={localCss.logoPreview} />
                      <button type="button" onClick={() => setF('logo_url', '')} style={localCss.imgRemove}>{t('company.remove')}</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo_url')}
                      style={localCss.fileInp} />
                  )}
                </Field>
              </div>
              {uploading
                ? <div style={localCss.uploadHint}>{t('company.uploading')}</div>
                : <div style={localCss.photoHint}>{t('company.jobsnew.photoHint')}</div>}

              <h2 style={{...css.sectionTitle, marginTop: 28}}>{t('company.jobsnew.basicH')}</h2>

              <Field label={t('company.jobsnew.title')}>
                <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Senior Backend Engineer" style={css.inp} />
              </Field>

              <Field label={t('company.jobsnew.descLabel')}>
                <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={4}
                  placeholder={t('company.jobsnew.descPh')} style={{...css.inp, resize: 'vertical', minHeight: 110}} />
              </Field>

              <div style={css.row2}>
                <Field label={t('company.jobsnew.role')}>
                  <select value={form.role} onChange={e => setF('role', e.target.value)} style={css.inp}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label={t('company.jobsnew.type')}>
                  <select value={form.type} onChange={e => setF('type', e.target.value)} style={css.inp}>
                    {TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                  </select>
                </Field>
              </div>

              <Field label={t('company.jobsnew.location')}>
                <select value={form.location} onChange={e => setF('location', e.target.value)} style={css.inp}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>

              <h2 style={{...css.sectionTitle, marginTop: 28}}>{t('company.jobsnew.expSalH')}</h2>

              <div style={css.row2}>
                <Field label={t('company.jobsnew.expMin')}>
                  <input type="number" value={form.experience_min} onChange={e => setF('experience_min', e.target.value)} style={css.inp} />
                </Field>
                <Field label={t('company.jobsnew.expMax')}>
                  <input type="number" value={form.experience_max} onChange={e => setF('experience_max', e.target.value)} style={css.inp} />
                </Field>
              </div>

              <div style={css.row2}>
                <Field label={t('company.jobsnew.salaryMin')}>
                  <input type="number" value={form.salary_min} onChange={e => setF('salary_min', e.target.value)} style={css.inp} />
                  <div style={css.hint}>{t('company.jobsnew.vndHint', { n: Math.round(form.salary_min / 1e6) })}</div>
                </Field>
                <Field label={t('company.jobsnew.salaryMax')}>
                  <input type="number" value={form.salary_max} onChange={e => setF('salary_max', e.target.value)} style={css.inp} />
                  <div style={css.hint}>{t('company.jobsnew.vndHint', { n: Math.round(form.salary_max / 1e6) })}</div>
                </Field>
              </div>

              <h2 style={{...css.sectionTitle, marginTop: 28}}>{t('company.jobsnew.skillH')}</h2>

              <Field label={t('company.jobsnew.tech')}>
                <input value={form.tech_stack} onChange={e => setF('tech_stack', e.target.value)}
                  placeholder="Node.js, PostgreSQL, AWS" style={css.inp} />
              </Field>

              <Field label={t('company.jobsnew.benefits')}>
                <input value={form.benefits} onChange={e => setF('benefits', e.target.value)}
                  placeholder="13th-month, Health insurance" style={css.inp} />
              </Field>

              <div style={css.row2}>
                <Field label={t('company.jobsnew.headcount')}>
                  <input type="number" value={form.headcount} onChange={e => setF('headcount', e.target.value)} placeholder="1" style={css.inp} />
                </Field>
                <Field label={t('company.jobsnew.deadline')}>
                  <input type="date" value={form.deadline} onChange={e => setF('deadline', e.target.value)} style={css.inp} />
                </Field>
              </div>
            </div>

            <aside style={css.previewCol}>
              <div style={css.previewLabel}>{t('company.jobsnew.previewLabel')}</div>
              <div style={localCss.pvCard}>
                {form.image_url
                  ? <img src={form.image_url} alt="" style={localCss.pvImg} />
                  : <div style={localCss.pvImgEmpty}>{t('company.jobsnew.previewEmpty')}</div>}
                <div style={localCss.pvBody}>
                  <div style={localCss.pvCompanyRow}>
                    {form.logo_url
                      ? <img src={form.logo_url} alt="" style={localCss.pvLogo} />
                      : <div style={localCss.pvLogoEmpty} />}
                    <span style={localCss.pvCompany}>{companyName || t('company.previewCompanyDef')}</span>
                  </div>
                  <div style={localCss.pvTitle}>{form.title || t('company.previewTitleDef')}</div>
                  <div style={localCss.pvSalary}>
                    ₫{Math.round(form.salary_min/1e6)}M–{Math.round(form.salary_max/1e6)}M/월
                  </div>
                  {(form.tech_stack || '').trim() && (
                    <div style={localCss.pvTags}>
                      {form.tech_stack.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4).map(tg => (
                        <span key={tg} style={localCss.pvTag}>{tg}</span>
                      ))}
                    </div>
                  )}
                  <div style={localCss.pvLoc}>📍 {form.location} · {form.type} · {form.experience_min}–{form.experience_max}y</div>
                </div>
              </div>
            </aside>

            {err && <div style={css.err}>{err}</div>}

            <div style={css.formFoot}>
              <Link href="/company/jobs" style={css.btnGhost}>{t('company.cancel')}</Link>
              <button type="submit" disabled={status === 'saving'} style={status === 'saving' ? css.btnDisabled : css.btnPrimary}>
                {status === 'saving' ? t('company.saving') : t('company.jobsnew.publish')}
              </button>
            </div>
          </form>
        </main>
      </div>
    </>
  );
}

export function Field({ label, children }) {
  return (
    <div style={css.field}>
      <label style={css.fieldLabel}>{label}</label>
      {children}
    </div>
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
        .order('created_at', { ascending: false });
      setJobs(jobsData || []);
    })();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); router.replace('/for-companies'); };
  const isActive = (k) => activePage === k;

  return (
    <aside style={css.sidebar}>
      <div style={css.sideHead}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 12 }}>
          <Brand href="/company" size="sm" />
          <LangToggle align="right" />
        </div>
        <div style={css.sideCompany}>{companyName || t('company.sidebar.myCompany')}</div>
        <div style={css.sideUser}>{userEmail}</div>
      </div>
      <nav style={css.sideNav}>
        <Link href="/company" style={{...css.navItem, ...(isActive('home') ? css.navItemActive : {})}}><span style={css.navIco}>🏠</span>{t('company.sidebar.dashboard')}</Link>
        <Link href="/company/jobs/new" style={css.navItem}><span style={css.navIco}>➕</span>{t('company.sidebar.newJob')}</Link>
        <Link href="/company/calendar" style={{...css.navItem, ...(isActive('calendar') ? css.navItemActive : {})}}><span style={css.navIco}>📅</span>{t('company.sidebar.calendar')}</Link>
      </nav>

      {jobs.length > 0 && (
        <>
          <div style={css.sideDivider} />
          <div style={css.sideSectionTitle}>{t('company.sidebar.myJobs', { n: jobs.length })}</div>
          <div style={css.sideJobList}>
            {jobs.map(j => {
              const dotColor = DOT_COLOR[j.status] || DOT_COLOR.draft;
              const isCurrent = activeJobId === j.id;
              return (
                <Link
                  key={j.id}
                  href={`/company/ats?job=${j.id}`}
                  style={{...css.sideJobItem, ...(isCurrent ? css.sideJobItemActive : {})}}
                  title={j.title}
                >
                  <span style={{...css.sideJobDot, background: dotColor}} />
                  <span style={css.sideJobTitle}>{j.title}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div style={css.sideBottom}>
        <a onClick={signOut} style={css.signoutLink}>{t('company.sidebar.signOut')}</a>
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

  app: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', background: '#FAFAFA', color: '#1A1A1A', fontFamily: "'Pretendard', sans-serif" },

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
  sideJobList: { display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 360, overflowY: 'auto' },
  sideJobItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, fontSize: 12.5, color: '#525252', fontWeight: 600, textDecoration: 'none' },
  sideJobItemActive: { background: '#FFF7ED', color: '#EA580C', fontWeight: 800 },
  sideJobDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  sideJobTitle: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  // Main
  main: { padding: '28px 32px 60px', display: 'flex', flexDirection: 'column', gap: 22 },
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
