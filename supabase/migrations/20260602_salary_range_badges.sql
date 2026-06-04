-- Salary-range badges
-- Extends user_badges to support a verified salary-range badge whose tier is
-- derived (in app code) from the stored salary_amount.

-- 1) Store the admin-verified salary amount (won) on the badge.
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS salary_amount BIGINT;

-- 2) Allow the new 'salary_range' badge type.
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_badge_type_check;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_badge_type_check
  CHECK (badge_type IN ('salary_range', 'high_salary', 'verified_company', 'top_contributor'));

-- 3) Migrate existing legacy high_salary badges to salary_range, backfilling the
--    amount from the user's latest approved verification.
UPDATE user_badges b
SET badge_type = 'salary_range',
    salary_amount = sub.salary_amount
FROM (
  SELECT DISTINCT ON (user_id) user_id, salary_amount
  FROM salary_verifications
  WHERE status = 'approved'
  ORDER BY user_id, reviewed_at DESC NULLS LAST
) sub
WHERE b.badge_type = 'high_salary' AND b.user_id = sub.user_id;

-- Any remaining legacy rows with no matching verification: still rename so the
-- type is consistent (amount stays NULL -> renders as lowest tier).
UPDATE user_badges SET badge_type = 'salary_range' WHERE badge_type = 'high_salary';

-- 4) Index for the community read-time join (active salary badges by user).
CREATE INDEX IF NOT EXISTS idx_user_badges_active_salary
  ON user_badges(user_id) WHERE badge_type = 'salary_range' AND is_active = true;
