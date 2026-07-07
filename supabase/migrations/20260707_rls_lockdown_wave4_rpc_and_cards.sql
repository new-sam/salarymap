-- Audit 2026-07-07 — RLS lockdown, Wave 4: admin analytics RPCs + business_cards.
--
-- Two leaks the earlier waves did not cover.
--
-- (1) admin_event_daily / admin_utm_pageviews are SECURITY DEFINER functions.
--     Postgres grants EXECUTE to PUBLIC by default, so the earlier
--     `grant ... to service_role` was additive, not restrictive: a live anon
--     probe executed both and got back the full marketing funnel (event counts,
--     UTM source/campaign/content breakdowns). SECURITY DEFINER means they run
--     as the owner and bypass the now-locked `events` table RLS entirely.
--     Fix: revoke EXECUTE from PUBLIC/anon/authenticated; leave service_role
--     (the admin dashboard API routes) with access.
--
-- (2) business_cards was fully readable by the anon key: anyone could list every
--     published card's contact block (name, email, phone, address, position)
--     without knowing its share token. All real access is server-side —
--     /c/<token> (getServerSideProps, service role), /api/cards/* (service role
--     + Bearer), mobile via /api/cards — so no client reads it with the anon key.
--     Fix: enable RLS with no public policy; service_role bypasses it.

-- (1) admin analytics RPCs — service_role only.
revoke execute on function public.admin_event_daily(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_utm_pageviews(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_event_daily(timestamptz, timestamptz) to service_role;
grant execute on function public.admin_utm_pageviews(timestamptz, timestamptz) to service_role;

-- (2) business_cards — lock to service-role access only.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='business_cards'
  loop execute format('drop policy %I on public.business_cards', p.policyname); end loop;
end $$;

alter table public.business_cards enable row level security;
-- No policy created: anon/authenticated get zero rows; the service_role key used
-- by /c/[token] and /api/cards/* bypasses RLS and retains full access.

-- Sanity note after applying: a shared card link (/c/<token>) must still render,
-- the app's "my card" screen must still load, and an anon probe of
-- business_cards must return zero rows. The admin dashboard's traffic/UTM
-- charts (service role) must still populate.
