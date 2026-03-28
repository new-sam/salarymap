const fs = require('fs');
let c = fs.readFileSync('pages/index.js', 'utf8');

// ── FIX 1: tabs.innerHTML - use data attributes to avoid quote escaping issue ──
const badTabs = `tabs.innerHTML=d.tabs.map(function(t,i){return '<div class="lb-tab'+(i===0?' active':'')+'\" onclick=\"lbTab(this,''+t+'',''+co+'')\">'+t+'</div>';}).join('');`;
const goodTabs = `tabs.innerHTML=d.tabs.map(function(t,i){var cls='lb-tab'+(i===0?' active':'');return '<div class="'+cls+'" data-tab="'+t+'" data-co="'+co+'" onclick="lbTab(this,this.dataset.tab,this.dataset.co)">'+t+'</div>';}).join('');`;

if (c.includes(badTabs)) {
  c = c.replace(badTabs, goodTabs);
  console.log('✓ Fixed tabs.innerHTML');
} else {
  // Try alternate form
  const alt = "tabs.innerHTML=d.tabs.map(function(t,i){return '<div class=\"lb-tab'+(i===0?' active':'')+'\" onclick=\"lbTab(this,''+t+'',''+co+'')\">'+t+'</div>';}).join('');";
  if (c.includes(alt)) {
    const goodTabs2 = "tabs.innerHTML=d.tabs.map(function(t,i){var cls='lb-tab'+(i===0?' active':'');return '<div class=\"'+cls+'\" data-tab=\"'+t+'\" data-co=\"'+co+'\" onclick=\"lbTab(this,this.dataset.tab,this.dataset.co)\">'+t+'</div>';}).join('');";
    c = c.replace(alt, goodTabs2);
    console.log('✓ Fixed tabs.innerHTML (alt)');
  } else {
    console.log('✗ Could not find tabs.innerHTML pattern');
    // Show what's around that area
    const idx = c.indexOf('tabs.innerHTML=d.tabs');
    if (idx > -1) console.log('Raw:', JSON.stringify(c.slice(idx, idx + 200)));
  }
}

// ── FIX 2: rel.innerHTML - same issue with coSelect ──
const relIdx = c.indexOf('rel.innerHTML=d.related.map(function(r){return');
if (relIdx > -1) {
  const relEnd = c.indexOf(';', relIdx) + 1;
  const badRel = c.slice(relIdx, relEnd);
  console.log('Found rel line:', JSON.stringify(badRel.slice(0, 100)));

  const goodRel = "rel.innerHTML=d.related.map(function(r){return '<div class=\"lb-related-chip\" data-co=\"'+r+'\" onclick=\"coSelect(this.dataset.co)\">'+r+'</div>';}).join('');";
  c = c.slice(0, relIdx) + goodRel + c.slice(relEnd);
  console.log('✓ Fixed rel.innerHTML');
}

// ── FIX 3: lbTab function - fix to accept tab and co as direct args (already ok) ──
// The lbTab function receives (el, tab, co) - this is fine since we now pass dataset values

// ── FIX 4: resetAuto / goSlide - remove the broken carousel reset ──
const resetAuto = "let autoT; function resetAuto(){ clearInterval(autoT); autoT=setInterval(()=>goSlide((cur+1)%4),5000); } resetAuto();\r\n";
if (c.includes(resetAuto)) {
  c = c.replace(resetAuto, '');
  console.log('✓ Removed resetAuto');
} else {
  // try without \r
  const resetAuto2 = "let autoT; function resetAuto(){ clearInterval(autoT); autoT=setInterval(()=>goSlide((cur+1)%4),5000); } resetAuto();\n";
  if (c.includes(resetAuto2)) {
    c = c.replace(resetAuto2, '');
    console.log('✓ Removed resetAuto (unix)');
  } else {
    console.log('✗ resetAuto not found, checking...');
    const idx = c.indexOf('resetAuto');
    if (idx > -1) console.log('Found resetAuto at:', idx, JSON.stringify(c.slice(idx-5, idx+60)));
  }
}

// ── FIX 5: Hero background image ──
const heroSection = '<section class="hero">';
const heroIdx = c.indexOf(heroSection);
console.log('Hero section at:', heroIdx);

if (heroIdx > -1) {
  // Check if already has background
  const heroSnippet = c.slice(heroIdx, heroIdx + 500);
  if (heroSnippet.includes('photo-1506905925346') || heroSnippet.includes('unsplash.com/photo-1506')) {
    console.log('✓ Hero background already present');
  } else {
    const bgHTML = '<section class="hero">\n  <div style="position:absolute;inset:0;background:url(\'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=60&fit=crop&crop=center\') center/cover no-repeat;filter:brightness(.28);z-index:0;"></div>\n  <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(12,12,11,.88) 0%,rgba(12,12,11,.4) 60%,transparent 100%);z-index:1;"></div>';
    c = c.replace(heroSection, bgHTML);
    console.log('✓ Added hero background image');
  }
}

// ── FIX 6: Typing animation - verify tick() function is present ──
if (c.includes('function tick()')) {
  console.log('✓ tick() function present');
  // Check it gets fresh element
  const tickIdx = c.indexOf('function tick()');
  const tickSnippet = c.slice(tickIdx, tickIdx + 200);
  console.log('tick snippet:', JSON.stringify(tickSnippet.slice(0, 150)));
} else {
  console.log('✗ tick() not found - need to add typing animation');
}

// ── Write file ──
fs.writeFileSync('pages/index.js', c, 'utf8');
console.log('\nDone! File length:', c.length);

// ── Verify JS syntax ──
const exportIdx = c.indexOf('\nexport default function Home');
const jsStart = c.indexOf('const js = \`');
const jsEnd = c.lastIndexOf('\`', exportIdx - 1);
const rawJs = c.slice(jsStart, jsEnd + 1);
try {
  const result = eval(rawJs + ';js');
  fs.writeFileSync('check_js_temp.js', result);
  console.log('JS eval OK, length:', result.length);
} catch(e) {
  console.log('JS eval error:', e.message);
}
