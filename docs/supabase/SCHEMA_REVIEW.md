# Gym Tracker — Supabase Schema & Security Review (Stage 13A.1)

This document provides a comprehensive technical review of the hardened PostgreSQL schema (`proposed-schema.sql`), Row Level Security policies (`proposed-rls.sql`), and Storage security policies (`proposed-storage-rls.sql`) designed for Gym Tracker.

---

## 1. Summary of Improvements over Initial Proposal
- **Automatic Profile Provisioning**: Added a secure `SECURITY DEFINER` trigger function (`handle_new_user()`) on `auth.users` to automatically create a corresponding `public.profiles` row upon sign-up.
- **Strict Domain Constraints**: Added PostgreSQL `CHECK` constraints on exercises (`source` matching `user_id IS NULL` vs `NOT NULL`), cardio heart rates, body measurements, daily steps, and app settings themes/units.
- **JSONB Array Validation**: Enforced array type validation on `workout_plans.exercises` (`jsonb_typeof(exercises) = 'array'`).
- **Timestamp Standardization**: Standardized all temporal columns on `TIMESTAMPTZ` with automated triggers (`handle_updated_at()`) for updating `updated_at`.
- **Storage Isolation**: Added explicit Storage RLS policies on `storage.objects` enforcing strict user folder scoping (`{auth.uid()}/...`) within the private `progress-photos` bucket.

---

## 2. Changes Made
- Hardened `proposed-schema.sql` with robust check constraints, unique constraints, foreign keys with cascade rules, and automated trigger functions.
- Hardened `proposed-rls.sql` with explicit `WITH CHECK` clauses and parent-child ownership verification (`workout_sets` verified against parent `workouts.user_id`).
- Created `proposed-storage-rls.sql` to secure the private progress photos bucket against unauthorized cross-user access.

---

## 3. Table-by-Table Ownership Model
| Table Name | Owner / Scope | RLS Policy Enforced |
| :--- | :--- | :--- |
| `profiles` | User-owned (1:1 with `auth.users`) | `auth.uid() = id` |
| `app_settings` | User-owned (1:1 with user) | `auth.uid() = user_id` |
| `muscle_groups` | Shared Catalog (System) | Read-only for authenticated users |
| `equipment_categories` | Shared Catalog (System) | Read-only for authenticated users |
| `cardio_types` | Shared Catalog (System) | Read-only for authenticated users |
| `exercises` | System (shared) or User (custom) | System read-only; User CRUD on own rows |
| `workouts` | User-owned | `auth.uid() = user_id` |
| `workout_sets` | User-owned (via parent workout) | Verified via parent `workouts.user_id` |
| `workout_plans` | User-owned | `auth.uid() = user_id` |
| `measurement_types` | System (shared) or User (custom) | System read-only; User CRUD on own rows |
| `body_measurements` | User-owned | `auth.uid() = user_id` |
| `cardio_activities` | User-owned | `auth.uid() = user_id` |
| `daily_steps` | User-owned (Unique per user/date) | `auth.uid() = user_id` |
| `progress_photos` | User-owned metadata | `auth.uid() = user_id` |

---

## 4. Table Relationship Overview
- `profiles.id` ➔ `auth.users.id` (1:1)
- `app_settings.user_id` ➔ `profiles.id` (1:1)
- `exercises.primary_muscle_group_id` ➔ `muscle_groups.id` (N:1)
- `exercises.equipment_category_id` ➔ `equipment_categories.id` (N:1)
- `workouts.user_id` ➔ `profiles.id` (N:1)
- `workout_sets.workout_id` ➔ `workouts.id` (N:1 Cascade Delete)
- `workout_plans.user_id` ➔ `profiles.id` (N:1)
- `body_measurements.user_id` ➔ `profiles.id` (N:1)
- `cardio_activities.cardio_type_id` ➔ `cardio_types.id` (N:1)
- `progress_photos.user_id` ➔ `profiles.id` (N:1)

---

## 5. RLS Policy Overview
- **Isolation Principle**: Every user-owned table has RLS enabled with policies restricting SELECT, INSERT, UPDATE, and DELETE to records where `auth.uid() = user_id`.
- **Relational Integrity**: `workout_sets` verifies parent workout ownership via an `EXISTS` subquery against `public.workouts`.

---

## 6. Storage Security Design
- **Bucket**: `progress-photos` (marked private).
- **Path Isolation**: `{auth.uid()}/{photo_id}.jpg`.
- **Enforcement**: Storage policies inspect `storage.foldername(name)[1]` to ensure it matches `auth.uid()::text`.

---

## 7. Timestamp Conventions
- All absolute date-times use `TIMESTAMPTZ`.
- `created_at` defaults to `NOW()`.
- `updated_at` is automatically updated via database triggers.
- Synchronization tracking columns (`sync_status`, `updated_at_utc`, `deleted_at`) support offline-first sync.

---

## 8. Synchronization Strategy
- **Local First**: IndexedDB (Dexie) remains primary offline storage.
- **Sync Engine**: Queues mutations locally, pushes when online, pulls remote changes, and handles soft deletes (`deleted_at`).

---

## 9. Local Migration Strategy
- Option B (New Cloud Account + Explicit Local Import) selected.
- Preserves local records, maps string IDs to Supabase Auth UUIDs, and batches uploads in dependency order.

---

## 10. Authentication Considerations
- Supabase Auth manages JWT sessions and secure credential hashing.
- Local profile sessions map seamlessly to Supabase Auth `auth.uid()`.

---

## 11. Remaining Risks & Unresolved Decisions
- Multi-device concurrent editing resolution for identical workout sets.
- Storage quota management for high-resolution progress photos.

---

## 12. Manual Deployment Checklist (For Future Stage 13B)
1. Run `proposed-schema.sql` in Supabase SQL Editor.
2. Run `proposed-rls.sql` in Supabase SQL Editor.
3. Create private bucket `progress-photos` in Supabase Storage.
4. Run `proposed-storage-rls.sql` in Supabase SQL Editor.
