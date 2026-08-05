import supabaseAdmin from './supabaseAdmin'

/* 전시장 상담 문의 → 메일 두 통. 우리에게 알림 1통, 고객사에 접수 확인 1통.

   절대 throw 하지 않는다 — 문의는 이미 DB 에 들어갔고 어드민 목록에도 뜬다.
   메일이 실패했다고 접수를 실패로 만들면, 우리가 못 받은 게 아니라 고객사가
   "안 보내졌나" 하고 화면 앞에서 다시 누르게 된다. (notifyTeamNewApplication 과 같은 규칙)

   후보의 실명·이력서 링크가 처음으로 밖에 나가는 자리다. 나가는 곳이 우리 받은편지함
   하나뿐이라는 걸 여기서 지킨다 — 고객사에게 보내는 확인 메일에는 카드 번호와 직무만
   들어간다. 실명은 미팅에서 사람이 건넨다. */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://salary-fyi.com').replace(/\/$/, '')
const FROM = process.env.RESEND_FROM || 'FYI <onboarding@resend.dev>'
// 받는 사람은 env 로 뺀다 — 담당이 바뀔 때 코드를 고치지 않게. 콤마로 여러 명도 된다.
const TO = (process.env.SHOWCASE_INQUIRY_TO || 'j_yujin@likelion.net')
  .split(',').map((s) => s.trim()).filter(Boolean)

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const vnTime = (iso) => {
  try {
    return new Date(iso || Date.now()).toLocaleString('ko-KR', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return new Date().toISOString() }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function notifyShowcaseInquiry(inquiryId) {
  if (!inquiryId) return { ok: false, reason: 'no_id' }
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'no_resend_key' }

  try {
    const { data: q } = await supabaseAdmin
      .from('showcase_inquiries')
      .select('id, search_id, picked, contact_name, company, email, phone, when_pref, memo, created_at')
      .eq('id', inquiryId).maybeSingle()
    if (!q) return { ok: false, reason: 'not_found' }

    const { data: s } = await supabaseAdmin
      .from('showcase_searches').select('picks, criteria, company').eq('id', q.search_id).maybeSingle()

    // 고른 후보만 실명으로 편다. 안 고른 넷은 조회하지 않는다.
    const ids = (q.picked || []).map((i) => s?.picks?.[i]).filter(Boolean)
    const { data: people } = ids.length
      ? await supabaseAdmin.from('user_profiles')
        .select('id, full_name, email, position, headline, resume_url').in('id', ids)
      : { data: [] }
    const byId = Object.fromEntries((people || []).map((p) => [String(p.id), p]))

    const rows = (q.picked || []).map((i) => {
      const p = byId[String(s?.picks?.[i])]
      return {
        no: i + 1,
        name: p?.full_name || '(이름 없음)',
        role: p?.position || p?.headline || '',
        email: p?.email || '',
        resume: p?.resume_url || '',
      }
    })

    const title = s?.criteria?.title || '(자리 미상)'
    const adminUrl = `${SITE}/admin/showcasing-inquiries`
    const contact = [q.email, q.phone].filter(Boolean).join(' · ')

    /* ── 1) 우리에게 */
    const subject = `[전시장] ${q.company} — ${rows.length}명 상담 문의`
    const text =
`${q.company} 의 ${q.contact_name} 님이 인재 ${rows.length}명으로 상담을 요청했습니다.

자리:     ${title}
연락처:   ${contact || '-'}
희망시간: ${q.when_pref || '-'}
남긴 말:  ${q.memo || '-'}
접수:     ${vnTime(q.created_at)} (베트남 시각)

고른 인재
${rows.map((r) => `  #${r.no} ${r.name}${r.role ? ` · ${r.role}` : ''}\n     ${r.resume || '이력서 링크 없음'}`).join('\n')}

문의 목록: ${adminUrl}`

    const html =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#191F28;max-width:600px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px">인재 상담 문의</h2>
  <p style="margin:0 0 16px;line-height:1.6;color:#4E5968">
    <b>${esc(q.company)}</b> 의 <b>${esc(q.contact_name)}</b> 님이 인재 ${rows.length}명으로 상담을 요청했습니다.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#4E5968">
    <tr><td style="padding:6px 0;width:90px;color:#8B95A1">자리</td><td style="padding:6px 0"><b>${esc(title)}</b></td></tr>
    <tr><td style="padding:6px 0;color:#8B95A1">연락처</td><td style="padding:6px 0"><b>${esc(contact || '-')}</b></td></tr>
    <tr><td style="padding:6px 0;color:#8B95A1">희망 시간</td><td style="padding:6px 0">${esc(q.when_pref || '-')}</td></tr>
    <tr><td style="padding:6px 0;color:#8B95A1">남긴 말</td><td style="padding:6px 0">${esc(q.memo || '-')}</td></tr>
    <tr><td style="padding:6px 0;color:#8B95A1">접수</td><td style="padding:6px 0">${esc(vnTime(q.created_at))}</td></tr>
  </table>
  <div style="font-size:13px;font-weight:700;margin:22px 0 8px">고른 인재</div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${rows.map((r) => `<tr style="border-top:1px solid #F2F4F6">
      <td style="padding:9px 0;width:36px;color:#B0B8C1">#${r.no}</td>
      <td style="padding:9px 0"><b>${esc(r.name)}</b>${r.role ? `<span style="color:#8B95A1"> · ${esc(r.role)}</span>` : ''}
        <div style="font-size:12px;color:#8B95A1">${esc(r.email || '')}</div></td>
      <td style="padding:9px 0;text-align:right">${r.resume ? `<a href="${esc(r.resume)}" style="color:#1A73E8;font-size:13px">이력서 →</a>` : '<span style="color:#D1D6DB;font-size:13px">링크 없음</span>'}</td>
    </tr>`).join('')}
  </table>
  <p style="margin:24px 0">
    <a href="${adminUrl}" style="background:#ff6000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block">문의 목록 열기 →</a>
  </p>
</div>`

    /* ── 2) 고객사에게 (이메일을 남긴 경우만)
       후보 실명은 넣지 않는다 — 아직 우리가 건넨 적 없는 정보다. 카드 번호와 직무만
       되짚어서 "무엇으로 문의했는지"가 상대 받은편지함에도 남게 한다. 이 메일의 또
       다른 일은 우리 주소를 상대에게 넣어 두는 것이다: 답장할 곳이 생긴다. */
    const ackSubject = 'FYI 인재 상담 문의가 접수되었습니다'
    const ackText =
`${q.contact_name} 님, 문의 감사합니다.

아래 내용으로 접수되었습니다. 영업일 기준 1일 안에 연락드리겠습니다.

자리:     ${title}
고른 인재: ${rows.map((r) => `#${r.no}${r.role ? ` ${r.role}` : ''}`).join(', ')}
희망시간: ${q.when_pref || '-'}

— FYI`

    const ackHtml =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#191F28;max-width:520px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px">문의가 접수되었습니다</h2>
  <p style="margin:0 0 18px;line-height:1.7;color:#4E5968">
    ${esc(q.contact_name)} 님, 문의 감사합니다.<br />
    영업일 기준 <b>1일 안에</b> 연락드리겠습니다.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#4E5968;background:#FAFBFC;border-radius:10px">
    <tr><td style="padding:10px 14px;width:88px;color:#8B95A1">자리</td><td style="padding:10px 14px"><b>${esc(title)}</b></td></tr>
    <tr><td style="padding:10px 14px;color:#8B95A1">고른 인재</td><td style="padding:10px 14px">${rows.map((r) => `#${r.no}${r.role ? ` ${esc(r.role)}` : ''}`).join(', ')}</td></tr>
    <tr><td style="padding:10px 14px;color:#8B95A1">희망 시간</td><td style="padding:10px 14px">${esc(q.when_pref || '-')}</td></tr>
  </table>
  <p style="font-size:12px;color:#B0B8C1;margin-top:22px">이 메일에 그대로 답장하셔도 됩니다.</p>
</div>`

    // 테스트용 리다이렉트 — 있으면 고객사 확인 메일까지 전부 이 주소 하나로 간다.
    const override = (process.env.NOTIFY_TEAM_OVERRIDE_TO || '').trim()
    const sends = [
      ...TO.map((to) => ({ to: override || to, subject, text, html })),
      ...(q.email ? [{ to: override || q.email, subject: ackSubject, text: ackText, html: ackHtml }] : []),
    ]

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const results = []
    for (let i = 0; i < sends.length; i++) {
      try {
        const r = await resend.emails.send({ from: FROM, ...sends[i] })
        results.push({ to: sends[i].to, status: r.error ? 'failed' : 'sent' })
      } catch (e) {
        results.push({ to: sends[i].to, status: 'failed', err: e?.message })
      }
      // Resend 2 req/sec — 붙여 쏘면 뒤쪽이 429 로 조용히 떨어진다
      if (i < sends.length - 1) await sleep(600)
    }
    return { ok: true, results }
  } catch (e) {
    return { ok: false, reason: e?.message || 'failed' }
  }
}
