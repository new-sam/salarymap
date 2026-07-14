// 자동 트리거 메일 4종을 younghun@likelion.net 에 실제 발송해서 렌더링/CTA 확인.
// 프로덕션 발송이 아니라 tester 계정에 강제 도착 (synthetic payload).
//
//   node scripts/test-all-emails.mjs

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}
if (!process.env.NEXT_PUBLIC_SITE_URL) process.env.NEXT_PUBLIC_SITE_URL = 'https://salary-fyi.com';

const TO = 'younghun@likelion.net';

console.log('\n=== env ===');
console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? `set (${process.env.RESEND_API_KEY.slice(0,8)}…)` : 'MISSING');
console.log('  RESEND_FROM   :', process.env.RESEND_FROM || '(unset)');
console.log('  TO            :', TO);

// dynamic import (env 세팅 후)
const { sendVerificationCode } = await import('../lib/resend.js');
const { sendInviteMail, sendMemberAddedMail, sendJobApprovedMail } = await import('../lib/companyEmails.js');

const cases = [
  {
    label: '1/4  회사 이메일 인증 코드 (sendVerificationCode)',
    run: () => sendVerificationCode(TO, '123456').then(() => ({ ok: true })).catch(e => ({ ok: false, reason: e.message })),
  },
  {
    label: '2/4  신규 유저 초대 (sendInviteMail — admin role)',
    run: () => sendInviteMail({
      toEmail: TO,
      companyName: 'LIKELION VN',
      inviterEmail: 'ceo_office@likelion.net',
      jobTitle: 'Business Development Specialist',
      link: 'https://salary-fyi.com/company?invite=test-job-id',
      role: 'admin',
    }),
  },
  {
    label: '3/4  기존 멤버 팀 추가 (sendMemberAddedMail — interviewer role)',
    run: () => sendMemberAddedMail({
      toEmail: TO,
      companyName: 'LIKELION VN',
      inviterEmail: 'ceo_office@likelion.net',
      jobTitle: 'Business Development Specialist',
      link: 'https://salary-fyi.com/company/ats?jobId=test-job-id',
      role: 'interviewer',
    }),
  },
  {
    label: '4/4  공고 승인 알림 (sendJobApprovedMail)',
    run: () => sendJobApprovedMail({
      toEmail: TO,
      jobTitle: 'Business Development Specialist',
      companyName: 'LIKELION VN',
    }),
  },
];

console.log('\n=== sending ===');
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  process.stdout.write(`  ${c.label} ... `);
  const r = await c.run();
  console.log(r?.ok ? '✓ sent' : `✗ ${r?.reason || 'failed'}`);
  // Resend 2 req/sec rate limit 회피
  if (i < cases.length - 1) await new Promise(res => setTimeout(res, 700));
}

console.log(`\n✓ Done. Check inbox (and spam folder): ${TO}`);
