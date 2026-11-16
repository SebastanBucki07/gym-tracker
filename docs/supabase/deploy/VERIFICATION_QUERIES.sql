-- ============================================================================
-- Gym Tracker — Supabase Verification Queries (VERIFICATION_QUERIES.sql)
-- STAGE 13C.2 — Supabase Cloud Schema Deployment Preparation
-- REVIEW ONLY — NOT EXECUTED AGAINST LIVE DATABASE
-- ============================================================================

-- 1. Verify all 14 tables exist in public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 3. Verify active RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 4. Verify storage bucket and policies
SELECT * 
FROM storage.buckets 
WHERE id = 'progress-photos';

SELECT policyname, tablename, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';
