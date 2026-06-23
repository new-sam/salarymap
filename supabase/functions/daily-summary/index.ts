// FYI Daily Summary — Supabase Edge Function
// GA4 Sessions + Supabase data -> Slack

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL")!;

const GA4_PROPERTY_ID = Deno.env.get("GA4_PROPERTY_ID") || "533725598";
const GA4_CLIENT_EMAIL = Deno.env.get("GA4_CLIENT_EMAIL") || "";
const GA4_PRIVATE_KEY = (Deno.env.get("GA4_PRIVATE_KEY") || "").replace(/\\n/g, "\n");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CAMPAIGN_START = "2026-04-20";

// CANONICAL SPEC — keep in sync with pages/api/admin/dashboard.js
// Exact-match (case-folded) garbage company list. Strict, NOT substring.
const EXCLUDED_COMPANIES = new Set([
  "likelion", "likelion vn", "likelion vietnam",
  "{company}", "dwqdqwd", "gggg", "kkk", "xx", "yy", "tt", "xd", "blah", "idk",
  "úud", "ừv", "khôbg", "bcagnecu", "hi", "boo", "cac", "say gex", "12",
  "alice testing", "alice testing 2", "jobtest", "...", "bimat", "bí mật",
  "secret", "cant say", "ẩn danh", "tên công ty được giữ ẩn danh",
  "anonymous", "hide", "m*",
]);
const EXCLUDED_EMAIL_DOMAINS = ["likelion.net", "dummy.local", "system.local"];
const PAID_SOURCES = new Set(["meta", "MT"]);
const EXCLUDED_SOURCES = new Set(["qa-local", "", null]);

function isExcludedSubmission(r: any): boolean {
  if (r.company && EXCLUDED_COMPANIES.has(r.company.trim().toLowerCase())) return true;
  if (r.email && EXCLUDED_EMAIL_DOMAINS.some((d) => r.email.endsWith("@" + d))) return true;
  if (EXCLUDED_SOURCES.has(r.source)) return true;
  return false;
}

function dedupeSubmissions(rows: any[]): any[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!r.user_id || !r.company) return true;
    const key = r.user_id + "::" + r.company.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Helpers ───
function getVietnamDate(daysAgo = 0): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  vn.setDate(vn.getDate() - daysAgo);
  return vn.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" → 그 전날의 "YYYY-MM-DD" (UTC 기반 산술이지만 자정 처리만
// 정확하면 되므로 OK — getCumulative 에서 sessions/companies 의 endDate 를
// 어제로 자르는 용도).
function previousDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function getVietnamTime(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${vn.getHours().toString().padStart(2, "0")}:${vn.getMinutes().toString().padStart(2, "0")}`;
}

function getDayName(dateStr: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d = new Date(dateStr + "T12:00:00Z");
  return days[d.getUTCDay()];
}

// YYYY-MM-DD에서 delta일 가감(앱 MAU 30일 구간 계산용).
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "-";
  if (previous === 0) return "NEW";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return `+${change}%`;
  if (change < 0) return `${change}%`;
  return "0%";
}

function dodEmoji(current: number, previous: number): string {
  // 코드 블록(```)안에서 emoji shortcode 가 변환 안 되므로 unicode 사용.
  if (current > previous) return " ▲";
  if (current < previous) return " ▽";
  return "";
}

// 신규 가입 / 이력서 등록처럼 "오늘 갑자기 튀었는지" 가 중요한 지표는
// 일반 ▲▽ 대신 🔥/🔥🔥 으로 한눈에 잡히게 한다.
//   +100% 이상 → 🔥
//   +200% 이상 → 🔥🔥
//   0 → 양수 = NEW → 🔥🔥
//   그 외엔 일반 dodEmoji 와 동일.
function boostEmoji(current: number, previous: number): string {
  if (previous === 0 && current > 0) return " 🔥🔥";
  if (previous === 0) return "";
  const change = (current - previous) / previous;
  if (change >= 2.0) return " 🔥🔥";
  if (change >= 1.0) return " 🔥";
  return dodEmoji(current, previous);
}

function convRate(num: number, den: number): string {
  if (den === 0) return "0.0%";
  return ((num / den) * 100).toFixed(1) + "%";
}

// 코드 블록 안에서 한글/영문 폭 보정. desktop slack 의 모노스페이스 폰트
// (Mac: Menlo / Win: Consolas) 의 CJK fallback 폰트는 한글 한 글자 ≒ ASCII
// 두 칸. emoji 는 일반적으로 2 칸이지만 라인 끝에만 두면 정렬에 영향 없음.
function widthOf(s: string): number {
  return [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
}
function padLabel(label: string, total: number): string {
  return label + " ".repeat(Math.max(1, total - widthOf(label)));
}

const LABEL_W = 32;
const VAL_W = 7;
const PCT_W = 5;

function metricLine(label: string, curr: number, prev: number, isBoost = false): string {
  const val = curr.toLocaleString().padStart(VAL_W);
  const pct = pctChange(curr, prev).padStart(PCT_W);
  const em = (isBoost ? boostEmoji(curr, prev) : dodEmoji(curr, prev)).trim();
  return padLabel(label, LABEL_W) + val + "  " + pct + (em ? " " + em : "");
}

function cumLine(label: string, value: number): string {
  return padLabel(label, LABEL_W) + value.toLocaleString().padStart(VAL_W);
}

function codeBlock(lines: string[]): string {
  return "```\n" + lines.join("\n") + "\n```";
}

// ─── GA4 API ───
function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "")
    .replace(/\r/g, "")
    .trim();
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let _ga4TokenCache = { token: "", expiry: 0 };

async function getGA4Token(): Promise<string> {
  if (_ga4TokenCache.token && Date.now() < _ga4TokenCache.expiry) return _ga4TokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: GA4_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const signInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(GA4_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signInput));
  const signature = base64url(new Uint8Array(sig));
  const jwt = `${signInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (data.error) throw new Error(`GA4 token: ${data.error_description}`);
  _ga4TokenCache = { token: data.access_token, expiry: Date.now() + 50 * 60 * 1000 };
  return data.access_token;
}

async function ga4RunReport(body: object): Promise<any> {
  const token = await getGA4Token();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GA4 API: ${err.error?.message || res.status}`);
  }
  return res.json();
}

async function getGA4Sessions(dateStr: string): Promise<number> {
  try {
    const data = await ga4RunReport({
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      metrics: [{ name: "sessions" }],
    });
    return parseInt(data.rows?.[0]?.metricValues?.[0]?.value || "0");
  } catch (e) {
    console.error("GA4 sessions error:", e.message);
    return 0;
  }
}

