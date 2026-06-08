// 일일 인기글 푸시 — 매일 아침(ICT) 어제 가장 인기 있던 커뮤니티 글을 옵트인 사용자에게 브로드캐스트.
// Vercel cron이 Authorization: Bearer ${CRON_SECRET} 헤더로 호출(crawl-jobs.js와 동일).
// vercel.json crons: { "path": "/api/cron/daily-hot-post", "schedule": "0 1 * * *" }  (01:00 UTC = 08:00 ICT)
import supabaseAdmin from '../../../lib/supabaseAdmin';
import { sendPush } from '../../../lib/push';

const ICT_OFFSET = 7 * 60 * 60 * 1000; // UTC+7

// 홈 "인기글"과 동일 가중치(모바일 community.ts hotScore): 댓글>좋아요>조회.
function hotScore(p) {
  return (p.comment_count || 0) * 4 + (p.like_count || 0) * 3 + (p.view_count || 0) * 0.3;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 어제(ICT) 00:00 ~ 오늘(ICT) 00:00 구간을 UTC ISO로 환산.
  const now = Date.now();
  const ictNow = new Date(now + ICT_OFFSET);
  const ictMidnight =
    Date.UTC(ictNow.getUTCFullYear(), ictNow.getUTCMonth(), ictNow.getUTCDate()) - ICT_OFFSET;
  const startUtc = new Date(ictMidnight - 24 * 3600 * 1000).toISOString();
  const endUtc = new Date(ictMidnight).toISOString();

  // 어제 작성된 글 중 hotScore 1위.
  const { data: posts, error } = await supabaseAdmin
    .from('community_posts')
    .select('id, title, like_count, comment_count, view_count, created_at')
    .gte('created_at', startUtc)
    .lt('created_at', endUtc);
  if (error) return res.status(500).json({ error: error.message });
  if (!posts?.length) return res.status(200).json({ ok: true, sent: 0, reason: 'no posts' });

  const top = posts.sort((a, b) => hotScore(b) - hotScore(a))[0];

  // 토큰이 있는 모든 사용자에게 발송(sendPush가 enabled + prefs.daily_hot로 재필터).
  const { data: tokenRows } = await supabaseAdmin
    .from('push_tokens')
    .select('user_id')
    .eq('enabled', true);
  const userIds = [...new Set((tokenRows || []).map((r) => r.user_id).filter(Boolean))];
  if (!userIds.length) return res.status(200).json({ ok: true, sent: 0, reason: 'no tokens' });

  await sendPush(userIds, {
    title: 'Bài viết nổi bật hôm qua 🔥',
    body: top.title || 'Xem bài viết được quan tâm nhất hôm qua',
    category: 'daily_hot',
    data: { url: `/community/${top.id}` },
  });

  return res.status(200).json({ ok: true, postId: top.id, recipients: userIds.length });
}
