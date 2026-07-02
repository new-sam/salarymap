-- 반송(bounced) 상태 추가: 발송 실패/주소 오류.
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach DROP CONSTRAINT IF EXISTS cold_outreach_status_check;
ALTER TABLE cold_outreach ADD CONSTRAINT cold_outreach_status_check
  CHECK (status IN ('todo','sent','replied','meeting','won','lost','bounced'));
