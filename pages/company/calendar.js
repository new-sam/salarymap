import { useState, useEffect, Fragment } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Sidebar, css } from './jobs/new';
import { useT } from '../../lib/i18n';

const LOCALES = { vi: 'vi-VN', en: 'en-US', ko: 'ko-KR' };
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function CompanyCalendarPage() {
  const router = useRouter();
  const { t, lang } = useT();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [items, setItems] = useState([]);
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const locale = LOCALES[lang] || LOCALES.vi;
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

  // 월간 그리드 셀 계산 (6주 = 42칸)
  const firstDay = new Date(view.year, view.month, 1);
  const lastDay = new Date(view.year, view.month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  const prevLastDay = new Date(view.year, view.month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevLastDay - i, otherMonth: true, date: new Date(view.year, view.month - 1, prevLastDay - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, otherMonth: false, date: new Date(view.year, view.month, d) });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ day: nextDay, otherMonth: true, date: new Date(view.year, view.month + 1, nextDay) });
    nextDay++;
  }

  // 날짜별 items
  const itemsByDate = {};
  items.forEach(it => {
    const d = new Date(it.interview_at);
    const k = dateKey(d);
    if (!itemsByDate[k]) itemsByDate[k] = [];
    itemsByDate[k].push(it);
  });
  Object.values(itemsByDate).forEach(list => list.sort((a, b) => new Date(a.interview_at) - new Date(b.interview_at)));

  const todayKey = dateKey(new Date());

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  const goToday = () => { const d = new Date(); setView({ year: d.getFullYear(), month: d.getMonth() }); };

  const goCandidate = (jobId) => router.push(`/company/ats?job=${jobId}`);

  return (
    <>
      <Head><title>{t('company.head.calendar')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="calendar" />

        <main style={css.main}>
          <header style={css.mainHead}>
            <div>
              <h1 style={css.mainH}>{t('company.calendar.h')}</h1>
              <p style={css.mainP}>{t('company.calendar.sub')}</p>
            </div>
          </header>

          <div style={cal.toolbar}>
            <h2 style={cal.monthTitle}>{t('company.calendar.monthLabel', { year: view.year, month: view.month + 1 })}</h2>
            <div style={cal.navBtns}>
              <button onClick={prevMonth} style={cal.navBtn} title={t('company.calendar.navPrev')}>‹</button>
              <button onClick={goToday} style={cal.todayBtn}>{t('company.calendar.todayBtn')}</button>
              <button onClick={nextMonth} style={cal.navBtn} title={t('company.calendar.navNext')}>›</button>
            </div>
          </div>

          <div style={cal.weekHead}>
            {[0,1,2,3,4,5,6].map(i => (
              <div key={i} style={{ ...cal.weekdayCell, ...(i === 0 ? cal.weekdaySun : i === 6 ? cal.weekdaySat : {}) }}>
                {t(`company.calendar.weekday.${i}`)}
              </div>
            ))}
          </div>

          <div style={cal.grid}>
            {cells.map((c, i) => {
              const k = dateKey(c.date);
              const isToday = k === todayKey;
              const dayOfWeek = c.date.getDay();
              const dayItems = itemsByDate[k] || [];
              return (
                <div key={i} style={{
                  ...cal.dayCell,
                  ...(c.otherMonth ? cal.otherMonthCell : {}),
                  ...(isToday ? cal.todayCell : {}),
                }}>
                  <div style={{
                    ...cal.dayNum,
                    ...(c.otherMonth ? cal.dayNumOther : {}),
                    ...(isToday ? cal.dayNumToday : {}),
                    ...(dayOfWeek === 0 ? cal.dayNumSun : dayOfWeek === 6 ? cal.dayNumSat : {}),
                  }}>{c.day}</div>
                  <div style={cal.dayItems}>
                    {dayItems.map(it => {
                      const time = fmtTime(new Date(it.interview_at));
                      const name = it.applicant_name || t('company.candidatePrefix').replace('#', '').trim();
                      return (
                        <div
                          key={it.id}
                          style={cal.itemRow}
                          onClick={() => goCandidate(it.job_id)}
                          title={`${time} ${name} · ${it.jobTitle}${it.interview_location ? ' · ' + it.interview_location : ''}`}
                        >
                          <span style={cal.itemTime}>{time}</span>
                          <span style={cal.itemName}>[{name}] {it.jobTitle}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}

const cal = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 2px' },
  monthTitle: { fontSize: 18, fontWeight: 800, color: '#1A1A1A', margin: 0 },
  navBtns: { display: 'flex', gap: 4, alignItems: 'center' },
  navBtn: { width: 30, height: 30, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#525252', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: 'inherit' },
  todayBtn: { padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#1A1A1A', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },

  weekHead: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '8px 8px 0 0', overflow: 'hidden' },
  weekdayCell: { padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#525252' },
  weekdaySun: { color: '#DC2626' },
  weekdaySat: { color: '#2563EB' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', borderRadius: '0 0 8px 8px', overflow: 'hidden', background: '#fff' },
  dayCell: { minHeight: 110, padding: '6px 6px 8px', borderTop: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 4, background: '#fff' },
  otherMonthCell: { background: '#FAFAFA' },
  todayCell: { background: '#FFF7ED' },

  dayNum: { fontSize: 12, fontWeight: 800, color: '#1A1A1A', padding: '2px 4px' },
  dayNumOther: { color: '#94A3B8' },
  dayNumToday: { color: '#EA580C', fontWeight: 900 },
  dayNumSun: { color: '#DC2626' },
  dayNumSat: { color: '#2563EB' },

  dayItems: { display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' },
  itemRow: { padding: '3px 6px', borderRadius: 4, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 10.5, fontWeight: 700, color: '#1E3A8A', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', overflow: 'hidden' },
  itemTime: { fontWeight: 800, color: '#1D4ED8', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  itemName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
};
