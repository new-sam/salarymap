const fs = require('fs');
let c = fs.readFileSync('pages/index.js', 'utf8');

// ── 1: Add Barlow to Google Fonts link ──
c = c.replace(
  'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,600;0,700;0,800;0,900;1,800;1,900&family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500&display=swap'
);
console.log('✓ Barlow font added:', c.includes('Barlow'));

// ── 2: Replace old submit section CSS with new fyi- CSS ──
// Find old CSS (submit-section block)
const OLD_CSS_MARKER = '/* SUBMIT SECTION */';
const MOBILE_MARKER = '@media (max-width: 768px) {';
const oldCSSStart = c.indexOf(OLD_CSS_MARKER);
const mediaCSSStart = c.indexOf(MOBILE_MARKER, oldCSSStart);
if (oldCSSStart === -1) { console.log('CSS marker not found'); process.exit(1); }

const NEW_CSS = `/* FYI SUBMIT SECTION */
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
.fyi-voc-checkbox::after { content: '\u2713'; color: #ffffff; opacity: 0; }
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
.fyi-anon-note::before { content: '\ud83d\udd12'; font-size: 13px; }
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
.fyi-ss-cta:hover { opacity: 0.85; }`;

c = c.slice(0, oldCSSStart) + NEW_CSS + '\n' + c.slice(mediaCSSStart);
console.log('✓ CSS replaced');

// Update mobile @media for new classes
const mIdx = c.indexOf(MOBILE_MARKER);
const oldMobileSubmit = '\n  .submit-grid { grid-template-columns:1fr; gap:0; }\n  .submit-left { display:none; }\n  .section-inner { padding:0 16px; }\n  .submit-section { padding:48px 0 0; }\n  .step-form { border-radius:8px; padding:24px 20px; }\n  .option-grid.cols-3 { grid-template-columns:repeat(3,1fr); }\n  .option-grid.cols-2 { grid-template-columns:1fr 1fr; }\n  .ss-num { font-size:40px; }\n  footer { padding:24px 16px; }';
const newMobileSubmit = '\n  .fyi-submit-section { padding: 60px 24px; }\n  .fyi-submit-grid { grid-template-columns: 1fr; gap: 40px; }\n  footer { padding:24px 16px; }';
if (c.includes(oldMobileSubmit)) {
  c = c.replace(oldMobileSubmit, newMobileSubmit);
  console.log('✓ Mobile CSS updated');
}

// ── 3: Replace HTML ──
const submitSectionStart = c.indexOf('\n<section class="submit-section"');
const fullFeedStart = c.indexOf('<div id="full-feed">');
if (submitSectionStart === -1 || fullFeedStart === -1) { console.log('HTML bounds not found'); process.exit(1); }

