import Head from 'next/head';

const css = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#0c0c0b; --bg1:#141413; --bg2:#1c1c1a;
  --line:rgba(255,255,255,0.07);
  --white:#f2f0eb; --mid:rgba(242,240,235,0.42); --dim:rgba(242,240,235,0.2);
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
.nav-btn { font-family:'Geist',sans-serif; font-size:12px; font-weight:600; background:var(--orange); color:#fff; border:none; padding:8px 18px; border-radius:2px; cursor:pointer; }
.page { max-width:720px; margin:0 auto; padding:120px 52px 80px; }
.kicker { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:24px; }
.page-h1 { font-size:clamp(32px,4vw,52px); font-weight:800; letter-spacing:-2px; line-height:1.08; margin-bottom:16px; }
.page-sub { font-size:16px; color:var(--mid); line-height:1.8; font-weight:300; margin-bottom:64px; }
.section { margin-bottom:56px; padding-bottom:56px; border-bottom:1px solid var(--line); }
.section:last-child { border-bottom:none; }
.section-num { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); margin-bottom:12px; }
.section-title { font-size:22px; font-weight:700; letter-spacing:-.5px; margin-bottom:16px; }
.section-body { font-size:15px; color:var(--mid); line-height:1.9; font-weight:300; }
@media(max-width:768px){
  nav { padding:0 20px; }
  .nav-link { display:none; }
  .page { padding:100px 20px 60px; }
}
`;

const html = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${css}</style>

<nav>
  <div class="logo">Salary<span>Map</span>.vn</div>
  <div class="nav-r">
    <a class="nav-link" href="/">Home</a>
    <a class="nav-link active" href="/how-it-works">How it works</a>
    <button class="nav-btn" onclick="window.location.href='/'">Submit Salary</button>
  </div>
</nav>

<div class="page">
  <div class="kicker">Transparency</div>
  <h1 class="page-h1">How SalaryMap works</h1>
  <p class="page-sub">Transparent, anonymous, and built for Vietnam's IT community.</p>

  <div class="section">
    <div class="section-num">01</div>
    <div class="section-title">How we collect data</div>
    <div class="section-body">Engineers submit their salary anonymously. No name, no email, no company login required. Just role, experience level, and monthly salary.</div>
  </div>

  <div class="section">
    <div class="section-num">02</div>
    <div class="section-title">How we verify data</div>
    <div class="section-body">All submissions are cross-referenced with ITviec 2024–2025 market benchmarks. Outliers are flagged and reviewed. Companies with fewer than 3 submissions show ranges only — never individual figures.</div>
  </div>

  <div class="section">
    <div class="section-num">03</div>
    <div class="section-title">What we never do</div>
    <div class="section-body">We never store personal identifiers. We never sell data to recruiters or companies. We never show individual salaries — only aggregated ranges per company.</div>
  </div>

  <div class="section">
    <div class="section-num">04</div>
    <div class="section-title">Who built this</div>
    <div class="section-body">SalaryMap is built by Likelion Vietnam, a tech education company that has worked with thousands of Vietnamese developers since 2020. We built this because salary transparency benefits everyone in the ecosystem.</div>
  </div>
</div>
`;

export default function HowItWorks() {
  return (
    <>
      <Head>
        <title>How It Works — FYI Salary</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="How FYI Salary collects, verifies, and displays Vietnam IT salary data. Anonymous submissions, real-time results." />
        <meta property="og:title" content="How It Works — FYI Salary" />
        <meta property="og:description" content="How FYI Salary collects, verifies, and displays Vietnam IT salary data." />
        <meta property="og:image" content="https://salary-fyi.com/og-image.png" />
        <link rel="canonical" href="https://salary-fyi.com/how-it-works" />
      </Head>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
