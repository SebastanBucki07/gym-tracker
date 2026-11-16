-- ============================================================================
-- Gym Tracker — Hardened PostgreSQL Schema (Review Only)
-- STAGE 13A.1 — Supabase Schema & Security Hardening
-- REVIEW ONLY — NOT EXECUTED AGAINST LIVE DATABASE
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function for automated updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 1. Profiles Table (Extends Supabase Auth users)
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL CHECK (char_length(username) >= 2 AND char_length(username) <= 50),
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Secure trigger function to automatically provision a profile on auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 2. App Settings Table
-- ============================================================================
CREATE TABLE public.app_settings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
    weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
    measurement_unit TEXT NOT NULL DEFAULT 'cm' CHECK (measurement_unit in ('cm', 'in')),
    distance_unit TEXT NOT NULL DEFAULT 'km' CHECK (distance_unit IN ('km', 'mi')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

CREATE TRIGGER set_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 3. Shared System Catalogs
-- ============================================================================
CREATE TABLE public.muscle_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.equipment_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cardio_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- 4. Exercises Catalog (System + User Custom)
-- ============================================================================
CREATE TABLE public.exercises (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) >= 1),
    description TEXT,
    primary_muscle_group_id TEXT NOT NULL REFERENCES public.muscle_groups(id),
    secondary_muscle_group_ids TEXT[] DEFAULT '{}',
    equipment_category_id TEXT NOT NULL REFERENCES public.equipment_categories(id),
    image_url TEXT,
    video_url TEXT,
    source TEXT NOT NULL CHECK (source IN ('system', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce system exercises have no user_id, and user exercises must have user_id
    CONSTRAINT check_exercise_source CHECK (
        (source = 'system' AND user_id IS NULL) OR
        (source = 'user' AND user_id IS NOT NULL)
    )
);

CREATE TRIGGER set_exercises_updated_at
    BEFORE UPDATE ON public.exercises
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. Workouts & Sets
-- ============================================================================
CREATE TABLE public.workouts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Synchronization metadata
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_workouts_updated_at
    BEFORE UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.workout_sets (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    exercise_name TEXT,
    primary_muscle_group_id TEXT,
    set_number INTEGER NOT NULL CHECK (set_number > 0),
    weight NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
    repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- 6. Workout Plans
-- ============================================================================
CREATE TABLE public.workout_plans (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    exercises JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(exercises) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_workout_plans_updated_at
    BEFORE UPDATE ON public.workout_plans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. Measurement Types & Body Measurements
-- ============================================================================
CREATE TABLE public.measurement_types (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_measurement_type_source CHECK (
        (is_system = TRUE AND user_id IS NULL) OR
        (is_system = FALSE AND user_id IS NOT NULL)
    )
);

CREATE TABLE public.body_measurements (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    measurement_type_id TEXT NOT NULL,
    value NUMERIC(10,2) NOT NULL CHECK (value >= 0),
    measured_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced',
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_body_measurements_updated_at
    BEFORE UPDATE ON public.body_measurements
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 8. Cardio Activities
-- ============================================================================
CREATE TABLE public.cardio_activities (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cardio_type_id TEXT NOT NULL REFERENCES public.cardio_types(id),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    distance_km NUMERIC(10,2) CHECK (distance_km IS NULL OR distance_km >= 0),
    calories INTEGER CHECK (calories IS NULL OR calories >= 0),
    average_heart_rate INTEGER CHECK (average_heart_rate IS NULL OR (average_heart_rate >= 30 AND average_heart_rate <= 250)),
    performed_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced',
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_cardio_activities_updated_at
    BEFORE UPDATE ON public.cardio_activities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 9. Daily Steps
-- ============================================================================
CREATE TABLE public.daily_steps (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps_count INTEGER NOT NULL DEFAULT 0 CHECK (steps_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_daily_steps UNIQUE (user_id, date)
);

CREATE TRIGGER set_daily_steps_updated_at
    BEFORE UPDATE ON public.daily_steps
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 10. Progress Photos Metadata
-- ============================================================================
CREATE TABLE public.progress_photos (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    taken_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced',
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_progress_photos_updated_at
    BEFORE UPDATE ON public.progress_photos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Indexes for Performance & Synchronization
-- ============================================================================
CREATE INDEX idx_workouts_user_id ON public.workouts(user_id);
CREATE INDEX idx_workouts_started_at ON public.workouts(started_at);
CREATE INDEX idx_body_measurements_user_id ON public.body_measurements(user_id);
CREATE INDEX idx_cardio_activities_user_id ON public.cardio_activities(user_id);
CREATE INDEX idx_daily_steps_user_date ON public.daily_steps(user_id, date);
CREATE INDEX idx_progress_photos_user_id ON public.progress_photos(user_id);
CREATE INDEX idx_exercises_user_id ON public.exercises(user_id);
