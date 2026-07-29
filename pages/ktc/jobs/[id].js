import Head from 'next/head';
import Link from 'next/link';
import ComingSoonModal from '../../../components/ktc/ComingSoonModal';
import { Meta, formatSalary } from '../../../components/ktc/JobBoard';
import { BRAND, c, openApplySoon, s } from '../../../components/ktc/ktcStyles';
import { useT } from '../../../lib/i18n';
import { fetchKtcJob } from '../../../lib/ktcJobs';

/* 공고 상세 — 랜딩 안의 인라인 패널이 아니라 독립 페이지.
   서버에서 읽어 넣으므로 공고 본문이 초기 HTML 에 들어간다(공유·검색 대응). */
export async function getServerSideProps({ params, res }) {
  try {
    const job = await fetchKtcJob(params.id);
    if (!job) return { notFound: true };
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return { props: { job } };
  } catch (e) {
    console.error('ktc job detail:', e);
    return { notFound: true };
  }
}

export default function KtcJobDetail({ job }) {
  const { t, lang } = useT();

  const blocks = [
    { key: 'description', title: t('ktc.jobs.jd.about'), body: job.description },
    { key: 'responsibilities', title: t('ktc.jobs.jd.resp'), body: job.responsibilities },
    { key: 'requirements', title: t('ktc.jobs.jd.req'), body: job.requirements },
    { key: 'benefits', title: t('ktc.jobs.jd.benefit'), body: job.benefits },
  ].filter((b) => b.body);

  const title = `${job.title} · ${job.company} | K-Tech College 2026`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={(job.description || '').slice(0, 155)} />
      </Head>

      <div className="ktc-page" style={{ background: c.bg, color: c.text, minHeight: '100vh' }}>
        <div className="ktc-jd-pad" style={{ ...s.container, paddingTop: 28 }}>
          <Link
            href="/ktc#jobs"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: c.textDim }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            {t('ktc.jobs.backToList')}
          </Link>

          <div className="ktc-jd" style={{ marginTop: 20 }}>
            {/* 본문 */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {job.companyLogo && (
                  <img
                    src={job.companyLogo}
                    alt={job.company}
                    style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'contain', border: `1px solid ${c.line}`, background: '#fff', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 750, color: BRAND }}>{job.company}</p>
                  {job.jobId && <p style={{ marginTop: 2, fontSize: 12, color: c.textFaint }}>Job ID: {job.jobId}</p>}
                </div>
              </div>

              <h1
                style={{
                  marginTop: 16,
                  fontSize: 'clamp(22px, 3.2vw, 32px)',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.3,
                  color: c.text,
                  wordBreak: 'keep-all',
                }}
              >
                {job.title}
              </h1>

              <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Meta>{job.workType}</Meta>
                <Meta>{job.location}</Meta>
                <Meta>{job.category}</Meta>
                <Meta>{job.experience}</Meta>
                <Meta>{formatSalary(job.salaryMin, job.salaryMax, lang)}</Meta>
                {job.headcount ? <Meta>{`×${job.headcount}`}</Meta> : null}
              </div>

              {job.companyWebsite && (
                <a
                  className="ktc-jd-site-inline"
                  href={job.companyWebsite}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: BRAND }}
                >
                  {t('ktc.jobs.companySite')}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M8 7h9v9" />
                  </svg>
                </a>
              )}

              <div style={{ marginTop: 34, display: 'grid', gap: 26 }}>
                {blocks.map((b) => (
                  <div key={b.key}>
                    <h2 style={{ fontSize: 15.5, fontWeight: 800, color: c.text }}>{b.title}</h2>
                    {/* 본문은 줄바꿈과 "- " 불릿이 섞인 평문 — pre-line 으로 원문 줄바꿈을 살린다 */}
                    <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.8, color: c.textDim, whiteSpace: 'pre-line' }}>
                      {b.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 지원 패널 — 넓은 화면에서는 오른쪽에 붙어 따라온다 */}
            <aside className="ktc-jd-side">
              <div style={{ ...s.card, padding: 22 }}>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, color: c.textDim }}>{t('ktc.jobs.sub')}</p>
                <button style={{ ...s.btnPrimary, width: '100%', marginTop: 16 }} onClick={openApplySoon}>
                  {t('ktc.jobs.apply')} →
                </button>
                {job.companyWebsite && (
                  <a
                    href={job.companyWebsite}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ ...s.btnGhost, width: '100%', marginTop: 8, padding: '12px 20px', fontSize: 13.5 }}
                  >
                    {t('ktc.jobs.companySite')}
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* 모바일 — 상단 패널 대신 하단 고정 바. 본문 공간을 뺏지 않으면서 항상 손에 닿는다. */}
      <div className="ktc-jd-bar">
        <button style={{ ...s.btnPrimary, width: '100%' }} onClick={openApplySoon}>
          {t('ktc.jobs.apply')} →
        </button>
      </div>

      <ComingSoonModal />

      <style>{`
        /* 모바일: 사이드 패널을 감추고 하단 고정 바로 대체 — 상단을 차지하지 않는다.
           바 높이만큼 본문 아래 여백을 줘서 마지막 내용이 가리지 않게 한다. */
        /* 바 높이 = 위아래 padding 10 + 버튼 48. 푸터 여백 계산과 한 값을 공유한다. */
        :root { --ktc-jd-bar: 68px; }
        .ktc-jd { display: grid; grid-template-columns: 1fr; gap: 28px; }
        .ktc-jd-side { display: none; }
        .ktc-jd-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 300;
          padding: 10px clamp(16px, 4vw, 24px) calc(10px + env(safe-area-inset-bottom));
          background: rgba(255,255,255,0.94);
          backdrop-filter: blur(12px);
          border-top: 1px solid ${c.line};
        }
        /* 본문 ↔ 푸터 여백. GlobalFooter 의 marginTop 은 투명이라 body 흰색이 드러나는데
           이 페이지 배경은 #f9f9f9 라 흰 띠가 낀다 → 마진을 끄고 배경 안쪽 padding 으로 준다. */
        .gfooter { margin-top: 0 !important; }
        .ktc-jd-pad { padding-bottom: 64px; }

        /* 하단 고정 바는 뷰포트 바닥에 떠 있어서 스크롤 끝에서 푸터를 덮는다.
           본문 쪽 padding 으로는 못 막는다(푸터가 본문 뒤에 오므로) → 푸터 자체를 띄운다.
           푸터는 _app.js 에서 인라인 padding 으로 그려져 !important 없이는 이기지 못한다. */
        @media (max-width: 899px) {
          footer { padding-bottom: calc(24px + var(--ktc-jd-bar) + env(safe-area-inset-bottom)) !important; }
        }

        @media (min-width: 900px) {
          .ktc-jd { grid-template-columns: minmax(0, 1fr) 320px; gap: 40px; align-items: start; }
          /* 헤더(56) + 여유. 본문이 길어도 지원 버튼이 따라온다. */
          .ktc-jd-side { display: block; position: sticky; top: 80px; }
          .ktc-jd-bar { display: none; }
          .ktc-jd-pad { padding-bottom: clamp(64px, 8vw, 104px); }
          /* 사이드 패널에 같은 링크가 있어 본문 인라인 링크는 감춘다 */
          .ktc-jd-site-inline { display: none !important; }
        }
      `}</style>
    </>
  );
}
