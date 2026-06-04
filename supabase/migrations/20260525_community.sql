-- Community Posts
CREATE TABLE community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  author_avatar TEXT,
  category TEXT NOT NULL CHECK (category IN ('ask_company', 'daily', 'job_change')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  is_salary_verified BOOLEAN DEFAULT false,
  author_company TEXT,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Community Comments
CREATE TABLE community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  like_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Community Likes
CREATE TABLE community_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_community_posts_category ON community_posts(category);
CREATE INDEX idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_community_comments_post ON community_comments(post_id);
CREATE INDEX idx_community_likes_user ON community_likes(user_id);

-- RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

-- Posts: anyone can read, authenticated can insert, own posts can update/delete
CREATE POLICY "posts_select" ON community_posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON community_posts FOR DELETE USING (auth.uid() = user_id);

-- Comments: same pattern
CREATE POLICY "comments_select" ON community_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON community_comments FOR DELETE USING (auth.uid() = user_id);

-- Likes: same pattern
CREATE POLICY "likes_select" ON community_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON community_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON community_likes FOR DELETE USING (auth.uid() = user_id);

-- If table already exists, run this instead:
-- ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_salary_verified BOOLEAN DEFAULT false;
