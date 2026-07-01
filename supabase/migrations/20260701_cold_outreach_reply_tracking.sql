-- 회신 자동감지용: 발송 스레드 ID + 최초 회신 시각.
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach
  ADD COLUMN IF NOT EXISTS gmail_thread_id text,   -- 발송 Gmail 스레드 ID
  ADD COLUMN IF NOT EXISTS replied_at      timestamptz; -- 최초 회신 감지 시각
