-- ─────────────────────────────────────────────────────────────────────────────
-- 퍼널 식별 스티칭 — ev.user_key 를 client_id 우선으로.
-- 문제: 가입(sign_up)은 서버 OAuth 콜백에서 user_id 만 실려 발화되고, 그 앞 단계
--       (홈 랜딩·위저드·게이트)는 로그아웃 상태라 client_id 로만 잡힌다. 기존 키
--       coalesce(user_id, client_id) 는 가입을 user_id 로, 앞 단계를 client_id 로 잡아
--       순차 퍼널이 로그인 경계를 못 넘고 마지막 단계가 0 이 됐다.
-- 해결: client_id 는 localStorage(sm_cid)라 로그인 넘어도 유지되는 안정 키 → 우선한다.
--       + 콜백이 sm_cid 쿠키로 client_id 를 실어(코드 배포) 신규 가입은 네이티브로 이어짐.
--       + 기존 sign_up 행은 별도 백필 스크립트로 client_id 소급(다리 이벤트 역추적).
-- ⚠ 트레이드오프: 멀티기기 유저는 client_id 별로 분리 카운트(웹은 대부분 단일 브라우저라 무시 가능).
-- ⚠ 수동 적용: Supabase 대시보드 SQL 에디터에 전체 붙여넣기 (db push 금지 환경).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.ev with (security_invoker = on) as
select
  e.created_at                              as ts,
  e.event::text                             as event_name,
  coalesce(e.client_id, e.user_id::text)    as user_key,
  coalesce(e.meta, '{}'::jsonb)
    || jsonb_build_object('page', e.page)   as props
from public.events e;

-- user_key 식과 글자까지 동일해야 플래너가 인덱스를 탄다 (퍼널 상관 서브쿼리 전용).
-- 기존 idx_events_userkey_event_ts 는 이제 안 쓰이지만 무해하므로 남겨둔다.
create index if not exists idx_events_clientkey_event_ts
  on public.events ((coalesce(client_id, user_id::text)), event, created_at);
