import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Delete a note row (only the author can delete their own note). */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

    const { noteId } = req.body || {};
    if (!noteId) return res.status(400).json({ error: 'noteId가 필요합니다.' });

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: note } = await admin
      .from('application_evaluations')
      .select('id, reviewer_user_id, stage')
      .eq('id', noteId)
      .maybeSingle();
    if (!note || note.stage !== 'note') {
      return res.status(404).json({ error: '메모를 찾을 수 없습니다.' });
    }
    if (note.reviewer_user_id !== user.id) {
      return res.status(403).json({ error: '작성자만 삭제할 수 있습니다.' });
    }
    const { error } = await admin.from('application_evaluations').delete().eq('id', noteId);
    if (error) return res.status(500).json({ error: '삭제 실패: ' + error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: '메모 삭제 오류: ' + (e?.message || '') });
  }
}
