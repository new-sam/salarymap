// 콜드메일 캠페인 → 발송 당시 메일 양식 스냅샷 (goals탭 캠페인 표의 "메일 보기" 모달 소스).
// 원본은 scripts/outreach/* 발송 스크립트 — 스크립트/템플릿이 나중에 바뀌어도 여기는
// "그 캠페인으로 실제 나간 양식"을 보존한다. 새 캠페인을 발송하면 여기에 항목을 추가할 것.
// {{...}} 는 발송 시 개인화되는 변수를 그대로 노출한 것(양식 보기가 목적이라 치환 안 함).
// 실제 발송 원문은 vi — ko/en은 어드민 열람용 번역본이며, 모달이 언어토글(lang)에 맞춰 고른다.

const pickLang = (o, lang) => o[lang] || o.vi

// ── 공용 셸: 단일 공고 추천 계열(nalda 톤) — intro/카드/혜택 문장만 캠페인별로 갈린다 ──
const SHELL_I18N = {
  vi: {
    greeting: 'Chào {{name}},',
    onetap: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
    cta: 'Ứng tuyển 1 chạm →',
    footer: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · salary-fyi.com/jobs',
  },
  ko: {
    greeting: '{{name}}님, 안녕하세요.',
    onetap: '<b>원탭</b>이면 됩니다 — 등록해두신 CV가 자동으로 전달됩니다.',
    cta: '원탭 지원 →',
    footer: 'FYI에 프로필을 등록하신 분께 발송된 메일입니다.<br>— FYI 팀 · salary-fyi.com/jobs',
  },
  en: {
    greeting: 'Hi {{name}},',
    onetap: 'Just <b>1 tap</b> — your registered CV is sent automatically.',
    cta: '1-tap apply →',
    footer: 'You received this email because you registered a profile on FYI.<br>— The FYI team · salary-fyi.com/jobs',
  },
}

const recommendShell = (lang, { intro, initial, company, title, meta, tail }) => {
  const s = pickLang(SHELL_I18N, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${s.greeting}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${pickLang(intro, lang)}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle"><div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${initial}</div></td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${company}</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${title}</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">${meta}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">${pickLang(tail, lang)} ${s.onetap}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${s.cta}</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}

const BENEFIT_PUBLIC = {
  vi: 'Vì đây là lời mời trực tiếp từ nhà tuyển dụng, hồ sơ của bạn sẽ được <b>ưu tiên xem xét</b> khi ứng tuyển.',
  ko: '기업 담당자가 직접 보낸 제안이라, 지원 시 <b>우선 검토</b> 대상이 됩니다.',
  en: 'Because this is a direct invitation from the recruiter, your application will get <b>priority review</b>.',
}
const BENEFIT_PRIVATE = {
  vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho nhà tuyển dụng. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b> so với ứng viên thông thường.',
  ko: '<b>이번 주 안에</b> FYI가 추천 명단을 기업 담당자에게 직접 전달합니다. 지금 지원하시면 FYI의 추천과 함께 CV가 전달되어 일반 지원자보다 <b>우선 검토</b>됩니다.',
  en: '<b>This week</b>, FYI will send the nominee list directly to the recruiter. If you apply now, your CV goes with FYI\'s recommendation and gets <b>priority review</b> over regular applicants.',
}

// ── KTC 4차 · CV 클레임 (scripts/ktc-claim-coldmail-vi.html) ──
const KTC_CLAIM_I18N = {
  vi: {
    tagline: 'Nền tảng tuyển dụng do K-Tech College xây dựng',
    h1: 'Hồ sơ của bạn<br /><span style="color:#ff6000;">đã sẵn sàng</span> trên FYI',
    p1: 'Chào <b style="color:#191F28;">{{name}}</b>,<br />{{month}}bạn đã ứng tuyển vị trí <b>{{jobTitle}}</b>{{atCompany}} qua <b>K-Tech College</b>.',
    p2: 'Với CV bạn đã nộp khi đó, chúng tôi đã <b style="color:#191F28;">chuẩn bị sẵn hồ sơ của bạn</b> trên <b>FYI</b> — nền tảng tuyển dụng do K-Tech College xây dựng.',
    cardLabel: 'HỒ SƠ FYI CỦA BẠN',
    cardFoot: '✓ Được tạo từ CV bạn đã nộp qua K-Tech College',
    p3: 'Bạn <b style="color:#191F28;">không cần viết lại CV</b>. Chỉ cần đăng nhập Google một lần, hồ sơ sẽ được đăng ký ngay và bạn có thể ứng tuyển các vị trí mới <b style="color:#191F28;">chỉ với một chạm</b>.',
    p4: 'Khi có vị trí phù hợp, chúng tôi sẽ gửi hồ sơ của bạn <b style="color:#191F28;">trực tiếp đến nhà tuyển dụng</b> — và bạn sẽ nhận được liên hệ qua email.',
    cta: 'Nhận hồ sơ của tôi →',
    foot1: 'Email này được gửi đến bạn vì bạn đã ứng tuyển K-Tech College, nhằm giới thiệu dịch vụ FYI.',
    foot2: 'Nếu không muốn nhận email này nữa, vui lòng nhấn <u>Hủy đăng ký</u>. · FYI · salary-fyi.com',
  },
  ko: {
    tagline: 'K-Tech College가 만든 채용 플랫폼',
    h1: '당신의 프로필이 FYI에<br /><span style="color:#ff6000;">이미 준비돼 있습니다</span>',
    p1: '<b style="color:#191F28;">{{name}}</b>님, 안녕하세요.<br />{{month}}<b>K-Tech College</b>를 통해 <b>{{jobTitle}}</b> 포지션{{atCompany}}에 지원하셨습니다.',
    p2: '그때 제출하신 CV로, K-Tech College가 만든 채용 플랫폼 <b>FYI</b>에 <b style="color:#191F28;">프로필을 미리 만들어 두었습니다</b>.',
    cardLabel: '내 FYI 프로필',
    cardFoot: '✓ K-Tech College 지원 시 제출한 CV로 생성됨',
    p3: 'CV를 <b style="color:#191F28;">다시 쓸 필요가 없습니다</b>. 구글 로그인 한 번이면 프로필이 바로 등록되고, 새 포지션에는 <b style="color:#191F28;">원탭으로</b> 지원할 수 있습니다.',
    p4: '맞는 포지션이 생기면 프로필을 <b style="color:#191F28;">기업 담당자에게 직접 전달</b>하고, 이메일로 연락을 받게 됩니다.',
    cta: '내 프로필 받기 →',
    foot1: 'K-Tech College 지원 이력이 있는 분께 FYI 서비스 소개를 위해 발송된 메일입니다.',
    foot2: '더 이상 수신을 원치 않으시면 <u>수신거부</u>를 눌러주세요. · FYI · salary-fyi.com',
  },
  en: {
    tagline: 'The hiring platform built by K-Tech College',
    h1: 'Your profile is<br /><span style="color:#ff6000;">already ready</span> on FYI',
    p1: 'Hi <b style="color:#191F28;">{{name}}</b>,<br />{{month}}you applied for the <b>{{jobTitle}}</b> position{{atCompany}} through <b>K-Tech College</b>.',
    p2: 'Using the CV you submitted back then, we\'ve <b style="color:#191F28;">prepared your profile</b> on <b>FYI</b> — the hiring platform built by K-Tech College.',
    cardLabel: 'YOUR FYI PROFILE',
    cardFoot: '✓ Built from the CV you submitted via K-Tech College',
    p3: 'You <b style="color:#191F28;">don\'t need to rewrite your CV</b>. Sign in with Google once, your profile is registered instantly, and you can apply to new positions <b style="color:#191F28;">with a single tap</b>.',
    p4: 'When a matching position opens, we\'ll send your profile <b style="color:#191F28;">directly to the recruiter</b> — and you\'ll hear back by email.',
    cta: 'Claim my profile →',
    foot1: 'You received this email because you applied to K-Tech College; it introduces the FYI service.',
    foot2: 'If you no longer wish to receive these emails, click <u>Unsubscribe</u>. · FYI · salary-fyi.com',
  },
}
const ktcClaimHtml = (lang) => {
  const s = pickLang(KTC_CLAIM_I18N, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 0;background:#f2f4f6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#191F28;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E8EB;">
  <div style="padding:22px 32px;border-bottom:1px solid #F2F4F6;">
    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ff6000;">FYI</span>
    <span style="font-size:11px;font-weight:700;color:#8B95A1;letter-spacing:0.5px;margin-left:8px;">${s.tagline}</span>
  </div>
  <div style="padding:32px;">
    <h1 style="margin:0 0 18px;font-size:26px;line-height:1.4;font-weight:800;color:#191F28;letter-spacing:-0.4px;">${s.h1}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p1}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p2}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
      <td style="background:#FFF7F3;border:1px solid #FFD9C7;border-radius:12px;padding:20px 22px;">
        <div style="font-size:11px;font-weight:800;color:#ff6000;letter-spacing:0.6px;margin-bottom:8px;">${s.cardLabel}</div>
        <div style="font-size:18px;font-weight:800;color:#191F28;letter-spacing:-0.2px;margin-bottom:10px;">{{fullName}}</div>
        <div style="font-size:13.5px;color:#4E5968;line-height:1.7;">🎓 {{university}}<br/>💼 {{position}} · {{yoe}}</div>
        <div style="font-size:12px;color:#8B95A1;border-top:1px solid #FFE4D6;margin-top:12px;padding-top:10px;line-height:1.5;">${s.cardFoot}</div>
      </td>
    </tr></table>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p3}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p4}</p>
    <div style="text-align:center;margin:28px 0;"><a style="display:inline-block;background:#ff6000;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:15px 30px;border-radius:12px;">${s.cta}</a></div>
  </div>
  <div style="padding:20px 32px 28px;border-top:1px solid #F2F4F6;">
    <p style="margin:0 0 6px;font-size:12px;line-height:1.65;color:#8B95A1;">${s.foot1}</p>
    <p style="margin:0;font-size:12px;line-height:1.65;color:#8B95A1;">${s.foot2}</p>
  </div>
