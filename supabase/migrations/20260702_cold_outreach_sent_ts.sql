-- 정밀 발송시각(오픈율 신뢰도용 — 발송 직후 발신자/CC/프록시 오픈 제외에 사용).
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach ADD COLUMN IF NOT EXISTS sent_ts timestamptz;
-- 기존 발송분: sent_ts를 발송일로(과거) + 발신자 오염 오픈 리셋
UPDATE cold_outreach SET sent_ts = sent_at::timestamptz WHERE sent_ts IS NULL AND sent_at IS NOT NULL;
UPDATE cold_outreach SET open_count = 0, opened_at = NULL WHERE status IN ('sent','replied','meeting','won','lost');
