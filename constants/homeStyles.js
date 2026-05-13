export const homeCss = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg:#0c0c0b; --bg1:#141413; --bg2:#1c1c1a;
  --line:rgba(255,255,255,0.07);
  --white:#f2f0eb; --mid:rgba(242,240,235,0.42); --dim:rgba(242,240,235,0.2);
  --orange:#ff6000; --green:#4ade80; --red:#f87171;
}
html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--white); font-family:'Barlow',sans-serif; -webkit-font-smoothing:antialiased; overflow-x:hidden; }

/* NAV */
nav { position:fixed; top:0; left:0; right:0; z-index:200; padding:0 52px; height:56px; display:flex; align-items:center; justify-content:space-between; background:rgba(12,12,11,0.9); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
.logo { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; color:var(--white); }
.nav-r { display:flex; align-items:center; gap:32px; }
.nav-link { position:relative; font-size:13px; color:rgba(242,240,235,0.42); text-decoration:none; background:none; border:none; cursor:pointer; font-family:'Barlow',sans-serif; padding:0; transition:color .2s; }
.nav-link:hover { color:#f0ece4; }
.nav-link::after { content:''; position:absolute; bottom:-2px; left:0; right:0; height:2px; background:#ff6000; transform:scaleX(0); transition:transform .2s ease; }
.nav-link:hover::after { transform:scaleX(1); }
.nav-jobs-cta { display:inline-flex; align-items:center; gap:6px; background:#ff6000; border:none; padding:7px 16px; border-radius:100px; color:#fff; font-weight:700; text-decoration:none; font-size:13px; font-family:'Barlow',sans-serif; position:relative; transition:all .25s; }
.nav-jobs-shimmer { position:absolute; inset:0; border-radius:100px; overflow:hidden; pointer-events:none; }
.nav-jobs-shimmer::before { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent); animation:jobsShimmer 2.5s ease-in-out infinite; }
.nav-jobs-cta:hover { background:#ff7a1a; box-shadow:0 0 20px rgba(255,96,0,0.4); transform:translateY(-1px); }
.nav-jobs-cta::after { display:none !important; }
@keyframes jobsShimmer { 0% { left:-100%; } 50% { left:120%; } 100% { left:120%; } }
.nav-jobs-icon { display:inline-flex; align-items:center; flex-shrink:0; }
.nav-jobs-icon svg { width:14px; height:14px; }
.nav-jobs-bubble { position:absolute; top:calc(100% + 14px); left:50%; transform:translateX(-50%); background:#fafaf8; padding:5px 12px; border-radius:8px; white-space:nowrap; font-size:11px; font-weight:700; color:#ff6000; pointer-events:none; animation:bubbleFloat 3s ease-in-out infinite; box-shadow:0 2px 12px rgba(0,0,0,0.25); }
.nav-jobs-bubble::before { content:''; position:absolute; top:-4px; left:50%; transform:translateX(-50%) rotate(45deg); width:8px; height:8px; background:#fafaf8; }
@keyframes bubbleFloat { 0%,100% { transform:translateX(-50%) translateY(0); } 50% { transform:translateX(-50%) translateY(-3px); } }

/* Company selected state */
.company-selected { display:flex; align-items:center; gap:14px; background:#1a0d07; border:1px solid #ff6000; border-radius:12px; padding:16px 18px; position:relative; overflow:hidden; }
.company-selected::before { content:''; position:absolute; right:-20px; top:-20px; width:80px; height:80px; border-radius:50%; background:#ff6000; opacity:0.06; pointer-events:none; }
.company-selected-logo { width:44px; height:44px; border-radius:10px; background:#fafaf8; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
.company-selected-logo img { width:36px; height:36px; object-fit:contain; }
.company-selected-initials { width:44px; height:44px; border-radius:10px; background:#1e1e1e; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:14px; font-weight:800; color:#555; }
.company-selected-info { flex:1; }
.company-selected-name { font-size:16px; font-weight:600; color:#f0ece4; }
.company-selected-domain { font-size:11px; color:#774433; margin-top:2px; }
.company-selected-badge { font-size:10px; font-weight:500; color:#ff6000; background:#2a1208; padding:3px 8px; border-radius:10px; border:1px solid #3a1a0a; white-space:nowrap; flex-shrink:0; }
.company-selected-clear { background:none; border:none; cursor:pointer; color:#333; font-size:18px; padding:2px 4px; line-height:1; transition:color .15s; flex-shrink:0; font-family:'Barlow',sans-serif; }
.company-selected-clear:hover { color:#888; }
.nav-login-btn { font-family:'Barlow',sans-serif; font-size:13px; font-weight:600; color:rgba(255,255,255,0.5); background:none; border:1px solid rgba(255,255,255,0.15); padding:7px 16px; border-radius:100px; cursor:pointer; transition:border-color .15s,color .15s; }
.nav-login-btn:hover { border-color:rgba(255,255,255,0.35); color:rgba(255,255,255,0.8); }
.nav-btn { font-family:'Barlow',sans-serif; font-size:12px; font-weight:600; background:var(--orange); color:#fff; border:none; padding:8px 18px; border-radius:2px; cursor:pointer; }

/* HERO */
.hero { position:relative; height:100vh; overflow:hidden; padding-top:56px; background:#0c0c0b; }
.hero-copy { position:absolute; inset:0; z-index:10; display:flex; flex-direction:column; justify-content:center; padding:80px 52px 80px 96px; max-width:700px; }
.hero-kicker { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:32px; display:flex; align-items:center; gap:10px; }
.kdot { width:5px; height:5px; border-radius:50%; background:var(--orange); box-shadow:0 0 8px var(--orange); animation:glow 2s ease-in-out infinite; }
@keyframes glow { 0%,100%{box-shadow:0 0 6px var(--orange)} 50%{box-shadow:0 0 20px var(--orange)} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:0.3} }
.hero-h1 { font-size:clamp(36px,4.5vw,64px); font-weight:800; line-height:1.1; letter-spacing:-2px; margin-bottom:24px; color:var(--white); }
.hero-h1 em { font-style:normal; color:var(--orange); }
.hero-sub { font-size:16px; color:var(--mid); line-height:1.8; font-weight:300; max-width:420px; margin-bottom:44px; }
.hero-btns { display:flex; gap:12px; }
.btn-p { font-family:'Barlow',sans-serif; font-size:14px; font-weight:700; background:var(--orange); color:#fff; border:none; padding:14px 28px; border-radius:2px; cursor:pointer; }
.btn-g { font-size:14px; color:var(--mid); background:transparent; border:1px solid var(--line); padding:13px 24px; border-radius:2px; cursor:pointer; font-family:'Barlow',sans-serif; transition:all .15s; }
.btn-g:hover { border-color:rgba(255,255,255,.22); color:var(--white); }
.hero-live-bar {
  position:absolute; bottom:0; left:0; right:0; z-index:10;
  background:rgba(12,12,11,.6); backdrop-filter:blur(8px);
  border-top: 1px solid #1a1a1a;
  padding: 0 40px;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow: hidden;
}
.live-badge {
  display: flex; align-items: center; gap: 7px;
  flex-shrink: 0;
  padding-right: 16px;
  border-right: 1px solid #1e1e1e;
}
.live-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
  animation: livePulse 2s ease-in-out infinite;
}
@keyframes livePulse {
  0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.25;transform:scale(.65)}
}
.live-label {
  font-size: 10px; font-weight: 600; letter-spacing: .18em;
  text-transform: uppercase; color: #4ade80;
}
.live-msg-wrap {
  flex: 1; overflow: hidden; position: relative; height: 52px;
}
.live-msg {
  position: absolute; left: 0; right: 0;
  display: flex; align-items: center; height: 52px;
  opacity: 0; transform: translateY(12px);
  transition: opacity .45s ease, transform .45s ease;
  white-space: nowrap; overflow: hidden;
  font-size: 13px; color: rgba(255,255,255,.55);
}
.live-msg.show { opacity: 1; transform: translateY(0); }
.live-msg.hide { opacity: 0; transform: translateY(-12px); }
.live-msg b { color: white; font-weight: 600; }
.live-msg .co { color: #ff6000; font-weight: 700; }
.live-msg .dim { color: rgba(255,255,255,.3); font-size: 12px; }
.car-dots { position:absolute; right:52px; bottom:88px; z-index:10; display:flex; gap:6px; }
.cdot { width:5px; height:5px; border-radius:50%; background:rgba(255,255,255,.28); cursor:pointer; transition:all .3s; }
.cdot.on { background:var(--orange); width:16px; border-radius:3px; }
.car-arrows { position:absolute; right:52px; top:50%; transform:translateY(-50%); z-index:10; display:flex; flex-direction:column; gap:8px; }
.carr { width:36px; height:36px; border-radius:2px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); color:var(--white); font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.carr:hover { background:rgba(255,255,255,.16); }

/* CARDS SECTION */
.cards-bg { background: #f0ede8; }
.cards-section { max-width:1360px; margin:0 auto; padding:80px 40px 0; }
.cards-bg .section-head-title { color: #0c0c0c; }
.cards-bg .section-head-sub { color: rgba(0,0,0,.5); }
.section-head { margin-bottom:28px; }
.section-head-title { font-size:clamp(22px,2.8vw,32px); font-weight:800; letter-spacing:-1px; margin-bottom:6px; }
.section-head-title em { font-style:normal; color:var(--orange); }
.section-head-sub { font-size:13px; color:var(--mid); font-weight:300; }

/* COMPANY GRID */
.company-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.company-card { border-radius:16px; overflow:hidden; position:relative; height:280px; cursor:pointer; outline:2px solid transparent; outline-offset:-2px; transition:transform .22s, outline-color .22s, box-shadow .22s; }
.company-card:hover { transform:scale(1.03); box-shadow:0 12px 32px rgba(0,0,0,0.35); }
.company-card.open:hover { outline-color:#ff6000; }
.card-bg { position:absolute; inset:0; background-size:cover; background-position:center; }
.card-logo-wrap { position:absolute; bottom:18px; right:16px; z-index:3; }
.card-logo-img { width:32px; height:32px; object-fit:contain; border-radius:8px; background:rgba(255,255,255,0.9); padding:5px; box-shadow:0 2px 10px rgba(0,0,0,0.4); }
.card-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.4) 50%,rgba(0,0,0,.1) 100%); }
.card-locked-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); z-index:1; }
.card-top { position:absolute; top:16px; left:16px; right:16px; display:flex; justify-content:space-between; align-items:center; z-index:2; }
.card-rank { font-size:11px; font-weight:700; color:rgba(255,255,255,.6); background:rgba(0,0,0,.45); padding:4px 10px; border-radius:6px; }
.card-top-badge { font-size:10px; font-weight:700; color:#000; background:#ff6000; padding:3px 8px; border-radius:5px; }
.card-category { font-size:11px; font-weight:600; color:rgba(255,255,255,.75); background:rgba(255,255,255,.12); padding:4px 10px; border-radius:6px; }
.card-bottom { position:absolute; bottom:0; left:0; right:0; padding:20px; z-index:2; }
.card-name-row { display:flex; flex-direction:column; gap:3px; margin-bottom:2px; }
.card-name { font-size:20px; font-weight:800; color:#fff; letter-spacing:-.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
.card-count { font-size:14px; font-weight:700; color:rgba(255,255,255,.6); white-space:nowrap; flex-shrink:0; }
.card-divider { height:1px; background:rgba(255,255,255,.15); margin:8px 0; }
.card-sal { font-size:20px; font-weight:800; color:#ff6000; letter-spacing:-.03em; line-height:1; }
.card-lock-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; z-index:2; }
.card-lock-icon { font-size:22px; }
.card-lock-name { font-size:13px; font-weight:700; color:#fff; }
.card-lock-count { font-size:11px; color:rgba(255,255,255,.5); }
.lock-cta { position:absolute; bottom:14px; left:14px; right:14px; background:#ff6000; color:#000; font-size:11px; font-weight:700; padding:8px; border-radius:8px; text-align:center; opacity:0; transition:opacity .2s; z-index:3; }
.company-card.locked:hover .lock-cta { opacity:1; }
.cards-unlock-cta { grid-column:1/-1; margin-top:4px; padding:28px 36px; background:linear-gradient(100deg,rgba(255,98,0,.07) 0%,rgba(0,0,0,0) 60%); border:1px solid rgba(255,98,0,.22); border-radius:16px; display:flex; align-items:center; justify-content:space-between; gap:24px; cursor:pointer; transition:border-color .2s,background .2s; }
.cards-unlock-cta:hover { border-color:rgba(255,98,0,.5); background:linear-gradient(100deg,rgba(255,98,0,.12) 0%,rgba(0,0,0,0) 60%); }
.cards-unlock-cta-left { display:flex; align-items:center; gap:16px; }
.cards-unlock-cta-icon { font-size:28px; flex-shrink:0; }
.cards-unlock-cta-title { font-size:17px; font-weight:800; color:#f2f0eb; line-height:1.2; }
.cards-unlock-cta-sub { font-size:13px; color:rgba(255,255,255,.4); margin-top:3px; }
.cards-unlock-cta-btn { flex-shrink:0; background:#ff6000; color:#000; font-size:13px; font-weight:800; padding:11px 22px; border-radius:100px; white-space:nowrap; transition:opacity .15s; }
.cards-unlock-cta:hover .cards-unlock-cta-btn { opacity:.85; }
@media(max-width:600px){ .cards-unlock-cta { flex-direction:column; align-items:flex-start; padding:20px; } .cards-unlock-cta-btn { align-self:stretch; text-align:center; } }
.cta-main { font-size:16px; font-weight:700; color:#fff; }
.cta-sub { font-size:12px; color:rgba(255,255,255,.45); }

/* WGF SECTION */
.wgf-section { max-width:1100px; margin:0 auto; padding:40px 40px 80px; }
.wgf-eyebrow { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:800; color:#ff6000; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:48px; }
.wgf-eyebrow::before { content:''; width:6px; height:6px; border-radius:50%; background:#ff6000; }
.wgf-director-row { display:grid; grid-template-columns:380px 1fr; gap:48px; align-items:stretch; margin-bottom:20px; }
.wgf-photo-wrap { position:relative; border-radius:20px; overflow:hidden; }
.wgf-photo-wrap img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
.wgf-photo-wrap::after { content:''; position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.35) 0%,transparent 50%); pointer-events:none; }
.wgf-story { display:flex; flex-direction:column; justify-content:center; gap:28px; }
.wgf-quote-mark { font-size:72px; font-weight:900; color:#ff6000; line-height:.7; opacity:.35; margin-bottom:-8px; }
.wgf-headline { font-size:36px; font-weight:900; color:#fff; letter-spacing:-1.5px; line-height:1.15; }
.wgf-headline span { color:#ff6000; }
.wgf-body { font-size:16px; color:rgba(255,255,255,.55); line-height:1.8; }
.wgf-body strong { color:rgba(255,255,255,.88); }
.wgf-sig { padding-top:8px; border-top:1px solid rgba(255,255,255,.08); }
.wgf-sig-name { font-size:13px; font-weight:800; color:rgba(255,255,255,.85); margin-bottom:2px; }
.wgf-sig-sub { font-size:12px; color:rgba(255,255,255,.3); }
.wgf-divider { display:flex; align-items:center; gap:16px; margin:44px 0 32px; }
.wgf-divider::before, .wgf-divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.08); }
.wgf-divider span { font-size:11px; font-weight:800; color:rgba(255,255,255,.2); letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
.wgf-team-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.wgf-team-card { border-radius:16px; overflow:hidden; position:relative; aspect-ratio:3/4; cursor:pointer; }
.wgf-team-card img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
.wgf-team-card::after { content:''; position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.2) 0%,transparent 60%); pointer-events:none; }
.wgf-bottom-cta { margin-top:52px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; }
.wgf-bottom-cta p { font-size:14px; color:rgba(255,255,255,.35); }
.wgf-bottom-cta p strong { color:rgba(255,255,255,.7); }
.wgf-cta-btn { display:inline-flex; align-items:center; gap:8px; background:#ff6000; color:#fff; font-size:15px; font-weight:900; padding:14px 32px; border-radius:100px; border:none; cursor:pointer; letter-spacing:-.2px; transition:background .15s; }
.wgf-cta-btn:hover { background:#e55f00; }

/* WGF scroll animations */
@keyframes wgfDotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.wgf-eyebrow::before { animation: wgfDotPulse 2s ease-in-out infinite; }
[data-wgf] { opacity:0; will-change:opacity,transform; }
[data-wgf="badge"] { transform:translateY(20px); }
[data-wgf="quote"], [data-wgf="headline"], [data-wgf="body1"], [data-wgf="body2"], [data-wgf="sig"] { transform:translateY(24px); }
[data-wgf="divider"] { transform:scaleX(0.3); }
.wgf-photo-wrap.on .wgf-accent { opacity:1; }
.wgf-accent { position:absolute; left:0; top:0; bottom:0; width:3px; background:#ff6000; border-radius:2px; opacity:0; transition:opacity .5s ease .5s; z-index:2; }
.wgf-photo-wrap { transition: transform .3s ease, box-shadow .3s ease; }
.wgf-photo-wrap:hover { transform:translateY(-5px) scale(1.01); box-shadow:0 24px 48px rgba(0,0,0,.4); }
.wgf-team-card { transition: transform .28s ease, box-shadow .28s ease; }
.wgf-team-card:hover { transform:translateY(-4px) scale(1.02); box-shadow:0 20px 40px rgba(0,0,0,.5); }

/* TICKER */
.stream-ticker { max-width:1160px; margin:0 auto; padding:0 52px; border-top:1px solid var(--line); }
.stream-ticker-inner { display:flex; align-items:stretch; overflow:hidden; height:46px; }
.st-label { font-family:'Geist Mono',monospace; font-size:10px; color:var(--orange); letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; display:flex; align-items:center; gap:8px; padding-right:24px; border-right:1px solid var(--line); margin-right:24px; flex-shrink:0; }
.st-feed { overflow:hidden; flex:1; display:flex; align-items:center; }
.st-list { display:flex; align-items:center; }
.st-item { display:flex; align-items:center; gap:10px; padding:0 24px; border-right:1px solid var(--line); white-space:nowrap; flex-shrink:0; animation:slideL .4s ease forwards; opacity:0; }
@keyframes slideL { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
.st-logo { width:16px; height:16px; border-radius:3px; object-fit:contain; background:#fafaf8; padding:1px; }
.st-logo-fb { width:16px; height:16px; border-radius:3px; background:var(--bg2); display:flex; align-items:center; justify-content:center; font-size:7px; font-weight:800; color:var(--orange); }
.st-co { font-size:12px; font-weight:600; }
.st-role { font-family:'Geist Mono',monospace; font-size:10px; color:var(--dim); }
.st-sal { font-family:'Geist Mono',monospace; font-size:13px; font-weight:500; }
.ldot { width:6px; height:6px; border-radius:50%; background:var(--green); box-shadow:0 0 0 0 rgba(74,222,128,.4); animation:lp 2s infinite; }
@keyframes lp { 0%{box-shadow:0 0 0 0 rgba(74,222,128,.4)} 70%{box-shadow:0 0 0 6px rgba(74,222,128,0)} 100%{box-shadow:0 0 0 0 rgba(74,222,128,0)} }

/* INLINE GATE */
.inline-gate { max-width:1160px; margin:0 auto; padding:0 52px; }
.inline-gate-inner { background:var(--bg1); border:1px solid rgba(255,96,0,.2); border-radius:10px; padding:28px 32px; display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
.ig-left { flex:1; min-width:180px; }
.ig-title { font-size:16px; font-weight:700; margin-bottom:4px; }
.ig-sub { font-size:12px; color:var(--mid); font-weight:300; }
.ig-form { display:flex; gap:8px; align-items:flex-end; flex:2; flex-wrap:wrap; }
.ig-fg { display:flex; flex-direction:column; gap:4px; }
.ig-fg label { font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:1px; }
.ig-sel, .ig-inp { background:var(--bg2); border:1px solid var(--line); color:var(--white); font-family:'Barlow',sans-serif; font-size:13px; padding:9px 12px; border-radius:3px; outline:none; appearance:none; transition:border-color .2s; min-width:110px; }
.ig-sel:focus, .ig-inp:focus { border-color:var(--orange); }
.ig-inp { min-width:90px; }
.ig-btn { background:var(--orange); color:#fff; border:none; font-family:'Barlow',sans-serif; font-size:13px; font-weight:700; padding:10px 20px; border-radius:3px; cursor:pointer; white-space:nowrap; align-self:flex-end; }

/* SUBMIT */
.submit-outer { margin:64px 52px 0; border-radius:10px; overflow:hidden; }
.submit-inner { padding:64px 64px 56px; color:var(--bg); }
.submit-h { font-size:clamp(28px,3.5vw,48px); font-weight:800; letter-spacing:-1.5px; line-height:1.1; margin-bottom:12px; }
.submit-h em { font-style:normal; color:var(--orange); }
.submit-sub { font-size:14px; color:rgba(12,12,11,.55); font-weight:300; margin-bottom:36px; line-height:1.7; max-width:480px; }
.trust-line { display:flex; gap:24px; margin-bottom:32px; flex-wrap:wrap; }
.tl { font-family:'Geist Mono',monospace; font-size:11px; color:rgba(12,12,11,.5); display:flex; align-items:center; gap:5px; }
.tl::before { content:'\\2713'; color:var(--orange); font-weight:700; }
.form-line { display:grid; grid-template-columns:1fr 1fr 1.3fr; gap:20px; margin-bottom:24px; }
.fg label { display:block; font-size:10px; font-weight:600; color:rgba(12,12,11,.5); margin-bottom:6px; text-transform:uppercase; letter-spacing:1px; }
.fg select, .fg input { width:100%; background:transparent; border:none; border-bottom:1.5px solid rgba(12,12,11,.14); color:var(--bg); font-family:'Barlow',sans-serif; font-size:14px; padding:10px 0; border-radius:0; outline:none; appearance:none; transition:border-color .2s; }
.fg select:focus, .fg input:focus { border-bottom-color:var(--orange); }
.fg select option { background:#f2f0eb; }
.btn-sub { background:var(--orange); color:#fff; border:none; font-family:'Barlow',sans-serif; font-size:14px; font-weight:700; padding:14px 32px; border-radius:2px; cursor:pointer; }
.otw-wrap { margin-bottom:24px; }
.otw-check { display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
.otw-check input[type=checkbox] { width:16px; height:16px; accent-color:var(--orange); cursor:pointer; flex-shrink:0; }
.otw-check-label { font-size:13px; color:rgba(12,12,11,.65); font-weight:500; }
.otw-email { display:none; margin-top:12px; padding-left:26px; }
.otw-email.on { display:block; }
.otw-email input { width:100%; background:transparent; border:none; border-bottom:1.5px solid rgba(12,12,11,.14); color:var(--bg); font-family:'Barlow',sans-serif; font-size:14px; padding:10px 0; outline:none; transition:border-color .2s; }
.otw-email input:focus { border-bottom-color:var(--orange); }
.otw-email input::placeholder { color:rgba(12,12,11,.55); }
.otw-trust { margin-top:6px; font-size:10px; color:rgba(12,12,11,.5); font-family:'Geist Mono',monospace; }

/* AUTOCOMPLETE */
.ac-wrap { position:relative; }
.ac-input {
  width:100%; background:transparent; border:none;
  border-bottom:1.5px solid rgba(12,12,11,.14);
  color:var(--bg); font-family:'Barlow',sans-serif; font-size:14px;
  padding:10px 0; border-radius:0; outline:none; transition:border-color .2s;
}
.ac-input:focus { border-bottom-color:var(--orange); }
.ac-input::placeholder { color:rgba(12,12,11,.55); }
.ac-dropdown {
  display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:50;
  background:#fafaf8; border:1px solid rgba(12,12,11,.1);
  border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,.12);
  max-height:200px; overflow-y:auto;
}
.ac-dropdown.open { display:block; }
.ac-item {
  padding:10px 14px; font-size:13px; color:var(--bg);
  cursor:pointer; display:flex; align-items:center; gap:10px;
  transition:background .1s;
}
.ac-item:hover, .ac-item.focused { background:rgba(255,96,0,.06); }
.ac-item-logo { width:22px; height:22px; border-radius:4px; object-fit:contain; background:#f5f5f5; padding:1px; flex-shrink:0; }
.ac-item-logo-fb { width:22px; height:22px; border-radius:4px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; color:var(--orange); flex-shrink:0; }
.ac-item-name { font-weight:600; font-size:13px; }
.ac-item-type { font-size:11px; color:#999; margin-left:auto; }
.result-block { display:none; margin-top:28px; padding-top:28px; border-top:1px solid rgba(12,12,11,.1); align-items:center; gap:28px; flex-wrap:wrap; }
.result-block.on { display:flex; animation:fadeUp .35s ease; }
@keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes kenBurns1 { from{transform:scale(1) translate(0,0)} to{transform:scale(1.08) translate(-1%,-.5%)} }
@keyframes kenBurns2 { from{transform:scale(1) translate(0,0)} to{transform:scale(1.08) translate(1%,-.5%)} }
@keyframes kenBurns3 { from{transform:scale(1) translate(0,0)} to{transform:scale(1.08) translate(0,1%)} }
.city-card { transition: transform .4s ease, outline .2s ease; }
.rb-ctx { font-family:'Geist Mono',monospace; font-size:10px; color:rgba(12,12,11,.5); margin-bottom:6px; letter-spacing:1px; text-transform:uppercase; }
.rb-pct { font-family:'Geist Mono',monospace; font-size:40px; font-weight:500; color:var(--bg); line-height:1; }
.rb-sep { width:1px; height:48px; background:rgba(12,12,11,.1); }
.rb-bwrap { flex:1; min-width:200px; }
.rb-bl { display:flex; justify-content:space-between; font-size:10px; color:rgba(12,12,11,.5); margin-bottom:8px; font-family:'Geist Mono',monospace; }
.rb-track { height:2px; background:rgba(12,12,11,.08); border-radius:1px; }
.rb-fill { height:100%; background:var(--orange); border-radius:1px; transition:width .9s ease; }
.uline { display:none; margin-top:18px; font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); }
.uline.on { display:block; }
#full-feed { display:none; max-width:1160px; margin:0 auto; padding:64px 52px 80px; }
#full-feed.on { display:block; animation:fadeUp .4s ease; }
.ff-head { display:flex; align-items:baseline; justify-content:space-between; padding-bottom:20px; border-bottom:1px solid var(--line); margin-bottom:32px; }
.ff-title { font-size:11px; font-weight:600; color:var(--mid); text-transform:uppercase; letter-spacing:.8px; }
.ff-badge { font-family:'Geist Mono',monospace; font-size:9px; font-weight:700; color:#fff; background:var(--orange); padding:2px 8px; border-radius:1px; margin-left:10px; }
.ff-meta { font-family:'Geist Mono',monospace; font-size:10px; color:var(--dim); }

/* ── COMPANY SEARCH ── */
.co-search-wrap { margin-bottom:28px; position:relative; }
.co-search-bar { display:flex; align-items:center; gap:10px; border-bottom:1.5px solid #ddd; border-radius:0; padding:12px 4px; background:transparent; margin-bottom:20px; transition:border-color .2s; }
.co-search-bar:focus-within { border-color:#ff6000; }
.co-search-icon { font-size:14px; opacity:.3; flex-shrink:0; }
.co-search-input { flex:1; background:transparent; border:none; outline:none; color:#111; font-family:'Barlow',sans-serif; font-size:15px; }
.co-search-input::placeholder { color:#bbb; }
.co-search-drop { display:none; position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:100; background:var(--bg1); border:1px solid var(--line); border-radius:8px; box-shadow:0 12px 32px rgba(0,0,0,.5); max-height:260px; overflow-y:auto; }
.co-search-drop.open { display:block; }
.co-drop-item { padding:11px 18px; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:background .1s; }
.co-drop-item:hover { background:rgba(255,255,255,.05); }
.co-drop-item-name { font-weight:500; }
.co-drop-item-badge { font-family:'Geist Mono',monospace; font-size:10px; color:var(--orange); background:rgba(255,96,0,.1); padding:2px 7px; border-radius:2px; }
.co-drop-item-badge.no-data { color:var(--dim); background:transparent; }

/* Search result panel */
.co-result-panel { display:none; background:var(--bg1); border:1px solid var(--line); border-radius:10px; padding:28px; margin-bottom:48px; animation:fadeUp .25s ease; }
.co-result-panel.on { display:block; }
.co-result-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
.co-result-name { font-size:20px; font-weight:800; letter-spacing:-.5px; }
.co-result-count { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); margin-top:4px; }
.co-result-close { background:transparent; border:1px solid var(--line); color:var(--dim); font-size:12px; padding:5px 12px; border-radius:4px; cursor:pointer; font-family:'Barlow',sans-serif; flex-shrink:0; }
.co-result-close:hover { color:var(--white); border-color:rgba(255,255,255,.2); }

/* Salary by role table */
.co-role-table { width:100%; border-collapse:collapse; }
.co-role-table th { font-family:'Geist Mono',monospace; font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:.8px; padding:0 0 10px; text-align:left; border-bottom:1px solid var(--line); }
.co-role-table th:not(:first-child) { text-align:right; }
.co-role-table td { padding:12px 0; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
.co-role-table td:not(:first-child) { text-align:right; font-family:'Geist Mono',monospace; }
.co-role-name { font-size:13px; font-weight:600; }
.co-role-median { font-size:16px; font-weight:600; color:var(--white); }
.co-role-range { font-size:11px; color:var(--dim); }
.co-role-count { font-size:11px; color:var(--dim); }
.co-role-bar-wrap { width:80px; height:4px; background:rgba(255,255,255,.08); border-radius:2px; margin-left:auto; margin-right:0; }
.co-role-bar { height:100%; background:var(--orange); border-radius:2px; }

/* No data */
.co-no-data { text-align:center; padding:20px 0 8px; }
.co-no-data-title { font-size:15px; font-weight:700; margin-bottom:6px; }
.co-no-data-sub { font-size:13px; color:var(--mid); margin-bottom:20px; }
.co-similar-label { font-family:'Geist Mono',monospace; font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:.8px; margin-bottom:12px; text-align:left; }
.co-similar-grid { display:flex; flex-wrap:wrap; gap:8px; }
.co-similar-chip { padding:7px 14px; border:1px solid var(--line); border-radius:20px; font-size:12px; font-weight:500; cursor:pointer; transition:all .15s; color:var(--mid); }
.co-similar-chip:hover { border-color:var(--orange); color:var(--orange); }

/* Card hover panel */
#typed-company { color:var(--orange); }
.typed-cursor {
  display:inline-block;
  width:3px;
  height:0.82em;
  background:var(--orange);
  margin-left:3px;
  vertical-align:middle;
  animation:blink .7s step-end infinite;
}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

.chp { position:absolute; inset:0; background:rgba(12,12,11,.92); border:2px solid #ff6000; border-radius:12px; opacity:0; transition:opacity .2s ease; z-index:20; padding:16px; display:flex; flex-direction:column; }
.chp-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.chp-label { font-family:'Geist Mono',monospace; font-size:10px; color:rgba(242,240,235,.6); width:108px; flex-shrink:0; }
.chp-bar-wrap { flex:1; height:4px; background:rgba(255,255,255,.08); border-radius:2px; overflow:hidden; }
.chp-bar { height:100%; background:#ff6000; border-radius:2px; }
.chp-val { font-family:'Geist Mono',monospace; font-size:10px; color:var(--white); width:32px; text-align:right; }

/* Leaderboard panel */
.lb-gate { background:white; border-radius:20px; overflow:hidden; box-shadow:0 4px 40px rgba(0,0,0,.1); margin-top:12px; }
.lb-head-strip { height:4px; background:linear-gradient(to right,#ff6000,#FFB870); }
.lb-head-body { padding:20px 24px; display:flex; align-items:stretch; border-bottom:1px solid #f5f3ee; }
.lb-head-left { flex:1; padding-right:20px; border-right:1px solid #f0ede6; }
.lb-head-eyebrow { font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:#ccc; margin-bottom:7px; }
.lb-head-name { font-size:21px; font-weight:900; letter-spacing:-.03em; color:#111; margin-bottom:3px; }
.lb-head-name em { color:#ff6000; font-style:normal; }
.lb-head-meta { font-size:12px; color:#bbb; }
.lb-head-badge { display:inline-block; margin-top:10px; font-size:11px; font-weight:700; color:#ff6000; border:1.5px solid rgba(255,98,0,.3); padding:4px 12px; border-radius:7px; background:rgba(255,98,0,.04); }
.lb-head-right { padding-left:20px; display:flex; flex-direction:column; justify-content:space-around; flex-shrink:0; gap:8px; }
.lb-stat-b { text-align:right; }
.lb-stat-n { font-size:20px; font-weight:900; letter-spacing:-.02em; line-height:1; color:#111; }
.lb-stat-n.o { color:#ff6000; }
.lb-stat-n.g { color:#16a34a; }
.lb-stat-l { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#ccc; margin-top:2px; }
.lb-tabs { display:flex; padding:0 24px; border-bottom:1.5px solid #f5f3ee; overflow-x:auto; scrollbar-width:none; }
.lb-tabs::-webkit-scrollbar { display:none; }
.lb-tab { font-size:12px; font-weight:600; color:#ccc; padding:11px 13px 9px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1.5px; white-space:nowrap; transition:all .18s; flex-shrink:0; }
.lb-tab:hover { color:#888; }
.lb-tab.active { color:#ff6000; border-color:#ff6000; }
.lb-top3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1px; background:#f5f3ee; border-bottom:1px solid #f0ede6; }
.lb-top-card { background:white; padding:18px 16px; position:relative; overflow:hidden; transition:background .15s; }
.lb-top-card:hover { background:#fdfaf7; }
.lb-tc-bg { position:absolute; top:-8px; right:8px; font-size:64px; font-weight:900; color:#f5f3ee; line-height:1; pointer-events:none; letter-spacing:-.04em; }
.lb-tc-bg.r1 { color:#fff3ec; }
.lb-tc-inner { position:relative; z-index:1; }
.lb-tc-rank { font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#ccc; margin-bottom:10px; }
.lb-tc-rank.r1 { color:#ff6000; }
.lb-tc-title { font-size:13px; font-weight:700; color:#111; margin-bottom:3px; line-height:1.3; }
.lb-tc-sub { font-size:11px; color:#bbb; margin-bottom:14px; }
.lb-tc-salary { font-size:22px; font-weight:900; color:#111; letter-spacing:-.03em; line-height:1; margin-bottom:4px; }
.lb-tc-bar-wrap { height:2px; background:#f0ede6; border-radius:100px; overflow:hidden; margin-bottom:5px; }
.lb-tc-bar { height:100%; border-radius:100px; background:#ff6000; }
.lb-tc-vs { font-size:11px; font-weight:700; }
.lb-tc-vs.up { color:#16a34a; }
.lb-tc-vs.dn { color:#ff6000; }
.lb-list-section { border-top:1px solid #f5f3ee; }
.lb-list-header { padding:14px 24px 10px; font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:#ccc; }
.lb-list-row { display:flex; align-items:center; gap:14px; padding:13px 24px; border-bottom:1px solid #f8f6f2; transition:background .15s; }
.lb-list-row:hover { background:#fdfaf7; }
.lb-av { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; background:#fff3ec; color:#ff6000; border:1.5px solid rgba(255,98,0,.15); }
.lb-av.locked { background:#f5f3ee; color:#ddd; border-color:#f0ede6; }
.lb-row-info { flex:1; }
.lb-row-title { font-size:13px; font-weight:700; color:#111; }
.lb-row-title.blurred { filter:blur(5px); user-select:none; color:#ccc; }
.lb-row-sub { font-size:11px; color:#bbb; margin-top:1px; }
.lb-row-sub.blurred { filter:blur(3px); color:#ddd; }
.lb-row-right { text-align:right; flex-shrink:0; }
.lb-row-sal { font-size:15px; font-weight:800; color:#111; letter-spacing:-.02em; }
.lb-row-sal.blurred { filter:blur(7px); user-select:none; color:#ccc; }
.lb-row-vs { font-size:10px; font-weight:700; margin-top:2px; }
.lb-row-vs.up { color:#16a34a; }
.lb-row-vs.dn { color:#ff6000; }
.lb-row-vs.blurred { filter:blur(4px); color:#ddd; }
.lb-cta-fade { height:56px; background:linear-gradient(to bottom,rgba(255,255,255,0),white); pointer-events:none; margin-bottom:-2px; }
.lb-cta-area { padding:0 24px 24px; }
.lb-cta-sep { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.lb-cta-line { flex:1; height:1px; background:#f0ede6; }
.lb-cta-sep-text { font-size:10px; color:#ccc; white-space:nowrap; }
.lb-cta-sep-text b { color:#aaa; }
.lb-cta-btn { width:100%; background:#ff6000; color:#000; font-size:14px; font-weight:800; padding:15px; border-radius:12px; text-align:center; cursor:pointer; border:none; display:block; transition:transform .15s,opacity .15s; }
.lb-cta-btn:hover { opacity:.9; transform:translateY(-1px); }
.lb-cta-sub { text-align:center; font-size:11px; color:#bbb; margin-top:8px; }

/* ── MOBILE RESPONSIVE ── */

/* FYI SUBMIT SECTION */
.fyi-submit-section {
  background: #0c0c0b;
  padding: 100px 52px 120px;
  font-family: 'Barlow', sans-serif;
  scroll-margin-top: 64px;
}
.fyi-submit-inner { max-width: 1100px; margin: 0 auto; }
.fyi-submit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: stretch;
  max-width: 1060px;
  margin: 0 auto;
}
.fyi-submit-grid.fyi-submit-done {
  grid-template-columns: 1fr;
  gap: 0;
  max-width: 1200px;
}
.fyi-submit-left h2 {
  font-size: clamp(36px,4.5vw,58px);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -1.5px;
  line-height: 0.95;
  color: #0c0c0c;
  margin-bottom: 18px;
  font-family: 'Barlow', sans-serif;
}
.fyi-submit-left h2 .hl { color: #f26522; }
.fyi-submit-left p { font-size: 15px; color: rgba(0,0,0,.5); line-height: 1.65; margin-bottom: 28px; }
.fyi-sub-badges { display: flex; flex-direction: column; gap: 10px; }
.fyi-sb-badge {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: rgba(0,0,0,.5); font-weight: 600;
}
.fyi-sb-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #f26522; flex-shrink: 0; }
.fyi-step-form {
  background: #0c0c0c;
  border-radius: 10px;
  padding: 36px;
  position: relative;
  overflow: hidden;
}
.fyi-step-form::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #f26522, #f5a03a);
}
.fyi-step-progress { display: flex; gap: 4px; margin-bottom: 30px; }
.fyi-sp-dot {
  flex: 1; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,.1); transition: background .25s;
}
.fyi-sp-dot.done   { background: #f26522; }
.fyi-sp-dot.active { background: #ffffff; }
.fyi-step-content { display: none; }
.fyi-step-content.active { display: block; }
.fyi-step-question {
  font-size: 22px; font-weight: 800; text-transform: uppercase;
  letter-spacing: -0.5px; margin-bottom: 6px; line-height: 1.1;
  color: #ffffff; font-family: 'Barlow', sans-serif;
}
.fyi-step-sub { font-size: 13px; color: rgba(255,255,255,.45); margin-bottom: 24px; }
.fyi-option-grid { display: grid; gap: 7px; margin-bottom: 24px; }
.fyi-option-grid.cols-2 { grid-template-columns: 1fr 1fr; }
.fyi-option-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.fyi-opt-btn {
  background: rgba(255,255,255,.04);
  border: 1.5px solid rgba(255,255,255,.08);
  border-radius: 7px; padding: 11px 13px;
  color: #ffffff; font-size: 12px; font-weight: 700;
  font-family: 'Barlow', sans-serif; cursor: pointer;
  text-align: left; text-transform: uppercase; letter-spacing: 0.3px;
  transition: all .12s; line-height: 1.3; width: 100%;
}
.fyi-opt-btn:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.15); }
.fyi-opt-btn.selected { background: rgba(242,101,34,.12); border-color: #f26522; }
.fyi-ob-icon  { font-size: 16px; margin-bottom: 4px; display: block; }
.fyi-ob-label { font-weight: 800; display: block; }
.fyi-ob-sub   { font-size: 10px; color: rgba(255,255,255,.45); display: block; margin-top: 2px; font-weight: 400; text-transform: none; }
.fyi-salary-slider-wrap { margin-bottom: 28px; }
.fyi-ss-display { display: flex; align-items: baseline; gap: 8px; margin-bottom: 18px; }
.fyi-ss-num { font-family: 'Geist Mono', monospace; font-size: 52px; color: #f26522; font-weight: 500; line-height: 1; }
.fyi-ss-unit { font-size: 15px; color: rgba(255,255,255,.45); }
.fyi-salary-slider {
  width: 100%; -webkit-appearance: none;
  height: 3px; border-radius: 2px; outline: none;
  background: linear-gradient(90deg, #f26522 var(--pct,13%), rgba(255,255,255,.1) var(--pct,13%));
}
.fyi-salary-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px; height: 20px; border-radius: 50%;
  background: #ffffff; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.5);
}
.fyi-ss-ticks { display: flex; justify-content: space-between; margin-top: 8px; }
.fyi-ss-tick  { font-size: 10px; color: rgba(255,255,255,.45); font-family: 'Geist Mono', monospace; }
.fyi-form-input {
  width: 100%; background: rgba(255,255,255,.05);
  border: 1.5px solid rgba(255,255,255,.1);
  border-radius: 7px; padding: 13px 16px;
  color: #ffffff; font-size: 14px;
  font-family: 'Barlow', sans-serif; outline: none;
  transition: border-color .15s; margin-bottom: 10px;
}
.fyi-form-input:focus { border-color: #f26522; }
.fyi-form-input::placeholder { color: rgba(255,255,255,.2); }
.fyi-voc-options { display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; }
.fyi-voc-opt {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.08);
  border-radius: 7px; padding: 12px 14px; cursor: pointer; transition: all .12s;
}
.fyi-voc-opt:hover { background: rgba(255,255,255,.07); }
.fyi-voc-opt.selected { background: rgba(242,101,34,.12); border-color: #f26522; }
.fyi-voc-checkbox {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .12s; font-size: 10px; font-weight: 700;
}
.fyi-voc-opt.selected .fyi-voc-checkbox { background: #f26522; border-color: #f26522; }
.fyi-voc-checkbox::after { content: '\\2713'; color: #ffffff; opacity: 0; }
.fyi-voc-opt.selected .fyi-voc-checkbox::after { opacity: 1; }
.fyi-voc-label { font-size: 13px; font-weight: 600; line-height: 1.4; color: #ffffff; }
.fyi-step-nav { display: flex; gap: 10px; align-items: center; }
.fyi-btn-primary {
  flex: 1; background: #f26522; color: #ffffff;
  border: none; border-radius: 7px; padding: 14px 22px;
  font-size: 13px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; font-family: 'Barlow', sans-serif;
  cursor: pointer; transition: opacity .15s;
}
.fyi-btn-primary:hover    { opacity: 0.85; }
.fyi-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
.fyi-btn-back {
  background: none; border: 1.5px solid rgba(255,255,255,.08);
  border-radius: 7px; padding: 14px 18px;
  color: rgba(255,255,255,.45); font-size: 13px;
  font-family: 'Barlow', sans-serif; font-weight: 700;
  cursor: pointer; transition: all .15s;
  text-transform: uppercase; letter-spacing: 0.3px;
}
.fyi-btn-back:hover { border-color: rgba(255,255,255,.2); color: #ffffff; }
.fyi-anon-note {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: rgba(255,255,255,.45); margin-top: 12px;
  justify-content: center; text-transform: uppercase;
  letter-spacing: 0.5px; font-weight: 600;
}
.fyi-anon-note::before { content: ''; display: inline-block; width: 13px; height: 13px; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 11V7a5 5 0 0 0-10 0v4'/%3E%3Crect x='5' y='11' width='14' height='11' rx='2'/%3E%3C/svg%3E") no-repeat center/contain; }
.fyi-submit-success { text-align: center; padding: 20px 0; display: none; }
.fyi-step-label { font-size:11px; font-weight:700; color:rgba(255,255,255,0.35); letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
.fyi-step-title { font-size:22px; font-weight:900; color:#fff; letter-spacing:-0.5px; margin-bottom:6px; }
.fyi-step-sub { font-size:13px; color:rgba(255,255,255,0.4); margin-bottom:24px; }
.fyi-ss-icon  { font-size: 52px; margin-bottom: 14px; }
.fyi-ss-title {
  font-size: 26px; font-weight: 900; text-transform: uppercase;
  letter-spacing: -0.5px; margin-bottom: 8px; color: #ffffff;
  font-family: 'Barlow', sans-serif;
}
.fyi-ss-sub { font-size: 14px; color: rgba(255,255,255,.45); line-height: 1.6; }
.fyi-ss-cta {
  display: block; margin-top: 22px; text-align: center;
  text-decoration: none; background: #f26522; color: #ffffff;
  border: none; border-radius: 7px; padding: 14px 22px;
  font-size: 13px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; font-family: 'Barlow', sans-serif;
  cursor: pointer; transition: opacity .15s;
}
.fyi-ss-cta:hover { opacity: 0.85; }
@media (max-width: 768px) {
  .fyi-submit-section { padding: 60px 20px 80px; overflow:hidden; }
  .wgf-director-row { grid-template-columns:1fr; gap:28px; }
  .wgf-headline { font-size:26px; }
  .wgf-team-grid { grid-template-columns:repeat(3,1fr); gap:10px; }
  .wgf-section { padding:60px 20px; }
  .fyi-submit-grid { grid-template-columns: 1fr; gap: 40px; }
  .lb-top3 { grid-template-columns: 1fr; }
  .wgf-team-grid { grid-template-columns: repeat(2, 1fr); }
  footer { padding:24px 16px; }
  /* NAV */
  nav { padding:0 12px; height:48px; }
  .logo { font-size:11px; gap:6px; }
  .logo img { width:22px !important; height:22px !important; }
  .nav-link { display:none; }
  .nav-jobs-cta { display:inline-flex !important; font-size:10px; padding:4px 10px; gap:4px; white-space:nowrap; }
  .nav-jobs-icon svg { width:12px; height:12px; }
  .nav-jobs-bubble { display:none; }
  .nav-r { gap:6px; flex-shrink:0; }
  .nav-btn { font-size:9px; padding:5px 8px; white-space:nowrap; }
  .nav-login-btn { font-size:10px; padding:4px 10px; white-space:nowrap; }

  /* HERO */
  .hero { padding-top:48px; }
  .hero-copy { padding:0 20px; max-width:100%; }
  .hero-h1 { font-size:clamp(28px,8vw,44px); letter-spacing:-1.5px; }
  .hero-sub { font-size:13px; margin-bottom:28px; }
  .hero-btns { flex-direction:column; gap:10px; }
  .btn-p, .btn-g { width:100%; text-align:center; padding:13px 20px; }
  .car-dots, .car-arrows { display:none; }

  /* TICKER */
  .stream-ticker { padding:0 16px; }
  .st-label { display:none; }
  .st-item { padding:0 12px; }

  /* CARDS SECTION */
  .cards-section { padding:40px 16px 0; }
  .stories-grid { grid-template-columns:1fr !important; }
  .trust-roadmap { grid-template-columns:1fr !important; }
  .trust-stats { grid-template-columns:repeat(2,1fr) !important; }
  .trust-interviews { grid-template-columns:1fr !important; }
  .city-cards-grid { grid-template-columns:1fr !important; }
  .trust-privacy { grid-template-columns:1fr !important; }
  .trust-section { padding:60px 0 !important; }
  .trust-inner { padding:0 16px !important; }
  .section-head-title { font-size:22px; }
  .company-grid { grid-template-columns:repeat(2,1fr); gap:10px; }
  .company-card { height:220px; }

  /* SUBMIT */
  .submit-outer { margin:40px 16px 0; }
  .submit-inner { padding:28px 20px 28px; }
  .form-line { grid-template-columns:1fr 1fr !important; gap:14px 16px !important; }
  .fg select, .fg input, .ac-input { font-size:16px; } /* prevent iOS zoom */
  .trust-line { gap:10px; }
  .tl { font-size:10px; }
  .btn-sub { width:100%; padding:14px; font-size:14px; }

  /* RESULT BLOCK */
  .result-block { flex-direction:column; align-items:flex-start; gap:14px; }
  .rb-sep { display:none; }
  .rb-bwrap { width:100%; }
  .rb-pct { font-size:32px; }

  /* FULL FEED */
  #full-feed { padding:36px 16px 60px; }
  .ff-head { flex-direction:column; gap:4px; align-items:flex-start; }

  /* COMPANY SEARCH */
  .co-result-panel { padding:16px; }
  .co-role-table th:nth-child(3),
  .co-role-table td:nth-child(3),
  .co-role-table th:nth-child(4),
  .co-role-table td:nth-child(4),
  .co-role-table th:nth-child(5),
  .co-role-table td:nth-child(5) { display:none; }
  .co-role-median { font-size:13px; }
}

@media (max-width: 480px) {
  .form-line { grid-template-columns:1fr !important; }
  .fyi-step-roles { grid-template-columns:1fr !important; }
  .card-grid { grid-template-columns:1fr; gap:12px; }
  .bcard-banner { height:110px; }
  .bcard-metrics { display:grid; }
  .bcard-quote { display:none; }
}

@media (max-width: 400px) {
  .hero-h1 { font-size:clamp(26px,9vw,36px); }
  .nav-r { gap:4px; }
  .nav-btn { font-size:8px; padding:4px 6px; }
  .nav-login-btn { font-size:9px; padding:3px 8px; }
  .nav-jobs-cta { font-size:9px; padding:3px 6px; }
  .nav-user-name { display:none; }
  .logo span { font-size:0; }
  .logo span span { font-size:10px; }
}
`;
