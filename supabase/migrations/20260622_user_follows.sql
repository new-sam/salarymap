-- 유저 팔로우. 사용자가 다른 사용자(공개 프로필)를 팔로우하면 그 사람의 새 공개글이
-- 피드에 모이고, 팔로우 시 상대에게 푸시 알림이 간다. company_follows와 동일하게
-- 엔드포인트가 service_role + Bearer 토큰으로 user.id를 검증하므로(RLS 우회)
-- 아래 정책은 안전망이고 실제 권한 체크는 핸들러 코드에서 수행한다.
--
-- 익명성: 팔로우/팔로잉 "수"는 누구나 볼 수 있으나, "누가 팔로우/내가 누굴 팔로우"
-- 목록은 핸들러에서 프로필 주인 본인에게만 반환한다(익명 커뮤니티 문화 배려).

create table if not exists user_follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid not null references auth.users(id) on delete cascade,   -- 팔로우 거는 사람
  following_id uuid not null references auth.users(id) on delete cascade,  -- 팔로우 당하는 사람
  created_at timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)   -- 자기 자신 팔로우 금지
);
create index if not exists idx_user_follows_follower on user_follows(follower_id);
create index if not exists idx_user_follows_following on user_follows(following_id);

alter table user_follows enable row level security;
create policy "user_follows_select" on user_follows for select using (auth.uid() = follower_id);
create policy "user_follows_insert" on user_follows for insert with check (auth.uid() = follower_id);
create policy "user_follows_delete" on user_follows for delete using (auth.uid() = follower_id);
