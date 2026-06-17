// iOS app-launch announcement email — render / test-send / broadcast.
// Usage:
//   node scripts/launch-email.mjs render ko        → writes launch-email-ko.html (browser preview)
//   node scripts/launch-email.mjs test ko you@x.com → sends ONE test email via Resend
//   node scripts/launch-email.mjs render vi        → (after copy approved) Vietnamese preview
import { Resend } from 'resend';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const APP_URL = 'https://apps.apple.com/app/id6778311550'; // region-neutral → opens user's local store
const LOGO_URL = 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/job-images/launch/fyi-logo.png';

// --- copy (ko draft; vi to be translated after approval) --------------------
const COPY = {
  ko: {
    subject: '📱 salary-fyi iOS 앱이 출시됐어요!',
    preheader: '채용 지원 알림부터 회사 커뮤니티까지 — 이제 앱에서 더 편하게.',
    brand: 'FYI',
    h1: 'iOS 앱이 나왔어요 🎉',
    intro: '안녕하세요, <strong>salary-fyi</strong>입니다.<br>웹으로 가입해주신 여러분께 반가운 소식을 전해요. 드디어 iOS 앱이 App Store에 출시됐습니다!',
    features: [
      ['🔔', '지원 현황을 알림으로', '채용 지원이 어디까지 진행됐는지 푸시 알림으로 바로 확인하세요.'],
      ['⭐', '관심 회사 연봉 알림', '관심 등록한 회사에 새 연봉 정보가 올라오면 바로 알려드려요.'],
      ['💬', '회사 커뮤니티', '궁금한 회사·연봉·면접 후기를 커뮤니티에서 자유롭게 묻고 답하세요.'],
      ['📊', '연봉 · 리뷰 정보', '실제 연봉 데이터와 회사 리뷰를 손안에서 바로 확인하세요.'],
    ],
    highlight: {
      tag: 'NEW',
      title: '✨ 이력서 올리면 합격에 가까운 이력서로',
      body: '이력서를 업로드하면, 현직 채용 담당자와 기업 C레벨이 직접 개발한 AI가 채용자의 눈에 직관적이고 매력적으로 보이도록 다듬어드려요. 더 나은 이력서로 새로운 채용 기회를 받아보세요.',
    },
    cta: 'App Store에서 다운로드',
    outro: '앱에서 더 편하게 만나요!',
    footerWhy: '이 메일은 salary-fyi에 가입하신 분께 신규 iOS 앱 출시를 안내드리기 위해 발송됐습니다.',
    unsub: '수신거부',
  },
  vi: {
    subject: '📱 Ứng dụng iOS của salary-fyi đã ra mắt!',
    preheader: 'Từ thông báo ứng tuyển đến cộng đồng công ty — giờ tiện lợi hơn ngay trên ứng dụng.',
    brand: 'FYI',
    h1: 'Ứng dụng iOS đã có mặt 🎉',
    intro: 'Xin chào, đây là <strong>salary-fyi</strong>.<br>Chúng tôi có một tin vui dành cho bạn — người đã đăng ký trên web. Ứng dụng iOS của chúng tôi đã chính thức có mặt trên App Store!',
    features: [
      ['🔔', 'Thông báo tình trạng ứng tuyển', 'Nhận thông báo đẩy ngay khi hồ sơ ứng tuyển của bạn có cập nhật mới.'],
      ['⭐', 'Thông báo lương công ty quan tâm', 'Khi công ty bạn theo dõi có thông tin lương mới, chúng tôi sẽ báo ngay cho bạn.'],
      ['💬', 'Cộng đồng công ty', 'Tự do hỏi đáp về công ty, mức lương và kinh nghiệm phỏng vấn.'],
      ['📊', 'Thông tin lương & đánh giá', 'Xem dữ liệu lương thực tế và đánh giá công ty ngay trong tầm tay.'],
    ],
    highlight: {
      tag: 'NEW',
      title: '✨ Tải CV lên để có một bản CV ấn tượng hơn',
      body: 'Khi bạn tải CV lên, AI do chính các nhà tuyển dụng và lãnh đạo cấp cao (C-level) phát triển sẽ tinh chỉnh CV của bạn trở nên trực quan và hấp dẫn hơn trong mắt nhà tuyển dụng. Với một bản CV tốt hơn, hãy đón nhận những cơ hội việc làm mới.',
    },
    cta: 'Tải về trên App Store',
    outro: 'Hẹn gặp bạn trên ứng dụng!',
    footerWhy: 'Email này được gửi đến bạn vì bạn đã đăng ký tài khoản tại salary-fyi, nhằm thông báo về việc ra mắt ứng dụng iOS mới.',
    unsub: 'Hủy đăng ký nhận email',
  },
};

