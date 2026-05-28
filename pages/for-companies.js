import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Brand from '../components/company/Brand';
import { useT, LanguageSwitcher } from '../lib/i18n';

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

function Mark({ v, t }) {
  if (v === 'o') return <span style={css.markYes} title={t('company.stat.apps')}>✓</span>;
  if (v === 'x') return <span style={css.markNo} title="">×</span>;
  return null;
}

const OFFERS = [
  { no: '01', tk: 'company.landing.offer1.title', d1: 'company.landing.offer1.desc1', d2: 'company.landing.offer1.desc2', badge: 'company.landing.badge.free' },
  { no: '02', tk: 'company.landing.offer2.title', d1: 'company.landing.offer2.desc1', d2: 'company.landing.offer2.desc2', badge: 'company.landing.badge.key' },
  { no: '03', tk: 'company.landing.offer3.title', d1: 'company.landing.offer3.desc1', d2: 'company.landing.offer3.desc2', badge: null },
  { no: '04', tk: 'company.landing.offer4.title', d1: 'company.landing.offer4.desc1', d2: 'company.landing.offer4.desc2', badge: 'company.landing.badge.guarantee' },
];

const STEPS = [
  { no: '01', tk: 'company.landing.step1.title', d1: 'company.landing.step1.desc1', d2: 'company.landing.step1.desc2', img: '/ats-preview/jobs-public.png' },
  { no: '02', tk: 'company.landing.step2.title', d1: 'company.landing.step2.desc1', d2: 'company.landing.step2.desc2', img: '/ats-preview/ats-kanban-masked.png', reverse: true },
  { no: '03', tk: 'company.landing.step3.title', d1: 'company.landing.step3.desc1', d2: 'company.landing.step3.desc2', img: '/ats-preview/ats-candidate-detail-masked.png' },
];

