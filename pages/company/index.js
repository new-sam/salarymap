import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';

const STATUS_LABEL = { draft: '초안', pending_review: '검수 중', live: '활성', paused: '일시중지', closed: '종료' };
const STATUS_STYLE = {
  draft: { bg: '#F1F5F9', color: '#64748B' },
  pending_review: { bg: '#FFF7ED', color: '#EA580C' },
  live: { bg: '#ECFDF5', color: '#059669' },
  paused: { bg: '#FFFBEB', color: '#D97706' },
  closed: { bg: '#F1F5F9', color: '#94A3B8' },
};

export default function CompanyDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobs, setJobs] = useState([]);
  const [appsCount, setAppsCount] = useState(0);
  const [appsByJob, setAppsByJob] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) { setStatus('unauthed'); return; }
      setUser(data.session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, full_name, recruiter_companies(name)')
        .eq('user_id', data.session.user.id)
        .maybeSingle();
      if (rec?.recruiter_companies?.name) setCompanyName(rec.recruiter_companies.name);
      if (rec?.full_name) setFullName(rec.full_name);

      if (rec?.company_id) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, title, location, type, status, salary_min, salary_max, experience_min, experience_max, created_at, is_active')
          .eq('company_id', rec.company_id)
          .order('created_at', { ascending: false });
        const jobList = jobsData || [];
        setJobs(jobList);

        if (jobList.length > 0) {
          const ids = jobList.map(j => j.id);
          const { data: appsData } = await supabase
            .from('job_applications')
            .select('id, job_id, status')
            .in('job_id', ids);

          const apps = appsData || [];
          setAppsCount(apps.length);
          const grouped = {};
          apps.forEach(a => {
            if (!grouped[a.job_id]) grouped[a.job_id] = { total: 0, new: 0 };
            grouped[a.job_id].total += 1;
            if (a.status === 'pending') grouped[a.job_id].new += 1;
          });
          setAppsByJob(grouped);
        }
      }
      setStatus('ready');
    })();
    return () => { mounted = false; };
  }, []);

  if (status === 'loading') return <div style={css.loading}>Loading…</div>;
  if (status === 'unauthed') {
    return (
      <div style={css.fullCenter}>
        <div style={css.lightCard}>
          <h1 style={css.cardH}>기업 로그인</h1>
          <p style={css.cardP}>회사 계정으로 로그인해 주세요.</p>
          <Link href="/company/signup" style={css.btnPrimary}>로그인 / 가입</Link>
        </div>
      </div>
    );
  }

  const activeCount = jobs.filter(j => j.status === 'live').length;
  const goKanban = (jobId) => router.push(`/company/ats?job=${jobId}`);

  return (
    <>
      <Head><title>대시보드 · FYI for Companies</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="home" />

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>환영합니다{fullName ? `, ${fullName}님` : ''}</h1>
              <p style={css.mainP}>
                {companyName ? `${companyName} ` : ''}— 공고를 누르면 지원자 칸반으로 이동합니다.
              </p>
            </div>
            <Link href="/company/jobs/new" style={css.btnPrimary}>+ 새 공고</Link>
          </header>

          {jobs.length === 0 ? (
            <div style={localCss.empty}>
              <div style={localCss.emptyIco}>📋</div>
              <h2 style={localCss.emptyH}>첫 공고를 등록해 보세요</h2>
              <p style={localCss.emptyP}>발행하면 즉시 후보자에게 공개됩니다.</p>
              <Link href="/company/jobs/new" style={css.btnPrimary}>+ 새 공고 작성하기</Link>
            </div>
          ) : (
            <>
              {/* 인라인 KPI */}
              <div style={localCss.kpiInline}>
                <span><b style={localCss.kpiStrong}>{jobs.length}</b>개 공고</span>
                <span style={localCss.kpiSep}>·</span>
                <span><b style={localCss.kpiStrong}>{activeCount}</b>개 활성</span>
                <span style={localCss.kpiSep}>·</span>
                <span><b style={localCss.kpiStrong}>{appsCount}</b>명 누적 지원</span>
              </div>

              <div style={localCss.list}>
                {jobs.map(job => {
                  const s = STATUS_STYLE[job.status] || STATUS_STYLE.draft;
                  const stats = appsByJob[job.id] || { total: 0, new: 0 };
                  return (
                    <div
                      key={job.id}
                      onClick={() => goKanban(job.id)}
                      style={localCss.card}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(234,88,12,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={localCss.cardLeft}>
                        <div style={localCss.cardTitleRow}>
                          <span style={localCss.cardTitle}>{job.title}</span>
                          <span style={{...localCss.badge, background: s.bg, color: s.color}}>
                            {STATUS_LABEL[job.status] || job.status}
                          </span>
                        </div>
                        <div style={localCss.cardMeta}>
                          {job.location} · {job.type} · ₫{Math.round(job.salary_min/1e6)}M–{Math.round(job.salary_max/1e6)}M/월
                        </div>
                      </div>
                      <div style={localCss.cardRight}>
                        <div style={localCss.stats}>
                          <div style={localCss.statBox}>
                            <div style={localCss.statVal}>{stats.total}</div>
                            <div style={localCss.statLab}>지원</div>
                          </div>
                          {stats.new > 0 && (
                            <div style={{...localCss.statBox, ...localCss.statBoxNew}}>
                              <div style={localCss.statVal}>{stats.new}</div>
                              <div style={localCss.statLab}>신규</div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/company/jobs/${job.id}/edit`); }}
                          style={localCss.editBtn}
                        >
                          수정
                        </button>
                        <span style={localCss.arrow}>→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

const localCss = {
  empty: { border: '2px dashed #E5E7EB', borderRadius: 12, padding: '48px 24px', textAlign: 'center', background: '#fff' },
  emptyIco: { fontSize: 36, marginBottom: 12, opacity: 0.5 },
  emptyH: { fontSize: 18, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 },
  emptyP: { fontSize: 13.5, color: '#525252', maxWidth: 380, margin: '0 auto 22px', lineHeight: 1.65 },

  kpiInline: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, color: '#525252', fontWeight: 600 },
  kpiStrong: { color: '#1A1A1A', fontWeight: 900, fontSize: 16, fontVariantNumeric: 'tabular-nums' },
  kpiSep: { color: '#CBD5E1' },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 22px', background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
  },
  cardLeft: { flex: 1, minWidth: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: '#1A1A1A' },
  cardMeta: { fontSize: 12.5, color: '#525252' },
  cardRight: { display: 'flex', alignItems: 'center', gap: 16 },
  badge: { padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' },

  stats: { display: 'flex', gap: 10 },
  statBox: { textAlign: 'center', minWidth: 40 },
  statBoxNew: { color: '#EA580C' },
  statVal: { fontSize: 18, fontWeight: 900, color: '#1A1A1A', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' },
  statLab: { fontSize: 10.5, color: '#737373', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },

  editBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#525252', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  arrow: { fontSize: 16, color: '#94A3B8', fontWeight: 800 },
};
