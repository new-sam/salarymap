import { Resend } from 'resend';

// 실험 알림 공용 발송 — 데일리 판정(experiment-alert)과 인트라데이 펄스(experiment-pulse)가 공유.
export const ADMIN_URL = 'https://salary-fyi.com/admin/dashboard?tab=goals';
const RESEND_FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>';
const ALERT_EMAIL = process.env.EXPERIMENT_ALERT_EMAIL || 'wsj@likelion.net';

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: [[{ text: '📊 실험탭 열기 (롤백 스위치)', url: ADMIN_URL }]] },
    }),
  });
  return r.ok;
}

export async function sendEmail({ subject, text, html }) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const r = await resend.emails.send({ from: RESEND_FROM, to: ALERT_EMAIL, subject, text, html });
    return !r.error;
  } catch {
    return false;
  }
}

export async function sendAlert({ subject, text, html }) {
  const results = { email: false, telegram: false };
  try { results.email = await sendEmail({ subject, text, html }); } catch {}
  try { results.telegram = await sendTelegram(text); } catch {}
  return results;
}
