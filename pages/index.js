import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const css = `
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
.nav-link { font-size:13px; color:var(--mid); text-decoration:none; transition:color .15s; }
.nav-link:hover { color:var(--white); }
.nav-btn { font-family:'Barlow',sans-serif; font-size:12px; font-weight:600; background:var(--orange); color:#fff; border:none; padding:8px 18px; border-radius:2px; cursor:pointer; }

/* HERO */
.hero { position:relative; height:100vh; overflow:hidden; padding-top:56px; background:#0c0c0b; }
.hero-copy { position:absolute; inset:0; z-index:10; display:flex; flex-direction:column; justify-content:center; padding:80px 52px 80px 96px; max-width:700px; }
.hero-kicker { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:32px; display:flex; align-items:center; gap:10px; }
.kdot { width:5px; height:5px; border-radius:50%; background:var(--orange); box-shadow:0 0 8px var(--orange); animation:glow 2s ease-in-out infinite; }
@keyframes glow { 0%,100%{box-shadow:0 0 6px var(--orange)} 50%{box-shadow:0 0 20px var(--orange)} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
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
.live-msg .co { color: #FF6200; font-weight: 700; }
.live-msg .dim { color: rgba(255,255,255,.3); font-size: 12px; }
.car-dots { position:absolute; right:52px; bottom:88px; z-index:10; display:flex; gap:6px; }
.cdot { width:5px; height:5px; border-radius:50%; background:rgba(255,255,255,.28); cursor:pointer; transition:all .3s; }
.cdot.on { background:var(--orange); width:16px; border-radius:3px; }
.car-arrows { position:absolute; right:52px; top:50%; transform:translateY(-50%); z-index:10; display:flex; flex-direction:column; gap:8px; }
.carr { width:36px; height:36px; border-radius:2px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); color:var(--white); font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.carr:hover { background:rgba(255,255,255,.16); }

/* CARDS SECTION */
.cards-bg { background: #f0ede8; }
.cards-section { max-width:1160px; margin:0 auto; padding:80px 52px 0; }
.cards-bg .section-head-title { color: #0c0c0c; }
.cards-bg .section-head-sub { color: rgba(0,0,0,.5); }
.section-head { margin-bottom:28px; }
.section-head-title { font-size:clamp(22px,2.8vw,32px); font-weight:800; letter-spacing:-1px; margin-bottom:6px; }
.section-head-title em { font-style:normal; color:var(--orange); }
.section-head-sub { font-size:13px; color:var(--mid); font-weight:300; }

/* COMPANY GRID */
.company-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.company-card { border-radius:14px; overflow:hidden; position:relative; height:280px; cursor:pointer; outline:2px solid transparent; outline-offset:-2px; transition:transform .2s, outline-color .2s; }
.company-card:hover { transform:scale(1.02); }
.company-card.open:hover { outline-color:#FF6200; }
.card-bg { position:absolute; inset:0; }
.card-logo-wrap { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:1; }
.card-logo-img { width:72px; height:72px; object-fit:contain; border-radius:14px; opacity:0.95; background:rgba(255,255,255,0.92); padding:10px; box-shadow:0 2px 16px rgba(0,0,0,0.25); }
.card-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 60%); }
.company-card.locked .card-overlay { background:rgba(0,0,0,.72); backdrop-filter:blur(3px); }
.card-top { position:absolute; top:14px; left:14px; right:14px; display:flex; justify-content:space-between; align-items:center; z-index:2; }
.card-rank { font-size:10px; font-weight:700; color:rgba(255,255,255,.55); background:rgba(0,0,0,.4); padding:3px 8px; border-radius:5px; }
.card-top-badge { font-size:10px; font-weight:700; color:#000; background:#FF6200; padding:3px 8px; border-radius:5px; }
.card-bottom { position:absolute; bottom:0; left:0; right:0; padding:16px; z-index:2; }
.card-name { font-size:15px; font-weight:700; color:#fff; margin-bottom:2px; letter-spacing:-.02em; }
.card-divider { height:1px; background:rgba(255,255,255,.15); margin:10px 0; }
.card-sal { font-size:13px; font-weight:700; color:#FF6200; margin-bottom:4px; }
.card-count { font-size:11px; color:rgba(255,255,255,.35); }
.card-lock-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; z-index:2; }
.card-lock-icon { font-size:22px; }
.card-lock-name { font-size:13px; font-weight:700; color:rgba(255,255,255,.55); }
.card-lock-count { font-size:11px; color:rgba(255,255,255,.3); }
.lock-cta { position:absolute; bottom:14px; left:14px; right:14px; background:#FF6200; color:black; font-size:11px; font-weight:700; padding:8px; border-radius:8px; text-align:center; opacity:0; transition:opacity .2s; z-index:3; }
.company-card.locked:hover .lock-cta { opacity:1; }
.body-unlocked .company-card.locked .card-overlay { background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 60%) !important; backdrop-filter:none !important; }
.body-unlocked .company-card.locked .card-lock-center { opacity:0; transform:scale(0.75); transition:opacity .5s ease, transform .5s ease; pointer-events:none; }
.body-unlocked .company-card.locked .lock-cta { display:none; }
.body-unlocked .company-card.locked:hover { outline-color:#FF6200; }

/* TICKER */
.stream-ticker { max-width:1160px; margin:0 auto; padding:0 52px; border-top:1px solid var(--line); }
.stream-ticker-inner { display:flex; align-items:stretch; overflow:hidden; height:46px; }
.st-label { font-family:'Geist Mono',monospace; font-size:10px; color:var(--orange); letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; display:flex; align-items:center; gap:8px; padding-right:24px; border-right:1px solid var(--line); margin-right:24px; flex-shrink:0; }
.st-feed { overflow:hidden; flex:1; display:flex; align-items:center; }
.st-list { display:flex; align-items:center; }
.st-item { display:flex; align-items:center; gap:10px; padding:0 24px; border-right:1px solid var(--line); white-space:nowrap; flex-shrink:0; animation:slideL .4s ease forwards; opacity:0; }
@keyframes slideL { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
.st-logo { width:16px; height:16px; border-radius:3px; object-fit:contain; background:#fff; padding:1px; }
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
.submit-sub { font-size:14px; color:rgba(12,12,11,.45); font-weight:300; margin-bottom:36px; line-height:1.7; max-width:480px; }
.trust-line { display:flex; gap:24px; margin-bottom:32px; flex-wrap:wrap; }
.tl { font-family:'Geist Mono',monospace; font-size:11px; color:rgba(12,12,11,.38); display:flex; align-items:center; gap:5px; }
.tl::before { content:'✓'; color:var(--orange); font-weight:700; }
.form-line { display:grid; grid-template-columns:1fr 1fr 1.3fr; gap:20px; margin-bottom:24px; }
.fg label { display:block; font-size:10px; font-weight:600; color:rgba(12,12,11,.35); margin-bottom:6px; text-transform:uppercase; letter-spacing:1px; }
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
.otw-email input::placeholder { color:rgba(12,12,11,.3); }
.otw-trust { margin-top:6px; font-size:10px; color:rgba(12,12,11,.35); font-family:'Geist Mono',monospace; }

/* AUTOCOMPLETE */
.ac-wrap { position:relative; }
.ac-input {
  width:100%; background:transparent; border:none;
  border-bottom:1.5px solid rgba(12,12,11,.14);
  color:var(--bg); font-family:'Barlow',sans-serif; font-size:14px;
  padding:10px 0; border-radius:0; outline:none; transition:border-color .2s;
}
.ac-input:focus { border-bottom-color:var(--orange); }
.ac-input::placeholder { color:rgba(12,12,11,.3); }
.ac-dropdown {
  display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:50;
  background:#fff; border:1px solid rgba(12,12,11,.1);
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
.rb-ctx { font-family:'Geist Mono',monospace; font-size:10px; color:rgba(12,12,11,.38); margin-bottom:6px; letter-spacing:1px; text-transform:uppercase; }
.rb-pct { font-family:'Geist Mono',monospace; font-size:40px; font-weight:500; color:var(--bg); line-height:1; }
.rb-sep { width:1px; height:48px; background:rgba(12,12,11,.1); }
.rb-bwrap { flex:1; min-width:200px; }
.rb-bl { display:flex; justify-content:space-between; font-size:10px; color:rgba(12,12,11,.38); margin-bottom:8px; font-family:'Geist Mono',monospace; }
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
.co-search-bar:focus-within { border-color:#FF6200; }
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
.co-result-panel { display:none; background:var(--bg1); border:1px solid var(--line); border-radius:10px; padding:28px; margin-bottom:32px; animation:fadeUp .25s ease; }
.co-result-panel.on { display:block; }
.co-result-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
.co-result-name { font-size:20px; font-weight:800; letter-spacing:-.5px; }
.co-result-count { font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); margin-top:4px; }
.co-result-close { background:transparent; border:1px solid var(--line); color:var(--dim); font-size:12px; padding:5px 12px; border-radius:4px; cursor:pointer; font-family:'Barlow',sans-serif; flex-shrink:0; }
.co-result-close:hover { color:var(--white); border-color:rgba(255,255,255,.2); }

/* 역할별 연봉 테이블 */
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

/* 데이터 없음 */
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
.lb-head-strip { height:4px; background:linear-gradient(to right,#FF6200,#FFB870); }
.lb-head-body { padding:20px 24px; display:flex; align-items:stretch; border-bottom:1px solid #f5f3ee; }
.lb-head-left { flex:1; padding-right:20px; border-right:1px solid #f0ede6; }
.lb-head-eyebrow { font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:#ccc; margin-bottom:7px; }
.lb-head-name { font-size:21px; font-weight:900; letter-spacing:-.03em; color:#111; margin-bottom:3px; }
.lb-head-name em { color:#FF6200; font-style:normal; }
.lb-head-meta { font-size:12px; color:#bbb; }
.lb-head-badge { display:inline-block; margin-top:10px; font-size:11px; font-weight:700; color:#FF6200; border:1.5px solid rgba(255,98,0,.3); padding:4px 12px; border-radius:7px; background:rgba(255,98,0,.04); }
.lb-head-right { padding-left:20px; display:flex; flex-direction:column; justify-content:space-around; flex-shrink:0; gap:8px; }
.lb-stat-b { text-align:right; }
.lb-stat-n { font-size:20px; font-weight:900; letter-spacing:-.02em; line-height:1; color:#111; }
.lb-stat-n.o { color:#FF6200; }
.lb-stat-n.g { color:#16a34a; }
.lb-stat-l { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#ccc; margin-top:2px; }
.lb-tabs { display:flex; padding:0 24px; border-bottom:1.5px solid #f5f3ee; overflow-x:auto; scrollbar-width:none; }
.lb-tabs::-webkit-scrollbar { display:none; }
.lb-tab { font-size:12px; font-weight:600; color:#ccc; padding:11px 13px 9px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1.5px; white-space:nowrap; transition:all .18s; flex-shrink:0; }
.lb-tab:hover { color:#888; }
.lb-tab.active { color:#FF6200; border-color:#FF6200; }
.lb-top3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1px; background:#f5f3ee; border-bottom:1px solid #f0ede6; }
.lb-top-card { background:white; padding:18px 16px; position:relative; overflow:hidden; transition:background .15s; }
.lb-top-card:hover { background:#fdfaf7; }
.lb-tc-bg { position:absolute; top:-8px; right:8px; font-size:64px; font-weight:900; color:#f5f3ee; line-height:1; pointer-events:none; letter-spacing:-.04em; }
.lb-tc-bg.r1 { color:#fff3ec; }
.lb-tc-inner { position:relative; z-index:1; }
.lb-tc-rank { font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#ccc; margin-bottom:10px; }
.lb-tc-rank.r1 { color:#FF6200; }
.lb-tc-title { font-size:13px; font-weight:700; color:#111; margin-bottom:3px; line-height:1.3; }
.lb-tc-sub { font-size:11px; color:#bbb; margin-bottom:14px; }
.lb-tc-salary { font-size:22px; font-weight:900; color:#111; letter-spacing:-.03em; line-height:1; margin-bottom:4px; }
.lb-tc-bar-wrap { height:2px; background:#f0ede6; border-radius:100px; overflow:hidden; margin-bottom:5px; }
.lb-tc-bar { height:100%; border-radius:100px; background:#FF6200; }
.lb-tc-vs { font-size:11px; font-weight:700; }
.lb-tc-vs.up { color:#16a34a; }
.lb-tc-vs.dn { color:#FF6200; }
.lb-list-section { border-top:1px solid #f5f3ee; }
.lb-list-header { padding:14px 24px 10px; font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:#ccc; }
.lb-list-row { display:flex; align-items:center; gap:14px; padding:13px 24px; border-bottom:1px solid #f8f6f2; transition:background .15s; }
.lb-list-row:hover { background:#fdfaf7; }
.lb-av { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; background:#fff3ec; color:#FF6200; border:1.5px solid rgba(255,98,0,.15); }
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
.lb-row-vs.dn { color:#FF6200; }
.lb-row-vs.blurred { filter:blur(4px); color:#ddd; }
.lb-cta-fade { height:56px; background:linear-gradient(to bottom,rgba(255,255,255,0),white); pointer-events:none; margin-bottom:-2px; }
.lb-cta-area { padding:0 24px 24px; }
.lb-cta-sep { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.lb-cta-line { flex:1; height:1px; background:#f0ede6; }
.lb-cta-sep-text { font-size:10px; color:#ccc; white-space:nowrap; }
.lb-cta-sep-text b { color:#aaa; }
.lb-cta-btn { width:100%; background:#FF6200; color:#000; font-size:14px; font-weight:800; padding:15px; border-radius:12px; text-align:center; cursor:pointer; border:none; display:block; transition:transform .15s,opacity .15s; }
.lb-cta-btn:hover { opacity:.9; transform:translateY(-1px); }
.lb-cta-sub { text-align:center; font-size:11px; color:#bbb; margin-top:8px; }

/* ── MOBILE RESPONSIVE ── */

/* FYI SUBMIT SECTION */
.fyi-submit-section {
  background: #f0ede8;
  padding: 80px 60px;
  font-family: 'Barlow', sans-serif;
}
.fyi-submit-inner { max-width: 1100px; margin: 0 auto; }
.fyi-submit-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 80px;
  align-items: start;
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
.fyi-voc-checkbox::after { content: '✓'; color: #ffffff; opacity: 0; }
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
.fyi-anon-note::before { content: '🔒'; font-size: 13px; }
.fyi-submit-success { text-align: center; padding: 20px 0; display: none; }
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
  .fyi-submit-section { padding: 60px 24px; }
  .fyi-submit-grid { grid-template-columns: 1fr; gap: 40px; }
  footer { padding:24px 16px; }
  /* NAV */
  nav { padding:0 16px; height:52px; }
  .nav-link { display:none; }
  .nav-btn { font-size:11px; padding:7px 14px; }

  /* HERO */
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
  .company-grid { grid-template-columns:repeat(2,1fr); }
  .company-card { height:200px; }

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

@media (max-width: 400px) {
  .card-grid { grid-template-columns:1fr; gap:12px; }
  .bcard-banner { height:110px; }
  .bcard-metrics { display:grid; }
  .bcard-quote { display:none; }
  .form-line { grid-template-columns:1fr !important; }
  .hero-h1 { font-size:clamp(26px,9vw,36px); }
}
`;


