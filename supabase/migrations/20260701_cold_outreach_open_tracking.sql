-- 오픈 추적(추적 픽셀)용. ※ 애플 MPP·이미지차단으로 숫자는 방향성 참고용.
-- 적용: supabase db query --linked -f <this>
ALTER TABLE cold_outreach
  ADD COLUMN IF NOT EXISTS opened_at  timestamptz,          -- 최초 오픈 시각
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0; -- 오픈(픽셀 로드) 횟수
