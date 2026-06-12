-- 커뮤니티 글 A/B 투표 대결. 글 하나에 투표 하나(post_id unique).
-- 엔드포인트는 service_role 클라이언트 + Bearer 토큰으로 user.id를 직접 검증하므로
-- (RLS 우회) 아래 정책은 안전망이고 실제 권한 체크/집계는 핸들러 코드에서 수행한다.
-- votes_a/votes_b는 비정규화 카운터 — poll-vote.js가 1표마다 증가시킨다(1인 1표·변경불가).

create table if not exists community_polls (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references community_posts(id) on delete cascade,
  option_a text not null,
  option_b text not null,
  votes_a int not null default 0,
  votes_b int not null default 0,
  ends_at timestamptz not null,
  created_at timestamptz default now(),
  unique (post_id)
);
create index if not exists idx_community_polls_ends_at on community_polls(ends_at);

create table if not exists community_poll_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid not null references community_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz default now(),
  unique (poll_id, user_id)  -- 1인 1표
);
create index if not exists idx_community_poll_votes_poll on community_poll_votes(poll_id);

alter table community_polls enable row level security;
alter table community_poll_votes enable row level security;

-- 투표 현황은 누구나 조회 가능(비로그인 포함). 쓰기는 service_role(핸들러)만.
create policy "polls_select" on community_polls for select using (true);
create policy "poll_votes_select" on community_poll_votes for select using (true);
create policy "poll_votes_insert" on community_poll_votes for insert with check (auth.uid() = user_id);
