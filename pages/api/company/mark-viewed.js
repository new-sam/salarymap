import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 담당자가 지원자 상세를 처음 연 시점을 viewed_at 에만 기록한다.
// 예전에는 같은 호출이 status='pending' → 'viewed' 로 바꿔버렸는데, ATS UI 가
// status 4단계(서류 → 1차 인터뷰 → 2차 인터뷰 → 최종)로 라벨링을 재정의한
// 뒤로는 카드 클릭 한 번에 1차 인터뷰로 자동 진급되어 버렸다. status 는
// 명시적인 stage 이동(드래그/다음 단계 버튼)에서만 바뀌어야 하므로 여기서는
// 손대지 않고 viewed_at 만 채운다. NEW 카운트는 viewed_at 기준으로 계산된다.
// Auth: 해당 공고의 회사 멤버(owner / job_team / recruiter_users.company_id)만.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: '서버 설정 오류' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  const { appId } = req.body || {};
  if (!appId) return res.status(400).json({ error: 'appId가 필요합니다.' });

  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await asUser.auth.getUser();
  const user = ud?.user;
  if (!user) return res.status(401).json({ error: '세션이 만료되었습니다.' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: app } = await admin
    .from('job_applications')
    .select('id, status, viewed_at, rejected_at, job_id, jobs(company_id, created_by)')
    .eq('id', appId).maybeSingle();
  if (!app) return res.status(404).json({ error: '지원자를 찾을 수 없습니다.' });

  let allowed = app.jobs?.created_by === user.id;
  if (!allowed) {
    const { data: team } = await admin.from('job_team').select('user_id').eq('job_id', app.job_id).eq('user_id', user.id).maybeSingle();
    if (team) allowed = true;
  }
  if (!allowed) {
    const { data: rec } = await admin.from('recruiter_users').select('company_id').eq('user_id', user.id).maybeSingle();
    if (rec && rec.company_id === app.jobs?.company_id) allowed = true;
  }
  if (!allowed) return res.status(403).json({ error: '권한이 없습니다.' });

  // 이미 한 번 본 지원자거나 반려된 경우 noop.
  if (app.viewed_at || app.rejected_at) {
    return res.status(200).json({ ok: true, changed: false, viewed_at: app.viewed_at });
  }
  const nowIso = new Date().toISOString();
  const { error: upErr } = await admin
    .from('job_applications')
    .update({ viewed_at: nowIso })
    .eq('id', appId);
  // viewed_at 컬럼이 아직 마이그레이션되지 않은 환경에서는 PGRST204 가
  // 떨어진다. 그래도 상세 화면이 깨지지 않도록 changed=false 로 응답한다.
  if (upErr && (upErr.code === 'PGRST204' || /viewed_at/.test(upErr.message || ''))) {
    return res.status(200).json({ ok: true, changed: false, missingColumn: true });
  }
  if (upErr) return res.status(500).json({ error: '열람 처리 실패: ' + upErr.message });
  return res.status(200).json({ ok: true, changed: true, viewed_at: nowIso });
}