</div></body></html>`
}

// ── KTC 3차 · 지원현황 (scripts/ktc-coldmail-vi.html) ──
const KTC_STATUS_I18N = {
  vi: {
    tagline: 'Nền tảng tuyển dụng IT tại Việt Nam',
    h1: 'Hồ sơ của bạn<br />đang ở <span style="color:#ff6000;">bước nào?</span>',
    p1: 'Chào <b style="color:#191F28;">{{name}}</b>,<br />Vừa qua bạn đã ứng tuyển vị trí <b>{{position}}</b>{{atCompany}} thông qua <b>K-Tech College</b>. <b style="color:#191F28;">Sau đó bạn có nhận được phản hồi nào không?</b>',
    p2: 'Thành thật mà nói: trước đây chúng tôi <b style="color:#191F28;">chỉ liên hệ với ứng viên trúng tuyển vòng cuối</b>. Nghĩa là phần lớn ứng viên không bao giờ biết hồ sơ của mình đã đi tới đâu.',
    p3: '<b style="color:#191F28;">Từ nay thì khác.</b> Chúng tôi đã xây dựng <b>FYI</b> để bạn không còn phải chờ đợi trong im lặng nữa.',
    statLabel: 'Tin tuyển dụng',
    cta: 'Xem cách theo dõi hồ sơ →',
    foot1: 'Email này được gửi đến bạn vì bạn đã ứng tuyển K-Tech College, nhằm giới thiệu dịch vụ FYI.',
    foot2: 'Nếu không muốn nhận email này nữa, vui lòng nhấn <u>Hủy đăng ký</u>. · FYI · salary-fyi.com',
  },
  ko: {
    tagline: '베트남 IT 채용 플랫폼',
    h1: '내 지원서는 지금<br /><span style="color:#ff6000;">어느 단계</span>에 있을까요?',
    p1: '<b style="color:#191F28;">{{name}}</b>님, 안녕하세요.<br />얼마 전 <b>K-Tech College</b>를 통해 <b>{{position}}</b> 포지션{{atCompany}}에 지원하셨습니다. <b style="color:#191F28;">그 뒤로 회신을 받은 적이 있으신가요?</b>',
    p2: '솔직히 말씀드리면, 지금까지 저희는 <b style="color:#191F28;">최종 합격자에게만 연락</b>했습니다. 대부분의 지원자는 자신의 지원서가 어디까지 갔는지 끝내 알 수 없었다는 뜻입니다.',
    p3: '<b style="color:#191F28;">이제는 다릅니다.</b> 더 이상 조용히 기다리지 않아도 되도록 <b>FYI</b>를 만들었습니다.',
    statLabel: '채용 공고',
    cta: '지원 현황 확인하는 법 보기 →',
    foot1: 'K-Tech College 지원 이력이 있는 분께 FYI 서비스 소개를 위해 발송된 메일입니다.',
    foot2: '더 이상 수신을 원치 않으시면 <u>수신거부</u>를 눌러주세요. · FYI · salary-fyi.com',
  },
  en: {
    tagline: 'The IT hiring platform in Vietnam',
    h1: 'Where is your application<br /><span style="color:#ff6000;">right now?</span>',
    p1: 'Hi <b style="color:#191F28;">{{name}}</b>,<br />You recently applied for the <b>{{position}}</b> position{{atCompany}} through <b>K-Tech College</b>. <b style="color:#191F28;">Have you heard anything back since?</b>',
    p2: 'To be honest: until now, we <b style="color:#191F28;">only contacted candidates who passed the final round</b>. That means most applicants never found out how far their application went.',
    p3: '<b style="color:#191F28;">That changes now.</b> We built <b>FYI</b> so you never have to wait in silence again.',
    statLabel: 'Job postings',
    cta: 'See how to track your application →',
    foot1: 'You received this email because you applied to K-Tech College; it introduces the FYI service.',
    foot2: 'If you no longer wish to receive these emails, click <u>Unsubscribe</u>. · FYI · salary-fyi.com',
  },
}
const ktcStatusHtml = (lang) => {
  const s = pickLang(KTC_STATUS_I18N, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 0;background:#f2f4f6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#191F28;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E8EB;">
  <div style="padding:22px 32px;border-bottom:1px solid #F2F4F6;">
    <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ff6000;">FYI</span>
    <span style="font-size:11px;font-weight:700;color:#8B95A1;letter-spacing:0.5px;margin-left:8px;">${s.tagline}</span>
  </div>
  <div style="padding:32px;">
    <h1 style="margin:0 0 18px;font-size:26px;line-height:1.4;font-weight:800;color:#191F28;letter-spacing:-0.4px;">${s.h1}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p1}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p2}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4E5968;">${s.p3}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px;margin:0 -8px 8px;"><tr>
      <td width="100%" style="background:#F9F9F9;border:1px solid #F2F4F6;border-radius:12px;padding:16px 12px;text-align:center;">
        <div style="font-size:23px;font-weight:900;color:#ff6000;letter-spacing:-0.5px;">983</div>
        <div style="font-size:12px;color:#8B95A1;margin-top:5px;line-height:1.45;">${s.statLabel}</div>
      </td>
    </tr></table>
    <div style="text-align:center;margin:28px 0;"><a style="display:inline-block;background:#ff6000;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:15px 30px;border-radius:12px;">${s.cta}</a></div>
  </div>
  <div style="padding:20px 32px 28px;border-top:1px solid #F2F4F6;">
    <p style="margin:0 0 6px;font-size:12px;line-height:1.65;color:#8B95A1;">${s.foot1}</p>
    <p style="margin:0;font-size:12px;line-height:1.65;color:#8B95A1;">${s.foot2}</p>
  </div>
</div></body></html>`
}