const _cardCompanies = [
  { name:'Grab Vietnam',    type:'Super App',   tier:'Foreign', city:'Ho Chi Minh City', domain:'grab.com',      color:'#00B14F',
    salMin:1200, salMax:4200, submissions:127, topPct:4, open:true, category:'Super App', median:2800, top10:4200,
    salaryByRole:[
      {role:'Mobile Engineer',   experience:'5–7 yrs', barPercent:100, salaryVND:82},
      {role:'Backend Engineer',  experience:'3–5 yrs', barPercent:84,  salaryVND:69},
      {role:'Data Engineer',     experience:'2–4 yrs', barPercent:72,  salaryVND:59},
      {role:'Frontend Engineer', experience:'3–5 yrs', barPercent:68,  salaryVND:56},
      {role:'DevOps / Cloud',    experience:'2–4 yrs', barPercent:60,  salaryVND:49},
    ]},
  { name:'VNG Corporation', type:'Product',     tier:'Local',   city:'Ho Chi Minh City', domain:'vng.com.vn',    color:'#0066CC',
    salMin:900, salMax:3200, submissions:94, topPct:9, open:true, category:'Product', median:1900, top10:3200,
    salaryByRole:[
      {role:'Backend Engineer',  experience:'3–5 yrs', barPercent:100, salaryVND:60},
      {role:'Mobile Engineer',   experience:'3–5 yrs', barPercent:88,  salaryVND:53},
      {role:'Data Engineer',     experience:'2–4 yrs', barPercent:75,  salaryVND:45},
      {role:'Frontend Engineer', experience:'2–4 yrs', barPercent:70,  salaryVND:42},
      {role:'DevOps / Cloud',    experience:'2–3 yrs', barPercent:62,  salaryVND:37},
    ]},
  { name:'Shopee Vietnam',  type:'E-commerce',  tier:'Foreign', city:'Ho Chi Minh City', domain:'shopee.vn',     color:'#EE4D2D',
    salMin:1100, salMax:3800, submissions:112, topPct:6, open:true, category:'E-commerce', median:2400, top10:3800,
    salaryByRole:[
      {role:'Backend Engineer',  experience:'3–5 yrs', barPercent:100, salaryVND:72},
      {role:'Data Engineer',     experience:'2–4 yrs', barPercent:85,  salaryVND:61},
      {role:'Mobile Engineer',   experience:'3–5 yrs', barPercent:80,  salaryVND:58},
      {role:'Frontend Engineer', experience:'2–4 yrs', barPercent:72,  salaryVND:52},
      {role:'DevOps / Cloud',    experience:'2–3 yrs', barPercent:65,  salaryVND:47},
    ]},
  { name:'FPT Software', type:'IT Services', tier:'Local',   city:'Ha Noi',           domain:'fpt.com',       color:'#F26522', submissions:88,  open:false, category:'IT Services', salaryByRole:[] },
  { name:'Momo',         type:'Fintech',     tier:'Local',   city:'Ho Chi Minh City', domain:'momo.vn',       color:'#A50064', submissions:63,  open:false, category:'Fintech',     salaryByRole:[] },
  { name:'Sky Mavis',    type:'Web3 Gaming', tier:'Foreign', city:'Ho Chi Minh City', domain:'skymavis.com',  color:'#4B5CE4', submissions:41,  open:false, category:'Web3 Gaming', salaryByRole:[] },
  { name:'Tiki',         type:'E-commerce',  tier:'Local',   city:'Ho Chi Minh City', domain:'tiki.vn',       color:'#1A94FF', submissions:57,  open:false, category:'E-commerce',  salaryByRole:[] },
  { name:'Zalo',         type:'Social Tech', tier:'Local',   city:'Ho Chi Minh City', domain:'zalo.me',       color:'#0068FF', submissions:52,  open:false, category:'Social Tech', salaryByRole:[] },
];

const _cardsHTML = _cardCompanies.map((c, i) => {
  const bg = `linear-gradient(135deg, ${c.color}bb 0%, ${c.color}33 100%)`;
  const logo = `https://www.google.com/s2/favicons?domain=${c.domain}&sz=256`;
  if (c.open) {
    const rank = _cardCompanies.filter(x => x.open).findIndex(x => x.name === c.name) + 1;
    return `<div class="company-card open" onclick="openCompanyPanel('${c.name.replace(/'/g,"\\'")}')">
      <div class="card-bg" style="background:${bg}"></div>
      <div class="card-logo-wrap"><img class="card-logo-img" src="${logo}" alt="${c.name}" onerror="this.style.display='none'"></div>
      <div class="card-overlay"></div>
      <div class="card-top">
        <span class="card-rank">#${rank}</span>
        <span class="card-top-badge">Top ${c.topPct}%</span>
      </div>
      <div class="card-bottom">
        <div class="card-name">${c.name}</div>
        <div class="card-divider"></div>
        <div class="card-sal">$${c.salMin.toLocaleString()}–$${c.salMax.toLocaleString()}</div>
        <div class="card-count">${c.submissions} salaries</div>
      </div>
    </div>`;
  } else {
    return `<div class="company-card locked" onclick="openCompanyPanel('${c.name.replace(/'/g,"\\'")}')">
      <div class="card-bg" style="background:${bg}"></div>
      <div class="card-logo-wrap"><img class="card-logo-img" src="${logo}" alt="${c.name}" onerror="this.style.display='none'"></div>
      <div class="card-overlay"></div>
      <div class="card-lock-center">
        <div class="card-lock-icon">🔒</div>
        <div class="card-lock-name">${c.name}</div>
        <div class="card-lock-count">${c.submissions} salaries</div>
      </div>
      <div class="lock-cta">Submit to unlock →</div>
    </div>`;
  }
}).join('');

