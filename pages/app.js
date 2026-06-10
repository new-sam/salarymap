import Head from 'next/head';
import { useMemo } from 'react';
import { useT } from '../lib/i18n';

// 앱 다운로드/소개 페이지 (salary-fyi.com/app).
// Apple 심사용 마케팅 URL로 첨부하는 용도. 기능 목업은 .feature 슬롯에 나중에 추가.
// 실제 App Store 링크가 나오면 APP_STORE_URL을 교체할 것.
const APP_STORE_URL = 'https://apps.apple.com/app/idXXXXXXXXXX'; // TODO: 실제 앱 ID로 교체
// const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.salaryfyi'; // 안드로이드 출시 시

const css = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#0c0c0b; --bg1:#141413; --bg2:#1c1c1a;
  --line:rgba(255,255,255,0.07);
  --white:#f2f0eb; --mid:rgba(242,240,235,0.66); --dim:rgba(242,240,235,0.4);
  --orange:#ff6000;
}
html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--white); font-family:'Geist',sans-serif; -webkit-font-smoothing:antialiased; }
nav { position:fixed; top:0; left:0; right:0; z-index:200; padding:0 52px; height:56px; display:flex; align-items:center; justify-content:space-between; background:rgba(12,12,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
.logo { font-family:'Geist Mono',monospace; font-size:13px; font-weight:500; }
.logo span { color:var(--orange); }
.nav-r { display:flex; align-items:center; gap:32px; }
.nav-link { font-size:13px; color:var(--mid); text-decoration:none; transition:color .15s; }
.nav-link:hover { color:var(--white); }
.nav-link.active { color:var(--white); }
.nav-btn { font-family:'Geist',sans-serif; font-size:12px; font-weight:600; background:var(--orange); color:#fff; border:none; padding:8px 18px; border-radius:2px; cursor:pointer; text-decoration:none; }

/* hero */
.hero { max-width:880px; margin:0 auto; padding:140px 52px 80px; text-align:center; }
.kicker { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:24px; }
.hero-h1 { font-size:clamp(30px,4.6vw,50px); font-weight:800; letter-spacing:-1.4px; line-height:1.18; margin:0 auto 20px; max-width:600px; text-wrap:balance; word-break:keep-all; }
.hero-h1 span { color:var(--orange); }
.hero-sub { font-size:17px; color:var(--mid); line-height:1.7; font-weight:300; max-width:520px; margin:0 auto 40px; }

/* download buttons */
.dl-row { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; margin-bottom:18px; }
.dl-btn { display:inline-flex; align-items:center; gap:9px; background:#fff; color:#000; padding:9px 18px; border-radius:9px; text-decoration:none; transition:transform .12s, opacity .12s; }
.dl-btn:hover { transform:translateY(-2px); }
.dl-btn.secondary { background:var(--bg2); color:var(--white); border:1px solid var(--line); }
.dl-sub { font-size:11px; color:#000; font-weight:400; line-height:1; letter-spacing:.2px; }
.dl-btn .big { font-size:20px; font-weight:600; line-height:1.1; letter-spacing:-.5px; }
.apple-ico { width:24px; height:24px; flex-shrink:0; }

/* phone mock placeholder */
.hero-shot { margin:64px auto 0; max-width:280px; aspect-ratio:9/19.5; border:1px solid var(--line); border-radius:36px; background:linear-gradient(160deg,var(--bg1),var(--bg2)); display:flex; align-items:center; justify-content:center; color:var(--dim); font-family:'Geist Mono',monospace; font-size:12px; }

/* features — one per row, alternating */
.features { max-width:1040px; margin:0 auto; padding:40px 52px 90px; display:flex; flex-direction:column; gap:24px; }
.feature { display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:48px; border:1px solid var(--line); border-radius:20px; padding:44px; background:var(--bg1); }
.feature:nth-child(even) .feat-visual { order:-1; }
.feat-num { font-family:'Geist Mono',monospace; font-size:12px; color:var(--orange); letter-spacing:2px; margin-bottom:16px; }
.feat-title { font-size:25px; font-weight:700; letter-spacing:-.8px; line-height:1.25; margin-bottom:12px; }
.feat-body { font-size:15px; color:var(--mid); line-height:1.75; font-weight:300; max-width:380px; }
.feat-visual { aspect-ratio:16/11; border-radius:16px; background:linear-gradient(160deg,var(--bg2),#0e0e0d); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.mg { width:100%; height:100%; display:block; }

/* motion graphics */
@keyframes mg-bar { 0%,100%{ transform:scaleY(.55);} 50%{ transform:scaleY(1);} }
.mg .bar { transform-box:fill-box; transform-origin:bottom; animation:mg-bar 2.6s ease-in-out infinite; }
.mg .bar.b2{ animation-delay:.2s;} .mg .bar.b3{ animation-delay:.4s;} .mg .bar.b4{ animation-delay:.6s;} .mg .bar.b5{ animation-delay:.8s;}
@keyframes mg-star { 0%,8%{ fill:rgba(242,240,235,0.14);} 22%,100%{ fill:var(--orange);} }
.mg .star { animation:mg-star 3s ease-in-out infinite; }
.mg .star.s2{animation-delay:.25s;} .mg .star.s3{animation-delay:.5s;} .mg .star.s4{animation-delay:.75s;} .mg .star.s5{animation-delay:1s;}
@keyframes mg-pop { 0%,100%{ opacity:0; transform:translateY(10px) scale(.94);} 12%,80%{ opacity:1; transform:translateY(0) scale(1);} }
.mg .bub { transform-box:fill-box; transform-origin:center; animation:mg-pop 4.2s ease-in-out infinite; }
.mg .bub.c2{ animation-delay:1s;} .mg .bub.c3{ animation-delay:2s;}
@keyframes mg-ring { 0%{ stroke-dashoffset:339;} 55%,100%{ stroke-dashoffset:27;} }
.mg .ring-fg { stroke-dasharray:339; stroke-dashoffset:339; animation:mg-ring 3s ease-out infinite; }
@keyframes mg-fade { 0%,30%{opacity:0;} 60%,100%{opacity:1;} }
.mg .pct { animation:mg-fade 3s ease-out infinite; }
@media(prefers-reduced-motion:reduce){ .mg *{ animation:none !important; } .mg .ring-fg{ stroke-dashoffset:27; } }

/* bottom CTA */
.cta { max-width:880px; margin:0 auto; padding:80px 52px; text-align:center; border-top:1px solid var(--line); }
.cta-h2 { font-size:clamp(26px,3.5vw,40px); font-weight:800; letter-spacing:-1.5px; margin-bottom:28px; }

footer { border-top:1px solid var(--line); padding:40px 52px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
.foot-copy { font-family:'Geist Mono',monospace; font-size:12px; color:var(--mid); }
.foot-links { display:flex; gap:24px; flex-wrap:wrap; }
.foot-links a { font-size:13px; color:var(--mid); text-decoration:none; }
.foot-links a:hover { color:var(--white); }

@media(max-width:768px){
  nav { padding:0 20px; }
  .nav-link { display:none; }
  .hero { padding:110px 20px 60px; }
  .features { padding:20px; gap:16px; }
  .feature { grid-template-columns:1fr; gap:24px; padding:28px 24px; }
  .feature:nth-child(even) .feat-visual { order:0; }
  .feat-title { font-size:21px; }
  .cta { padding:60px 20px; }
  footer { padding:32px 20px; }
}
`;

const buildHtml = (t) => `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${css}</style>

<nav>
  <div class="logo">Salary<span>FYI</span></div>
  <div class="nav-r">
    <a class="nav-link" href="/">${t('app.nav.home')}</a>
    <a class="nav-link" href="/how-it-works">${t('app.nav.howItWorks')}</a>
    <a class="nav-link active" href="/app">${t('app.nav.app')}</a>
    <a class="nav-btn" href="${APP_STORE_URL}">${t('app.nav.download')}</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="kicker">${t('app.hero.kicker')}</div>
  <h1 class="hero-h1">${t('app.hero.title')}</h1>
  <p class="hero-sub">${t('app.hero.sub')}</p>

  <div class="dl-row">
    <a class="dl-btn" href="${APP_STORE_URL}">
      <svg class="apple-ico" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
      <span style="text-align:left;">
        <span class="dl-sub">Download on the</span><br/>
        <span class="big">App Store</span>
      </span>
    </a>
    <!-- 안드로이드 출시 시 활성화
    <a class="dl-btn secondary" href="${''}">
      <span style="text-align:left;">
        <span class="dl-sub">GET IT ON</span><br/>
        <span class="big">Google Play</span>
      </span>
    </a>
    -->
  </div>

  <div class="hero-shot">${t('app.hero.shot')}</div>
</section>

<!-- FEATURES -->
<section class="features">

  <div class="feature">
    <div class="feat-text">
      <div class="feat-num">01</div>
      <div class="feat-title">${t('app.feat1.title')}</div>
      <div class="feat-body">${t('app.feat1.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <line x1="50" y1="166" x2="300" y2="166" stroke="rgba(242,240,235,0.12)" stroke-width="1.5"/>
        <rect class="bar b1" x="62"  y="120" width="30" height="46"  rx="5" fill="rgba(242,240,235,0.22)"/>
        <rect class="bar b2" x="108" y="96"  width="30" height="70"  rx="5" fill="rgba(242,240,235,0.3)"/>
        <rect class="bar b3" x="154" y="56"  width="30" height="110" rx="5" fill="var(--orange)"/>
        <rect class="bar b4" x="200" y="86"  width="30" height="80"  rx="5" fill="rgba(242,240,235,0.3)"/>
        <rect class="bar b5" x="246" y="112" width="30" height="54"  rx="5" fill="rgba(242,240,235,0.22)"/>
        <rect x="135" y="30" width="68" height="22" rx="6" fill="var(--orange)"/>
        <text x="169" y="45" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" letter-spacing="0.5" font-family="Geist,sans-serif">MEDIAN</text>
      </svg>
    </div>
  </div>

  <div class="feature">
    <div class="feat-text">
      <div class="feat-num">02</div>
      <div class="feat-title">${t('app.feat2.title')}</div>
      <div class="feat-body">${t('app.feat2.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="60" y="46" width="220" height="118" rx="14" fill="rgba(242,240,235,0.04)" stroke="rgba(242,240,235,0.1)"/>
        <circle cx="90" cy="80" r="14" fill="rgba(242,240,235,0.15)"/>
        <rect x="116" y="72" width="84" height="9" rx="4.5" fill="rgba(242,240,235,0.22)"/>
        <rect x="116" y="88" width="56" height="8" rx="4" fill="rgba(242,240,235,0.12)"/>
        <g transform="translate(116,110)">
          <path class="star s1" transform="translate(0,0)"   d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s2" transform="translate(28,0)"  d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s3" transform="translate(56,0)"  d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s4" transform="translate(84,0)"  d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s5" transform="translate(112,0)" d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
        </g>
        <rect x="116" y="144" width="148" height="8" rx="4" fill="rgba(242,240,235,0.1)"/>
      </svg>
    </div>
  </div>

  <div class="feature">
    <div class="feat-text">
      <div class="feat-num">03</div>
      <div class="feat-title">${t('app.feat3.title')}</div>
      <div class="feat-body">${t('app.feat3.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g class="bub c1">
          <circle cx="44" cy="64" r="12" fill="rgba(242,240,235,0.14)"/>
          <rect x="60" y="46" width="150" height="38" rx="14" fill="rgba(242,240,235,0.06)" stroke="rgba(242,240,235,0.1)"/>
          <rect x="74" y="58" width="104" height="7" rx="3.5" fill="rgba(242,240,235,0.26)"/>
          <rect x="74" y="70" width="68" height="6" rx="3" fill="rgba(242,240,235,0.13)"/>
        </g>
        <g class="bub c2">
          <circle cx="296" cy="118" r="12" fill="rgba(255,96,0,0.45)"/>
          <rect x="130" y="100" width="150" height="38" rx="14" fill="rgba(255,96,0,0.15)" stroke="rgba(255,96,0,0.4)"/>
          <rect x="144" y="112" width="92" height="7" rx="3.5" fill="rgba(255,170,120,0.75)"/>
          <rect x="144" y="124" width="60" height="6" rx="3" fill="rgba(255,170,120,0.4)"/>
        </g>
        <g class="bub c3">
          <circle cx="44" cy="170" r="11" fill="rgba(242,240,235,0.14)"/>
          <rect x="60" y="154" width="132" height="34" rx="13" fill="rgba(242,240,235,0.06)" stroke="rgba(242,240,235,0.1)"/>
          <rect x="74" y="167" width="82" height="7" rx="3.5" fill="rgba(242,240,235,0.22)"/>
        </g>
      </svg>
    </div>
  </div>

  <div class="feature">
    <div class="feat-text">
      <div class="feat-num">04</div>
      <div class="feat-title">${t('app.feat4.title')}</div>
      <div class="feat-body">${t('app.feat4.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g transform="translate(170,105)">
          <circle r="54" fill="none" stroke="rgba(242,240,235,0.1)" stroke-width="12"/>
          <circle class="ring-fg" r="54" fill="none" stroke="var(--orange)" stroke-width="12" stroke-linecap="round" transform="rotate(-90)"/>
          <text class="pct" y="-5" text-anchor="middle" dominant-baseline="central" fill="var(--white)" font-size="34" font-weight="800" font-family="Geist,sans-serif">92%</text>
          <text class="pct" y="20" text-anchor="middle" fill="var(--mid)" font-size="12" letter-spacing="0.5" font-family="Geist,sans-serif">Match</text>
        </g>
      </svg>
    </div>
  </div>

</section>

<!-- BOTTOM CTA -->
<section class="cta">
  <h2 class="cta-h2">${t('app.cta.title')}</h2>
  <div class="dl-row">
    <a class="dl-btn" href="${APP_STORE_URL}">
      <svg class="apple-ico" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
      <span style="text-align:left;">
        <span class="dl-sub">Download on the</span><br/>
        <span class="big">App Store</span>
      </span>
    </a>
  </div>
</section>

<footer>
  <div class="foot-copy">© 2026 SalaryFYI · Likelion Vietnam</div>
  <div class="foot-links">
    <a href="/">${t('app.nav.home')}</a>
    <a href="/how-it-works">${t('app.nav.howItWorks')}</a>
    <a href="/app">${t('app.nav.app')}</a>
    <a href="/privacy">${t('app.foot.privacy')}</a>
    <a href="/terms">${t('app.foot.terms')}</a>
  </div>
</footer>
`;

export default function AppLanding() {
  const { t, lang } = useT();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHtml(t), [lang]);
  return (
    <>
      <Head>
        <title>{t('app.meta.title')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={t('app.meta.desc')} />
        <meta property="og:title" content="SalaryFYI App" />
        <meta property="og:description" content={t('app.meta.desc')} />
        <meta property="og:image" content="https://salary-fyi.com/og-image.png" />
        <link rel="canonical" href="https://salary-fyi.com/app" />
      </Head>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