// ── coldmail1 · 이력서 공개 축하금 (resume-public-coldmail.mjs) ──
const COLDMAIL1_I18N = {
  vi: {
    greeting: 'Chào <b>{{name}}</b>,',
    p1: 'Cảm ơn bạn đã đăng ký CV trên FYI để tham gia <b>sự kiện thưởng 1.000.000₫</b>! 🎉',
    p2: 'Nhưng CV của bạn đang ở chế độ <b style="color:#d92d20">RIÊNG TƯ</b>. Khi còn riêng tư:',
    li1: 'Các công ty <b>không thể xem</b> hồ sơ của bạn',
    li2: 'Bạn <b>chưa đủ điều kiện</b> tham gia sự kiện thưởng',
    p3: 'Chỉ cần 1 chạm để công khai CV và tham gia ngay:',
    cta: 'Công khai CV &amp; tham gia sự kiện →',
    p4: 'Sau khi công khai, các công ty phù hợp sẽ chủ động liên hệ, và bạn đủ điều kiện nhận thưởng 1.000.000₫ khi được tuyển qua FYI.',
    footer: '— Đội ngũ FYI · salary-fyi.com<br>Đây là email tự động. Nếu bạn không muốn công khai, chỉ cần bỏ qua email này.',
  },
  ko: {
    greeting: '<b>{{name}}</b>님, 안녕하세요.',
    p1: '<b>1,000,000₫ 축하금 이벤트</b> 참여를 위해 FYI에 CV를 등록해 주셔서 감사합니다! 🎉',
    p2: '그런데 지금 CV가 <b style="color:#d92d20">비공개</b> 상태입니다. 비공개인 동안에는:',
    li1: '기업이 회원님의 프로필을 <b>볼 수 없습니다</b>',
    li2: '축하금 이벤트 <b>참여 자격이 없습니다</b>',
    p3: '원탭으로 CV를 공개하고 바로 참여하세요:',
    cta: 'CV 공개하고 이벤트 참여 →',
    p4: '공개하면 맞는 기업이 먼저 연락해 오고, FYI를 통해 채용되면 1,000,000₫ 축하금 지급 대상이 됩니다.',
    footer: '— FYI 팀 · salary-fyi.com<br>자동 발송 메일입니다. 공개를 원치 않으시면 이 메일은 무시하셔도 됩니다.',
  },
  en: {
    greeting: 'Hi <b>{{name}}</b>,',
    p1: 'Thanks for registering your CV on FYI to join the <b>1,000,000₫ bonus event</b>! 🎉',
    p2: 'But your CV is currently set to <b style="color:#d92d20">PRIVATE</b>. While it stays private:',
    li1: 'Companies <b>can\'t view</b> your profile',
    li2: 'You\'re <b>not yet eligible</b> for the bonus event',
    p3: 'Just 1 tap to make your CV public and join right away:',
    cta: 'Make CV public &amp; join the event →',
    p4: 'Once public, matching companies will reach out first, and you\'re eligible for the 1,000,000₫ bonus when hired through FYI.',
    footer: '— The FYI team · salary-fyi.com<br>This is an automated email. If you\'d rather stay private, just ignore it.',
  },
}
const coldmail1Html = (lang) => {
  const s = pickLang(COLDMAIL1_I18N, lang)
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">${s.greeting}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 16px">${s.p1}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 8px">${s.p2}</p>
    <ul style="font-size:14px;line-height:1.7;margin:0 0 18px;padding-left:20px;color:#4a4238">
      <li>${s.li1}</li>
      <li>${s.li2}</li>
    </ul>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">${s.p3}</p>
    <div style="text-align:center;margin:0 0 22px"><a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">${s.cta}</a></div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">${s.p4}</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">${s.footer}</p>
</div></body></html>`
}

// ── jobs1 · 올린 CV로 원탭 지원 (resume-public-jobs-coldmail.mjs) ──
const JOBS1_I18N = {
  vi: {
    greeting: 'Chào <b>{{name}}</b>,',
    p1: 'Bạn đã có CV trên FYI — giờ bạn có thể dùng chính CV đó để <b>ứng tuyển ngay, không cần điền lại bất cứ thông tin nào</b>.',
    p2: 'Ngay lúc này có <b>{{N}} vị trí</b> từ các công ty đang tuyển dụng tích cực. Nhấn nút bên dưới để xem danh sách và ứng tuyển từng vị trí <b>chỉ với 1 nút bấm</b> — CV của bạn được gửi tự động.',
    cta: 'Xem việc làm &amp; ứng tuyển ngay →',
    note: 'Lưu ý: khi nhấn nút, CV của bạn sẽ chuyển sang chế độ công khai — nhà tuyển dụng cũng có thể chủ động tìm thấy và liên hệ bạn.',
    footer: '— Đội ngũ FYI · salary-fyi.com<br>Đây là email tự động. Nếu bạn không quan tâm, chỉ cần bỏ qua email này.',
  },
  ko: {
    greeting: '<b>{{name}}</b>님, 안녕하세요.',
    p1: 'FYI에 이미 CV가 있습니다 — 이제 그 CV 그대로 <b>아무 정보도 다시 입력하지 않고 바로 지원</b>할 수 있습니다.',
    p2: '지금 이 순간 활발히 채용 중인 기업의 <b>{{N}}개 포지션</b>이 있습니다. 아래 버튼으로 리스트를 확인하고 <b>버튼 한 번으로</b> 각 포지션에 지원하세요 — CV는 자동으로 전달됩니다.',
    cta: '공고 보고 바로 지원 →',
    note: '참고: 버튼을 누르면 CV가 공개 상태로 전환됩니다 — 기업이 먼저 회원님을 찾아 연락할 수도 있습니다.',
    footer: '— FYI 팀 · salary-fyi.com<br>자동 발송 메일입니다. 관심 없으시면 무시하셔도 됩니다.',
  },
  en: {
    greeting: 'Hi <b>{{name}}</b>,',
    p1: 'You already have a CV on FYI — now you can use that same CV to <b>apply instantly, without re-entering anything</b>.',
    p2: 'Right now there are <b>{{N}} positions</b> from companies actively hiring. Tap the button below to browse the list and apply to each one <b>with a single click</b> — your CV is sent automatically.',
    cta: 'Browse jobs &amp; apply now →',
    note: 'Note: tapping the button switches your CV to public — recruiters may also find and contact you directly.',
    footer: '— The FYI team · salary-fyi.com<br>This is an automated email. Not interested? Just ignore it.',
  },
}
const jobs1Html = (lang) => {
  const s = pickLang(JOBS1_I18N, lang)
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">${s.greeting}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 16px">${s.p1}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">${s.p2}</p>
    <div style="text-align:center;margin:0 0 18px"><a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px">${s.cta}</a></div>
    <p style="font-size:12.5px;line-height:1.6;color:#8a8073;margin:0">${s.note}</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">${s.footer}</p>
</div></body></html>`
}

