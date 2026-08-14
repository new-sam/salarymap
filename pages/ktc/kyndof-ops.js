import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Meta } from '../../components/ktc/JobBoard';
import { BRAND, c, s } from '../../components/ktc/ktcStyles';
import { fetchKtcJob } from '../../lib/ktcJobs';

/* KYNDOF 운영 직군 광고 랜딩 — 광고 1개에 랜딩 1개가 필요해서 운영 공고 2개(KYN4005·KYN4007)를
   한 페이지에 담는다. 카드 → JD 상세로 넘어갈 때 utm_* 쿼리를 그대로 전달해야
   지원 시점(KtcApply 가 live query 를 읽는다)까지 광고 귀속이 살아남는다. */
const JOB_IDS = [
  '2df9a9fc-9201-45f3-8013-cfc9e8aece5d', // KYN4005 Atelier 사업·프로젝트 운영
  '25fb7a60-cda4-4202-a4d9-c8bec39e7d6a', // KYN4007 리서치·운영 Associate
];

// 카드 요약 — JD의 "Giới thiệu vị trí" 를 한 문장으로 줄인 것(설명 원문은 회사 소개로 시작해
// 두 카드가 같은 문장으로 보이므로 description 슬라이스는 쓰지 않는다).
const SUMMARY = {
  '2df9a9fc-9201-45f3-8013-cfc9e8aece5d':
    'Quản lý CRM, báo giá, lịch trình và tài liệu để các dự án sản xuất trang phục cho nghệ sĩ của 2000Atelier được vận hành trọn vẹn đến khi giao hàng và quyết toán.',
  '25fb7a60-cda4-4202-a4d9-c8bec39e7d6a':
    'Phụ trách nghiên cứu thị trường, doanh nghiệp và tuyển dụng, soạn thảo brief/memo và theo dõi tiếp nối cho CEO và Chief of Staff.',
};

export async function getServerSideProps({ res }) {
  try {
    const jobs = (await Promise.all(JOB_IDS.map((id) => fetchKtcJob(id)))).filter(Boolean);
    if (!jobs.length) return { notFound: true };
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return { props: { jobs } };
  } catch (e) {
    console.error('kyndof-ops landing:', e);
    return { notFound: true };
  }
}

export default function KyndofOpsLanding({ jobs }) {
  const { query } = useRouter();
  // JD 상세로 넘길 광고 귀속 파라미터만 추린다
  const utm = Object.fromEntries(Object.entries(query).filter(([k]) => k.startsWith('utm_')));

  return (
    <>
      <Head>
        <title>KYNDOF · Collective — Vị trí Vận hành đang tuyển | K-Tech College 2026</title>
        <meta
          name="description"
          content="KYNDOF — công ty Hàn Quốc vận hành 2000Archives · 2000Atelier · Collective — đang tuyển các vị trí vận hành tại Việt Nam."
        />
      </Head>

      <div className="ktc-page" style={{ background: c.bg, color: c.text, minHeight: '100vh' }}>
        <div style={{ ...s.container, padding: '40px clamp(18px, 4vw, 40px) 80px', maxWidth: 760 }}>
          <p style={{ fontSize: 14, fontWeight: 750, color: BRAND }}>KYNDOF · Collective</p>
          <h1
            style={{
              marginTop: 10,
              fontSize: 'clamp(24px, 4vw, 34px)',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
              wordBreak: 'keep-all',
            }}
          >
            Vị trí Vận hành đang tuyển
          </h1>
          <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.65, color: c.textDim }}>
            KYNDOF — công ty Hàn Quốc vận hành thương hiệu thời trang <b>2000Archives</b>, tổ chức sản
            xuất trang phục theo yêu cầu <b>2000Atelier</b> và marketplace thời trang C2C{' '}
            <b>Collective</b> — đang tuyển đồng thời 2 vị trí vận hành (HCM · Đà Nẵng · Hà Nội).
          </p>

          <div style={{ marginTop: 26, display: 'grid', gap: 14 }}>
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={{ pathname: `/ktc/jobs/${job.id}`, query: utm }}
                style={{
                  display: 'block',
                  padding: 'clamp(18px, 3vw, 24px)',
                  borderRadius: 14,
                  border: `1px solid ${c.line}`,
                  background: c.bgAlt,
                  color: c.text,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {job.companyLogo && (
                    <img
                      src={job.companyLogo}
                      alt={job.company}
                      style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'contain', border: `1px solid ${c.line}`, background: '#fff', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: BRAND }}>{job.company}</p>
                    <p style={{ marginTop: 2, fontSize: 16.5, fontWeight: 800, lineHeight: 1.35, wordBreak: 'keep-all' }}>{job.title}</p>
                  </div>
                </div>
                <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6, color: c.textDim }}>{SUMMARY[job.id]}</p>
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Meta>{job.location}</Meta>
                  {job.experience && <Meta>{job.experience}</Meta>}
                  {job.jobId && <Meta>Job ID: {job.jobId}</Meta>}
                </div>
                <span
                  style={{
                    marginTop: 14,
                    display: 'inline-block',
                    padding: '11px 22px',
                    borderRadius: 10,
                    background: BRAND,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 750,
                  }}
                >
                  Xem chi tiết &amp; Ứng tuyển →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