const NEW_HTML = `
<section class="fyi-submit-section" id="submit">
  <div class="fyi-submit-inner">
    <div class="fyi-submit-grid">

      <div class="fyi-submit-left">
        <h2>Submit your salary.<br><span class="hl">Unlock everything.</span></h2>
        <p>30 seconds. No name. No email. 134 companies unlocked the moment you share.</p>
        <div class="fyi-sub-badges">
          <div class="fyi-sb-badge">100% anonymous \u00b7 no account needed</div>
          <div class="fyi-sb-badge">Never shown individually, only aggregated</div>
          <div class="fyi-sb-badge">Never sold or shared with companies</div>
          <div class="fyi-sb-badge">Instant unlock \u00b7 134 companies</div>
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
              <span class="fyi-ob-icon">\u2699\ufe0f</span><span class="fyi-ob-label">Backend</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Frontend')">
              <span class="fyi-ob-icon">\ud83c\udfa8</span><span class="fyi-ob-label">Frontend</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Fullstack')">
              <span class="fyi-ob-icon">\ud83d\udd27</span><span class="fyi-ob-label">Fullstack</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Mobile')">
              <span class="fyi-ob-icon">\ud83d\udcf1</span><span class="fyi-ob-label">Mobile</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Data Engineer')">
              <span class="fyi-ob-icon">\ud83d\udcca</span><span class="fyi-ob-label">Data Eng</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','DevOps / Cloud')">
              <span class="fyi-ob-icon">\u2601\ufe0f</span><span class="fyi-ob-label">DevOps</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','UI/UX')">
              <span class="fyi-ob-icon">\u270f\ufe0f</span><span class="fyi-ob-label">UI/UX</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','PM')">
              <span class="fyi-ob-icon">\ud83d\uddfa\ufe0f</span><span class="fyi-ob-label">Product</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'role','Marketer')">
              <span class="fyi-ob-icon">\ud83d\udce3</span><span class="fyi-ob-label">Marketing</span>
            </button>
          </div>
          <div class="fyi-step-nav">
            <button class="fyi-btn-primary" onclick="fyiNextStep(0)" disabled id="fyi-btn-step-0">Next \u2192</button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-1">
          <div class="fyi-step-question">Years of experience?</div>
          <div class="fyi-step-sub">Total years in the industry, not just at your current company.</div>
          <div class="fyi-option-grid cols-2">
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','Under 1 year')">
              <span class="fyi-ob-label">Under 1 year</span><span class="fyi-ob-sub">Just getting started</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','1\u20132 yrs')">
              <span class="fyi-ob-label">1 \u2013 2 years</span><span class="fyi-ob-sub">Junior level</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','3\u20134 yrs')">
              <span class="fyi-ob-label">3 \u2013 4 years</span><span class="fyi-ob-sub">Mid level</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','5\u20137 yrs')">
              <span class="fyi-ob-label">5 \u2013 7 years</span><span class="fyi-ob-sub">Senior level</span>
            </button>
            <button class="fyi-opt-btn" onclick="fyiSelectOpt(this,'exp','8+ yrs')" style="grid-column:1/-1">
              <span class="fyi-ob-label">8+ years</span><span class="fyi-ob-sub">Lead / Principal</span>
            </button>
          </div>
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(1)">\u2190 Back</button>
            <button class="fyi-btn-primary" onclick="fyiNextStep(1)" disabled id="fyi-btn-step-1">Next \u2192</button>
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
            <button class="fyi-btn-back" onclick="fyiPrevStep(2)">\u2190 Back</button>
            <button class="fyi-btn-primary" onclick="fyiNextStep(2)" id="fyi-btn-step-2">Next \u2192</button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-3">
          <div class="fyi-step-question">Where do you work?</div>
          <div class="fyi-step-sub">Only used to group salary data \u2014 never shown individually.</div>
          <input type="text" class="fyi-form-input" id="f-co"
            placeholder="e.g. VNG, Grab, FPT Software\u2026"
            oninput="fyiUpdateCompanyBtn()" autocomplete="off">
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(3)">\u2190 Back</button>
            <button class="fyi-btn-primary" onclick="fyiNextStep(3)" disabled id="fyi-btn-step-3">Next \u2192</button>
          </div>
        </div>

        <div class="fyi-step-content" id="fyi-step-4">
          <div class="fyi-step-question">One last thing</div>
          <div class="fyi-step-sub">What would be most useful for you? (Pick all that apply)</div>
          <div class="fyi-voc-options">
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">\ud83c\udfe2 See salaries at more companies</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">\ud83d\udcbc See more roles and job functions</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">\ud83d\udcc5 Compare with people at my experience level</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">\ud83d\ude80 Find out where I can earn more</div>
            </div>
            <div class="fyi-voc-opt" onclick="fyiToggleVoc(this)">
              <div class="fyi-voc-checkbox"></div>
              <div class="fyi-voc-label">\ud83c\udfaf Get matched with recruiters at top-paying companies</div>
            </div>
          </div>
          <div class="fyi-step-nav">
            <button class="fyi-btn-back" onclick="fyiPrevStep(4)">\u2190 Back</button>
            <button class="fyi-btn-primary" id="fyi-unlock-btn" onclick="fyiDoSubmit()">Unlock all 134 companies \u2192</button>
          </div>
          <div class="fyi-anon-note">Your salary is never linked to your name or identity.</div>
        </div>

        <div class="fyi-submit-success" id="fyi-submit-success">
          <div class="fyi-ss-icon">\ud83c\udf89</div>
          <div class="fyi-ss-title">You're in. Everything's unlocked.</div>
          <p class="fyi-ss-sub">All 134 companies are now visible below. Thanks for making the data better for everyone in Vietnam.</p>
          <button class="fyi-ss-cta" onclick="document.getElementById('full-feed').scrollIntoView({behavior:'smooth'})">See all company salaries \u2193</button>
        </div>

        <input type="hidden" id="f-role">
        <input type="hidden" id="f-exp">
        <input type="hidden" id="f-sal">

        <div class="result-block" id="result-block">
          <div><div class="rb-ctx" id="rb-ctx">Backend \u00b7 3\u20134 yrs</div><div class="rb-pct" id="rb-pct">Top 38%</div></div>
          <div class="rb-sep"></div>
          <div class="rb-bwrap">
            <div class="rb-bl"><span id="rl">You</span><span id="rm">Median</span><span id="rr">Top 10%</span></div>
            <div class="rb-track"><div class="rb-fill" id="rb-fill" style="width:0%"></div></div>
          </div>
        </div>
        <div class="uline" id="uline">\u2713 UNLOCKED \u2014 134 companies now visible below</div>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="footer-brand">FYI <span>\u2014</span> For Your Information</div>
  <div class="footer-meta">Vietnam IT Salary Intelligence \u00b7 100% Anonymous \u00b7 Updated daily</div>
</footer>

`;

