-- 콜드아웃리치 개인화 메일 초안 저장용 (생성 → 검수 → 발송 단계 분리).
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach
  ADD COLUMN IF NOT EXISTS email_subject text,        -- AI 생성 제목
  ADD COLUMN IF NOT EXISTS email_body    text,        -- AI 생성 본문(플레인텍스트)
  ADD COLUMN IF NOT EXISTS generated_at  timestamptz; -- 초안 생성 시각
