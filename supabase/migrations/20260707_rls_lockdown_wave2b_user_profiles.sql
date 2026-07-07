-- Audit 2026-07-07 — RLS lockdown, Wave 2b: user_profiles (own-row only).
--
-- user_profiles holds email, phone, full_name, linkedin — it was fully readable
-- by the public anon key. Every browser read is the caller's OWN row EXCEPT
-- three recruiter reads of applicants' (id, email, full_name), which now go
-- through /api/company/applicant-profiles (service role). So the table can be
-- locked to own-row access for authenticated users; the service_role API routes
-- (/api/profile/talent, parse-resume, applicant-profiles) bypass RLS.
--
-- Apply ONLY after deploying the web changes that (a) route the profile page's
-- own read through /api/profile/talent [already the case] and (b) move the three
-- recruiter reads (ats.js, todo.js, CandidateDetail.js) to the new endpoint.

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='user_profiles'
  loop execute format('drop policy %I on public.user_profiles', p.policyname); end loop;
end $$;

alter table public.user_profiles enable row level security;

create policy user_profiles_select_own on public.user_profiles
  for select to authenticated using (auth.uid() = id);
create policy user_profiles_insert_own on public.user_profiles
  for insert to authenticated with check (auth.uid() = id);
create policy user_profiles_update_own on public.user_profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- No anon policy: logged-out visitors get zero rows. Community author display
-- uses the denormalized author_name / author_avatar on community_posts, not this
-- table, so no public read is needed.