function buildHtml(lang, unsubHref) {
  const c = COPY[lang];
  const feat = c.features.map(([icon, title, body]) => `
    <tr><td style="padding:0 0 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="44" valign="top" style="font-size:24px;line-height:1">${icon}</td>
        <td valign="top">
          <div style="font-size:16px;font-weight:700;color:#111;margin:0 0 4px">${title}</div>
          <div style="font-size:14px;line-height:1.55;color:#555">${body}</div>
        </td>
      </tr></table>
    </td></tr>`).join('');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${c.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <tr><td style="background:#ea580c;padding:22px 32px">
      <img src="${LOGO_URL}" alt="${c.brand}" height="38" style="height:38px;width:auto;display:block;border:0">
    </td></tr>
    <tr><td style="padding:36px 32px 8px">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111;font-weight:800">${c.h1}</h1>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#444">${c.intro}</p>
    </td></tr>
    <tr><td style="padding:0 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${feat}</table>
    </td></tr>
    <tr><td style="padding:8px 32px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px">
        <tr><td style="padding:18px 20px">
          <span style="display:inline-block;background:#ea580c;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;letter-spacing:.5px">${c.highlight.tag}</span>
          <div style="font-size:16px;font-weight:700;color:#9a3412;margin:10px 0 6px">${c.highlight.title}</div>
          <div style="font-size:14px;line-height:1.6;color:#7c2d12">${c.highlight.body}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:24px 32px 36px">
      <a href="${APP_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 34px;border-radius:12px">${c.cta}</a>
      <p style="margin:24px 0 0;font-size:14px;color:#666">${c.outro}</p>
    </td></tr>
    <tr><td style="padding:24px 32px;background:#fafafa;border-top:1px solid #eee">
      <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#999">${c.footerWhy}</p>
      <p style="margin:0;font-size:12px;color:#999">salary-fyi &middot; <a href="${unsubHref}" style="color:#999;text-decoration:underline">${c.unsub}</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export { buildHtml, COPY, APP_URL, LOGO_URL, env };

// --- CLI (only when run directly, not when imported) ------------------------
const isMain = process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === import.meta.url.replace('file://', '');
if (isMain) {
const [mode, lang = 'ko', arg] = process.argv.slice(2);
const c = COPY[lang];
if (!c) { console.error('no copy for lang:', lang); process.exit(1); }

if (mode === 'render') {
  const html = buildHtml(lang, '#unsubscribe-placeholder');
  const out = new URL(`./launch-email-${lang}.html`, import.meta.url);
  writeFileSync(out, html);
  console.log('✓ wrote', out.pathname, '— open in browser to preview');
} else if (mode === 'test') {
  if (!arg) { console.error('test recipient required: node scripts/launch-email.mjs test ko you@x.com'); process.exit(1); }
  const resend = new Resend(env.RESEND_API_KEY);
  const html = buildHtml(lang, 'https://salary-fyi.com'); // placeholder unsub for test
  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM, to: arg, subject: c.subject, html,
  });
  if (error) { console.error('✗ send failed:', error.message || JSON.stringify(error)); process.exit(1); }
  console.log('✓ test sent to', arg, '— id:', data?.id);
} else {
  console.log('usage: render <lang> | test <lang> <email>');
}
}
