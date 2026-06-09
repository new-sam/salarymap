-- 운영자 처리 완료 표시. admin '신고/피드백' 탭에서 토글한다.
-- (신고는 삭제/무시로 행을 제거해 큐를 비우므로 별도 상태가 없고, 피드백만 보관+처리표시.)
alter table app_feedback add column if not exists handled boolean not null default false;
