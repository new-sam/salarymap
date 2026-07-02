import { google } from 'googleapis'
import supabaseAdmin from './supabaseAdmin.js'

// 어드민(서버) 측 콜드아웃리치 발송. 토큰은 gmail_oauth_tokens(DB)에서 발신자별로 읽는다.
const STORAGE = 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/job-images/outreach'
export const OWNERS = {
  wsj: { sender: 'wsj@likelion.net', name: '위승주', sigReplace: [/AI PM Intern/g, 'AI Product Manager'], imageUrl: `${STORAGE}/wsj-visual.png` },
  younghun: { sender: 'younghun@likelion.net', name: '남영훈', sigReplace: null, imageUrl: `${STORAGE}/younghun-visual.png` },
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function clientFor(owner) {
  const { data } = await supabaseAdmin
    .from('gmail_oauth_tokens').select('refresh_token').eq('email', owner.sender).maybeSingle()
  if (!data?.refresh_token) throw new Error(`${owner.sender} 미연동 (토큰 없음)`)
  const c = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET)
  c.setCredentials({ refresh_token: data.refresh_token })
  return c
}

const _sig = {}
async function signature(owner) {
  if (_sig[owner.sender] !== undefined) return _sig[owner.sender]
  try {
    const gmail = google.gmail({ version: 'v1', auth: await clientFor(owner) })
    const { data } = await gmail.users.settings.sendAs.get({ userId: 'me', sendAsEmail: owner.sender })
    let s = data.signature || ''
    if (owner.sigReplace) s = s.replace(owner.sigReplace[0], owner.sigReplace[1])
    _sig[owner.sender] = s
  } catch { _sig[owner.sender] = '' }
  return _sig[owner.sender]
}

function html(body, sig, pixel, image) {
  let bodyHtml = esc(body).replace(/\n/g, '<br>')
  const imgTag = image ? `<br><br><img src="${image}" alt="" style="max-width:100%;border-radius:10px" /><br>` : ''
  // 본문 중간 [[IMAGE]] 마커 → 이미지 치환. 마커 없으면 이미지는 본문 끝에.
  if (/\[\[IMAGE\]\]/.test(bodyHtml)) {
    bodyHtml = bodyHtml.replace(/(?:<br>\s*)*\[\[IMAGE\]\](?:\s*<br>)*/g, imgTag)
  } else if (imgTag) {
    bodyHtml += imgTag
  }
  return `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.7;color:#222">`
    + bodyHtml
    + (sig ? `<br><br>${sig}` : '')
    + (pixel ? `<img src="${pixel}" width="1" height="1" alt="" style="display:none">` : '')
    + `</div>`
}

// 한 통 발송 → { id, threadId }
export async function sendOutreach(ownerKey, { to, subject, body, leadId }) {
  const owner = OWNERS[ownerKey] || OWNERS.wsj
  const gmail = google.gmail({ version: 'v1', auth: await clientFor(owner) })
  const sig = await signature(owner)
  const base = process.env.OAUTH_BASE || 'https://salary-fyi.com'
  const raw = Buffer.from([
    `From: =?UTF-8?B?${b64(owner.name)}?= <${owner.sender}>`,
    `To: ${to}`,
    `Reply-To: ${owner.sender}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html(body, sig, `${base}/api/o/${leadId}`, owner.imageUrl || null)),
  ].join('\r\n')).toString('base64url')
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return res.data
}
