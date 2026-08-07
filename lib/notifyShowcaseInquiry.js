import supabaseAdmin from './supabaseAdmin'

/* 전시장 상담 문의 → 우리에게 알림 한 통.

   고객사에게는 아무것도 안 보낸다. 접수됐다는 말은 화면이 이미 했고(모달의 완료 화면),
   그다음은 사람이 직접 연락하는 일이다 — 자동 확인 메일을 한 통 끼워 넣으면 우리가
   연락하기도 전에 대화가 로봇으로 시작된다.

   절대 throw 하지 않는다 — 문의는 이미 DB 에 들어갔고 어드민 목록에도 뜬다.
   메일이 실패했다고 접수를 실패로 만들면, 우리가 못 받은 게 아니라 고객사가
   "안 보내졌나" 하고 화면 앞에서 다시 누르게 된다. (notifyTeamNewApplication 과 같은 규칙)

   후보의 실명·이력서 링크가 처음으로 밖에 나가는 자리다. 나가는 곳이 우리 받은편지함
   하나뿐이라는 걸 여기서 지킨다. 실명은 미팅에서 사람이 건넨다. */

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

    /* 보여드린 사람 전부를 실명으로 편다 — 고른 사람만이 아니라.

       문의 입구가 하단 CTA 하나뿐이라 아무도 안 고르면 전원이 넘어오고, 모달에서
       몇을 체크하면 그 몇만 넘어온다. 넘어온 것만 펴면 뒤쪽 경우에 우리가 무엇을
       보여드렸는지가 메일에서 사라진다 — 팀이 봐야 하는 건 '고객이 표시한 셋'이 아니라
       '열 명을 보여줬고 그중 셋에 반응했다'이다. 그래서 명단은 언제나 열 줄이고,
       체크된 사람에게만 표시가 붙는다(hot).

       전원이 넘어온 경우는 표시를 안 붙인다 — 열 줄이 다 주황이면 그건 강조가 아니다. */
    const picked = new Set((q.picked || []).map(Number))
    const shown = (s?.picks || []).filter(Boolean)
    const someMarked = picked.size > 0 && picked.size < shown.length

    const { data: people } = shown.length
      ? await supabaseAdmin.from('user_profiles')
        .select('id, full_name, email, position, headline, resume_url').in('id', shown)
      : { data: [] }
    const byId = Object.fromEntries((people || []).map((p) => [String(p.id), p]))

    const rows = shown.map((id, i) => {
      const p = byId[String(id)]
      return {
        no: i + 1,
        name: p?.full_name || '(이름 없음)',
        role: p?.position || p?.headline || '',
        email: p?.email || '',
        resume: p?.resume_url || '',
        hot: someMarked && picked.has(i),
      }
    })

    /* 우리가 JD 에서 읽어낸 조건. 요약의 재료는 criteria 뿐이다 — JD 원문은 어디에도
       저장하지 않는다(jd-criteria 참고).

       criteria 에는 title 이 없다. jd-match 가 조건 객체를 다시 만들 때 담지 않아서,
       예전 '자리' 칸은 어떤 JD 로 들어와도 '(자리 미상)' 이었다. 그래서 자리 이름 대신
       직무·경력·기술·어학으로 말한다 — 어차피 이 넷이 후보를 고른 실제 잣대다.

       고르는 값은 결과 화면이 카드 위에 배지로 올리는 것과 같다(showcasing 의 Keywords).
       화면에서 본 조건과 메일에 적힌 조건이 다르면 둘 중 하나를 못 믿게 된다.
       값이 없는 칸은 통째로 뺀다 — '미상'·'기재 없음'은 정보가 아니라 빈칸의 다른 이름이다. */
    const crit = s?.criteria || {}
    const lvl = (v, name) => (v === 'required' ? `${name} 필수` : v === 'plus' ? `${name} 우대` : '')
    const critRows = [
      ['직무', (crit.positions || []).slice(0, 3).join(' · ')],
      ['경력', crit.yoe_min == null && crit.yoe_max == null ? ''
        : `${crit.yoe_min ?? 0}${crit.yoe_max != null ? `~${crit.yoe_max}` : '+'}년`],
      ['기술', (crit.must_skills || []).slice(0, 6).join(', ')],
      ['어학', [lvl(crit.korean, '한국어'), lvl(crit.english, '영어')].filter(Boolean).join(' · ')],
    ].filter(([, v]) => v)

    // 제목·본문에서 이 문의를 한 줄로 부를 이름. 직무가 없으면 기술로 대신한다.
    const headline = (crit.positions || []).slice(0, 2).join(' · ')
      || (crit.must_skills || []).slice(0, 3).join(', ')
      || '조건 미상'

    const adminUrl = `${SITE}/admin/showcasing-inquiries`
    const contact = [q.email, q.phone].filter(Boolean).join(' · ')

    // 회색 박스 한 줄. bold 는 눈이 먼저 가야 하는 칸에만 준다.
    const boxRow = ([k, v, bold]) =>
      `<tr><td style="padding:10px 14px;width:88px;color:#8B95A1">${esc(k)}</td>` +
      `<td style="padding:10px 14px">${bold ? `<b>${esc(v)}</b>` : esc(v)}</td></tr>`
    /* 텍스트 본문의 라벨 칸. padEnd 로는 안 맞는다 — 한글은 모노스페이스에서 두 칸을
       차지하는데 문자열 길이는 한 글자로 세어서, '희망 시간' 과 '직무' 가 다른 자리에서
       끝난다. 폭으로 세서 맞춘다. */
    const width = (str) => [...str].reduce((n, ch) => n + (ch.codePointAt(0) > 0x2e80 ? 2 : 1), 0)
    const boxText = (list) => list.map(([k, v]) => {
      const label = `${k}:`
      return label + ' '.repeat(Math.max(1, 13 - width(label))) + v
    }).join('\n')

    /* 카드에서 사람을 골라 문의하는 흐름이 아니다. 지금 화면의 문의 입구는 하단 고정
       CTA 하나이고, 아무도 안 고르면 전원으로 접수된다 — 고객사가 하는 일은 열 장을
       보고 "이 정도면 얘기해 볼 만하다"고 판단하는 것뿐이다. 그래서 이 메일의 첫 사실은
       '누구를 골랐나'가 아니라 '어느 회사가 상담을 원하나'다. 인재 목록은 그 아래
       참고 자료로 내린다.

       주황 버튼과 파란 링크를 걷어낸 건 화면이 "브랜드 색은 결정적인 곳에만"이라는
       톤이라서다. 여기서 주황은 고객사가 관심 표시한 사람에게만 쓴다. */
    const teamRows = [
      ...critRows,
      ['연락처', contact || '-', true],
      ['희망 시간', q.when_pref || '-'],
      ['남긴 말', q.memo || '-'],
      ['접수', `${vnTime(q.created_at)} (베트남 시각)`],
    ]

    const subject = `[전시장] ${q.company} 상담 문의 — ${headline}`
    const text =
