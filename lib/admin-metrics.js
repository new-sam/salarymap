// CANONICAL METRIC SPEC — single source of truth for admin-side submission metrics.
//
// Imported by:
//   - pages/api/admin/dashboard.js  (per-range/daily breakdown)
//   - pages/api/admin/realtime.js   (today partial-day, shown on dashboard top + today row)
//
// ⚠ The Slack bot (supabase/functions/daily-summary/index.ts) is Deno+TS and
//   cannot import from this file. Its constants MUST be kept in sync manually
//   whenever this spec changes.

// Exact-match garbage company filter (case-folded). Strict, NOT substring.
export const EXCLUDED_COMPANIES = new Set([
  'likelion', 'likelion vn', 'likelion vietnam',
  '{company}', 'dwqdqwd', 'gggg', 'kkk', 'xx', 'yy', 'tt', 'xd', 'blah', 'idk',
  'úud', 'ừv', 'khôbg', 'bcagnecu', 'hi', 'boo', 'cac', 'say gex', '12',
  'alice testing', 'alice testing 2', 'jobtest', '...', 'bimat', 'bí mật',
  'secret', 'cant say', 'ẩn danh', 'tên công ty được giữ ẩn danh',
  'anonymous', 'hide', 'm*',
])

// Internal/dummy email domains that aren't real users.
export const EXCLUDED_EMAIL_DOMAINS = ['likelion.net', 'dummy.local', 'system.local']

// Paid traffic sources. Everything else (organic threads, direct, etc.) is Organic.
// Extend when new paid channels (e.g. google, tiktok) launch.
export const PAID_SOURCES = new Set(['meta', 'MT'])

// `source` values that mean "not a real user submission" — QA test / unset.
export const EXCLUDED_SOURCES = new Set(['qa-local', '', null])

// True if a submission row should be excluded from metric counts.
export function isExcludedSubmission(sub) {
  if (sub.company && EXCLUDED_COMPANIES.has(sub.company.trim().toLowerCase())) return true
  if (sub.email && EXCLUDED_EMAIL_DOMAINS.some(d => sub.email.endsWith('@' + d))) return true
  if (EXCLUDED_SOURCES.has(sub.source)) return true
  return false
}

// Dedupe by (user_id, company) — preserves rows missing either field.
export function dedupeSubmissions(subs) {
  const seen = new Set()
  return subs.filter(s => {
    if (!s.user_id || !s.company) return true
    const key = s.user_id + '::' + s.company.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Same isExcluded check, but for the auth.users signup feed (different shape).
export function isExcludedSignup(user) {
  if (user.email && EXCLUDED_EMAIL_DOMAINS.some(d => user.email.endsWith('@' + d))) return true
  if (user.banned_until && new Date(user.banned_until) > new Date()) return true
  return false
}
