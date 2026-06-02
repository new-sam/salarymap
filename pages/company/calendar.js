import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import { useT } from '../../lib/i18n';

const LOCALES = { vi: 'vi-VN', en: 'en-US', ko: 'ko-KR' };
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function CompanyCalendarPage() {
  const { t, lang } = useT();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [items, setItems] = useState([]);

  const locale = LOCALES[lang] || LOCALES.vi;
  const fmtDateLabel = (d) => d.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' });
  const fmtTime = (d) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });

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
            {fmtDateLabel(g.d)}{isToday && <span style={localCss.todayTag}>{t('company.calendar.today')}</span>}
          </div>
          {g.rows.map(it => (
            <div key={it.id} style={{ ...localCss.row, ...(dim ? localCss.dim : {}) }}>
              <div style={localCss.time}>{fmtTime(new Date(it.interview_at))}</div>
              <div style={localCss.rowMain}>
                <div style={localCss.cand}>
                  {it.applicant_name || t('company.candidatePrefix').replace('#', '').trim()}
                  <span style={localCss.stage}>{t(`company.stage.${it.status}`) || it.status}</span>
                </div>
                <div style={localCss.sub}>{it.jobTitle}</div>
                <div style={localCss.meta}>
                  📍 {it.interview_location || t('company.calendar.locTbd')}
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
      <Head><title>{t('company.head.calendar')}</title></Head>
      <div className="company-app" style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="calendar" />

        <main className="company-main" style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>{t('company.calendar.h')}</h1>
              <p style={css.mainP}>{t('company.calendar.sub')}</p>
            </div>
          </header>

          {items.length === 0 ? (
            <div style={localCss.empty}>
              <div style={localCss.emptyIco}>📅</div>
              <h2 style={localCss.emptyH}>{t('company.calendar.emptyH')}</h2>
              <p style={localCss.emptyP}>{t('company.calendar.emptyDesc')}</p>
            </div>
          ) : (
            <>
              <section>
                <h2 style={localCss.sectionH}>{t('company.calendar.upcoming', { n: upcoming.length })}</h2>
                {upcoming.length === 0
                  ? <div style={localCss.noneHint}>{t('company.calendar.noUpcoming')}</div>
                  : renderGroups(upcoming, false)}
              </section>
              {past.length > 0 && (
                <section style={{ marginTop: 28 }}>
                  <h2 style={localCss.sectionH}>{t('company.calendar.past', { n: past.length })}</h2>
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
