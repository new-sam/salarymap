-- 좋아요 카운트 증감을 원자적으로. 기존 코드는 like_count를 read-modify-write(읽고 +1해서 update)라
-- 동시 좋아요 시 증가분이 유실되어 like_count가 실제 좋아요 행 수와 어긋난다. 단일 UPDATE 식으로 못박는다.
-- ⚠️ 이 프로젝트는 마이그레이션 수동 적용 환경(db push 금지) — 대시보드 SQL 에디터에서 먼저 실행한 뒤 코드 배포.
create or replace function community_bump_like_count(p_table text, p_id uuid, p_delta int)
returns void
language plpgsql
security definer
as $$
begin
  if p_table = 'community_posts' then
    update community_posts set like_count = greatest(0, coalesce(like_count, 0) + p_delta) where id = p_id;
  elsif p_table = 'community_comments' then
    update community_comments set like_count = greatest(0, coalesce(like_count, 0) + p_delta) where id = p_id;
  else
    raise exception 'invalid table %', p_table;
  end if;
end;
$$;
