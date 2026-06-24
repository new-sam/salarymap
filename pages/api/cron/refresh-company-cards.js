// 회사 카드 사전계산 갱신 — /api/companies 기본 뷰(필터 없음)를 미리 계산해 company_cards_cache에 적재.
// 콜드 요청마다 ~3초 걸리던 집계를, 엔드포인트가 1행 읽기로 대체하게 한다.
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 헤더로 호출(daily-hot-post.js와 동일).
// vercel.json crons: { "path": "/api/cron/refresh-company-cards", "schedule": "30 1 * * *" }
import supabaseAdmin from '../../../lib/supabaseAdmin';
import { computeCompanyCards } from '../companies';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const cards = await computeCompanyCards(null, null);
    const { error } = await supabaseAdmin
      .from('company_cards_cache')
      .upsert({ id: 1, cards, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, count: cards.length });
  } catch (err) {
    console.error('refresh-company-cards error:', err);
    return res.status(500).json({ error: err.message });
  }
}
