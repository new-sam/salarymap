import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';

const STAGE_LABEL = { applied: '신규 지원', viewed: '열람', reviewing: '검토/인터뷰', decided: '결정' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmtDateLabel = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
const fmtTime = (d) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function CompanyCalendarPage() {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus('unauthed'); return; }
      setUser(session.user);

      const { data: rec } = await supabase
        .from('recruiter_users')
        .select('company_id, recruiter_companies(name)')
        .eq('user_id', session.user.id).maybeSingle();
      if (!rec?.company_id) { setStatus('unauthed'); return; }
      setCompanyName(rec.recruiter_companies?.name || '');

      const { data: jobs } = await supabase
        .from('jobs').select('id, title').eq('company_id', rec.company_id);
      const jobMap = {};
      (jobs || []).forEach(j => { jobMap[j.id] = j.title; });
      const jobIds = (jobs || []).map(j => j.id);
      if (jobIds.length === 0) { setItems([]); setStatus('ready'); return; }

      const { data: apps } = await supabase
        .from('job_applications')
        .select('id, applicant_name, status, interview_at, interview_location, interview_interviewer, job_id')
        .in('job_id', jobIds)
        .not('interview_at', 'is', null)
        .order('interview_at', { ascending: true });
      setItems((apps || []).map(a => ({ ...a, jobTitle: jobMap[a.job_id] || '—' })));
      setStatus('ready');
    })();
  }, []);

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

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const upcoming = items.filter(i => new Date(i.interview_at) >= todayStart);
  const past = items.filter(i => new Date(i.interview_at) < todayStart).reverse();

  const renderGroups = (list, dim) => {
    const groups = [];
    list.forEach(it => {
      const d = new Date(it.interview_at);
      const k = dateKey(d);
      let g = groups.find(x => x.k === k);
      if (!g) { g = { k, d, rows: [] }; groups.push(g); }
      g.rows.push(it);
    });
    return groups.map(g => {
      const isToday = dateKey(g.d) === dateKey(new Date());
      return (
        <div key={g.k} style={localCss.group}>
          <div style={{ ...localCss.dateHead, ...(isToday ? localCss.dateHeadToday : {}), ...(dim ? localCss.dim : {}) }}>
            {fmtDateLabel(g.d)}{isToday && <span style={localCss.todayTag}>오늘</span>}
          </div>
          {g.rows.map(it => (
            <div key={it.id} style={{ ...localCss.row, ...(dim ? localCss.dim : {}) }}>
              <div style={localCss.time}>{fmtTime(new Date(it.interview_at))}</div>
              <div style={localCss.rowMain}>
                <div style={localCss.cand}>
                  {it.applicant_name || '후보'}
                  <span style={localCss.stage}>{STAGE_LABEL[it.status] || it.status}</span>
                </div>
                <div style={localCss.sub}>{it.jobTitle}</div>
                <div style={localCss.meta}>
                  📍 {it.interview_location || '장소 미정'}
                  {it.interview_interviewer && <> · 👤 {it.interview_interviewer}</>}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <>
      <Head><title>면접 일정 · FYI for Companies</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="calendar" />

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>면접 일정</h1>
              <p style={css.mainP}>후보 상세의 '면접 일정 잡기'로 등록한 일정이 모입니다.</p>
            </div>
          </header>

          {items.length === 0 ? (
            <div style={localCss.empty}>
              <div style={localCss.emptyIco}>📅</div>
              <h2 style={localCss.emptyH}>등록된 면접 일정이 없습니다</h2>
              <p style={localCss.emptyP}>칸반에서 후보를 열고 '면접 일정 잡기'를 눌러 등록하세요.</p>
            </div>
          ) : (
            <>
              <section>
                <h2 style={localCss.sectionH}>다가오는 면접 ({upcoming.length})</h2>
                {upcoming.length === 0
                  ? <div style={localCss.noneHint}>예정된 면접이 없습니다.</div>
                  : renderGroups(upcoming, false)}
              </section>
              {past.length > 0 && (
                <section style={{ marginTop: 28 }}>
                  <h2 style={localCss.sectionH}>지난 면접 ({past.length})</h2>
                  {renderGroups(past, true)}
                </section>
              )}
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
  emptyP: { fontSize: 13.5, color: '#525252', maxWidth: 380, margin: '0 auto', lineHeight: 1.65 },

  sectionH: { fontSize: 13, fontWeight: 800, color: '#737373', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 },
  noneHint: { fontSize: 13, color: '#94A3B8', padding: '8px 0' },

  group: { marginBottom: 16 },
  dateHead: { fontSize: 13, fontWeight: 800, color: '#1A1A1A', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 },
  dateHeadToday: { color: '#EA580C' },
  todayTag: { fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#EA580C', padding: '2px 7px', borderRadius: 999 },
  dim: { opacity: 0.55 },

  row: { display: 'flex', gap: 14, padding: '12px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 6 },
  time: { fontSize: 14, fontWeight: 900, color: '#EA580C', fontVariantNumeric: 'tabular-nums', minWidth: 48 },
  rowMain: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  cand: { fontSize: 14, fontWeight: 800, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 8 },
  stage: { fontSize: 10.5, fontWeight: 800, color: '#525252', background: '#F1F5F9', padding: '2px 8px', borderRadius: 999 },
  sub: { fontSize: 12.5, color: '#525252' },
  meta: { fontSize: 11.5, color: '#94A3B8' },
};