async function getGA4SessionsRange(startDate: string, endDate: string): Promise<number> {
  try {
    const data = await ga4RunReport({
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "sessions" }],
    });
    return parseInt(data.rows?.[0]?.metricValues?.[0]?.value || "0");
  } catch (e) {
    console.error("GA4 sessions range error:", e.message);
    return 0;
  }
}

async function getGA4TodaySessions(): Promise<number> {
  try {
    const data = await ga4RunReport({
      dateRanges: [{ startDate: "today", endDate: "today" }],
      metrics: [{ name: "sessions" }],
    });
    return parseInt(data.rows?.[0]?.metricValues?.[0]?.value || "0");
  } catch (e) {
    console.error("GA4 today sessions error:", e.message);
    return 0;
  }
}

// 어제 0시 ~ 현재 시각(시간 단위) 까지 누적 sessions. realtime 의 fair DoD
// 비교 base 로 사용 — "어제 같은 시각까지" vs "오늘 누적".
async function getGA4SessionsUpToHour(dateStr: string, endHour: number): Promise<number> {
  try {
    const data = await ga4RunReport({
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      dimensions: [{ name: "hour" }],
      metrics: [{ name: "sessions" }],
    });
    return (data.rows || []).reduce((sum: number, r: any) => {
      const h = parseInt(r.dimensionValues[0].value);
      return h <= endHour ? sum + parseInt(r.metricValues[0].value || "0") : sum;
    }, 0);
  } catch (e) {
    console.error("GA4 sessions upToHour error:", e.message);
    return 0;
  }
}

// ─── Supabase Data ───
// 누적이 1000행을 넘으면 supabase-js 기본 limit 에 잘리므로 페이지네이션해서
// 모두 가져온다. /api/admin/dashboard 의 fetchAll 와 동일 동작.
async function fetchSubmissions(startUtc: string, endUtc: string): Promise<any[]> {
  const PAGE = 1000;
  let from = 0;
  const out: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("submissions")
      .select("source, company, email, user_id, created_at")
      .eq("is_seed", false)
      .gte("created_at", startUtc)
      .lte("created_at", endUtc)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function getSubmissions(dateStr: string) {
  const startUtc = `${dateStr}T00:00:00+07:00`;
  const endUtc = `${dateStr}T23:59:59+07:00`;
  const data = await fetchSubmissions(startUtc, endUtc);
  const deduped = dedupeSubmissions(data.filter((r: any) => !isExcludedSubmission(r)));
  const ad = deduped.filter((r: any) => PAID_SOURCES.has(r.source)).length;
  const companies = new Set(deduped.map((r: any) => r.company?.trim().toLowerCase()).filter(Boolean)).size;
  return { total: deduped.length, ad, organic: deduped.length - ad, companies };
}

// realtime / daily / weekly 가 공통으로 쓰는 한 기간의 모든 메트릭 bundle.
// resumes 는 events count (admin/realtime overlay 식). daily 에선 호출 후
// admin daily row 식(user_profiles) 으로 따로 overwrite.
async function getRangeBundle(startUtc: string, endUtc: string) {
  const subs = await fetchSubmissions(startUtc, endUtc);
  const deduped = dedupeSubmissions(subs.filter((r: any) => !isExcludedSubmission(r)));
  const ad = deduped.filter((r: any) => PAID_SOURCES.has(r.source)).length;
  const companies = new Set(deduped.map((r: any) => r.company?.trim().toLowerCase()).filter(Boolean)).size;
  const signupRes = await getSignupsInRange(startUtc, endUtc);
  const signupSplit = await splitSignupPlatform(signupRes.ids);
  const { count: jobApps } = await supabase
    .from("job_applications")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);
  const { count: resumes } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("event", ["cv_register_success", "resume_upload"])
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);
  return {
    submissions: deduped.length,
    ad,
    organic: deduped.length - ad,
    companies,
    signups: signupRes.count,
    signupWeb: signupSplit.web,
    signupApp: signupSplit.app,
    jobApps: jobApps || 0,
    resumes: resumes || 0,
  };
}

// auth.users 페이지네이션 + isExcludedSignup 필터. /api/admin/dashboard 와
// 동일한 식. 기존엔 count_signups RPC 를 호출했는데 RPC 가 likelion 같은
// 내부 도메인을 제외하지 않을 수 있어 대시보드와 숫자가 어긋났다.
async function listAllAuthUsers(): Promise<any[]> {
  const out: any[] = [];
  let page = 1;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !users || users.length === 0) break;
    out.push(...users);
    if (users.length < 1000) break;
    page++;
  }
  return out;
}

async function getSignupsInRange(startUtc: string, endUtc: string): Promise<{ count: number; ids: string[] }> {
  // ADMIN PARITY — admin/realtime.js:23 와 같은 ISO-UTC 정규화. count 와
  // user_id 목록 모두 반환 (id 는 web/app split 산출용).
  const startISO = new Date(startUtc).toISOString();
  const endISO = new Date(endUtc).toISOString();
  try {
    const all = await listAllAuthUsers();
    const filtered = all.filter((u: any) => u.created_at >= startISO && u.created_at <= endISO && !isExcludedSignup(u));
    return { count: filtered.length, ids: filtered.map((u: any) => u.id) };
  } catch (e) {
    console.error("Sign-ups listUsers error:", (e as Error).message);
    return { count: 0, ids: [] };
  }
}

// 신규 가입 user_id 목록 → events 의 첫 이벤트 platform 으로 web/app 분류.
// 모바일 앱은 events.meta.platform = 'app' 로 식별. 웹은 그 외(null 포함).
// events 가 전혀 없는 user 는 web 으로 default (가입만 한 dormant).
async function splitSignupPlatform(userIds: string[]): Promise<{ web: number; app: number }> {
  if (userIds.length === 0) return { web: 0, app: 0 };
  const platformByUid: Record<string, string> = {};
  // .in() 의 large list 안전 처리: 200 명씩 chunk.
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data } = await supabase
      .from("events")
      .select("user_id, meta, created_at")
      .in("user_id", chunk)
      .order("created_at", { ascending: true });
    for (const e of data || []) {
      if (!platformByUid[e.user_id]) {
        platformByUid[e.user_id] = e.meta?.platform === "app" ? "app" : "web";
      }
    }
  }
  let app = 0, web = 0;
  for (const uid of userIds) {
    if (platformByUid[uid] === "app") app++; else web++;
  }
  return { web, app };
}