const bodyHTML = `<nav>
  <div class="logo"><img src="/logo.png" style="width:28px;height:28px;object-fit:contain;"><span>FYI — FOR YOUR <span style="color:var(--orange);">&apos;SALARY&apos;</span> INFORMATION</span></div>
  <div class="nav-r">
    <a class="nav-link" href="#">Data</a>
    <a class="nav-link" href="#">Companies</a>
    <a class="nav-link" href="#">Reports</a>
    <a class="nav-link" href="/how-it-works">How it works</a>
    <button class="nav-btn" onclick="document.getElementById('submit').scrollIntoView({behavior:'smooth'})">Submit Salary</button>
  </div>
</nav>

<section class="hero">
  <video id="hero-vid" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35;z-index:0;">
    <source src="/interview1.mp4" type="video/mp4">
  </video>

  <div class="hero-copy">
    <div class="hero-kicker"><span class="kdot"></span>Vietnam IT Salary Intelligence</div>
    <h1 class="hero-h1">What does<br><span id="typed-company"></span><span class="typed-cursor"></span><br>actually pay?</h1>
    <p class="hero-sub">Real salary data submitted anonymously by engineers who work there. Find out where you actually stand.</p>
    <div class="hero-btns">
      <button class="btn-p" onclick="document.getElementById('submit').scrollIntoView({behavior:'smooth'})">Am I Underpaid? →</button>
    </div>
  </div>
  </div>
  <div class="hero-live-bar">
    <div class="live-badge">
      <div class="live-dot"></div>
      <span class="live-label">Live</span>
    </div>
    <div class="live-msg-wrap" id="liveMsgWrap"></div>
  </div>
</section>

<!-- TRUST BUILDER -->
<section class="trust-section" style="background:#0c0c0b; padding:80px 0;">

  <!-- HEAD -->
  <div class="trust-inner" style="max-width:1160px; margin:0 auto; padding:0 52px; margin-bottom:48px;">
    <div style="font-family:'Geist Mono',monospace; font-size:11px; color:var(--orange); letter-spacing:2.5px; text-transform:uppercase; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
      <span style="width:5px;height:5px;border-radius:50%;background:var(--orange);box-shadow:0 0 8px var(--orange);"></span>
      Real salaries, real people
    </div>
    <h2 style="font-size:clamp(26px,3.2vw,40px); font-weight:800; color:var(--white); letter-spacing:-1.5px; line-height:1.15;">
      No bullshit. <em style="font-style:normal; color:var(--orange);">We go first.</em>
    </h2>
    <p style="font-size:14px; color:rgba(242,240,235,.38); line-height:1.7; margin-bottom:40px; margin-top:16px;">If we ask you to share your salary, we share ours first.</p>
  </div>

  <!-- STAFF REVEAL BLOCK -->
  <div class="trust-inner" style="max-width:1160px; margin:0 auto; padding:0 52px; margin-bottom:56px;">
    <div class="trust-roadmap" style="display:grid; grid-template-columns:1fr 1fr; gap:2px;">

      <!-- LEFT BIG -->
      <div style="position:relative; overflow:hidden;">
        <img src="/trust-1.png" style="width:100%; height:320px; object-fit:cover; filter:brightness(.4); display:block;" alt="">
        <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(12,12,11,.9) 0%, transparent 55%); padding:28px; display:flex; flex-direction:column; justify-content:flex-end;">
          <div style="font-size:10px; color:var(--orange); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px;">Likelion staff · first</div>
          <div style="font-size:48px; font-weight:800; color:var(--white); letter-spacing:-2px; line-height:1;">34M</div>
          <div style="font-size:13px; color:rgba(242,240,235,0.5); margin-top:4px;">Product Manager · 3 yrs</div>
        </div>
      </div>

      <!-- RIGHT SMALL STACK -->
      <div style="display:flex; flex-direction:column; gap:2px;">
        <div style="position:relative; overflow:hidden;">
          <img src="/trust-2.png" style="width:100%; height:158px; object-fit:cover; filter:brightness(.4); display:block;" alt="">
          <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(12,12,11,.9) 0%, transparent 55%); padding:20px; display:flex; flex-direction:column; justify-content:flex-end;">
            <div style="font-size:10px; color:var(--orange); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">Likelion staff</div>
            <div style="font-size:36px; font-weight:800; color:var(--white); letter-spacing:-1.5px; line-height:1;">28M</div>
            <div style="font-size:12px; color:rgba(242,240,235,0.5); margin-top:3px;">Backend Dev · 2 yrs</div>
          </div>
        </div>
        <div style="position:relative; overflow:hidden;">
          <img src="/trust-3.png" style="width:100%; height:158px; object-fit:cover; filter:brightness(.4); display:block;" alt="">
          <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(12,12,11,.9) 0%, transparent 55%); padding:20px; display:flex; flex-direction:column; justify-content:flex-end;">
            <div style="font-size:10px; color:var(--orange); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">Likelion staff</div>
            <div style="font-size:36px; font-weight:800; color:var(--white); letter-spacing:-1.5px; line-height:1;">52M</div>
            <div style="font-size:12px; color:rgba(242,240,235,0.5); margin-top:3px;">Engineering Lead · 6 yrs</div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- STREET INTERVIEWS -->
  <div style="max-width:1160px; margin:0 auto; padding:0 52px; margin-bottom:56px;">
    <div class="city-cards-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:3px;">

      <!-- Card 1: HCMC District 1 -->
      <div class="city-card" style="position:relative; height:320px; overflow:hidden; cursor:pointer;"
           onmouseenter="this.style.transform='scale(1.04)';this.style.outline='2px solid var(--orange)';this.style.zIndex='2'"
           onmouseleave="this.style.transform='scale(1)';this.style.outline='none';this.style.zIndex='1'">
        <img src="/city-1.jpg" class="city-card-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.35);transform-origin:center;animation:kenBurns1 6s ease infinite alternate;" alt="Ho Chi Minh City District 1">
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(12,12,11,.95) 0%, rgba(12,12,11,.3) 55%, transparent 100%);"></div>
        <div style="position:absolute;inset:0;padding:24px;display:flex;flex-direction:column;justify-content:flex-end;">
          <div style="font-size:9px;font-family:'Geist Mono',monospace;color:var(--orange);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Ho Chi Minh City</div>
          <div style="font-size:22px;font-weight:800;color:var(--white);letter-spacing:-.5px;line-height:1.1;margin-bottom:4px;">District 1</div>
          <div style="font-size:11px;color:rgba(242,240,235,.45);margin-bottom:16px;">Bitexco · Ben Thanh · Tech hub</div>
          <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:14px;display:flex;flex-direction:column;gap:7px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">Grab Vietnam</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">35 salaries</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">Shopee Vietnam</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">31 salaries</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">Momo</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">22 salaries</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 2: HCMC Thu Duc -->
      <div class="city-card" style="position:relative; height:320px; overflow:hidden; cursor:pointer;"
           onmouseenter="this.style.transform='scale(1.04)';this.style.outline='2px solid var(--orange)';this.style.zIndex='2'"
           onmouseleave="this.style.transform='scale(1)';this.style.outline='none';this.style.zIndex='1'">
        <img src="/city-2.jpg" class="city-card-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.35);transform-origin:center;animation:kenBurns2 6s ease infinite alternate;" alt="Thu Duc City">
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(12,12,11,.95) 0%, rgba(12,12,11,.3) 55%, transparent 100%);"></div>
        <div style="position:absolute;inset:0;padding:24px;display:flex;flex-direction:column;justify-content:flex-end;">
          <div style="font-size:9px;font-family:'Geist Mono',monospace;color:var(--orange);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Ho Chi Minh City</div>
          <div style="font-size:22px;font-weight:800;color:var(--white);letter-spacing:-.5px;line-height:1.1;margin-bottom:4px;">Thu Duc City</div>
          <div style="font-size:11px;color:rgba(242,240,235,.45);margin-bottom:16px;">SHTP · Tech park · Startups</div>
          <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:14px;display:flex;flex-direction:column;gap:7px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">VNG Corporation</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">47 salaries</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">Sky Mavis</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">14 salaries</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">KMS Technology</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">18 salaries</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Hanoi Cầu Giấy -->
      <div class="city-card" style="position:relative; height:320px; overflow:hidden; cursor:pointer;"
           onmouseenter="this.style.transform='scale(1.04)';this.style.outline='2px solid var(--orange)';this.style.zIndex='2'"
           onmouseleave="this.style.transform='scale(1)';this.style.outline='none';this.style.zIndex='1'">
        <img src="/city-3.jpg" class="city-card-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.35);transform-origin:center;animation:kenBurns3 6s ease infinite alternate;" alt="Hanoi Cau Giay">
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(12,12,11,.95) 0%, rgba(12,12,11,.3) 55%, transparent 100%);"></div>
        <div style="position:absolute;inset:0;padding:24px;display:flex;flex-direction:column;justify-content:flex-end;">
          <div style="font-size:9px;font-family:'Geist Mono',monospace;color:var(--orange);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Hanoi</div>
          <div style="font-size:22px;font-weight:800;color:var(--white);letter-spacing:-.5px;line-height:1.1;margin-bottom:4px;">Cầu Giấy</div>
          <div style="font-size:11px;color:rgba(242,240,235,.45);margin-bottom:16px;">FPT · Keangnam · IT corridor</div>
          <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:14px;display:flex;flex-direction:column;gap:7px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">FPT Software</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">58 salaries</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">Tiki</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">28 salaries</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--white);font-weight:500;">Axon Active</span>
              <span style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--orange);">16 salaries</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- PRIVACY SECTION -->
  <div style="max-width:960px; margin:0 auto; padding:0 52px 56px;">
    <h2 style="font-size:clamp(32px,4vw,48px); font-weight:700; line-height:1.15; margin-bottom:12px; color:var(--white);">This is<br><em style="color:var(--orange);font-style:normal;">completely</em> anonymous.</h2>
    <p style="font-size:15px; color:var(--dim); margin-bottom:36px; line-height:1.7;">We don't know who you are. We just know what engineers in Vietnam are earning.</p>

    <div style="background:#0f0f0f; border:1px solid #1a1a1a; border-radius:18px; padding:36px 32px; margin-bottom:14px; display:flex; align-items:center; gap:0; flex-wrap:wrap;">
      <div style="display:flex; flex-direction:column; gap:10px; flex:1; min-width:180px;">
        <div style="font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:#555; margin-bottom:2px;">What you submit</div>
        <div style="background:#161616; border:1px solid #222; border-radius:10px; padding:13px 16px; display:flex; align-items:center; gap:12px;"><div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0;"></div><span style="font-size:13px;color:#bbb;">Salary</span><span style="font-size:13px;color:#666;margin-left:auto;font-family:monospace;filter:blur(5px);user-select:none;">$2,800</span></div>
        <div style="background:#161616; border:1px solid #222; border-radius:10px; padding:13px 16px; display:flex; align-items:center; gap:12px;"><div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0;"></div><span style="font-size:13px;color:#bbb;">Role</span><span style="font-size:13px;color:#666;margin-left:auto;font-family:monospace;filter:blur(5px);user-select:none;">Backend</span></div>
        <div style="background:#161616; border:1px solid #222; border-radius:10px; padding:13px 16px; display:flex; align-items:center; gap:12px;"><div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0;"></div><span style="font-size:13px;color:#bbb;">Experience</span><span style="font-size:13px;color:#666;margin-left:auto;font-family:monospace;filter:blur(5px);user-select:none;">4 yrs</span></div>
        <div style="background:#161616; border:1px solid #222; border-radius:10px; padding:13px 16px; display:flex; align-items:center; gap:12px;"><div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0;"></div><span style="font-size:13px;color:#bbb;">Company</span><span style="font-size:13px;color:#666;margin-left:auto;font-family:monospace;filter:blur(5px);user-select:none;">Grab</span></div>
      </div>
      <div style="padding:0 20px; display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0;">
        <div style="width:36px;height:1px;background:linear-gradient(to right,#2a2a2a,#444);"></div>
        <div style="color:#444;font-size:14px;">→</div>
      </div>
      <div style="width:88px;height:88px;flex-shrink:0;background:#161616;border:1px solid #2a2a2a;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;">
        <div style="font-size:32px;line-height:1;">🔐</div>
        <div style="font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#444;">Mixed in</div>
      </div>
      <div style="padding:0 20px; display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0;">
        <div style="width:36px;height:1px;background:linear-gradient(to right,#2a2a2a,#444);"></div>
        <div style="color:#444;font-size:14px;">→</div>
      </div>
      <div style="flex:1; min-width:180px;">
        <div style="background:#161616; border:1px solid #222; border-radius:12px; padding:18px;">
          <div style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--orange);margin-bottom:10px;">What everyone sees</div>
          <div style="font-size:11px;color:#888;margin-bottom:6px;">Backend · 4–6 yrs · Grab</div>
          <div style="height:7px;background:#222;border-radius:100px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;border-radius:100px;background:var(--orange);width:72%;"></div></div>
          <div style="font-size:13px;color:#ccc;font-weight:700;">$2,400 — $3,800</div>
          <div style="font-size:11px;color:#555;margin-top:3px;">Based on 35 salaries</div>
        </div>
      </div>
    </div>

    <div style="background:#111; border-radius:14px; padding:28px 32px; display:flex; align-items:center; gap:20px;">
      <div style="font-size:38px;flex-shrink:0;">🙈</div>
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
        <span style="font-size:22px;font-weight:700;color:var(--white);">We <em style="color:var(--orange);font-style:normal;">can't</em> identify you.</span>
        <span style="font-size:22px;font-weight:700;color:#444;">Even if we tried.</span>
      </div>
    </div>
  </div>


</section>

<div class="cards-bg">
<div class="cards-section">
  <div class="section-head">
    <h2 class="section-head-title">See what Vietnam's top IT companies <em>actually pay.</em></h2>
    <p class="section-head-sub">Search your company or browse by category.</p>
  </div>

  <!-- Company search bar -->
  <div class="co-search-wrap">
    <div class="co-search-bar">
      <span class="co-search-icon">🔍</span>
      <input class="co-search-input" id="co-search-input" type="text" placeholder="Search company (e.g. Grab, VNG, Shopee…)"
        oninput="coSearchFilter(this.value)"
        onkeydown="coSearchKey(event)"
        onblur="setTimeout(coSearchClose, 180)" />
    </div>
    <div class="co-search-drop" id="co-search-drop"></div>
  </div>

  <!-- Search result panel -->
  <div class="co-result-panel" id="co-result-panel">
    <div class="co-result-header">
      <div>
        <div class="co-result-name" id="co-result-name">—</div>
        <div class="co-result-count" id="co-result-count"></div>
      </div>
      <button class="co-result-close" onclick="coResultClose()">✕ 닫기</button>
    </div>
    <div id="co-result-body"></div>
  </div>
  <div class="company-grid">
    ${_cardsHTML}
  </div>
</div><!-- /cards-section -->
</div><!-- /cards-bg -->

<!-- SUBMIT -->
<section class="fyi-submit-section" id="submit">
  <div class="fyi-submit-inner">
    <div class="fyi-submit-grid">

      <div class="fyi-submit-left">
        <h2>Submit your salary.<br><span class="hl">Unlock everything.</span></h2>
        <p>30 seconds. No name. No email. 134 companies unlocked the moment you share.</p>
        <div class="fyi-sub-badges">
          <div class="fyi-sb-badge">100% anonymous · no account needed</div>
          <div class="fyi-sb-badge">Never shown individually, only aggregated</div>
          <div class="fyi-sb-badge">Never sold or shared with companies</div>
          <div class="fyi-sb-badge">Instant unlock · 134 companies</div>
        </div>
      </div>

      <div class="fyi-step-form">
        <div class="fyi-step-progress">
          <div class="fyi-sp-dot active" id="fyi-prog-0"></div>
          <div class="fyi-sp-dot"        id="fyi-prog-1"></div>
          <div class="fyi-sp-dot"        id="fyi-prog-2"></div>
          <div class="fyi-sp-dot"        id="fyi-prog-3"></div>
          <div class="fyi-sp-dot"        id="fyi-prog-4"></div>
        </div>

        <div class="fyi-step-content active" id="fyi-step-0">
          <div class="fyi-step-question">What's your role?</div>
          <div class="fyi-step-sub">Pick the one that best describes what you do.</div>
          <div class="fyi-option-grid cols-3">
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Backend')">
              <span class="fyi-ob-icon">⚙️</span><span class="fyi-ob-label">Backend</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Frontend')">
              <span class="fyi-ob-icon">🎨</span><span class="fyi-ob-label">Frontend</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Fullstack')">
              <span class="fyi-ob-icon">🔧</span><span class="fyi-ob-label">Fullstack</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Mobile')">
              <span class="fyi-ob-icon">📱</span><span class="fyi-ob-label">Mobile</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Data Engineer')">
              <span class="fyi-ob-icon">📊</span><span class="fyi-ob-label">Data Eng</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','DevOps / Cloud')">
              <span class="fyi-ob-icon">☁️</span><span class="fyi-ob-label">DevOps</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','UI/UX')">
              <span class="fyi-ob-icon">✏️</span><span class="fyi-ob-label">UI/UX</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','PM')">
              <span class="fyi-ob-icon">🗺️</span><span class="fyi-ob-label">Product</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Marketer')">
              <span class="fyi-ob-icon">📣</span><span class="fyi-ob-label">Marketing</span>
            </button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-1">
          <div class="fyi-step-question">Years of experience?</div>
          <div class="fyi-step-sub">Total years in the industry, not just at your current company.</div>
          <div class="fyi-option-grid cols-2">
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','Under 1 year')">
              <span class="fyi-ob-label">Under 1 year</span><span class="fyi-ob-sub">Just getting started</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','1–2 yrs')">
              <span class="fyi-ob-label">1 – 2 years</span><span class="fyi-ob-sub">Junior level</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','3–4 yrs')">
              <span class="fyi-ob-label">3 – 4 years</span><span class="fyi-ob-sub">Mid level</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','5–7 yrs')">
              <span class="fyi-ob-label">5 – 7 years</span><span class="fyi-ob-sub">Senior level</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','8+ yrs')" style="grid-column:1/-1">
              <span class="fyi-ob-label">8+ years</span><span class="fyi-ob-sub">Lead / Principal</span>
            </button>
          </div>
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(1)">← Back</button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-2">
          <div class="fyi-step-question">Your monthly salary?</div>
          <div class="fyi-step-sub">Gross, before tax. In million VND.</div>
          <div class="fyi-salary-slider-wrap">
            <div class="fyi-ss-display">
              <div class="fyi-ss-num" id="fyi-sal-display">20</div>
              <div class="fyi-ss-unit">M VND / month</div>
            </div>
            <input type="range" class="fyi-salary-slider" id="fyi-sal-slider"
              min="5" max="150" value="20" step="1" oninput="fyiUpdateSalary(this)">
            <div class="fyi-ss-ticks">
              <span class="fyi-ss-tick">5M</span>
              <span class="fyi-ss-tick">40M</span>
              <span class="fyi-ss-tick">80M</span>
              <span class="fyi-ss-tick">120M</span>
              <span class="fyi-ss-tick">150M+</span>
            </div>
          </div>
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(2)">← Back</button>
            <button class="fyi-btn-primary" onclick="fyiNextStep(2)" id="fyi-btn-step-2">Next →</button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-3">
          <div class="fyi-step-question">Where do you work?</div>
          <div class="fyi-step-sub">Only used to group salary data — never shown individually.</div>
          <input type="text" class="fyi-form-input" id="f-co"
            placeholder="e.g. VNG, Grab, FPT Software…"
            oninput="fyiUpdateCompanyBtn()" autocomplete="off">
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(3)">← Back</button>
            <button class="fyi-btn-primary" onclick="fyiNextStep(3)" disabled id="fyi-btn-step-3">Next →</button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-4">
          <div class="fyi-step-question">One last thing</div>
          <div class="fyi-step-sub">What would be most useful for you? (Pick all that apply)</div>
          <div class="fyi-voc-options">
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">🏢 See salaries at more companies</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">💼 See more roles and job functions</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">📅 Compare with people at my experience level</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">🚀 Find out where I can earn more</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">🎯 Get matched with recruiters at top-paying companies</div>
            </div>
          </div>
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(4)">← Back</button>
            <button class="fyi-btn-primary" id="fyi-unlock-btn" onclick="fyiDoSubmit()">Unlock all 134 companies →</button>
          </div>
          <div class="fyi-anon-note">Your salary is never linked to your name or identity.</div>
        </div>

        <div class="fyi-submit-success" id="fyi-submit-success">
          <div class="fyi-ss-icon">🎉</div>
          <div class="fyi-ss-title">You're in. Everything's unlocked.</div>
          <p class="fyi-ss-sub">All 134 companies are now visible below. Thanks for making the data better for everyone in Vietnam.</p>
          <button class="fyi-ss-cta" onclick="document.getElementById('full-feed').scrollIntoView({behavior:'smooth'})">See all company salaries ↓</button>
        </div>

        <input type="hidden" id="f-role">
        <input type="hidden" id="f-exp">
        <input type="hidden" id="f-sal">

        <div class="result-block" id="result-block">
          <div><div class="rb-ctx" id="rb-ctx">Backend · 3–4 yrs</div><div class="rb-pct" id="rb-pct">Top 38%</div></div>
          <div class="rb-sep"></div>
          <div class="rb-bwrap">
            <div class="rb-bl"><span id="rl">You</span><span id="rm">Median</span><span id="rr">Top 10%</span></div>
            <div class="rb-track"><div class="rb-fill" id="rb-fill" style="width:0%"></div></div>
          </div>
        </div>
        <div class="uline" id="uline">✓ UNLOCKED — 134 companies now visible below</div>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="footer-brand">FYI <span>—</span> For Your Information</div>
  <div class="footer-meta">Vietnam IT Salary Intelligence · 100% Anonymous · Updated daily</div>
</footer>

<div id="full-feed">
  <div class="ff-head">
    <div class="ff-title">All Companies <span class="ff-badge">UNLOCKED</span></div>
    <div class="ff-meta" id="ff-meta">134 companies · 4,812 salaries</div>
  </div>
  <div class="card-grid">
    <div class="bcard"><div class="bcard-banner"><img src="data:image/png;base64,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" alt="" style="object-fit:contain;background:#1a9be8;filter:brightness(.7);"><div class="bcard-cat">Top Paying</div><div class="bcard-logo-wrap"><img src="https://logo.clearbit.com/tiki.vn" onerror="this.parentNode.outerHTML='<div class=bcard-logo-fb>T</div>'" alt=""></div></div><div class="bcard-body"><div class="bcard-co">Tiki</div><div class="bcard-type">E-commerce · Large corp</div><div style="font-size:36px;font-weight:800;color:#f2f0eb;letter-spacing:-1px;line-height:1;"><span style="color:var(--orange);">28</span></div>
      <div style="font-size:11px;color:rgba(242,240,235,.4);margin-top:4px;">salaries</div><div class="bcard-metrics"><div class="bm"><span class="bm-dot hi"></span><span class="bm-label">Market</span><span class="bm-val" style="color:var(--green)">Top 10%</span></div><div class="bm"><span class="bm-dot hi"></span><span class="bm-label">vs. avg</span><span class="bm-val" style="color:var(--green)">+34%</span></div></div><div class="bcard-quote">"Data team gets paid well."<div class="bcard-quote-src">— Current · Data Eng · 5 yrs</div></div><div class="bcard-n">21 salaries</div></div></div>
    <div class="bcard"><div class="bcard-banner"><img src="data:image/png;base64,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" alt="" style="object-fit:contain;background:#ae2d8c;filter:brightness(.7);"><div class="bcard-cat">Fast Growing</div><div class="bcard-logo-wrap"><img src="https://logo.clearbit.com/momo.vn" onerror="this.parentNode.outerHTML='<div class=bcard-logo-fb>M</div>'" alt=""></div></div><div class="bcard-body"><div class="bcard-co">Momo</div><div class="bcard-type">Fintech · Startup</div><div style="font-size:36px;font-weight:800;color:#f2f0eb;letter-spacing:-1px;line-height:1;"><span style="color:var(--orange);">22</span></div>
      <div style="font-size:11px;color:rgba(242,240,235,.4);margin-top:4px;">salaries</div><div class="bcard-metrics"><div class="bm"><span class="bm-dot mi"></span><span class="bm-label">Market</span><span class="bm-val" style="color:var(--orange)">Top 28%</span></div><div class="bm"><span class="bm-dot hi"></span><span class="bm-label">YoY</span><span class="bm-val" style="color:var(--green)">+24%</span></div></div><div class="bcard-quote">"Growing fast, equity upside is real."<div class="bcard-quote-src">— Current · DevOps · 3 yrs</div></div><div class="bcard-n">19 salaries</div></div></div>
    <div class="bcard"><div class="bcard-banner"><img src="data:image/png;base64,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" alt=""><div class="bcard-cat">Best for Seniors</div><div class="bcard-logo-wrap"><img src="https://logo.clearbit.com/fpt.com.vn" onerror="this.parentNode.outerHTML='<div class=bcard-logo-fb>F</div>'" alt=""></div></div><div class="bcard-body"><div class="bcard-co">FPT Software</div><div class="bcard-type">Outsourcing · Large</div><div style="font-size:36px;font-weight:800;color:#f2f0eb;letter-spacing:-1px;line-height:1;"><span style="color:var(--orange);">58</span></div>
      <div style="font-size:11px;color:rgba(242,240,235,.4);margin-top:4px;">salaries</div><div class="bcard-metrics"><div class="bm"><span class="bm-dot mi"></span><span class="bm-label">Market</span><span class="bm-val" style="color:var(--orange)">Median</span></div><div class="bm"><span class="bm-dot hi"></span><span class="bm-label">n</span><span class="bm-val">n=58</span></div></div><div class="bcard-quote">"Senior engineers negotiate well here."<div class="bcard-quote-src">— Current · Senior · 7 yrs</div></div><div class="bcard-n">58 salaries</div></div></div>
  </div>
</div>
`;

