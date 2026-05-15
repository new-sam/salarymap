import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

function CountUp({ end, decimals = 0, duration = 1800, suffix = '', delay = 0 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const animRef = useRef(null);
  const lastWheelRef = useRef(0);

  const animate = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let startTs = null;
    setVal(0);
    const run = (ts) => {
      if (!startTs) startTs = ts + delay;
      const t = Math.max(0, ts - startTs);
      const progress = Math.min(t / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(end * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(run);
    };
    animRef.current = requestAnimationFrame(run);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) animate();
      });
    }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);

    const onWheel = () => {
      const now = Date.now();
      if (now - lastWheelRef.current > 600) {
        lastWheelRef.current = now;
        animate();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('wheel', onWheel);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [end, duration, delay]);

  const formatted = decimals > 0
    ? val.toFixed(decimals)
    : Math.floor(val).toLocaleString();

  return (
    <span ref={ref}>
      {formatted}
      {suffix && <span style={{ fontSize: '0.45em', fontWeight: 800, opacity: 0.5, marginLeft: 6 }}>{suffix}</span>}
    </span>
  );
}

function Mark({ v, label }) {
  if (v === 'o') return <span style={markStyles.o} title="지원">✓</span>;
  if (v === 'x') return <span style={markStyles.x} title="미지원">×</span>;
  if (v === 'p') return <span style={markStyles.p} title="부분 지원">{label || '△'}</span>;
  return null;
}

const markStyles = {
  o: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: '50%',
    background: '#0EBA9A', color: '#fff',
    fontSize: 16, fontWeight: 900,
    boxShadow: '0 2px 6px rgba(14,186,154,0.3)',
  },
  x: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)',
    fontSize: 18, fontWeight: 700,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  p: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 30, height: 24, padding: '0 9px', borderRadius: 999,
    background: 'rgba(245,158,11,0.18)', color: '#F59E0B',
    fontSize: 10.5, fontWeight: 800, letterSpacing: '0.02em',
    border: '1px solid rgba(245,158,11,0.3)',
  },
};