async function getSignups(dateStr: string): Promise<number> {
  const startUtc = `${dateStr}T00:00:00+07:00`;
  const endUtc = `${dateStr}T23:59:59+07:00`;
  return getSignupsInRange(startUtc, endUtc);
}

function isExcludedSignup(user: any): boolean {
  const email = (user.email || "").toLowerCase();
  if (email && EXCLUDED_EMAIL_DOMAINS.some((d) => email.endsWith("@" + d))) return true;
  if (user.banned_until && new Date(user.banned_until) > new Date()) return true;
  return false;
}

async function getJobApps(dateStr: string): Promise<number> {
  const startUtc = `${dateStr}T00:00:00+07:00`;
  const endUtc = `${dateStr}T23:59:59+07:00`;
  const { count, error } = await supabase
    .from("job_applications")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);
  if (error) throw error;
  return count || 0;
}

// 이력서 등록 — admin 의 두 화면이 정의를 다르게 쓴다. 슬랙봇도 그에
// 맞춰 분리한다.
//
// 누적 (전체 기간) = /admin/dashboard 의 resumeUploads 와 동일 ⇒
//   user_profiles 의 resume_url 보유 사용자 수 (사람 기준, dedupe).
// 오늘 = /api/admin/realtime 의 resumeUploads 와 동일 ⇒
//   events.cv_register_success + resume_upload 의 raw count.
//
// 정의가 한쪽으로 통일 안 된 건 admin 측 결정이라 봇이 그대로 따라간다.
//
// 누적 정의 추가 주의 — admin/dashboard.js (API) line 102-106 의
// resumeUsers 는 시간 필터 없이 user_profiles 의 resume_url 보유자 전체를
// 뽑고 .length 를 totalResumeUploads 로 쓴다. 캠페인 시작일 이전 등록자도
// 포함된다. 봇도 그대로 따라가야 admin 의 "전체 기간 누적 — 이력서 등록"
// 카드 숫자와 정확히 일치한다.
async function getResumeUploadsCumulative(): Promise<number> {
  const { count, error } = await supabase
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .not("resume_url", "is", null);
  if (error) { console.error("Resume cumulative error:", JSON.stringify(error)); return 0; }
  return count || 0;
}

async function getResumeUploadsToday(startUtc: string, endUtc: string): Promise<number> {
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("event", ["cv_register_success", "resume_upload"])
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);
  if (error) { console.error("Resume today error:", JSON.stringify(error)); return 0; }
  return count || 0;
}

async function getResumeUploadsForDate(dateStr: string): Promise<number> {
  return getResumeUploadsToday(`${dateStr}T00:00:00+07:00`, `${dateStr}T23:59:59+07:00`);
}

// admin UI 의 *일별 행* 정의 — 다만 dashboard.js:199-217 의 todayData
// 로직이 "그 시점의 오늘 행" 만 realtime(events count) 으로 덮어쓰기
// 한다. 따라서 호출 시점이 그 날짜와 같으면 events 식, 어제 이전이면
// user_profiles 식을 쓰는 wrapper 가 admin UI 와 정확히 매칭.
async function getResumeUploadsForDateAdminUI(dateStr: string): Promise<number> {
  if (dateStr === getVietnamDate(0)) {
    return getResumeUploadsForDate(dateStr); // events count (admin todayData overlay)
  }
  return getResumeUploadsForDateProfileBased(dateStr); // user_profiles (admin daily row)
}

async function getResumeUploadsForDateProfileBased(dateStr: string): Promise<number> {
  const startUtc = new Date(`${dateStr}T00:00:00+07:00`).toISOString();
  const endUtc = new Date(`${dateStr}T23:59:59+07:00`).toISOString();
  const { count, error } = await supabase
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .not("resume_url", "is", null)
    .gte("updated_at", startUtc)
    .lte("updated_at", endUtc);
  if (error) { console.error("Resume daily error:", JSON.stringify(error)); return 0; }
  return count || 0;
}

async function getCumulative(startDate: string, endDate: string) {
  // ADMIN PARITY — admin/dashboard.js 의 누적 카드는 base = 4/20~어제
  // (data.summary, from `/api/admin/dashboard`) 위에 오늘 분 diff 를 일부
  // 메트릭에만 더해서 표시한다. 정확한 매핑:
  //   submissions / ad / organic / signups / jobApps → base + 오늘 diff
  //     = 사실상 4/20 ~ 오늘 (봇과 동일)
  //   sessions / companies / resumeUploads → base 만 (오늘 diff 없음)
  //     = 4/20 ~ 어제 까지 (sessions/companies), 또는 시간 무관 snapshot
  //     (resumeUploads). 봇도 같은 비대칭을 그대로 구현해야 두 화면이
  //     모두 일치한다. 이 비대칭은 admin/dashboard.js:224-248 에서
  //     diff('xxx') 호출이 어느 키에 적용되는지에 의해 결정된다.
  const startUtc = `${startDate}T00:00:00+07:00`;
  const endUtc = `${endDate}T23:59:59+07:00`;

  // 1) 오늘 포함 메트릭 (admin 이 today diff 를 더함):
  const subs = await fetchSubmissions(startUtc, endUtc);
  const deduped = dedupeSubmissions(subs.filter((r: any) => !isExcludedSubmission(r)));
  const totalAd = deduped.filter((r: any) => PAID_SOURCES.has(r.source)).length;
  const totalSignups = (await getSignupsInRange(startUtc, endUtc)).count;
  const { count: jobApps } = await supabase
    .from("job_applications")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);

  // 2) 오늘 미포함 메트릭 (admin 이 today diff 안 더함):
  //    - sessions: GA4(4/20 ~ 어제). admin/dashboard.js:228 = ga4.totals.sessions,
  //      그리고 ga4 호출의 to 는 dateRange.to = 어제 default.
  //    - companies: 같은 submissions 데이터에서 어제까지 row 만 Set.
  const yesterday = previousDay(endDate);
  const sessions = await getGA4SessionsRange(startDate, yesterday);
  // admin/dashboard.js:26-27 의 endISO 와 동일 — KST 자정 직전을 UTC ms 로
  // 환산해서 비교. 문자열 비교(예: "...Z" vs "...+07:00") 는 timezone
  // prefix 가 어긋나 KST 새벽 시간대가 잘못 포함되므로 반드시 Date 객체로.
  const yesterdayCutoffMs = new Date(`${yesterday}T23:59:59+07:00`).getTime();
  const dedupedToYesterday = deduped.filter(
    (r: any) => new Date(r.created_at).getTime() <= yesterdayCutoffMs
  );
  const totalCompanies = new Set(
    dedupedToYesterday.map((r: any) => r.company?.trim().toLowerCase()).filter(Boolean)
  ).size;

  // 3) 시간 무관 snapshot:
  //    - resumeUploads: admin/dashboard.js (API) line 102-106 = user_profiles
  //      의 resume_url 보유자 전체 (시간 필터 없음).
  const totalResumes = await getResumeUploadsCumulative();

  return {
    sessions,
    totalSubs: deduped.length,
    totalAd,
    totalOrganic: deduped.length - totalAd,
    totalSignups,
    totalJobApps: jobApps || 0,
    totalCompanies,
    totalResumes,
  };
}