// ── recommend1 · 담당자 추천 상위 3공고 (recommend-jobs-coldmail.mjs) ──
const jobCard = (company, title, meta) => `<tr><td style="padding:0 0 10px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle"><div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">${company.charAt(0)}</div></td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">${company}</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${title}</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${meta}</div>
    </td>
  </tr></table></td></tr>`
const RECOMMEND1_I18N = {
  vi: {
    greeting: 'Chào {{name}},',
    intro: 'Dựa trên hồ sơ của bạn trên FYI, chúng tôi đã <b>giới thiệu bạn tới một số nhà tuyển dụng đang tuyển</b>. Dưới đây là 3 vị trí phù hợp nhất với kinh nghiệm của bạn — bạn có thể ứng tuyển <b>chỉ với 1 chạm</b>, CV đã đăng ký của bạn sẽ được gửi tự động.',
    cta: 'Xem &amp; ứng tuyển 1 chạm →',
    footer: 'Bạn nhận được email này vì đã đăng ký hồ sơ công khai trên FYI.<br>— Đội ngũ FYI · salary-fyi.com/jobs',
  },
  ko: {
    greeting: '{{name}}님, 안녕하세요.',
    intro: 'FYI에 등록된 프로필을 바탕으로 <b>채용 중인 기업 담당자들에게 회원님을 추천</b>했습니다. 아래는 경력에 가장 잘 맞는 3개 포지션입니다 — <b>원탭</b>으로 지원하면 등록해두신 CV가 자동으로 전달됩니다.',
    cta: '보고 원탭 지원 →',
    footer: 'FYI에 공개 프로필을 등록하신 분께 발송된 메일입니다.<br>— FYI 팀 · salary-fyi.com/jobs',
  },
  en: {
    greeting: 'Hi {{name}},',
    intro: 'Based on your FYI profile, we\'ve <b>introduced you to several recruiters who are hiring</b>. Below are the 3 positions that best match your experience — apply <b>with just 1 tap</b> and your registered CV is sent automatically.',
    cta: 'View &amp; 1-tap apply →',
    footer: 'You received this email because you registered a public profile on FYI.<br>— The FYI team · salary-fyi.com/jobs',
  },
}
const recommend1Html = (lang) => {
  const s = pickLang(RECOMMEND1_I18N, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${s.greeting}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${s.intro}</td></tr>
  <tr><td><table width="100%" cellpadding="0" cellspacing="0">${jobCard('{{회사1}}', '{{공고 제목1}}', '{{직군 · 지역}}')}${jobCard('{{회사2}}', '{{공고 제목2}}', '{{직군 · 지역}}')}${jobCard('{{회사3}}', '{{공고 제목3}}', '{{직군 · 지역}}')}</table></td></tr>
  <tr><td align="center" style="padding:16px 0 6px"><a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${s.cta}</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}

// ── resume-register · 이력서 등록 유도 (resume-register-coldmail.mjs) ──
const REGISTER_I18N = {
  vi: {
    greeting: 'Chào {{name}},',
    headline: 'Đăng ký CV, nhà tuyển dụng sẽ tìm đến bạn.',
    stat1: 'lời mời mỗi tháng',
    stat2: 'đậu vòng hồ sơ qua FYI',
    statNote: 'Số liệu trung bình của người đã đăng ký CV.',
    body: 'Bạn không cần tìm việc nữa. Chúng tôi chọn những vị trí bạn có khả năng đậu cao và liên hệ trước.',
    cta: 'Đăng ký CV',
    ctaNote: 'Không cần đăng nhập · khoảng 30 giây',
    footer: 'Bạn nhận email này vì đã đăng ký tài khoản FYI.<br>salary-fyi.com',
  },
  ko: {
    greeting: '{{name}}님, 안녕하세요.',
    headline: 'CV를 등록하면, 기업이 먼저 찾아옵니다.',
    stat1: '한 달 평균 받는 제안',
    stat2: 'FYI 통한 서류 통과율',
    statNote: 'CV 등록자 평균 수치입니다.',
    body: '더 이상 일자리를 찾아다닐 필요가 없습니다. 합격 가능성이 높은 포지션을 저희가 골라 먼저 연락드립니다.',
    cta: 'CV 등록하기',
    ctaNote: '로그인 불필요 · 약 30초',
    footer: 'FYI 계정을 등록하신 분께 발송된 메일입니다.<br>salary-fyi.com',
  },
  en: {
    greeting: 'Hi {{name}},',
    headline: 'Register your CV — recruiters will come to you.',
    stat1: 'invitations per month',
    stat2: 'pass resume screening via FYI',
    statNote: 'Average figures for users who registered a CV.',
    body: 'You don\'t need to job-hunt anymore. We pick the positions you\'re most likely to land and reach out first.',
    cta: 'Register CV',
    ctaNote: 'No login needed · about 30 seconds',
    footer: 'You received this email because you have an FYI account.<br>salary-fyi.com',
  },
}
const registerHtml = (lang) => {
  const s = pickLang(REGISTER_I18N, lang)
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:32px 16px 40px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
  <tr><td style="font-size:17px;font-weight:800;color:#ff6000;letter-spacing:-0.01em;padding-bottom:14px">FYI</td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;padding:32px 28px 28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:13.5px;color:#8a8177;padding-bottom:12px">${s.greeting}</td></tr>
      <tr><td style="font-size:20px;font-weight:800;line-height:1.45;padding-bottom:22px">${s.headline}</td></tr>
      <tr><td style="padding-bottom:8px"><table width="100%" cellpadding="0" cellspacing="0">
        <tr><td width="72" style="font-size:30px;font-weight:800;color:#ff6000;line-height:1.15;vertical-align:middle;padding:9px 0">7</td><td style="font-size:14px;font-weight:600;color:#1a1612;vertical-align:middle;padding:9px 0">${s.stat1}</td></tr>
        <tr><td width="72" style="font-size:30px;font-weight:800;color:#ff6000;line-height:1.15;vertical-align:middle;padding:9px 0">85%</td><td style="font-size:14px;font-weight:600;color:#1a1612;vertical-align:middle;padding:9px 0">${s.stat2}</td></tr>
      </table></td></tr>
      <tr><td style="font-size:12px;color:#9a9186;line-height:1.5;padding-bottom:20px">${s.statNote}</td></tr>
      <tr><td style="border-top:1px solid #eeeae4;padding-top:20px;font-size:14px;line-height:1.7;color:#57504a">${s.body}</td></tr>
      <tr><td style="padding-top:22px"><a style="display:block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px;border-radius:12px;text-align:center">${s.cta}</a></td></tr>
      <tr><td style="font-size:12.5px;color:#9a9186;text-align:center;padding-top:12px">${s.ctaNote}</td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a8a096;text-align:center;line-height:1.6;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}

// v2(8/5): 조작 수치(월7건·85%) 폐기 → 실측 "주 평균 오퍼 3.2건" 단일 스탯 + 연봉협상 앵글 + 수신거부 푸터.
const REGISTER2_I18N = {
  vi: {
    greeting: 'Chào {{name}},',
    headline: 'Đăng ký CV, nhà tuyển dụng sẽ tìm đến bạn.',
    stat1n: '3,2', stat1: 'lời mời mỗi tuần',
    statNote: 'Số liệu thực tế trung bình của người đã đăng ký CV trên FYI.',
    body: 'Bạn không cần tìm việc nữa. Khi có vị trí phù hợp, chúng tôi gửi hồ sơ của bạn trực tiếp đến nhà tuyển dụng.',
    body2: 'Chưa có ý định chuyển việc? Không sao — lời mời bạn nhận được chính là lợi thế chắc chắn nhất khi đàm phán tăng lương ở công ty hiện tại.',
    cta: 'Đăng ký CV',
    ctaNote: 'Không cần đăng nhập · khoảng 30 giây',
    footer: 'Bạn nhận email này vì đã đăng ký tài khoản FYI.<br>salary-fyi.com · Hủy đăng ký',
  },
  ko: {
    greeting: '{{name}}님, 안녕하세요.',
    headline: '이력서를 등록해두면 담당자가 먼저 찾아옵니다.',
    stat1n: '3.2', stat1: '1주일 평균 받는 오퍼',
    statNote: '이력서를 등록한 분들이 실제로 받은 평균입니다.',
    body: '공고를 찾아다니지 않으셔도 됩니다. 맞는 자리가 열리면 회원님의 이력서를 기업 담당자에게 바로 전달합니다.',
    body2: '당장 이직 생각이 없으셔도 괜찮습니다. 받아둔 오퍼는 지금 회사와의 연봉 협상에서 가장 확실한 카드가 됩니다.',
    cta: '이력서 등록하기',
    ctaNote: '로그인 없이 파일만 · 30초',
    footer: 'FYI에 가입하셔서 이 메일을 받으셨습니다.<br>salary-fyi.com · 수신 거부',
  },
  en: {
    greeting: 'Hi {{name}},',
    headline: 'Register your CV — recruiters will come to you.',
    stat1n: '3.2', stat1: 'offers per week on average',
    statNote: 'Actual average for users who registered a CV on FYI.',
    body: 'You don\'t need to job-hunt anymore. When a matching position opens, we send your CV directly to the recruiter.',
    body2: 'Not planning to switch jobs right now? That\'s fine — an offer in hand is your strongest card when negotiating a raise at your current company.',
    cta: 'Register CV',
    ctaNote: 'No login needed · about 30 seconds',
    footer: 'You received this email because you have an FYI account.<br>salary-fyi.com · Unsubscribe',
  },
}
const registerHtml2 = (lang) => {
  const s = pickLang(REGISTER2_I18N, lang)
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:32px 16px 40px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
  <tr><td style="font-size:17px;font-weight:800;color:#ff6000;letter-spacing:-0.01em;padding-bottom:14px">FYI</td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;padding:32px 28px 28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:13.5px;color:#8a8177;padding-bottom:12px">${s.greeting}</td></tr>
      <tr><td style="font-size:20px;font-weight:800;line-height:1.45;padding-bottom:22px">${s.headline}</td></tr>
      <tr><td style="padding-bottom:8px"><table width="100%" cellpadding="0" cellspacing="0">
        <tr><td width="72" style="font-size:30px;font-weight:800;color:#ff6000;line-height:1.15;vertical-align:middle;padding:9px 0">${s.stat1n}</td><td style="font-size:14px;font-weight:600;color:#1a1612;vertical-align:middle;padding:9px 0">${s.stat1}</td></tr>
      </table></td></tr>
      <tr><td style="font-size:12px;color:#9a9186;line-height:1.5;padding-bottom:20px">${s.statNote}</td></tr>
      <tr><td style="border-top:1px solid #eeeae4;padding-top:20px;font-size:14px;line-height:1.7;color:#57504a">${s.body}</td></tr>
      <tr><td style="padding-top:12px;font-size:14px;line-height:1.7;color:#57504a">${s.body2}</td></tr>
      <tr><td style="padding-top:22px"><a style="display:block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px;border-radius:12px;text-align:center">${s.cta}</a></td></tr>
      <tr><td style="font-size:12.5px;color:#9a9186;text-align:center;padding-top:12px">${s.ctaNote}</td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a8a096;text-align:center;line-height:1.6;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}

const KTC_CLAIM_SUBJECT = {
  vi: '{{name}} ơi, hồ sơ {{position}} của bạn đã sẵn sàng trên FYI',
  ko: '{{name}}님, {{position}} 프로필이 FYI에 준비돼 있어요',
  en: '{{name}}, your {{position}} profile is ready on FYI',
}
const invitedSubject = (company) => ({
  vi: `[FYI] ${company} đã xem hồ sơ của bạn và mời bạn ứng tuyển`,
  ko: `[FYI] ${company}가 회원님의 프로필을 보고 지원을 요청했습니다`,
  en: `[FYI] ${company} viewed your profile and invited you to apply`,
})

// 순서대로 첫 매치 사용 — 접두어가 겹치는 항목(coldmail-ktc*)은 구체적인 것을 앞에 둘 것.
export const COLDMAIL_TEMPLATES = [
  {
    match: /^coldmail-ktc-cv-remind/,
    subject: {
      vi: '{{name}} ơi, những người đã nhận hồ sơ đang có trung bình 2,1 lời mời việc làm',
      ko: '{{name}}님, 프로필을 받아간 분들은 평균 2.1건의 오퍼를 받았습니다',
      en: '{{name}}, people who claimed their profile got 2.1 offers on average',
    },
    desc: 'KTC 4차(CV 클레임) 리마인드 (8/4~): 원본 수신 24h+ 미클릭·미가입 리드에게 "받아간 사람들은 평균 오퍼 2.1건"(실측) 사회적 증거 훅. 본문은 클레임 양식에서 헤드라인·앞 두 문단만 교체 — 미리보기는 원양식 기준.',
    source: 'scripts/outreach/ktc-claim-coldmail.mjs --remind',
    html: ktcClaimHtml,
  },
  {
    match: /^coldmail-ktc-cv-revive/,
    subject: KTC_CLAIM_SUBJECT,
    desc: 'KTC 4차(CV 클레임)와 완전히 같은 양식의 재발송 — 1~3차(구 앵글) 수신 후 무반응이었던 리드 대상 (8/4). "이미 한 번 무시한 풀에도 클레임 앵글이 먹히는지" 분리 측정용.',
    source: 'scripts/outreach/ktc-claim-coldmail.mjs --revive',
    html: ktcClaimHtml,
  },
  {
    match: /^coldmail-ktc-cv/,
    subject: KTC_CLAIM_SUBJECT,
    desc: 'KTC 4차 · CV 클레임 (8/3~): "KTC 지원 때 낸 CV로 네 프로필을 미리 만들어뒀다" 소유 프레임. 카드에 본인 실데이터(실명·대학·직무) 표시, 랜딩 /ktc/claim 리치카드 → 가입 즉시 CV 자동 임포트.',
    source: 'scripts/outreach/ktc-claim-coldmail.mjs + scripts/ktc-claim-coldmail-vi.html',
    html: ktcClaimHtml,
  },
  {
    match: /^coldmail-ktc-3/,
    subject: {
      vi: 'K-Tech College - {{직무}} — hồ sơ của bạn đang ở bước nào?',
      ko: 'K-Tech College - {{직무}} — 내 지원서는 지금 어느 단계일까요?',
      en: 'K-Tech College - {{직무}} — where is your application now?',
    },
    desc: 'KTC 3차 · 지원현황 앵글 (7/31): "KTC는 최종 합격자에게만 연락했다 → FYI로 넣는 지원은 단계가 다 보인다". 제목 앵커를 발신자 정체성(K-Tech College)으로 복귀시켜 2차의 미끼-전환 문제를 수정.',
    source: 'scripts/outreach/ktc-coldmail.mjs + scripts/ktc-coldmail-vi.html',
    html: ktcStatusHtml,
  },
  {
    match: /^coldmail-ktc-2/,
    subject: '{{기업명}} - {{직무}} — (기업명 개인화 실험)',
    desc: 'KTC 2차 (7/29): 제목을 지원했던 기업명으로 개인화한 실험. 오픈 38.6%로 멀쩡했지만 열어보니 그 기업이 보낸 메일이 아니어서 클릭 1%로 죽음(미끼-전환). 본문 원문은 git 히스토리에만 남아있음.',
    source: 'scripts/outreach/ktc-coldmail.mjs (당시 버전)',
    html: null,
  },
  {
    match: /^coldmail-ktc/,
    subject: 'KTC - {{직무}} (1차 초기 앵글)',
    desc: 'KTC 1차 (7/28): FYI 소개 일반 안내 톤. 클릭 8%·가입 2.5%. 본문 원문은 git 히스토리에만 남아있음.',
    source: 'scripts/outreach/ktc-coldmail.mjs (당시 버전)',
    html: null,
  },
  {
    match: /^coldmail1/,
    subject: {
      vi: 'CV của bạn đang ẩn — công khai để nhận thưởng 1.000.000₫ 🎁',
      ko: 'CV가 비공개 상태예요 — 공개하고 1,000,000₫ 축하금 받으세요 🎁',
      en: 'Your CV is hidden — make it public to claim 1,000,000₫ 🎁',
    },
    desc: '이력서 공개 전환 1차 (7/14): /cv 축하금 이벤트 등록자 중 비공개 보유자에게 "공개해야 이벤트 참여 자격" 훅. 버튼 = go-public 원클릭 공개 전환.',
    source: 'scripts/outreach/resume-public-coldmail.mjs',
    html: coldmail1Html,
  },
  {
    match: /^jobs1/,
    subject: {
      vi: 'CV của bạn đã sẵn sàng — ứng tuyển {{N}} vị trí đang tuyển gấp chỉ với 1 chạm',
      ko: 'CV가 준비됐어요 — 급히 채용 중인 {{N}}개 포지션에 원탭 지원',
      en: 'Your CV is ready — 1-tap apply to {{N}} urgent openings',
    },
    desc: '공고 원탭 지원 (7/15): 비-cv 미공개 이력서 보유자에게 "이미 올린 CV로 원클릭 지원" 앵글. 버튼 = 공개 전환 + 공고 리스트 랜딩(quick-apply 원탭).',
    source: 'scripts/outreach/resume-public-jobs-coldmail.mjs',
    html: jobs1Html,
  },
  {
    match: /^recommend1/,
    subject: {
      vi: '[FYI] {{회사}} và {{N}} công ty khác muốn xem hồ sơ của bạn',
      ko: '[FYI] {{회사}} 외 {{N}}개 기업이 회원님의 프로필을 보고 싶어 합니다',
      en: '[FYI] {{회사}} and {{N}} other companies want to see your profile',
    },
    desc: '담당자 추천 (7/16): 공개 이력서 풀을 스킬·연차·JD로 활성 공고와 매칭, "담당자가 FYI 추천을 받아 보냈다" 톤으로 상위 3개 공고 카드. 버튼 = 원클릭 랜딩 + 원탭 지원.',
    source: 'scripts/outreach/recommend-jobs-coldmail.mjs',
    html: recommend1Html,
  },
  {
    match: /^nalda-/,
    subject: invitedSubject('NALDA'),
    desc: 'NALDA 단일공고 추천 (7/29): "담당자가 이력서 보고 이 공고를 보냈다 · 우선검토" 톤. React·TypeScript·Firebase 매칭 풀 대상.',
    source: 'scripts/outreach/nalda-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>NALDA</b> — công ty công nghệ đang vận hành ứng dụng quản lý thời gian <b>Timing</b> — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm của bạn phù hợp với yêu cầu (React · TypeScript · Firebase).',
        ko: '시간 관리 앱 <b>Timing</b>을 운영하는 테크 기업 <b>NALDA</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 경력이 요구사항(React · TypeScript · Firebase)과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>NALDA</b> — the tech company behind the time-management app <b>Timing</b> — viewed your profile on FYI and <b>sent you this position</b> because your experience matches the requirements (React · TypeScript · Firebase).',
      },
      initial: 'N', company: 'NALDA', title: '{{공고 제목}}', meta: '{{직군 · 지역}}', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^mpnx-/,
    subject: invitedSubject('MPNX'),
    desc: 'MPNX 단일공고 추천 (7/29): NALDA와 같은 "담당자가 봤다 · 우선검토" 공개 프레임.',
    source: 'scripts/outreach/mpnx-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>MPNX</b> đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm của bạn phù hợp với yêu cầu.',
        ko: '<b>MPNX</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>MPNX</b> viewed your profile on FYI and <b>sent you this position</b> because your experience matches the requirements.',
      },
      initial: 'M', company: 'MPNX', title: '{{공고 제목}}', meta: '{{직군 · 지역}}', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^manman-/,
    subject: invitedSubject('Man Man Market'),
    desc: 'Man Man Market 단일공고 추천 (7/29): 디자인 풀 대상. 공개="담당자가 봤다" / 비공개="맞는 자리가 열렸다" 두 프레임을 한 캠페인명으로 발송.',
    source: 'scripts/outreach/manman-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>Man Man Market</b> — doanh nghiệp bán lẻ &amp; thương mại điện tử Hàn Quốc, bán hàng qua kênh KakaoTalk — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm thiết kế của bạn phù hợp.',
        ko: '카카오톡 채널로 판매하는 한국 리테일·이커머스 기업 <b>Man Man Market</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 디자인 경력이 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>Man Man Market</b> — a Korean retail &amp; e-commerce business selling through KakaoTalk channels — viewed your profile on FYI and <b>sent you this position</b> because your design experience fits.',
      },
      initial: 'M', company: 'Man Man Market', title: '{{공고 제목}}', meta: '{{직군 · 지역}}', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^zest-recommend1-public/,
    subject: invitedSubject('Zest'),
    desc: 'Zest Full-stack 추천 · 공개 프레임 (7/30): "Zest 담당자가 당신 이력서를 보고 보냈다 · 우선검토".',
    source: 'scripts/outreach/zest-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>Zest</b> — công ty công nghệ Hàn Quốc phát triển nền tảng AI Agent cho quản lý dự án xây dựng — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm của bạn phù hợp với yêu cầu (Full-stack · Web · AI Agent).',
        ko: '건설 프로젝트 관리용 AI Agent 플랫폼을 개발하는 한국 테크 기업 <b>Zest</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 경력이 요구사항(Full-stack · Web · AI Agent)과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>Zest</b> — a Korean tech company building an AI Agent platform for construction project management — viewed your profile on FYI and <b>sent you this position</b> because your experience matches the requirements (Full-stack · Web · AI Agent).',
      },
      initial: 'Z', company: 'Zest', title: 'FULL-STACK DEVELOPER', meta: '{{지역 · 급여}}', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^zest-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Full-stack tại Zest',
      ko: '[FYI] Zest Full-stack 포지션 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the Zest Full-stack nominee list',
    },
    desc: 'Zest Full-stack 추천 · 비공개 프레임 (7/30): "FYI가 전체 이력서 검토 후 추천 명단에 선정 · 이번 주 담당자 전달 · 우선검토" 선정+기한 훅. ⚠️발송 후 실제 명단 공유 의무.',
    source: 'scripts/outreach/zest-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>Zest</b> — công ty công nghệ Hàn Quốc phát triển nền tảng AI Agent cho quản lý dự án xây dựng — đang tuyển Full-stack Developer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '건설 프로젝트 관리용 AI Agent 플랫폼을 개발하는 한국 테크 기업 <b>Zest</b>가 FYI를 통해 Full-stack Developer를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>Zest</b> — a Korean tech company building an AI Agent platform for construction project management — is hiring a Full-stack Developer through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'Z', company: 'Zest', title: 'FULL-STACK DEVELOPER', meta: '{{지역 · 급여}}', tail: BENEFIT_PRIVATE,
    }),
  },
  {
    match: /^creatus-recommend1-public/,
    subject: invitedSubject('CREATUS'),
    desc: 'CREATUS Global Content Marketer 추천 · 공개 프레임 (7/30): 전략·어학형(마케팅/브랜드/PR) 풀 배정.',
    source: 'scripts/outreach/marketing-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>CREATUS</b> — công ty Hàn Quốc trong lĩnh vực Education, Content và Influencer Marketing, đang mở rộng ra thị trường toàn cầu — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm marketing của bạn phù hợp với yêu cầu.',
        ko: 'Education·Content·Influencer Marketing 분야에서 글로벌 시장으로 확장 중인 한국 기업 <b>CREATUS</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 마케팅 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>CREATUS</b> — a Korean company in Education, Content and Influencer Marketing expanding globally — viewed your profile on FYI and <b>sent you this position</b> because your marketing experience matches the requirements.',
      },
      initial: 'C', company: 'CREATUS', title: 'Global Content Marketer', meta: 'HCM · Hà Nội · 20–25 triệu', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^creatus-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Global Content Marketer tại CREATUS',
      ko: '[FYI] CREATUS Global Content Marketer 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the CREATUS Global Content Marketer nominee list',
    },
    desc: 'CREATUS 추천 · 비공개 프레임 (7/30): "명단 선정 + 이번 주 담당자 전달 + 우선검토" 훅.',
    source: 'scripts/outreach/marketing-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>CREATUS</b> — công ty Hàn Quốc trong lĩnh vực Education, Content và Influencer Marketing, đang mở rộng ra thị trường Bắc Mỹ và Nhật Bản — đang tuyển Global Content Marketer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '북미·일본 시장으로 확장 중인 Education·Content·Influencer Marketing 한국 기업 <b>CREATUS</b>가 FYI를 통해 Global Content Marketer를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>CREATUS</b> — a Korean company in Education, Content and Influencer Marketing expanding into North America and Japan — is hiring a Global Content Marketer through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'C', company: 'CREATUS', title: 'Global Content Marketer', meta: 'HCM · Hà Nội · 20–25 triệu', tail: BENEFIT_PRIVATE,
    }),
  },
  {
    match: /^electerior-recommend1-public/,
    subject: invitedSubject('Electerior'),
    desc: 'Electerior AI Content Specialist 추천 · 공개 프레임 (7/30): 제작형(디자인·영상·UI/UX) 풀 배정.',
    source: 'scripts/outreach/marketing-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>Electerior</b> — công ty Hàn Quốc trong lĩnh vực nội thất và giải pháp không gian, đang xây dựng hệ thống marketing dựa trên AI — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm sản xuất nội dung của bạn phù hợp với yêu cầu.',
        ko: '인테리어·공간 솔루션 분야에서 AI 기반 마케팅 시스템을 구축 중인 한국 기업 <b>Electerior</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 콘텐츠 제작 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>Electerior</b> — a Korean interior &amp; spatial-solutions company building an AI-driven marketing system — viewed your profile on FYI and <b>sent you this position</b> because your content-production experience matches the requirements.',
      },
      initial: 'E', company: 'Electerior', title: 'AI-based Social Media Content Specialist', meta: 'Hà Nội · HCM · 20–25 triệu', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^electerior-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí AI Content Specialist tại Electerior',
      ko: '[FYI] Electerior AI Content Specialist 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the Electerior AI Content Specialist nominee list',
    },
    desc: 'Electerior 추천 · 비공개 프레임 (7/30): "명단 선정 + 이번 주 담당자 전달 + 우선검토" 훅.',
    source: 'scripts/outreach/marketing-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>Electerior</b> — công ty Hàn Quốc trong lĩnh vực nội thất và giải pháp không gian, đang xây dựng hệ thống marketing và tự động hóa nội dung bằng AI — đang tuyển AI-based Social Media Content Specialist qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '인테리어·공간 솔루션 분야에서 AI 마케팅·콘텐츠 자동화 시스템을 구축 중인 한국 기업 <b>Electerior</b>가 FYI를 통해 AI-based Social Media Content Specialist를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>Electerior</b> — a Korean interior &amp; spatial-solutions company building AI-powered marketing and content automation — is hiring an AI-based Social Media Content Specialist through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'E', company: 'Electerior', title: 'AI-based Social Media Content Specialist', meta: 'Hà Nội · HCM · 20–25 triệu', tail: BENEFIT_PRIVATE,
    }),
  },
  {
    match: /^resume-register-(apply2|jobcard|rest)/,
    subject: {
      vi: '{{name}} ơi, người đăng ký CV nhận trung bình 3,2 lời mời mỗi tuần',
      ko: '{{name}}님, 이력서 등록자는 1주일 평균 3.2건의 오퍼를 받습니다',
      en: '{{name}}, CV registrants get 3.2 offers a week on average',
    },
    desc: '이력서 등록 유도 v2 (8/5): 1차의 조작 수치(월7건·85%) 폐기 → 실측 "1주일 평균 오퍼 3.2건" 단일 스탯 + 이름 개인화 제목 + 연봉협상 앵글(당장 이직 안 해도 오퍼=협상 카드) + 수신거부 신설(/api/coldmail/unsub). apply2=지원버튼 이탈층(apply1 미등록 재접촉 포함) / jobcard1=공고카드 클릭층 / rest1=그 외.',
    source: 'scripts/outreach/resume-register-coldmail.mjs',
    html: registerHtml2,
  },
  {
    match: /^resume-register/,
    subject: {
      vi: '[FYI] Đăng ký CV — trung bình 7 lời mời mỗi tháng',
      ko: '[FYI] CV 등록 — 월 평균 제안 7건',
      en: '[FYI] Register your CV — 7 invitations a month on average',
    },
    desc: '이력서 등록 유도 1차(7/31, all1·apply1 스냅샷): 가입했지만 이력서가 없는 회원 대상. all1=전체 / apply1=지원 버튼까지 눌렀다 이탈한 회원. ※본문 수치(월 7건·85%)는 이후 근거 문제로 퍼블릭 /cv에서 제거된 카피 — 8/5 v2부터 실측 수치로 교체.',
    source: 'scripts/outreach/resume-register-coldmail.mjs',
    html: registerHtml,
  },
]

export const templateFor = (name) => COLDMAIL_TEMPLATES.find((t) => t.match.test(name || '')) || null

// 모달 표시용: 토글 언어에 맞춰 subject/html을 풀어준다. vi=발송 원문, ko/en=열람용 번역본.
export const localizeTemplate = (t, lang) => ({
  ...t,
  subject: typeof t.subject === 'string' ? t.subject : pickLang(t.subject, lang),
  html: typeof t.html === 'function' ? t.html(lang) : t.html,
})