const js = `// CAROUSEL }

// FILTER
function filterCards(cat,el){
  document.querySelectorAll('.ftab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.bcard[data-cat]').forEach(c=>{
    const cats=c.dataset.cat||'';
    c.style.display=(cat==='all'||cats.includes(cat))?'':'none';
  });
}

// LIVE TICKER
const logoMap={'Shopee VN':'shopee.vn','Zalo':'zalo.me','NashTech':null,'Momo':'momo.vn','FPT':'fpt.com.vn','KMS Tech':'kms-technology.com','VNG':'vng.com.vn','Tiki':'tiki.vn','Grab VN':'grab.com','Sky Mavis':'skymavis.com'};
const pool=[
  {co:'Shopee VN',role:'Backend',exp:'5 yrs',sal:54,pct:8,t:'hi'},
  {co:'Shopee VN',role:'Frontend',exp:'3 yrs',sal:42,pct:14,t:'hi'},
  {co:'Shopee VN',role:'Data Eng',exp:'4 yrs',sal:58,pct:6,t:'hi'},
  {co:'Zalo',role:'Mobile',exp:'3 yrs',sal:38,pct:19,t:'hi'},
  {co:'Momo',role:'Backend',exp:'5 yrs',sal:46,pct:12,t:'hi'},
  {co:'FPT',role:'DevOps',exp:'4 yrs',sal:28,pct:33,t:'mi'},
  {co:'KMS Tech',role:'Data Eng',exp:'2 yrs',sal:24,pct:44,t:'mi'},
  {co:'VNG',role:'Backend',exp:'6 yrs',sal:52,pct:9,t:'hi'},
  {co:'VNG',role:'Fullstack',exp:'4 yrs',sal:44,pct:15,t:'hi'},
  {co:'VNG',role:'Mobile',exp:'5 yrs',sal:48,pct:11,t:'hi'},
  {co:'Tiki',role:'PM',exp:'4 yrs',sal:42,pct:17,t:'hi'},
  {co:'Tiki',role:'Data Eng',exp:'3 yrs',sal:38,pct:21,t:'hi'},
  {co:'Tiki',role:'Backend',exp:'5 yrs',sal:46,pct:13,t:'hi'},
  {co:'Grab VN',role:'Mobile',exp:'7 yrs',sal:68,pct:4,t:'hi'},
  {co:'Grab VN',role:'Backend',exp:'5 yrs',sal:62,pct:6,t:'hi'},
  {co:'Grab VN',role:'DevOps',exp:'6 yrs',sal:72,pct:3,t:'hi'},
  {co:'Sky Mavis',role:'Fullstack',exp:'3 yrs',sal:48,pct:11,t:'hi'},
  {co:'NashTech',role:'Frontend',exp:'1 yr',sal:14,pct:66,t:'mi'},
  {co:'KMS Tech',role:'Backend',exp:'4 yrs',sal:32,pct:28,t:'mi'},
  {co:'Momo',role:'Mobile',exp:'3 yrs',sal:40,pct:18,t:'hi'},
];
let pi=0,total=0;
const nids=['n0','n1','n2']; let nv=[17,34,23];
function logoEl(co){ const d=logoMap[co]; if(d) return \`<img class="st-logo" src="https://logo.clearbit.com/\${d}" onerror="this.outerHTML='<div class=st-logo-fb>\${co[0]}</div>'" alt="">\`; return \`<div class="st-logo-fb">\${co[0]}</div>\`; }
function addTicker(d){
  const list=document.getElementById('st-list');
  const pl=d.t==='hi'?\`▲ Top \${d.pct}%\`:\`— Top \${d.pct}%\`;
  const item=document.createElement('div'); item.className='st-item';
  item.innerHTML=\`\${logoEl(d.co)}<span class="st-co">\${d.co}</span><span class="st-role">\${d.role} · \${d.exp}</span><span class="st-sal">\${d.sal}M VND</span><span style="font-family:'Geist Mono',monospace;font-size:10px;color:\${d.t==='hi'?'var(--green)':'var(--orange)'}">\${pl}</span>\`;
  list.appendChild(item); const all=list.querySelectorAll('.st-item'); if(all.length>7) all[0].remove();
}
[0,1,2,3].forEach(i=>addTicker(pool[i])); pi=4;
function fire(){
  const d=pool[pi%pool.length]; pi++; total++;
  const he=document.getElementById('hero-n');
  if(he){ he.textContent=total.toLocaleString(); he.style.color='var(--orange)'; setTimeout(()=>he.style.color='var(--white)',600); }
  const idx=Math.floor(Math.random()*3); nv[idx]++;
  const ne=document.getElementById(nids[idx]);
  if(ne){ ne.textContent=\`\${nv[idx]} salaries\`; ne.style.color='var(--orange)'; setTimeout(()=>ne.style.color='var(--dim)',800); }
  addTicker(d);
}
(function sched(){ setTimeout(()=>{ fire(); sched(); },2800+Math.random()*3200); })();

async function loadStats(){
  try{
    const res=await fetch('/api/stats');
    const d=await res.json();
    const sub=d.submissionCount||0, co=d.companyCount||0;
    total=sub;
    window.totalCo=co;
    const remainCo=document.getElementById('remaining-co'); if(remainCo) remainCo.textContent=(co-6).toLocaleString();
    const heroN=document.getElementById('hero-n'); if(heroN) heroN.textContent=sub.toLocaleString();
    const heroCo=document.getElementById('hero-co-n'); if(heroCo) heroCo.textContent=co.toLocaleString();
    const statSubHero=document.getElementById('stat-sub-hero'); if(statSubHero) statSubHero.textContent=sub.toLocaleString();
    const statCoSub=document.getElementById('stat-co-sub'); if(statCoSub) statCoSub.textContent=co.toLocaleString();
    const statSubSub=document.getElementById('stat-sub-sub'); if(statSubSub) statSubSub.textContent=sub.toLocaleString();
    const unlockBtn=document.getElementById('unlock-btn'); if(unlockBtn) unlockBtn.textContent=\`See all salary data →\`;
    const ffMeta=document.getElementById('ff-meta'); if(ffMeta) ffMeta.textContent=\`\${co.toLocaleString()} companies · \${sub.toLocaleString()} salaries\`;
    const uline=document.getElementById('uline'); if(uline&&!uline.classList.contains('on')) uline.textContent=\`✓ UNLOCKED — \${co.toLocaleString()} companies now visible below\`;
    updateTrustStats(sub, co);
    const totalCo=document.getElementById('total-co-count'); if(totalCo) totalCo.textContent=co.toLocaleString();
    if(d.recent && d.recent.length>=4){
      const list=document.getElementById('st-list'); if(list) list.innerHTML='';
      const realPool=d.recent.map(s=>{
        const bench=BENCHMARK[s.role]&&BENCHMARK[s.role][s.experience];
        const med=bench?bench.median:s.salary;
        const rawPct=Math.round(Math.max(1,Math.min(99,100-((s.salary-med)/med*50+50))));
        return {co:s.company||'Anonymous',role:s.role,exp:s.experience,sal:s.salary,pct:rawPct,t:s.salary>=med?'hi':'mi'};
      });
      pool.splice(0,pool.length,...realPool);
      [0,1,2,3].forEach(i=>addTicker(pool[i%pool.length])); pi=4;
    }
  }catch(e){}
}
loadStats();

// AUTOCOMPLETE
const coList = [
  {name:'VNG Corporation',       type:'Product · Large',       domain:'vng.com.vn'},
  {name:'Tiki',                  type:'E-commerce · Large',    domain:'tiki.vn'},
  {name:'Grab Vietnam',          type:'Super App · Foreign',   domain:'grab.com'},
  {name:'Shopee Vietnam',        type:'E-commerce · Foreign',  domain:'shopee.vn'},
  {name:'Momo',                  type:'Fintech · Startup',     domain:'momo.vn'},
  {name:'FPT Software',          type:'Outsourcing · Large',   domain:'fpt.com.vn'},
  {name:'KMS Technology',        type:'Product · Foreign',     domain:'kms-technology.com'},
  {name:'NashTech',              type:'Outsourcing · Foreign', domain:null},
  {name:'Sky Mavis',             type:'Web3 · Startup',        domain:'skymavis.com'},
  {name:'Zalo (VNG)',            type:'Consumer App',          domain:'zalo.me'},
  {name:'VNPT Technology',       type:'Telco · State-owned',   domain:'vnpt.vn'},
  {name:'Axon Active',           type:'Outsourcing · Foreign', domain:'axonactive.com'},
  {name:'Got It',                type:'AI · Startup',          domain:null},
  {name:'Base.vn',               type:'SaaS · Startup',        domain:null},
  {name:'Fossil Group VN',       type:'IoT · Foreign',         domain:null},
  {name:'Rever',                 type:'Proptech · Startup',    domain:null},
  {name:'Giao Hang Nhanh (GHN)', type:'Logistics · Startup',  domain:null},
  {name:'Techcombank',           type:'Banking · Large',       domain:'techcombank.com.vn'},
  {name:'VPBank',                type:'Banking · Large',       domain:'vpbank.com.vn'},
  {name:'Sendo',                 type:'E-commerce',            domain:null},
  {name:'Amanotes',              type:'Gaming · Startup',      domain:null},
  {name:'Harvey Nash Vietnam',   type:'Outsourcing · Foreign', domain:null},
  {name:'Logivan',               type:'Logistics · Startup',   domain:null},
];
let acIdx = -1;
function acFilter(q) {
  const drop = document.getElementById('ac-drop');
  if (!q || !q.trim()) { drop.classList.remove('open'); return; }
  const hits = coList.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  if (!hits.length) { drop.classList.remove('open'); return; }
  drop.innerHTML = hits.map((c) => {
    const logo = c.domain
      ? \`<img class="ac-item-logo" src="https://logo.clearbit.com/\${c.domain}" onerror="this.outerHTML='<div class=ac-item-logo-fb>\${c.name[0]}</div>'" alt="">\`
      : \`<div class="ac-item-logo-fb">\${c.name[0]}</div>\`;
    const safe = c.name.replace(/'/g,"\\\\'");
    return \`<div class="ac-item" data-name="\${c.name}" onmousedown="acPick('\${safe}')">\${logo}<span class="ac-item-name">\${c.name}</span><span class="ac-item-type">\${c.type}</span></div>\`;
  }).join('');
  acIdx = -1;
  drop.classList.add('open');
}
function acPick(name) {
  document.getElementById('f-co').value = name;
  document.getElementById('ac-drop').classList.remove('open');
}
function acClose() { document.getElementById('ac-drop').classList.remove('open'); }
function acKey(e) {
  const drop = document.getElementById('ac-drop');
  const items = drop.querySelectorAll('.ac-item');
  if (e.key==='ArrowDown') { acIdx=Math.min(acIdx+1,items.length-1); items.forEach((el,i)=>el.classList.toggle('focused',i===acIdx)); e.preventDefault(); }
  else if (e.key==='ArrowUp') { acIdx=Math.max(acIdx-1,0); items.forEach((el,i)=>el.classList.toggle('focused',i===acIdx)); e.preventDefault(); }
  else if (e.key==='Enter'&&acIdx>=0) { acPick(items[acIdx].dataset.name); e.preventDefault(); }
  else if (e.key==='Escape') { acClose(); }
}

// ── Company search ──
let coAllCompanies = [];
let coSearchIdx = -1;

async function coLoadCompanies() {
  if (coAllCompanies.length) return;
  try {
    const res = await fetch('/api/companies');
    coAllCompanies = await res.json();
  } catch(e) {}
}

function coSearchFilter(val) {
  coLoadCompanies();
  const drop = document.getElementById('co-search-drop');
  const q = val.trim().toLowerCase();
  if (!q) { drop.classList.remove('open'); return; }
  const matches = coAllCompanies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { drop.classList.remove('open'); return; }
  drop.innerHTML = matches.map((c, i) =>
    \`<div class="co-drop-item" data-name="\${c.name}" data-tier="\${c.tier}" onclick="coSelect('\${c.name.replace(/'/g,"\\\\'")}')">
      <span class="co-drop-item-name">\${c.name}</span>
      <span class="co-drop-item-badge \${c.tier===3?'no-data':''}">\${c.tier===1?'Rich data':c.tier===2?'Has data':'No data yet'}</span>
    </div>\`
  ).join('');
  coSearchIdx = -1;
  drop.classList.add('open');
}

function coSearchKey(e) {
  const drop = document.getElementById('co-search-drop');
  const items = drop.querySelectorAll('.co-drop-item');
  if (e.key === 'ArrowDown') { coSearchIdx = Math.min(coSearchIdx+1, items.length-1); items.forEach((el,i)=>el.classList.toggle('focused',i===coSearchIdx)); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { coSearchIdx = Math.max(coSearchIdx-1, 0); items.forEach((el,i)=>el.classList.toggle('focused',i===coSearchIdx)); e.preventDefault(); }
  else if (e.key === 'Enter') {
    if (coSearchIdx >= 0 && items[coSearchIdx]) {
      coSelect(items[coSearchIdx].dataset.name); e.preventDefault();
    } else {
      const val = document.getElementById('co-search-input').value.trim();
      if (val) coSelect(val);
    }
  }
  else if (e.key === 'Escape') { coSearchClose(); }
}

function coSearchClose() { document.getElementById('co-search-drop').classList.remove('open'); }

async function coSelect(name) {
  document.getElementById('co-search-input').value = name;
  coSearchClose();
  const panel = document.getElementById('co-result-panel');
  const body = document.getElementById('co-result-body');
  document.getElementById('co-result-name').textContent = name;
  document.getElementById('co-result-count').textContent = 'Loading...';
  panel.classList.add('on');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const res = await fetch(\`/api/company?name=\${encodeURIComponent(name)}\`);
    const data = await res.json();

    if (data.found) {
      document.getElementById('co-result-count').textContent = \`\${data.total} submissions\`;
      const maxMedian = Math.max(...data.stats.map(s => s.median));
      body.innerHTML = \`
        <table class="co-role-table">
          <thead><tr>
            <th>Role</th><th>Median</th><th>Range</th><th>Count</th><th></th>
          </tr></thead>
          <tbody>\${data.stats.map(s => \`
            <tr>
              <td><span class="co-role-name">\${s.role}</span></td>
              <td><span class="co-role-median">\${s.median}M</span></td>
              <td><span class="co-role-range">\${s.min}M – \${s.max}M</span></td>
              <td><span class="co-role-count">\${s.count}</span></td>
              <td><div class="co-role-bar-wrap"><div class="co-role-bar" style="width:\${Math.round(s.median/maxMedian*100)}%"></div></div></td>
            </tr>\`).join('')}
          </tbody>
        </table>\`;
    } else {
      document.getElementById('co-result-count').textContent = 'No data yet';
      body.innerHTML = \`
        <div class="co-no-data">
          <div class="co-no-data-title">No data yet for this company</div>
          <div class="co-no-data-sub">Be the first to submit and unlock all salary data.</div>
          <button class="btn-sub" onclick="document.querySelector('.submit-outer').scrollIntoView({behavior:'smooth'})">Submit my salary →</button>
        </div>
        \${data.similar && data.similar.length ? \`
        <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06)">
          <div class="co-similar-label">See similar companies</div>
          <div class="co-similar-grid">\${data.similar.map(co =>
            \`<div class="co-similar-chip" onclick="coSelect('\${co.replace(/'/g,"\\\\'")}')">
              \${co}
            </div>\`).join('')}
          </div>
        </div>\` : ''}
      \`;
    }
  } catch(e) {
    body.innerHTML = \`<p style="color:var(--dim)">Something went wrong. Please try again.</p>\`;
  }
}

function coResultClose() {
  document.getElementById('co-result-panel').classList.remove('on');
  document.getElementById('co-search-input').value = '';
}

const BENCHMARK = {
  'Backend':      { 'Under 1 year':{median:12,p25:9,p75:15},  '1–2 yrs':{median:18,p25:14,p75:24}, '3–4 yrs':{median:28,p25:22,p75:35}, '5–7 yrs':{median:40,p25:32,p75:50}, '8+ yrs':{median:55,p25:44,p75:68} },
  'Frontend':     { 'Under 1 year':{median:11,p25:8,p75:14},  '1–2 yrs':{median:16,p25:12,p75:22}, '3–4 yrs':{median:25,p25:19,p75:32}, '5–7 yrs':{median:36,p25:28,p75:46}, '8+ yrs':{median:50,p25:40,p75:62} },
  'Fullstack':    { 'Under 1 year':{median:12,p25:9,p75:15},  '1–2 yrs':{median:17,p25:13,p75:23}, '3–4 yrs':{median:27,p25:21,p75:34}, '5–7 yrs':{median:38,p25:30,p75:48}, '8+ yrs':{median:52,p25:42,p75:65} },
  'Mobile':       { 'Under 1 year':{median:13,p25:10,p75:16}, '1–2 yrs':{median:19,p25:14,p75:25}, '3–4 yrs':{median:30,p25:23,p75:38}, '5–7 yrs':{median:42,p25:33,p75:54}, '8+ yrs':{median:58,p25:46,p75:72} },
  'Data Engineer':{ 'Under 1 year':{median:14,p25:10,p75:18}, '1–2 yrs':{median:22,p25:16,p75:29}, '3–4 yrs':{median:36,p25:28,p75:46}, '5–7 yrs':{median:50,p25:40,p75:62}, '8+ yrs':{median:65,p25:52,p75:80} },
  'DevOps / Cloud':{'Under 1 year':{median:15,p25:11,p75:19}, '1–2 yrs':{median:22,p25:17,p75:29}, '3–4 yrs':{median:32,p25:25,p75:41}, '5–7 yrs':{median:45,p25:36,p75:57}, '8+ yrs':{median:60,p25:48,p75:75} },
  'UI/UX':        { 'Under 1 year':{median:11,p25:8,p75:14},  '1–2 yrs':{median:16,p25:12,p75:22}, '3–4 yrs':{median:25,p25:19,p75:32}, '5–7 yrs':{median:36,p25:28,p75:46}, '8+ yrs':{median:50,p25:40,p75:62} },
  'PM':           { 'Under 1 year':{median:14,p25:10,p75:18}, '1–2 yrs':{median:20,p25:15,p75:27}, '3–4 yrs':{median:32,p25:25,p75:42}, '5–7 yrs':{median:50,p25:40,p75:63}, '8+ yrs':{median:75,p25:60,p75:92} },
};
function calcPercentile(role,exp,sal){
  const bench=BENCHMARK[role]&&BENCHMARK[role][exp];
  if(!bench) return {topPct:50,median:sal,p25:Math.round(sal*.8),p75:Math.round(sal*1.2)};
  const {median,p25,p75}=bench;
  let percentile;
  if(sal<=p25)           percentile=25*(sal/p25);
  else if(sal<=median)   percentile=25+25*((sal-p25)/(median-p25));
  else if(sal<=p75)      percentile=50+25*((sal-median)/(p75-median));
  else                   percentile=75+Math.min(24,25*((sal-p75)/p75));
  percentile=Math.round(Math.min(99,Math.max(1,percentile)));
  return {topPct:100-percentile,median,p25,p75};
}
async function doUnlock(role,exp,sal){
  if(!role||!exp||!sal) return false;
  let pctData;
  try{
    const res=await fetch(\`/api/percentile?role=\${encodeURIComponent(role)}&experience=\${encodeURIComponent(exp)}&salary=\${sal}\`);
    const json=await res.json();
    if(!json.usedFallback) pctData=json;
  }catch(e){}
  if(!pctData) pctData=calcPercentile(role,exp,sal);
  const {topPct,median,p25,p75}=pctData;
  const bar=topPct;
  const vsMedian=Math.round(((sal-median)/median)*100);
  const vsText=vsMedian>=0?\`+\${vsMedian}%\`:\`\${vsMedian}%\`;
  ['bl0','bl1','bl2'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    const unlockBtn=el.querySelector('[onclick*="submit-outer"]');
    if(unlockBtn) unlockBtn.style.display='none';
    const blurred=el.querySelectorAll('[style*="blur"]');
    blurred.forEach(b=>{ b.style.filter='none'; });
  });
  const gate=document.querySelector('.cards-gate'); if(gate) gate.style.display='none';
  window.isUnlocked=true;
  const searchInput=document.getElementById('hero-search');
  const searchLock=document.getElementById('search-lock');
  if(searchInput){ searchInput.placeholder='Search any of the '+(window.totalCo||'500')+' companies…'; searchInput.style.borderColor='rgba(255,255,255,0.15)'; searchInput.onclick=null; }
  if(searchLock) searchLock.textContent='🔓 Search unlocked';
  document.getElementById('full-feed').classList.add('on');
  document.getElementById('rb-ctx').textContent=\`\${role} · \${exp}\`;
  document.getElementById('rb-pct').textContent=\`Top \${topPct}%\`;
  document.getElementById('rl').textContent=\`You \${sal}M\`;
  document.getElementById('rm').textContent=\`Med \${median}M\`;
  document.getElementById('rr').textContent=\`P75 \${p75}M\`;
  document.getElementById('result-block').classList.add('on');
  setTimeout(()=>document.getElementById('rb-fill').style.width=bar+'%',100);
  const uline=document.getElementById('uline');
  uline.textContent=\`vs. median \${vsText} · Top 25% earn \${p75}M+\`;
  uline.classList.add('on');
  if (typeof window.onUnlockSuccess === 'function') window.onUnlockSuccess();
  return true;
}
function updateTrustStats(sub, co) {
  const t1=document.getElementById('trust-s1'); if(t1) t1.textContent=sub.toLocaleString();
  const t2=document.getElementById('trust-s2'); if(t2) t2.textContent=co.toLocaleString();
  const tn=document.getElementById('trust-sub-n'); if(tn) tn.textContent=sub.toLocaleString();
}
function reportData(company){
  alert('Thank you for the feedback. We will review ' + company + ' data shortly.');
}

function heroSearch(q){
  if(!q||q.length<2) return;
  const coInput=document.getElementById('co-search-input');
  if(coInput){ coInput.value=q; coSearchFilter(q); document.querySelector('.cards-section').scrollIntoView({behavior:'smooth'}); }
}
async function submitSalary(role, experience, salary, company, source, email){
  try {
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, experience, salary, company, source, email })
    });
  } catch(e) {
    // Continue unlock even if submit fails
  }
}

async function unlock(){
  const r=document.getElementById('f-role').value,e=document.getElementById('f-exp').value,s=parseInt(document.getElementById('f-sal').value);
  const c=document.getElementById('f-co')?document.getElementById('f-co').value:'';
  if(!r||!e||!s||!c){ alert('Please fill in all fields including your company name.'); return; }
  const urlParams=new URLSearchParams(window.location.search);
  const source=urlParams.get('source')||'direct';
  const email=document.getElementById('f-email')?.value||'';
  submitSalary(r,e,s,c,source,email);
  if(await doUnlock(r,e,s)) setTimeout(()=>document.getElementById('full-feed').scrollIntoView({behavior:'smooth'}),300);
}
window.submitSalary=submitSalary;
window.doUnlock=doUnlock;
`;

