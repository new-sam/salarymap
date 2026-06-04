// Personal/free email providers — blocked from company verification.
// A work email is the proof of employment, so consumer mailboxes must be rejected.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'naver.com', 'daum.net', 'hanmail.net', 'nate.com', 'kakao.com',
  'yahoo.com', 'yahoo.co.jp', 'ymail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'aol.com', 'gmx.com', 'zoho.com', 'mail.com', 'yandex.com',
  // Vietnam common consumer providers
  'fpt.vn',
])

export function isFreeDomain(domain) {
  return FREE_EMAIL_DOMAINS.has((domain || '').toLowerCase())
}

export default FREE_EMAIL_DOMAINS
