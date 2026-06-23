// 안 읽은 알림 수 — 홈 종 아이콘 배지용 경량 엔드포인트(목록 전체를 받지 않게).
// 인증: Authorization: Bearer <supabase access_token>.
import supabaseAdmin from '../../../lib/supabaseAdmin';

async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ unreadCount: count || 0 });
}