export default function ForCompanies() {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>FYI for Companies · 베트남 IT 채용, 7.3일로 압축합니다</title>
        <meta name="description" content="돈 많이 들고 오래 걸리던 채용, FYI가 가장 쉽게 만듭니다. 사전 비용 0원, 입사 30일 검증 후 7% 후불." />
      </Head>
      <style>{`
        html { scroll-behavior: smooth; }
        section { scroll-margin-top: 80px; }
        @keyframes fyiHeroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes fyiHeroPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.05); }
        }
      `}</style>

      <div style={css.page}>
        {/* ────────── NAV ────────── */}
        <nav style={css.nav}>
          <Link href="/" style={css.logo}>
            <span style={css.logoMark}>F</span>
            <span>salary-fyi <span style={css.logoSub}>· for companies</span></span>
          </Link>
          <div style={css.navLinks}>
            <a href="#how" style={css.navLink}>소개</a>
          </div>
          <div style={css.navRight}>
            <Link href="/company" style={css.btnGhost}>기업 로그인</Link>
            <Link href="/company/signup" style={css.btnPrimary}>공고 올리기 →</Link>
          </div>
        </nav>

        {/* ────────── HERO (반반 split + 아래 거대 KPI 카운트업) ────────── */}
        <section style={css.hero}>
          <div style={css.heroBlob1} />

          {/* 위: 반반 split */}
          <div style={css.heroSplit}>
            <div style={css.heroCopyLeft}>
              <div style={css.heroTag}>FYI · FOR COMPANIES</div>
              <h1 style={css.h1}>
                베트남 IT 채용,<br />
                <span style={css.h1Highlight}>7.3일</span>로<br />
                압축합니다.
              </h1>
              <p style={css.lead}>
                돈 많이 들고 오래 걸리던 채용, FYI가 가장 쉽게 만듭니다.
              </p>
              <div style={css.heroCtas}>
                <button onClick={() => router.push('/company/signup')} style={css.btnAccentLg}>
                  무료로 공고 올리기
                </button>
                <button style={css.btnGhostLg}>상담하기</button>
              </div>
            </div>

            <div style={css.heroLionWrap}>
              <div style={css.heroLionCard}>
                <img src="/LION.png" alt="FYI 후보자 인터뷰" style={css.heroLionImg} />
              </div>
            </div>
          </div>

          {/* 아래: 거대 KPI 카운트업 */}
          <div style={css.megaKpi}>
            <div style={css.kpiCol}>
              <div style={css.kpiBigNum}>
                <CountUp end={7.3} decimals={1} suffix="일" duration={1800} />
              </div>
              <div style={css.kpiBigLab}>매칭 → 인터뷰까지 평균</div>
              <div style={css.kpiBigNote}>시장 평균 4~8주</div>
            </div>
            <div style={css.kpiSepBig} />
            <div style={css.kpiCol}>
              <div style={css.kpiBigNum}>
                <CountUp end={0} suffix="원" duration={1200} />
              </div>
              <div style={css.kpiBigLab}>게재비 · 사전 비용</div>
              <div style={css.kpiBigNote}>채용 실패 시 비용 0</div>
            </div>
            <div style={css.kpiSepBig} />
            <div style={css.kpiCol}>
              <div style={css.kpiBigNum}>
                <CountUp end={14252} duration={2200} />
              </div>
              <div style={css.kpiBigLab}>베트남 IT 개발자 풀</div>
              <div style={css.kpiBigNote}>134개사 실연봉 누적</div>
            </div>
          </div>
        </section>

        {/* ────────── HOW IT WORKS (3 steps with screenshots) ────────── */}
        <section id="how" style={css.journey}>
          <div style={css.journeyHead}>
            <div style={css.sectionEyebrow}>HOW IT WORKS</div>
            <h2 style={css.h2}>채용의 모든 단계가<br />하나의 화면에서 흐릅니다.</h2>
          </div>

          <div style={css.journeySteps}>
            {/* Step 01 — 기업 계정 만들기 */}
            <div style={css.step}>
              <div style={css.stepText}>
                <div style={css.stepNum}>01</div>
                <h3 style={css.stepTitle}>회사 이메일 한 번이면 입장.</h3>
                <p style={css.stepDesc}>
                  회사 이메일로 인증 링크를 받고 1분 내 입장. 사업자번호는 첫 공고 발행 시점에 한 번만 입력하면 끝.
                </p>
              </div>
              <div style={css.stepShot}>
                <img src="/ats-preview/step-signup.png" alt="기업 계정 만들기" style={css.stepImg} />
              </div>
            </div>

            {/* Step 02 — 공고 등록 (reversed) */}
            <div style={{...css.step, ...css.stepReverse}}>
              <div style={css.stepText}>
                <div style={css.stepNum}>02</div>
                <h3 style={css.stepTitle}>공고 작성하면 미리보기까지.</h3>
                <p style={css.stepDesc}>
                  포지션·연봉·스킬을 입력하면 후보자가 볼 카드 모양을 즉시 미리보기. 첫 공고는 운영 검수 후 자동 활성.
                </p>
              </div>
              <div style={css.stepShot}>
                <img src="/ats-preview/step-post.png" alt="공고 작성 화면" style={css.stepImg} />
              </div>
            </div>

            {/* Step 03 — 모든 공고 한 화면 */}
            <div style={css.step}>
              <div style={css.stepText}>
                <div style={css.stepNum}>03</div>
                <h3 style={css.stepTitle}>모든 공고를 한 눈에.</h3>
                <p style={css.stepDesc}>
                  활성 공고가 카드 그리드로. 매칭 / 인터뷰 요청 / 일정 조율 / 인터뷰 완료 / 채용 확정 인원이 카드에 그대로.
                </p>
              </div>
              <div style={css.stepShot}>
                <img src="/ats-preview/ats-jobs.png" alt="공고 그리드 화면" style={css.stepImg} />
              </div>
            </div>

            {/* Step 04 — 매칭 칸반 (reversed) */}
            <div style={{...css.step, ...css.stepReverse}}>
              <div style={css.stepText}>
                <div style={css.stepNum}>04</div>
                <h3 style={css.stepTitle}>매칭이 칸반에 도착합니다.</h3>
                <p style={css.stepDesc}>
                  검증된 후보 카드가 ① 매칭 컬럼에 자동 등장. 1클릭으로 인터뷰 요청 → 일정 조율까지 자동.
                </p>
              </div>
              <div style={css.stepShot}>
                <img src="/ats-preview/ats-kanban.png" alt="칸반 파이프라인" style={css.stepImg} />
              </div>
            </div>

            {/* Step 05 — 분석 */}
            <div style={css.step}>
              <div style={css.stepText}>
                <div style={css.stepNum}>05</div>
                <h3 style={css.stepTitle}>채용 결과를 한 화면에.</h3>
                <p style={css.stepDesc}>
                  전체 채용 퍼널과 KPI를 한 번에 확인. 입사 확정 30일 후 자동 검증 → 정산까지 한 흐름.
                </p>
              </div>
              <div style={css.stepShot}>
                <img src="/ats-preview/ats-analytics.png" alt="채용 분석 화면" style={css.stepImg} />
              </div>
            </div>
          </div>
        </section>

        {/* ────────── COMPARE TABLE ────────── */}
        <section id="compare" style={css.compare}>
          <div style={css.compareHead}>
            <div style={css.sectionEyebrow}>VS COMPETITORS</div>
            <h2 style={css.h2}>왜 다른가</h2>
            <p style={css.compareSub}>동일한 채용 1건을 처리하는 데 드는 비용·시간·작업 비교</p>
          </div>

          <div style={css.tableWrap}>
            <table style={css.table}>
              <thead>
                <tr>
                  <th style={{...css.th, ...css.thFeature}}>기능</th>
                  <th style={css.th}>VietnamWorks</th>
                  <th style={css.th}>ITviec</th>
                  <th style={css.th}>TopDev</th>
                  <th style={css.th}>LinkedIn</th>
                  <th style={{...css.th, ...css.thFyi}}>FYI</th>
                </tr>
              </thead>
              <tbody>
                <tr style={css.tr}>
                  <td style={css.tdFeature}>공고 게재비 무료</td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={{...css.td, ...css.tdFyi}}><Mark v="o" /></td>
                </tr>
                <tr style={css.tr}>
                  <td style={css.tdFeature}>사전 결제 없음</td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={{...css.td, ...css.tdFyi}}><Mark v="o" /></td>
                </tr>
                <tr style={css.tr}>
                  <td style={css.tdFeature}>입사 30일 검증 후 7% 후불</td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={{...css.td, ...css.tdFyi}}><Mark v="o" /></td>
                </tr>
                <tr style={css.tr}>
                  <td style={css.tdFeature}>실연봉 데이터 기반 매칭</td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="p" label="부분" /></td>
                  <td style={{...css.td, ...css.tdFyi}}><Mark v="o" /></td>
                </tr>
                <tr style={css.tr}>
                  <td style={css.tdFeature}>익명 카드 + PDPL 자동 처리</td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={{...css.td, ...css.tdFyi}}><Mark v="o" /></td>
                </tr>
                <tr style={css.tr}>
                  <td style={css.tdFeature}>1클릭 면접 요청 · 슬롯 자동 조율</td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="p" label="부분" /></td>
                  <td style={css.td}><Mark v="x" /></td>
                  <td style={css.td}><Mark v="p" label="부분" /></td>
                  <td style={{...css.td, ...css.tdFyi}}><Mark v="o" /></td>
                </tr>
                <tr style={{...css.tr, ...css.trFinal}}>
                  <td style={{...css.tdFeature, ...css.tdFinalLabel}}>평균 채용 사이클</td>
                  <td style={{...css.td, ...css.tdMetric}}>4~8주</td>
                  <td style={{...css.td, ...css.tdMetric}}>4~8주</td>
                  <td style={{...css.td, ...css.tdMetric}}>3~6주</td>
                  <td style={{...css.td, ...css.tdMetric}}>4~12주</td>
                  <td style={{...css.td, ...css.tdFyi, ...css.tdMetricFyi}}>7.3일</td>
                </tr>
              </tbody>
            </table>
            <div style={css.tableLegend}>
              <span><Mark v="o" /> 지원</span>
              <span><Mark v="p" label="부분" /> 부분 지원</span>
              <span><Mark v="x" /> 미지원</span>
            </div>
          </div>
        </section>

        {/* ────────── BOTTOM CTA ────────── */}
        <section style={css.ctaBottom}>
          <h2 style={css.h2}>지금 회사 계정을 만드세요.</h2>
          <p style={css.ctaSub}>1분이면 입장. 첫 공고 발행까지 무료.</p>
          <button onClick={() => router.push('/company/signup')} style={css.btnAccentLg}>
            지금 공고 올리기 →
          </button>
        </section>

        {/* ────────── FOOTER ────────── */}
        <footer style={css.footer}>
          <div>FYI · for companies · 2026</div>
          <div style={css.footerLinks}>
            <Link href="/" style={css.footerLink}>개인 사이트로 →</Link>
          </div>
        </footer>
      </div>
    </>
  );
}

