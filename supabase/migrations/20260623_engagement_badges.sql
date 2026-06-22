-- 참여형 뱃지: 다양한 badge_type 허용 + 출석 streak용 활동일 기록 + 대표 뱃지 일반화.
-- (20260622_representative_tier.sql 이후 실행 — representative_tier 컬럼 참조.)

-- 1) badge_type CHECK 제거 — 참여형 뱃지 key(post_10, comment_500, streak_100 등)를 자유롭게 저장.
--    유효 key 검증은 앱/서버(lib/engagementBadges, lib/salaryTiers)에서 한다.
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_badge_type_check;

-- 2) 출석 활동일 — 인증 사용자의 하루 단위 활동을 1행으로 기록(중복 무시). 연속 streak 계산용.
--    track.js가 user_id 있는 이벤트마다 그날(베트남 UTC+7 기준)을 upsert.
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_days_user ON user_activity_days(user_id, day DESC);

-- 3) 대표 뱃지 일반화 — 연봉 등급 키 또는 참여형 뱃지 key를 저장(둘 다 대표 선택 가능).
--    기존 representative_tier 값은 그대로 이관. 이후 로직은 representative_badge를 사용.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS representative_badge TEXT;
UPDATE user_profiles
  SET representative_badge = representative_tier
  WHERE representative_badge IS NULL AND representative_tier IS NOT NULL;
