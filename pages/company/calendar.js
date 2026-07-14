import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { loadAccessibleJobIds } from '../../lib/company-access';
import { Sidebar, css } from './jobs/new';
import { useT } from '../../lib/i18n';
import { ICT_TZ, ICT_LABEL } from '../../lib/timezone';
import { cn } from '../../lib/cn';
import { Button as UButton } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Skeleton } from '../../components/ui/skeleton';
import { ChevronLeft, ChevronRight, CalendarDays as CalendarIcon } from 'lucide-react';
import CandidateDetail from '../../components/company/CandidateDetail';
import MobileNav from '../../components/company/MobileNav';
import Truncate from '../../components/ui/truncate';

const LOCALES = { vi: 'vi-VN', en: 'en-US', ko: 'ko-KR' };
const dateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function CompanyCalendarPage() {
  const router = useRouter();
  const { t, lang } = useT();
  // Cached values hydrate inside useEffect to avoid SSR/CSR mismatch.
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const locale = LOCALES[lang] || LOCALES.vi;
  const fmtTime = (d) => d.toLocaleTimeString(locale, { timeZone: ICT_TZ, hour: '2-digit', minute: '2-digit', hour12: false });

  useEffect(() => {
    // Hydrate from sessionStorage after mount (avoids SSR/CSR mismatch).
    try {
      const cached = JSON.parse(sessionStorage.getItem('fyi.calendar.v1') || 'null');
      if (cached) {
        setItems(cached.items || []);
        setCompanyName(cached.companyName || '');
        setStatus('ready');
      }
    } catch {}
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
      setCompanyId(rec.company_id);

      // Scope to jobs the user owns or was invited to.
      const accessibleIds = await loadAccessibleJobIds(session.user.id, rec.company_id);
      let jobs = [];
      if (accessibleIds.size > 0) {
        const { data } = await supabase
          .from('jobs').select('id, title').in('id', Array.from(accessibleIds));
        jobs = data || [];
      }
      const jobMap = {};
      jobs.forEach(j => { jobMap[j.id] = j.title; });
      const jobIds = jobs.map(j => j.id);
      if (jobIds.length === 0) { setItems([]); setStatus('ready'); return; }

      const { data: apps } = await supabase
        .from('job_applications')
        .select('id, applicant_name, status, interview_at, interview_location, interview_interviewer, job_id')
        .in('job_id', jobIds)
        .not('interview_at', 'is', null)
        .order('interview_at', { ascending: true });
      const list = (apps || []).map(a => ({ ...a, jobTitle: jobMap[a.job_id] || '—' }));
      setItems(list);
      setStatus('ready');
      try {
        sessionStorage.setItem('fyi.calendar.v1', JSON.stringify({
          items: list, companyName: rec.recruiter_companies?.name || '',
        }));
      } catch {}
    })();
  }, []);

  if (status === 'loading') {
    return (
      <div style={css.app}>
        <Sidebar companyName="" userEmail="" activePage="calendar" />
        <main style={css.main}>
          <div className="space-y-2 mb-3 pb-3 border-b border-border">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-7 w-32 mb-3" />
          <Skeleton className="h-[480px] rounded-lg" />
        </main>
      </div>
    );
  }
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
  // Only fill enough trailing cells to complete the final week — keeps each cell roomy.
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, otherMonth: true, date: new Date(view.year, view.month + 1, nextDay) });
    nextDay++;
  }
  const weekCount = cells.length / 7;

  // 날짜별 items
  const itemsByDate = {};
  items.forEach(it => {
    const d = new Date(it.interview_at);
    const k = dateKey(d);
    if (!itemsByDate[k]) itemsByDate[k] = [];
    itemsByDate[k].push(it);
  });
  Object.values(itemsByDate).forEach(list => list.sort((a, b) => new Date(a.interview_at) - new Date(b.interview_at)));

  const nowMs = Date.now();
  const upcomingCount = items.filter(it => new Date(it.interview_at).getTime() > nowMs).length;
  // Counts scoped to the month currently in view — for the heading row chips.
  const monthItems = items.filter(it => {
    const d = new Date(it.interview_at);
    return d.getFullYear() === view.year && d.getMonth() === view.month;
  });
  const monthDoneCount = monthItems.filter(it => new Date(it.interview_at).getTime() < nowMs).length;
  const monthUpcomingCount = monthItems.length - monthDoneCount;
  const todayKey = dateKey(new Date());

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  const goToday = () => { const d = new Date(); setView({ year: d.getFullYear(), month: d.getMonth() }); };

  // Desktop opens an overlay modal; mobile navigates to a dedicated page so
  // the candidate detail has the full viewport and a real back button.
  const goCandidate = (appId) => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      router.push(`/company/candidates/${appId}`);
    } else {
      setSelectedAppId(appId);
    }
  };

  return (
    <>
      <Head><title>{t('company.head.calendar')}</title></Head>
      <div style={css.app}>
        <Sidebar companyName={companyName} userEmail={user?.email} activePage="calendar" />

        <main style={css.main} className="!h-screen !overflow-hidden flex flex-col">
          <MobileNav active="calendar" companyName={companyName} userEmail={user?.email} />
          {/* PageHeader hides on mobile — MobileNav already labels the page. */}
          <div className="hidden md:block">
          <PageHeader
            title={(
              <span className="flex items-center gap-2.5">
                <CalendarIcon className="w-5 h-5 text-primary-600" />
                {t('company.calendar.h')}
                {upcomingCount > 0 && (
                  <span className="inline-flex items-center min-w-[28px] h-[22px] px-2 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-[12px] font-extrabold tabular-nums">
                    {t('company.unit.items', { n: upcomingCount })}
                  </span>
                )}
              </span>
            )}
            subtitle={t('company.calendar.sub')}
          />
          </div>

          <div className="hidden md:flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-extrabold text-foreground tracking-tight">
                {t('company.calendar.monthLabel', { year: view.year, month: view.month + 1 })}
              </h2>
              <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-green-100 border border-green-200 text-green-800 text-[11.5px] font-extrabold tabular-nums">
                {t('company.calendar.doneChip', { n: monthDoneCount })}
              </span>
              <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-sky-100 border border-sky-200 text-sky-800 text-[11.5px] font-extrabold tabular-nums">
                {t('company.calendar.upcomingChip', { n: monthUpcomingCount })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <UButton variant="outline" size="icon" onClick={prevMonth} title={t('company.calendar.navPrev')} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </UButton>
              <UButton variant="outline" size="sm" onClick={goToday} className="h-8 px-3 text-xs">
                {t('company.calendar.todayBtn')}
              </UButton>
              <UButton variant="outline" size="icon" onClick={nextMonth} title={t('company.calendar.navNext')} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </UButton>
            </div>
          </div>

          <div className="flex-1 min-h-0 hidden md:flex flex-col">
            <div className="grid grid-cols-7 bg-[#F9FAFB] border border-[#E5E8EB] rounded-t-lg overflow-hidden flex-shrink-0">
              {[0,1,2,3,4,5,6].map(i => (
                <div
                  key={i}
                  className={cn(
                    'py-1.5 text-center text-[11px] font-extrabold uppercase tracking-[0.06em]',
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                  )}
                >
                  {t(`company.calendar.weekday.${i}`)}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-7 border-l border-r border-b border-[#E5E8EB] rounded-b-lg overflow-hidden bg-white flex-1 min-h-0"
              style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
            >
            {cells.map((c, i) => {
              const k = dateKey(c.date);
              const isToday = k === todayKey;
              const dayOfWeek = c.date.getDay();
              const dayItems = itemsByDate[k] || [];
              const isRightEdge = (i + 1) % 7 === 0;
              const isFirstRow = i < 7;
              return (
                <div
                  key={i}
                  className={cn(
                    'p-1.5 flex flex-col gap-1 min-h-0',
                    !isFirstRow && 'border-t border-[#E5E8EB]',
                    !isRightEdge && 'border-r border-[#E5E8EB]',
                    c.otherMonth && 'bg-gray-50/50',
                    isToday && 'bg-primary-50/30'
                  )}
                >
                  <div className={cn(
                    'text-xs font-extrabold px-1 py-0.5 tabular-nums flex-shrink-0',
                    c.otherMonth && 'text-gray-300',
                    !c.otherMonth && dayOfWeek === 0 && 'text-red-600',
                    !c.otherMonth && dayOfWeek === 6 && 'text-blue-600',
                    !c.otherMonth && dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-gray-900',
                    isToday && !c.otherMonth && 'text-primary-700 font-black'
                  )}>
                    {isToday && !c.otherMonth ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-[10.5px]">{c.day}</span>
                    ) : c.day}
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0 pr-0.5">
                    {dayItems.map(it => {
                      const time = fmtTime(new Date(it.interview_at));
                      const name = it.applicant_name || t('company.candidatePrefix').replace('#', '').trim();
                      const stageLabel = t(`company.stage.${it.status}`);
                      const isPast = new Date(it.interview_at).getTime() < nowMs;
                      return (
                        <div
                          key={it.id}
                          onClick={() => goCandidate(it.id)}
                          title={`${time} ${stageLabel} · ${name} · ${it.jobTitle}${it.interview_location ? ' · ' + it.interview_location : ''}`}
                          className={cn(
                            'flex items-center gap-1 px-1.5 py-0.5 rounded border-l-2 text-[10.5px] font-bold cursor-pointer transition-colors overflow-hidden',
                            isPast
                              ? 'bg-green-50 border-green-500 text-green-900 hover:bg-green-100'
                              : 'bg-sky-50 border-sky-500 text-sky-900 hover:bg-sky-100'
                          )}
                        >
                          <span className={cn(
                            'font-extrabold tabular-nums flex-shrink-0',
                            isPast ? 'text-green-700' : 'text-sky-700'
                          )}>{time}</span>
                          <span className="truncate min-w-0">{name} · {it.jobTitle}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Mobile chronological list — date-grouped, replaces the calendar grid under md. */}
          <div className="md:hidden flex-1 min-h-0 overflow-y-auto pb-6">
            {items.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-[13px] font-semibold">
                {t('company.calendar.emptyH')}
              </div>
            ) : (() => {
              const groups = {};
              items.forEach(it => {
                const d = new Date(it.interview_at);
                const k = dateKey(d);
                if (!groups[k]) groups[k] = { date: d, items: [] };
                groups[k].items.push(it);
              });
              const orderedKeys = Object.keys(groups).sort((a, b) => groups[a].date - groups[b].date);
              const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowK = dateKey(tomorrow);
              const labelFor = (d, k) => {
                if (k === todayKey) return t('company.calendar.todayBtn');
                if (k === tomorrowK) return t('company.calendar.tomorrow');
                return t('company.calendar.dateLabel', { m: d.getMonth() + 1, d: d.getDate(), w: t(`company.calendar.weekday.${d.getDay()}`) });
              };
              return orderedKeys.map(k => {
                const grp = groups[k];
                return (
                  <section key={k} className="mb-4">
                    <div className="text-[11.5px] font-extrabold text-gray-500 uppercase tracking-[0.06em] mb-2 px-1">
                      {labelFor(grp.date, k)}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {grp.items.map(it => {
                        const time = fmtTime(new Date(it.interview_at));
                        const isPast = new Date(it.interview_at).getTime() < nowMs;
                        const stageLabel = t(`company.stage.${it.status}`);
                        const name = it.applicant_name || t('company.candidatePrefix').replace('#', '').trim();
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => goCandidate(it.id)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors',
                              isPast ? 'bg-green-50 border-green-200 text-green-900' : 'bg-sky-50 border-sky-200 text-sky-900'
                            )}
                          >
                            <span className={cn(
                              'text-[13px] font-extrabold tabular-nums flex-shrink-0 w-12',
                              isPast ? 'text-green-700' : 'text-sky-700'
                            )}>
                              {time}
                            </span>
                            <div className="flex-1 min-w-0">
                              <Truncate as="div" className="text-[14px] font-extrabold text-gray-900" stopPropagation={false}>{name}</Truncate>
                              <Truncate as="div" className="text-[12px] text-gray-700 font-semibold" stopPropagation={false}>{it.jobTitle} · {stageLabel}</Truncate>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              });
            })()}
          </div>
        </main>

        {selectedAppId && (
          <div
            className="fixed inset-0 z-50 bg-gray-900/45 backdrop-blur-[2px]"
            onClick={() => setSelectedAppId(null)}
          >
            <div
              className="absolute top-4 left-4 right-4 bottom-4 bg-background rounded-xl overflow-hidden shadow-soft-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <CandidateDetail
                appId={selectedAppId}
                mode="overlay"
                companyId={companyId}
                onClose={() => setSelectedAppId(null)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

