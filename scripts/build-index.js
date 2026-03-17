const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('C:/Users/slsvm/OneDrive/Desktop/salary_map.html', 'utf8');

// CSS
const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const css = cssMatch ? cssMatch[1] : '';

// Body HTML
const bodyStart = html.indexOf('<body>') + 6;
const scriptStart = html.lastIndexOf('<script>');
const body = html.slice(bodyStart, scriptStart).trim();

// JS
const jsEnd = html.lastIndexOf('</script>');
const js = html.slice(scriptStart + 8, jsEnd).trim();

// Escape backticks and template literal chars
function esc(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const out = `import Head from 'next/head';
import Script from 'next/script';

const css = \`${esc(css)}\`;

const bodyHTML = \`${esc(body)}\`;

const js = \`${esc(js)}\`;

export default function Home() {
  return (
    <>
      <Head>
        <title>SalaryMap.vn</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: bodyHTML }} />
      <Script
        id="page-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: js }}
      />
    </>
  );
}
`;

const outPath = path.join(__dirname, '..', 'pages', 'index.js');
fs.writeFileSync(outPath, out);
console.log('Done. index.js size:', (out.length / 1024 / 1024).toFixed(2), 'MB');
