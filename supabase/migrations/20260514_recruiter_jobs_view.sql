-- recruiter_jobs VIEW: jobs + recruiter_companies 조인
-- 2026-05-14

CREATE OR REPLACE VIEW recruiter_jobs AS
SELECT
  j.id,
  j.title,
  j.status,
  j.is_active,
  j.location,
  j.type,
  j.salary_min,
  j.salary_max,
  j.experience_min,
  j.experience_max,
  j.created_at,
  j.deadline,
  j.source,
  j.image_url,
  j.logo_url,
  rc.name AS company_name,
  rc.email_domain AS company_domain,
  rc.tax_id AS company_tax_id,
  rc.verified_at AS company_verified_at,
  rc.created_by AS company_owner_user_id
FROM jobs j
JOIN recruiter_companies rc ON rc.id = j.company_id
ORDER BY j.created_at DESC;
