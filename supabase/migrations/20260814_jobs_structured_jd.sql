-- 공고 본문 구조화: description(포지션 소개)과 별도로
-- 주요업무/자격요건/우대사항 전용 컬럼 (textarea 한 줄당 한 항목, 렌더 시 불릿 리스트)
alter table jobs
  add column if not exists responsibilities text,
  add column if not exists requirements text,
  add column if not exists preferred text;