// ─── App Metrics (모바일 앱 — events 테이블, meta.platform='app') ───
// 웹 GA4와 무관. 앱은 GA4를 안 쓰고 모든 행동이 events 테이블에 meta.platform='app'로 쌓인다.
// 식별자(client_id/session_id/user_id)는 전부 meta 안에 있다 — 최상위 컬럼은 앱 이벤트에서 null.
type AppStats = {
  devices: number; sessions: number; loggedIn: number; newDevices: number;
  salary: number; apply: number; resume: number; community: number;
  ios: number; android: number; clients: Set<string>;
  // 신규 기기 집합 + 그중 핵심행동까지 도달한 활성화 지표(getAppStats가 채운다)
  newClientSet: Set<string>;
  activatedNew: number;
  firstAction: { salary: number; apply: number; resume: number; community: number };
};

// 핵심행동 이벤트 → 카테고리 매핑. 활성화(첫 핵심행동) 집계에 사용.
const KEY_ACTION_MAP: Record<string, string> = {
  submit_salary: "salary",
  submit_application: "apply",
  resume_upload: "resume",
  create_community_post: "community",
  create_community_comment: "community",
};

// 기간 내 앱 이벤트 전부(event+meta만). 1000행 페이지네이션으로 누락 없이 가져온다.
async function fetchAppEvents(startUtc: string, endUtc: string): Promise<any[]> {
  const pageSize = 1000;
  let from = 0;
  const out: any[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("events")
      .select("event, meta")
      .eq("meta->>platform", "app")
      .gte("created_at", startUtc)
      .lte("created_at", endUtc)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function computeAppStats(events: any[]): AppStats {
  const clients = new Set<string>();
  const sessions = new Set<string>();
  const users = new Set<string>();
  const osByClient = new Map<string, string>();
  const cnt = (k: string) => events.reduce((n, e) => n + (e.event === k ? 1 : 0), 0);

  for (const e of events) {
    const m = e.meta || {};
    if (m.client_id) {
      clients.add(m.client_id);
      if (m.os && !osByClient.has(m.client_id)) osByClient.set(m.client_id, m.os);
    }
    if (m.session_id) sessions.add(m.session_id);
    if (m.user_id) users.add(m.user_id);
  }
  let ios = 0, android = 0;
  for (const os of osByClient.values()) {
    if (os === "ios") ios++;
    else if (os === "android") android++;
  }
  return {
    devices: clients.size,
    sessions: sessions.size,
    loggedIn: users.size,
    newDevices: 0, // getAppStats가 채운다
    salary: cnt("submit_salary"),
    apply: cnt("submit_application"),
    resume: cnt("resume_upload"),
    community: cnt("create_community_post") + cnt("create_community_comment"),
    ios, android, clients,
    newClientSet: new Set(), // getAppStats가 채운다
    activatedNew: 0,
    firstAction: { salary: 0, apply: 0, resume: 0, community: 0 },
  };
}

// 신규 기기 중 기간 내 첫 핵심행동까지 도달한 기기 수 + 첫 행동 분포.
// events는 created_at 오름차순이라, 기기별 첫 핵심행동이 자동으로 먼저 잡힌다.
function computeActivation(events: any[], newSet: Set<string>) {
  const firstAction = { salary: 0, apply: 0, resume: 0, community: 0 } as Record<string, number>;
  const counted = new Set<string>();
  for (const e of events) {
    const cat = KEY_ACTION_MAP[e.event];
    const cid = e.meta?.client_id;
    if (!cat || !cid || !newSet.has(cid) || counted.has(cid)) continue;
    counted.add(cid);
    firstAction[cat]++;
  }
  return { activated: counted.size, firstAction };
}

// 신규 디바이스 = 기간 내 활성 client_id 중 기간 시작 이전에 이벤트가 없던 것.
// 활성 디바이스 목록(작음)으로만 조회를 좁혀 스케일 안전.
async function filterNewClients(clients: Set<string>, startUtc: string): Promise<Set<string>> {
  if (clients.size === 0) return new Set();
  const list = [...clients];
  const { data, error } = await supabase
    .from("events")
    .select("meta")
    .eq("meta->>platform", "app")
    .in("meta->>client_id", list)
    .lt("created_at", startUtc)
    .limit(50000);
  if (error) {
    console.error("App newDevices error:", error.message);
    return new Set(list); // 알 수 없으면 전부 신규로 본다
  }
  const before = new Set((data || []).map((r: any) => r.meta?.client_id).filter(Boolean));
  return new Set(list.filter((c) => !before.has(c)));
}

// 특정 날짜(현지)에 "처음 등장한" 기기 집합. 잔존 코호트 산출용.
async function getNewClients(date: string): Promise<Set<string>> {
  const startUtc = `${date}T00:00:00+07:00`;
  const events = await fetchAppEvents(startUtc, `${date}T23:59:59+07:00`);
  const active = new Set<string>();
  for (const e of events) if (e.meta?.client_id) active.add(e.meta.client_id);
  return filterNewClients(active, startUtc);
}

async function getAppStats(startUtc: string, endUtc: string): Promise<AppStats> {
  const events = await fetchAppEvents(startUtc, endUtc);
  const stats = computeAppStats(events);
  stats.newClientSet = await filterNewClients(stats.clients, startUtc);
  stats.newDevices = stats.newClientSet.size;
  const act = computeActivation(events, stats.newClientSet);
  stats.activatedNew = act.activated;
  stats.firstAction = act.firstAction;
  return stats;
}

// MAU = 기간 종료일 기준 직전 30일 고유 디바이스 수.
async function getAppMau(endDate: string): Promise<number> {
  const events = await fetchAppEvents(
    `${addDays(endDate, -29)}T00:00:00+07:00`,
    `${endDate}T23:59:59+07:00`,
  );
  const clients = new Set<string>();
  for (const e of events) if (e.meta?.client_id) clients.add(e.meta.client_id);
  return clients.size;
}

// 푸시 옵트인: 총 enabled 토큰 수. (push_tokens엔 created_at이 없어 "기간 내 신규"는 집계 불가)
async function getPushTotal(): Promise<number> {
  const t = await supabase.from("push_tokens").select("*", { count: "exact", head: true }).eq("enabled", true);
  return t.error ? 0 : (t.count || 0);
}

// ─── Alert Detection ───
async function detectAlerts(todayTotal: number): Promise<string[]> {
  const alerts: string[] = [];
  const recent: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const stats = await getSubmissions(getVietnamDate(i));
    recent.push(stats.total);
  }

  if (recent.length >= 2) {
    let declining = true;
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i] >= recent[i + 1]) { declining = false; break; }
    }
    if (declining) {
      alerts.push(`:chart_with_downwards_trend: 연봉 제출 (Submissions) ${recent.length}일 연속 하락 중 / ${recent.length}-day decline (${[...recent].reverse().join(" -> ")})`);
    }
  }
  return alerts;
}

