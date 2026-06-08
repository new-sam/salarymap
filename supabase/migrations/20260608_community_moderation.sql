-- 커뮤니티 신고·차단. 모바일(salary-fyi) reportContent/blockUser 계약에 대응.
-- 엔드포인트는 service_role 클라이언트 + Bearer 토큰으로 user.id를 직접 검증하므로
-- (RLS 우회) 아래 정책은 안전망이고 실제 권한 체크는 핸들러 코드에서 수행한다.

-- 사용자 차단: blocker가 blocked의 글/댓글을 더 이상 보지 않음
create table if not exists community_blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists idx_community_blocks_blocker on community_blocks(blocker_id);

alter table community_blocks enable row level security;
create policy "blocks_select" on community_blocks for select using (auth.uid() = blocker_id);
create policy "blocks_insert" on community_blocks for insert with check (auth.uid() = blocker_id);
create policy "blocks_delete" on community_blocks for delete using (auth.uid() = blocker_id);

-- 신고: 글/댓글 신고 누적(운영자 검토용). 일반 사용자는 SELECT 불가(service_role만).
create table if not exists community_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','abuse','sexual','falseInfo','other')),
  created_at timestamptz default now(),
  unique (reporter_id, target_type, target_id)  -- 같은 대상 중복 신고 방지
);
create index if not exists idx_community_reports_target on community_reports(target_type, target_id);

alter table community_reports enable row level security;
create policy "reports_insert" on community_reports for insert with check (auth.uid() = reporter_id);
-- SELECT 정책 없음 → 일반 클라이언트는 조회 불가. 운영자는 service_role로 조회.