const lbData = {
  'Grab Vietnam': {
    type: 'Super App', tier: 'Foreign · L1', city: 'Ho Chi Minh City',
    topPct: 4, submissions: 127, median: 2800, vsMarket: 38,
    top3: [
      { title:'Mobile Engineer',  abbr:'Mob', role:'Mobile',  exp:'5–7', city:'HCMC', salary:3500, barPct:100, vsMarket:52 },
      { title:'Backend Engineer', abbr:'BE',  role:'Backend', exp:'5–7', city:'HCMC', salary:3200, barPct:91,  vsMarket:38 },
      { title:'Data Engineer',    abbr:'DE',  role:'Data',    exp:'3–5', city:'HCMC', salary:2800, barPct:80,  vsMarket:21 },
    ],
    listRows: [
      { title:'DevOps / Cloud',   abbr:'DO',  role:'DevOps',  exp:'2–3', city:'HCMC', salary:2300, vsMarket:-2  },
    ],
    lockedRows: [
      { title:'Backend Engineer', abbr:'BE',  role:'Backend', exp:'3–4', city:'HCMC', salary:2000, vsMarket:-13 },
      { title:'Frontend Engineer',abbr:'FE',  role:'Frontend',exp:'1–2', city:'HCMC', salary:1400, vsMarket:-31 },
    ],
  },
  'VNG Corporation': {
    type: 'Product', tier: 'Local · Large', city: 'Ho Chi Minh City',
    topPct: 9, submissions: 94, median: 2200, vsMarket: 14,
    top3: [
      { title:'Backend Engineer',  abbr:'BE',  role:'Backend', exp:'5–7', city:'HCMC', salary:2700, barPct:100, vsMarket:17 },
      { title:'Mobile Engineer',   abbr:'Mob', role:'Mobile',  exp:'4–5', city:'HCMC', salary:2400, barPct:89,  vsMarket:4  },
      { title:'Data Engineer',     abbr:'DE',  role:'Data',    exp:'3–4', city:'HCMC', salary:2100, barPct:78,  vsMarket:-9 },
    ],
    listRows: [
      { title:'Frontend Engineer', abbr:'FE',  role:'Frontend',exp:'3–4', city:'HCMC', salary:1800, vsMarket:-22 },
    ],
    lockedRows: [
      { title:'DevOps / Cloud',    abbr:'DO',  role:'DevOps',  exp:'2–3', city:'HCMC', salary:1500, vsMarket:-35 },
      { title:'PM',                abbr:'PM',  role:'PM',      exp:'3–4', city:'HCMC', salary:1750, vsMarket:-24 },
    ],
  },
  'Shopee Vietnam': {
    type: 'E-commerce', tier: 'Foreign · L1', city: 'Ho Chi Minh City',
    topPct: 6, submissions: 112, median: 2600, vsMarket: 30,
    top3: [
      { title:'Backend Engineer',  abbr:'BE',  role:'Backend', exp:'5–7', city:'HCMC', salary:3100, barPct:100, vsMarket:34 },
      { title:'Data Engineer',     abbr:'DE',  role:'Data',    exp:'4–5', city:'HCMC', salary:2800, barPct:90,  vsMarket:21 },
      { title:'Mobile Engineer',   abbr:'Mob', role:'Mobile',  exp:'3–4', city:'HCMC', salary:2400, barPct:77,  vsMarket:4  },
    ],
    listRows: [
      { title:'PM',                abbr:'PM',  role:'PM',      exp:'4–5', city:'HCMC', salary:2500, vsMarket:8  },
    ],
    lockedRows: [
      { title:'DevOps / Cloud',    abbr:'DO',  role:'DevOps',  exp:'2–3', city:'HCMC', salary:1900, vsMarket:-18 },
      { title:'Frontend Engineer', abbr:'FE',  role:'Frontend',exp:'2–3', city:'HCMC', salary:1600, vsMarket:-31 },
    ],
  },
};