// ─── Slack Messages ───
type StatsBundle = {
  sessions: number;
  submissions: number;
  ad: number;
  organic: number;
  signups: number;
  signupWeb: number;
  signupApp: number;
  jobApps: number;
  resumes: number;
  companies: number;
};

function dod(curr: number, prev: number): string {
  return ` ${pctChange(curr, prev)}${dodEmoji(curr, prev)}`;
}
function boost(curr: number, prev: number): string {
  return ` ${pctChange(curr, prev)}${boostEmoji(curr, prev)}`;
}

// CJK 보정 padStart — 한글 글자 1개 = ASCII 2 칸.
function cjkPadStart(s: string, total: number): string {
  return " ".repeat(Math.max(0, total - widthOf(s))) + s;
}

// /fyi 의 3 컬럼 행: 라벨 | 어제값 | 오늘값 | DoD%.
function metricLine3(label: string, prev: number, curr: number, isBoost = false): string {
  const prv = prev.toLocaleString().padStart(VAL_W);
  const cur = curr.toLocaleString().padStart(VAL_W);
  const pct = pctChange(curr, prev).padStart(PCT_W);
  const em = (isBoost ? boostEmoji(curr, prev) : dodEmoji(curr, prev)).trim();
  return padLabel(label, LABEL_W) + prv + cur + "  " + pct + (em ? " " + em : "");
}

function metricHeader3(prevLabel: string, currLabel: string): string {
  return padLabel("", LABEL_W) + cjkPadStart(prevLabel, VAL_W) + cjkPadStart(currLabel, VAL_W) + "  " + cjkPadStart("DoD", PCT_W);
}

function buildRealtimeMessage(
  today: string,
  yesterday: string,
  timeStr: string,
  s: StatsBundle,
  p: StatsBundle,
  slashCommand: boolean,
) {
  const dayName = getDayName(today);
  const yLabel = yesterday.slice(5).replace("-", "/"); // "06-22" → "06/22"
  const tLabel = today.slice(5).replace("-", "/");

  return {
    response_type: slashCommand ? "in_channel" : undefined,
    attachments: [{
      color: "#2ea44f",
      blocks: [
        { type: "header", text: { type: "plain_text", text: `FYI 실시간 / Live — ${today} (${dayName}) ${timeStr} UTC+7` } },
        { type: "context", elements: [{ type: "mrkdwn", text: `${yLabel} 어제 같은 시각까지 vs ${tLabel} 오늘 ${timeStr} 까지 (DoD)` }] },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text:
          `*주요 지표 / Key metrics*\n` + codeBlock([
            metricHeader3(yLabel, tLabel),
            metricLine3("• 세션 (Sessions)", p.sessions, s.sessions),
            metricLine3("• 연봉 제출 (Submissions)", p.submissions, s.submissions),
            metricLine3("   ↳ 광고 (Paid)", p.ad, s.ad),
            metricLine3("   ↳ 자연유입 (Organic)", p.organic, s.organic),
            metricLine3("• 신규 가입 (Sign-ups)", p.signups, s.signups, true),
            metricLine3("   ↳ 웹 (Web)", p.signupWeb, s.signupWeb),
            metricLine3("   ↳ 앱 (App)", p.signupApp, s.signupApp),
            metricLine3("• 이력서 등록 (Resume uploads)", p.resumes, s.resumes, true),
            metricLine3("• 공고 지원 (Job apps)", p.jobApps, s.jobApps),
            metricLine3("• 회사 (Companies)", p.companies, s.companies),
          ])
        }},
      ],
    }],
  };
}

