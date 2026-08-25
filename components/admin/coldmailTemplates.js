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
// ── resume-register-bonus · 축하금 손실 프레임 (resume-register-bonus-coldmail.mjs) ──
// coldmail1에서 검증된 "아직 자격이 없다" 손실 프레임을 미등록자에게 적용.
// 수치는 축하금 금액·실제 지급 조건(/cv cv.how.notice와 동일)만 쓴다.
const REGISTER_BONUS_I18N = {
  vi: {
    greeting: 'Chào {{name}},',
    lead: 'Bạn chưa đủ điều kiện nhận thưởng 1.000.000₫.',
    body: 'Bạn đã có tài khoản FYI nhưng chưa đăng ký CV — vì vậy bạn chưa thể tham gia sự kiện thưởng 1.000.000₫ khi được tuyển qua FYI.',
    stepsIntro: 'Chỉ cần một bước để tham gia:',
    li1: 'Tải lên file CV — khoảng 30 giây, không cần nhập thêm thông tin',
    li2: 'Nhà tuyển dụng phù hợp xem hồ sơ và chủ động liên hệ bạn',
    li3: 'Được tuyển qua FYI → nhận thưởng 1.000.000₫',
    cta: 'Đăng ký CV &amp; tham gia sự kiện →',
    note: 'Không cần đăng nhập · PDF / DOCX · khoảng 30 giây',
    cond: 'Thưởng chỉ áp dụng cho vị trí tại doanh nghiệp Việt Nam, chi trả sau 2 tháng (60 ngày) làm việc.',
    footer: 'Bạn nhận email này vì đã đăng ký tài khoản FYI.<br>salary-fyi.com · Hủy đăng ký',
  },
  ko: {
    greeting: '{{name}}님, 안녕하세요.',
    lead: '아직 1,000,000₫ 축하금 이벤트 대상이 아닙니다.',
    body: 'FYI 계정은 있으신데 아직 CV가 등록되어 있지 않네요 — 그래서 지금은 FYI를 통해 채용될 때 지급되는 1,000,000₫ 취업 축하금 이벤트에 참여하실 수 없습니다.',
    stepsIntro: '참여 방법은 하나뿐입니다:',
    li1: 'CV 파일 업로드 — 약 30초, 추가 입력 없음',
    li2: '맞는 기업이 프로필을 보고 먼저 연락합니다',
    li3: 'FYI를 통해 채용되면 1,000,000₫ 축하금 지급 대상이 됩니다',
    cta: 'CV 올리고 이벤트 참여 →',
    note: '로그인 불필요 · PDF / DOCX · 약 30초',
    cond: '축하금은 베트남 현지 기업 공고에 한해 적용되며, 입사 후 2개월(60일) 근속이 확인된 뒤 지급됩니다.',
    footer: 'FYI에 가입하셔서 이 메일을 받으셨습니다.<br>salary-fyi.com · 수신 거부',
  },
  en: {
    greeting: 'Hi {{name}},',
    lead: 'You\'re not yet eligible for the 1,000,000₫ bonus.',
    body: 'You have an FYI account but no CV registered — so you can\'t yet join the 1,000,000₫ hiring-bonus event for people hired through FYI.',
    stepsIntro: 'Only one step to join:',
    li1: 'Upload your CV file — about 30 seconds, nothing else to fill in',
    li2: 'Matching companies view your profile and reach out first',
    li3: 'Get hired through FYI → receive the 1,000,000₫ bonus',
    cta: 'Register CV &amp; join the event →',
    note: 'No login needed · PDF / DOCX · about 30 seconds',
    cond: 'Applies only to jobs at Vietnam-based companies, paid after 2 months (60 days) of employment.',
    footer: 'You received this email because you have an FYI account.<br>salary-fyi.com · Unsubscribe',
  },
}
const registerBonusHtml = (lang) => {
  const s = pickLang(REGISTER_BONUS_I18N, lang)
  const li = (t) => `<li style="margin:0 0 8px">${t}</li>`
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee"><tr><td align="center" style="padding:32px 16px 40px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
  <tr><td style="font-size:17px;font-weight:800;color:#ff6000;letter-spacing:-0.01em;padding-bottom:14px">FYI</td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;padding:32px 28px 28px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:13.5px;color:#8a8177;padding-bottom:12px">${s.greeting}</td></tr>
      <tr><td style="font-size:20px;font-weight:800;line-height:1.45;padding-bottom:16px;word-break:keep-all">${s.lead}</td></tr>
      <tr><td style="font-size:14px;line-height:1.7;color:#57504a;padding-bottom:18px;word-break:keep-all">${s.body}</td></tr>
      <tr><td style="border-top:1px solid #eeeae4;padding-top:18px;font-size:14px;font-weight:700;padding-bottom:10px">${s.stepsIntro}</td></tr>
      <tr><td><ul style="font-size:14px;line-height:1.6;color:#57504a;margin:0 0 20px;padding-left:20px;word-break:keep-all">${li(s.li1)}${li(s.li2)}${li(s.li3)}</ul></td></tr>
      <tr><td><a style="display:block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px;border-radius:12px;text-align:center">${s.cta}</a></td></tr>
      <tr><td style="font-size:12.5px;color:#9a9186;text-align:center;padding-top:12px">${s.note}</td></tr>
      <tr><td style="font-size:12px;color:#9a9186;line-height:1.6;padding-top:18px;word-break:keep-all">${s.cond}</td></tr>
    </table>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a8a096;text-align:center;line-height:1.6;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}

const invitedSubject = (company) => ({
  vi: `[FYI] ${company} đã xem hồ sơ của bạn và mời bạn ứng tuyển`,
  ko: `[FYI] ${company}가 회원님의 프로필을 보고 지원을 요청했습니다`,
  en: `[FYI] ${company} viewed your profile and invited you to apply`,
})

// ── MNF Solution AI Engineer (LLM) 추천 (mnf-recommend-coldmail.mjs) — JD 요약 문단은 두 프레임 공통.
//    하단부는 세 문단(하는 일 / 요건·근무조건 / 우선검토·원탭)으로 끊는다 — 한 문단이면 안 읽힘. ──
const MNF_LINE = {
  vi: 'Phát triển AI Agent, chatbot tư vấn du lịch, tính năng dịch đa ngôn ngữ và Voice AI với <b>Python · FastAPI · OpenAI API · Claude API · LangChain</b>.<br><br><b>Không yêu cầu kinh nghiệm</b> — chỉ cần nền tảng Python và tinh thần học hỏi; kinh nghiệm AI/LLM là điểm cộng. Làm việc on-site tại <b>Quận 7, TP.HCM</b>, lương thỏa thuận.',
  ko: 'AI Agent·여행 상담 챗봇·다국어 번역·Voice AI를 <b>Python · FastAPI · OpenAI API · Claude API · LangChain</b>으로 개발합니다.<br><br><b>경력 무관</b> — Python 기초와 배우려는 자세면 충분하고, AI/LLM 경험은 우대입니다. <b>호치민 7군(Q7) 온사이트</b>, 급여 협의.',
  en: 'Build AI Agents, a travel-guide chatbot, multilingual translation and Voice AI with <b>Python · FastAPI · OpenAI API · Claude API · LangChain</b>.<br><br><b>No experience required</b> — Python basics and willingness to learn are enough; AI/LLM experience is a plus. On-site in <b>District 7, HCMC</b>, negotiable salary.',
}
const mnfTail = (benefit) => ({
  vi: `${MNF_LINE.vi}<br><br>${benefit.vi}`, ko: `${MNF_LINE.ko}<br><br>${benefit.ko}`, en: `${MNF_LINE.en}<br><br>${benefit.en}`,
})

// ── OpenMinds Full Stack Developer (openminds-recommend-coldmail.mjs) — 훅(언어요건)+JD 요약, 두 프레임 공통 ──
const OPENMINDS_LINE = {
  vi: 'Vị trí này ưu tiên ứng viên Full Stack <b>giao tiếp tốt tiếng Anh hoặc tiếng Hàn</b> — hồ sơ của bạn đáp ứng đúng cả hai tiêu chí đó.<br><br>Phát triển và bảo trì Web/Mobile Application: Front-end (<b>React · Vue · Angular</b>), Back-end (<b>Node.js · Spring Boot · .NET · Django</b>), xây dựng RESTful API và tham gia triển khai, vận hành hệ thống.<br><br>Yêu cầu <b>3–4 năm kinh nghiệm Full Stack</b> và ít nhất 1 dự án đã triển khai thực tế. <b>Không giới hạn địa điểm làm việc</b>. Lương 18–20 triệu.',
  ko: '이 포지션은 <b>영어 또는 한국어 회화가 가능한</b> 풀스택 개발자를 우선합니다 — 회원님의 이력서가 두 조건 모두에 해당합니다.<br><br>웹/모바일 애플리케이션 개발·유지보수: 프론트엔드(<b>React · Vue · Angular</b>), 백엔드(<b>Node.js · Spring Boot · .NET · Django</b>), RESTful API 구축과 배포·운영 참여.<br><br>요건: <b>풀스택 경력 3–4년</b>, 실서비스 배포 프로젝트 1개 이상. <b>근무지 무관</b>. 급여 18–20백만 동.',
  en: 'This position prioritizes Full Stack developers who <b>communicate well in English or Korean</b> — your profile matches both criteria.<br><br>Develop and maintain Web/Mobile applications: Front-end (<b>React · Vue · Angular</b>), Back-end (<b>Node.js · Spring Boot · .NET · Django</b>), build RESTful APIs and join deployment and operations.<br><br>Requires <b>3–4 years of Full Stack experience</b> and at least 1 project deployed to production. <b>No work-location restriction</b>. Salary 18–20M VND.',
}
const openmindsTail = (benefit) => ({
  vi: `${OPENMINDS_LINE.vi}<br><br>${benefit.vi}`, ko: `${OPENMINDS_LINE.ko}<br><br>${benefit.ko}`, en: `${OPENMINDS_LINE.en}<br><br>${benefit.en}`,
})

