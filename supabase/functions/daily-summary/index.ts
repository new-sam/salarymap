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

function pctChange(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "-";
  if (previous === 0) return "NEW";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return `+${change}%`;
  if (change < 0) return `${change}%`;
  return "0%";
}

function dodEmoji(current: number, previous: number): string {
  if (current > previous) return " :small_red_triangle:";
  if (current < previous) return " :small_red_triangle_down:";
  return "";
}

function convRate(num: number, den: number): string {
  if (den === 0) return "0.0%";
  return ((num / den) * 100).toFixed(1) + "%";
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

// ─── Supabase Data ───
async function getSubmissions(dateStr: string) {
  const startUtc = `${dateStr}T00:00:00+07:00`;
  const endUtc = `${dateStr}T23:59:59+07:00`;

  const { data, error } = await supabase
    .from("submissions")
    .select("source, company, email, user_id")
    .eq("is_seed", false)
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);

  if (error) throw error;

  const deduped = dedupeSubmissions((data || []).filter((r: any) => !isExcludedSubmission(r)));

  const ad = deduped.filter((r: any) => PAID_SOURCES.has(r.source)).length;
  const companies = new Set(deduped.map((r: any) => r.company?.trim().toLowerCase()).filter(Boolean)).size;

  return { total: deduped.length, ad, organic: deduped.length - ad, companies };
}

async function getSignups(dateStr: string): Promise<number> {
  const startUtc = `${dateStr}T00:00:00+07:00`;
  const endUtc = `${dateStr}T23:59:59+07:00`;
  try {
    const { data, error } = await supabase.rpc("count_signups", { start_ts: startUtc, end_ts: endUtc });
    if (error) { console.error("Sign-ups RPC error:", JSON.stringify(error)); return 0; }
    return data || 0;
  } catch { return 0; }
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

async function getCumulative(startDate: string, endDate: string) {
  const startUtc = `${startDate}T00:00:00+07:00`;
  const endUtc = `${endDate}T23:59:59+07:00`;

  const { data: subs, error: subsErr } = await supabase
    .from("submissions")
    .select("source, company, email, user_id")
    .eq("is_seed", false)
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);
  if (subsErr) throw subsErr;

  const deduped = dedupeSubmissions((subs || []).filter((r: any) => !isExcludedSubmission(r)));
  const totalAd = deduped.filter((r: any) => PAID_SOURCES.has(r.source)).length;
  const totalCompanies = new Set(deduped.map((r: any) => r.company?.trim().toLowerCase()).filter(Boolean)).size;

  const { data: signups } = await supabase.rpc("count_signups", { start_ts: startUtc, end_ts: endUtc });
  const { count: jobApps } = await supabase
    .from("job_applications")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);

  const sessions = await getGA4SessionsRange(startDate, endDate);

  return {
    sessions,
    totalSubs: deduped.length,
    totalAd,
    totalOrganic: deduped.length - totalAd,
    totalSignups: signups || 0,
    totalJobApps: jobApps || 0,
    totalCompanies,
  };
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
      alerts.push(`:chart_with_downwards_trend: Submissions ${recent.length}일 연속 하락 중 (${[...recent].reverse().join(" -> ")})`);
    }
  }
  return alerts;
}

// ─── Slack Messages ───
function buildRealtimeMessage(
  today: string,
  timeStr: string,
  sessions: number,
  stats: { total: number; ad: number; organic: number; companies: number },
  signups: number,
  jobApps: number,
  cum: Awaited<ReturnType<typeof getCumulative>>,
  slashCommand: boolean,
) {
  const dayName = getDayName(today);
  const signupRate = cum.totalSubs > 0 ? convRate(cum.totalSignups, cum.totalSubs) : "0.0%";

  return {
    response_type: slashCommand ? "in_channel" : undefined,
    attachments: [{
      color: "#2ea44f",
      blocks: [
        { type: "header", text: { type: "plain_text", text: `FYI Realtime - ${today} (${dayName}) ${timeStr} UTC+7` } },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: [
          `*Today so far* (${today} 00:00 ~ ${timeStr} UTC+7)`,
          ``,
          `*Main Funnel*`,
          `Session \`${sessions}\` -> Subs \`${stats.total}\` -> Sign-up \`${signups}\` -> Apply \`${jobApps}\``,
          ``,
          `Subs: Ad \`${stats.ad}\` / Organic \`${stats.organic}\``,
          `Companies: \`${stats.companies}\``,
        ].join("\n") }},
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: [
          `*Accumulated* (${CAMPAIGN_START} ~ ${today})`,
          `Session \`${cum.sessions.toLocaleString()}\` -> Subs \`${cum.totalSubs}\` -> Sign-up \`${cum.totalSignups}\` (${signupRate}) -> Apply \`${cum.totalJobApps}\``,
          `Companies: \`${cum.totalCompanies}\``,
        ].join("\n") }},
      ],
    }],
  };
}

