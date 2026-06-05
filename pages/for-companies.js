import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Brand from '../components/company/Brand';
import ContactModal from '../components/company/ContactModal';
import { useT, LanguageSwitcher } from '../lib/i18n';

function CountUp({ end, decimals = 0, duration = 1200, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const animRef = useRef(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const run = () => {
      if (hasRunRef.current) return;
      hasRunRef.current = true;
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

const SERVICE_FLOW = [
  { no: '01', title: 'company.landing.process1.title', desc: 'company.landing.process1.desc', tag: 'company.landing.process1.tag', img: '/company-process/post-free.png' },
  { no: '02', title: 'company.landing.process2.title', desc: 'company.landing.process2.desc', tag: 'company.landing.process2.tag', img: '/company-process/resume-pool.png' },
  { no: '03', title: 'company.landing.process3.title', desc: 'company.landing.process3.desc', tag: 'company.landing.process3.tag', img: '/company-process/ats-manage.png' },
  { no: '04', title: 'company.landing.process4.title', desc: 'company.landing.process4.desc', tag: 'company.landing.process4.tag', img: '/company-process/hire-guarantee.png' },
];

const CLOSING_QUOTES = [
  // Replace these synthetic avatars/quotes with real customer interview material later.
  { quote: 'company.landing.close.quote1', role: 'company.landing.close.role1', avatarPos: '0% 0%' },
  { quote: 'company.landing.close.quote2', role: 'company.landing.close.role2', avatarPos: '33.333% 0%' },
  { quote: 'company.landing.close.quote3', role: 'company.landing.close.role3', avatarPos: '66.666% 33.333%' },
  { quote: 'company.landing.close.quote4', role: 'company.landing.close.role4', avatarPos: '0% 66.666%' },
  { quote: 'company.landing.close.quote5', role: 'company.landing.close.role5', avatarPos: '100% 0%' },
];

export default function ForCompanies() {
  const router = useRouter();
  const { t } = useT();
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const targets = Array.from(document.querySelectorAll('.fc-reveal'));
    if (!targets.length) return undefined;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });

    targets.forEach((target) => io.observe(target));
    return () => io.disconnect();
  }, []);

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
          .fc-flow-grid { grid-template-columns: 1fr 1fr !important; }
          .fc-flow-dots { display: none !important; }
          .fc-offer-flow { flex-wrap: wrap !important; }
        }
        @media (max-width: 560px) {
          .fc-company-nav { padding: 12px 16px !important; gap: 10px !important; }
          .fc-company-nav-links { order: 3 !important; width: 100% !important; justify-content: center !important; gap: 16px !important; }
          .fc-hero h1 { font-size: 42px !important; }
          .fc-hero-ctas { flex-direction: column !important; align-items: stretch !important; }
          .fc-hero-ctas button { width: 100% !important; }
          .fc-offer-grid { grid-template-columns: 1fr !important; }
          .fc-flow-grid { grid-template-columns: 1fr !important; }
          .fc-offer-grid article { min-height: 188px !important; transform: none !important; }
          .fc-float-card { position: static !important; width: 100% !important; margin-top: 12px !important; }
          .fc-close-wrap { grid-template-columns: 1fr !important; gap: 54px !important; }
          .fc-close-right { min-height: 430px !important; }
        }
        .fc-offer-flow b {
          display: block; width: 46px; height: 1px;
          background: linear-gradient(90deg, rgba(234,88,12,0.18), rgba(234,88,12,0.8));
        }
        .fc-close-quote {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: translateY(12px);
          animation: fcQuoteRoll 20s infinite both;
        }
        @keyframes fcQuoteRoll {
          0%, 3% { opacity: 0; transform: translateY(12px); }
          8%, 22% { opacity: 1; transform: translateY(0); }
          27%, 100% { opacity: 0; transform: translateY(-12px); }
        }
        .fc-hero-visual {
          animation: fcHeroReveal 900ms cubic-bezier(.16, 1, .3, 1) 120ms both;
        }
        .fc-hero-visual img {
          animation: fcHeroDrift 9s ease-in-out 1.2s infinite alternate;
          transform-origin: 50% 58%;
          will-change: transform;
        }
        .fc-reveal {
          opacity: 0;
          transform: translateY(22px);
          filter: blur(8px);
          transition:
            opacity 760ms cubic-bezier(.16, 1, .3, 1),
            transform 760ms cubic-bezier(.16, 1, .3, 1),
            filter 760ms cubic-bezier(.16, 1, .3, 1);
        }
        .fc-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }
        .fc-flow-grid article {
          transition:
            opacity 680ms cubic-bezier(.16, 1, .3, 1),
            transform 680ms cubic-bezier(.16, 1, .3, 1),
            box-shadow 220ms ease,
            border-color 220ms ease;
        }
        .fc-flow-stage.fc-reveal article {
          opacity: 0;
          transform: translateY(18px);
        }
        .fc-flow-stage.fc-reveal.is-visible article {
          opacity: 1;
          transform: translateY(0);
        }
        .fc-flow-stage.fc-reveal.is-visible article:nth-child(2) { transition-delay: 80ms; }
        .fc-flow-stage.fc-reveal.is-visible article:nth-child(3) { transition-delay: 160ms; }
        .fc-flow-stage.fc-reveal.is-visible article:nth-child(4) { transition-delay: 240ms; }
        .fc-flow-stage.is-visible .fc-flow-grid article:hover {
          transform: translateY(-4px);
          border-color: rgba(249,115,22,0.2);
          box-shadow: 0 24px 48px rgba(15,23,42,0.11);
        }
        @keyframes fcHeroReveal {
          from { opacity: 0; transform: translateY(24px) scale(.985); filter: blur(14px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes fcHeroDrift {
          from { transform: scale(1.004) translate3d(0, 0, 0); }
          to { transform: scale(1.018) translate3d(0, -4px, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fc-hero-visual,
          .fc-hero-visual img,
          .fc-close-quote {
            animation: none !important;
          }
          .fc-reveal,
          .fc-flow-grid article {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            transition: none !important;
          }
        }
      `}</style>
      <div style={css.page}>
        <nav className="fc-company-nav" style={css.nav}>
          <Brand href="/" />
          <div className="fc-company-nav-links" style={css.navLinks}>
            <a href="#offer" style={css.navLink}>{t('company.landing.nav.offer')}</a>
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
              {t('company.landing.h1.line2')} <span style={css.highlight}>{t('company.landing.h1.highlight')}</span>
            </h1>
            <p style={css.lead}>{t('company.landing.lead')}</p>
            <div className="fc-hero-ctas" style={css.heroCtas}>
              <button type="button" onClick={() => setContactOpen(true)} style={css.btnOutline}>{t('company.landing.heroCtaContact')}</button>
              <button type="button" onClick={() => router.push('/company?mode=signup')} style={css.btnDark}>
                {t('company.landing.heroCtaPost')} -&gt;
              </button>
            </div>

            <div className="fc-hero-visual" style={css.heroVisual}>
              <div style={css.heroImgWrap}>
                <img src="/company-hero-interview-flow.png" alt={t('company.landing.heroAlt')} style={css.heroImg} />
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

          <section className="fc-reveal" style={css.talentProof}>
            <div style={css.talentProofHead}>
              <div style={css.eyebrowDark}>{t('company.landing.talentProof.eyebrow')}</div>
              <h2 style={css.talentProofTitle}>
                {t('company.landing.talentProof.h1')}<br />
                {t('company.landing.talentProof.h2')}
              </h2>
              <p style={css.talentProofLead}>{t('company.landing.talentProof.lead')}</p>
            </div>
            <div style={css.talentVisualWrap}>
              <img
                src="/company-talent-pool-proof-tilted.png"
                alt={t('company.landing.talentProof.alt')}
                style={css.talentVisual}
              />
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
            <div className="fc-flow-stage fc-reveal" style={css.flowStage}>
              <div className="fc-flow-grid" style={css.flowGrid}>
                {SERVICE_FLOW.map((item, idx) => (
                  <article key={item.no} style={css.flowItem}>
                    <div style={css.flowNumber}>{item.no}</div>
                    <div style={css.flowVisual}>
                      <img src={item.img} alt={t(item.title)} style={css.flowVisualImg} />
                    </div>
                    <div style={css.flowCopy}>
                      <span style={css.flowTag}>{t(item.tag)}</span>
                      <h3 style={css.flowTitle}>{t(item.title)}</h3>
                      <p style={css.flowDesc}>{t(item.desc)}</p>
                    </div>
                    {idx < SERVICE_FLOW.length - 1 && <div className="fc-flow-dots" style={css.flowDots}>-&gt;</div>}
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="pricing" style={css.closeSection}>
            <div className="fc-close-wrap" style={css.closeWrap}>
              <div style={css.closeLeft}>
                <div style={css.closeNumber}>
                  0<span style={css.closeCurrency}>{t('company.landing.close.currency')}</span>
                </div>
                <p style={css.closeCaption}>
                  <strong style={css.closeCaptionStrong}>{t('company.landing.close.captionStrong')}</strong><br />
                  {t('company.landing.close.caption')}
                </p>
                <div style={css.closePills}>
                  <span style={css.closePill}>{t('company.landing.close.pill1')}</span>
                  <span style={css.closePill}>{t('company.landing.close.pill2')}</span>
                </div>
              </div>

              <div className="fc-close-right" style={css.closeRight}>
                <div style={css.quoteStage}>
                  {CLOSING_QUOTES.slice(0, 3).map((item, idx) => (
                    <div
                      key={item.quote}
                      className="fc-close-quote"
                      style={{ animationDelay: `${idx * 5}s` }}
                    >
                      <p style={css.quoteText}>{t(item.quote)}</p>
                      <div style={css.quoteRole}>{t(item.role)}</div>
                    </div>
                  ))}
                </div>
                <div style={css.quoteAvatars}>
                  {CLOSING_QUOTES.map((item, idx) => (
                    <span
                      key={item.role}
                      style={{
                        ...css.quoteAvatar,
                        marginLeft: idx === 0 ? 0 : -9,
                        opacity: 0.38 + idx * 0.13,
                        backgroundPosition: item.avatarPos,
                      }}
                    />
                  ))}
                </div>
                <p style={css.closeFoot}>{t('company.landing.close.foot')}</p>
                <button type="button" onClick={() => router.push('/company?mode=signup')} style={css.closeCta}>
                  {t('company.landing.close.cta')} <span style={css.closeCtaIcon}>→</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
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
  talentProof: {
    padding: '78px max(32px, calc((100vw - 1240px) / 2 + 32px)) 86px',
    background:
      'radial-gradient(circle at 20% 8%, rgba(249,115,22,0.10), transparent 26%),' +
      'linear-gradient(180deg, #f7f7f5 0%, #fff 58%, #f7f7f5 100%)',
    color: '#151515',
  },
  talentProofHead: {
    maxWidth: 820,
    marginBottom: 30,
  },
  talentProofTitle: {
    margin: 0,
    color: '#151515',
    fontSize: 'clamp(34px, 4.6vw, 56px)',
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: '-0.04em',
  },
  talentProofLead: {
    maxWidth: 650,
    margin: '18px 0 0',
    color: '#4b5563',
    fontSize: 17,
    lineHeight: 1.62,
    fontWeight: 650,
    wordBreak: 'keep-all',
  },
  talentVisualWrap: {
    overflow: 'hidden',
    borderRadius: 30,
    border: '1px solid rgba(17,17,17,0.08)',
    background: '#fff',
    boxShadow: '0 40px 96px rgba(17,17,17,0.13)',
  },
  talentVisual: {
    display: 'block',
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    objectPosition: 'center',
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
    padding: '0 max(32px, calc((100vw - 1240px) / 2 + 32px)) 46px',
    background: '#f7f7f5',
    color: '#151515',
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
  flowStage: {
    position: 'relative',
    maxWidth: 1180,
    margin: '0 auto',
    padding: '30px 32px',
    borderRadius: 28,
    background: 'linear-gradient(180deg, #f0f8ff 0%, #f7fbff 100%)',
    border: '1px solid rgba(37,99,235,0.08)',
    boxShadow: '0 24px 70px rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  flowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 18,
    alignItems: 'stretch',
  },
  flowItem: {
    position: 'relative',
    minWidth: 0,
    minHeight: 350,
    padding: '24px 20px 22px',
    borderRadius: 22,
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(15,23,42,0.1)',
    boxShadow: '0 18px 42px rgba(15,23,42,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  flowNumber: {
    alignSelf: 'flex-start',
    color: '#ff4b16',
    fontSize: 13,
    fontWeight: 950,
  },
  flowVisual: {
    width: 148,
    height: 132,
    margin: '8px auto 22px',
    borderRadius: 20,
    background: '#f5f7fb',
    border: '1px solid rgba(15,23,42,0.06)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.82)',
    position: 'relative',
    overflow: 'hidden',
  },
  flowVisualImg: { display: 'block', width: '100%', height: '100%', objectFit: 'cover' },
  flowCopy: {
    textAlign: 'center',
    padding: 0,
  },
  flowTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    padding: '7px 12px',
    borderRadius: 999,
    background: '#fff',
    color: '#ea580c',
    fontSize: 11.5,
    lineHeight: 1,
    fontWeight: 950,
    border: '1px solid rgba(249,115,22,0.16)',
    boxShadow: '0 8px 20px rgba(15,23,42,0.05)',
  },
  flowTitle: {
    margin: '14px 0 8px',
    color: '#111827',
    fontSize: 17,
    lineHeight: 1.25,
    fontWeight: 950,
    letterSpacing: '-0.01em',
    wordBreak: 'keep-all',
  },
  flowDesc: {
    margin: 0,
    color: '#475569',
    fontSize: 13,
    lineHeight: 1.52,
    fontWeight: 750,
    wordBreak: 'keep-all',
  },
  flowDots: {
    position: 'absolute',
    top: 142,
    right: -18,
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: '#fff',
    color: '#ff4b16',
    fontSize: 17,
    fontWeight: 950,
    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
    zIndex: 1,
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
  closeSection: {
    minHeight: '86vh',
    display: 'grid',
    placeItems: 'center',
    padding: '86px max(32px, calc((100vw - 1240px) / 2 + 32px)) 96px',
    background:
      'radial-gradient(circle at 18% 18%, rgba(47,128,237,0.10), transparent 28%),' +
      'radial-gradient(circle at 82% 80%, rgba(249,115,22,0.08), transparent 26%),' +
      'linear-gradient(180deg, #f7fbff 0%, #eef5fb 100%)',
    color: '#111',
  },
  closeWrap: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1.04fr 0.96fr',
    gap: 86,
    alignItems: 'center',
  },
  closeLeft: { minWidth: 0 },
  closeNumber: {
    color: '#08090b',
    fontSize: 'clamp(104px, 14vw, 230px)',
    lineHeight: 0.86,
    fontWeight: 650,
    letterSpacing: '-0.08em',
  },
  closeCurrency: {
    color: '#ea580c',
    letterSpacing: '-0.08em',
  },
  closeCaption: {
    margin: '42px 0 0',
    color: '#98a2b3',
    fontSize: 24,
    lineHeight: 1.35,
    fontWeight: 650,
    letterSpacing: '-0.015em',
  },
  closeCaptionStrong: { color: '#111827', fontWeight: 850 },
  closePills: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    flexWrap: 'wrap',
  },
  closePill: {
    padding: '9px 13px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(17,24,39,0.06)',
    color: '#667085',
    fontSize: 15,
    fontWeight: 760,
  },
  closeRight: {
    minHeight: 500,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  quoteStage: {
    position: 'relative',
    minHeight: 230,
  },
  quoteText: {
    margin: 0,
    color: '#3f4652',
    fontSize: 'clamp(28px, 2.35vw, 42px)',
    lineHeight: 1.44,
    fontWeight: 780,
    letterSpacing: '-0.035em',
    wordBreak: 'keep-all',
  },
  quoteRole: {
    marginTop: 28,
    color: '#4b5563',
    fontSize: 18,
    fontWeight: 800,
  },
  quoteAvatars: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 46,
    paddingLeft: 4,
  },
  quoteAvatar: {
    display: 'block',
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: '3px solid #eef5fb',
    backgroundImage: 'url(/company-quote-avatars.png)',
    backgroundSize: '400% 400%',
    boxShadow: '0 8px 22px rgba(17,24,39,0.12)',
    overflow: 'hidden',
  },
  closeFoot: {
    margin: '74px 0 0',
    color: '#98a2b3',
    fontSize: 17,
    lineHeight: 1.7,
    fontWeight: 680,
  },
  closeCta: {
    marginTop: 28,
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 14,
    height: 56,
    padding: '0 16px 0 26px',
    border: 0,
    borderRadius: 999,
    background: '#111827',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 18px 44px rgba(17,24,39,0.18)',
  },
  closeCtaIcon: {
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#fff',
    color: '#111827',
  },
};
