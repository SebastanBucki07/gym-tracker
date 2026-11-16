-- ============================================================================
-- Gym Tracker — Production Synchronization Metadata Script (004_sync_metadata.sql)
-- STAGE 13C.2 — Supabase Cloud Schema Deployment Preparation
-- REVIEW ONLY — NOT EXECUTED AGAINST LIVE DATABASE
-- ============================================================================

-- Helper functions and indexes for synchronization and conflict resolution

-- Function to safely fetch records updated since a given timestamp (delta sync pull)
CREATE OR REPLACE FUNCTION public.get_user_deltas(
    p_user_id UUID,
    p_table_name TEXT,
    p_last_pulled_at TIMESTAMPTZ
)
RETURNS SETOF jsonb AS $$
BEGIN
    -- Dynamic delta retrieval can be implemented here or handled via PostgREST queries directly.
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Additional indexes to optimize delta sync queries by updated_at_utc and deleted_at
CREATE INDEX IF NOT EXISTS idx_workouts_sync ON public.workouts(user_id, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_body_measurements_sync ON public.body_measurements(user_id, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_cardio_activities_sync ON public.cardio_activities(user_id, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_progress_photos_sync ON public.progress_photos(user_id, updated_at_utc);
