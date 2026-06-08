// 푸시 토큰 등록/선호 관리 — 모바일 앱(salary-fyi)이 호출.
// 인증: Authorization: Bearer <supabase access_token> (likes.js와 동일 패턴).
//  POST { expo_push_token, platform, prefs? } → 토큰 업서트(로그인 사용자에 매핑)
//  GET  → 현재 사용자의 카테고리 선호 반환
//  PUT  { prefs } → 현재 사용자의 모든 토큰에 선호 반영(설정 토글)
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
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { expo_push_token, platform, prefs } = req.body || {};
    if (!expo_push_token) {
      return res.status(400).json({ error: 'expo_push_token required' });
    }
    const row = {
      user_id: user.id,
      expo_push_token,
      platform: platform || null,
      enabled: true,
      updated_at: new Date().toISOString(),
    };
    if (prefs && typeof prefs === 'object') row.prefs = prefs;

    const { error } = await supabaseAdmin
      .from('push_tokens')
      .upsert(row, { onConflict: 'expo_push_token' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('push_tokens')
      .select('prefs')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ prefs: data?.prefs ?? null });
  }

  if (req.method === 'PUT') {
    const { prefs } = req.body || {};
    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ error: 'prefs required' });
    }
    const { error } = await supabaseAdmin
      .from('push_tokens')
      .update({ prefs, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
