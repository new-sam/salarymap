-- Audit 2026-07-07 — RLS lockdown, Wave 1 (zero app breakage).
--
-- Live probe with the public anon key showed these tables are fully readable by
-- anyone (the shipped anon key), despite older migrations claiming RLS. Live
-- state has drifted from the migration files (DDL is applied by hand), so each
-- block below DROPs every existing policy on the table and recreates the correct
-- set from scratch.
--
-- These four tables are read by NEITHER the web browser anon client NOR the
-- mobile app directly — all their access goes through service-role API routes,
-- which bypass RLS. So enabling RLS with no public policy is safe here.
--
-- submissions / user_profiles / job_applications are handled in Wave 2 because
-- they DO have direct anon reads (web + mobile) that need coordinated code
-- changes first. Do NOT lock those here.

-- helper: drop all existing policies on a table so we start clean
do $$
declare
  p record;
  t text;
begin
  foreach t in array array['candidates','admin_users','community_posts','community_comments']
  loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- candidates: recruiting PII (email, phone, birthdate, name). Recruiter/admin
-- access is server-side (service role). No anon/authenticated policy = no direct
-- client read. (3,706 rows were world-readable before this.)

-- admin_users: the admin allowlist itself. Never client-readable.
--   (Browser admin checks go through /api/admin/check, which uses service role.)

-- community_posts / community_comments: the web feed and mobile both read these
-- through /api/community/*, so no direct-client policy is needed. This is what
-- stops the anonymous-post de-anonymization (anon could read user_id on
-- is_anonymous = true rows).

-- No policies are created: with RLS enabled and no policy, anon and authenticated
-- get zero rows; the service_role key used by the API bypasses RLS entirely.

-- Sanity note after applying: the community feed, admin dashboard, and recruiter
-- candidate views must still work (they use the service role). If any of them
-- breaks, that call was wrongly using the anon client and should move server-side.
