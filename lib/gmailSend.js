import { google } from 'googleapis'
import supabaseAdmin from './supabaseAdmin.js'

// 어드민(서버) 측 콜드아웃리치 발송. 토큰은 gmail_oauth_tokens(DB)에서 발신자별로 읽는다.
const STORAGE = 'https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/job-images/outreach'
export const OWNERS = {
  wsj: {
    sender: 'wsj@likelion.net', name: '위승주', imageUrl: null,
    fixedSignature: `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#333;font-size:13px;line-height:1.6;border-top:2px solid #ff4400;padding-top:10px;margin-top:6px">
<img src="https://twpxsbnkypocjfnerfmd.supabase.co/storage/v1/object/public/job-images/outreach/likelion-logo.jpg" alt="LIKELION" style="height:40px;display:block;margin-bottom:6px" />
<div style="font-weight:700;font-size:14px">위승주 <span style="color:#8B95A1;font-weight:400;font-size:12px">Seungju Wi · 팀장</span></div>
<div style="color:#ff4400;font-weight:600;margin-top:1px">LIKELION Vietnam</div>
<div style="color:#555;font-size:12px">글로벌신사업 본부 | VN New Biz TF</div>
<div style="margin-top:5px;color:#555">E&nbsp;&nbsp;wsj@likelion.net</div>
<div style="color:#555">COBI TOWER 2, 2-4 Street No.8, Tan My Ward, Ho Chi Minh City, Vietnam</div>
</div>`,
  },
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
  if (owner.fixedSignature) return owner.fixedSignature
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
  let bodyHtml = esc(body).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')
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

// 특정 수신자(email)로 만들어진 초안만 골라 삭제 — 재생성 시 중복 방지. (개인 초안·다른 캠페인 초안은 안전)
export async function clearOutreachDrafts(ownerKey, recipients) {
  const owner = OWNERS[ownerKey] || OWNERS.wsj
  const gmail = google.gmail({ version: 'v1', auth: await clientFor(owner) })
  const set = new Set(recipients.map(e => e.toLowerCase()))
  let deleted = 0, pageToken
  do {
    const { data } = await gmail.users.drafts.list({ userId: 'me', maxResults: 100, pageToken })
    for (const d of (data.drafts || [])) {
      const { data: full } = await gmail.users.drafts.get({ userId: 'me', id: d.id, format: 'metadata', metadataHeaders: ['To'] })
      const to = (full.message?.payload?.headers || []).find(h => h.name === 'To')?.value || ''
      const email = (to.match(/[\w.+-]+@[\w.-]+/) || [''])[0].toLowerCase()
      if (set.has(email)) { await gmail.users.drafts.delete({ userId: 'me', id: d.id }); deleted++ }
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  return deleted
}

// 발송 대신 '초안'으로 저장 → 확장 프로그램으로 수동 발송 시 볼드·서명 유지, 추적픽셀 없음(확장이 추적).
export async function createOutreachDraft(ownerKey, { to, subject, body }) {
  const owner = OWNERS[ownerKey] || OWNERS.wsj
  const gmail = google.gmail({ version: 'v1', auth: await clientFor(owner) })
  const sig = await signature(owner)
  const raw = Buffer.from([
    `From: =?UTF-8?B?${b64(owner.name)}?= <${owner.sender}>`,
    `To: ${to}`,
    `Reply-To: ${owner.sender}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html(body, sig, null, owner.imageUrl || null)),
  ].join('\r\n')).toString('base64url')
  const res = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } })
  return res.data
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
    owner.cc ? `Cc: ${owner.cc}` : null,
    `Reply-To: ${owner.sender}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html(body, sig, `${base}/api/o/${leadId}`, owner.imageUrl || null)),
  ].filter(l => l !== null).join('\r\n')).toString('base64url')
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return res.data
}