function buildDailyMessage(
  targetDate: string,
  s: StatsBundle,
  p: StatsBundle,
  cum: Awaited<ReturnType<typeof getCumulative>>,
  alerts: string[],
) {
  const dayName = getDayName(targetDate);
  const trendColor = s.submissions > p.submissions ? "#cc0000" : s.submissions < p.submissions ? "#1D6CE0" : "#999999";

  const alertBlock = alerts.length > 0
    ? [{ type: "section", text: { type: "mrkdwn", text: alerts.join("\n") } }]
    : [];

  return {
    // top-level text 에 <!here> 를 둬서 채널 멤버 전원 알림.
    text: "<!here>",
    attachments: [{
      color: trendColor,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "<!here> 오늘의 FYI 일일 리포트 / Today's FYI Daily Report" } },
        { type: "header", text: { type: "plain_text", text: `FYI 일일 리포트 / Daily — ${targetDate} (${dayName})` } },
        { type: "context", elements: [{ type: "mrkdwn", text: `데이터 기간 (Data range): ${targetDate} 00:00 ~ 23:59 (UTC+7) · 전일 대비 (DoD)` }] },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text:
          `*주요 지표 / Key metrics*\n` + codeBlock([
            metricLine("• 세션 (Sessions)", s.sessions, p.sessions),
            metricLine("• 연봉 제출 (Submissions)", s.submissions, p.submissions),
            metricLine("   ↳ 광고 (Paid)", s.ad, p.ad),
            metricLine("   ↳ 자연유입 (Organic)", s.organic, p.organic),
            metricLine("• 신규 가입 (Sign-ups)", s.signups, p.signups, true),
            metricLine("   ↳ 웹 (Web)", s.signupWeb, p.signupWeb),
            metricLine("   ↳ 앱 (App)", s.signupApp, p.signupApp),
            metricLine("• 이력서 등록 (Resume uploads)", s.resumes, p.resumes, true),
            metricLine("• 공고 지원 (Job apps)", s.jobApps, p.jobApps),
            metricLine("• 회사 (Companies)", s.companies, p.companies),
          ])
        }},
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text:
          `*전환율 / Conversion*\n` + codeBlock([
            padLabel("• 세션 → 연봉 제출", LABEL_W) + convRate(s.submissions, s.sessions).padStart(VAL_W),
            padLabel("• 연봉 제출 → 신규 가입", LABEL_W) + convRate(s.signups, s.submissions).padStart(VAL_W),
            padLabel("• 신규 가입 → 공고 지원", LABEL_W) + convRate(s.jobApps, s.signups).padStart(VAL_W),
          ])
        }},
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text:
          `*전체 기간 누적 (All-time)* — ${CAMPAIGN_START} ~ ${targetDate}\n` + codeBlock([
            cumLine("• 세션 (Sessions)", cum.sessions),
            cumLine("• 연봉 제출 (Submissions)", cum.totalSubs),
            cumLine("   ↳ 광고 (Paid)", cum.totalAd),
            cumLine("   ↳ 자연유입 (Organic)", cum.totalOrganic),
            cumLine("• 신규 가입 (Sign-ups)", cum.totalSignups),
            cumLine("• 이력서 등록 (Resume uploads)", cum.totalResumes),
            cumLine("• 공고 지원 (Job apps)", cum.totalJobApps),
            cumLine("• 누적 회사 (Companies)", cum.totalCompanies),
          ])
        }},
        ...alertBlock,
      ],
    }],
  };
}

function buildWeeklyMessage(
  weekLabel: string,
  t: Awaited<ReturnType<typeof getCumulative>>,
  l: Awaited<ReturnType<typeof getCumulative>>,
) {
  const trendColor = t.totalSubs > l.totalSubs ? "#cc0000" : t.totalSubs < l.totalSubs ? "#1D6CE0" : "#999999";

  return {
    attachments: [{
      color: trendColor,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `FYI 주간 리포트 / Weekly — ${weekLabel}` } },
        { type: "context", elements: [{ type: "mrkdwn", text: "전주 대비 (WoW)" }] },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text:
          `*주요 지표 / Key metrics*\n` + codeBlock([
            metricLine("• 세션 (Sessions)", t.sessions, l.sessions),
            metricLine("• 연봉 제출 (Submissions)", t.totalSubs, l.totalSubs),
            metricLine("   ↳ 광고 (Paid)", t.totalAd, l.totalAd),
            metricLine("   ↳ 자연유입 (Organic)", t.totalOrganic, l.totalOrganic),
            metricLine("• 신규 가입 (Sign-ups)", t.totalSignups, l.totalSignups, true),
            metricLine("• 이력서 등록 (Resume uploads)", t.totalResumes, l.totalResumes, true),
            metricLine("• 공고 지원 (Job apps)", t.totalJobApps, l.totalJobApps),
            metricLine("• 회사 (Companies)", t.totalCompanies, l.totalCompanies),
          ])
        }},
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text:
          `*전환율 / Conversion*\n` + codeBlock([
            padLabel("• 세션 → 연봉 제출", LABEL_W) + convRate(t.totalSubs, t.sessions).padStart(VAL_W),
            padLabel("• 연봉 제출 → 신규 가입", LABEL_W) + convRate(t.totalSignups, t.totalSubs).padStart(VAL_W),
            padLabel("• 신규 가입 → 공고 지원", LABEL_W) + convRate(t.totalJobApps, t.totalSignups).padStart(VAL_W),
          ])
        }},
      ],
    }],
  };
}

// ─── App Report Attachments (웹 메시지에 별도 카드로 덧붙임) ───
const APP_COLOR = "#5865F2"; // 앱 블록을 웹과 구분하는 색상바

type RetCohort = { size: number; retained: number; date: string };
type DailyRet = { d1: RetCohort; d7: RetCohort };

function retLine(label: string, r: RetCohort): string {
  if (r.size === 0) return `*${label}*  —  _(no cohort)_`;
  return `*${label}*  \`${r.retained}/${r.size}\`  (${convRate(r.retained, r.size)})  ·  cohort ${r.date}`;
}

function buildAppDailyAttachment(stats: AppStats, prev: AppStats, ret: DailyRet, mau: number, dateStr: string) {
  const dau = stats.devices;
  const stickiness = mau > 0 ? convRate(dau, mau) : "—";
  const spd = stats.devices > 0 ? (stats.sessions / stats.devices).toFixed(1) : "—";
  const actRate = stats.newDevices > 0 ? convRate(stats.activatedNew, stats.newDevices) : "—";
  const fa = stats.firstAction;
  const firstActionLine = stats.activatedNew > 0
    ? `*First action*   Salary \`${fa.salary}\`  ·  Apply \`${fa.apply}\`  ·  Resume \`${fa.resume}\`  ·  Community \`${fa.community}\``
    : `*First action*   —`;
  return {
    color: APP_COLOR,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `📱 App Report (DoD · ${dateStr} ${getDayName(dateStr)})`, emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: [
        `*— Retention —*`,
        retLine("D1", ret.d1),
        retLine("D7", ret.d7),
        `*Stickiness*  \`${stickiness}\`  (DAU ${dau} / MAU ${mau})`,
        ``,
        `*— Activation —*`,
        `*New → action*  \`${stats.activatedNew}/${stats.newDevices}\`  (${actRate})`,
        firstActionLine,
        ``,
        `*— Reach —*`,
        `*Active devices*  \`${stats.devices}\`  ${pctChange(stats.devices, prev.devices)}${dodEmoji(stats.devices, prev.devices)}`,
        `*New devices*  \`${stats.newDevices}\`  ${pctChange(stats.newDevices, prev.newDevices)}`,
        `*Logged-in*  \`${stats.loggedIn}\` / ${stats.devices}`,
        `*Sessions/device*  \`${spd}\``,
        ``,
        `*Key actions*   Salary \`${stats.salary}\`  ·  Apply \`${stats.apply}\`  ·  Resume \`${stats.resume}\`  ·  Community \`${stats.community}\``,
      ].join("\n") } },
    ],
  };
}