// 순서대로 첫 매치 사용 — 접두어가 겹치는 항목(coldmail-ktc*)은 구체적인 것을 앞에 둘 것.
// ── 프로필 사진 등록(photo1): 대기 리스트 미선정(사유: 사진 없음) 프레임 ──
const PHOTO_I18N = {
  vi: {
    greeting: 'Chào <b>{{name}}</b>,',
    p1: 'Gần đây, một nhà tuyển dụng đã đưa hồ sơ của bạn vào <b>danh sách chờ (vòng 1)</b> để gửi offer. Nhưng rất tiếc, bạn đã <b style="color:#d92d20">không được chọn</b> vào danh sách cuối cùng.',
    p2: 'Lý do: hồ sơ của bạn <b>chưa có ảnh đại diện</b>.',
    p3: 'Các nhà tuyển dụng thường loại những hồ sơ không có ảnh khỏi danh sách đề cử. Để không bỏ lỡ cơ hội tiếp theo, hãy thêm ảnh hồ sơ ngay — <b>chưa đến 1 phút</b>, không cần đăng nhập. Hồ sơ có ảnh có khả năng nhận offer cao hơn <b>62%</b>.',
    cta: 'Thêm ảnh trong 1 phút →',
    tail: 'Chọn 1 ảnh chân dung rõ mặt — ảnh sẽ được cập nhật ngay và áp dụng từ danh sách đề cử tiếp theo.',
    footer: '— Đội ngũ FYI · salary-fyi.com · <u>Hủy nhận email</u>',
  },
  ko: {
    greeting: '안녕하세요 <b>{{name}}</b>님,',
    p1: '최근 기업 담당자님이 오퍼 발송을 위해 회원님 프로필을 <b>1차 대기 리스트</b>에 올렸습니다. 그런데 아쉽게 최종 명단에는 <b style="color:#d92d20">선정되지 않았습니다</b>.',
    p2: '사유: 프로필에 <b>사진이 없어서</b>입니다.',
    p3: '기업 담당자들은 사진이 없는 프로필을 추천 명단에서 제외하는 경우가 많습니다. 다음 기회를 놓치지 않게 지금 프로필 사진을 등록해 주세요 — <b>1분도 걸리지 않습니다</b>. 사진이 있는 프로필은 오퍼 확률이 <b>62%</b> 더 높습니다.',
    cta: '1분 만에 사진 추가하기 →',
    tail: '얼굴이 잘 나온 사진 한 장을 고르면 프로필에 바로 반영되고, 다음 추천 명단부터 적용됩니다.',
    footer: '— FYI 팀 · salary-fyi.com · <u>수신거부</u>',
  },
  en: {
    greeting: 'Hi <b>{{name}}</b>,',
    p1: 'Recently, a recruiter put your profile on the <b>round-1 shortlist</b> for an offer. Unfortunately, you were <b style="color:#d92d20">not selected</b> for the final list.',
    p2: 'Reason: your profile has <b>no photo</b>.',
    p3: 'Recruiters often drop photo-less profiles from nominee lists. Don\'t miss the next chance — add a photo now, it takes <b>under a minute</b>, no login needed. Profiles with a photo are <b>62%</b> more likely to receive an offer.',
    cta: 'Add a photo in 1 minute →',
    tail: 'Pick one clear headshot — it updates instantly and applies from the next nominee list.',
    footer: '— The FYI team · salary-fyi.com · <u>Unsubscribe</u>',
  },
}
// ── 프로필 사진 재발송(photo-remind1): "그때 사진 올린 사람들은 3일 내 오퍼 1~2건" 사회적 증거 프레임 ──
const PHOTO_REMIND_I18N = {
  vi: {
    greeting: 'Chào <b>{{name}}</b>,',
    p1: 'Lần trước, chúng tôi đã thông báo rằng hồ sơ của bạn bị loại khỏi danh sách đề cử nhận offer vì <b>chưa có ảnh đại diện</b>.',
    p2: 'Kể từ đó, hầu hết những người đã thêm ảnh hồ sơ đều nhận được <b>1–2 offer</b> từ nhà tuyển dụng <b>chỉ trong vòng 3 ngày</b>.',
    p3: 'Chưa có kế hoạch chuyển việc ngay? Không sao cả. Nhận offer và trải nghiệm phỏng vấn cũng là cơ hội tốt để kiểm tra giá trị của bạn trên thị trường tuyển dụng và phát triển sự nghiệp.',
    p4: 'Thêm ảnh chỉ mất <b>chưa đến 1 phút</b>, không cần đăng nhập:',
    cta: 'Thêm ảnh trong 1 phút →',
    tail: 'Chọn 1 ảnh chân dung rõ mặt — ảnh sẽ được áp dụng ngay từ danh sách đề cử tiếp theo.',
    footer: '— Đội ngũ FYI · salary-fyi.com · <u>Hủy nhận email</u>',
  },
  ko: {
    greeting: '안녕하세요 <b>{{name}}</b>님,',
    p1: '지난번에 프로필에 <b>사진이 없어</b> 오퍼 추천 명단에서 제외되었다는 안내를 드렸습니다.',
    p2: '그 뒤 사진을 추가한 분들 대부분이 <b>3일 이내에</b> 기업 담당자로부터 오퍼 제안을 <b>1~2건</b> 받았습니다.',
    p3: '당장 이직 계획이 없으셔도 괜찮습니다. 오퍼를 받아보고 면접을 경험하는 것만으로도 내 시장가치를 확인하고 커리어를 발전시키는 좋은 기회가 됩니다.',
    p4: '사진 추가는 <b>1분이면 됩니다</b>. 로그인도 필요 없습니다:',
    cta: '1분 만에 사진 추가하기 →',
    tail: '얼굴이 잘 나온 사진 한 장을 고르면 다음 추천 명단부터 바로 반영됩니다.',
    footer: '— FYI 팀 · salary-fyi.com · <u>수신거부</u>',
  },
  en: {
    greeting: 'Hi <b>{{name}}</b>,',
    p1: 'Last time, we let you know your profile was left off an offer nominee list because it had <b>no photo</b>.',
    p2: 'Since then, most people who added a photo received <b>1–2 offers</b> from recruiters <b>within 3 days</b>.',
    p3: 'Not planning to switch jobs right now? That\'s fine — receiving offers and interviewing is a great way to gauge your market value and grow your career.',
    p4: 'Adding a photo takes <b>under a minute</b>, no login needed:',
    cta: 'Add a photo in 1 minute →',
    tail: 'Pick one clear headshot — it applies from the next nominee list.',
    footer: '— The FYI team · salary-fyi.com · <u>Unsubscribe</u>',
  },
}
const photoRemindHtml = (lang) => {
  const s = pickLang(PHOTO_REMIND_I18N, lang)
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">${s.greeting}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">${s.p1}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">${s.p2}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">${s.p3}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">${s.p4}</p>
    <div style="text-align:center;margin:0 0 20px">
      <span style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">${s.cta}</span>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">${s.tail}</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">${s.footer}</p>
</div></body></html>`
}

const photoColdmailHtml = (lang) => {
  const s = pickLang(PHOTO_I18N, lang)
  return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;margin-bottom:20px">FYI</div>
  <div style="background:#fff;border:1px solid #eee5da;border-radius:18px;padding:30px 26px">
    <p style="font-size:15px;margin:0 0 14px">${s.greeting}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">${s.p1}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px">${s.p2}</p>
    <p style="font-size:14.5px;line-height:1.6;margin:0 0 20px">${s.p3}</p>
    <div style="text-align:center;margin:0 0 20px">
      <span style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">${s.cta}</span>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#8a8073;margin:0">${s.tail}</p>
  </div>
  <p style="font-size:11.5px;color:#a89f92;text-align:center;margin:18px 0 0;line-height:1.5">${s.footer}</p>
</div></body></html>`
}

/* ── PRESTO SOLUTION 로봇/모션제어 SW (presto-recommend-coldmail.mjs) ──
   추천 계열이지만 recommendShell 을 못 쓴다. 셋이 다르다:
   (1) intro 다음에 개인화 후크 문단이 하나 더 붙는다 — 수신자의 이력서가 이 자리와 어디서
       만나는지 지목하는 줄로, 세그먼트(제어/비전/임베디드/GUI/전공/일반) 여섯 벌 중 하나가 나간다.
   (2) 카드 아래에 자격요건·복리후생 줄이 따로 있다(요건이 좁아 본문에서 걸러 주려고).
   (3) 푸터에 수신거부가 있다 — 이 캠페인부터 넣기 시작했다. 기존 recommendShell 을 고치면
       수신거부 없이 나갔던 이전 캠페인의 스냅샷까지 바뀌므로 셸을 따로 둔다. */
const PRESTO_I18N = {
  vi: {
    greeting: 'Chào {{name}},',
    hook: '{{후크 — 세그먼트별 1줄. 예(vision): Vị trí này phát triển phần mềm điều khiển dựa trên hệ thống <b>Laser &amp; Vision</b>, nên kinh nghiệm <b>xử lý ảnh / Computer Vision</b> của bạn dùng được ngay.}}',
    position: 'Thiết kế phần mềm điều khiển robot công nghiệp bằng Motion Controller, phát triển ứng dụng cho thiết bị và module phân tích dữ liệu điều khiển (ứng dụng AI).',
    req: 'Yêu cầu: hiểu biết <b>C/C++ hoặc C# (WinForm, WPF)</b> · tốt nghiệp Khoa học máy tính / Điện tử / Điều khiển · có thể đi công tác nước ngoài và lái xe. <b>Kinh nghiệm 1–5 năm.</b>',
    benefit: 'Lương thỏa thuận theo năng lực · hỗ trợ chi phí visa đi Hàn Quốc · thưởng theo kết quả kinh doanh.',
    onetap: 'Chỉ cần <b>1 chạm</b> — CV đã đăng ký của bạn sẽ được gửi tự động.',
    cta: 'Ứng tuyển 1 chạm →',
    jd: 'Xem mô tả công việc đầy đủ →',
    footer: 'Bạn nhận được email này vì đã đăng ký hồ sơ trên FYI.<br>— Đội ngũ FYI · salary-fyi.com/jobs · <u>Hủy đăng ký</u>',
  },
  ko: {
    greeting: '{{name}}님, 안녕하세요.',
    hook: '{{후크 — 세그먼트별 1줄. 예(비전): 이 포지션은 <b>레이저 및 비전 시스템</b> 기반 제어 소프트웨어를 개발합니다. 회원님의 <b>영상처리 · 컴퓨터 비전</b> 경험을 바로 쓸 수 있습니다.}}',
    position: 'Motion Controller를 활용한 산업용 로봇 제어 소프트웨어 설계, 장비 응용 SW 및 제어 데이터 분석 모듈(AI 응용) 개발.',
    req: '자격요건: <b>C/C++ 또는 C# (WinForm, WPF)</b>에 대한 이해 · 컴퓨터공학 / 전자 / 제어 전공 · 해외 출장 및 운전 가능. <b>경력 1~5년.</b>',
    benefit: '연봉 회사 내규(경력별 상이) · 한국 비자 발급비 지원 · 경영성과급.',
    onetap: '<b>한 번의 클릭</b>이면 등록된 CV가 자동으로 전달됩니다.',
    cta: '원클릭 지원하기 →',
    jd: '채용공고 전문 보기 →',
    footer: 'FYI에 이력서를 등록하셔서 이 메일을 받으셨습니다.<br>— FYI 팀 · salary-fyi.com/jobs · <u>수신 거부</u>',
  },
  en: {
    greeting: 'Hi {{name}},',
    hook: '{{hook — one line per segment. e.g. (vision): This role builds control software on top of <b>Laser &amp; Vision</b> systems, so your <b>image processing / computer vision</b> experience applies directly.}}',
    position: 'Design industrial robot control software using a Motion Controller, build equipment applications and control-data analysis modules (AI applications).',
    req: 'Requirements: understanding of <b>C/C++ or C# (WinForm, WPF)</b> · degree in Computer Science / Electronics / Control · able to travel abroad and drive. <b>1–5 years of experience.</b>',
    benefit: 'Negotiable salary · Korea visa cost support · performance bonus.',
    onetap: 'Just <b>1 tap</b> — your registered CV is sent automatically.',
    cta: '1-tap apply →',
    jd: 'See the full job description →',
    footer: 'You received this email because you registered a profile on FYI.<br>— The FYI team · salary-fyi.com/jobs · <u>Unsubscribe</u>',
  },
}

