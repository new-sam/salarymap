-- Audit 2026-07-07 — RLS lockdown, Wave 2a: submissions (PII columns only).
--
-- Product decision: individual salary rows stay publicly readable (this powers
-- the mobile company-salary page, which reads role/experience/salary directly
-- with the anon key). Only PII / sensitive columns are hidden from the public.
--
-- Apply this ONLY after deploying the web change that moves the profile page's
-- own-submission read to /api/my-submissions (service role). Before that deploy,
-- the profile page reads submissions.* directly with the anon client and would
-- break on the revoked columns.
--
-- Mechanism: RLS (USING true) keeps every row visible; column GRANTs restrict
-- WHICH columns anon/authenticated may read. Email and the claim token are the
-- sensitive fields; utm_* and user_id have no reason to be public. The
-- service_role key (all API routes) bypasses both layers and keeps full access.

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='submissions'
  loop execute format('drop policy %I on public.submissions', p.policyname); end loop;
end $$;

alter table public.submissions enable row level security;

-- Rows: all visible (the public salary feature). Columns are gated by GRANT below.
create policy submissions_public_read on public.submissions
  for select to anon, authenticated using (true);

-- Columns: hand out only the non-sensitive salary fields; revoke the rest.
revoke select on public.submissions from anon, authenticated;
grant select (
  id, role, experience, salary, company, source, created_at,
  rating_worklife, rating_salary, rating_growth, is_seed, intent
) on public.submissions to anon, authenticated;

-- Deliberately NOT granted to anon/authenticated (service role only):
--   email, user_id, claim_token_hash, utm_source, utm_medium, utm_campaign, utm_content