function buildAppWeeklyAttachment(thisW: AppStats, lastW: AppStats, mau: number, pushTotal: number) {
  const stickiness = mau > 0 ? convRate(thisW.devices, mau) : "—";
  return {
    color: APP_COLOR,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📱 App Report (WoW)", emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: [
        `*Active devices (WAU)*  \`${thisW.devices}\`  ${pctChange(thisW.devices, lastW.devices)}`,
        `*MAU (30d)*  \`${mau}\`   ·   *Stickiness*  ${stickiness}`,
        `*Sessions*  \`${thisW.sessions}\`  ${pctChange(thisW.sessions, lastW.sessions)}`,
        `*New devices*  \`${thisW.newDevices}\`  ${pctChange(thisW.newDevices, lastW.newDevices)}`,
        `*Logged-in*  \`${thisW.loggedIn}\``,
        `*Push opt-in*  total \`${pushTotal}\``,
        ``,
        `*Key actions*   Salary \`${thisW.salary}\`  ·  Apply \`${thisW.apply}\`  ·  Resume \`${thisW.resume}\`  ·  Community \`${thisW.community}\``,
      ].join("\n") } },
    ],
  };
}

// ─── Health Check ───
const HEALTHCHECK_URL = "https://salary-fyi.com/";
const HEALTHCHECK_TIMEOUT = 15000; // 15s

async function checkServerHealth(): Promise<{ ok: boolean; status: number; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT);
    const res = await fetch(HEALTHCHECK_URL, { signal: controller.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;
    return { ok: res.ok, status: res.status, latency };
  } catch (e) {
    const latency = Date.now() - start;
    return { ok: false, status: 0, latency, error: e.message };
  }
}

function buildHealthAlertMessage(result: { ok: boolean; status: number; latency: number; error?: string }) {
  const timeStr = getVietnamTime();
  const today = getVietnamDate(0);
  const dayName = getDayName(today);

  if (result.ok) {
    return {
      attachments: [{
        color: "#2ea44f",
        blocks: [
          { type: "header", text: { type: "plain_text", text: `:white_check_mark: Server OK - ${today} (${dayName}) ${timeStr}` } },
          { type: "section", text: { type: "mrkdwn", text: `*${HEALTHCHECK_URL}*\nStatus: \`${result.status}\` | Latency: \`${result.latency}ms\`` } },
        ],
      }],
    };
  }

  const reason = result.error
    ? (result.error.includes("abort") ? "Timeout (15s)" : result.error)
    : `HTTP ${result.status}`;

  return {
    attachments: [{
      color: "#cc0000",
      blocks: [
        { type: "header", text: { type: "plain_text", text: `:rotating_light: Server DOWN - ${today} (${dayName}) ${timeStr}` } },
        { type: "section", text: { type: "mrkdwn", text: [
          `*${HEALTHCHECK_URL}*`,
          `Reason: \`${reason}\``,
          `Latency: \`${result.latency}ms\``,
          ``,
          `<!channel> 서버 확인이 필요합니다! / Server check needed!`,
        ].join("\n") } },
      ],
    }],
  };
}

