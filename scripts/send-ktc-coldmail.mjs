#!/usr/bin/env node
/**
 * KTC 지원자 → FYI 유입 콜드메일 발송.
 *
 *   node scripts/send-ktc-coldmail.mjs --dry-run             # 발송 없이 확인
 *   node scripts/send-ktc-coldmail.mjs --utm --send          # 배포 전: UTM 링크로 발송
 *   node scripts/send-ktc-coldmail.mjs --send                # 배포 후: 추적 리다이렉트로 발송
 *
 * 하는 일
 *   1. data/ktc-leads-not-in-fyi.csv 에서 시드 고정 랜덤 추출(재현 가능)
 *   2. 수신자별 토큰으로 CTA URL 을 /api/ktc/r 추적 링크로 치환
 *   3. {{name}}=호칭(tên), {{position}}=최신 지원포지션 머지
 *   4. Resend 배치 발송(100통씩)
 *   5. events 에 coldmail_public_sent 기록 → 어드민 goals 탭에서 발송·클릭·CTA 전환률이 보인다
 *      (이게 없으면 분모가 없어 전환률이 계산되지 않는다)
 *   6. 발송자 명단을 data/ktc-coldmail-sent-<ts>.csv 로 남겨 재발송을 막는다
 *
 * ⚠️ --send 를 붙이지 않으면 절대 발송하지 않는다.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { makeMailToken, leadId } from '../lib/ktcMailToken.js';

const ROOT = path.resolve(import.meta.dirname, '..');
// Next.js 는 .env.local 을 읽지만 dotenv 기본값은 .env 라 명시적으로 지정한다
dotenv.config({ path: path.join(ROOT, '.env.local') });
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const has = (k) => process.argv.includes(`--${k}`);

const LANG = arg('lang', 'vi');                       // vi | ko
const LIMIT = Number(arg('limit', 200));
const SEED = Number(arg('seed', 20260728));
const CSV = arg('file', 'data/ktc-leads-not-in-fyi.csv');
const SEND = has('send');
/* --utm : CTA 를 /api/ktc/r 대신 프로덕션 /jobs?utm_... 로 보낸다.
   추적 엔드포인트가 아직 배포 전이면 클릭이 404 가 되므로, 이미 배포된
   _app.js 의 session_start(utm_source/medium/campaign 기록)에 기대는 우회로.
   대신 사람 단위(lead) 구분은 못 하고 캠페인 단위 클릭 수만 남는다. */
const UTM_MODE = has('utm');
const CAMPAIGN = 'coldmail-ktc';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '');

const TEMPLATES = {
  ko: { file: 'coldmain.html', subject: 'KTC - {{position}} 포지션에 지원해 주셨죠' },
  vi: { file: 'coldmain-vi.html', subject: 'KTC - {{position}} — bạn đã ứng tuyển vị trí này' },
};

// ── CSV (따옴표 필드 포함) ────────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.some((v) => v)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const csvCell = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 시드 고정 셔플 — 같은 시드면 같은 200명이 뽑힌다(중단 후 재개·감사 대응)
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sample(list, n, seed) {
  const rnd = mulberry32(seed);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// 이미 보낸 사람은 제외 — 같은 명단으로 다시 돌려도 중복 발송되지 않는다
function alreadySent() {
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) return new Set();
  const done = new Set();
  for (const f of fs.readdirSync(dir).filter((f) => /^ktc-coldmail-sent-.*\.csv$/.test(f))) {
    for (const r of parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (r.email) done.add(r.email.toLowerCase());
    }
  }
  return done;
}

const trackUrl = (email, to, cta) => {
  if (UTM_MODE) {
    const q = new URLSearchParams({
      utm_source: 'coldmail', utm_medium: 'email', utm_campaign: CAMPAIGN,
      utm_content: leadId(email), // session_start 는 안 읽지만 GA 등 외부 분석용으로 남긴다
    });
    return `${SITE}${to}?${q}`;
  }
  return `${SITE}/api/ktc/r?t=${encodeURIComponent(makeMailToken(email, CAMPAIGN))}&to=${encodeURIComponent(to)}&cta=${cta}`;
};

