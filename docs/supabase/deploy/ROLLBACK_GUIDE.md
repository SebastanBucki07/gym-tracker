# Gym Tracker — Supabase Rollback Guide

This guide outlines the safe rollback procedures in the event that deployed schema changes require reversal during testing.

---

## 1. Rollback RLS Policies
To drop all custom RLS policies:
```sql
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    END LOOP;
END $$;
```

---

## 2. Drop Public Schema Tables (Reverse Dependency Order)
To safely drop all application tables in the public schema without affecting `auth` or `storage` schemas:
```sql
DROP TABLE IF EXISTS public.progress_photos CASCADE;
DROP TABLE IF EXISTS public.daily_steps CASCADE;
DROP TABLE IF EXISTS public.cardio_activities CASCADE;
DROP TABLE IF EXISTS public.cardio_types CASCADE;
DROP TABLE IF EXISTS public.body_measurements CASCADE;
DROP TABLE IF EXISTS public.measurement_types CASCADE;
DROP TABLE IF EXISTS public.workout_plans CASCADE;
DROP TABLE IF EXISTS public.workout_sets CASCADE;
DROP TABLE IF EXISTS public.workouts CASCADE;
DROP TABLE IF EXISTS public.exercises CASCADE;
DROP TABLE IF EXISTS public.equipment_categories CASCADE;
DROP TABLE IF EXISTS public.muscle_groups CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
```

---

## 3. Drop Helper Functions and Triggers
```sql
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_deltas() CASCADE;
```
