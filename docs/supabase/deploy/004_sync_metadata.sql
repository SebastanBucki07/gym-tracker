-- ============================================================================
-- Gym Tracker — Production Synchronization Metadata Script (004_sync_metadata.sql)
-- STAGE 13C.2.2 — Supabase SQL Finalization & Hardening
-- REVIEW ONLY — NOT EXECUTED AGAINST LIVE DATABASE
-- ============================================================================

-- Helper functions and indexes for synchronization and conflict resolution

-- Function placeholder for future bidirectional sync engine (Stage 13C.5).
-- Currently un-implemented and returns empty set by design.
CREATE OR REPLACE FUNCTION public.get_user_deltas(
    p_user_id UUID,
    p_table_name TEXT,
    p_last_pulled_at TIMESTAMPTZ
)
RETURNS SETOF jsonb AS $$
BEGIN
    -- Pull synchronization is not yet implemented.
    -- This function stub is reserved for Stage 13C.5.
    RAISE EXCEPTION 'Pull synchronization (get_user_deltas) is not implemented yet in Stage 13C.2.2.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_user_deltas(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_deltas(UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;

-- Additional indexes to optimize delta sync queries by updated_at_utc and deleted_at
CREATE INDEX IF NOT EXISTS idx_workouts_sync ON public.workouts(user_id, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_body_measurements_sync ON public.body_measurements(user_id, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_cardio_activities_sync ON public.cardio_activities(user_id, updated_at_utc);
CREATE INDEX IF NOT EXISTS idx_progress_photos_sync ON public.progress_photos(user_id, updated_at_utc);
