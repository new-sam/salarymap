-- 대표 뱃지: 커뮤니티에 노출할 연봉 등급을 사용자가 직접 고를 수 있게 한다.
-- 본인이 획득(해금)한 등급 중 하나(최고 등급 또는 그 이하)를 representative_tier에 저장.
-- NULL이면 자동 = 실제 최고 등급(기존 동작). 실제 등급 이하인지 검증은 API
-- (/api/badges PUT)에서 수행한다 — 등급 경계값이 DB가 아닌 JS(lib/salaryTiers)에 있기 때문.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS representative_tier TEXT;
