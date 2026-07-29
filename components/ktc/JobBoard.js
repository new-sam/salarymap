import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';
import Reveal from './Reveal';
import { ANCHOR, BRAND, c, s } from './ktcStyles';

/* 실데이터: /api/ktc/jobs (원본 ktc-landing 과 같은 Supabase 의 jobs, is_active=true).
   정규화는 lib/ktcJobs.js 에서 끝내고 여기서는 표시만 한다.
   상세는 인라인 패널이 아니라 /ktc/jobs/[id] 페이지 전환으로 연다. */

const WORK_TYPE_ORDER = ['Onsite', 'Hybrid', 'Remote'];
/* 한 페이지 개수는 그리드 열 수에 맞춘다 — 데스크톱 3열이면 3x3=9.
   모바일은 1열로 쌓이므로 스크롤이 길어지지 않게 4개만. */
const WIDE_QUERY = '(min-width: 768px)';
const PAGE_SIZE_WIDE = 9;
const PAGE_SIZE_NARROW = 4;

// 급여는 VND 원단위(25000000)로 들어온다. 자릿수 단위가 언어마다 달라 나누는 값도 다르다
// — 한국어는 만(1e4), 베트남어는 triệu(1e6). 25000000 → ko '2,500만 VND' / vi '25 triệu VND'.
export function formatSalary(min, max, lang) {
  const ko = lang === 'ko';
  const div = ko ? 1e4 : 1e6;
  const unit = ko ? '만 VND' : ' triệu VND';
  const n = (v) => Math.round(v / div).toLocaleString('en-US');
  if (min && max) return `${n(min)}–${n(max)}${unit}`;
  if (min) return `${n(min)}${unit}+`;
  if (max) return `~${n(max)}${unit}`;
  return null;
}

export function Meta({ children }) {
  if (!children) return null;
  return (
    <span
      style={{
        padding: '4px 9px',
        borderRadius: 6,
        background: c.surfaceHi,
        border: `1px solid ${c.line}`,
        fontSize: 11.5,
        fontWeight: 700,
        color: c.textDim,
      }}
    >
      {children}
    </span>
  );
}

/* 카드 태그 칩 — 원본 ktc-landing 과 같은 알약 형태. 직무 분류만 파랑, 나머지는 회색. */
function Chip({ children, tone }) {
  if (!children) return null;
  const blue = tone === 'blue';
  return (
    <span
      style={{
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        background: blue ? '#EFF6FF' : c.surfaceHi,
        color: blue ? '#2563EB' : c.textDim,
      }}
    >
      {children}
    </span>
  );
}

