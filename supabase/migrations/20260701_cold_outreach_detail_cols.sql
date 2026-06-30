-- 코참 콜드메일 리스트의 상세 정보 보존용 컬럼.
-- 뷰(OutreachView)엔 노출하지 않더라도 원본 데이터는 DB에 가지고 있는다.
-- (적용은 Supabase 대시보드 SQL 에디터에서 수동 — 이 프로젝트는 db push 미사용)
ALTER TABLE cold_outreach
  ADD COLUMN IF NOT EXISTS industry_detail text,  -- 상세업종 (Type of business)
  ADD COLUMN IF NOT EXISTS business_desc   text,  -- 사업내용 (영문 회사소개 포함)
  ADD COLUMN IF NOT EXISTS address         text,  -- 주소
  ADD COLUMN IF NOT EXISTS phone           text,  -- 전화번호
  ADD COLUMN IF NOT EXISTS fax             text,  -- 팩스
  ADD COLUMN IF NOT EXISTS source_id       text;  -- 원본 wr_id (중복방지/추적)