// ─── Slack Send ───
async function sendToSlack(payload: object) {
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack error: ${res.status} ${await res.text()}`);
}

// ─── Main Handler ───
// 같은 realtime 페이로드를 슬래시 커맨드 (response_url 비동기) 와 cron
// (직접 Slack webhook) 양쪽에서 재사용한다. listUsers + submissions
// 페이지네이션 때문에 응답이 5초 가까이 걸려서 Slack 3초 ack 한계를
// 넘는다 → /fyi 는 즉시 200 ack 만 응답하고 response_url 로 follow-up.
async function buildRealtimePayload(slashCommand: boolean) {
  const today = getVietnamDate(0);
  const yesterday = getVietnamDate(1);
  const timeStr = getVietnamTime();
  const currentHour = parseInt(timeStr.split(":")[0]);

  const todayStart = `${today}T00:00:00+07:00`;
  const todayEnd = `${today}T23:59:59+07:00`;
  const yestStart = `${yesterday}T00:00:00+07:00`;
  // 어제 같은 시각까지 — fair DoD 비교 base (광고 트래픽 시간대 편향 제거).
  const yestSameTime = `${yesterday}T${timeStr}:59+07:00`;

  const [todaySessions, prevSessions, todayBundle, prevBundle] = await Promise.all([
    getGA4TodaySessions(),
    getGA4SessionsUpToHour(yesterday, currentHour),
    getRangeBundle(todayStart, todayEnd),
    getRangeBundle(yestStart, yestSameTime),
  ]);

  const todayStats = { sessions: todaySessions, ...todayBundle };
  const prevStats = { sessions: prevSessions, ...prevBundle };

  return buildRealtimeMessage(today, yesterday, timeStr, todayStats, prevStats, slashCommand);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let mode = url.searchParams.get("mode") || "daily";

    let slashCommand = false;
    let slashResponseUrl: string | null = null;
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        const params = new URLSearchParams(body);
        if (params.get("command")) {
          slashCommand = true;
          mode = "realtime";
          slashResponseUrl = params.get("response_url");
        }
      }
    }

    if (mode === "realtime") {
      // /fyi 슬래시 커맨드: 누적/세션 수집이 무거워 동기 응답이 Slack 의
      // 3초 ack 한계를 넘는다. 즉시 ack 하고 백그라운드로 response_url
      // 에 실 메시지를 POST.
      if (slashCommand && slashResponseUrl) {
        const responseUrl = slashResponseUrl;
        const task = (async () => {
          try {
            const message = await buildRealtimePayload(true);
            // 채널 게시 (in_channel) — 슬래시 커맨드 응답 표준 필드.
            (message as any).response_type = "in_channel";
            await fetch(responseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(message),
            });
          } catch (e) {
            console.error("Slash deferred error:", (e as Error).message);
            await fetch(responseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                response_type: "ephemeral",
                text: `:warning: 리포트 생성 중 오류 / Report error: ${(e as Error).message}`,
              }),
            });
          }
        })();
        // Supabase Edge runtime keeps the worker alive until waitUntil resolves.
        // @ts-ignore — EdgeRuntime is a Supabase-injected global.
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(task);
        }
        // 3초 안에 응답 — Slack 에 보이는 "처리 중..." 카드.
        return new Response(JSON.stringify({
          response_type: "ephemeral",
          text: ":hourglass_flowing_sand: FYI 리포트 가져오는 중... / Fetching report...",
        }), { headers: { "Content-Type": "application/json" } });
      }

      const message = await buildRealtimePayload(true);
      // ?dryRun=1 → 슬랙 안 쏘고 payload 만 응답. 터미널에서 메시지 미리보기/검증 용도.
      if (url.searchParams.get("dryRun") === "1") {
        return new Response(JSON.stringify({ success: true, mode: "realtime", date: getVietnamDate(0), message }, null, 2), { headers: { "Content-Type": "application/json" } });
      }
      await sendToSlack(message);
      return new Response(JSON.stringify({ success: true, mode: "realtime", date: getVietnamDate(0) }), { headers: { "Content-Type": "application/json" } });
    }

    if (mode === "daily") {
      // ?date=YYYY-MM-DD 로 임의 일자 백필/테스트 가능. cron 은 date 안
      // 넘기므로 기본은 어제(VN).
      const dateOverride = url.searchParams.get("date");
      const yesterday = dateOverride || getVietnamDate(1);
      const dayBefore = dateOverride ? previousDay(yesterday) : getVietnamDate(2);

      const startY = `${yesterday}T00:00:00+07:00`;
      const endY = `${yesterday}T23:59:59+07:00`;
      const startDB = `${dayBefore}T00:00:00+07:00`;
      const endDB = `${dayBefore}T23:59:59+07:00`;

      const [ySessions, dbSessions, yBundle, dbBundle, yResume, dbResume, cum] = await Promise.all([
        getGA4Sessions(yesterday),
        getGA4Sessions(dayBefore),
        getRangeBundle(startY, endY),
        getRangeBundle(startDB, endDB),
        getResumeUploadsForDateAdminUI(yesterday),
        getResumeUploadsForDateAdminUI(dayBefore),
        getCumulative(CAMPAIGN_START, yesterday),
      ]);

      const stats: StatsBundle = { sessions: ySessions, ...yBundle, resumes: yResume };
      const prevStats: StatsBundle = { sessions: dbSessions, ...dbBundle, resumes: dbResume };
      const alerts = await detectAlerts(stats.submissions);

      const message = buildDailyMessage(yesterday, stats, prevStats, cum, alerts);

      // 앱 리포트 카드 덧붙임 — 실패해도 웹 리포트는 그대로 발송.
      try {
        const [appStats, appPrev] = await Promise.all([
          getAppStats(`${yesterday}T00:00:00+07:00`, `${yesterday}T23:59:59+07:00`),
          getAppStats(`${dayBefore}T00:00:00+07:00`, `${dayBefore}T23:59:59+07:00`),
        ]);
        // 잔존: D1 코호트 = 그저께 신규(이미 appPrev에 계산됨), D7 코호트 = 7일 전 신규.
        // 둘 다 "어제 활성(appStats.clients)"에 남아있는 비율로 측정.
        const d7Date = addDays(yesterday, -7);
        const [d7Cohort, mau] = await Promise.all([getNewClients(d7Date), getAppMau(yesterday)]);
        const inActive = (cohort: Set<string>) => [...cohort].filter((c) => appStats.clients.has(c)).length;
        const ret: DailyRet = {
          d1: { size: appPrev.newClientSet.size, retained: inActive(appPrev.newClientSet), date: dayBefore },
          d7: { size: d7Cohort.size, retained: inActive(d7Cohort), date: d7Date },
        };
        message.attachments.push(buildAppDailyAttachment(appStats, appPrev, ret, mau, yesterday));
      } catch (e) {
        console.error("App daily report error:", (e as Error).message);
      }

      // ?dryRun=1 → 슬랙 안 쏘고 payload 만 응답. 터미널에서 메시지 미리보기 용도.
      if (url.searchParams.get("dryRun") === "1") {
        return new Response(JSON.stringify({ success: true, mode: "daily", date: yesterday, message }, null, 2), { headers: { "Content-Type": "application/json" } });
      }
      // ?noHere=1 → @here 멘션 빼고 발송 (테스트용). cron 호출엔 영향 없음.
      if (url.searchParams.get("noHere") === "1") {
        delete (message as any).text;
        const blocks = (message as any).attachments?.[0]?.blocks;
        if (blocks?.[0]?.type === "section" && blocks[0]?.text?.text?.includes("<!here>")) {
          blocks.shift();
        }
      }
      await sendToSlack(message);
      return new Response(JSON.stringify({ success: true, mode: "daily", date: yesterday }), { headers: { "Content-Type": "application/json" } });
    }

    if (mode === "weekly") {
      const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const dayOfWeek = vn.getDay();
      const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6;

      const thisWeekStart = getVietnamDate(daysToLastMonday);
      const thisWeekEnd = getVietnamDate(daysToLastMonday - 6);
      const lastWeekStart = getVietnamDate(daysToLastMonday + 7);
      const lastWeekEnd = getVietnamDate(daysToLastMonday + 1);

      const [thisWeek, lastWeek] = await Promise.all([
        getCumulative(thisWeekStart, thisWeekEnd),
        getCumulative(lastWeekStart, lastWeekEnd),
      ]);

      const message = buildWeeklyMessage(`${thisWeekStart} ~ ${thisWeekEnd}`, thisWeek, lastWeek);

      // 앱 리포트 카드 덧붙임 — 실패해도 웹 리포트는 그대로 발송.
      try {
        const [appThis, appLast, mau] = await Promise.all([
          getAppStats(`${thisWeekStart}T00:00:00+07:00`, `${thisWeekEnd}T23:59:59+07:00`),
          getAppStats(`${lastWeekStart}T00:00:00+07:00`, `${lastWeekEnd}T23:59:59+07:00`),
          getAppMau(thisWeekEnd),
        ]);
        const pushTotal = await getPushTotal();
        message.attachments.push(buildAppWeeklyAttachment(appThis, appLast, mau, pushTotal));
      } catch (e) {
        console.error("App weekly report error:", (e as Error).message);
      }

      await sendToSlack(message);
      return new Response(JSON.stringify({ success: true, mode: "weekly", week: `${thisWeekStart} ~ ${thisWeekEnd}` }), { headers: { "Content-Type": "application/json" } });
    }

    if (mode === "healthcheck") {
      const test = url.searchParams.get("test") === "true";
      const result = await checkServerHealth();
      if (!result.ok || test) {
        await sendToSlack(buildHealthAlertMessage(result));
      }
      return new Response(JSON.stringify({ success: true, mode: "healthcheck", test, ...result }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid mode. Use ?mode=daily, ?mode=weekly, ?mode=realtime, or ?mode=healthcheck" }), { status: 400, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