/* 원본 카드 순서를 따른다: 직무(가장 크게) → 회사·위치(작게) → 급여(강조) → 태그 칩. */
function JobCard({ job, lang }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, lang);
  return (
    <Link
      href={`/ktc/jobs/${job.id}`}
      className="ktc-job-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 18,
        borderRadius: 14,
        background: c.surface,
        border: `1px solid ${c.line}`,
        boxShadow: '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
        transition: 'border-color .15s, box-shadow .15s',
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        {job.companyLogo && (
          <img
            src={job.companyLogo}
            alt={job.company}
            style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'contain', flexShrink: 0, border: `1px solid ${c.line}`, background: '#fff' }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          {/* 직무명이 2줄을 넘으면 말줄임 — 3열 그리드에서 카드 높이가 들쭉날쭉해지는 걸 막는다.
              title 속성을 같이 둬서 잘린 전체 문구는 호버로 확인할 수 있게 한다. */}
          <p
            title={job.title}
            style={{
              fontSize: 15.5,
              fontWeight: 800,
              color: c.text,
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {job.title}
          </p>
          <p
            title={[job.company, job.location].filter(Boolean).join(' · ')}
            style={{
              marginTop: 3,
              fontSize: 12,
              color: c.textFaint,
              lineHeight: 1.45,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {[job.company, job.location].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {salary && (
        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 800, color: BRAND }}>{salary}</p>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip tone="blue">{job.category}</Chip>
        <Chip>{job.workType}</Chip>
        <Chip>{job.experience}</Chip>
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div style={{ padding: 18, borderRadius: 14, background: c.surface, border: `1px solid ${c.line}` }}>
      {[40, 78, 58].map((w, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            height: i === 1 ? 14 : 10,
            width: `${w}%`,
            marginTop: i ? 10 : 0,
            borderRadius: 4,
            background: c.surfaceHi,
          }}
        />
      ))}
    </div>
  );
}

/* 네이티브 <select> 는 macOS/iOS 에서 OS 가 드롭다운을 직접 그려 테마가 적용되지
   않는다. lib/i18n.js 의 LanguageSwitcher 와 같은 방식으로 직접 그린다. */
function WorkTypeSelect({ value, options, onChange, allLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [{ key: 'all', label: allLabel }, ...options.map((o) => ({ key: o, label: o }))];
  const current = items.find((i) => i.key === value) || items[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: 9,
          background: c.surface,
          border: `1px solid ${open ? 'rgba(255,96,0,0.45)' : c.line}`,
          color: c.text,
          fontSize: 13,
          fontWeight: 650,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {current.label}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 60,
            minWidth: '100%',
            padding: 4,
            borderRadius: 10,
            background: c.surface,
            border: `1px solid ${c.lineStrong}`,
            boxShadow: '0 10px 28px rgba(17,24,39,0.14)',
          }}
        >
          {items.map((i) => {
            const on = i.key === value;
            return (
              <button
                key={i.key}
                role="option"
                aria-selected={on}
                onClick={() => { onChange(i.key); setOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 12px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                  fontWeight: on ? 750 : 600,
                  fontFamily: 'inherit',
                  background: on ? 'rgba(255,96,0,0.10)' : 'transparent',
                  color: on ? BRAND : c.textDim,
                }}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  // 페이지가 많아도 버튼은 최대 5개만 — 좁은 화면에서 줄바꿈되지 않게
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const nums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  const btn = (on) => ({
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: on ? 800 : 650,
    fontFamily: 'inherit',
    background: on ? BRAND : c.surface,
    border: `1px solid ${on ? BRAND : c.line}`,
    color: on ? '#fff' : c.textDim,
  });

  const Arrow = ({ dir, to, disabled }) => (
    <button
      onClick={() => onChange(to)}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
      style={{ ...btn(false), display: 'grid', placeItems: 'center', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  );

  return (
    <div style={{ marginTop: 24, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
      <Arrow dir="prev" to={page - 1} disabled={page === 1} />
      {nums.map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined} style={btn(n === page)}>
          {n}
        </button>
      ))}
      <Arrow dir="next" to={page + 1} disabled={page === totalPages} />
    </div>
  );
}

export default function JobBoard() {
  const { t, lang } = useT();
  const [jobs, setJobs] = useState(null); // null = 로딩 중
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState('all');
  const [workType, setWorkType] = useState('all');
  const [page, setPage] = useState(1);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/ktc/jobs')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setJobs(d.jobs || []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  // 근무 형태 옵션은 실제 데이터에 있는 값만 — 비어 있는 필터를 노출하지 않는다
  const workTypes = useMemo(() => {
    const present = new Set((jobs || []).map((j) => j.workType).filter(Boolean));
    return WORK_TYPE_ORDER.filter((w) => present.has(w));
  }, [jobs]);

  const filtered = useMemo(
    () =>
      (jobs || []).filter(
        (j) =>
          (category === 'all' || j.group === (category === 'it' ? 'IT' : 'Non-IT')) &&
          (workType === 'all' || j.workType === workType)
      ),
    [jobs, category, workType]
  );

  const pageSize = wide ? PAGE_SIZE_WIDE : PAGE_SIZE_NARROW;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  // 필터가 바뀌거나 화면 폭이 바뀌어 페이지 수가 줄면 첫 페이지로
  useEffect(() => { setPage(1); }, [category, workType, wide]);
  useEffect(() => { setPage((p) => (p > totalPages ? 1 : p)); }, [totalPages]);

  const loading = jobs === null && !failed;

  const goPage = (n) => {
    setPage(n);
    // 페이지를 넘기면 목록 중간이 아니라 섹션 머리부터 보이게
    document.getElementById(ANCHOR.jobs)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id={ANCHOR.jobs} className="ktc-anchor" style={s.sectionAlt}>
      <div style={s.container}>
        <Reveal>
          <h2 style={s.h2}>{t('ktc.jobs.title')}</h2>
          <p style={s.sub}>{t('ktc.jobs.sub')}</p>
        </Reveal>

        {/* 필터 바 */}
        <div style={{ marginTop: 30, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: c.surfaceHi, border: `1px solid ${c.line}` }}>
            {[
              { key: 'all', label: t('ktc.jobs.filter.all') },
              { key: 'it', label: t('ktc.jobs.filter.it') },
              { key: 'nonit', label: t('ktc.jobs.filter.nonit') },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setCategory(f.key)}
                style={{
                  padding: '7px 15px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 750,
                  fontFamily: 'inherit',
                  background: category === f.key ? BRAND : 'transparent',
                  color: category === f.key ? '#fff' : c.textDim,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {workTypes.length > 0 && (
            <WorkTypeSelect
              value={workType}
              options={workTypes}
              onChange={setWorkType}
              allLabel={t('ktc.jobs.worktype.all')}
            />
          )}

          {!loading && !failed && (
            <span style={{ marginLeft: 'auto', fontSize: 13, color: c.textFaint }}>
              {t('ktc.jobs.count', { n: filtered.length })}
            </span>
          )}
        </div>

        {/* 목록 — 상세는 /ktc/jobs/[id] 로 페이지 전환 */}
        <div className="ktc-job-grid">
          {loading ? (
            Array.from({ length: pageSize }, (_, i) => <CardSkeleton key={i} />)
          ) : failed ? (
            <p style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: c.textFaint, fontSize: 14 }}>
              {t('ktc.jobs.error')}
            </p>
          ) : filtered.length === 0 ? (
            <p style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center', color: c.textFaint, fontSize: 14 }}>
              {t('ktc.jobs.empty')}
            </p>
          ) : (
            visible.map((job) => <JobCard key={job.id} job={job} lang={lang} />)
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onChange={goPage} />
      </div>
    </section>
  );
}