const prestoShell = (lang, { intro, tail }) => {
  const s = pickLang(PRESTO_I18N, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${s.greeting}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${pickLang(intro, lang)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:18px">${s.hook}</td></tr>
  <tr><td style="padding-bottom:14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px"><tr>
      <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle"><div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">P</div></td>
      <td style="padding:14px 14px 14px 12px;vertical-align:middle">
        <div style="font-size:12px;color:#8a8073;margin-bottom:3px">PRESTO SOLUTION</div>
        <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">Software Engineer — Robot &amp; Motion Control</div>
        <div style="font-size:12px;color:#b0691a;margin-top:3px">HCM · Đà Nẵng · Hà Nội · Onsite</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:8px">${s.position}</td></tr>
  <tr><td style="font-size:13.5px;line-height:1.6;color:#6b6357;padding-bottom:6px">${s.req}<br>${s.benefit}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:10px">${pickLang(tail, lang)} ${s.onetap}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${s.cta}</a>
  </td></tr>
  <tr><td align="center" style="font-size:12.5px;padding-bottom:4px"><a style="color:#8a8073">${s.jd}</a></td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}

const PRESTO_INTRO = {
  public: {
    vi: 'Nhà tuyển dụng của <b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên giải pháp Motion Control &amp; tự động hóa cho ngành bán dẫn, màn hình và robot công nghiệp — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b>.',
    ko: '반도체·디스플레이·산업용 로봇 분야의 Motion Control 및 자동화 솔루션 기업 <b>PRESTO SOLUTION</b>의 채용 담당자가 FYI에서 회원님의 이력서를 보고 <b>이 포지션을 보내드렸습니다</b>.',
    en: 'A recruiter at <b>PRESTO SOLUTION</b> — a Korean company providing Motion Control and automation solutions for semiconductor, display and industrial robot lines — viewed your CV on FYI and <b>sent you this position</b>.',
  },
  private: {
    vi: '<b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên giải pháp Motion Control &amp; tự động hóa cho ngành bán dẫn, màn hình và robot công nghiệp — đang tuyển Software Engineer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
    ko: '반도체·디스플레이·산업용 로봇 분야의 Motion Control 및 자동화 솔루션 기업 <b>PRESTO SOLUTION</b>이 FYI를 통해 Software Engineer를 채용합니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>추천 후보 명단에 선정</b>했습니다.',
    en: '<b>PRESTO SOLUTION</b> — a Korean company providing Motion Control and automation solutions for semiconductor, display and industrial robot lines — is hiring a Software Engineer through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
  },
}

// ── D+3 지원미달 3공고 추천 (d3-recommend-coldmail.mjs) — JD 요약 두 문단은 프레임 공통.
const d3Tail = (line1, line2) => (benefit) => ({
  vi: `${line1.vi}<br><br>${line2.vi}<br><br>${benefit.vi}`,
  ko: `${line1.ko}<br><br>${line2.ko}<br><br>${benefit.ko}`,
  en: `${line1.en}<br><br>${line2.en}<br><br>${benefit.en}`,
})
const PRESTO_MOTION_TAIL = d3Tail({
  vi: 'Phát triển và triển khai ứng dụng <b>Laser & Motion Control</b> — lập trình hệ thống điều khiển chuyển động (Servo, EtherCAT, Multi-axis) cho thiết bị tự động hóa.',
  ko: '<b>Laser & Motion Control</b> 애플리케이션 개발 — 자동화 장비의 모션 제어 시스템(Servo·EtherCAT·다축 보간)을 프로그래밍합니다.',
  en: 'Develop and deploy <b>Laser & Motion Control</b> applications — programming motion-control systems (Servo, EtherCAT, multi-axis) for automation equipment.',
}, {
  vi: '<b>Không yêu cầu kinh nghiệm</b> — công ty đào tạo chuyên sâu về Motion Control từ đầu; chỉ cần nền tảng kỹ thuật (tự động hóa, điện – điện tử, cơ điện tử, CNTT) và khả năng đọc tài liệu tiếng Anh. Làm việc <b>onsite tại Hàn Quốc</b>, lương thỏa thuận theo năng lực, hỗ trợ 300.000 điểm PAYCO/tháng.',
  ko: '<b>경력 무관</b> — 모션컨트롤은 입사 후 처음부터 교육하며, 공학 기초(자동화·전기전자·메카트로닉스·CS)와 영어 문서 독해면 충분합니다. <b>한국 온사이트</b>, 급여 협의, 월 PAYCO 30만 포인트 지원.',
  en: '<b>No experience required</b> — the company trains you in Motion Control from scratch; an engineering foundation (automation, electrical/electronics, mechatronics, CS) and reading English documentation are enough. <b>Onsite in Korea</b>, negotiable salary, 300,000 PAYCO points/month.',
})
const PRESTO_SALES_TAIL = d3Tail({
  vi: 'Phụ trách kinh doanh bộ điều khiển chuyển động <b>ACS</b> và các sản phẩm tự động hóa (Servo, I/O) cho khách hàng trong ngành <b>bán dẫn, màn hình (LCD/OLED), pin và robot</b>.',
  ko: '<b>ACS</b> 모션컨트롤러와 자동화 제품(Servo·I/O)을 <b>반도체·디스플레이(LCD/OLED)·배터리·로봇</b> 고객사에 영업합니다.',
  en: 'Sell <b>ACS</b> motion controllers and automation products (Servo, I/O) to customers in <b>semiconductors, displays (LCD/OLED), batteries and robotics</b>.',
}, {
  vi: 'Ưu tiên ứng viên có nền tảng kỹ thuật điện / điện tử / điều khiển / cơ khí hoặc kinh nghiệm bán hàng B2B công nghiệp. Làm việc tại <b>HCM · Đà Nẵng · Hà Nội</b>, lương thỏa thuận theo năng lực, có cơ hội công tác nước ngoài (công ty hỗ trợ chi phí visa đi Hàn Quốc).',
  ko: '전기·전자·제어·기계 배경 또는 산업재 B2B 영업 경험 우대. <b>호치민 · 다낭 · 하노이</b> 근무, 급여 협의, 해외 출장 기회(한국행 비자 비용 지원).',
  en: 'Preference for an electrical / electronics / control / mechanical background or industrial B2B sales experience. Based in <b>HCM · Da Nang · Hanoi</b>, negotiable salary, overseas business trips (Korea visa costs covered).',
})
const LIONROCKET_TAIL = d3Tail({
  vi: 'Sáng tạo nội dung quảng cáo — <b>short-form video, hình ảnh, UGC</b> — cho các kênh <b>Meta · TikTok · Instagram</b>, tìm insight và thử nghiệm nhiều format (Before/After, UGC, reaction).',
  ko: '<b>Meta · TikTok · Instagram</b> 광고 콘텐츠(<b>숏폼 영상·이미지·UGC</b>)를 제작하고, 인사이트 발굴과 포맷 실험(Before/After·UGC·리액션)을 진행합니다.',
  en: 'Create ad content — <b>short-form video, images, UGC</b> — for <b>Meta · TikTok · Instagram</b>, finding insights and testing formats (Before/After, UGC, reaction).',
}, {
  vi: 'Theo dõi CPA/ROAS của chính nội dung mình làm và cải thiện dựa trên dữ liệu. Làm việc tại <b>HCM · Đà Nẵng · Hà Nội</b>, lương <b>20–25 triệu</b>.',
  ko: '본인이 만든 콘텐츠의 CPA/ROAS를 직접 보며 데이터 기반으로 개선합니다. <b>호치민 · 다낭 · 하노이</b> 근무, 급여 <b>20–25 triệu</b>.',
  en: 'Track the CPA/ROAS of your own content and iterate on real data. Based in <b>HCM · Da Nang · Hanoi</b>, salary <b>20–25M VND</b>.',
})
// ── 현/직전연봉 수집 salary1 (scripts/outreach/salary-coldmail.mjs) ──
const SALARY_I18N = {
  vi: {
    hi: 'Chào {{name}},',
    p1: 'FYI đang trực tiếp tiến cử hồ sơ của bạn với các công ty. Khi biết mức lương của bạn, chúng tôi có thể <b>chỉ chọn những công ty có mức lương khiến bạn thực sự hài lòng</b> để tiến cử — mục tiêu của chúng tôi là giúp bạn chuyển việc với mức lương cao hơn.',
    p2: 'Vì vậy, chỉ cần cho chúng tôi biết <b>lương tháng hiện tại (hoặc ở công việc gần nhất)</b> của bạn — một con số, không cần đăng nhập, 30 giây. Thông tin này <b>không hiển thị với công ty</b>, chỉ dùng để chọn công ty xứng đáng với bạn.',
    cta: 'Nhập mức lương (30 giây) →',
    thanks: 'Cảm ơn bạn!<br>— Đội ngũ FYI',
    footer: 'Bạn nhận được email này vì đã đăng ký tài khoản trên FYI.',
  },
  ko: {
    hi: '안녕하세요 {{name}}님,',
    p1: 'FYI는 회원님 프로필을 기업에 직접 추천하고 있어요. 연봉을 알면 <b>정말 만족할 만한 연봉의 기업만 골라서</b> 추천할 수 있습니다 — 저희 목표는 회원님이 더 높은 연봉으로 이직하는 거예요.',
    p2: '그래서 <b>현재(또는 직전 직장) 월급</b> 숫자 하나만 부탁드려요 — 로그인 없이 30초면 됩니다. 이 정보는 <b>기업에 공개되지 않고</b>, 회원님이 만족할 기업을 고르는 데만 사용돼요.',
    cta: '연봉 입력하기 (30초) →',
    thanks: '감사합니다!<br>— FYI 팀 드림',
    footer: 'FYI에 가입하셔서 이 메일을 받으셨습니다.',
  },
  en: {
    hi: 'Hi {{name}},',
    p1: 'FYI is directly recommending your profile to companies. Once we know your salary, we can <b>recommend you only to companies whose pay would truly satisfy you</b> — our goal is to help you move to a higher salary.',
    p2: 'So please just tell us <b>your monthly salary at your current (or most recent) job</b> — one number, no login, 30 seconds. This is <b>never shown to companies</b>; it is only used to pick companies that deserve you.',
    cta: 'Enter my salary (30s) →',
    thanks: 'Thank you!<br>— The FYI team',
    footer: 'You received this email because you signed up on FYI.',
  },
}

// B 프레임(salary-b, 8/13 A/B) — photo1 검증 구조: 후보에 올랐다(기회)+연봉 미확인 보류(손실)+숫자 하나면 재개(복구).
const SALARY_B_I18N = {
  vi: {
    ...SALARY_I18N.vi,
    p1: 'Người phụ trách đã đưa hồ sơ của bạn vào <b>danh sách đề cử cho các công ty</b>. Nhưng vì chưa biết mức lương hiện tại của bạn, chúng tôi không thể xác nhận vị trí có phù hợp mức lương hay không — <b>quá trình xem xét đang bị tạm dừng</b>.',
    p2: 'Chỉ cần cho chúng tôi biết <b>lương tháng hiện tại (hoặc ở công việc gần nhất)</b> — một con số, không cần đăng nhập, 30 giây — <b>việc xem xét sẽ được tiếp tục ngay</b>. Thông tin này <b>không hiển thị với công ty</b>.',
    cta: 'Nhập mức lương để tiếp tục xem xét →',
  },
  ko: {
    ...SALARY_I18N.ko,
    p1: '담당자가 회원님 프로필을 <b>기업 추천 후보</b>에 올렸습니다. 그런데 현재 연봉을 몰라 연봉이 맞는 포지션인지 확인을 못 해 <b>검토가 멈춰 있어요</b>.',
    p2: '<b>현재(또는 직전 직장) 월급</b> 숫자 하나만 알려주시면 <b>검토가 바로 재개됩니다</b> — 로그인 없이 30초. 이 정보는 <b>기업에 공개되지 않아요</b>.',
    cta: '연봉 입력하고 검토 재개하기 →',
  },
  en: {
    ...SALARY_I18N.en,
    p1: 'A manager put your profile on the <b>nomination list for companies</b>. But without your current salary we cannot confirm whether the positions match your pay — <b>the review is on hold</b>.',
    p2: 'Just tell us <b>your monthly salary at your current (or most recent) job</b> — one number, no login, 30 seconds — and <b>the review resumes right away</b>. This is <b>never shown to companies</b>.',
    cta: 'Enter my salary to resume the review →',
  },
}

// C 프레임(salary-c, 8/19 재발송): B의 '보류'보다 강한 손실 — 1차 대기 리스트 등재→연봉 미확인으로
// 최종 명단 탈락→숫자 하나면 다음 명단. 62% 수치는 기업 VOC 실측(유저 확정 8/19).
const SALARY_C_I18N = {
  vi: {
    ...SALARY_I18N.vi,
    p1: 'Gần đây, khi chọn ứng viên để gửi offer cho doanh nghiệp, người phụ trách đã đưa hồ sơ của bạn vào <b>danh sách chờ vòng 1</b>. Nhưng rất tiếc, hồ sơ của bạn <b>không được chọn vào danh sách cuối cùng</b>.<br><br>Lý do: <b>chưa xác nhận được mức lương hiện tại của bạn</b>.',
    p2: 'Khi chưa biết mức lương, chúng tôi không thể xác định vị trí nào có điều kiện khiến bạn hài lòng, nên hồ sơ chưa xác nhận lương thường bị loại khỏi danh sách đề cử. Để không bỏ lỡ cơ hội tiếp theo, chỉ cần cho chúng tôi biết <b>lương tháng hiện tại (hoặc ở công việc gần nhất)</b> — một con số, không cần đăng nhập, 30 giây. <b>Hồ sơ đã xác nhận mức lương có tỷ lệ nhận offer cao hơn 62%.</b> Thông tin này <b>không hiển thị với công ty</b>.',
    cta: 'Nhập mức lương để vào danh sách tiếp theo →',
  },
  ko: {
    ...SALARY_I18N.ko,
    p1: '최근 기업에 보낼 오퍼 후보를 추리면서 담당자가 회원님 프로필을 <b>1차 대기 리스트</b>에 올렸습니다. 그런데 아쉽게도 <b>최종 명단에는 선정되지 못했습니다</b>.<br><br>사유: <b>현재 연봉이 확인되지 않아서</b>입니다.',
    p2: '연봉을 모르면 어떤 포지션이 회원님께 만족스러운 조건인지 판단할 수 없어, 연봉 미확인 프로필은 추천 명단에서 제외되는 경우가 많습니다. 다음 기회를 놓치지 않도록 <b>현재(또는 직전 직장) 월급</b> 숫자 하나만 알려주세요 — 로그인 없이 30초면 됩니다. <b>연봉이 확인된 프로필은 오퍼 확률이 62% 더 높습니다.</b> 이 정보는 <b>기업에 공개되지 않아요</b>.',
    cta: '연봉 입력하고 다음 명단에 오르기 →',
  },
  en: {
    ...SALARY_I18N.en,
    p1: 'Recently, while shortlisting candidates for company offers, a manager put your profile on the <b>round-1 waiting list</b>. Unfortunately, your profile <b>was not selected for the final list</b>.<br><br>Reason: <b>we could not confirm your current salary</b>.',
    p2: 'Without your salary we cannot tell which positions would truly satisfy you, so profiles with unconfirmed salary are often dropped from nomination lists. To not miss the next opportunity, just tell us <b>your monthly salary at your current (or most recent) job</b> — one number, no login, 30 seconds. <b>Profiles with a confirmed salary are 62% more likely to receive an offer.</b> This is <b>never shown to companies</b>.',
    cta: 'Enter my salary to make the next list →',
  },
}

const renderSalaryMail = (i18n) => (lang) => {
  const s = pickLang(i18n, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${s.hi}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${s.p1}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:6px">${s.p2}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${s.cta}</a>
  </td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:14px">${s.thanks}</td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">${s.footer}<br>— FYI · salary-fyi.com</td></tr>
</table></td></tr></table></body></html>`
}
const salaryHtml = renderSalaryMail(SALARY_I18N)
const salaryBHtml = renderSalaryMail(SALARY_B_I18N)
const salaryCHtml = renderSalaryMail(SALARY_C_I18N)

// ── KYNDOF·Collective 추천 (8/14, scripts/outreach/kyndof-recommend-coldmail.mjs) ──
// 14개 공고(KYN4001~4014)를 9개 발송 그룹으로 통합(1인 1통 배정), gpt-4o-mini 채점 4점+(ops1만 3점+).
// 통합 그룹 메일은 공고 카드가 최대 2개(대상자가 통과한 공고만 — 1개일 수도 있다). 프레임:
// public=공개 이력서(명단에 프로필 동봉), private=비공개(지원 시 CV 전달) — 둘 다 "이번 주
// 담당자에게 명단 전달"을 약속하므로 발송 후 킨도프 측에 추천 명단 실제 공유 의무.
const KYNDOF_I18N = {
  intro: {
    vi: '<b>KYNDOF</b> — công ty Hàn Quốc vận hành thương hiệu thời trang <b>2000Archives</b>, tổ chức sản xuất trang phục theo yêu cầu <b>2000Atelier</b> và nền tảng marketplace thời trang C2C <b>Collective</b> — đang tuyển dụng đồng thời nhiều vị trí then chốt qua FYI.',
    ko: '패션 브랜드 <b>2000Archives</b>, 맞춤 제작 <b>2000Atelier</b>, C2C 패션 마켓플레이스 <b>Collective</b>를 운영하는 한국 기업 <b>KYNDOF</b>가 FYI를 통해 주요 포지션을 동시 채용 중입니다.',
    en: '<b>KYNDOF</b> — a Korean company running the fashion brand <b>2000Archives</b>, the made-to-order studio <b>2000Atelier</b> and the C2C fashion marketplace <b>Collective</b> — is hiring for multiple key positions at once through FYI.',
  },
  hook: {
    vi: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí dưới đây — hồ sơ của bạn phù hợp với yêu cầu của vị trí này.',
    ko: 'FYI 팀이 등록된 이력서 전체를 검토해 회원님을 아래 포지션의 <b>추천 명단에 선정</b>했습니다 — 회원님의 이력이 이 포지션 요건에 부합합니다.',
    en: 'The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> for the position below — your experience matches its requirements.',
  },
  benefit: {
    public: {
      vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của KYNDOF. Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.',
      ko: '<b>이번 주에</b> FYI가 킨도프 채용 담당자에게 추천 명단을 직접 전달합니다. 회원님 이력서는 공개 상태라 명단과 함께 프로필이 전달됩니다. 지금 지원하시면 FYI의 추천과 함께 <b>우선 검토</b>됩니다.',
      en: '<b>This week</b>, FYI will send the nominee list directly to KYNDOF\'s recruiter. Your resume is public, so your profile goes with the list. Apply now and your CV gets <b>priority review</b> with FYI\'s recommendation.',
    },
    private: {
      vi: '<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của KYNDOF. Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
      ko: '<b>이번 주에</b> FYI가 킨도프 채용 담당자에게 추천 명단을 직접 전달합니다. 회원님 이력서는 비공개 상태라, 지금 지원하시면 CV가 FYI의 추천과 함께 전달되어 <b>우선 검토</b>됩니다.',
      en: '<b>This week</b>, FYI will send the nominee list directly to KYNDOF\'s recruiter. Your resume is private — apply now and your CV goes with FYI\'s recommendation and gets <b>priority review</b>.',
    },
  },
}
const KYNDOF_GROUPS = [
  { key: 'tech1', role: { vi: 'Tech Lead / Backend Marketplace', ko: '테크리드·백엔드', en: 'Tech Lead / Backend (Marketplace)' }, jobs: ['Tech Lead / Engineering Manager', 'Backend Marketplace'] },
  { key: 'growth1', role: { vi: 'Growth Marketing & Marketplace Marketing', ko: '그로스 마케팅', en: 'Growth & Marketplace Marketing' }, jobs: ['Growth Marketing & Cộng đồng', 'Growth & Marketplace Marketing Manager'] },
  { key: 'design1', role: { vi: 'Graphic Designer / Product Designer UX·UI', ko: '그래픽·프로덕트 디자이너', en: 'Graphic / Product Designer (UX·UI)' }, jobs: ['Graphic Designer/ Editor', 'Product Designer UX/UI'] },
  { key: 'mobile1', role: { vi: 'Kỹ sư Frontend (Ứng dụng Di động)', ko: '프론트엔드(모바일 앱)', en: 'Frontend Engineer (Mobile App)' }, jobs: ['Kỹ sư Frontend (Ứng dụng Di động)'] },
  { key: 'ops1', role: { vi: 'Vận hành TMĐT & Marketplace', ko: '이커머스·마켓플레이스 운영', en: 'E-commerce & Marketplace Operations' }, jobs: ['Nhân viên Vận hành Thương mại điện tử & Chăm sóc khách hàng', 'Marketplace Operations Manager'] },
  { key: 'data1', role: { vi: 'Kỹ sư Tự động hóa & Vận hành Dữ liệu', ko: '자동화·데이터 운영 엔지니어', en: 'Automation & Data Operations Engineer' }, jobs: ['Kỹ sư Tự động hóa & Vận hành Dữ liệu'] },
  { key: 'atelier1', role: { vi: 'Vận hành Kinh doanh & Dự án Atelier', ko: 'Atelier 사업·프로젝트 운영', en: 'Atelier Business & Project Operations' }, jobs: ['Nhân viên Vận hành Kinh doanh & Dự án Atelier'] },
  { key: 'research1', role: { vi: 'Associate Nghiên cứu & Vận hành', ko: '리서치·운영 Associate', en: 'Research & Operations Associate' }, jobs: ['Associate Nghiên cứu & Vận hành'] },
  { key: 'pm1', role: { vi: 'Product Manager / Hoạch định Dịch vụ', ko: 'PM/서비스기획', en: 'Product Manager / Service Planning' }, jobs: ['Product Manager / Chuyên viên Hoạch định Dịch vụ'] },
]
const kyndofCard = (title) => `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:8px"><tr>
  <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle"><div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">K</div></td>
  <td style="padding:14px 14px 14px 12px;vertical-align:middle">
    <div style="font-size:12px;color:#8a8073;margin-bottom:3px">KYNDOF · Collective</div>
    <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">${title}</div>
    <div style="font-size:12px;color:#b0691a;margin-top:3px">HCM, ĐN, HN</div>
  </td>
</tr></table>`
const kyndofHtml = (frame, g) => (lang) => {
  const s = pickLang(SHELL_I18N, lang)
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:18px"><img src="https://salary-fyi.com/fyi-logo.png" height="24" alt="FYI" style="height:24px;width:auto;display:block"></td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#1a1612;padding-bottom:6px">${s.greeting}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${pickLang(KYNDOF_I18N.intro, lang)}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-bottom:14px">${pickLang(KYNDOF_I18N.hook, lang)}</td></tr>
  <tr><td style="padding-bottom:10px">${g.jobs.map(kyndofCard).join('')}</td></tr>
  <tr><td style="font-size:14px;line-height:1.65;color:#4a443c;padding-top:4px">${pickLang(KYNDOF_I18N.benefit[frame], lang)} ${s.onetap}</td></tr>
  <tr><td align="center" style="padding:16px 0 6px">
    <a style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 30px;border-radius:12px">${s.cta}</a>
  </td></tr>
  <tr><td style="font-size:11.5px;color:#a89f92;text-align:center;line-height:1.5;padding-top:20px">${s.footer}</td></tr>
</table></td></tr></table></body></html>`
}
const KYNDOF_TEMPLATES = KYNDOF_GROUPS.flatMap((g) => ['public', 'private'].map((frame) => ({
  match: new RegExp(`^kyndof\\d?-${g.key}-${frame}`), // kyndof2-* = 웨이브2(8/18 컷 완화)
  subject: frame === 'public'
    ? {
      vi: `[FYI] Bạn được chọn vào danh sách đề cử gửi KYNDOF — ${g.role.vi}`,
      ko: `[FYI] KYNDOF 추천 명단에 선정되셨습니다 — ${g.role.ko}`,
      en: `[FYI] You're on the nominee list sent to KYNDOF — ${g.role.en}`,
    }
    : {
      vi: `[FYI] Bạn được chọn vào danh sách đề cử — ${g.role.vi} tại KYNDOF·Collective`,
      ko: `[FYI] 추천 후보 명단에 선정되셨습니다 — KYNDOF·Collective ${g.role.ko}`,
      en: `[FYI] You've been selected for the nominee list — ${g.role.en} at KYNDOF·Collective`,
    },
  desc: `킨도프 ${g.role.ko} 추천 · ${frame === 'public' ? '공개' : '비공개'} 프레임 (8/14): 14개 공고→9그룹 통합·1인 1통, gpt-4o-mini 채점 ${g.key === 'ops1' ? '3점+(운영만 완화)' : '4점+'}. 카드는 대상자가 통과한 공고만(1~2개). ⚠️"이번 주 명단 전달" 카피 — 킨도프 측 실제 공유 의무.`,
  source: 'scripts/outreach/kyndof-recommend-coldmail.mjs',
  html: kyndofHtml(frame, g),
})))

// ── 8/18 공고 추천 4종 (moen·andwise·nexacode 세일즈·nexacode 디자이너) + 8/25 nexacode 그래픽(JD 전환 재발송) — kyndof 정직 프레임, 단일 공고 카드 ──
// 스크립트: jic-moen-recommend-coldmail.mjs(moen) / aw-nx-recommend-coldmail.mjs(andwise·nexacode) / nx-designer-recommend-coldmail.mjs(디자이너) / nx-graphic-recommend-coldmail.mjs(그래픽)
const REC0818_GROUPS = [
  {
    key: 'moen', company: 'Moen', initial: 'M',
    title: 'AI-Powered Designer (Thực tập sinh/Trainee)', meta: 'Hồ Chí Minh · Hà Nội · Đà Nẵng',
    role: { vi: 'Brand · AI-Powered Designer (Trainee)', ko: '브랜드 · AI 디자이너 (인턴/트레이니)', en: 'Brand · AI-Powered Designer (Trainee)' },
    source: 'scripts/outreach/jic-moen-recommend-coldmail.mjs',
    note: '모엔 F&B AI 디자이너 인턴 추천 (8/18 77명): 디자인 계열 570명 gpt-4o-mini 채점 3점+.',
    intro: {
      vi: '<b>Moen</b> — thương hiệu F&B Hàn Quốc đang xây dựng hình ảnh trên Instagram, Smart Store và website riêng — đang tuyển <b>Brand · AI-Powered Designer (Thực tập sinh/Trainee)</b> tại Hồ Chí Minh · Hà Nội · Đà Nẵng. <b>Không yêu cầu kinh nghiệm làm việc</b> — chỉ cần portfolio và kinh nghiệm dùng công cụ tạo ảnh AI (Midjourney, Firefly, v.v.), kể cả từ dự án cá nhân.',
      ko: '인스타그램·스마트스토어·자사몰 브랜딩을 하는 한국 F&B 브랜드 <b>Moen</b>이 <b>브랜드 · AI 디자이너 인턴(트레이니)</b>을 호치민·하노이·다낭에서 채용 중입니다. <b>경력 무관</b> — 포트폴리오와 AI 이미지 툴(미드저니·파이어플라이 등) 사용 경험(개인 프로젝트 인정)이면 충분합니다.',
      en: '<b>Moen</b> — a Korean F&B brand building its presence on Instagram, Smart Store and its own website — is hiring a <b>Brand · AI-Powered Designer (Trainee)</b> in HCMC · Hanoi · Da Nang. <b>No work experience required</b> — just a portfolio and hands-on experience with AI image tools (Midjourney, Firefly, etc.), personal projects included.',
    },
  },
  {
    key: 'andwise', company: 'Andwise', initial: 'A',
    title: 'Backend Senior Developer', meta: 'Đà Nẵng',
    role: { vi: 'Backend Senior Developer (Java·Spring)', ko: '백엔드 시니어 개발자 (Java·Spring)', en: 'Backend Senior Developer (Java·Spring)' },
    source: 'scripts/outreach/aw-nx-recommend-coldmail.mjs',
    note: '앤드와이즈 백엔드 시니어 추천 (8/18 57명): Java/백엔드 2.5y+ 249명 채점 3점+(3점=비Java 백엔드 포함). 공고 source_id 없음 — jobs.id 직접 참조.',
    intro: {
      vi: '<b>Andwise</b> đang tuyển vị trí <b>Backend Senior Developer</b> làm việc tại <b>Đà Nẵng</b> — vị trí senior yêu cầu tối thiểu 3 năm kinh nghiệm backend <b>Java·Spring</b>, có kinh nghiệm technical leadership / dẫn dắt dự án; kinh nghiệm Python·AI/ML là lợi thế lớn.',
      ko: '<b>Andwise</b>가 <b>다낭</b> 근무 <b>백엔드 시니어 개발자</b>를 채용 중입니다. <b>Java·Spring</b> 백엔드 3년 이상, 테크니컬 리더십/프로젝트 리딩 경험 필수이며 Python·AI/ML 경험은 큰 우대 요소입니다.',
      en: '<b>Andwise</b> is hiring a <b>Backend Senior Developer</b> based in <b>Da Nang</b> — a senior role requiring 3+ years of <b>Java·Spring</b> backend experience and technical leadership / project leading; Python·AI/ML experience is a big plus.',
    },
  },
  {
    key: 'nexacode', company: 'Nexacode', initial: 'N',
    title: 'B2B Sales & Marketing Executive', meta: 'Remote (HCM · Hà Nội · Đà Nẵng)',
    role: { vi: 'B2B Sales & Marketing Executive', ko: 'B2B 세일즈 & 마케팅 담당자', en: 'B2B Sales & Marketing Executive' },
    source: 'scripts/outreach/aw-nx-recommend-coldmail.mjs',
    note: '넥사코드 B2B 세일즈 추천 (8/18 24명): 세일즈/마케팅 계열 717명 채점 3점+(3점=인접 직군 포함).',
    intro: {
      vi: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>B2B Sales & Marketing Executive</b> làm việc <b>hoàn toàn từ xa (remote)</b>. <b>Không yêu cầu kinh nghiệm</b> — chỉ cần quan tâm đến B2B sales/marketing, có khả năng nghiên cứu doanh nghiệp và giao tiếp tốt qua email·văn bản; kinh nghiệm cold email, CRM hay công cụ AI (ChatGPT, v.v.) là lợi thế.',
      ko: 'SaaS·ERP·DX 소프트웨어 회사 <b>Nexacode</b>가 <b>풀리모트</b> <b>B2B 세일즈 & 마케팅 담당자</b>를 채용 중입니다. <b>경력 무관</b> — B2B 세일즈/마케팅에 대한 관심, 기업 리서치, 이메일·문서 커뮤니케이션이면 충분하고 콜드메일·CRM·AI 툴 경험은 우대입니다.',
      en: '<b>Nexacode</b> — a software company building SaaS, ERP and digital-transformation products — is hiring a <b>B2B Sales & Marketing Executive</b>, <b>fully remote</b>. <b>No experience required</b> — an interest in B2B sales/marketing, company research skills and strong written communication are enough; cold email, CRM or AI-tool experience is a plus.',
    },
  },
  {
    key: 'nexacode-designer', company: 'Nexacode', initial: 'N',
    title: 'Web / UI·UX Designer', meta: 'Remote',
    role: { vi: 'Web / UI·UX Designer', ko: '웹/UI·UX 디자이너', en: 'Web / UI·UX Designer' },
    source: 'scripts/outreach/nx-designer-recommend-coldmail.mjs',
    note: '넥사코드 웹/UI·UX 디자이너 추천 (8/18): 디자인 계열 2.5y+ 159명 gpt-4o-mini 채점 3점+(풀 얇아 전원 발송).',
    intro: {
      vi: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>Web / UI·UX Designer</b> làm việc <b>hoàn toàn từ xa (remote)</b>. Công việc tập trung vào thiết kế UI/UX web·mobile trên <b>Figma</b> (wireframe·prototype), landing page và website doanh nghiệp, màn hình admin/dashboard cho sản phẩm B2B, cùng các ấn phẩm marketing (banner, SNS) và tài liệu doanh nghiệp (PPT, proposal). Ưu tiên ứng viên có <b>từ 3 năm kinh nghiệm</b> và portfolio; kinh nghiệm làm việc tại công ty toàn cầu là lợi thế.',
      ko: 'SaaS·ERP·DX 소프트웨어 회사 <b>Nexacode</b>가 <b>풀리모트</b> <b>웹/UI·UX 디자이너</b>를 채용 중입니다. <b>Figma</b> 기반 웹·모바일 UI/UX(화면설계·프로토타입), 랜딩페이지·기업 홈페이지, 어드민·대시보드 등 B2B 화면과 배너·SNS 마케팅 디자인, PPT·제안서까지 폭넓게 다루는 포지션으로, <b>경력 3년 이상</b>·포트폴리오 보유자를 우대하며 글로벌 기업 근무 이력은 큰 우대 요소입니다.',
      en: '<b>Nexacode</b> — a software company building SaaS, ERP and digital-transformation products — is hiring a <b>Web / UI·UX Designer</b>, <b>fully remote</b>. The role covers web·mobile UI/UX in <b>Figma</b> (wireframes·prototypes), landing pages and corporate websites, admin/dashboard screens for B2B products, plus marketing assets (banners, social content) and business documents (PPT, proposals). <b>3+ years of experience</b> and a portfolio preferred; experience at a global company is a plus.',
    },
  },
  {
    key: 'nexacode-graphic', company: 'Nexacode', initial: 'N',
    title: 'Web/Graphic Designer', meta: 'Remote',
    role: { vi: 'Web / Graphic Designer', ko: '웹/그래픽 디자이너', en: 'Web / Graphic Designer' },
    source: 'scripts/outreach/nx-graphic-recommend-coldmail.mjs',
    note: '넥사코드 웹/그래픽 디자이너 추천 (8/25): JD가 UI/UX→그래픽 중심으로 수정돼 재발송(같은 공고 ID, 8/18 발송분 제외). 디자인 계열 연차 무관 443명 그래픽 루브릭 재채점 3점+ 96명.',
    intro: {
      vi: '<b>Nexacode</b> — công ty phần mềm xây dựng sản phẩm SaaS, ERP và giải pháp chuyển đổi số — đang tuyển <b>Web / Graphic Designer</b> làm việc <b>hoàn toàn từ xa (remote)</b>. Công việc tập trung vào thiết kế ấn phẩm quảng cáo số·banner, nội dung SNS·thumbnail, landing page·trang khuyến mãi, trang chi tiết sản phẩm·dịch vụ, website doanh nghiệp·brand, cùng tài liệu doanh nghiệp (PPT, proposal); khi cần có thể tham gia thiết kế·cải thiện UI web·mobile. Yêu cầu sử dụng thành thạo <b>Figma</b>, có nền tảng thiết kế thị giác (layout·typography·màu sắc) và portfolio; kinh nghiệm Photoshop·Illustrator là lợi thế.',
      ko: 'SaaS·ERP·DX 소프트웨어 회사 <b>Nexacode</b>가 <b>풀리모트</b> <b>웹/그래픽 디자이너</b>를 채용 중입니다. 디지털 광고 소재·배너, SNS 콘텐츠·썸네일, 랜딩·프로모션·상세페이지, 기업 홈페이지·브랜드 웹페이지, PPT·제안서 등 그래픽·시각 디자인이 중심이고 필요시 웹·앱 UI 디자인·개선도 일부 다룹니다. <b>Figma</b> 활용과 시각 디자인 기본기(레이아웃·타이포·컬러), 포트폴리오가 필요하며 Photoshop·Illustrator 경험은 우대 요소입니다.',
      en: '<b>Nexacode</b> — a software company building SaaS, ERP and digital-transformation products — is hiring a <b>Web / Graphic Designer</b>, <b>fully remote</b>. The role centers on digital ad creatives·banners, SNS content·thumbnails, landing·promotion·detail pages, corporate & brand web pages, and business documents (PPT, proposals), with occasional web·mobile UI design/improvement. Requires <b>Figma</b>, solid visual-design fundamentals (layout·typography·color) and a portfolio; Photoshop·Illustrator experience is a plus.',
    },
  },
]
const rec0818Benefit = (frame, c) => ({
  vi: `<b>Trong tuần này</b>, FYI sẽ gửi danh sách đề cử trực tiếp cho người phụ trách tuyển dụng của ${c}. ` + (frame === 'public'
    ? 'Hồ sơ của bạn đang ở chế độ công khai nên sẽ được gửi kèm danh sách. Nếu bạn ứng tuyển ngay, CV của bạn sẽ được <b>ưu tiên xem xét</b> cùng lời giới thiệu từ FYI.'
    : 'Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.'),
  ko: `<b>이번 주에</b> FYI가 ${c} 채용 담당자에게 추천 명단을 직접 전달합니다. ` + (frame === 'public'
    ? '회원님 이력서는 공개 상태라 명단과 함께 프로필이 전달됩니다. 지금 지원하시면 FYI의 추천과 함께 <b>우선 검토</b>됩니다.'
    : '회원님 이력서는 비공개 상태라, 지금 지원하시면 CV가 FYI의 추천과 함께 전달되어 <b>우선 검토</b>됩니다.'),
  en: `<b>This week</b>, FYI will send the nominee list directly to ${c}'s recruiter. ` + (frame === 'public'
    ? 'Your profile is public, so it goes along with the list. If you apply now, your CV gets <b>priority review</b> with FYI\'s recommendation.'
    : 'Your profile is private — if you apply now, your CV is delivered with FYI\'s recommendation and gets <b>priority review</b>.'),
})
const REC0818_TEMPLATES = REC0818_GROUPS.flatMap((g) => ['public', 'private'].map((frame) => ({
  match: new RegExp(`^${g.key}-recommend\\d-${frame}`), // recommend2 = 웨이브2(8/18 컷 완화)
  subject: frame === 'public'
    ? {
      vi: `[FYI] Bạn được chọn vào danh sách đề cử gửi ${g.company} — ${g.role.vi}`,
      ko: `[FYI] ${g.company} 추천 명단에 선정되셨습니다 — ${g.role.ko}`,
      en: `[FYI] You're on the nominee list sent to ${g.company} — ${g.role.en}`,
    }
    : {
      vi: `[FYI] Bạn được chọn vào danh sách đề cử — ${g.role.vi} tại ${g.company}`,
      ko: `[FYI] 추천 후보 명단에 선정되셨습니다 — ${g.company} ${g.role.ko}`,
      en: `[FYI] You've been selected for the nominee list — ${g.role.en} at ${g.company}`,
    },
  desc: `${g.note} ${frame === 'public' ? '공개' : '비공개'} 프레임(kyndof 정직 프레임). ⚠️"이번 주 명단 전달" 카피 — 기업 측 실제 공유 의무.`,
  source: g.source,
  html: (lang) => recommendShell(lang, {
    intro: {
      vi: `${g.intro.vi} ${KYNDOF_I18N.hook.vi}`,
      ko: `${g.intro.ko} ${KYNDOF_I18N.hook.ko}`,
      en: `${g.intro.en} ${KYNDOF_I18N.hook.en}`,
    },
    initial: g.initial, company: g.company, title: g.title, meta: g.meta,
    tail: rec0818Benefit(frame, g.company),
  }),
})))

export const COLDMAIL_TEMPLATES = [
  ...REC0818_TEMPLATES,
  ...KYNDOF_TEMPLATES,
  {
    match: /^salary-c/,
    subject: {
      vi: 'Bạn chưa được chọn vào danh sách đề cử lần này — lý do: chưa xác nhận mức lương',
      ko: '회원님이 이번 추천 명단에서 제외되었습니다 — 사유: 연봉 미확인',
      en: 'You were not selected for this nomination list — reason: salary unconfirmed',
    },
    desc: '연봉수집 C 프레임(8/19 재발송 salary-c-0819): B의 \'보류\'보다 강한 손실 — "1차 대기 리스트에 올랐지만 연봉 미확인으로 최종 명단 탈락, 숫자 하나면 다음 명단" (photo 손실 프레임 유저 초안 이식). 62% 수치는 기업 VOC 실측(유저 확정). 대상=기발송 1,622 중 미기입·미수신거부·당일 미접촉(--resend --skip-today).',
    source: 'scripts/outreach/salary-coldmail.mjs --resend --campaign salary-c-0819 --skip-today',
    html: salaryCHtml,
  },
  {
    match: /^salary-b/,
    subject: {
      vi: 'Đề cử của bạn đang bị tạm dừng — vì chưa xác nhận được mức lương',
      ko: '회원님 추천이 보류 중입니다 — 연봉 확인이 안 돼서요',
      en: 'Your nomination is on hold — we could not confirm your salary',
    },
    desc: '연봉수집 B 프레임(8/13): photo1 검증 구조 이식 — "추천 후보에 올랐는데 연봉 미확인으로 검토 보류, 숫자 하나면 재개" 손실 프레임. 랜딩(/salary-update)도 같은 문구로 분기(frameB). salary-b=A/B 200명(1h 클릭 26.5%로 A 3배·photo 동시점 상회), salary-b-full=사인 후 잔여 1,222명 벌크(같은 양식).',
    source: 'scripts/outreach/salary-coldmail.mjs --campaign salary-b',
    html: salaryBHtml,
  },
  {
    match: /^salary/,
    subject: {
      vi: 'FYI đang tiến cử bạn với các công ty — chỉ cần cho chúng tôi 1 con số',
      ko: 'FYI가 회원님을 기업에 추천하고 있어요 — 숫자 하나만 알려주세요',
      en: 'FYI is recommending you to companies — just give us 1 number',
    },
    desc: '현/직전연봉 수집 A 프레임 salary-a(구 salary1, 8/13 200명): "FYI가 너를 기업에 추천하는데, 연봉을 알면 정말 만족할 기업만 골라줄 수 있다(목표=연봉 상승)" 정중한 ask 앵글 + 기업 비공개 강조. 무로그인 토큰 랜딩(/salary-update)에서 현재/직전 토글 + 숫자 한 칸(triệu/월) 입력 → current_salary 저장.',
    source: 'scripts/outreach/salary-coldmail.mjs',
    html: salaryHtml,
  },
  {
    match: /^photo-remind/,
    subject: {
      vi: 'Những người đã thêm ảnh hồ sơ nhận được 1–2 offer chỉ trong 3 ngày',
      ko: '사진을 추가한 분들은 3일 안에 오퍼 1~2건을 받았습니다',
      en: 'People who added a photo received 1–2 offers within 3 days',
    },
    desc: '프로필 사진 재발송 photo-remind1(8/11 photo1·photo2 미전환 코호트): "그때 사진 올린 사람들은 3일 내 오퍼 1~2건 받았다" 사회적 증거 + "당장 이직 생각 없어도 오퍼·면접 = 시장가치 확인" 카운터 앵글(유저 확정 카피). 동일 원클릭 토큰 랜딩(/photo-upload).',
    source: 'scripts/outreach/photo-coldmail.mjs --remind',
    html: photoRemindHtml,
  },
  {
    match: /^photo/,
    subject: {
      vi: 'Bạn đã vào danh sách chờ nhận offer — nhưng chưa được chọn (lý do: thiếu ảnh hồ sơ)',
      ko: '오퍼 대기 리스트에 올랐지만 아쉽게 선정되지 않았습니다 (사유: 프로필 사진 없음)',
      en: 'You were on an offer shortlist — but not selected (reason: no profile photo)',
    },
    desc: '프로필 사진 등록 유도 photo1(8/5 769명)·photo2(8/6 잔여 269명)·photo3(8/11 신규 유입 353명, 동일 양식·코호트만 분리): "담당자가 오퍼 1차 대기 리스트에 올렸으나 사진 없음 사유로 미선정" 프레임 + 사진 있는 프로필 오퍼 확률 62%↑(유저 확정 카피). 원클릭 토큰 랜딩(/photo-upload)에서 로그인 없이 업로드 → vision 인물사진 검증 후 즉시 반영.',
    source: 'scripts/outreach/photo-coldmail.mjs',
    html: photoColdmailHtml,
  },
  {
    match: /^coldmail-ktc-cv-remind1-0805/,
    subject: {
      vi: '{{name}} ơi, những người nhận hồ sơ trước bạn đã có trung bình 2,1 lời mời việc làm',
      ko: '{{name}}님, 프로필을 먼저 받아간 분들은 이미 평균 2.1건의 오퍼를 받았습니다',
      en: '{{name}}, people who claimed before you already have 2.1 job offers on average',
    },
    desc: 'CV 클레임 리마인드 8/5분(8/4 신규 719 코호트 미클릭 607): 제목만 "먼저/이미 받았다" FOMO 강조로 변형 — 8/4 remind1 제목과 코호트별 A/B. 본문은 remind1과 동일.',
    source: 'scripts/outreach/ktc-claim-coldmail.mjs --remind --campaign coldmail-ktc-cv-remind1-0805',
    html: ktcClaimHtml,
  },
  {
    match: /^coldmail-ktc-cv-remind/,
    subject: {
      vi: '{{name}} ơi, những người đã nhận hồ sơ đang có trung bình 2,1 lời mời việc làm',
      ko: '{{name}}님, 프로필을 받아간 분들은 평균 2.1건의 오퍼를 받았습니다',
      en: '{{name}}, people who claimed their profile got 2.1 offers on average',
    },
    desc: 'KTC 4차(CV 클레임) 리마인드 8/4분(8/3 코호트 미클릭 380): 원본 수신 24h+ 미클릭·미가입 리드에게 "받아간 사람들은 평균 오퍼 2.1건"(실측) 사회적 증거 훅. 본문은 클레임 양식에서 헤드라인·앞 두 문단만 교체 — 미리보기는 원양식 기준.',
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
    match: /^bada-.*-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử — {{포지션}} tại Bada Fintech',
      ko: '[FYI] 추천 후보 명단에 선정되셨습니다 — Bada Fintech {{포지션}}',
      en: "[FYI] You've been nominated — {{position}} at Bada Fintech",
    },
    desc: '바다핀테크 추천 (8/21): 비공개 프레임 — FYI 검토 선정·이번 주 명단 전달·지원 시 CV+추천 전달. 3그룹(plan/uiux/mkt).',
    source: 'scripts/outreach/bada-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>Bada Fintech</b> — công ty fintech Hàn Quốc chuyên về giải pháp tài chính dựa trên khoản phải thu, kết nối với Ngân hàng Hana tại Hàn Quốc và Việt Nam — đang tuyển dụng các vị trí chủ chốt qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ và <b>chọn bạn vào danh sách đề cử</b>.',
        ko: '하나은행 한국·베트남과 연계된 매출채권 기반 핀테크 <b>바다핀테크</b>가 FYI를 통해 주요 포지션을 채용 중입니다. FYI 팀이 이력서 전체를 검토해 회원님을 <b>추천 명단에 선정</b>했습니다.',
        en: '<b>Bada Fintech</b> — a Korean fintech in receivables financing working with Hana Bank Korea & Vietnam — is hiring via FYI. The FYI team reviewed all profiles and <b>nominated you</b>.',
      },
      initial: 'B', company: 'Bada Fintech', title: '{{공고 제목}}', meta: '{{급여 · 지역}}', tail: BENEFIT_PRIVATE,
    }),
  },
  {
    match: /^bada-/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử gửi Bada Fintech — {{포지션}}',
      ko: '[FYI] Bada Fintech 추천 명단에 선정되셨습니다 — {{포지션}}',
      en: "[FYI] You've been nominated to Bada Fintech — {{position}}",
    },
    desc: '바다핀테크 추천 (8/21): 공개 프레임 — FYI 검토 선정·명단에 프로필 동봉·지원 시 우선 검토. 3그룹(plan/uiux/mkt).',
    source: 'scripts/outreach/bada-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>Bada Fintech</b> — công ty fintech Hàn Quốc chuyên về giải pháp tài chính dựa trên khoản phải thu, kết nối với Ngân hàng Hana tại Hàn Quốc và Việt Nam — đang tuyển dụng các vị trí chủ chốt qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ và <b>chọn bạn vào danh sách đề cử</b> — hồ sơ công khai của bạn sẽ được gửi kèm danh sách cho nhà tuyển dụng trong tuần này.',
        ko: '하나은행 한국·베트남과 연계된 매출채권 기반 핀테크 <b>바다핀테크</b>가 FYI를 통해 주요 포지션을 채용 중입니다. FYI 팀이 이력서 전체를 검토해 회원님을 <b>추천 명단에 선정</b>했으며, 공개 프로필은 이번 주 명단과 함께 담당자에게 전달됩니다.',
        en: '<b>Bada Fintech</b> — a Korean fintech in receivables financing working with Hana Bank Korea & Vietnam — is hiring via FYI. The FYI team reviewed all profiles and <b>nominated you</b>; your public profile goes to the recruiter with this week\'s list.',
      },
      initial: 'B', company: 'Bada Fintech', title: '{{공고 제목}}', meta: '{{급여 · 지역}}', tail: BENEFIT_PUBLIC,
    }),
  },
  {
    match: /^mpnx-.*-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử — Senior Technical IP Analyst tại MPNX',
      ko: '[FYI] 추천 후보 명단에 선정되셨습니다 — MPNX Senior Technical IP Analyst',
      en: "[FYI] You've been nominated — Senior Technical IP Analyst at MPNX",
    },
    desc: 'MPNX 2차 (8/20): 비공개 프로필용 "FYI 검토 후 선정" 정직 프레임 — 지원 시 CV가 FYI 추천과 함께 전달.',
    source: 'scripts/outreach/mpnx-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> cho vị trí này tại <b>MPNX</b> — công ty chuyên về thương mại hóa tài sản trí tuệ và cấp phép công nghệ (patent licensing) trên thị trường quốc tế.',
        ko: 'FYI 팀이 등록된 이력서 전체를 검토해 국제 특허 라이선싱 기업 <b>MPNX</b>의 이 포지션 <b>추천 명단에 선정</b>했습니다.',
        en: 'The FYI team reviewed all registered profiles and <b>nominated you</b> for this position at <b>MPNX</b>, an international patent licensing company.',
      },
      initial: 'M', company: 'MPNX', title: '{{공고 제목}}', meta: '{{직군 · 지역}}',
      tail: {
        vi: 'Hồ sơ của bạn đang ở chế độ riêng tư — nếu bạn ứng tuyển ngay, CV của bạn sẽ được gửi kèm lời giới thiệu từ FYI và được <b>ưu tiên xem xét</b>.',
        ko: '이력서가 비공개 상태라, 지금 지원하시면 CV가 FYI의 추천과 함께 전달되어 <b>우선 검토</b>됩니다.',
        en: "Your profile is private — apply now and your CV will be sent with FYI's recommendation for <b>priority review</b>.",
      },
    }),
  },
  {
    match: /^mpnx-/,
    subject: invitedSubject('MPNX'),
    desc: 'MPNX 단일공고 추천 (7/29 공개 프레임 · 8/20 2차 재사용): NALDA와 같은 "담당자가 봤다 · 우선검토" 톤.',
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
    match: /^presto-recommend1-public/,
    subject: invitedSubject('PRESTO SOLUTION'),
    desc: 'PRESTO SOLUTION 로봇·모션제어 SW 추천 · 공개 프레임 (8/7): "담당자가 당신 이력서를 보고 보냈다 · 우선검토". 대상은 C++/C# 보유 + 경력 7년 이하, 이력서에 제어/비전/임베디드/GUI 단서가 있는 순으로 정렬. 본문 둘째 문단이 세그먼트별 후크 6종으로 갈린다(개인화이지 캠페인 분리가 아니다 — 수신자가 적어 더 쪼개면 못 센다). 이 캠페인부터 푸터 수신거부(/api/coldmail/unsub) + List-Unsubscribe 원클릭 헤더.',
    source: 'scripts/outreach/presto-recommend-coldmail.mjs',
    html: (lang) => prestoShell(lang, { intro: PRESTO_INTRO.public, tail: BENEFIT_PUBLIC }),
  },
  {
    match: /^presto-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử — Software Engineer (Robot & Motion Control)',
      ko: '[FYI] 추천 후보 명단에 선정되셨습니다 — Software Engineer (Robot & Motion Control)',
      en: '[FYI] You\'ve been selected for the nominee list — Software Engineer (Robot & Motion Control)',
    },
    desc: 'PRESTO SOLUTION 로봇·모션제어 SW 추천 · 비공개 프레임 (8/7): "FYI가 전체 이력서 검토 후 추천 명단에 선정 · 이번 주 담당자 전달 · 우선검토". ⚠️발송 후 실제 명단 공유 의무. 공개 프레임과 대상 선정·후크는 동일하고 인트로/혜택 문장만 다르다.',
    source: 'scripts/outreach/presto-recommend-coldmail.mjs',
    html: (lang) => prestoShell(lang, { intro: PRESTO_INTRO.private, tail: BENEFIT_PRIVATE }),
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
    match: /^wellpod-recommend1/,
    subject: {
      vi: '[FYI] Chúng tôi thấy "{{스펙 — 예: TOPIK 6 · 3 năm biên-phiên dịch}}" trong hồ sơ của bạn — có vị trí đang tìm đúng hồ sơ này',
      ko: '[FYI] 이력서의 "{{스펙 — 예: TOPIK 6급 · 통번역 3년}}"를 보고 연락드립니다 — 이 스펙을 찾는 자리가 났습니다',
      en: '[FYI] We saw "{{spec}}" in your CV — a role is looking for exactly this profile',
    },
    desc: 'Wellpod TikTok Shop & Shopify Executive 추천 (8/6): 한국어 가능 8명 전원 개인화 — 제목·본문에 본인 스펙(TOPIK·경력) 삽입, "스펙이 희소한데 그걸 찾는 자리가 났다·FYI가 CV 직접 전달·합격 가능성 매우 높음" 1:1 스카우트 톤, CTA는 전달 승낙("네, 전달해 주세요"). 명단/선정 언급 없음.',
    source: 'scripts/outreach/wellpod-recommend-coldmail.mjs',
    html: (lang) => {
      const s = pickLang({
        vi: {
          hi: 'Chào {{tên}}, đây là đội ngũ FYI.',
          intro: 'Chúng tôi liên hệ trực tiếp vì thấy điểm nổi bật trong hồ sơ của bạn — <b>{{개인화 — chuyên ngành tiếng Hàn, TOPIK 6 và 3 năm kinh nghiệm biên-phiên dịch}}</b>. Nhân sự có thể làm việc bằng tiếng Hàn rất hiếm trên thị trường tuyển dụng Việt Nam, và vị trí yêu cầu đúng hồ sơ này còn hiếm hơn. Vị trí đó vừa mở.',
          tail: 'Wellpod — công ty thương mại điện tử Hàn Quốc phân phối K-pop album toàn cầu và phát triển thương mại TikTok Shop — đang tìm người kết nối trụ sở Hàn Quốc và đội ngũ Việt Nam bằng <b>tiếng Hàn hoặc tiếng Trung</b>. Vì yêu cầu này rất hiếm, gần như không có nhiều ứng viên có thể ứng tuyển. Vì vậy FYI muốn gửi CV của bạn <b>trực tiếp cho nhà tuyển dụng Wellpod</b> — <b>khả năng trúng tuyển rất cao</b>.<br><br>Nếu bạn đồng ý, chỉ cần một nút — CV đã đăng ký sẽ được gửi kèm lời giới thiệu từ FYI.',
          meta: '15–20 triệu · HCM / Đà Nẵng / Hà Nội · Chào đón fresher', cta: 'Vâng, hãy gửi hồ sơ của tôi →',
        },
        ko: {
          hi: '안녕하세요 {{이름}}님, FYI 팀입니다.',
          intro: '이력서에서 눈에 띄는 게 있어 직접 연락드립니다 — <b>{{개인화 — 예: 한국어 전공에 TOPIK 6급, 통번역 3년 경력}}</b>. 한국어로 업무할 수 있는 인재는 베트남 채용 시장에서 매우 드물고, 이 스펙을 정확히 요구하는 자리는 더 드뭅니다. 마침 그 자리가 열렸습니다.',
          tail: 'K-pop 앨범 글로벌 유통과 TikTok Shop 커머스를 하는 한국 이커머스 기업 <b>Wellpod</b>가 <b>한국어 또는 중국어</b>로 한국 본사와 베트남 팀을 잇는 담당자를 찾습니다. 요구 스펙이 희소해서 지원할 수 있는 사람 자체가 거의 없는 자리입니다. 그래서 FYI가 회원님의 CV를 <b>Wellpod 담당자에게 직접 전달</b>하려고 합니다 — <b>합격 가능성이 매우 높습니다</b>.<br><br>의향이 있으시면 버튼 하나면 됩니다. 등록하신 CV가 FYI의 추천과 함께 바로 전달됩니다.',
          meta: '15–20 triệu · 호치민/다낭/하노이 · 신입 가능', cta: '네, 전달해 주세요 →',
        },
        en: {
          hi: 'Hi {{name}}, this is the FYI team.',
          intro: 'We\'re reaching out because something stood out in your CV — <b>{{personalized line}}</b>. People who can work in Korean are very rare in the Vietnamese job market, and roles requiring exactly this profile are rarer. One just opened.',
          tail: '<b>Wellpod</b> — a Korean e-commerce company distributing K-pop albums globally and building TikTok Shop commerce — is looking for someone to bridge the Korean HQ and the Vietnam team in <b>Korean or Chinese</b>. Because the requirement is so rare, very few candidates can apply at all. So FYI wants to send your CV <b>directly to the Wellpod recruiter</b> — <b>your chances are very high</b>.<br><br>If you\'re in, one tap is all it takes — your registered CV goes out with FYI\'s recommendation.',
          meta: '15–20M VND · HCMC / Da Nang / Hanoi · Freshers welcome', cta: 'Yes, send my CV →',
        },
      }, lang)
      return `<!doctype html><html><body style="margin:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1612">
<div style="max-width:520px;margin:0 auto;padding:28px 16px">
  <div style="font-size:20px;font-weight:800;color:#ff6000;padding-bottom:18px">FYI</div>
  <p style="font-size:15px;line-height:1.6;margin:0 0 6px">${s.hi}</p>
  <p style="font-size:14px;line-height:1.65;color:#4a443c;margin:0 0 18px">${s.intro}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eee5da;border-radius:14px;margin-bottom:14px"><tr>
    <td width="44" style="padding:14px 0 14px 14px;vertical-align:middle"><div style="width:44px;height:44px;border-radius:10px;background:#fff0e6;color:#ff6000;font-weight:800;font-size:16px;text-align:center;line-height:44px">W</div></td>
    <td style="padding:14px 14px 14px 12px;vertical-align:middle">
      <div style="font-size:12px;color:#8a8073;margin-bottom:3px">Wellpod</div>
      <div style="font-size:14.5px;font-weight:700;color:#1a1612;line-height:1.35">TikTok Shop &amp; Shopify Management Executive</div>
      <div style="font-size:12px;color:#b0691a;margin-top:3px">${s.meta}</div>
    </td>
  </tr></table>
  <p style="font-size:14px;line-height:1.65;color:#4a443c;margin:0 0 6px">${s.tail}</p>
  <div style="text-align:center;padding:16px 0 6px">
    <span style="display:inline-block;background:#ff6000;color:#fff;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px">${s.cta}</span>
  </div>
</div></body></html>`
    },
  },
  {
    match: /^mnf-recommend1-public/,
    subject: invitedSubject('MNF Solution'),
    desc: 'MNF Solution AI Engineer (LLM) 추천 · 공개 프레임 (8/6): 호치민 개발/AI 풀(키워드 매칭+gpt-4o-mini 오탐 필터) 대상, "담당자가 봤다 · 우선검토".',
    source: 'scripts/outreach/mnf-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>MNF Solution</b> — công ty Hàn Quốc xây dựng hệ sinh thái mobility trên nền tảng số, cung cấp giải pháp quản lý cho các công ty cho thuê xe — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì nền tảng lập trình của bạn phù hợp với yêu cầu.',
        ko: '렌터카 관리 솔루션으로 모빌리티 생태계를 만드는 한국 기업 <b>MNF Solution</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 개발 역량이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>MNF Solution</b> — a Korean company building a mobility ecosystem on a digital platform, with management solutions for car-rental companies — viewed your profile on FYI and <b>sent you this position</b> because your engineering background fits the requirements.',
      },
      initial: 'M', company: 'MNF Solution', title: 'AI Engineer (LLM)', meta: 'On-site Quận 7 · TP.HCM · Lương thỏa thuận', tail: mnfTail(BENEFIT_PUBLIC),
    }),
  },
  {
    match: /^mnf-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí AI Engineer (LLM) tại MNF Solution',
      ko: '[FYI] MNF Solution AI Engineer (LLM) 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the MNF Solution AI Engineer (LLM) nominee list',
    },
    desc: 'MNF Solution AI Engineer (LLM) 추천 · 비공개 프레임 (8/6): "FYI가 전체 이력서 검토 후 추천 명단에 선정 · 이번 주 담당자 전달 · 우선검토". ⚠️발송 후 실제 명단 공유 의무.',
    source: 'scripts/outreach/mnf-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>MNF Solution</b> — công ty Hàn Quốc xây dựng hệ sinh thái mobility trên nền tảng số, cung cấp giải pháp quản lý cho các công ty cho thuê xe — đang tuyển AI Engineer (LLM) qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '렌터카 관리 솔루션으로 모빌리티 생태계를 만드는 한국 기업 <b>MNF Solution</b>이 FYI를 통해 AI Engineer (LLM)를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>MNF Solution</b> — a Korean company building a mobility ecosystem on a digital platform — is hiring an AI Engineer (LLM) through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'M', company: 'MNF Solution', title: 'AI Engineer (LLM)', meta: 'On-site Quận 7 · TP.HCM · Lương thỏa thuận', tail: mnfTail(BENEFIT_PRIVATE),
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
    match: /^presto-motion-recommend1-public/,
    subject: {
      vi: '[FYI] PRESTO SOLUTION đã xem hồ sơ của bạn — cơ hội làm việc tại Hàn Quốc',
      ko: '[FYI] PRESTO SOLUTION이 회원님의 프로필을 확인했습니다 — 한국 근무 기회',
      en: '[FYI] PRESTO SOLUTION viewed your profile — a chance to work in Korea',
    },
    desc: 'PRESTO Motion Control SW Engineer(한국 온사이트·경력무관) 추천 · 공개 프레임 (8/10): D+3 지원미달 대응. 임베디드/제어/자동화 A티어 + 공학전공 주니어 gpt-4o-mini 3점↑.',
    source: 'scripts/outreach/d3-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì nền tảng kỹ thuật của bạn phù hợp với yêu cầu.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 기술 배경이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>PRESTO SOLUTION</b> — a Korean company specializing in Motion Control and automation solutions for semiconductors, displays and robotics — viewed your profile on FYI and <b>sent you this position</b> because your technical background fits the requirements.',
      },
      initial: 'P', company: 'PRESTO SOLUTION', title: 'Motion Control Software Engineer', meta: 'Onsite tại Hàn Quốc · Không yêu cầu kinh nghiệm', tail: PRESTO_MOTION_TAIL(BENEFIT_PUBLIC),
    }),
  },
  {
    match: /^presto-motion-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử — Motion Control Engineer tại Hàn Quốc',
      ko: '[FYI] Motion Control Engineer(한국 근무) 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the nominee list — Motion Control Engineer in Korea',
    },
    desc: 'PRESTO Motion Control 추천 · 비공개 프레임 (8/10): "명단 선정 + 이번 주 담당자 전달 + 우선검토" 훅. ⚠️발송 후 실제 명단 공유 의무.',
    source: 'scripts/outreach/d3-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đang tuyển Motion Control Software Engineer làm việc tại Hàn Quốc qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>이 FYI를 통해 한국 근무 Motion Control Software Engineer를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>PRESTO SOLUTION</b> — a Korean company specializing in Motion Control and automation solutions for semiconductors, displays and robotics — is hiring a Korea-based Motion Control Software Engineer through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'P', company: 'PRESTO SOLUTION', title: 'Motion Control Software Engineer', meta: 'Onsite tại Hàn Quốc · Không yêu cầu kinh nghiệm', tail: PRESTO_MOTION_TAIL(BENEFIT_PRIVATE),
    }),
  },
  {
    match: /^presto-sales-recommend1-public/,
    subject: invitedSubject('PRESTO SOLUTION'),
    desc: 'PRESTO Sales Assistant Manager(기술영업) 추천 · 공개 프레임 (8/10): D+3 지원미달 대응. 영업 헤드라인 풀 전원.',
    source: 'scripts/outreach/d3-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm kinh doanh của bạn phù hợp với yêu cầu.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 영업 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>PRESTO SOLUTION</b> — a Korean company specializing in Motion Control and automation solutions for semiconductors, displays and robotics — viewed your profile on FYI and <b>sent you this position</b> because your sales experience fits the requirements.',
      },
      initial: 'P', company: 'PRESTO SOLUTION', title: 'Sales Assistant Manager', meta: 'HCM · Đà Nẵng · Hà Nội · Lương thỏa thuận', tail: PRESTO_SALES_TAIL(BENEFIT_PUBLIC),
    }),
  },
  {
    match: /^presto-sales-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Sales Assistant Manager tại PRESTO SOLUTION',
      ko: '[FYI] PRESTO SOLUTION Sales Assistant Manager 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the PRESTO SOLUTION Sales Assistant Manager nominee list',
    },
    desc: 'PRESTO Sales 추천 · 비공개 프레임 (8/10): "명단 선정 + 이번 주 담당자 전달 + 우선검토" 훅. ⚠️발송 후 실제 명단 공유 의무.',
    source: 'scripts/outreach/d3-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>PRESTO SOLUTION</b> — công ty Hàn Quốc chuyên về giải pháp Motion Control và tự động hóa cho ngành bán dẫn, màn hình và robot — đang tuyển Sales Assistant Manager qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '반도체·디스플레이·로봇용 모션컨트롤/자동화 솔루션 한국 기업 <b>PRESTO SOLUTION</b>이 FYI를 통해 Sales Assistant Manager를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>PRESTO SOLUTION</b> — a Korean company specializing in Motion Control and automation solutions for semiconductors, displays and robotics — is hiring a Sales Assistant Manager through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'P', company: 'PRESTO SOLUTION', title: 'Sales Assistant Manager', meta: 'HCM · Đà Nẵng · Hà Nội · Lương thỏa thuận', tail: PRESTO_SALES_TAIL(BENEFIT_PRIVATE),
    }),
  },
  {
    match: /^lionrocket-recommend1-public/,
    subject: invitedSubject('LION ROCKET'),
    desc: 'LION ROCKET(Tynt) Content Marketer 추천 · 공개 프레임 (8/10): D+3 지원미달 대응. 숏폼 A티어 + gpt-4o-mini 4점 + (3점·1.5y↑).',
    source: 'scripts/outreach/d3-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>LION ROCKET</b> — công ty Hàn Quốc vận hành <b>Tynt</b>, dịch vụ AI trong lĩnh vực Beauty & Wellness với hơn 50.000 người dùng — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b> vì kinh nghiệm content của bạn phù hợp với yêu cầu.',
        ko: '5만+ 유저 AI 뷰티·웰니스 서비스 <b>Tynt</b>를 운영하는 한국 기업 <b>LION ROCKET</b>의 채용 담당자가 FYI에서 회원님의 프로필을 확인하고, 콘텐츠 경력이 요구사항과 맞아 <b>이 포지션을 직접 보냈습니다</b>.',
        en: 'A recruiter at <b>LION ROCKET</b> — the Korean company behind <b>Tynt</b>, an AI Beauty & Wellness service with 50,000+ users — viewed your profile on FYI and <b>sent you this position</b> because your content experience matches the requirements.',
      },
      initial: 'L', company: 'LION ROCKET', title: 'Content Marketer', meta: 'HCM · Đà Nẵng · Hà Nội · 20–25 triệu', tail: LIONROCKET_TAIL(BENEFIT_PUBLIC),
    }),
  },
  {
    match: /^lionrocket-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử cho vị trí Content Marketer tại LION ROCKET',
      ko: '[FYI] LION ROCKET Content Marketer 추천 명단에 선정되셨습니다',
      en: '[FYI] You\'ve been selected for the LION ROCKET Content Marketer nominee list',
    },
    desc: 'LION ROCKET(Tynt) Content Marketer 추천 · 비공개 프레임 (8/10): "명단 선정 + 이번 주 담당자 전달 + 우선검토" 훅. ⚠️발송 후 실제 명단 공유 의무.',
    source: 'scripts/outreach/d3-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>LION ROCKET</b> — công ty Hàn Quốc vận hành <b>Tynt</b>, dịch vụ AI trong lĩnh vực Beauty & Wellness với hơn 50.000 người dùng — đang tuyển Content Marketer qua FYI. Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '5만+ 유저 AI 뷰티·웰니스 서비스 <b>Tynt</b>를 운영하는 한국 기업 <b>LION ROCKET</b>이 FYI를 통해 Content Marketer를 채용 중입니다. FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>기업에 전달할 추천 명단에 선정</b>했습니다.',
        en: '<b>LION ROCKET</b> — the Korean company behind <b>Tynt</b>, an AI Beauty & Wellness service with 50,000+ users — is hiring a Content Marketer through FYI. The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'L', company: 'LION ROCKET', title: 'Content Marketer', meta: 'HCM · Đà Nẵng · Hà Nội · 20–25 triệu', tail: LIONROCKET_TAIL(BENEFIT_PRIVATE),
    }),
  },
  {
    match: /^openminds-recommend1-public/,
    subject: {
      vi: '[FYI] OpenMinds đã xem hồ sơ của bạn và mời bạn ứng tuyển — Full Stack Developer',
      ko: '[FYI] OpenMinds가 회원님의 이력서를 보고 지원을 제안했습니다 — Full Stack Developer',
      en: '[FYI] OpenMinds viewed your CV and invited you to apply — Full Stack Developer',
    },
    desc: 'OpenMinds Full Stack Developer(KTC·근무지 무관) 추천 · 공개 프레임 (8/11): KTC 추가모집(영어/한국어 요건) 대응. 풀스택 스택 × 영어 중급+/한국어 × 경력 2~6y, gpt-4o-mini 3점↑.',
    source: 'scripts/outreach/openminds-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: 'Nhà tuyển dụng của <b>OpenMinds</b> — công ty công nghệ Hàn Quốc (thành lập 2016) chuyên giải pháp chuyển đổi số trong sản xuất, nhân sự và khu vực công — đã xem hồ sơ của bạn trên FYI và <b>gửi cho bạn vị trí này</b>.',
        ko: '제조·HR·공공 분야 디지털 전환 솔루션을 만드는 한국 기술기업 <b>OpenMinds</b>(2016년 설립)의 채용 담당자가 FYI에서 회원님의 이력서를 보고 <b>이 포지션을 보냈습니다</b>.',
        en: 'A recruiter at <b>OpenMinds</b> — a Korean tech company (founded 2016) building digital-transformation solutions for manufacturing, HR and the public sector — viewed your CV on FYI and <b>sent you this position</b>.',
      },
      initial: 'O', company: 'OpenMinds', title: 'Full Stack Developer', meta: 'Không giới hạn địa điểm làm việc', tail: openmindsTail(BENEFIT_PUBLIC),
    }),
  },
  {
    match: /^openminds-recommend1-private/,
    subject: {
      vi: '[FYI] Bạn được chọn vào danh sách đề cử — Full Stack Developer tại OpenMinds',
      ko: '[FYI] 추천 후보 명단에 선정되셨습니다 — OpenMinds Full Stack Developer',
      en: '[FYI] You\'ve been selected for the nominee list — Full Stack Developer at OpenMinds',
    },
    desc: 'OpenMinds Full Stack Developer 추천 · 비공개 프레임 (8/11): "명단 선정 + 이번 주 담당자 전달 + 우선검토" 훅. ⚠️발송 후 실제 명단 공유 의무(KTC 이정애·Alice).',
    source: 'scripts/outreach/openminds-recommend-coldmail.mjs',
    html: (lang) => recommendShell(lang, {
      intro: {
        vi: '<b>OpenMinds</b> — công ty công nghệ Hàn Quốc (thành lập 2016) chuyên giải pháp chuyển đổi số trong sản xuất, nhân sự và khu vực công — đang tuyển Full Stack Developer qua FYI (dự án K-Tech College 2026). Đội ngũ FYI đã xem xét toàn bộ hồ sơ đã đăng ký và <b>chọn bạn vào danh sách đề cử</b> gửi cho nhà tuyển dụng.',
        ko: '제조·HR·공공 분야 디지털 전환 솔루션을 만드는 한국 기술기업 <b>OpenMinds</b>(2016년 설립)가 FYI를 통해 Full Stack Developer를 채용 중입니다(K-Tech College 2026). FYI 팀이 등록된 이력서 전체를 검토해 회원님을 <b>추천 명단에 선정</b>했습니다.',
        en: '<b>OpenMinds</b> — a Korean tech company (founded 2016) building digital-transformation solutions for manufacturing, HR and the public sector — is hiring a Full Stack Developer through FYI (K-Tech College 2026). The FYI team reviewed every registered CV and <b>selected you for the nominee list</b> sent to the recruiter.',
      },
      initial: 'O', company: 'OpenMinds', title: 'Full Stack Developer', meta: 'Không giới hạn địa điểm làm việc', tail: openmindsTail(BENEFIT_PRIVATE),
    }),
  },
  {
    match: /^resume-register-bonus/,
    subject: {
      vi: '{{name}} ơi, bạn chưa đủ điều kiện nhận thưởng 1.000.000₫',
      ko: '{{name}}님, 아직 1,000,000₫ 이벤트 대상이 아니에요',
      en: '{{name}}, you\'re not yet eligible for the 1,000,000₫ bonus',
    },
    desc: '이력서 등록 유도 축하금 프레임 (8/18): coldmail1에서 검증된 "아직 자격이 없다" 손실 프레임 + 취업 축하금 훅(1,000,000₫ · 베트남 현지 기업 · 입사 60일 근속 후 지급 — /cv 조건과 동일 명시). 수치는 금액·조건만(v1 조작 수치 계열 미사용). 버튼 = /api/resume/upload 토큰 랜딩 축하금 배리언트. -apply=지원버튼 이탈층 / -rest=그 외.',
    source: 'scripts/outreach/resume-register-bonus-coldmail.mjs',
    html: registerBonusHtml,
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

// 발송 전 초안 캠페인 — 이벤트가 없어도 콜드메일 탭 표에 '미발송' 행으로 띄워 양식을 검수한다.
// 발송이 시작되면(같은 이름의 이벤트가 쌓이면) 실측 행이 이 자리를 대체하므로 발송 후 지워도 된다.
export const DRAFT_CAMPAIGNS = [
  { campaign: 'resume-register-bonus1-apply', group: 'register' },
  { campaign: 'wellpod-recommend1', group: 'recommend' },
  { campaign: 'mnf-recommend1-public', group: 'recommend' },
  { campaign: 'mnf-recommend1-private', group: 'recommend' },
]

export const templateFor = (name) => COLDMAIL_TEMPLATES.find((t) => t.match.test(name || '')) || null

// 모달 표시용: 토글 언어에 맞춰 subject/html을 풀어준다. vi=발송 원문, ko/en=열람용 번역본.
export const localizeTemplate = (t, lang) => ({
  ...t,
  subject: typeof t.subject === 'string' ? t.subject : pickLang(t.subject, lang),
  html: typeof t.html === 'function' ? t.html(lang) : t.html,
})
