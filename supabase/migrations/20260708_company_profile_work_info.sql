-- Company Profile: reusable company-level fields so recruiters don't re-enter
-- them on every job posting. Work days/hours were previously hardcoded on the
-- public JD page (Monday–Friday, 9:00 AM–6:00 PM) with no way to edit them.
--
-- recruiter_companies holds the profile defaults; jobs snapshots the resolved
-- values at create/edit time (same pattern as jobs.company) so the public
-- /jobs/[id] page can render them without joining recruiter_companies.

alter table recruiter_companies
  add column if not exists logo_url text,
  add column if not exists work_days text,
  add column if not exists work_hours text;

alter table jobs
  add column if not exists work_days text,
  add column if not exists work_hours text;
