-- Mirror community_posts.author_company on comments.
-- Comments previously had no company column, so the UI always fell back to
-- "무직" (unemployed) for seeded/community comments. This lets a comment carry
-- a declared author company, same as posts do.
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS author_company TEXT;
