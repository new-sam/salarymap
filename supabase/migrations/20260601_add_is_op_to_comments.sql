-- Add is_op (original-poster) flag to community comments.
-- A comment is "op" when its author is the same user who wrote the post,
-- so the UI can show an "Author" badge on the poster's own replies.
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS is_op BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN community_comments.is_op IS 'True when the comment author is the post author (original poster).';

-- Backfill: flag genuine OP self-replies in existing (seed) data.
-- Match only non-anonymous comments whose author name equals the non-anonymous
-- post author name. This avoids false positives from anonymized/masked names
-- (e.g. real anonymous posts) and from seed rows reassigned to one system account.
UPDATE community_comments c
SET is_op = true
FROM community_posts p
WHERE c.post_id = p.id
  AND c.is_anonymous = false
  AND p.is_anonymous = false
  AND c.author_name IS NOT NULL
  AND p.author_name IS NOT NULL
  AND c.author_name = p.author_name;
