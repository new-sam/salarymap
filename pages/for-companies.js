import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

function CountUp({ end, decimals = 0, duration = 1200, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const run = () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      let start = null;
      const tick = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setVal(end * eased);
        if (progress < 1) animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) run();
    }, { threshold: 0.25 });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [end, duration]);

  const formatted = decimals ? val.toFixed(decimals) : Math.floor(val).toLocaleString();
  return <span ref={ref}>{formatted}{suffix && <span style={css.unit}>{suffix}</span>}</span>;
}

function Mark({ v }) {
  if (v === 'o') return <span style={css.markYes} title="지원">✓</span>;
  if (v === 'x') return <span style={css.markNo} title="미지원">×</span>;
  return null;
}

function Lines({ lines }) {
  return (
    <>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </>
  );
}

const offers = [
  ['01', '공고 노출', ['게재비 0원', '채용 페이지 게시']],
  ['02', '후보 추천', ['조건 맞는', '후보 선별']],
  ['03', '면접 관리', ['상태·요청', '평가 관리']],
  ['04', '유지 보증', ['3개월 미유지', '수수료 0원']],
];

const steps = [
  {
    no: '01',
    title: '공고를 올립니다',
    desc: ['직무와 조건만 입력하면', '채용 페이지에 바로 노출됩니다.'],
    img: '/ats-preview/jobs-public.png',
  },
  {
    no: '02',
    title: '조건에 맞는 후보를 확인합니다',
    desc: ['FYI가 후보를 모으고', '진행 상태를 정리합니다.'],
    img: '/ats-preview/ats-kanban-masked.png',
    reverse: true,
  },
  {
    no: '03',
    title: '이력서를 보고 결정합니다',
    desc: ['이력서와 평가 메모를 보고', '합격 여부를 결정합니다.'],
    img: '/ats-preview/ats-candidate-detail-masked.png',
  },
];