async function main() {
  const tpl = TEMPLATES[LANG];
  if (!tpl) throw new Error(`--lang 은 ko | vi (받은 값: ${LANG})`);
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) throw new Error('RESEND_API_KEY / RESEND_FROM 없음');

  const html0 = fs.readFileSync(path.join(ROOT, tpl.file), 'utf8');
  const rows = parseCsv(fs.readFileSync(path.join(ROOT, CSV), 'utf8'));
  const done = alreadySent();

  const pool = rows.filter((r) => r['이메일'] && !done.has(r['이메일'].toLowerCase()));
  const picked = sample(pool, LIMIT, SEED);

  console.log(`템플릿   ${tpl.file} (${LANG})`);
  console.log(`제목     ${tpl.subject}`);
  console.log(`대상     ${rows.length}명 중 ${pool.length}명 미발송 → ${picked.length}명 추출 (seed=${SEED})`);
  console.log(`발신     ${process.env.RESEND_FROM}`);
  console.log(`추적     ${UTM_MODE ? `${SITE}/jobs?utm_campaign=${CAMPAIGN} (UTM 모드 — 배포 불필요, 사람 단위 구분 없음)`
                                     : `${SITE}/api/ktc/r · campaign=${CAMPAIGN} (배포 필요)`}\n`);

  const build = (r) => {
    const email = r['이메일'].trim();
    const name = (r['호칭(tên)'] || r['이름'] || '').trim() || 'bạn';
    const position = (r['최신 지원포지션'] || '').trim();
    const fill = (s) => s.replace(/\{\{name\}\}/g, name).replace(/\{\{position\}\}/g, position)
      .replace(/\{\{ctaUrl\}\}/g, trackUrl(email, '/jobs', 'main'))
      // 수신거부 페이지가 아직 없어 회신 주소로 대체 — 링크가 죽는 것보다 낫다
      .replace(/\{\{unsubscribeUrl\}\}/g, `mailto:hello@salary-fyi.com?subject=${encodeURIComponent('Unsubscribe: ' + email)}`);
    return { email, name, position, subject: fill(tpl.subject), html: fill(html0) };
  };

  const mails = picked.map(build);
  const noPos = mails.filter((m) => !m.position).length;
  if (noPos) console.log(`⚠️  포지션 값이 빈 수신자 ${noPos}명 — 제목이 어색해집니다\n`);

  console.log('미리보기 3건');
  mails.slice(0, 3).forEach((m) => {
    console.log(`  ${m.email.padEnd(34)} ${m.name.padEnd(12)} ${m.subject}`);
  });
  const left = mails.reduce((a, m) => a + (m.html.match(/\{\{/g) || []).length, 0);
  console.log(`\n미치환 플레이스홀더 총 ${left}개`);

  if (!SEND) {
    console.log('\n[dry-run] 발송하지 않았습니다. 실제로 보내려면 --send 를 붙이세요.');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const sent = [];
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    const { data, error } = await resend.batch.send(
      chunk.map((m) => ({ from: process.env.RESEND_FROM, to: m.email, subject: m.subject, html: m.html }))
    );
    if (error) { console.error(`  ✗ ${i + 1}~${i + chunk.length}:`, error.message || error); continue; }
    chunk.forEach((m, k) => sent.push({ ...m, id: data?.data?.[k]?.id || '' }));
    console.log(`  ✓ ${i + 1}~${i + chunk.length} 발송`);
    await new Promise((r) => setTimeout(r, 1000)); // Resend 요청 제한 여유
  }

  // 발송 로그 — 이게 있어야 대시보드에서 CTA 전환률(클릭/발송)이 계산된다
  for (let i = 0; i < sent.length; i += 500) {
    const { error } = await db.from('events').insert(
      sent.slice(i, i + 500).map((m) => ({
        event: 'coldmail_public_sent',
        page: 'scripts/send-ktc-coldmail',
        meta: { campaign: CAMPAIGN, lead: leadId(m.email), lang: LANG, resend_id: m.id, mode: UTM_MODE ? 'utm' : 'redirect' },
      }))
    );
    if (error) console.error('  이벤트 기록 실패:', error.message);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const out = path.join(ROOT, 'data', `ktc-coldmail-sent-${stamp}.csv`);
  fs.writeFileSync(out, '﻿' + ['email,name,position,lang,resend_id']
    .concat(sent.map((m) => [m.email, m.name, m.position, LANG, m.id].map(csvCell).join(','))).join('\n'), 'utf8');

  console.log(`\n발송 ${sent.length}/${mails.length}건 · 로그 ${path.relative(ROOT, out)}`);
  console.log('어드민 → goals 탭 → 캠페인별 표에서 coldmail-ktc 확인');
}

main().catch((e) => { console.error(e); process.exit(1); });
