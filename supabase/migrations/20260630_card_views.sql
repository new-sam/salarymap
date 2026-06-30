-- 명함 디자인 잠금해제용 고유 열람 추적(리텐션/바이럴 루프).
-- 기본 템플릿 1개만 무료, 친구가 공개 명함 링크(/c/<token>)를 서로 다른 3명이 열면 전체 디자인 해제.
-- 고유 방문자는 브라우저 쿠키(visitor) 단위로 중복 제거 → 실제로 남에게 보내야 카운트가 오른다.
-- 기록·집계는 service_role(SSR 공개페이지 / API)에서만 수행한다.

alter table business_cards
  add column if not exists designs_unlocked boolean not null default false;

create table if not exists card_views (
  id uuid default gen_random_uuid() primary key,
  card_id uuid not null references business_cards(id) on delete cascade,
  visitor text not null,                 -- 방문자 쿠키 값(브라우저 단위 중복 제거)
  created_at timestamptz default now(),
  unique (card_id, visitor)
);
create index if not exists idx_card_views_card on card_views(card_id);

alter table card_views enable row level security;
-- 정책 없음 = anon 직접 접근 차단. service_role(SSR/API)만 기록·집계(RLS 우회).
