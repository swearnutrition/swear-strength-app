-- Migration: Storage bucket for messaging media files

-- Create the messages storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messages',
  'messages',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- Anyone authenticated can upload to messages bucket
CREATE POLICY "Authenticated users can upload messages media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'messages');

-- Anyone can view messages media (public bucket)
CREATE POLICY "Anyone can view messages media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'messages');

-- Users can delete their own uploads
CREATE POLICY "Users can delete own messages media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1]);
