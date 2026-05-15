import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import { Field, Sidebar, css } from '../new';

const imgCss = {
  fileInp: { padding: '8px 10px', fontSize: 12.5, color: '#525252', border: '1px dashed #D1D5DB', borderRadius: 7, background: '#FAFAFA', cursor: 'pointer', fontFamily: 'inherit' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff' },
  logo: { height: 40, width: 40, borderRadius: 6, objectFit: 'contain', background: '#F8F8F8' },
  img: { height: 60, width: 100, borderRadius: 6, objectFit: 'cover' },
  remove: { marginLeft: 'auto', padding: '5px 10px', fontSize: 11, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  hint: { fontSize: 12, color: '#EA580C', fontWeight: 600, marginTop: -8, marginBottom: 14 },
};

const ROLES = ['Backend', 'Frontend', 'Fullstack', 'Mobile', 'Data', 'DevOps', 'PM', 'Design', 'QA'];
const TYPES = ['remote', 'onsite', 'hybrid'];
const LOCATIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];

export default function EditJobPage() {
  const router = useRouter();
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
    if (error) { setErr(error.message); setStatus('ready'); return; }
    router.replace('/company/jobs');
  };

  const onDelete = async () => {
    if (!confirm('이 공고를 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    setStatus('saving');
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) { setErr(error.message); setStatus('ready'); return; }
    router.replace('/company/jobs');
  };

  const toggleActive = async () => {
    const newStatus = origStatus === 'live' ? 'paused' : 'live';
    const { error } = await supabase.from('jobs').update({ status: newStatus, is_active: newStatus === 'live' }).eq('id', id);
    if (error) { setErr(error.message); return; }
    setOrigStatus(newStatus);
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
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>공고 수정</h1>
              <p style={css.mainP}>
                현재 상태: <strong>{origStatus === 'live' ? '활성' : origStatus === 'paused' ? '일시중지' : origStatus}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={toggleActive} style={css.btnGhost}>
                {origStatus === 'live' ? '일시중지' : '재개'}
              </button>
              <button onClick={onDelete} style={css.btnDanger}>삭제</button>
            </div>
          </header>

          <form onSubmit={onSubmit} style={css.formShell}>
            <div style={css.formCol}>
              <h2 style={css.sectionTitle}>기본 정보</h2>
              <Field label="포지션명"><input value={form.title} onChange={e => setF('title', e.target.value)} style={css.inp} /></Field>
              <Field label="업무 설명"><textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={4} style={{...css.inp, resize: 'vertical', minHeight: 110}} /></Field>
              <div style={css.row2}>
                <Field label="역할 카테고리"><select value={form.role} onChange={e => setF('role', e.target.value)} style={css.inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
                <Field label="근무 형태"><select value={form.type} onChange={e => setF('type', e.target.value)} style={css.inp}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
              </div>
              <Field label="근무지"><select value={form.location} onChange={e => setF('location', e.target.value)} style={css.inp}>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</select></Field>

              <h2 style={{...css.sectionTitle, marginTop: 28}}>경력 · 연봉</h2>
              <div style={css.row2}>
                <Field label="경력 최소 (년)"><input type="number" value={form.experience_min} onChange={e => setF('experience_min', e.target.value)} style={css.inp} /></Field>
                <Field label="경력 최대 (년)"><input type="number" value={form.experience_max} onChange={e => setF('experience_max', e.target.value)} style={css.inp} /></Field>
              </div>
              <div style={css.row2}>
                <Field label="연봉 최소 (VND, 월)"><input type="number" value={form.salary_min} onChange={e => setF('salary_min', e.target.value)} style={css.inp} /><div style={css.hint}>{Math.round(form.salary_min / 1e6)}M VND/월</div></Field>
                <Field label="연봉 최대 (VND, 월)"><input type="number" value={form.salary_max} onChange={e => setF('salary_max', e.target.value)} style={css.inp} /><div style={css.hint}>{Math.round(form.salary_max / 1e6)}M VND/월</div></Field>
              </div>

              <h2 style={{...css.sectionTitle, marginTop: 28}}>이미지</h2>
              <div style={css.row2}>
                <Field label="회사 로고">
                  {form.logo_url ? (
                    <div style={imgCss.row}>
                      <img src={form.logo_url} alt="logo" style={imgCss.logo} />
                      <button type="button" onClick={() => setF('logo_url', '')} style={imgCss.remove}>제거</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo_url')}
                      style={imgCss.fileInp} />
                  )}
                </Field>
                <Field label="공고 대표 이미지">
                  {form.image_url ? (
                    <div style={imgCss.row}>
                      <img src={form.image_url} alt="thumbnail" style={imgCss.img} />
                      <button type="button" onClick={() => setF('image_url', '')} style={imgCss.remove}>제거</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'image_url')}
                      style={imgCss.fileInp} />
                  )}
                </Field>
              </div>
              {uploading && <div style={imgCss.hint}>업로드 중...</div>}

              <h2 style={{...css.sectionTitle, marginTop: 28}}>스킬·복지·기타</h2>
              <Field label="기술 스택 (콤마 구분)"><input value={form.tech_stack} onChange={e => setF('tech_stack', e.target.value)} style={css.inp} /></Field>
              <Field label="복지 (콤마 구분, 선택)"><input value={form.benefits} onChange={e => setF('benefits', e.target.value)} style={css.inp} /></Field>
              <div style={css.row2}>
                <Field label="채용 인원 (선택)"><input type="number" value={form.headcount} onChange={e => setF('headcount', e.target.value)} style={css.inp} /></Field>
                <Field label="마감일 (선택)"><input type="date" value={form.deadline} onChange={e => setF('deadline', e.target.value)} style={css.inp} /></Field>
              </div>
            </div>

            <aside style={css.previewCol}>
              <div style={css.previewLabel}>미리보기</div>
              <div style={css.previewCard}>
                <div style={css.pTitle}>{form.title || '포지션명'}</div>
                <div style={css.pMeta}>{companyName} · ₫{Math.round(form.salary_min/1e6)}M–{Math.round(form.salary_max/1e6)}M/월 · {form.experience_min}–{form.experience_max}y</div>
                <div style={css.pMeta}>{(form.tech_stack || '').split(',').filter(s => s.trim()).slice(0, 3).join(' · ')}</div>
                <div style={css.pLoc}>📍 {form.location} · {form.type}</div>
              </div>
            </aside>

            {err && <div style={css.err}>{err}</div>}

            <div style={css.formFoot}>
              <Link href="/company/jobs" style={css.btnGhost}>취소</Link>
              <button type="submit" disabled={status === 'saving'} style={status === 'saving' ? css.btnDisabled : css.btnPrimary}>
                {status === 'saving' ? '저장 중…' : '변경사항 저장'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </>
  );
}
