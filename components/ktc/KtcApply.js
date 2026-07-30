import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { getStoredUtm, getApplicationSource } from '../../lib/utm';
import { track } from '../../lib/track';
import { appliedUrl } from '../../lib/applyConversion';
import { useT } from '../../lib/i18n';
import { BRAND, c, s } from './ktcStyles';

/* /ktc 공고 지원 — FYI 일반 공고(/jobs)와 **같은 로직·같은 테이블**을 쓴다.
   · 이력서는 resumes 버킷에 올리고 URL 만 넘긴다(FormData 는 /api/job-applications 가 JSON 파서만 써서 400)
   · 접수는 POST /api/job-applications → job_applications
   · 중복 지원 방지는 localStorage fyi_applied_jobs (FYI 쪽과 같은 키)
   /ktc 공고가 FYI jobs(source='ktc') 로 합쳐졌기 때문에 job_id 가 그대로 들어간다.

   비로그인은 /login?return=<현재경로> 로 보내고 로그인 후 제자리로 돌아온다(_app.js 와 같은 규약). */
export default function KtcApply({ job, variant = 'panel' }) {
  const { t } = useT();
  const router = useRouter();
  const fileRef = useRef(null);

  const [session, setSession] = useState(null);
  const [profileResumeUrl, setProfileResumeUrl] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    try {
      const aj = JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]');
      if (aj.includes(job.id)) setApplied(true);
    } catch {}
    supabase.auth.getSession().then(({ data: { session: sn } }) => {
      if (!sn) return;
      setSession(sn);
      // 프로필에 이력서가 있으면 파일 업로드 없이 그걸로 바로 지원한다.
      fetch('/api/profile/talent', { headers: { Authorization: `Bearer ${sn.access_token}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(p => { if (p?.profile?.resume_url) setProfileResumeUrl(p.profile.resume_url); })
        .catch(() => {});
    });
  }, [job.id]);

  const goLogin = () => router.push('/login?return=' + encodeURIComponent(router.asPath));

  const submit = async () => {
    if (applying || applied) return;
    if (!session) return goLogin();
    if (!resumeFile && !profileResumeUrl) return fileRef.current?.click();

    setApplying(true);
    try {
      let resumeUrl = profileResumeUrl;
      if (resumeFile) {
        const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${session.user.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('resumes').upload(path, resumeFile, {
          cacheControl: '3600', upsert: false,
          contentType: resumeFile.type || 'application/octet-stream',
        });
        if (upErr) { alert(t('jobs.cvUploadError', { error: upErr.message })); setApplying(false); return; }
        resumeUrl = supabase.storage.from('resumes').getPublicUrl(path).data.publicUrl;
      }

      const res = await fetch('/api/job-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobCompany: job.company,
          resumeUrl,
          applicantEmail: session.user.email,
          applicantName: session.user.user_metadata?.full_name || '',
          // 유입 정보는 랜딩 시점에 저장된 값을 쓴다(지원 시점엔 router.query 가 비어 있음)
          ...getStoredUtm(),
          applicationSource: getApplicationSource(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(t('jobs.applyError', { error: err.error || 'unknown error' }));
        setApplying(false);
        return;
      }

      setApplied(true);
      try {
        const aj = JSON.parse(localStorage.getItem('fyi_applied_jobs') || '[]');
        if (!aj.includes(job.id)) localStorage.setItem('fyi_applied_jobs', JSON.stringify([...aj, job.id]));
      } catch {}
      track('submit_application', { meta: { job_id: job.id, title: job.title, company: job.company, source: 'ktc' }, page: `/ktc/jobs/${job.id}` });
      /* 확인 페이지로 실제 이동 — 접수 성공을 눈으로 확인시키고, 그 페이지가 마운트될 때
         전환 이벤트를 쏜다. 여기서 또 쏘면 전환이 두 번 잡히므로 이동만 한다. */
      router.push(appliedUrl({ title: job.title, company: job.company, source: 'ktc' }));
    } catch (e) {
      alert(t('jobs.applyError', { error: e?.message || 'unknown error' }));
    }
    setApplying(false);
  };

  const label = applied
    ? t('ktc.apply.done')
    : applying
      ? t('ktc.apply.sending')
      : !session
        ? t('ktc.apply.login')
        : (!resumeFile && !profileResumeUrl)
          ? t('ktc.apply.pickCv')
          : t('ktc.jobs.apply');

  const btn = (
    <button
      className="ktc-apply-btn"
      style={{ ...s.btnPrimary, width: '100%', opacity: applied || applying ? 0.55 : 1, cursor: applied ? 'default' : 'pointer' }}
      onClick={submit}
      disabled={applying || applied}
    >
      {label}{!applied && !applying ? ' →' : ''}
    </button>
  );

  // 선택한 파일명 / 프로필 이력서 사용 안내 — 무엇으로 지원되는지 버튼 위에 밝힌다.
  const cvNote = session && !applied && (
    <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, color: c.textFaint, wordBreak: 'break-all' }}>
      {resumeFile
        ? `📎 ${resumeFile.name}`
        : profileResumeUrl
          ? t('ktc.apply.useProfileCv')
          : t('ktc.apply.needCv')}
      {(resumeFile || profileResumeUrl) && (
        <button
          onClick={() => fileRef.current?.click()}
          style={{ marginLeft: 6, background: 'none', border: 'none', padding: 0, color: BRAND, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {t('ktc.apply.changeCv')}
        </button>
      )}
    </p>
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setResumeFile(f); }}
      />
      {btn}
      {variant === 'panel' && cvNote}
    </>
  );
}
