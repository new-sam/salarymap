// Slack 풀봇 — 채널에서 봇을 멘션하면(@FYI풀봇 + JD) 해당 JD의 콜드메일 발송 가능
// 인원을 실측해 스레드 댓글로 답한다. 로직은 lib/poolEstimator.js 공용.
// 필요 env: SLACK_POOLBOT_SIGNING_SECRET, SLACK_POOLBOT_BOT_TOKEN(xoxb-)
// Slack 앱 설정: Event Subscriptions → app_mention, Request URL → 이 엔드포인트.
import crypto from 'crypto'
import { estimatePool, formatSlackReply } from '../../../lib/poolEstimator.js'

export const config = { api: { bodyParser: false }, maxDuration: 60 }

const readRaw = (req) => new Promise((resolve, reject) => {
  let data = ''
  req.on('data', (c) => { data += c })
  req.on('end', () => resolve(data))
  req.on('error', reject)
})

function verifySlack(req, raw) {
  const secret = process.env.SLACK_POOLBOT_SIGNING_SECRET
  const ts = req.headers['x-slack-request-timestamp']
  const sig = req.headers['x-slack-signature']
  if (!secret || !ts || !sig) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false
  const base = `v0:${ts}:${raw}`
  const mine = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex')
  try { return crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(sig)) } catch { return false }
}

const slackApi = (method, payload) =>
  fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_POOLBOT_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  }).then((r) => r.json())

// 멘션이 스레드 댓글에만 있으면 JD 는 원글에 있다 — 원글 텍스트를 가져와 합친다.
async function resolveJdText(event) {
  let text = String(event.text || '').replace(/<@[A-Z0-9]+>/g, ' ').trim()
  if (text.length < 80 && event.thread_ts && event.thread_ts !== event.ts) {
    const res = await slackApi('conversations.replies', {
      channel: event.channel, ts: event.thread_ts, limit: 1,
    })
    const parent = res?.messages?.[0]?.text
    if (parent) text = `${parent}\n${text}`.trim()
  }
  return text
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const raw = await readRaw(req)
  let body
  try { body = JSON.parse(raw) } catch { return res.status(400).end() }

  if (body.type === 'url_verification') return res.status(200).json({ challenge: body.challenge })
  if (!verifySlack(req, raw)) return res.status(401).end()
  // Slack 은 3초 내 미응답 시 재발송한다 — 재시도는 즉시 200 으로 무시(중복 댓글 방지)
  if (req.headers['x-slack-retry-num']) return res.status(200).end()

  const event = body.event
  if (body.type !== 'event_callback' || event?.type !== 'app_mention' || event.bot_id) {
    return res.status(200).end()
  }

  // 3초 룰: 먼저 200 을 보내고 같은 인보케이션에서 마저 처리(Vercel 은 핸들러 종료까지 유지)
  res.status(200).end()
  const threadTs = event.thread_ts || event.ts
  try {
    const jd = await resolveJdText(event)
    if (jd.length < 40) {
      await slackApi('chat.postMessage', {
        channel: event.channel, thread_ts: threadTs,
        text: 'JD 텍스트를 찾지 못했어요. JD 가 있는 글(또는 그 스레드)에서 멘션해 주세요.',
      })
      return
    }
    const result = await estimatePool(jd)
    await slackApi('chat.postMessage', {
      channel: event.channel, thread_ts: threadTs, text: formatSlackReply(result),
    })
  } catch (e) {
    console.error('[pool-bot]', e)
    await slackApi('chat.postMessage', {
      channel: event.channel, thread_ts: threadTs,
      text: `풀 집계 중 오류가 났어요: ${e.message}`,
    }).catch(() => {})
  }
}
