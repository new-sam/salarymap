-- 어학 콜드메일 응답 원본 보관 테이블
--
-- 왜 필요한가 — 2026-08-05 사고
--   어학 콜드메일로 받은 값은 user_profiles.english_cert / korean_cert 에만 있었고,
--   events.coldmail_lang_fill 은 "저장했다"는 사실만 남기고 값은 안 남겼다.
--   그래서 대시보드가 매번 프로필을 다시 읽었는데, 이력서 재파싱(백필)이 프로필을
--   덮으면서 과거 목록까지 소급해 바뀌었다. 확인된 손실만 21명(점수 7 + 빈값 14),
--   원문이 남지 않아 대부분 복구가 불가능했다.
--
--   이 표는 그 시점의 값을 그대로 박아두는 append-only 로그다. 나중에 무엇이 프로필을
--   덮어도 이 기록은 변하지 않으므로, 대시보드가 여기서 읽으면 과거가 흔들리지 않고
--   같은 사고가 나도 원문에서 복구할 수 있다.
--
-- 한 번 저장할 때마다 한 행. 같은 사람이 두 번 저장하면 두 행이 남는다 —
-- 값이 어떻게 바뀌었는지도 기록으로 남기려는 것이다. '전환' 을 셀 때는 user_id 별
-- 가장 이른 행을 쓴다(기존 대시보드가 첫 저장 기준으로 세는 것과 같다).

create table if not exists public.coldmail_lang_responses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(id) on delete cascade,
  campaign    text not null,              -- coldmail-language-1 / coldmail-lang-ghost-1 …
  cta         text,                       -- score | daily | basic | none (메일에서 누른 버튼)
  english_cert text,                      -- 저장 시점 값 그대로. 빈 값이면 null
  korean_cert  text,
  source      text not null default 'lang',  -- 'lang' = /lang 랜딩, 'backfill' = 소급 기록
  created_at  timestamptz not null default now()
);

create index if not exists coldmail_lang_responses_user_idx
  on public.coldmail_lang_responses (user_id);
create index if not exists coldmail_lang_responses_campaign_idx
  on public.coldmail_lang_responses (campaign, created_at);

-- 서비스 롤로만 읽고 쓴다. 정책을 만들지 않으므로 anon/authenticated 는 접근할 수 없다
-- (events 와 달리 여기엔 개인이 입력한 원문이 들어가므로 클라이언트에 열지 않는다).
alter table public.coldmail_lang_responses enable row level security;

comment on table public.coldmail_lang_responses is
  '어학 콜드메일 응답 원본. user_profiles 가 덮여도 변하지 않는 append-only 기록.';
