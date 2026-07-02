-- 발송 회차(1차/2차…) 추적. 발송 때마다 +1.
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach ADD COLUMN IF NOT EXISTS send_count integer NOT NULL DEFAULT 0;
-- 기존 발송분은 1차로 백필
UPDATE cold_outreach SET send_count = 1
  WHERE send_count = 0 AND status IN ('sent','replied','meeting','won','lost');