export default function ForCompanies() {
  const router = useRouter();
  const { t } = useT();

  return (
    <>
      <Head>
        <title>{t('company.landing.head.title')}</title>
        <meta name="description" content={t('company.landing.head.desc')} />
      </Head>
      <style>{`
        section { scroll-margin-top: 96px; }
        .fc-kpi strong {
          color: #ea580c;
          font-size: clamp(46px, 7vw, 82px);
          line-height: 0.95;
          letter-spacing: -0.05em;
        }
        @media (max-width: 900px) {
          .fc-hero { grid-template-columns: 1fr !important; gap: 36px !important; padding: 56px 20px 42px !important; text-align: center !important; }
          .fc-hero-copy { justify-self: center !important; }
          .fc-hero-ctas, .fc-trust { justify-content: center !important; }
          .fc-float-card { left: 12px !important; bottom: 16px !important; }
          .fc-kpis { grid-template-columns: 1fr !important; gap: 28px !important; padding: 28px 20px 44px !important; }
          .fc-offer-grid { grid-template-columns: 1fr 1fr !important; }
          .fc-step, .fc-step-reverse { grid-template-columns: 1fr !important; direction: ltr !important; gap: 22px !important; }
          .fc-offer-flow { flex-wrap: wrap !important; }
        }
        @media (max-width: 560px) {
          .fc-company-nav { padding: 12px 16px !important; gap: 10px !important; }
          .fc-company-nav-links { order: 3 !important; width: 100% !important; justify-content: center !important; gap: 16px !important; }
          .fc-hero h1 { font-size: 42px !important; }
          .fc-hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .fc-hero-ctas button { width: 100% !important; }
          .fc-offer-grid { grid-template-columns: 1fr !important; }
          .fc-offer-grid article { min-height: 188px !important; transform: none !important; }
          .fc-float-card { position: static !important; width: 100% !important; margin-top: 12px !important; }
        }
        .fc-offer-flow b {
          display: block; width: 46px; height: 1px;
          background: linear-gradient(90deg, rgba(234,88,12,0.18), rgba(234,88,12,0.8));
        }
      `}</style>
      <div style={css.page}>
        <nav className="fc-company-nav" style={css.nav}>
          <Brand href="/" />
          <div className="fc-company-nav-links" style={css.navLinks}>
            <a href="#offer" style={css.navLink}>{t('company.landing.nav.offer')}</a>
            <a href="#how" style={css.navLink}>{t('company.landing.nav.how')}</a>
            <a href="#pricing" style={css.navLink}>{t('company.landing.nav.pricing')}</a>
          </div>
          <div style={css.navRight}>
            <LanguageSwitcher />
            <Link href="/company" style={css.btnGhost}>{t('company.landing.nav.login')}</Link>
            <Link href="/company?mode=signup" style={css.btnPrimary}>{t('company.landing.nav.cta')}</Link>
          </div>
        </nav>

        <main>
          <section className="fc-hero" style={css.hero}>
            <div style={css.heroBadge}>{t('company.landing.heroBadge')}</div>
            <h1 style={css.h1}>
              {t('company.landing.h1.line1')}<br />
              <span style={css.highlight}>{t('company.landing.h1.highlight')}</span> {t('company.landing.h1.line2')}
            </h1>
            <p style={css.lead}>{t('company.landing.lead')}</p>
            <div className="fc-hero-ctas" style={css.heroCtas}>
              <a href="#offer" style={css.btnOutline}>{t('company.landing.heroCtaOffer')}</a>
              <button type="button" onClick={() => router.push('/company?mode=signup')} style={css.btnDark}>
                {t('company.landing.heroCtaPost')} →
              </button>
            </div>

            <div className="fc-hero-visual" style={css.heroVisual}>
              <div style={css.heroImgWrap}>
                <img src="/company-hero-fyi-vn.png" alt={t('company.landing.heroAlt')} style={css.heroImg} />
              </div>
            </div>
          </section>

          <section className="fc-kpis" style={css.kpiStrip}>
            <div className="fc-kpi" style={css.kpi}>
              <strong><CountUp end={7.3} decimals={1} suffix={t('company.landing.kpi1Suffix')} /></strong>
              <span>{t('company.landing.kpi1Label')}</span>
            </div>
            <div className="fc-kpi" style={css.kpi}>
              <strong><CountUp end={0} suffix={t('company.landing.kpi2Suffix')} /></strong>
              <span>{t('company.landing.kpi2Label')}</span>
            </div>
            <div className="fc-kpi" style={css.kpi}>
              <strong><CountUp end={15723} suffix={t('company.landing.kpi3Suffix')} /></strong>
              <span>{t('company.landing.kpi3Label')}</span>
            </div>
          </section>

          <section id="offer" style={css.offer}>
            <div style={css.sectionHead}>
              <div style={css.eyebrowDark}>WHAT YOU GET</div>
              <h2 style={css.h2Dark}>
                {t('company.landing.offerH1')}<br />
                {t('company.landing.offerH2')}
              </h2>
            </div>
            <div className="fc-offer-grid" style={css.offerGrid}>
              {OFFERS.map((o, idx) => (
                <article key={o.no} style={{ ...css.offerCard, ...([0, 1, 3].includes(idx) ? css.offerCardKey : null) }}>
                  <div style={css.offerTop}>
                    <span style={css.offerNo}>{o.no}</span>
                    {o.badge && <span style={css.offerBadge}>{t(o.badge)}</span>}
                  </div>
                  <h3 style={css.offerTitle}>{t(o.tk)}</h3>
                  <p style={css.offerDesc}>
                    <span>{t(o.d1)}</span>
                    <span>{t(o.d2)}</span>
                  </p>
                </article>
              ))}
            </div>
            <div className="fc-offer-flow" style={css.offerFlow}>
              <span>{t('company.landing.flow.posting')}</span>
              <b />
              <span>{t('company.landing.flow.candidate')}</span>
              <b />
              <span>{t('company.landing.flow.interview')}</span>
              <b />
              <span>{t('company.landing.flow.hire')}</span>
            </div>
          </section>

          <section id="how" style={css.darkSection}>
            <div style={css.sectionHead}>
              <div style={css.eyebrow}>HOW IT WORKS</div>
              <h2 style={css.h2}>
                {t('company.landing.how.h1')}<br />
                {t('company.landing.how.h2')}
              </h2>
            </div>
            <div style={css.steps}>
              {STEPS.map((s) => (
                <article key={s.no} className={s.reverse ? 'fc-step-reverse' : 'fc-step'} style={{ ...css.step, ...(s.reverse ? css.stepReverse : null) }}>
                  <div style={css.stepText}>
                    <span style={css.stepNo}>{s.no}</span>
                    <h3 style={css.stepTitle}>{t(s.tk)}</h3>
                    <p style={css.stepDesc}>
                      <span>{t(s.d1)}</span>
                      <span>{t(s.d2)}</span>
                    </p>
                  </div>
                  <div style={css.shotWrap}>
                    <img src={s.img} alt={t(s.tk)} style={css.shot} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="pricing" style={css.compare}>
            <div style={css.sectionHead}>
              <div style={css.eyebrow}>PRICING</div>
              <h2 style={css.h2}>
                {t('company.landing.pricing.h1')}<br />
                {t('company.landing.pricing.h2')}
              </h2>
            </div>
            <div style={css.tableWrap}>
              <table style={css.table}>
                <thead>
                  <tr>
                    <th style={css.thFeature}>{t('company.landing.pricing.colFeature')}</th>
                    <th style={css.th}>{t('company.landing.pricing.colPlatform')}</th>
                    <th style={css.th}>{t('company.landing.pricing.colHeadhunt')}</th>
                    <th style={{ ...css.th, ...css.thFyi }}>FYI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={css.tdFeature}>{t('company.landing.pricing.row1.label')}</td>
                    <td style={css.td}>{t('company.landing.pricing.row1.platform')}</td>
                    <td style={css.td}>{t('company.landing.pricing.row1.headhunt')}</td>
                    <td style={css.tdFyi}>{t('company.landing.pricing.row1.fyi')}</td>
                  </tr>
                  <tr>
                    <td style={css.tdFeature}>{t('company.landing.pricing.row2.label')}</td>
                    <td style={css.td}>-</td>
                    <td style={css.td}>{t('company.landing.pricing.row2.headhunt')}</td>
                    <td style={css.tdFyi}>{t('company.landing.pricing.row2.fyi')}</td>
                  </tr>
                  <tr>
                    <td style={css.tdFeature}>{t('company.landing.pricing.row3.label')}</td>
                    <td style={css.td}><Mark v="x" t={t} /></td>
                    <td style={css.td}><Mark v="x" t={t} /></td>
                    <td style={css.tdFyi}><Mark v="o" t={t} /></td>
                  </tr>
                  <tr>
                    <td style={css.tdFeature}>{t('company.landing.pricing.row4.label')}</td>
                    <td style={css.td}>{t('company.landing.pricing.row4.platform')}</td>
                    <td style={css.td}>{t('company.landing.pricing.row4.headhunt')}</td>
                    <td style={css.tdFyi}>{t('company.landing.pricing.row4.fyi')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section style={css.bottomCta}>
            <h2 style={css.h2}>
              {t('company.landing.bottomCtaH1')}<br />
              {t('company.landing.bottomCtaH2')}
            </h2>
            <p style={css.ctaSub}>{t('company.landing.bottomSub')}</p>
            <button type="button" onClick={() => router.push('/company?mode=signup')} style={css.btnAccent}>
              {t('company.landing.bottomBtn')}
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
  navLinks: { display: 'flex', gap: 22, fontSize: 13, color: 'rgba(255,255,255,0.64)' },
  navLink: { textDecoration: 'none', fontWeight: 700 },
  navRight: { display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' },
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 'none',
    margin: '0 auto',
    padding: '74px max(32px, calc((100vw - 1240px) / 2 + 32px)) 96px',
    background: '#f7f7f5',
    color: '#151515',
  },
  heroBadge: {
    display: 'inline-block',
    padding: '7px 16px',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.08)',
    color: '#525252',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.02em',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    marginBottom: 24,
  },
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
    maxWidth: 880,
    fontSize: 'clamp(40px, 5.8vw, 64px)',
    lineHeight: 1.08,
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
    maxWidth: 620,
    margin: '20px auto 0',
    color: '#4b5563',
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 650,
  },
  heroCtas: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 26, flexWrap: 'wrap' },
  btnOutline: {
    padding: '13px 24px',
    borderRadius: 999,
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.14)',
    color: '#111',
    fontSize: 14,
    fontWeight: 850,
    fontFamily: 'inherit',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  btnDark: {
    border: 0,
    borderRadius: 999,
    padding: '14px 26px',
    background: '#111',
    color: '#fff',
    fontSize: 14,
    fontWeight: 850,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
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
  heroVisual: {
    position: 'relative',
    marginTop: 46,
    width: 'min(100%, 1040px)',
    display: 'flex',
    justifyContent: 'center',
  },
  heroImgWrap: {
    position: 'relative',
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 30px 70px rgba(17,17,17,0.14)',
    background: '#e5e7eb',
  },
  heroImg: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    display: 'block',
  },
  mockTag: {
    position: 'absolute',
    top: 12, right: 12,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.1em',
    pointerEvents: 'none',
  },
  statCardL: {
    position: 'absolute',
    left: -24, bottom: 30,
    padding: '14px 18px',
    borderRadius: 14,
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.06)',
    color: '#111',
    boxShadow: '0 14px 34px rgba(0,0,0,0.10)',
    minWidth: 130,
    textAlign: 'left',
    zIndex: 2,
  },
  statCardR: {
    position: 'absolute',
    right: -24, top: 36,
    padding: '14px 18px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #ef4444, #f97316)',
    color: '#fff',
    boxShadow: '0 16px 36px rgba(249,115,22,0.34)',
    minWidth: 140,
    textAlign: 'left',
    zIndex: 2,
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    opacity: 0.65,
    letterSpacing: '0.02em',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
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
    background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,247,237,0.94))',
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
  stepReverse: { direction: 'rtl' },
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
    aspectRatio: '16 / 10',
    width: '100%',
  },
  shot: { display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' },
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
