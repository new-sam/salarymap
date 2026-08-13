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

// 개별 QA/테스트 계정 — gmail 처럼 공용 도메인이라 도메인 단위로는 못 거르는 주소.
// 소문자로 적을 것 (isExcludedEmail 이 case-fold 후 비교).
export const EXCLUDED_EMAILS = new Set(['snfjddl03@gmail.com'])

// Paid traffic sources. Everything else (organic threads, direct, etc.) is Organic.
// Extend when new paid channels (e.g. google, tiktok) launch.
export const PAID_SOURCES = new Set(['meta', 'MT'])

// `source` values that mean "not a real user submission" — QA test / unset.
export const EXCLUDED_SOURCES = new Set(['qa-local', '', null])

// True if a submission row should be excluded from metric counts.
export function isExcludedSubmission(sub) {
  if (sub.company && EXCLUDED_COMPANIES.has(sub.company.trim().toLowerCase())) return true
  if (isExcludedEmail(sub.email)) return true
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

// True if an email belongs to an internal/test domain (e.g. @likelion.net)
// or is a listed individual QA account.
export function isExcludedEmail(email) {
  if (!email) return false
  const e = email.toLowerCase()
  return EXCLUDED_EMAILS.has(e) || EXCLUDED_EMAIL_DOMAINS.some(d => e.endsWith('@' + d))
}

// True if a job application should be excluded from metric counts — internal/test
// applicant (e.g. @likelion.net). Mirrors isExcludedSubmission for the apply feed.
// 지원자가 스스로 취소한 지원(status='canceled')도 제외 — 취소 후 재지원하면 새 행이
// 생기므로, 취소분을 세면 같은 지원이 두 번 집계된다.
export function isExcludedApplication(app) {
  return app.status === 'canceled' || isExcludedEmail(app.applicant_email)
}

// 이메일 기준 제외 대상(@likelion.net 등)의 auth user id 집합.
// user_profiles에는 이메일 컬럼이 없어서, 프로필 단위로 거르는 API(인재풀·공급·연봉수집)는
// 이걸로 id를 만들어 필터한다. auth.admin.listUsers 전량 페이지네이션(1000/페이지).
export async function fetchExcludedUserIds(supabase) {
  const ids = new Set()
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users
    if (error || !users || users.length === 0) break
    for (const u of users) if (isExcludedEmail(u.email)) ids.add(u.id)
    if (users.length < 1000) break
  }
  return ids
}

// Same isExcluded check, but for the auth.users signup feed (different shape).
export function isExcludedSignup(user) {
  if (isExcludedEmail(user.email)) return true
  if (user.banned_until && new Date(user.banned_until) > new Date()) return true
  return false
}
