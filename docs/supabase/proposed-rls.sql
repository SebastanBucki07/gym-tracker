-- ============================================================================
-- Gym Tracker — Proposed Row Level Security (RLS) Policies (Review Only)
-- This file is a review-only proposal for Supabase PostgreSQL integration.
-- Do not execute directly against a live production database without review.
-- ============================================================================

-- Enable RLS on all user tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardio_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- Shared catalogs (Read-only for authenticated users, managed by system/admin)
ALTER TABLE public.muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardio_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on muscle_groups" ON public.muscle_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read on equipment_categories" ON public.equipment_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read on cardio_types" ON public.cardio_types FOR SELECT TO authenticated USING (true);

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 2. App Settings Policies
CREATE POLICY "Users can manage own settings" ON public.app_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Exercises Policies (System exercises read-only, user custom exercises full CRUD)
CREATE POLICY "Users can view system and own custom exercises" ON public.exercises FOR SELECT TO authenticated USING (source = 'system' OR auth.uid() = user_id);
CREATE POLICY "Users can create custom exercises" ON public.exercises FOR INSERT TO authenticated WITH CHECK (source = 'user' AND auth.uid() = user_id);
CREATE POLICY "Users can update own custom exercises" ON public.exercises FOR UPDATE TO authenticated USING (source = 'user' AND auth.uid() = user_id);
CREATE POLICY "Users can delete own custom exercises" ON public.exercises FOR DELETE TO authenticated USING (source = 'user' AND auth.uid() = user_id);

-- 4. Workouts Policies
CREATE POLICY "Users can manage own workouts" ON public.workouts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Workout Sets Policies (Access via parent workout ownership)
CREATE POLICY "Users can manage sets of own workouts" ON public.workout_sets FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.workouts WHERE workouts.id = workout_sets.workout_id AND workouts.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workouts WHERE workouts.id = workout_sets.workout_id AND workouts.user_id = auth.uid()));

-- 6. Workout Plans Policies
CREATE POLICY "Users can manage own workout plans" ON public.workout_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Measurement Types Policies
CREATE POLICY "Users can view system and own measurement types" ON public.measurement_types FOR SELECT TO authenticated USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "Users can manage own measurement types" ON public.measurement_types FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Body Measurements Policies
CREATE POLICY "Users can manage own body measurements" ON public.body_measurements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Cardio Activities Policies
CREATE POLICY "Users can manage own cardio activities" ON public.cardio_activities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Daily Steps Policies
CREATE POLICY "Users can manage own daily steps" ON public.daily_steps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. Progress Photos Policies
CREATE POLICY "Users can manage own progress photos" ON public.progress_photos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
