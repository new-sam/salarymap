-- 회사 카드(연봉 집계) 사전계산 캐시.
-- /api/companies 기본 뷰(role/experience 필터 없음 = 모바일·홈)는 매 콜드 요청마다
-- 전체 회사 + 전체 제보 집계를 돌려 ~3초가 걸린다. 그 결과 JSON을 통째로 한 행에 저장해두고
-- 엔드포인트가 1행만 읽어 응답하도록 한다. cron(/api/cron/refresh-company-cards)이 주기적으로 갱신.
create table if not exists company_cards_cache (
  id smallint primary key default 1,
  cards jsonb not null,
  updated_at timestamptz not null default now(),
  constraint company_cards_cache_singleton check (id = 1)
);

-- 서비스 롤(서버)만 접근. anon/authenticated에는 RLS로 막아둔다(엔드포인트가 service_role로 읽음).
alter table company_cards_cache enable row level security;
