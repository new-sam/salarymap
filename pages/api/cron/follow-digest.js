// 팔로우 회사 다이제스트 — 하루 1번(19:00 ICT) 팔로우한 회사의 새 소식을 묶어서 푸시.
// 기존엔 제보(submit.js)/글 작성(posts.js) 때마다 실시간으로 쏴서 알림이 과했다 → 일일 묶음으로 전환.
//  - company_salary: 새 연봉 제보가 올라온 회사 (기본 ON)
//  - company_post:   팔로우 회사명이 언급된 커뮤니티 글 (기본 OFF, 설정에서 켠 사람만)
// 사용자별로 두 카테고리를 합쳐 한 건의 알림으로 발송한다.
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 헤더로 호출(daily-hot-post.js와 동일).
// vercel.json crons: { "path": "/api/cron/follow-digest", "schedule": "0 12 * * *" }  (12:00 UTC = 19:00 ICT)
import supabaseAdmin from '../../../lib/supabaseAdmin';
import { sendPushBulk } from '../../../lib/push';

const WINDOW_MS = 24 * 3600 * 1000; // 직전 24시간을 "새 소식" 범위로 본다(cron이 하루 1회).
const LOCALES = ['vi', 'ko', 'en'];

// 새 연봉 제보 기본 ON: company_salary가 명시적 false가 아니면 발송.
// (구버전 prefs는 company_follow만 있을 수 있어 그 opt-out도 존중한다.)
function wantsSalary(prefs) {
  if (!prefs) return true;
  if (prefs.company_salary === false) return false;
  if (prefs.company_salary === undefined && prefs.company_follow === false) return false;
  return true;
}

// 회사 언급 글 기본 OFF: 설정에서 명시적으로 켠 사람(company_post === true)만.
function wantsPost(prefs) {
  return !!(prefs && prefs.company_post === true);
}

// "삼성 외 2개" / "Samsung +2" 형태로 회사 목록을 요약.
function joinNames(names, locale) {
  const first = names[0];
  const rest = names.length - 1;
  if (rest <= 0) return first;
  const more = { vi: `+${rest}`, ko: `외 ${rest}개`, en: `+${rest}` }[locale];
  return `${first} ${more}`;
}

// 사용자가 받은 새 연봉/새 글 회사 목록 → 언어별 본문 맵.
function buildBody(salaryNames, postNames) {
  const body = {};
  for (const lo of LOCALES) {
    const parts = [];
    if (salaryNames.length) {
      const n = joinNames(salaryNames, lo);
      parts.push({ vi: `Lương mới: ${n}`, ko: `새 연봉: ${n}`, en: `New salary: ${n}` }[lo]);
    }
    if (postNames.length) {
      const n = joinNames(postNames, lo);
      parts.push({ vi: `Bài viết mới: ${n}`, ko: `새 글: ${n}`, en: `New posts: ${n}` }[lo]);
    }
    body[lo] = parts.join(' / ');
  }
  return body;
}

const TITLE = {
  vi: 'Công ty bạn theo dõi 🔔',
  ko: '팔로우한 회사 새 소식 🔔',
  en: 'Updates from companies you follow 🔔',
};

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();

  // 1) 팔로우 관계 — company_follows.company_name은 lower(trim()) 정규화 저장.
  const { data: followRows, error: fErr } = await supabaseAdmin
    .from('company_follows')
    .select('user_id, company_name');
  if (fErr) return res.status(500).json({ error: fErr.message });
  if (!followRows?.length) return res.status(200).json({ ok: true, sent: 0, reason: 'no follows' });

  const followsByUser = new Map(); // user_id → Set(company_norm)
  const followedCompanies = new Set(); // 알림 대상 회사(정규화)
  for (const r of followRows) {
    if (!r.user_id || !r.company_name) continue;
    const norm = r.company_name.trim().toLowerCase();
    followedCompanies.add(norm);
    const set = followsByUser.get(r.user_id) || new Set();
    set.add(norm);
    followsByUser.set(r.user_id, set);
  }

  // 2) 표시용 정식 회사명(companies.name) — 정규화 키 → 표기.
  const displayByNorm = new Map();
  const { data: companyRows } = await supabaseAdmin.from('companies').select('name');
  for (const c of companyRows || []) {
    const norm = c.name?.trim().toLowerCase();
    if (norm && followedCompanies.has(norm) && !displayByNorm.has(norm)) {
      displayByNorm.set(norm, c.name);
    }
  }
  const display = (norm) => displayByNorm.get(norm) || norm;

  // 3) 직전 24시간 새 연봉 제보 → 팔로우 대상 회사만 집계.
  const salaryCompanies = new Set();
  const { data: subs } = await supabaseAdmin
    .from('submissions')
    .select('company, created_at')
    .gte('created_at', cutoff)
    .not('company', 'is', null);
  for (const s of subs || []) {
    const norm = s.company?.trim().toLowerCase();
    if (norm && followedCompanies.has(norm)) {
      salaryCompanies.add(norm);
      if (!displayByNorm.has(norm)) displayByNorm.set(norm, s.company); // 폴백 표기
    }
  }

  // 4) 직전 24시간 커뮤니티 글 → 팔로우 회사명이 언급된 경우 집계(소식 탭과 동일한 부분 문자열 매칭).
  const postCompanies = new Set();
  const { data: posts } = await supabaseAdmin
    .from('community_posts')
    .select('title, content, created_at')
    .gte('created_at', cutoff);
  for (const p of posts || []) {
    const haystack = `${p.title || ''}\n${p.content || ''}`.toLowerCase();
    for (const norm of followedCompanies) {
      if (haystack.includes(norm)) postCompanies.add(norm);
    }
  }

  if (!salaryCompanies.size && !postCompanies.size) {
    return res.status(200).json({ ok: true, sent: 0, reason: 'no new activity' });
  }

  // 5) 알림 수신 가능 사용자(enabled 토큰) + prefs로 카테고리 옵트인 판단.
  const { data: tokenRows } = await supabaseAdmin
    .from('push_tokens')
    .select('user_id, prefs')
    .eq('enabled', true);
  const wantsByUser = new Map(); // user_id → { salary, post }
  for (const t of tokenRows || []) {
    if (!t.user_id) continue;
    const w = wantsByUser.get(t.user_id) || { salary: false, post: false };
    // 여러 기기면 하나라도 허용 시 발송.
    w.salary = w.salary || wantsSalary(t.prefs);
    w.post = w.post || wantsPost(t.prefs);
    wantsByUser.set(t.user_id, w);
  }

  // 6) 사용자별 다이제스트 조립.
  const items = [];
  for (const [userId, companies] of followsByUser) {
    const w = wantsByUser.get(userId);
    if (!w) continue; // 토큰/권한 없음
    const salaryNames = [];
    const postNames = [];
    for (const norm of companies) {
      if (w.salary && salaryCompanies.has(norm)) salaryNames.push(display(norm));
      if (w.post && postCompanies.has(norm)) postNames.push(display(norm));
    }
    if (!salaryNames.length && !postNames.length) continue;
    items.push({
      userId,
      title: TITLE,
      body: buildBody(salaryNames, postNames),
      data: { type: 'company_follow', url: '/profile/following' },
    });
  }

  await sendPushBulk(items);

  return res.status(200).json({
    ok: true,
    recipients: items.length,
    salaryCompanies: salaryCompanies.size,
    postCompanies: postCompanies.size,
  });
}