`${q.company} 의 ${q.contact_name} 님이 상담을 요청했습니다.

${boxText(teamRows)}

추천 인재 ${rows.length}명
${rows.map((r) => `  ${r.hot ? '★' : ' '} #${r.no} ${r.name}${r.role ? ` · ${r.role}` : ''}${r.hot ? ' (관심)' : ''}\n       ${r.resume || '이력서 링크 없음'}`).join('\n')}

문의 목록: ${adminUrl}`

    const html =
`<div style="font-family:'Pretendard','Segoe UI',Arial,sans-serif;color:#191F28;max-width:520px;margin:0 auto;padding:8px 0">
  <h2 style="font-size:20px;margin:0 0 12px">상담 문의가 들어왔습니다</h2>
  <p style="margin:0 0 18px;line-height:1.7;color:#4E5968">
    <b>${esc(q.company)}</b> 의 <b>${esc(q.contact_name)}</b> 님이 상담을 요청했습니다.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#4E5968;background:#FAFBFC;border-radius:10px">
    ${teamRows.map(boxRow).join('\n    ')}
  </table>
  <div style="font-size:13px;font-weight:700;margin:22px 0 8px">추천 인재 ${rows.length}명</div>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    ${rows.map((r) => {
      /* 고객사가 체크한 사람만 주황. 글자색은 #ff6000 이 아니라 한 톤 내린 #D94E00 이다 —
         흰 바탕의 작은 글씨에서 순수 오렌지는 읽기가 나쁘다(화면도 글자에는 brandInk 를 쓴다).
         배지를 같이 다는 건, 색만으로는 무슨 뜻인지 설명이 안 되고 색각 이상에서 사라져서다. */
      const no = r.hot ? '#D94E00' : '#B0B8C1'
      const ink = r.hot ? '#D94E00' : '#4E5968'
      const sub = r.hot ? '#C98063' : '#8B95A1'
      return `<tr style="border-top:1px solid #F2F4F6">
      <td style="padding:8px 0;width:30px;color:${no}">#${r.no}</td>
      <td style="padding:8px 0;color:${ink}${r.hot ? ';font-weight:700' : ''}">${esc(r.name)}${r.role ? `<span style="color:${sub};font-weight:400"> · ${esc(r.role)}</span>` : ''}${r.hot ? ' <span style="background:#FFF3EC;color:#D94E00;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;white-space:nowrap">관심</span>' : ''}</td>
      <td style="padding:8px 0;text-align:right">${r.resume ? `<a href="${esc(r.resume)}" style="color:${r.hot ? '#D94E00' : '#8B95A1'};font-size:12px">이력서 →</a>` : '<span style="color:#D1D6DB;font-size:12px">링크 없음</span>'}</td>
    </tr>`
    }).join('')}
  </table>
  <p style="font-size:12px;color:#B0B8C1;margin-top:22px">
    <a href="${adminUrl}" style="color:#8B95A1">문의 목록 열기 →</a>
  </p>
</div>`

    // 테스트용 리다이렉트 — 있으면 알림이 전부 이 주소 하나로 간다.
    const override = (process.env.NOTIFY_TEAM_OVERRIDE_TO || '').trim()
    const sends = TO.map((to) => ({ to: override || to, subject, text, html }))

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
