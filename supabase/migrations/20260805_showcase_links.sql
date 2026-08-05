-- 비공개 인재 전시장(/private/showcasing) 기업별 링크.
--
-- 토큰 자체는 무상태 HMAC 이라 이 표가 없어도 링크는 동작한다. 표를 두는 이유는 딱 둘이다.
--   1) 아직 아무도 안 연 링크는 events 에 흔적이 없어서, 이벤트만으로는 "누구에게 보냈나"를
--      영영 알 수 없다. 발송했는데 반응이 없는 기업이야말로 봐야 할 목록인데 그게 안 보인다.
--   2) 추적을 끝낼 방법이 필요하다. 서명만으로는 회수가 안 되므로, 행을 지우는 것이
--      곧 "이 링크는 이제 안 센다"가 된다.
--
-- token 이 PK 인 건 기업명+캠페인에서 결정적으로 나오는 값이라서다 — 같은 기업을 두 번
-- 만들어도 같은 행이고, 그래서 중복 발급이라는 상태가 아예 생기지 않는다.

create table if not exists public.showcase_links (
  token text primary key,
  company text not null,
  campaign text not null default 'showcase1',
  created_at timestamptz not null default now()
);

create index if not exists showcase_links_company_idx on public.showcase_links (company);

alter table public.showcase_links enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가, service_role 만 사용
