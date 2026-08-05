-- 비공개 인재 전시장(/private/showcasing)의 전환 지점 — 검색 한 건과 거기서 나온 상담 문의.
--
-- 이 표 둘이 생기면서 "JD 를 저장하지 않는다"는 원칙이 한 걸음 물러난다. 어디까지
-- 물러났는지 적어 둔다: 저장하는 것은 우리 도구가 만든 요건 문장(criteria)과 실제로
-- 보여준 5명이고, 고객사가 붙여넣은 JD 원문은 여전히 어디에도 남기지 않는다.
-- 남의 채용 문서를 통째로 쌓는 것과 우리 출력물을 남기는 것은 다르다.
--
-- 그리고 문의로 이어지지 않은 검색은 30일 뒤 지운다(purge_showcase_searches).
-- 보관의 근거는 "고객사가 우리에게 연락했다"이지 "우리 화면을 열었다"가 아니다.

/* 검색 한 건.
   picks 의 순서가 곧 화면의 카드 번호(#1~#5)다. 문의는 후보 id 가 아니라 이 배열의
   인덱스로 사람을 지목하고, 그래서 user_profiles.id 는 브라우저로 한 번도 나가지 않는다.

   picks 가 uuid[] 가 아니라 text[] 인 건 user_profiles 가 이 마이그레이션 폴더 밖에서
   만들어져 id 타입을 여기서 단정할 수 없기 때문이다. 코드도 id 를 불투명 문자열로만
   다룬다. FK 도 걸지 않는다 — 후보가 탈퇴했다고 고객사의 문의 기록이 사라지면 안 된다. */
create table if not exists public.showcase_searches (
  id         uuid primary key default gen_random_uuid(),
  token      text,            -- showcase_links.token. 토큰 없이 열었으면 null
  company    text,            -- 토큰에서 푼 기업명(서버가 서명을 확인한 값)
  criteria   jsonb not null,  -- jd-criteria 출력. JD 원문은 없다.
  picks      text[] not null, -- user_profiles.id, 화면에 뿌린 순서 그대로
  pool       int,
  screened   int,
  passed     int,
  created_at timestamptz not null default now()
);
create index if not exists showcase_searches_created_idx on public.showcase_searches (created_at);

/* 상담 문의 = 이 화면이 존재하는 이유.
   search_id 가 on delete restrict 인 건 위의 보관 규칙을 DB 가 대신 지키게 하려는 것이다.
   30일 청소 쿼리의 where 절이 언젠가 틀리더라도, 문의가 붙은 검색은 삭제가 실패한다 —
   고객사가 실제로 연락한 기록만은 코드 실수로 사라지지 않는다. */
create table if not exists public.showcase_inquiries (
  id           uuid primary key default gen_random_uuid(),
  search_id    uuid not null references public.showcase_searches(id) on delete restrict,
  picked       int[] not null,  -- 카드 인덱스. 실제 후보는 searches.picks[i]
  contact_name text not null,
  company      text not null,
  email        text,
  phone        text,            -- 전화 또는 카톡 ID — 사람이 적는 칸이라 형식을 강제하지 않는다
  when_pref    text,
  memo         text,
  status       text not null default 'new',  -- new | contacted | met | closed
  created_at   timestamptz not null default now()
);
create index if not exists showcase_inquiries_created_idx on public.showcase_inquiries (created_at desc);
create index if not exists showcase_inquiries_search_idx on public.showcase_inquiries (search_id);

/* 30일 청소. 크론을 새로 만들지 않고 검색이 일어날 때마다 부른다 —
   청소가 필요해지는 시점이 정확히 검색이 쌓이는 시점이고, 한 번 실패해도 다음 검색이
   다시 시도한다. not exists 는 PostgREST 로 표현할 수 없어서 함수로 둔다. */
create or replace function public.purge_showcase_searches()
returns int
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.showcase_searches s
     where s.created_at < now() - interval '30 days'
       and not exists (select 1 from public.showcase_inquiries i where i.search_id = s.id)
    returning 1
  )
  select coalesce(count(*), 0)::int from gone;
$$;

revoke all on function public.purge_showcase_searches() from public;
revoke all on function public.purge_showcase_searches() from anon, authenticated;

alter table public.showcase_searches  enable row level security;
alter table public.showcase_inquiries enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가, service_role 만 사용 (showcase_links 와 같다)