const css = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e5e5e5',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    WebkitFontSmoothing: 'antialiased',
  },

  // NAV
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', zIndex: 10,
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 15, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: '-0.02em',
  },
  logoMark: {
    width: 24, height: 24, borderRadius: 6,
    background: 'linear-gradient(135deg,#ef4444,#f97316)', color: '#fff',
    display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800,
  },
  logoSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginLeft: 2 },
  navLinks: { display: 'flex', gap: 24, fontSize: 13 },
  navLink: { color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 500, textDecoration: 'none' },
  navRight: { display: 'flex', alignItems: 'center', gap: 8 },
  btnGhost: {
    padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent', color: '#fff', fontSize: 12.5, fontWeight: 600,
    textDecoration: 'none', cursor: 'pointer',
  },
  btnPrimary: {
    padding: '8px 14px', borderRadius: 6, border: 'none',
    background: '#fff', color: '#0a0a0a', fontSize: 12.5, fontWeight: 700,
    textDecoration: 'none', cursor: 'pointer',
  },

  // HERO (반반 split + 하단 거대 KPI · 자연 흐름)
  hero: {
    position: 'relative',
    padding: '80px 32px 56px',
    overflow: 'hidden',
    isolation: 'isolate',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: '#FAFAFA',
  },
  heroBlob1: {
    position: 'absolute', top: '15%', right: '-15%',
    width: 700, height: 700, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(249,115,22,0.10), transparent 65%)',
    filter: 'blur(30px)', zIndex: 0, pointerEvents: 'none',
  },

  // Top: copy left + lion right — flexbox로 자연 너비, 적당한 gap
  heroSplit: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 1200,
    display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    gap: 64,
    marginBottom: 56,
  },
  heroCopyLeft: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    flex: '0 1 600px',
    minWidth: 0,
  },
  heroLionWrap: {
    position: 'relative',
    aspectRatio: '1/1',
    width: 440,
    flex: '0 0 440px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  heroLionCard: {
    width: '100%',
    aspectRatio: '1/1',
    borderRadius: 28,
    overflow: 'hidden',
    background: '#fff',
    boxShadow:
      '0 30px 60px -10px rgba(234,88,12,0.16),' +
      '0 12px 24px rgba(26,26,26,0.06),' +
      '0 0 0 1px rgba(26,26,26,0.04)',
    animation: 'fyiHeroFloat 6s ease-in-out infinite',
  },
  heroLionImg: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  heroTag: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5, color: '#EA580C', fontWeight: 700,
    letterSpacing: '0.18em', marginBottom: 18, textTransform: 'uppercase',
  },
  h1: {
    fontSize: 76, fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.04em', marginBottom: 24, color: '#1A1A1A',
  },
  h1Highlight: {
    display: 'inline-block',
    background: 'linear-gradient(180deg, transparent 58%, rgba(249,115,22,0.32) 58%)',
    padding: '0 10px', borderRadius: 4,
    color: '#EA580C',
  },
  lead: { fontSize: 17, color: '#525252', maxWidth: 540, lineHeight: 1.65, marginBottom: 28 },
  leadBold: { color: '#1A1A1A', fontWeight: 800 },
  heroCtas: { display: 'flex', gap: 12 },

  // MEGA KPI — 하단 카운트업
  megaKpi: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 1240,
    display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr',
    alignItems: 'flex-end', gap: 0,
    paddingTop: 36,
    borderTop: '1px solid rgba(0,0,0,0.06)',
  },
  kpiCol: { textAlign: 'center', padding: '0 16px' },
  kpiBigNum: {
    fontSize: 96,
    fontWeight: 900,
    lineHeight: 0.95,
    letterSpacing: '-0.05em',
    color: '#EA580C',
    fontVariantNumeric: 'tabular-nums',
    marginBottom: 12,
  },
  kpiBigLab: {
    fontSize: 15, fontWeight: 800, color: '#1A1A1A',
    letterSpacing: '-0.005em', marginBottom: 3,
  },
  kpiBigNote: {
    fontSize: 12.5, fontWeight: 600, color: '#9CA3AF',
  },
  kpiSepBig: {
    width: 1, alignSelf: 'stretch',
    background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.08) 60%, transparent)',
    margin: '20px 0',
  },

  heroBottom: {
    position: 'relative', zIndex: 1, width: '100%', maxWidth: 1100,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  btnAccentLg: {
    padding: '18px 36px', borderRadius: 999, border: 'none',
    background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)', color: '#fff',
    fontSize: 16, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 10px 28px rgba(234,88,12,0.32)',
  },
  btnGhostLg: {
    padding: '18px 36px', borderRadius: 999, border: '1.5px solid rgba(26,26,26,0.15)',
    background: '#fff', color: '#1A1A1A', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // Hero visual — character dominates, clean rounded card
  heroVisual: {
    position: 'relative',
    aspectRatio: '1/1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  heroLionCard: {
    position: 'relative',
    width: '90%',
    aspectRatio: '1/1',
    borderRadius: 32,
    overflow: 'hidden',
    background: '#fff',
    boxShadow:
      '0 30px 60px -10px rgba(234,88,12,0.18),' +
      '0 12px 24px rgba(26,26,26,0.08),' +
      '0 0 0 1px rgba(26,26,26,0.04)',
    animation: 'fyiHeroFloat 6s ease-in-out infinite',
  },
  heroLionImg: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },

  // Bento KPI — 단일 스킴 (white card + 주황 number)
  bento: {
    position: 'relative', zIndex: 1,
    maxWidth: 1100, margin: '40px auto 0', width: '100%',
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
  },
  bentoCard: {
    padding: '24px 26px', borderRadius: 18,
    display: 'flex', flexDirection: 'column', gap: 4,
    background: '#fff',
    border: '1px solid rgba(26,26,26,0.06)',
    boxShadow: '0 6px 16px rgba(26,26,26,0.04)',
  },
  bentoNum: {
    fontSize: 48, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    color: '#EA580C',
  },
  bentoUnit: { fontSize: 22, fontWeight: 800, color: 'rgba(234,88,12,0.55)', marginLeft: 3 },
  bentoLab: { fontSize: 14, fontWeight: 800, marginTop: 10, color: '#1A1A1A', letterSpacing: '-0.005em' },
  bentoNote: { fontSize: 12, fontWeight: 600, color: '#737373', marginTop: 2 },

  // BIG KPI
  bigKpi: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '60px 32px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0))',
  },
  bigKpiGrid: {
    maxWidth: 1100, margin: '0 auto',
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
  },
  bigKpiBox: { textAlign: 'center' },
  bigKpiVal: {
    fontSize: 88, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
    background: 'linear-gradient(180deg,#fff,rgba(255,255,255,0.55))',
    WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  bigKpiUnit: {
    fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginLeft: 6, WebkitTextFillColor: 'rgba(255,255,255,0.5)',
  },
  bigKpiLab: {
    fontSize: 14, color: '#fff', fontWeight: 700, marginTop: 12, letterSpacing: '-0.005em',
  },
  bigKpiNote: {
    fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 5, fontWeight: 500,
  },

  // JOURNEY
  journey: {
    maxWidth: 1240, margin: '0 auto', padding: '96px 32px 60px',
  },
  journeyHead: { textAlign: 'center', marginBottom: 64, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' },
  sectionEyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11, color: '#f97316', fontWeight: 700,
    letterSpacing: '0.15em', marginBottom: 14, textTransform: 'uppercase',
  },
  journeySub: { fontSize: 15.5, color: 'rgba(255,255,255,0.6)', marginTop: 14, lineHeight: 1.65 },
  journeySteps: { display: 'flex', flexDirection: 'column', gap: 80 },
  step: {
    display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 48, alignItems: 'center',
  },
  stepReverse: { gridTemplateColumns: '1.3fr 1fr', direction: 'rtl' },
  stepText: { direction: 'ltr', display: 'flex', flexDirection: 'column' },
  stepNum: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13, color: '#f97316', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 14,
  },
  stepTitle: {
    fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 14, lineHeight: 1.2,
  },
  stepDesc: { fontSize: 14.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 16 },
  stepBullets: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: 8,
    fontSize: 13, color: 'rgba(255,255,255,0.6)',
  },
  stepShot: {
    direction: 'ltr',
    borderRadius: 14, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
    background: '#fff',
  },
  stepImg: { width: '100%', display: 'block', height: 'auto' },

  // TRUST
  trust: {
    maxWidth: 1140, margin: '0 auto', padding: '80px 32px 40px',
  },
  trustHead: { textAlign: 'center', marginBottom: 40 },
  trustGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 },
  trustCard: {
    padding: 28, borderRadius: 12,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  },
  trustIcon: { fontSize: 28, marginBottom: 14 },
  trustTitle: { fontSize: 15.5, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.005em' },
  trustDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 },

  // H2 (shared)
  h2: {
    fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', color: '#fff', marginBottom: 6, lineHeight: 1.18,
  },

  // COMPARE TABLE
  compare: {
    maxWidth: 1240, margin: '0 auto', padding: '80px 32px 60px',
  },
  compareHead: { textAlign: 'center', marginBottom: 40 },
  compareSub: { fontSize: 14.5, color: 'rgba(255,255,255,0.6)', marginTop: 12, lineHeight: 1.65 },
  tableWrap: {
    background: '#13131a', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: '8px 8px 18px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
  },
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0,
  },
  th: {
    padding: '20px 16px 18px', textAlign: 'center',
    fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
    letterSpacing: '0.02em', borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  thFeature: {
    textAlign: 'left', paddingLeft: 24,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11.5,
  },
  thFyi: {
    color: '#FFD43B', fontSize: 14, fontWeight: 900,
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  tr: { transition: 'background 0.15s' },
  trFinal: { borderTop: '2px solid rgba(255,255,255,0.1)' },
  td: {
    padding: '16px 16px', textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: 14, color: 'rgba(255,255,255,0.7)',
    verticalAlign: 'middle',
  },
  tdFeature: {
    padding: '16px 24px', textAlign: 'left',
    fontSize: 14, fontWeight: 700, color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  },
  tdFyi: {
    background: 'linear-gradient(180deg, rgba(255,212,59,0.06), rgba(255,123,71,0.04))',
    borderLeft: '1px solid rgba(255,212,59,0.15)',
    borderRight: '1px solid rgba(255,212,59,0.15)',
  },
  tdMetric: {
    fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
    fontVariantNumeric: 'tabular-nums',
  },
  tdMetricFyi: {
    fontSize: 22, fontWeight: 900, color: '#FFD43B',
    letterSpacing: '-0.02em',
  },
  tdFinalLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  tableLegend: {
    display: 'flex', justifyContent: 'center', gap: 24,
    padding: '20px 16px 8px', marginTop: 4,
    fontSize: 12, color: 'rgba(255,255,255,0.5)',
  },

  // BOTTOM CTA
  ctaBottom: {
    maxWidth: 700, margin: '0 auto', padding: '60px 32px 80px', textAlign: 'center',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  ctaSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 28, marginTop: 10 },

  // FOOTER
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 32px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 12, color: 'rgba(255,255,255,0.4)',
  },
  footerLinks: { display: 'flex', gap: 16 },
  footerLink: { color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 600 },
};
