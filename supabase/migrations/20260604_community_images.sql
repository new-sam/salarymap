-- Image support for community posts (up to 4) and comments (1)
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Public storage bucket for community images
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read; authenticated users may upload/delete only within their own
-- {user_id}/ folder, matching the path produced by lib/communityImages.js.
DROP POLICY IF EXISTS "community_images_read" ON storage.objects;
CREATE POLICY "community_images_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'community-images');

DROP POLICY IF EXISTS "community_images_insert" ON storage.objects;
CREATE POLICY "community_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "community_images_delete" ON storage.objects;
CREATE POLICY "community_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);