export default function ForCompanies() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>FYI for Companies · 베트남 IT 채용을 7일 안에</title>
        <meta
          name="description"
          content="공고 등록비 없이 베트남 IT 후보를 만나보세요. FYI가 후보 추천, 면접 진행, ATS 관리를 돕고 채용 성공 시에만 7%를 청구합니다."
        />
      </Head>
      <style>{`
        section {
          scroll-margin-top: 96px;
        }
        .fc-kpi strong {
          color: #ea580c;
          font-size: clamp(46px, 7vw, 82px);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }
        @media (max-width: 900px) {
          .fc-hero {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding: 56px 20px 42px !important;
            text-align: center !important;
          }
          .fc-hero-copy {
            justify-self: center !important;
          }
          .fc-hero-ctas,
          .fc-trust {
            justify-content: center !important;
          }
          .fc-float-card {
            left: 12px !important;
            bottom: 16px !important;
          }
          .fc-kpis {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 28px 20px 44px !important;
          }
          .fc-offer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .fc-step,
          .fc-step-reverse {
            grid-template-columns: 1fr !important;
            direction: ltr !important;
            gap: 22px !important;
          }
          .fc-offer-flow {
            flex-wrap: wrap !important;
          }
        }
        @media (max-width: 560px) {
          .fc-company-nav {
            padding: 12px 16px !important;
            gap: 10px !important;
          }
          .fc-company-nav-links {
            order: 3 !important;
            width: 100% !important;
            justify-content: center !important;
            gap: 16px !important;
          }
          .fc-hero h1 {
            font-size: 42px !important;
          }
          .fc-hero-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .fc-hero-ctas button {
            width: 100% !important;
          }
          .fc-offer-grid {
            grid-template-columns: 1fr !important;
          }
          .fc-offer-grid article {
            min-height: 188px !important;
            transform: none !important;
          }
          .fc-float-card {
            position: static !important;
            width: 100% !important;
            margin-top: 12px !important;
          }
        }
        .fc-offer-flow b {
          display: block;
          width: 46px;
          height: 1px;
          background: linear-gradient(90deg, rgba(234,88,12,0.18), rgba(234,88,12,0.8));
        }
      `}</style>
      <div style={css.page}>
        <nav className="fc-company-nav" style={css.nav}>
          <Link href="/" style={css.logo}>
            <span style={css.logoMark}>F</span>
            <span>salary-fyi <span style={css.logoSub}>for companies</span></span>
          </Link>
          <div className="fc-company-nav-links" style={css.navLinks}>
            <a href="#offer" style={css.navLink}>제공 내용</a>
            <a href="#how" style={css.navLink}>진행 방식</a>
            <a href="#pricing" style={css.navLink}>요금</a>
          </div>
          <div style={css.navRight}>
            <Link href="/company" style={css.btnGhost}>기업 로그인</Link>
            <Link href="/company" style={css.btnPrimary}>무료로 공고 올리기</Link>
          </div>
        </nav>

        <main>
          <section className="fc-hero" style={css.hero}>
            <div className="fc-hero-copy" style={css.heroCopy}>
              <div style={css.eyebrow}>FOR COMPANIES</div>
              <h1 style={css.h1}>
                베트남 IT 채용,<br />
                <span style={css.highlight}>7일이면</span> 됩니다.
              </h1>
              <p style={css.lead}>
                공고만 올리면 후보 추천부터 면접 관리까지 FYI가 정리합니다.
              </p>
              <div className="fc-hero-ctas" style={css.heroCtas}>
                <button type="button" onClick={() => router.push('/company')} style={css.btnAccent}>
                  무료로 공고 올리기
                </button>
                <a href="#offer" style={css.textLink}>제공 내용 보기 →</a>
              </div>
              <div className="fc-trust" style={css.trustLine}>
                <span>등록비 0원</span>
                <span>성공 시 7%</span>
              </div>
            </div>

            <div style={css.heroVisual}>
              <img src="/LION.png" alt="FYI 후보 인터뷰" style={css.heroImg} />
              <div className="fc-float-card" style={css.floatCard}>
                <span style={css.floatLabel}>FYI DATA</span>
                <strong>15,723명 연봉 정보</strong>
                <small>베트남 IT 인재 매칭에 활용</small>
              </div>
            </div>
          </section>

          <section className="fc-kpis" style={css.kpiStrip}>
            <div className="fc-kpi" style={css.kpi}>
              <strong><CountUp end={7.3} decimals={1} suffix="일" /></strong>
              <span>첫 면접까지 평균</span>
            </div>
            <div className="fc-kpi" style={css.kpi}>
              <strong><CountUp end={0} suffix="원" /></strong>
              <span>공고 등록비</span>
            </div>
            <div className="fc-kpi" style={css.kpi}>
              <strong><CountUp end={15723} suffix="명" /></strong>
              <span>연봉 정보 확보</span>
            </div>
          </section>

          <section id="offer" style={css.offer}>
            <div style={css.sectionHead}>
              <div style={css.eyebrowDark}>WHAT YOU GET</div>
              <h2 style={css.h2Dark}>
                공고 하나로<br />
                여기까지 받습니다.
              </h2>
            </div>
            <div className="fc-offer-grid" style={css.offerGrid}>
              {offers.map(([no, title, desc], idx) => (
                <article key={title} style={{ ...css.offerCard, ...([0, 1, 3].includes(idx) ? css.offerCardKey : null) }}>
                  <div style={css.offerTop}>
                    <span style={css.offerNo}>{no}</span>
                    {idx === 0 && <span style={css.offerBadge}>게재비 0원</span>}
                    {idx === 1 && <span style={css.offerBadge}>핵심</span>}
                    {idx === 3 && <span style={css.offerBadge}>보증</span>}
                  </div>
                  <h3 style={css.offerTitle}>{title}</h3>
                  <p style={css.offerDesc}><Lines lines={desc} /></p>
                </article>
              ))}
            </div>
            <div className="fc-offer-flow" style={css.offerFlow}>
              <span>공고</span>
              <b />
              <span>후보</span>
              <b />
              <span>면접</span>
              <b />
              <span>채용</span>
            </div>
          </section>

          <section id="how" style={css.darkSection}>
            <div style={css.sectionHead}>
              <div style={css.eyebrow}>HOW IT WORKS</div>
              <h2 style={css.h2}>
                공고 등록부터<br />
                후보 결정까지
              </h2>
            </div>
            <div style={css.steps}>
              {steps.map((step) => (
                <article key={step.no} className={step.reverse ? 'fc-step-reverse' : 'fc-step'} style={{ ...css.step, ...(step.reverse ? css.stepReverse : null) }}>
                  <div style={css.stepText}>
                    <span style={css.stepNo}>{step.no}</span>
                    <h3 style={css.stepTitle}>{step.title}</h3>
                    <p style={css.stepDesc}><Lines lines={step.desc} /></p>
                  </div>
                  <div style={css.shotWrap}>
                    <img src={step.img} alt={step.title} style={css.shot} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="pricing" style={css.compare}>
            <div style={css.sectionHead}>
              <div style={css.eyebrow}>PRICING</div>
              <h2 style={css.h2}>
                선결제 부담 없이<br />
                성공 기준으로
              </h2>
            </div>
            <div style={css.tableWrap}>
              <table style={css.table}>
                <thead>
                  <tr>
                    <th style={css.thFeature}>항목</th>
                    <th style={css.th}>채용 플랫폼</th>
                    <th style={css.th}>헤드헌팅</th>
                    <th style={{ ...css.th, ...css.thFyi }}>FYI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={css.tdFeature}>공고 등록비</td>
                    <td style={css.td}>유료</td>
                    <td style={css.td}>없음</td>
                    <td style={css.tdFyi}>무료</td>
                  </tr>
                  <tr>
                    <td style={css.tdFeature}>성공 수수료</td>
                    <td style={css.td}>-</td>
                    <td style={css.td}>연봉 15~25%</td>
                    <td style={css.tdFyi}>연봉 7%</td>
                  </tr>
                  <tr>
                    <td style={css.tdFeature}>연봉 데이터 기반 추천</td>
                    <td style={css.td}><Mark v="x" /></td>
                    <td style={css.td}><Mark v="x" /></td>
                    <td style={css.tdFyi}><Mark v="o" /></td>
                  </tr>
                  <tr>
                    <td style={css.tdFeature}>첫 면접까지</td>
                    <td style={css.td}>2~4주</td>
                    <td style={css.td}>1~3주</td>
                    <td style={css.tdFyi}>평균 7.3일</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section style={css.bottomCta}>
            <h2 style={css.h2}>
              첫 공고를<br />
              무료로 올려보세요.
            </h2>
            <p style={css.ctaSub}>회사 이메일 인증 후 바로 시작할 수 있습니다.</p>
            <button type="button" onClick={() => router.push('/company')} style={css.btnAccent}>
              기업 계정 만들기
            </button>
          </section>
        </main>
      </div>
    </>
  );
}

const css = {
  page: {
    minHeight: '100vh',
    background: '#090909',
    color: '#fff',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    WebkitFontSmoothing: 'antialiased',
  },
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: '14px clamp(18px, 4vw, 40px)',
    background: 'rgba(9,9,9,0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexWrap: 'wrap',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    fontWeight: 850,
    color: '#fff',
    textDecoration: 'none',
  },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 13,
    fontWeight: 900,
  },
  logoSub: { color: 'rgba(255,255,255,0.48)', fontSize: 12, fontWeight: 600, marginLeft: 4 },
  navLinks: { display: 'flex', gap: 22, fontSize: 13, color: 'rgba(255,255,255,0.64)' },
  navLink: { textDecoration: 'none', fontWeight: 700 },
  navRight: { display: 'flex', gap: 8, marginLeft: 'auto' },
  btnGhost: {
    padding: '9px 13px',
    borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 750,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  btnPrimary: {
    padding: '9px 14px',
    borderRadius: 7,
    background: '#fff',
    color: '#111',
    fontSize: 12.5,
    fontWeight: 850,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.18fr) minmax(300px, 0.82fr)',
    gap: 56,
    alignItems: 'center',
    maxWidth: 'none',
    margin: '0 auto',
    padding: '86px max(32px, calc((100vw - 1240px) / 2 + 32px)) 54px',
    background: '#f7f7f5',
    color: '#151515',
  },
  heroCopy: { minWidth: 0 },
  eyebrow: {
    color: '#fb923c',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  eyebrowDark: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  h1: {
    margin: 0,
    maxWidth: 680,
    fontSize: 'clamp(48px, 6.1vw, 80px)',
    lineHeight: 1.03,
    fontWeight: 950,
    letterSpacing: '-0.035em',
  },
  highlight: {
    color: '#ea580c',
    background: 'linear-gradient(180deg, transparent 58%, rgba(249,115,22,0.22) 58%)',
    borderRadius: 6,
    padding: '0 8px',
  },
  lead: {
    maxWidth: 560,
    margin: '22px 0 0',
    color: '#4b5563',
    fontSize: 18,
    lineHeight: 1.55,
    fontWeight: 650,
  },
  heroCtas: { display: 'flex', alignItems: 'center', gap: 18, marginTop: 28, flexWrap: 'wrap' },
  btnAccent: {
    border: 0,
    borderRadius: 999,
    padding: '17px 30px',
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    color: '#fff',
    fontSize: 15.5,
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 14px 34px rgba(249,115,22,0.32)',
  },
  textLink: { color: '#222', textDecoration: 'none', fontSize: 14, fontWeight: 850 },
  trustLine: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 22,
    color: '#555',
    fontSize: 12.5,
    fontWeight: 750,
  },
  heroVisual: {
    position: 'relative',
    justifySelf: 'center',
    width: 'min(100%, 430px)',
  },
  heroImg: {
    width: '100%',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    display: 'block',
    borderRadius: 32,
    boxShadow: '0 30px 70px rgba(17,17,17,0.13), 0 0 0 1px rgba(0,0,0,0.04)',
  },
  floatCard: {
    position: 'absolute',
    left: -18,
    bottom: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    width: 220,
    padding: '14px 16px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.94)',
    color: '#111',
    boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
  },
  floatLabel: { color: '#ea580c', fontSize: 11, fontWeight: 900 },
  kpiStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    maxWidth: 'none',
    margin: '0 auto',
    padding: '30px max(32px, calc((100vw - 1240px) / 2 + 32px)) 46px',
    background: '#f7f7f5',
    color: '#151515',
    borderTop: '1px solid rgba(0,0,0,0.07)',
  },
  kpi: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    textAlign: 'center',
  },
  unit: { fontSize: '0.46em', marginLeft: 5, opacity: 0.56 },
  offer: {
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 18% 18%, rgba(249,115,22,0.14), transparent 26%),' +
      'linear-gradient(180deg, #fff 0%, #f6f4ef 100%)',
    color: '#111',
    padding: '78px 32px 84px',
  },
  sectionHead: { maxWidth: 760, margin: '0 auto 38px', textAlign: 'center' },
  h2: {
    margin: 0,
    color: '#fff',
    fontSize: 'clamp(28px, 4vw, 42px)',
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: '-0.025em',
  },
  h2Dark: {
    margin: 0,
    color: '#111',
    fontSize: 'clamp(28px, 4vw, 42px)',
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: '-0.025em',
  },
  offerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    maxWidth: 1120,
    margin: '0 auto',
  },
  offerCard: {
    position: 'relative',
    minHeight: 188,
    padding: '22px 22px 24px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 18px 44px rgba(17,17,17,0.08)',
    overflow: 'hidden',
  },
  offerCardKey: {
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,247,237,0.94))',
    border: '1px solid rgba(249,115,22,0.34)',
    boxShadow: '0 24px 54px rgba(249,115,22,0.16)',
  },
  offerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 42,
  },
  offerNo: {
    display: 'grid',
    placeItems: 'center',
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#ef4444,#f97316)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 950,
    boxShadow: '0 12px 28px rgba(249,115,22,0.28)',
  },
  offerBadge: {
    padding: '6px 9px',
    borderRadius: 999,
    background: '#fff7ed',
    color: '#ea580c',
    fontSize: 11,
    fontWeight: 900,
    border: '1px solid rgba(249,115,22,0.22)',
  },
  offerTitle: { margin: '0 0 12px', fontSize: 24, lineHeight: 1.1, fontWeight: 950, letterSpacing: '-0.025em' },
  offerDesc: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    margin: 0,
    color: 'inherit',
    opacity: 0.68,
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 700,
    wordBreak: 'keep-all',
    overflowWrap: 'normal',
  },
  offerFlow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    maxWidth: 640,
    margin: '34px auto 0',
    color: '#525252',
    fontSize: 13,
    fontWeight: 900,
  },
  darkSection: { padding: '84px 32px 60px', maxWidth: 1240, margin: '0 auto' },
  steps: { display: 'flex', flexDirection: 'column', gap: 62 },
  step: {
    display: 'grid',
    gridTemplateColumns: '0.72fr 1.28fr',
    alignItems: 'center',
    gap: 44,
  },
  stepReverse: { gridTemplateColumns: '1.28fr 0.72fr', direction: 'rtl' },
  stepText: { direction: 'ltr' },
  stepNo: { color: '#fb923c', fontSize: 13, fontWeight: 900 },
  stepTitle: { margin: '14px 0 12px', fontSize: 30, lineHeight: 1.22, fontWeight: 900 },
  stepDesc: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    margin: 0,
    color: 'rgba(255,255,255,0.64)',
    fontSize: 15,
    lineHeight: 1.62,
    wordBreak: 'keep-all',
  },
  shotWrap: {
    direction: 'ltr',
    overflow: 'hidden',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 70px rgba(0,0,0,0.42)',
  },
  shot: { display: 'block', width: '100%', height: 'auto' },
  compare: { padding: '70px 32px 80px', maxWidth: 1160, margin: '0 auto' },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 16,
    background: '#141416',
    border: '1px solid rgba(255,255,255,0.09)',
  },
  table: { width: '100%', minWidth: 680, borderCollapse: 'collapse' },
  th: {
    padding: '18px 16px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.54)',
    fontSize: 12.5,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  thFeature: {
    padding: '18px 22px',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12.5,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  thFyi: { color: '#fb923c', fontWeight: 900 },
  td: {
    padding: '18px 16px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontWeight: 700,
  },
  tdFeature: {
    padding: '18px 22px',
    color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontWeight: 850,
  },
  tdFyi: {
    padding: '18px 16px',
    textAlign: 'center',
    color: '#fb923c',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(249,115,22,0.08)',
    fontWeight: 950,
  },
  markYes: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#0eba9a',
    color: '#fff',
    fontWeight: 900,
  },
  markNo: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.36)',
    fontWeight: 900,
  },
  bottomCta: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '58px 32px 82px',
    textAlign: 'center',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  ctaSub: { color: 'rgba(255,255,255,0.62)', margin: '14px 0 26px', fontSize: 15 },
};
