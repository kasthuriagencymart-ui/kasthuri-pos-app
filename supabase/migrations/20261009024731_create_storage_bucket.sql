/*
# Create Storage Bucket for Image Uploads

1. Purpose
   Create a public storage bucket 'shop-images' for storing product images and shop logos.
   Authenticated users can upload, read, update, and delete their own files.

2. Storage
   - Bucket: shop-images (public)
   - Path structure: {user_id}/{filename}

3. Security
   - SELECT (read): public — anyone can view product images (needed for receipts, POS display)
   - INSERT/UPDATE/DELETE: authenticated users can manage files in their own folder
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
DROP POLICY IF EXISTS "Public read access for shop images" ON storage.objects;
CREATE POLICY "Public read access for shop images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shop-images');

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Authenticated upload own images" ON storage.objects;
CREATE POLICY "Authenticated upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own files
DROP POLICY IF EXISTS "Authenticated update own images" ON storage.objects;
CREATE POLICY "Authenticated update own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "Authenticated delete own images" ON storage.objects;
CREATE POLICY "Authenticated delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = auth.uid()::text);
