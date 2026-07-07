-- Audit 2026-07-07 — RLS lockdown, Wave 3: job_applications.
--
-- Live probe with the public anon key showed all 1,409 rows fully readable
-- (applicant_email, applicant_name, applicant_salary, resume_url, interview
-- and rejection notes). Root cause: 20260514_job_applications_company_rls.sql
-- created the recruiter policies but never ran ENABLE ROW LEVEL SECURITY, so
-- the policies were inert and the table stayed wide open.
--
-- Client access today:
--   - Recruiter pages (company/ats, todo, calendar, index, jobs/new,
--     CandidateDetail) read/update directly with the authenticated client,
--     always scoped to their own company's jobs → covered by the two policies.
--   - Applicant-facing reads (/api/my-applications) and inserts
--     (/api/job-applications) go through service-role API routes → bypass RLS.
--   - The mobile app does not touch this table.
--   - No anon policy: logged-out clients get zero rows.

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='job_applications'
  loop execute format('drop policy %I on public.job_applications', p.policyname); end loop;
end $$;

alter table public.job_applications enable row level security;

-- Same shape as the 20260514 policies (recruiter of the job's company),
-- tightened to the authenticated role.
create policy job_applications_recruiter_select on public.job_applications
  for select to authenticated
  using (
    job_id in (
      select id from public.jobs where company_id in (
        select company_id from public.recruiter_users where user_id = auth.uid()
      )
    )
  );

create policy job_applications_recruiter_update on public.job_applications
  for update to authenticated
  using (
    job_id in (
      select id from public.jobs where company_id in (
        select company_id from public.recruiter_users where user_id = auth.uid()
      )
    )
  )
  with check (
    job_id in (
      select id from public.jobs where company_id in (
        select company_id from public.recruiter_users where user_id = auth.uid()
      )
    )
  );

-- Sanity note after applying: recruiter ATS (list, candidate detail, status
-- updates, calendar) must still work for a logged-in recruiter, and a
-- logged-out probe of job_applications must return zero rows.
