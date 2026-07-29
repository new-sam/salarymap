import supabase from '../../../lib/supabaseAdmin'
import { verifyToken, leadId } from '../../../lib/ktcMailToken'

// KTC 콜드메일 수신거부 — 별도 테이블 없이 events 에 coldmail_unsub 을 남기고,
// 발송 스크립트가 이 이벤트를 가진 lead 를 대상에서 뺀다(재발송 방지).
// GET(메일 푸터 링크) / POST(List-Unsubscribe 원클릭) 둘 다 받는다.
export default async function handler(req, res) {
  const parsed = verifyToken(req.query.t || req.body?.t)

  if (parsed) {
    try {
      await supabase.from('events').insert([{
        event: 'coldmail_unsub',
        page: '/api/ktc/unsub',
        meta: { campaign: parsed.campaign, lead: leadId(parsed.email) },
      }])
    } catch (e) {
      console.error('ktc/unsub log failed:', e.message)
    }
  }

  // List-Unsubscribe 원클릭은 본문을 보지 않는다 — 200 만 돌려주면 된다.
  if (req.method === 'POST') return res.status(200).end()

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(page(!!parsed))
}

function page(ok) {
  const m = ok
    ? { emoji: '✅', t: 'Bạn đã hủy đăng ký.', s: 'Chúng tôi sẽ không gửi email giới thiệu này cho bạn nữa.' }
    : { emoji: '⚠️', t: 'Liên kết không hợp lệ.', s: 'Vui lòng gửi email tới hello@salary-fyi.com để hủy đăng ký.' }
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FYI</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1a1612;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:440px;text-align:center;background:#fff;border:1px solid #eee5da;border-radius:20px;padding:40px 28px;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<div style="font-size:52px;line-height:1;margin-bottom:18px">${m.emoji}</div>
<div style="font-size:19px;font-weight:800;margin-bottom:10px;letter-spacing:-.01em">${m.t}</div>
<div style="font-size:14px;color:#6b6357;line-height:1.5">${m.s}</div>
</div></body></html>`
}
