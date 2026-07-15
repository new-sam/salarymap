import Head from 'next/head';
import { useMemo, useEffect } from 'react';
import { useT } from '../lib/i18n';

// 앱 다운로드/소개 페이지 (salary-fyi.com/app).
// Apple 심사용 마케팅 URL로 첨부하는 용도. 기능 목업은 .feature 슬롯에 나중에 추가.
// App Store 링크. 지역/언어 강제 없이 방문자 스토어로 자동 분기되는 정규형 사용.
const APP_STORE_URL = 'https://apps.apple.com/app/id6778311550';
// const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.salaryfyi'; // 안드로이드 출시 시
const LOGO = '/fyi-logo.png';
const MOCKUP = '/app-mockup.png';

// 미세한 필름 그레인 (feTurbulence) — 다크 배경의 밴딩 제거 + 질감
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const css = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:var(--sm-bg); --bg1:var(--sm-surface); --bg2:var(--sm-surface-sub);
  --line:var(--sm-line);
  --white:var(--sm-ink); --mid:var(--sm-text-sub); --dim:var(--sm-text-mute);
  --orange:var(--sm-accent); --orange-lt:var(--sm-accent-strong);
}
html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--white); font-family:'Geist',sans-serif; -webkit-font-smoothing:antialiased; overflow-x:hidden; }

