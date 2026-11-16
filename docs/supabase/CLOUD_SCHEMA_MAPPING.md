# Gym Tracker — Cloud Schema Mapping (Stage 13C.1)

This document maps local Dexie entities to proposed Supabase PostgreSQL tables, verifying type compatibility, foreign keys, constraints, and migration risks.

---

## 1. Entity Mapping Table

| Local Dexie Table | Supabase PostgreSQL Table | Local PK | Cloud PK | User Ownership Column | Relationships & Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `profiles` | `id` (string) | `id` (UUID) | `id` (1:1 with `auth.users`) | Extends Supabase Auth |
| `appSettings` | `app_settings` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | References `profiles.id` |
| `muscleGroups` | `muscle_groups` | `id` (string) | `id` (TEXT) | None (Shared Catalog) | System catalog |
| `equipmentCategories` | `equipment_categories` | `id` (string) | `id` (TEXT) | None (Shared Catalog) | System catalog |
| `exercises` | `exercises` | `id` (string) | `id` (TEXT) | `user_id` (UUID, nullable) | References `muscle_groups`, `equipment_categories` |
| `workouts` | `workouts` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | References `profiles.id` |
| `workoutSets` | `workout_sets` | `id` (string) | `id` (TEXT) | Via parent `workout_id` | References `workouts.id` (CASCADE) |
| `workoutPlans` | `workout_plans` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | References `profiles.id` |
| `measurementTypes` | `measurement_types` | `id` (string) | `id` (TEXT) | `user_id` (UUID, nullable) | System or user custom |
| `bodyMeasurements` | `body_measurements` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | References `measurement_types.id` |
| `cardioTypes` | `cardio_types` | `id` (string) | `id` (TEXT) | None (Shared Catalog) | System catalog |
| `cardioActivities` | `cardio_activities` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | References `cardio_types.id` |
| `dailySteps` | `daily_steps` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | Unique constraint on `(user_id, date)` |
| `progressPhotos` | `progress_photos` | `id` (string) | `id` (TEXT) | `user_id` (UUID) | References Supabase Storage path |

---

## 2. Type Compatibility & Serialization Requirements
- **IDs**: Local string IDs (e.g., `w_123`, `set_456`) are preserved as `TEXT` primary keys in PostgreSQL to prevent relational breakage during cloud sync. User profile IDs map from local string IDs to Supabase Auth UUIDs (`auth.users.id`).
- **Timestamps**: Local JavaScript `Date` objects serialize to ISO-8601 strings during network transit and map cleanly to PostgreSQL `TIMESTAMPTZ`.
- **JSONB**: Workout plans store structured exercise arrays in `workout_plans.exercises` using PostgreSQL `JSONB`.

---

## 3. Migration Risks & Gaps
- **Foreign Key Ordering**: When pushing data to Supabase, dependency order must be respected (Profiles ➔ Measurement Types / Exercises ➔ Workouts ➔ Workout Sets ➔ Body Measurements / Cardio / Progress Photos).
- **ID Collisions**: Using string IDs prefixed with entity types ensures uniqueness across devices.
