-- 현재 또는 직전 연봉 (VND 원 단위 — salary_min/max와 동일 컨벤션, 폼 입력은 백만 단위 ×1e6).
-- 프로필 "희망 조건" 카드의 희망연봉(min~max) 입력을 이 단일 필드로 교체.
-- 기존 salary_min/max 데이터는 보존 (기업 후보 화면 희망연봉 표시는 그대로).
alter table user_profiles add column if not exists current_salary bigint;
