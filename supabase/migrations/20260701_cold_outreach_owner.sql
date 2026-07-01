-- 발신자 구분 (wsj / younghun ...). 기존 kocham 행은 wsj.
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach ADD COLUMN IF NOT EXISTS owner text NOT NULL DEFAULT 'wsj';
CREATE INDEX IF NOT EXISTS idx_cold_outreach_owner ON cold_outreach (owner);