export default function Home() {
  const [lbCompany, setLbCompany] = useState(null);
  const [activeTab, setActiveTab] = useState('All roles');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const isUnlockedRef = useRef(false);
  const pendingCompanyRef = useRef(null);

  // Expose openLB / closeLB to inline onclick handlers inside dangerouslySetInnerHTML
  useEffect(() => {
    window.openLB = (company) => { setLbCompany(company); setActiveTab('All roles'); };
    window.closeLB = () => setLbCompany(null);
    return () => { delete window.openLB; delete window.closeLB; };
  }, []);

  // localStorage unlock check on mount
  useEffect(() => {
    if (localStorage.getItem('fyi_submitted') === 'true') {
      isUnlockedRef.current = true;
      setIsUnlocked(true);
      document.body.classList.add('body-unlocked');
      const gate = document.querySelector('.cards-gate');
      if (gate) gate.style.display = 'none';
    }
  }, []);

  // Company panel bridge + unlock success handler
  useEffect(() => {
    window.openCompanyPanel = (name) => {
      const c = _cardCompanies.find(x => x.name === name);
      if (!c) return;
      if (!c.open && !isUnlockedRef.current) pendingCompanyRef.current = name;
      setSelectedCompany(c);
    };
    window.onUnlockSuccess = () => {
      localStorage.setItem('fyi_submitted', 'true');
      isUnlockedRef.current = true;
      setIsUnlocked(true);
      document.body.classList.add('body-unlocked');
      const gate = document.querySelector('.cards-gate');
      if (gate) {
        gate.style.transition = 'opacity .5s ease';
        gate.style.opacity = '0';
        setTimeout(() => { gate.style.display = 'none'; }, 500);
      }
      const pending = pendingCompanyRef.current;
      pendingCompanyRef.current = null;
      setSelectedCompany(null);
      if (pending) {
        setTimeout(() => {
          const c = _cardCompanies.find(x => x.name === pending);
          if (c) setSelectedCompany(c);
        }, 500);
      }
    };
    return () => { delete window.openCompanyPanel; delete window.onUnlockSuccess; };
  }, []);

  // ESC to close panel
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedCompany(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Body scroll lock when panel open
  useEffect(() => {
    document.body.style.overflow = selectedCompany ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedCompany]);

  // Wizard state & functions exposed to inline onclick handlers
  useEffect(() => {
    const wiz = { role: '', exp: '', sal: 20, co: '' };
    let step = 0;

    window.fyiSetDots = function() {
      for (let i = 0; i < 5; i++) {
        const dot = document.getElementById('fyi-prog-' + i);
        if (!dot) continue;
        dot.className = 'fyi-sp-dot' + (i < step ? ' done' : i === step ? ' active' : '');
      }
    };
    window.fyiSelectOpt = function(el, field, val) {
      wiz[field] = val;
      el.closest('.fyi-option-grid').querySelectorAll('.fyi-opt-btn').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      setTimeout(() => window.fyiNextStep(step), 180);
    };
    window.fyiNextStep = function(n) {
      const cur = document.getElementById('fyi-step-' + n);
      if (cur) cur.classList.remove('active');
      step = n + 1;
      const next = document.getElementById('fyi-step-' + step);
      if (next) next.classList.add('active');
      window.fyiSetDots();
    };
    window.fyiPrevStep = function(n) {
      const cur = document.getElementById('fyi-step-' + n);
      if (cur) cur.classList.remove('active');
      step = n - 1;
      const prev = document.getElementById('fyi-step-' + step);
      if (prev) prev.classList.add('active');
      window.fyiSetDots();
    };
    window.fyiUpdateSalary = function(input) {
      wiz.sal = parseInt(input.value);
      const el = document.getElementById('fyi-sal-display');
      if (el) el.textContent = input.value;
      const pct = ((input.value - 5) / (150 - 5) * 100).toFixed(1) + '%';
      input.style.setProperty('--pct', pct);
    };
    window.fyiUpdateCompanyBtn = function() {
      const val = (document.getElementById('f-co') || {}).value || '';
      const btn = document.getElementById('fyi-btn-step-3');
      if (btn) btn.disabled = !val.trim();
      wiz.co = val.trim();
    };
    window.fyiToggleVoc = function(el) { el.classList.toggle('selected'); };
    window.fyiDoSubmit = async function() {
      if (!wiz.role || !wiz.exp || !wiz.sal) { alert('Please complete all steps.'); return; }
      wiz.co = (document.getElementById('f-co') || {}).value || wiz.co || '';
      const btn = document.getElementById('fyi-unlock-btn');
      if (btn) { btn.textContent = 'Unlocking…'; btn.disabled = true; }
      const urlParams = new URLSearchParams(window.location.search);
      const source = urlParams.get('source') || 'direct';
      if (typeof window.submitSalary === 'function') window.submitSalary(wiz.role, wiz.exp, wiz.sal, wiz.co, source, '');
      try { if (typeof window.doUnlock === 'function') await window.doUnlock(wiz.role, wiz.exp, wiz.sal); } catch(e) { console.error('doUnlock error:', e); }
      const s4 = document.getElementById('fyi-step-4');
      if (s4) s4.classList.remove('active');
      const scEl = document.getElementById('fyi-submit-success');
      if (scEl) scEl.style.display = 'block';
      setTimeout(() => { const ff = document.getElementById('full-feed'); if (ff) ff.scrollIntoView({ behavior: 'smooth' }); }, 600);
    };

    return () => {
      ['fyiSetDots','fyiSelectOpt','fyiNextStep','fyiPrevStep','fyiUpdateSalary','fyiUpdateCompanyBtn','fyiToggleVoc','fyiDoSubmit'].forEach(k => delete window[k]);
    };
  }, []);

  // Typing animation
  useEffect(() => {
    const companies = [
      'Grab Vietnam','VNG Corporation','Shopee Vietnam',
      'Tiki','Momo','FPT Software','Sky Mavis',
      'Zalo','KMS Technology','Axon Active',
    ];
    let ci = 0, ti = 0, del = false, wait = false, alive = true;
    function tick() {
      if (!alive) return;
      const el = document.getElementById('typed-company');
      if (!el) { setTimeout(tick, 50); return; }
      const w = companies[ci];
      if (wait) { wait = false; del = true; setTimeout(tick, 80); return; }
      if (!del) {
        el.textContent = w.slice(0, ++ti);
        if (ti === w.length) { wait = true; setTimeout(tick, 1800); return; }
        setTimeout(tick, 80);
      } else {
        el.textContent = w.slice(0, --ti);
        if (ti === 0) { del = false; ci = (ci + 1) % companies.length; setTimeout(tick, 300); return; }
        setTimeout(tick, 45);
      }
    }
    tick();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const messages = [
      `<b class="co">Grab Vietnam</b> · Backend Engineer just shared their salary.`,
      `<b class="co">12 engineers</b> submitted new salary data in the last <b>hour</b>.`,
      `<b class="co">Shopee Vietnam</b> · Mobile Developer just shared their salary.`,
      `Data from <b>47 companies</b> including <b class="co">FPT · VNG · Tiki</b> is being updated now.`,
      `<b class="co">Sky Mavis</b> · Senior Backend Engineer just shared their salary.`,
      `<b>38 engineers</b> shared their salary and <b>unlocked full data</b> today.`,
      `<b class="co">Momo</b> · Data Engineer just shared their salary.`,
      `New salary data from <b class="co">Techcombank</b> was just added. <span class="dim">3 min ago</span>`,
      `<b class="co">VNG Corporation</b> · DevOps Engineer just shared their salary.`,
      `Someone is viewing this page right now. <b class="co">Where does your salary stand?</b>`,
    ];

    const wrap = document.getElementById('liveMsgWrap');
    if (!wrap) return;

    messages.forEach(m => {
      const div = document.createElement('div');
      div.className = 'live-msg';
      div.innerHTML = m;
      wrap.appendChild(div);
    });

    const els = wrap.querySelectorAll('.live-msg');
    let cur = 0;
    els[0].classList.add('show');

    const interval = setInterval(() => {
      const prev = cur;
      cur = (cur + 1) % els.length;
      els[prev].classList.remove('show');
      els[prev].classList.add('hide');
      setTimeout(() => els[prev].classList.remove('hide'), 500);
      els[cur].classList.add('show');
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const videos = ['/interview1.mp4', '/interview2.mp4'];
    let idx = 0;
    const vid = document.getElementById('hero-vid');
    if (!vid) return;
    const onEnded = () => {
      idx = (idx + 1) % videos.length;
      vid.src = videos[idx];
      vid.play();
    };
    vid.addEventListener('ended', onEnded);
    return () => vid.removeEventListener('ended', onEnded);
  }, []);

  const d = lbCompany ? lbData[lbCompany] : null;
  const company = d ? { name: lbCompany, ...d } : null;
  const top3 = d ? d.top3 : [];
  const listRows = d ? d.listRows : [];
  const lockedRows = d ? d.lockedRows : [];

  return (
    <>
      <Head>
        <title>FYI — Vietnam IT Salaries</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,600;0,700;0,800;0,900;1,800;1,900&family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </Head>

      <div dangerouslySetInnerHTML={{ __html: bodyHTML + '<script>' + js + '<\/script>' }} />

      {/* ── Leaderboard overlay — rendered as React JSX ── */}
      {lbCompany && d && (
        <div
          style={{ display:'flex', position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:1000, alignItems:'center', justifyContent:'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setLbCompany(null); }}
        >
          <div style={{ width:'90%', maxWidth:520, maxHeight:'85vh', overflowY:'auto', fontFamily:"'Barlow',sans-serif" }}>
            <div className="lb-gate">

              <div className="lb-head-strip" />

              {/* Head */}
              <div className="lb-head-body">
                <div className="lb-head-left">
                  <div className="lb-head-eyebrow">Salary leaderboard</div>
                  <div className="lb-head-name">
                    {company.name.split(' ')[0]} <em>{company.name.split(' ').slice(1).join(' ')}</em>
                  </div>
                  <div className="lb-head-meta">{company.type} · {company.tier} · {company.city}</div>
                  <div className="lb-head-badge">Top {company.topPct}% in Vietnam</div>
                </div>
                <div className="lb-head-right">
                  <div className="lb-stat-b">
                    <div className="lb-stat-n">{company.submissions}</div>
                    <div className="lb-stat-l">Salaries</div>
                  </div>
                  <div className="lb-stat-b">
                    <div className="lb-stat-n o">${(company.median/1000).toFixed(1)}k</div>
                    <div className="lb-stat-l">Median</div>
                  </div>
                  <div className="lb-stat-b">
                    <div className="lb-stat-n g">+{company.vsMarket}%</div>
                    <div className="lb-stat-l">vs market</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="lb-tabs">
                {['All roles','Backend','Mobile','Data','DevOps','PM'].map(tab => (
                  <div key={tab}
                    className={`lb-tab ${activeTab===tab?'active':''}`}
                    onClick={() => setActiveTab(tab)}>
                    {tab}
                  </div>
                ))}
              </div>

              {/* Top 3 cards */}
              <div className="lb-top3">
                {top3.filter(r => activeTab==='All roles' || r.role===activeTab).map((row,i) => (
                  <div key={i} className="lb-top-card">
                    <div className={`lb-tc-bg ${i===0?'r1':''}`}>0{i+1}</div>
                    <div className="lb-tc-inner">
                      <div className={`lb-tc-rank ${i===0?'r1':''}`}>
                        0{i+1}{i===0?' · Top pick':''}
                      </div>
                      <div className="lb-tc-title">{row.title}</div>
                      <div className="lb-tc-sub">{row.exp} yrs · {row.city}</div>
                      <div className="lb-tc-salary">${row.salary.toLocaleString()}</div>
                      <div className="lb-tc-bar-wrap">
                        <div className="lb-tc-bar" style={{width:`${row.barPct}%`}} />
                      </div>
                      <div className={`lb-tc-vs ${row.vsMarket>=0?'up':'dn'}`}>
                        {row.vsMarket>=0?'+':''}{row.vsMarket}% vs market
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* List rows (open) + locked */}
              <div className="lb-list-section">
                <div className="lb-list-header">More roles</div>
                {listRows.filter(r => activeTab==='All roles' || r.role===activeTab).map((row,i) => (
                  <div key={i} className="lb-list-row">
                    <div className="lb-av">{row.abbr}</div>
                    <div className="lb-row-info">
                      <div className="lb-row-title">{row.title}</div>
                      <div className="lb-row-sub">{row.exp} yrs · Full-time · {row.city}</div>
                    </div>
                    <div className="lb-row-right">
                      <div className="lb-row-sal">${row.salary.toLocaleString()}</div>
                      <div className={`lb-row-vs ${row.vsMarket>=0?'up':'dn'}`}>
                        {row.vsMarket>=0?'+':''}{row.vsMarket}% vs market
                      </div>
                    </div>
                  </div>
                ))}
                {lockedRows.filter(r => activeTab==='All roles' || r.role===activeTab).map((row,i) => (
                  <div key={i} className="lb-list-row">
                    <div className="lb-av locked">??</div>
                    <div className="lb-row-info">
                      <div className="lb-row-title blurred">{row.title}</div>
                      <div className="lb-row-sub blurred">{row.exp} yrs · {row.city}</div>
                    </div>
                    <div className="lb-row-right">
                      <div className="lb-row-sal blurred">${row.salary.toLocaleString()}</div>
                      <div className={`lb-row-vs blurred ${row.vsMarket>=0?'up':'dn'}`}>
                        {row.vsMarket>=0?'+':''}{row.vsMarket}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="lb-cta-fade" />
              <div className="lb-cta-area">
                <div className="lb-cta-sep">
                  <div className="lb-cta-line" />
                  <div className="lb-cta-sep-text"><b>{lockedRows.length} more roles</b> locked</div>
                  <div className="lb-cta-line" />
                </div>
                <button className="lb-cta-btn"
                  onClick={() => { setLbCompany(null); document.getElementById('submit')?.scrollIntoView({behavior:'smooth'}); }}>
                  See where you stand →
                </button>
                <div className="lb-cta-sub">2 minutes · anonymous · no login</div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Company Panel Overlay */}
      <div
        onClick={() => setSelectedCompany(null)}
        style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.45)',
          zIndex:200, opacity: selectedCompany ? 1 : 0,
          pointerEvents: selectedCompany ? 'all' : 'none',
          transition:'opacity .32s',
        }}
      />

      {/* Company Slide Panel */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'clamp(480px, 50vw, 800px)',
        background:'white', zIndex:201, overflowY:'auto',
        transform: selectedCompany ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform 0.32s cubic-bezier(0.22, 0.9, 0.36, 1)',
        fontFamily:"'Barlow', sans-serif",
      }}>
        {selectedCompany && (() => {
          const sc = selectedCompany;
          const rank = sc.open ? _cardCompanies.filter(x=>x.open).findIndex(x=>x.name===sc.name)+1 : null;
          const heroBg = `linear-gradient(160deg, ${sc.color}dd 0%, ${sc.color}88 100%)`;
          return (
            <>
              {/* Hero */}
              <div style={{height:'200px', position:'relative', overflow:'hidden', background:heroBg}}>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.35) 0%,transparent 60%)'}}/>
                {/* Logo watermark */}
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <img src={`https://www.google.com/s2/favicons?domain=${sc.domain}&sz=256`} alt={sc.name}
                    style={{width:'88px',height:'88px',objectFit:'contain',borderRadius:'16px',
                      background:'rgba(255,255,255,0.18)',padding:'16px',opacity:0.5}}
                    onError={e=>e.target.style.display='none'} />
                </div>
                {/* Top bar */}
                <div style={{position:'absolute',top:0,left:0,right:0,padding:'16px 20px',
                  display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:2}}>
                  <img src={`https://www.google.com/s2/favicons?domain=${sc.domain}&sz=256`} alt={sc.name}
                    style={{width:'32px',height:'32px',objectFit:'contain',borderRadius:'6px',background:'rgba(255,255,255,0.9)',padding:'4px'}}
                    onError={e=>e.target.style.display='none'} />
                  <div onClick={() => setSelectedCompany(null)}
                    style={{width:'32px',height:'32px',borderRadius:'50%',
                      background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.25)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      cursor:'pointer',color:'white',fontSize:'15px',lineHeight:1}}>✕</div>
                </div>
              </div>

              {/* Body */}
              <div style={{padding:'20px 22px'}}>
                {/* Eyebrow */}
                <div style={{fontSize:'11px',fontWeight:700,color:'#FF6200',letterSpacing:'.06em',textTransform:'uppercase',marginBottom:'6px'}}>
                  {rank ? `#${rank} · ` : ''}{sc.city}
                </div>
                <div style={{fontSize:'24px',fontWeight:900,color:'#111',letterSpacing:'-.03em',marginBottom:'10px'}}>
                  {sc.name}
                </div>
                {/* Tags */}
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'20px'}}>
                  {(sc.open||isUnlocked) && <span style={{fontSize:'11px',fontWeight:700,padding:'4px 11px',borderRadius:'100px',background:'rgba(255,98,0,0.12)',color:'#FF6200'}}>Top {sc.topPct}%</span>}
                  <span style={{fontSize:'11px',fontWeight:600,padding:'4px 11px',borderRadius:'100px',background:'#f2f0ec',color:'#888'}}>{sc.tier}</span>
                  <span style={{fontSize:'11px',fontWeight:600,padding:'4px 11px',borderRadius:'100px',background:'#f2f0ec',color:'#888'}}>{sc.category}</span>
                </div>

                {/* Stats row */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'20px'}}>
                  {[
                    {v: (sc.open||isUnlocked) ? `${(sc.median/1000).toFixed(1)}k` : '???', l:'Median salary'},
                    {v: sc.submissions, l:'Submissions'},
                    {v: (sc.open||isUnlocked) ? `${(sc.top10/1000).toFixed(1)}k` : '???', l:'Top 10%'},
                  ].map((o,i) => (
                    <div key={i} style={{background:'#F7F4EF',borderRadius:'12px',padding:'13px 10px',textAlign:'center'}}>
                      <div style={{fontSize:'15px',fontWeight:800,color:'#FF6200',lineHeight:1,marginBottom:'4px',
                        filter:(sc.open||isUnlocked)?'none':'blur(6px)',userSelect:(sc.open||isUnlocked)?'auto':'none'}}>
                        {o.v}
                      </div>
                      <div style={{fontSize:'10px',color:'#A09890'}}>{o.l}</div>
                    </div>
                  ))}
                </div>

                {/* Salary by role */}
                {sc.salaryByRole.length > 0 && (
                  <>
                    <div style={{fontSize:'9px',letterSpacing:'.16em',textTransform:'uppercase',color:'#A09890',marginBottom:'10px'}}>Salary by role</div>
                    {sc.salaryByRole.map((row, i) => (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',
                        padding:'10px 0',borderBottom:'1px solid #f5f3ef'}}>
                        <div style={{fontSize:'15px',width:'22px',textAlign:'center',flexShrink:0,fontFamily:'monospace'}}>
                          {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',fontWeight:700,color:'#111'}}>{row.role}</div>
                          <div style={{fontSize:'11px',color:'#A09890',marginTop:'1px'}}>{row.experience}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,width:'90px'}}>
                          <div style={{height:'2px',background:'#f0ede6',borderRadius:'100px',overflow:'hidden',marginBottom:'4px'}}>
                            <div style={{height:'100%',width:`${row.barPercent}%`,background:'#FF6200',borderRadius:'100px'}}/>
                          </div>
                          <div style={{fontSize:'13px',fontWeight:800,color:'#FF6200'}}>
                            {row.salaryVND}M ₫
                          </div>
                          <div style={{fontSize:'10px',color:'#A09890'}}>
                            ≈ ${(row.salaryVND * 43 / 1000).toFixed(1)}k
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* CTA */}
                <div style={{background:'#FFF0E6',borderRadius:'14px',padding:'18px',marginTop:'20px',marginBottom:'8px'}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'#111',lineHeight:1.5,marginBottom:'14px'}}>
                    {(sc.open||isUnlocked)
                      ? `See where you stand at ${sc.name}`
                      : 'Submit your salary to unlock full data'}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCompany(null);
                      setTimeout(() => document.getElementById('submit')?.scrollIntoView({behavior:'smooth'}), 350);
                    }}
                    style={{width:'100%',background:'#FF6200',color:'black',fontSize:'14px',fontWeight:800,
                      padding:'14px',borderRadius:'10px',border:'none',cursor:'pointer',textAlign:'center',display:'block'}}>
                    {(sc.open||isUnlocked) ? 'Am I Underpaid? →' : '🔓 Submit & Unlock →'}
                  </button>
                  <div style={{textAlign:'center',fontSize:'11px',color:'#A09890',marginTop:'8px'}}>
                    2 min · anonymous · no login
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </>
  );
}
