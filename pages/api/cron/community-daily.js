// 커뮤니티 트리클 시딩 — 확률적으로 글 1개(가끔 2개)를 최근 시각에 올리고,
// 최근 글에 시간 간격 두고 댓글을 하나씩 드립. 한꺼번에 안 뜨고 자연스럽게 쌓임.
// 활성 트리거는 GitHub Actions(.github/workflows/community-seed.yml, 매시간 CLI 실행) —
// Vercel Hobby는 cron 하루 1회 제한이라 시간단위 트리클 불가해서 vercel.json엔 미등록.
// 이 라우트는 수동/대체 엔드포인트: GET ?dry=1[&force=1] (Bearer ${CRON_SECRET} 필요).
// Vercel Pro로 올리면 vercel.json crons에 { "0 * * * *" }로 등록해 이 라우트를 스케줄링 가능.
// 가드레일/로직은 lib/communityContent.js(CLI와 공유)의 runTick.
import OpenAI from 'openai';
import supabaseAdmin from '../../../lib/supabaseAdmin';
import { runTick } from '../../../lib/communityContent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dry = req.query.dry === '1';
  const force = req.query.force === '1';

  try {
    const result = await runTick({ supabase: supabaseAdmin, openai, dry, force });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
