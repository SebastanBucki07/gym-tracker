-- ============================================================================
-- Gym Tracker — Proposed PostgreSQL Schema (Review Only)
-- This file is a review-only proposal for Supabase PostgreSQL integration.
-- Do not execute directly against a live production database without review.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (extends Supabase Auth users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. App Settings Table
CREATE TABLE public.app_settings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'dark',
    weight_unit TEXT NOT NULL DEFAULT 'kg',
    measurement_unit TEXT NOT NULL DEFAULT 'cm',
    distance_unit TEXT NOT NULL DEFAULT 'km',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Muscle Groups Catalog (Shared / System)
CREATE TABLE public.muscle_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Equipment Categories Catalog (Shared / System)
CREATE TABLE public.equipment_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Exercises Catalog (System + User Custom)
CREATE TABLE public.exercises (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL if system exercise
    name TEXT NOT NULL,
    description TEXT,
    primary_muscle_group_id TEXT NOT NULL REFERENCES public.muscle_groups(id),
    secondary_muscle_group_ids TEXT[] DEFAULT '{}',
    equipment_category_id TEXT NOT NULL REFERENCES public.equipment_categories(id),
    image_url TEXT,
    video_url TEXT,
    source TEXT NOT NULL CHECK (source IN ('system', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Workouts
CREATE TABLE public.workouts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. Workout Sets
CREATE TABLE public.workout_sets (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    exercise_name TEXT,
    primary_muscle_group_id TEXT,
    set_number INTEGER NOT NULL,
    weight NUMERIC(10,2) NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    completed_at TIMESTAMPTZ
);

-- 8. Workout Plans
CREATE TABLE public.workout_plans (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    exercises JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Measurement Types
CREATE TABLE public.measurement_types (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL if system default
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE
);

-- 10. Body Measurements
CREATE TABLE public.body_measurements (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    measurement_type_id TEXT NOT NULL,
    value NUMERIC(10,2) NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced',
    deleted_at TIMESTAMPTZ
);

-- 11. Cardio Types
CREATE TABLE public.cardio_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE
);

-- 12. Cardio Activities
CREATE TABLE public.cardio_activities (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cardio_type_id TEXT NOT NULL REFERENCES public.cardio_types(id),
    duration_minutes INTEGER NOT NULL,
    distance_km NUMERIC(10,2),
    calories INTEGER,
    average_heart_rate INTEGER,
    performed_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'synced',
    deleted_at TIMESTAMPTZ
);

-- 13. Daily Steps
CREATE TABLE public.daily_steps (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 14. Progress Photos (Metadata referencing Supabase Storage paths)
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

-- Indexes for performance and synchronization queries
CREATE INDEX idx_workouts_user_id ON public.workouts(user_id);
CREATE INDEX idx_body_measurements_user_id ON public.body_measurements(user_id);
CREATE INDEX idx_cardio_activities_user_id ON public.cardio_activities(user_id);
CREATE INDEX idx_daily_steps_user_date ON public.daily_steps(user_id, date);
CREATE INDEX idx_progress_photos_user_id ON public.progress_photos(user_id);
CREATE INDEX idx_exercises_user_id ON public.exercises(user_id);
