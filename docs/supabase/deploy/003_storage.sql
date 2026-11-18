-- ============================================================================
-- Gym Tracker — Production Storage Deployment Script (003_storage.sql)
-- STAGE 13C.2 — Supabase Cloud Schema Deployment Preparation
-- BUCKET: progress-photos (Private)
-- REVIEW ONLY — NOT EXECUTED AGAINST LIVE DATABASE
-- ============================================================================

-- 1. SELECT: Users can only read their own progress photos
CREATE POLICY "Users can read own progress photos in storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'progress-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. INSERT: Users can only upload progress photos into their own folder ({auth.uid()}/...)
CREATE POLICY "Users can upload own progress photos to storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'progress-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. UPDATE: Users can only update their own progress photos
CREATE POLICY "Users can update own progress photos in storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'progress-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'progress-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. DELETE: Users can only delete their own progress photos
CREATE POLICY "Users can delete own progress photos from storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'progress-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
