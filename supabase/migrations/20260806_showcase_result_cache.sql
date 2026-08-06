-- 같은 JD 는 같은 결과 — /private/showcasing 매칭 결과 캐시 (24시간, jd-match 참고).
-- jd_hash 는 JD 원문의 sha256 이고 원문은 저장하지 않는다. result 는 화면에 그대로
-- 돌려주는 응답(카드) 전체다 — 이름·이메일·이력서 URL 이 애초에 안 담기는 값이라 안전하다.
alter table showcase_searches add column if not exists jd_hash text;
alter table showcase_searches add column if not exists result jsonb;
create index if not exists showcase_searches_jd_hash_idx
  on showcase_searches (jd_hash, created_at desc) where jd_hash is not null;
