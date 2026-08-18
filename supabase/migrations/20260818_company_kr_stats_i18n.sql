-- 한국어 원문 필드(업종·주소)의 번역 캐시.
-- {industry_en, industry_vi, address_en} — 수집 스크립트가 gpt-4o-mini로 채운다.
-- 주소는 로마자 표기(en)를 vi에도 공용 사용.
alter table company_kr_stats add column if not exists i18n jsonb;
