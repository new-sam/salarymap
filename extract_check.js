const fs = require('fs');
const src = fs.readFileSync('pages/index.js', 'utf8');
const marker = 'const js = `';
const jsStart = src.indexOf(marker) + marker.length;
let end = jsStart;
while(end < src.length) {
  if(src[end] === '`') break;
  end++;
}
const jsCode = src.slice(jsStart, end);
fs.writeFileSync('/tmp/extracted_js.js', jsCode);
console.log('JS length:', jsCode.length);
console.log('Has fyiSelectOpt:', jsCode.includes('fyiSelectOpt'));
console.log('Has _fyiStep:', jsCode.includes('_fyiStep'));
console.log('Last 200 chars:', JSON.stringify(jsCode.slice(-200)));