function buildDailyMessage(
  targetDate: string,
  sessions: number,
  prevSessions: number,
  stats: { total: number; ad: number; organic: number; companies: number },
  prevStats: { total: number; ad: number; organic: number; companies: number },
  signups: number,
  prevSignups: number,
  jobApps: number,
  cum: Awaited<ReturnType<typeof getCumulative>>,
  alerts: string[],
) {
  const dayName = getDayName(targetDate);
  const signupRate = cum.totalSubs > 0 ? convRate(cum.totalSignups, cum.totalSubs) : "0.0%";
  const trendColor = stats.total > prevStats.total ? "#cc0000" : stats.total < prevStats.total ? "#1D6CE0" : "#999999";

  const alertBlock = alerts.length > 0
    ? [{ type: "section", text: { type: "mrkdwn", text: alerts.join("\n") } }]
    : [];

  return {
    attachments: [{
      color: trendColor,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `FYI Daily Report - ${targetDate} (${dayName})` } },
        { type: "context", elements: [{ type: "mrkdwn", text: `Data period: ${targetDate} 00:00 ~ 23:59 (UTC+7)` }] },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: [
          `*Main Funnel (DoD)*`,
          `*Session*  \`${sessions}\`  ${pctChange(sessions, prevSessions)}${dodEmoji(sessions, prevSessions)}`,
          ` -> ${convRate(stats.total, sessions)}`,
          `*Subs*  \`${stats.total}\`  ${pctChange(stats.total, prevStats.total)}${dodEmoji(stats.total, prevStats.total)}`,
          `    Ad \`${stats.ad}\` / Organic \`${stats.organic}\``,
          ` -> ${convRate(signups, stats.total)}`,
          `*Sign-up*  \`${signups}\`  ${pctChange(signups, prevSignups)}${dodEmoji(signups, prevSignups)}`,
          ` -> ${convRate(jobApps, signups)}`,
          `*Apply*  \`${jobApps}\``,
          ``,
          `Companies: \`${stats.companies}\``,
        ].join("\n") }},
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: [
          `*Accumulated* (${CAMPAIGN_START} ~ ${targetDate})`,
          `Session \`${cum.sessions.toLocaleString()}\` -> Subs \`${cum.totalSubs}\` -> Sign-up \`${cum.totalSignups}\` (${signupRate}) -> Apply \`${cum.totalJobApps}\``,
          `Companies: \`${cum.totalCompanies}\``,
        ].join("\n") }},
        ...alertBlock,
      ],
    }],
  };
}

function buildWeeklyMessage(
  weekLabel: string,
  thisWeek: Awaited<ReturnType<typeof getCumulative>>,
  lastWeek: Awaited<ReturnType<typeof getCumulative>>,
) {
  const trendColor = thisWeek.totalSubs > lastWeek.totalSubs ? "#cc0000" : thisWeek.totalSubs < lastWeek.totalSubs ? "#1D6CE0" : "#999999";
  const signupRate = thisWeek.totalSubs > 0 ? convRate(thisWeek.totalSignups, thisWeek.totalSubs) : "0.0%";

  return {
    attachments: [{
      color: trendColor,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `FYI Weekly Report - ${weekLabel}` } },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: [
          `*Main Funnel (WoW)*`,
          `*Session*  \`${thisWeek.sessions.toLocaleString()}\`  ${pctChange(thisWeek.sessions, lastWeek.sessions)}`,
          ` -> ${convRate(thisWeek.totalSubs, thisWeek.sessions)}`,
          `*Subs*  \`${thisWeek.totalSubs}\`  ${pctChange(thisWeek.totalSubs, lastWeek.totalSubs)}`,
          `    Ad \`${thisWeek.totalAd}\` / Organic \`${thisWeek.totalOrganic}\``,
          ` -> ${convRate(thisWeek.totalSignups, thisWeek.totalSubs)}`,
          `*Sign-up*  \`${thisWeek.totalSignups}\`  ${pctChange(thisWeek.totalSignups, lastWeek.totalSignups)}`,
          ` -> ${convRate(thisWeek.totalJobApps, thisWeek.totalSignups)}`,
          `*Apply*  \`${thisWeek.totalJobApps}\`  ${pctChange(thisWeek.totalJobApps, lastWeek.totalJobApps)}`,
          ``,
          `Sign-up Rate: ${signupRate}`,
          `Companies: \`${thisWeek.totalCompanies}\``,
        ].join("\n") }},
      ],
    }],
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
          `<!channel> 서버 확인이 필요합니다!`,
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
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let mode = url.searchParams.get("mode") || "daily";

    let slashCommand = false;
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        const params = new URLSearchParams(body);
        if (params.get("command")) {
          slashCommand = true;
          mode = "realtime";
        }
      }
    }

    if (mode === "realtime") {
      const today = getVietnamDate(0);
      const timeStr = getVietnamTime();

      const [sessions, stats, signups, jobApps] = await Promise.all([
        getGA4TodaySessions(),
        getSubmissions(today),
        getSignups(today),
        getJobApps(today),
      ]);
      const cum = await getCumulative(CAMPAIGN_START, today);

      const message = buildRealtimeMessage(today, timeStr, sessions, stats, signups, jobApps, cum, slashCommand);

      if (slashCommand) {
        return new Response(JSON.stringify(message), { headers: { "Content-Type": "application/json" } });
      }
      await sendToSlack(message);
      return new Response(JSON.stringify({ success: true, mode: "realtime", date: today }), { headers: { "Content-Type": "application/json" } });
    }

    if (mode === "daily") {
      const yesterday = getVietnamDate(1);
      const dayBefore = getVietnamDate(2);

      const [sessions, prevSessions, stats, prevStats, signups, prevSignups, jobApps] = await Promise.all([
        getGA4Sessions(yesterday),
        getGA4Sessions(dayBefore),
        getSubmissions(yesterday),
        getSubmissions(dayBefore),
        getSignups(yesterday),
        getSignups(dayBefore),
        getJobApps(yesterday),
      ]);

      const cum = await getCumulative(CAMPAIGN_START, yesterday);
      const alerts = await detectAlerts(stats.total);

      const message = buildDailyMessage(yesterday, sessions, prevSessions, stats, prevStats, signups, prevSignups, jobApps, cum, alerts);
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
