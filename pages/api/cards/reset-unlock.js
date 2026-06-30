// [개발/테스트용] 본인 명함의 디자인 잠금해제를 초기화한다 — designs_unlocked=false +
// card_views(고유 열람) 전부 삭제 → 다시 "잠김(0/3)" 상태로. 본인 카드만 영향(악용 없음).
import supabase from '../../../lib/supabaseAdmin'

async function userFromReq(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const me = await userFromReq(req)
  if (!me) return res.status(401).json({ error: 'Unauthorized' })

  const { data: card } = await supabase
    .from('business_cards')
    .select('id')
    .eq('user_id', me.id)
    .maybeSingle()

  if (card) {
    await supabase.from('card_views').delete().eq('card_id', card.id)
    await supabase.from('business_cards').update({ designs_unlocked: false }).eq('id', card.id)
  }
  return res.status(200).json({ ok: true })
}
