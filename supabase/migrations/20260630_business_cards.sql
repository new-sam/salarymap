-- 디지털 명함 공유(리멤버식). 앱에서 명함(정보+디자인)을 발행하면 공개 링크
-- (salary-fyi.com/c/<token>)가 생기고, 누구나 앱 없이 링크를 열어 보고 연락처(vCard)로 저장한다.
--
-- 유저당 1장: user_id 고유. 명함을 수정해 다시 발행하면 같은 token에 card_data만 갱신 → 링크 불변.
-- card_data = { data: {name,position,company,phone,email,address,photoUrl}, design: {...} } (JSON).
-- 엔드포인트가 service_role + Bearer 토큰으로 user.id를 검증(RLS 우회)하므로 아래 정책은 안전망이고
-- 실제 권한 체크는 핸들러 코드에서 수행한다(user_follows와 동일 패턴).

create table if not exists business_cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  share_token text not null unique,         -- 공개 URL 토큰(예: /c/ab12cd34ef56)
  card_data jsonb not null,                 -- { data, design }
  is_published boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_cards_token on business_cards(share_token);

alter table business_cards enable row level security;
-- 공개된 명함은 누구나 읽기(링크로 보기).
create policy "business_cards_public_select" on business_cards for select using (is_published = true);
-- 본인 카드만 생성/수정/삭제.
create policy "business_cards_owner_all" on business_cards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
