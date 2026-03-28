const fs = require('fs');
let c = fs.readFileSync('pages/index.js', 'utf8');

// 1. Remove trust mobile CSS lines
c = c.replace('\n  .trust-roadmap { grid-template-columns:1fr !important; }', '');
c = c.replace('\n  .trust-stats { grid-template-columns:repeat(2,1fr) !important; }', '');
c = c.replace('\n  .trust-privacy { grid-template-columns:1fr !important; }', '');
c = c.replace('\n  .trust-section { padding:60px 0 !important; }', '');
c = c.replace('\n  .trust-inner { padding:0 16px !important; }', '');

// 2. Remove trust-interviews mobile CSS
c = c.replace('\n  .trust-interviews { grid-template-columns:1fr !important; }', '');

// 3. Add new privacy CSS (insert before .cards-bg)
const newCSS = `
.privacy-section { padding: 80px 40px; max-width: 960px; margin: 0 auto; }
.privacy-headline { font-size: 48px; font-weight: 700; line-height: 1.15; margin-bottom: 12px; }
.privacy-headline em { color: var(--orange); font-style: normal; }
.privacy-sub { font-size: 15px; color: var(--dim); margin-bottom: 36px; line-height: 1.7; }
.lock-diagram { background: #0f0f0f; border: 1px solid #1a1a1a; border-radius: 18px; padding: 36px 32px; margin-bottom: 14px; display: flex; align-items: center; }
.lock-input-side { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.lock-input-label { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #555; margin-bottom: 2px; }
.lock-input-item { background: #161616; border: 1px solid #222; border-radius: 10px; padding: 13px 16px; display: flex; align-items: center; gap: 12px; }
.lock-i-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--orange); flex-shrink: 0; }
.lock-i-label { font-size: 13px; color: #bbb; }
.lock-i-val { font-size: 13px; color: #666; margin-left: auto; font-family: monospace; filter: blur(5px); user-select: none; }
.lock-arrow { padding: 0 24px; display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; }
.lock-arrow-line { width: 36px; height: 1px; background: linear-gradient(to right, #2a2a2a, #444); }
.lock-arrow-head { color: #444; font-size: 14px; margin-top: -6px; }
.lock-box { width: 88px; height: 88px; flex-shrink: 0; background: #161616; border: 1px solid #2a2a2a; border-radius: 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
.lock-box-emoji { font-size: 32px; line-height: 1; }
.lock-box-label { font-size: 8px; letter-spacing: .16em; text-transform: uppercase; color: #444; }
.lock-output-side { flex: 1; }
.lock-output-box { background: #161616; border: 1px solid #222; border-radius: 12px; padding: 18px; }
.lock-output-tag { font-size: 9px; letter-spacing: .18em; text-transform: uppercase; color: var(--orange); margin-bottom: 10px; }
.lock-output-bar-label { font-size: 11px; color: #888; margin-bottom: 6px; }
.lock-output-bar-wrap { height: 7px; background: #222; border-radius: 100px; overflow: hidden; margin-bottom: 8px; }
.lock-output-bar-fill { height: 100%; border-radius: 100px; background: var(--orange); width: 72%; }
.lock-output-range { font-size: 13px; color: #ccc; font-weight: 700; }
.lock-output-sub { font-size: 11px; color: #555; margin-top: 3px; }
.privacy-final { background: #111; border-radius: 14px; padding: 28px 32px; display: flex; align-items: center; gap: 20px; }
.privacy-final-icon { font-size: 38px; flex-shrink: 0; }
.privacy-final-title { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.privacy-final-main { font-size: 22px; font-weight: 700; }
.privacy-final-main em { color: var(--orange); font-style: normal; }
.privacy-final-side { font-size: 22px; font-weight: 700; color: #444; }
@media (max-width:768px) {
  .privacy-section { padding: 60px 20px; }
  .privacy-headline { font-size: 34px; }
  .lock-diagram { flex-direction: column; gap: 16px; }
  .lock-arrow { flex-direction: row; padding: 0; }
  .lock-box { width: 64px; height: 64px; }
}`;

c = c.replace('.cards-bg { background: #f0ede8; }', newCSS + '\n.cards-bg { background: #f0ede8; }');

// 4. Replace the trust section HTML with new privacy section
const oldSection = c.slice(c.indexOf('<section class="trust-section"'), c.indexOf('</section>', c.indexOf('<section class="trust-section"')) + '</section>'.length);

const newSection = `<section id="privacy" style="background:#0c0c0b; padding:0;">
  <div class="privacy-section">
    <h2 class="privacy-headline">This is<br><em>completely</em> anonymous.</h2>
    <p class="privacy-sub">We don't know who you are. We just know what engineers in Vietnam are earning.</p>

    <div class="lock-diagram">
      <div class="lock-input-side">
        <div class="lock-input-label">What you submit</div>
        <div class="lock-input-item"><div class="lock-i-dot"></div><span class="lock-i-label">Salary</span><span class="lock-i-val">$2,800</span></div>
        <div class="lock-input-item"><div class="lock-i-dot"></div><span class="lock-i-label">Role</span><span class="lock-i-val">Backend</span></div>
        <div class="lock-input-item"><div class="lock-i-dot"></div><span class="lock-i-label">Experience</span><span class="lock-i-val">4 yrs</span></div>
        <div class="lock-input-item"><div class="lock-i-dot"></div><span class="lock-i-label">Company</span><span class="lock-i-val">Grab</span></div>
      </div>
      <div class="lock-arrow"><div class="lock-arrow-line"></div><div class="lock-arrow-head">→</div></div>
      <div class="lock-box"><div class="lock-box-emoji">🔐</div><div class="lock-box-label">Mixed in</div></div>
      <div class="lock-arrow"><div class="lock-arrow-line"></div><div class="lock-arrow-head">→</div></div>
      <div class="lock-output-side">
        <div class="lock-output-box">
          <div class="lock-output-tag">What everyone sees</div>
          <div class="lock-output-bar-label">Backend · 4–6 yrs · Grab</div>
          <div class="lock-output-bar-wrap"><div class="lock-output-bar-fill"></div></div>
          <div class="lock-output-range">$2,400 — $3,800</div>
          <div class="lock-output-sub">Based on 35 salaries</div>
        </div>
      </div>
    </div>

    <div class="privacy-final">
      <div class="privacy-final-icon">🙈</div>
      <div class="privacy-final-title">
        <span class="privacy-final-main">We <em>can't</em> identify you.</span>
        <span class="privacy-final-side">Even if we tried.</span>
      </div>
    </div>
  </div>
</section>`;

c = c.replace(oldSection, newSection);

fs.writeFileSync('pages/index.js', c, 'utf8');
console.log('Done. Length:', c.length);
console.log('Has privacy-section:', c.includes('privacy-section'));
console.log('Has lock-diagram:', c.includes('lock-diagram'));
console.log('Old trust-section gone:', !c.includes('"trust-section"'));
