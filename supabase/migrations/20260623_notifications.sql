-- 인앱 알림함. 푸시(lib/push.js)는 놓치면 다시 못 보므로, 같은 시점에 알림 row도 쌓아
-- 모바일(salary-fyi) 홈 우측 상단 종 아이콘 → 알림 목록에서 모아 본다.
-- 댓글/좋아요/팔로우 발생 시 sendPush 옆에서 createNotification(lib/notify.js)으로 적재한다.
-- announcement(공지) 타입은 스키마/렌더링 자리만 잡아둔다(생성 경로는 이번 범위 밖).
--
-- 익명성: 푸시와 동일하게 행위자 신원은 actor_name으로 미리 결정해 저장한다
-- (좋아요/팔로우 = null → 클라가 "누군가", 댓글 = 익명이면 null, 실명글이면 실명).
-- 탭 딥링크는 data(jsonb)에 푸시와 동일한 payload({url} | {user})를 담아 재사용한다.
--
-- API(pages/api/notifications/*)는 service_role + Bearer 토큰으로 user.id를 검증(RLS 우회)하므로
-- 아래 정책은 anon 키 직접 접근을 막는 안전망이고 실제 권한 체크는 핸들러에서 한다.

create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,  -- 수신자
  actor_id   uuid references auth.users(id) on delete cascade,           -- 행위자(공지는 null)
  actor_name text,                          -- 표시용 이름(익명/시스템이면 null → 클라가 "누군가")
  type       text not null,                 -- 'comment' | 'like' | 'follow' | 'announcement'
  post_id    uuid,                          -- 관련 글(참고용)
  comment_id uuid,                          -- 관련 댓글(참고용)
  body       text,                          -- 미리보기(댓글 스니펫 등). 좋아요/팔로우는 null
  data       jsonb not null default '{}',   -- 탭 딥링크 payload(푸시와 동일)
  read_at    timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on notifications(user_id) where read_at is null;

alter table notifications enable row level security;
create policy "notifications_select_own" on notifications for select using (auth.uid() = user_id);
