-- 발신자별 Gmail refresh token 저장 (링크 클릭 방식 연동). service_role 전용.
-- 적용: supabase db query --linked -f <this>
CREATE TABLE IF NOT EXISTS gmail_oauth_tokens (
  email         text PRIMARY KEY,
  refresh_token text NOT NULL,
  scopes        text,
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;
