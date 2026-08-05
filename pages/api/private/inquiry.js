import supabaseAdmin from '../../../lib/supabaseAdmin'
import { notifyShowcaseInquiry } from '../../../lib/notifyShowcaseInquiry'

/* 전시장 결과 → 상담 문의 접수. /private/showcasing 의 전환 지점이다.

   후보를 id 로 받지 않는다. 받는 건 sid(그 검색)와 카드 인덱스뿐이고, 누구인지는
   showcase_searches.picks[i] 를 서버가 펴서 안다. 그래서 이 API 가 열려 있어도
   후보의 신원은 요청에도 응답에도 없다 — 인덱스는 그 검색 안에서만 뜻이 있는 숫자다.

   ── 스팸을 왜 IP 로 막지 않는가
   로그인이 없는 공개 주소에 붙은 폼이라 남용을 걱정해야 하지만, 이 폼은 이미
   비싼 문 뒤에 있다: sid 는 실제 검색에서만 나오고 검색 한 번은 LLM 호출 20여 번에
   20초다. 문의 하나를 더 넣으려면 그걸 다시 치러야 한다. 그래서 여기서는
   검색당 건수만 묶고(같은 sid 로 무한히 밀어 넣는 것만 막으면 된다), IP 는 아예
   저장하지 않는다 — 스팸을 조금 덜 막는 대신 방문자 IP 를 쌓지 않는 쪽을 고른다.
   함정칸(hp)과 체류시간은 사람이 아닌 것을 거르는 값싼 두 겹이다. */

const MAX_PER_SEARCH = 3   // 같은 검색에서 마음이 바뀌어 다시 보내는 정도까지만
const MIN_DWELL_MS = 3000  // 폼을 열고 3초 안에 채워 보내는 건 사람이 아니다

const cap = (v, n) => String(v ?? '').trim().slice(0, n)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  const b = req.body || {}

  /* 봇 두 겹 — 걸리면 400 이 아니라 200 을 준다. 무엇이 걸러졌는지 알려 주면
     맞춰서 다시 보낸다. 사람에게는 어차피 안 보이는 칸이라 오탐이 없다. */
  if (cap(b.hp, 200)) return res.status(200).json({ ok: true })
  if (typeof b.t === 'number' && Date.now() - b.t < MIN_DWELL_MS) return res.status(200).json({ ok: true })

  const sid = cap(b.sid, 40)
  if (!sid) return res.status(400).json({ error: '검색 정보가 없습니다 — 다시 검색해주세요' })

  // 카드 인덱스. 화면이 5장을 넘게 그리는 일이 없으므로 범위는 검색 쪽에서 다시 본다.
  const picked = [...new Set((Array.isArray(b.picked) ? b.picked : [])
    .filter((n) => Number.isInteger(n) && n >= 0 && n < 20))].sort((x, y) => x - y)
  if (!picked.length) return res.status(400).json({ error: '문의할 인재를 골라주세요' })

  const contact_name = cap(b.name, 40)
  const company = cap(b.company, 80)
  const email = cap(b.email, 120)
  const phone = cap(b.phone, 60)
  if (!contact_name) return res.status(400).json({ error: '담당자 성함을 입력해주세요' })
  if (!company) return res.status(400).json({ error: '회사명을 입력해주세요' })
  if (!email && !phone) return res.status(400).json({ error: '이메일 또는 연락처 중 하나는 입력해주세요' })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '이메일 주소를 확인해주세요' })

  try {
    // 검색이 실재하는지 + 인덱스가 그 검색 안에 있는지. 없는 sid 로 들어온 문의는
    // 누구를 가리키는지 영영 알 수 없으므로 받아 두는 의미가 없다.
    const { data: search } = await supabaseAdmin
      .from('showcase_searches').select('id, picks').eq('id', sid).maybeSingle()
    if (!search) return res.status(400).json({ error: '검색 정보가 만료되었습니다 — 다시 검색해주세요' })
    if (picked.some((i) => i >= search.picks.length)) {
      return res.status(400).json({ error: '고른 인재를 찾지 못했습니다 — 다시 검색해주세요' })
    }

    const { count } = await supabaseAdmin
      .from('showcase_inquiries').select('id', { count: 'exact', head: true }).eq('search_id', sid)
    if ((count || 0) >= MAX_PER_SEARCH) {
      return res.status(429).json({ error: '이미 문의를 받았습니다 — 곧 연락드리겠습니다' })
    }

    const { data, error } = await supabaseAdmin.from('showcase_inquiries').insert({
      search_id: sid,
      picked,
      contact_name,
      company,
      email: email || null,
      phone: phone || null,
      when_pref: cap(b.when, 40) || null,
      memo: cap(b.memo, 500) || null,
    }).select('id').single()
    if (error) throw error

    // 메일은 접수를 막지 않는다 — 알림이 실패해도 문의는 들어온 것이고, 어드민 목록에
    // 남아 있으므로 잃어버리지 않는다. (notifyTeamNewApplication 과 같은 규칙)
    notifyShowcaseInquiry(data.id).catch(() => {})

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message || '문의를 접수하지 못했습니다' })
  }
}