c = c.slice(0, submitSectionStart) + NEW_HTML + c.slice(fullFeedStart);
console.log('✓ HTML replaced');

// ── 4: Replace wizard JS with fyi- prefixed JS ──
const wizJSStart = c.indexOf('\nconst _wiz=');
const unlockFnIdx = c.indexOf('\nasync function unlock(){');
if (wizJSStart === -1 || unlockFnIdx === -1) { console.log('JS bounds not found'); process.exit(1); }

const NEW_JS = `
const _fyiWiz={role:'',exp:'',sal:20,co:''};
let _fyiStep=0;
function fyiSetDots(){
  for(let i=0;i<5;i++){
    const dot=document.getElementById('fyi-prog-'+i);
    if(!dot) continue;
    dot.className='fyi-sp-dot'+(i<_fyiStep?' done':i===_fyiStep?' active':'');
  }
}
function fyiSelectOpt(el,field,val){
  _fyiWiz[field]=val;
  el.closest('.fyi-option-grid').querySelectorAll('.fyi-opt-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  const btn=document.getElementById('fyi-btn-step-'+_fyiStep);
  if(btn) btn.disabled=false;
}
function fyiNextStep(n){
  document.getElementById('fyi-step-'+n).classList.remove('active');
  _fyiStep=n+1;
  const next=document.getElementById('fyi-step-'+_fyiStep);
  if(next) next.classList.add('active');
  fyiSetDots();
}
function fyiPrevStep(n){
  document.getElementById('fyi-step-'+n).classList.remove('active');
  _fyiStep=n-1;
  const prev=document.getElementById('fyi-step-'+_fyiStep);
  if(prev) prev.classList.add('active');
  fyiSetDots();
}
function fyiUpdateSalary(input){
  _fyiWiz.sal=parseInt(input.value);
  const el=document.getElementById('fyi-sal-display');
  if(el) el.textContent=input.value;
  const pct=((input.value-5)/(150-5)*100).toFixed(1)+'%';
  input.style.setProperty('--pct',pct);
}
function fyiUpdateCompanyBtn(){
  const val=(document.getElementById('f-co')||{}).value||'';
  const btn=document.getElementById('fyi-btn-step-3');
  if(btn) btn.disabled=!val.trim();
  _fyiWiz.co=val.trim();
}
function fyiToggleVoc(el){ el.classList.toggle('selected'); }
async function fyiDoSubmit(){
  if(!_fyiWiz.role||!_fyiWiz.exp||!_fyiWiz.sal){alert('Please complete all steps.');return;}
  _fyiWiz.co=(document.getElementById('f-co')||{}).value||_fyiWiz.co||'';
  const btn=document.getElementById('fyi-unlock-btn');
  if(btn){btn.textContent='Unlocking\u2026';btn.disabled=true;}
  const urlParams=new URLSearchParams(window.location.search);
  const source=urlParams.get('source')||'direct';
  submitSalary(_fyiWiz.role,_fyiWiz.exp,_fyiWiz.sal,_fyiWiz.co,source,'');
  if(await doUnlock(_fyiWiz.role,_fyiWiz.exp,_fyiWiz.sal)){
    document.getElementById('fyi-step-4').classList.remove('active');
    const sc=document.getElementById('fyi-submit-success');
    if(sc) sc.style.display='block';
    setTimeout(()=>document.getElementById('full-feed').scrollIntoView({behavior:'smooth'}),600);
  }
}
`;

c = c.slice(0, wizJSStart) + NEW_JS + c.slice(unlockFnIdx);
console.log('✓ JS replaced');

fs.writeFileSync('pages/index.js', c, 'utf8');
console.log('\nDone. Length:', c.length);

const { execSync } = require('child_process');
try {
  execSync('node --check pages/index.js', { encoding: 'utf8' });
  console.log('✓ Syntax OK');
} catch(e) {
  console.log('✗ Syntax error:', e.stderr || e.message);
}
