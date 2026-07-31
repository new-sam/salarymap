-- 이력서 공개 전환(is_resume_public) 계측.
-- 지금까지 공개 ON/OFF에는 이벤트가 없어서 "언제 몇 명이 공개로 바뀌었는지"를 셀 수 없었다.
-- 프로필 스냅샷을 updated_at으로 버킷팅하는 건 '오늘 공개함'이 아니라 '오늘 프로필을 수정함'이다.
-- 웹 API(share-resume) · 앱(Supabase 직접 write) · 콜드메일 원클릭(go-public)이 각각 다른 경로로
-- 같은 컬럼을 바꾸므로, 전 경로를 한 번에 잡으려면 DB 트리거가 유일한 지점이다.
-- ⚠️ 수동 적용: Supabase 대시보드 SQL 에디터에서 실행 (db push 금지 — 히스토리 미동기)

create or replace function log_resume_public_change()
returns trigger
language plpgsql
security definer -- 앱은 유저 JWT로 직접 update 하므로 정의자 권한이어야 events에 쓸 수 있다
set search_path = public
as $$
begin
  insert into events (event, page, meta, user_id)
  values (
    case when new.is_resume_public then 'resume_public_on' else 'resume_public_off' end,
    'db_trigger',
    jsonb_build_object('platform', new.resume_platform, 'has_resume', new.resume_url is not null),
    new.id
  );
  return new;
end;
$$;

drop trigger if exists trg_resume_public_change on user_profiles;
create trigger trg_resume_public_change
after update of is_resume_public on user_profiles
for each row
when (old.is_resume_public is distinct from new.is_resume_public)
execute function log_resume_public_change();
