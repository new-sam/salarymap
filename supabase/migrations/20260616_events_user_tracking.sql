-- events 행동 추적: 유저/익명 식별자 추가
-- 목적: 재방문·소비→참여 전환·실험 버킷을 유저 단위로 측정 (커뮤니티 리텐션 검증 실험)
--   user_id   : 로그인 유저 식별 (auth.users.id)
--   client_id : localStorage 영속 익명 id — 로그아웃 방문자 재방문 + 버킷 분기에 사용
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id text;

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_client_id ON events(client_id) WHERE client_id IS NOT NULL;
