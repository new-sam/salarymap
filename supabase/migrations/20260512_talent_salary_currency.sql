-- Add salary_currency to user_profiles for talent pool
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'VND';