/* ---------- ambient background layers ---------- */
.bg-layer { position:fixed; inset:0; z-index:-2; overflow:hidden; pointer-events:none; }
.blob { position:absolute; border-radius:50%; filter:blur(100px); }
.blob.b1 { width:560px; height:560px; top:-160px; left:-120px; background:radial-gradient(circle,rgba(255,68,0,0.10),transparent 70%); animation:drift1 19s ease-in-out infinite; }
.blob.b2 { width:460px; height:460px; top:34%; right:-140px; background:radial-gradient(circle,rgba(255,68,0,0.07),transparent 70%); animation:drift2 23s ease-in-out infinite; }
.blob.b3 { width:600px; height:600px; bottom:-220px; left:30%; background:radial-gradient(circle,rgba(255,68,0,0.05),transparent 70%); animation:drift3 27s ease-in-out infinite; }
@keyframes drift1 { 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(70px,50px) scale(1.08);} }
@keyframes drift2 { 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(-60px,40px) scale(1.12);} }
@keyframes drift3 { 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(40px,-60px) scale(1.06);} }
.grid { position:fixed; inset:0; z-index:-2; pointer-events:none;
  background-image:linear-gradient(rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px);
  background-size:62px 62px;
  -webkit-mask-image:radial-gradient(ellipse 80% 55% at 50% 0%, #000 0%, transparent 75%);
  mask-image:radial-gradient(ellipse 80% 55% at 50% 0%, #000 0%, transparent 75%); }
.grain { position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.02; mix-blend-mode:multiply; background-image:${GRAIN}; }

/* scroll progress + cursor glow */
.progress { position:fixed; top:0; left:0; height:2.5px; width:100%; transform-origin:0 50%; transform:scaleX(0); background:linear-gradient(90deg,var(--orange),var(--orange-lt)); z-index:300; box-shadow:0 0 12px rgba(255,68,0,0.3); }
.cursor-glow { position:fixed; top:0; left:0; width:440px; height:440px; margin:-220px 0 0 -220px; border-radius:50%; pointer-events:none; z-index:60; background:radial-gradient(circle, rgba(255,68,0,0.06), transparent 62%); opacity:0; transition:opacity .4s; }

/* ---------- nav ---------- */
nav { position:fixed; top:0; left:0; right:0; z-index:200; padding:0 52px; height:56px; display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.78); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border-bottom:1px solid var(--line); }
.logo { display:flex; align-items:center; text-decoration:none; }
.logo img { height:24px; width:auto; display:block; filter:drop-shadow(0 2px 8px rgba(255,68,0,0.25)); transition:transform .16s; }
.logo:hover img { transform:scale(1.06); }
.nav-r { display:flex; align-items:center; gap:32px; }
.nav-link { font-size:13px; color:var(--mid); text-decoration:none; transition:color .15s; }
.nav-link:hover { color:var(--white); }
.nav-link.active { color:var(--white); }
.nav-btn { font-family:'Geist',sans-serif; font-size:12px; font-weight:600; background:var(--orange); color:#fff; border:none; padding:8px 18px; border-radius:6px; cursor:pointer; text-decoration:none; box-shadow:0 6px 20px -6px rgba(255,68,0,0.35); transition:transform .14s, box-shadow .14s; }
.nav-btn:hover { transform:translateY(-1px); box-shadow:0 10px 26px -6px rgba(255,68,0,0.45); }

/* ---------- hero ---------- */
.hero { position:relative; max-width:900px; margin:0 auto; padding:132px 52px 72px; text-align:center; }
.hero::before { content:''; position:absolute; top:40px; left:50%; width:680px; height:420px; transform:translateX(-50%); background:radial-gradient(ellipse at center, rgba(255,68,0,0.08), transparent 65%); pointer-events:none; z-index:-1; }
.kicker { position:relative; display:inline-flex; align-items:center; gap:8px; font-family:'Geist Mono',monospace; font-size:11px; font-weight:500; color:var(--white); letter-spacing:2px; text-transform:uppercase; margin-bottom:24px; padding:7px 16px; border:1px solid transparent; border-radius:100px; overflow:hidden; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); box-shadow:0 8px 26px -10px rgba(255,68,0,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
  background:linear-gradient(rgba(255,255,255,0.85),rgba(250,250,248,0.85)) padding-box, linear-gradient(120deg, rgba(255,68,0,0.55), rgba(255,214,200,0.8) 48%, rgba(255,68,0,0.4)) border-box; }
.kicker svg { width:11px; height:13px; fill:var(--orange-lt); flex-shrink:0; position:relative; z-index:1; filter:drop-shadow(0 0 6px rgba(255,68,0,0.25)); }
.kicker .kx { position:relative; z-index:1; }
.kicker::after { content:''; position:absolute; top:0; left:-70%; width:45%; height:100%; background:linear-gradient(100deg,transparent,rgba(255,255,255,0.6),transparent); transform:skewX(-22deg); animation:ksweep 4.8s ease-in-out infinite; }
@keyframes ksweep { 0%,55%{ left:-70%;} 82%,100%{ left:170%;} }

.hero-logo { width:min(360px,74vw); margin:0 auto 26px; transform:translate(calc(var(--px,0)*16px), calc(var(--py,0)*12px)); transition:transform .25s ease-out; }
.hero-logo img { width:100%; height:auto; display:block; filter:drop-shadow(0 28px 60px rgba(255,68,0,0.18)) drop-shadow(0 4px 14px rgba(0,0,0,0.12)); animation:float 6s ease-in-out infinite; }
@keyframes float { 0%,100%{ transform:translateY(0) rotate(-.4deg);} 50%{ transform:translateY(-13px) rotate(.4deg);} }

.hero-h1 { font-size:clamp(31px,4.7vw,52px); font-weight:800; letter-spacing:-1.5px; line-height:1.16; margin:0 auto 20px; max-width:620px; text-wrap:balance; word-break:keep-all; }
.hero-h1 span { background:linear-gradient(92deg,var(--orange),var(--orange-lt) 45%,var(--orange)); background-size:220% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; animation:shine 4.5s linear infinite; }
@keyframes shine { to { background-position:220% center; } }
.hero-sub { font-size:17px; color:var(--mid); line-height:1.7; font-weight:300; max-width:520px; margin:0 auto 40px; }

/* download buttons */
.dl-row { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
.dl-btn { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:9px; background:var(--sm-ink); color:#fff; padding:9px 18px; border-radius:11px; text-decoration:none; transition:transform .16s, box-shadow .16s; box-shadow:0 10px 30px -10px rgba(0,0,0,0.18); }
.dl-btn:hover { transform:translateY(-3px); box-shadow:0 16px 40px -12px rgba(0,0,0,0.22); }
.dl-btn.secondary { background:var(--bg2); color:var(--white); border:1px solid var(--line); box-shadow:none; }
.dl-btn::after { content:''; position:absolute; top:0; left:-130%; width:55%; height:100%; background:linear-gradient(100deg,transparent,rgba(255,255,255,0.65),transparent); transform:skewX(-20deg); animation:sweep 3.6s ease-in-out infinite; }
@keyframes sweep { 0%{ left:-130%;} 28%,100%{ left:170%;} }
.dl-sub { font-size:11px; color:inherit; font-weight:400; line-height:1; letter-spacing:.2px; }
.dl-btn .big { font-size:20px; font-weight:600; line-height:1.1; letter-spacing:-.5px; }
.apple-ico { width:24px; height:24px; flex-shrink:0; position:relative; z-index:1; }
.dl-btn.soon, .nav-btn.soon { cursor:default; }
.dl-btn.soon:hover { transform:none; box-shadow:0 10px 30px -10px rgba(0,0,0,0.18); }
.nav-btn.soon:hover { transform:none; box-shadow:0 6px 20px -6px rgba(255,68,0,0.35); }

/* ---------- app mockup ---------- */
.hero-mock { position:relative; margin:54px auto 0; width:min(500px,94vw); transform:translate(calc(var(--px,0)*-20px), calc(var(--py,0)*-12px)); transition:transform .25s ease-out; }
.hero-mock-glow { position:absolute; inset:2% 0 6%; border-radius:50%; background:radial-gradient(ellipse at center, rgba(255,68,0,0.14), transparent 62%); filter:blur(30px); z-index:-1; }
.hero-mock img { width:100%; height:auto; display:block; filter:drop-shadow(0 44px 72px rgba(0,0,0,0.16)); animation:float 7s ease-in-out infinite; }

/* ---------- features ---------- */
.features { max-width:1040px; margin:0 auto; padding:50px 52px 90px; display:flex; flex-direction:column; gap:24px; }
.feature { position:relative; display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:48px; border:1px solid var(--line); border-radius:20px; padding:44px; background:var(--bg1); overflow:hidden; transition:transform .4s cubic-bezier(.2,.7,.2,1), border-color .4s, box-shadow .4s; }
.feature::before { content:''; position:absolute; inset:0; border-radius:inherit; pointer-events:none; opacity:0; transition:opacity .35s; background:radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(255,68,0,0.05), transparent 60%); }
.feature:hover { transform:translateY(-5px); border-color:var(--sm-accent-border); box-shadow:0 24px 70px -28px rgba(255,68,0,0.14); }
.feature:hover::before { opacity:1; }
.feature > * { position:relative; z-index:1; }
.feature:nth-child(even) .feat-visual { order:-1; }
.feat-num { font-family:'Geist Mono',monospace; font-size:12px; color:var(--orange); letter-spacing:2px; margin-bottom:16px; }
.feat-title { font-size:25px; font-weight:700; letter-spacing:-.8px; line-height:1.25; margin-bottom:12px; }
.feat-body { font-size:15px; color:var(--mid); line-height:1.75; font-weight:300; max-width:380px; }
.feat-visual { aspect-ratio:16/11; border-radius:16px; background:linear-gradient(160deg,var(--bg2),var(--sm-bg-warm)); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.mg { width:100%; height:100%; display:block; }

/* motion graphics */
@keyframes mg-bar { 0%,100%{ transform:scaleY(.55);} 50%{ transform:scaleY(1);} }
.mg .bar { transform-box:fill-box; transform-origin:bottom; animation:mg-bar 2.6s ease-in-out infinite; }
.mg .bar.b2{ animation-delay:.2s;} .mg .bar.b3{ animation-delay:.4s;} .mg .bar.b4{ animation-delay:.6s;} .mg .bar.b5{ animation-delay:.8s;}
@keyframes mg-star { 0%,8%{ fill:rgba(17,17,17,0.14);} 22%,100%{ fill:var(--orange);} }
.mg .star { animation:mg-star 3s ease-in-out infinite; }
.mg .star.s2{animation-delay:.25s;} .mg .star.s3{animation-delay:.5s;} .mg .star.s4{animation-delay:.75s;} .mg .star.s5{animation-delay:1s;}
@keyframes mg-pop { 0%,100%{ opacity:0; transform:translateY(10px) scale(.94);} 12%,80%{ opacity:1; transform:translateY(0) scale(1);} }
.mg .bub { transform-box:fill-box; transform-origin:center; animation:mg-pop 4.2s ease-in-out infinite; }
.mg .bub.c2{ animation-delay:1s;} .mg .bub.c3{ animation-delay:2s;}
@keyframes mg-ring { 0%{ stroke-dashoffset:339;} 55%,100%{ stroke-dashoffset:27;} }
.mg .ring-fg { stroke-dasharray:339; stroke-dashoffset:339; animation:mg-ring 3s ease-out infinite; }
@keyframes mg-fade { 0%,30%{opacity:0;} 60%,100%{opacity:1;} }
.mg .pct { animation:mg-fade 3s ease-out infinite; }

/* ---------- scroll reveal ---------- */
.reveal { opacity:0; transform:translateY(28px); filter:blur(6px); transition:opacity .75s cubic-bezier(.2,.7,.2,1), transform .75s cubic-bezier(.2,.7,.2,1), filter .75s; transition-delay:var(--d,0s); }
.reveal.in { opacity:1; transform:none; filter:none; }

/* ---------- bottom CTA ---------- */
.cta { position:relative; max-width:880px; margin:0 auto; padding:90px 52px; text-align:center; border-top:1px solid var(--line); }
.cta::before { content:''; position:absolute; top:0; left:50%; width:600px; height:300px; transform:translateX(-50%); background:radial-gradient(ellipse at center, rgba(255,68,0,0.07), transparent 65%); pointer-events:none; }
.cta-logo { width:170px; margin:0 auto 26px; }
.cta-logo img { width:100%; height:auto; filter:drop-shadow(0 16px 40px rgba(255,68,0,0.18)); animation:float 6s ease-in-out infinite; }
.cta-h2 { position:relative; font-size:clamp(26px,3.5vw,40px); font-weight:800; letter-spacing:-1.5px; margin-bottom:28px; }

footer { position:relative; border-top:1px solid var(--line); padding:40px 52px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
.foot-copy { font-family:'Geist Mono',monospace; font-size:12px; color:var(--mid); }
.foot-links { display:flex; gap:24px; flex-wrap:wrap; }
.foot-links a { font-size:13px; color:var(--mid); text-decoration:none; transition:color .15s; }
.foot-links a:hover { color:var(--white); }

@media(max-width:768px){
  nav { padding:0 20px; }
  .nav-link { display:none; }
  .hero { padding:104px 20px 56px; }
  .features { padding:30px 20px; gap:16px; }
  .feature { grid-template-columns:1fr; gap:24px; padding:28px 24px; }
  .feature:nth-child(even) .feat-visual { order:0; }
  .feat-title { font-size:21px; }
  .cta { padding:64px 20px; }
  footer { padding:32px 20px; }
  .cursor-glow { display:none; }
}

@media(prefers-reduced-motion:reduce){
  html { scroll-behavior:auto; }
  .mg *, .blob, .hero-logo img, .hero-mock img, .cta-logo img, .hero-h1 span, .dl-btn::after, .kicker::after { animation:none !important; }
  .mg .ring-fg { stroke-dashoffset:27; }
  .reveal { opacity:1 !important; transform:none !important; filter:none !important; }
  .cursor-glow, .progress { display:none; }
}
`;

const buildHtml = (t) => `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${css}</style>

<div class="bg-layer" aria-hidden="true">
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  <div class="blob b3"></div>
</div>
<div class="grid" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<div class="progress" id="prog" aria-hidden="true"></div>
<div class="cursor-glow" id="cglow" aria-hidden="true"></div>

<nav>
  <a class="logo" href="/"><img src="${LOGO}" alt="SalaryFYI"/></a>
  <div class="nav-r">
    <a class="nav-link" href="/">${t('app.nav.home')}</a>
    <a class="nav-link" href="/how-it-works">${t('app.nav.howItWorks')}</a>
    <a class="nav-link active" href="/app">${t('app.nav.app')}</a>
    <a class="nav-btn soon" role="button" aria-disabled="true">Coming soon</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="kicker reveal" style="--d:0s"><svg viewBox="0 0 384 512" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg><span class="kx">${t('app.hero.kicker')}</span></div>
  <div class="hero-logo reveal" style="--d:.08s"><img src="${LOGO}" alt="SalaryFYI"/></div>
  <h1 class="hero-h1 reveal" style="--d:.16s">${t('app.hero.title')}</h1>
  <p class="hero-sub reveal" style="--d:.24s">${t('app.hero.sub')}</p>

  <div class="dl-row reveal" style="--d:.32s">
    <a class="dl-btn soon" role="button" aria-disabled="true">
      <svg class="apple-ico" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
      <span style="text-align:left; position:relative; z-index:1;">
        <span class="dl-sub">Coming soon to the</span><br/>
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

  <div class="hero-mock reveal" style="--d:.42s">
    <div class="hero-mock-glow"></div>
    <img src="${MOCKUP}" alt="${t('app.hero.shot')}"/>
  </div>
</section>

<!-- FEATURES -->
<section class="features">

  <div class="feature reveal">
    <div class="feat-text">
      <div class="feat-num">01</div>
      <div class="feat-title">${t('app.feat1.title')}</div>
      <div class="feat-body">${t('app.feat1.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <line x1="50" y1="166" x2="300" y2="166" stroke="rgba(17,17,17,0.12)" stroke-width="1.5"/>
        <rect class="bar b1" x="62"  y="120" width="30" height="46"  rx="5" fill="rgba(17,17,17,0.22)"/>
        <rect class="bar b2" x="108" y="96"  width="30" height="70"  rx="5" fill="rgba(17,17,17,0.3)"/>
        <rect class="bar b3" x="154" y="56"  width="30" height="110" rx="5" fill="var(--orange)"/>
        <rect class="bar b4" x="200" y="86"  width="30" height="80"  rx="5" fill="rgba(17,17,17,0.3)"/>
        <rect class="bar b5" x="246" y="112" width="30" height="54"  rx="5" fill="rgba(17,17,17,0.22)"/>
        <rect x="135" y="30" width="68" height="22" rx="6" fill="var(--orange)"/>
        <text x="169" y="45" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" letter-spacing="0.5" font-family="Geist,sans-serif">MEDIAN</text>
      </svg>
    </div>
  </div>

  <div class="feature reveal">
    <div class="feat-text">
      <div class="feat-num">02</div>
      <div class="feat-title">${t('app.feat2.title')}</div>
      <div class="feat-body">${t('app.feat2.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="60" y="46" width="220" height="118" rx="14" fill="rgba(17,17,17,0.04)" stroke="rgba(17,17,17,0.1)"/>
        <circle cx="90" cy="80" r="14" fill="rgba(17,17,17,0.15)"/>
        <rect x="116" y="72" width="84" height="9" rx="4.5" fill="rgba(17,17,17,0.22)"/>
        <rect x="116" y="88" width="56" height="8" rx="4" fill="rgba(17,17,17,0.12)"/>
        <g transform="translate(116,110)">
          <path class="star s1" transform="translate(0,0)"   d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s2" transform="translate(28,0)"  d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s3" transform="translate(56,0)"  d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s4" transform="translate(84,0)"  d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
          <path class="star s5" transform="translate(112,0)" d="M11 1L13.4 7.8 20.5 7.9 14.8 12.2 16.9 19.1 11 15 5.1 19.1 7.2 12.2 1.5 7.9 8.7 7.8Z"/>
        </g>
        <rect x="116" y="144" width="148" height="8" rx="4" fill="rgba(17,17,17,0.1)"/>
      </svg>
    </div>
  </div>

  <div class="feature reveal">
    <div class="feat-text">
      <div class="feat-num">03</div>
      <div class="feat-title">${t('app.feat3.title')}</div>
      <div class="feat-body">${t('app.feat3.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g class="bub c1">
          <circle cx="44" cy="64" r="12" fill="rgba(17,17,17,0.14)"/>
          <rect x="60" y="46" width="150" height="38" rx="14" fill="rgba(17,17,17,0.06)" stroke="rgba(17,17,17,0.1)"/>
          <rect x="74" y="58" width="104" height="7" rx="3.5" fill="rgba(17,17,17,0.26)"/>
          <rect x="74" y="70" width="68" height="6" rx="3" fill="rgba(17,17,17,0.13)"/>
        </g>
        <g class="bub c2">
          <circle cx="296" cy="118" r="12" fill="rgba(255,68,0,0.8)"/>
          <rect x="130" y="100" width="150" height="38" rx="14" fill="var(--sm-accent-tint)" stroke="var(--sm-accent-border)"/>
          <rect x="144" y="112" width="92" height="7" rx="3.5" fill="rgba(255,68,0,0.55)"/>
          <rect x="144" y="124" width="60" height="6" rx="3" fill="rgba(255,68,0,0.3)"/>
        </g>
        <g class="bub c3">
          <circle cx="44" cy="170" r="11" fill="rgba(17,17,17,0.14)"/>
          <rect x="60" y="154" width="132" height="34" rx="13" fill="rgba(17,17,17,0.06)" stroke="rgba(17,17,17,0.1)"/>
          <rect x="74" y="167" width="82" height="7" rx="3.5" fill="rgba(17,17,17,0.22)"/>
        </g>
      </svg>
    </div>
  </div>

  <div class="feature reveal">
    <div class="feat-text">
      <div class="feat-num">04</div>
      <div class="feat-title">${t('app.feat4.title')}</div>
      <div class="feat-body">${t('app.feat4.body')}</div>
    </div>
    <div class="feat-visual">
      <svg class="mg" viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g transform="translate(170,105)">
          <circle r="54" fill="none" stroke="rgba(17,17,17,0.1)" stroke-width="12"/>
          <circle class="ring-fg" r="54" fill="none" stroke="var(--orange)" stroke-width="12" stroke-linecap="round" transform="rotate(-90)"/>
          <text class="pct js-count" data-count="92" data-suffix="%" y="-5" text-anchor="middle" dominant-baseline="central" fill="var(--white)" font-size="34" font-weight="800" font-family="Geist,sans-serif">0%</text>
          <text class="pct" y="20" text-anchor="middle" fill="var(--mid)" font-size="12" letter-spacing="0.5" font-family="Geist,sans-serif">Match</text>
        </g>
      </svg>
    </div>
  </div>

</section>

<!-- BOTTOM CTA -->
<section class="cta">
  <div class="cta-logo reveal"><img src="${LOGO}" alt="SalaryFYI"/></div>
  <h2 class="cta-h2 reveal" style="--d:.08s">${t('app.cta.title')}</h2>
  <div class="dl-row reveal" style="--d:.16s">
    <a class="dl-btn soon" role="button" aria-disabled="true">
      <svg class="apple-ico" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
      <span style="text-align:left; position:relative; z-index:1;">
        <span class="dl-sub">Coming soon to the</span><br/>
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

  // 인터랙션: 스크롤 등장 / 카운터 / 카드 스포트라이트 / 커서 글로우 / 진행바.
  // dangerouslySetInnerHTML 안의 <script>는 실행되지 않으므로 여기서 바인딩한다.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(hover: none)').matches;

    // 스크롤 등장
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    // 숫자 카운터 롤업
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = Number(el.dataset.count) || 0;
        const suffix = el.dataset.suffix || '';
        if (reduce) { el.textContent = target + suffix; cio.unobserve(el); return; }
        const dur = 1300, t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.js-count').forEach((el) => cio.observe(el));

    // 마우스 추적: 커서 글로우 + 히어로 패럴럭스 + 카드 스포트라이트
    const cglow = document.getElementById('cglow');
    const hero = document.querySelector('.hero');
    const features = Array.from(document.querySelectorAll('.feature'));
    const onMove = (ev) => {
      if (cglow) { cglow.style.opacity = '1'; cglow.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`; }
      if (hero) {
        hero.style.setProperty('--px', String(ev.clientX / window.innerWidth - 0.5));
        hero.style.setProperty('--py', String(ev.clientY / window.innerHeight - 0.5));
      }
      for (const card of features) {
        const r = card.getBoundingClientRect();
        if (ev.clientY < r.top - 200 || ev.clientY > r.bottom + 200) continue;
        card.style.setProperty('--mx', `${ev.clientX - r.left}px`);
        card.style.setProperty('--my', `${ev.clientY - r.top}px`);
      }
    };
    if (!touch && !reduce) window.addEventListener('pointermove', onMove, { passive: true });

    // 스크롤 진행바
    const prog = document.getElementById('prog');
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (prog) prog.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      cio.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [html]);

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
