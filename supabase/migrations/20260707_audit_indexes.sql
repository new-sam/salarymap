-- Audit 2026-07-07: hot-path indexes for the salary/jobs/companies reads.
-- Apply via the Supabase dashboard SQL editor. Plain CREATE INDEX (not
-- CONCURRENTLY) so the whole script runs as one transaction in the editor;
-- index builds take a brief write lock but complete in seconds at this scale.

create extension if not exists pg_trgm;

-- submissions: the hottest table (percentile / company-detail / company / stats),
-- filtered by (role, experience), grouped/looked up by normalized company, and
-- range-scanned by created_at.
create index if not exists idx_submissions_role_exp
  on submissions (role, experience);
create index if not exists idx_submissions_company_lower
  on submissions (lower(trim(company)));
create index if not exists idx_submissions_created_at
  on submissions (created_at desc);
create index if not exists idx_submissions_company_trgm
  on submissions using gin (company gin_trgm_ops);

-- user_profiles.email: track.js looks this up on every analytics event.
create index if not exists idx_user_profiles_email
  on user_profiles (email);

-- companies.name: ilike() lookups in company-detail / company / jobs.
create index if not exists idx_companies_name_trgm
  on companies using gin (name gin_trgm_ops);

-- jobs: default public feed is `where is_active order by created_at desc`.
create index if not exists idx_jobs_active_created
  on jobs (created_at desc) where is_active;
