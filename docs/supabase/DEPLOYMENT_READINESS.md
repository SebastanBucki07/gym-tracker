# Gym Tracker — Supabase Deployment Readiness Report (Stage 13A.2)

This document provides the final technical review and deployment readiness blueprint for deploying the Gym Tracker schema, Row Level Security policies, and Storage policies to Supabase.

---

## 1. Final Architecture Assumptions
- **Local-First System of Record**: IndexedDB (Dexie) remains the primary client-side persistence layer for fully offline execution.
- **Supabase Cloud**: Serves as authentication provider, cloud backup, multi-device synchronization backend, and private binary file storage for progress photos.
- **Authentication**: Option B strategy (new Supabase Auth cloud accounts + explicit local migration wizard) ensures secure JWT sessions without plaintext password migration.

---

## 2. Final Table Inventory (Exact Count: 14 Tables)
The proposed relational schema comprises **14 tables** in the `public` schema:
1. `profiles` — User profile data extending `auth.users`.
2. `app_settings` — User application preferences (theme, measurement units).
3. `muscle_groups` — Shared system muscle group catalog.
4. `equipment_categories` — Shared system equipment category catalog.
5. `cardio_types` — Shared system cardio activity type catalog.
6. `exercises` — System exercises and user-created custom exercises.
7. `workouts` — Completed and active workout session records.
8. `workout_sets` — Individual sets belonging to workouts.
9. `workout_plans` — Saved workout routine templates containing exercise definitions (JSONB).
10. `measurement_types` — System and user custom body measurement categories.
11. `body_measurements` — Recorded body weight, body fat, and dimension measurements.
12. `cardio_activities` — Logged cardio sessions.
13. `daily_steps` — Daily step count records (unique per user/date).
14. `progress_photos` — Metadata referencing private progress photo files in Supabase Storage.

---

## 3. Recommended SQL Deployment Order
When deploying to a Supabase project via the SQL Editor, execute scripts in the following precise order:
1. **`proposed-schema.sql`**: Creates the 14 tables, triggers, and performance indexes.
2. **`proposed-rls.sql`**: Enables RLS on all tables and creates granular security policies.
3. **`proposed-storage-rls.sql`**: Applies storage security policies on `storage.objects` for the private `progress-photos` bucket.

---

## 4. Required Supabase Project Settings
- **PostgreSQL Version**: 15+ recommended.
- **Auth Settings**:
  - Email Provider enabled.
  - Optional OAuth providers configured if desired.
  - Site URL and Redirect URLs configured for the Angular PWA production domain.

---

## 5. Required Private Storage Bucket Configuration
- **Bucket Name**: `progress-photos`
- **Visibility**: **Private** (Public access disabled).
- **File Size Limit**: Configured as appropriate (e.g. 10MB per image).
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`.

---

## 6. Auth / Profile Trigger Behavior
- A secure `SECURITY DEFINER` function (`handle_new_user()`) is attached to `auth.users` upon insertion.
- Automatically provisions a `public.profiles` entry using user metadata, email prefix, or a deterministic fallback ID (`user_xxxxxxxx`).
- Protected against client-side tampering and email collision.

---

## 7. Row Level Security (RLS) Assumptions
- RLS is enabled on all 14 tables.
- Every user-owned table enforces `auth.uid() = user_id`.
- Relational child tables (`workout_sets`) verify parent ownership via subqueries against `public.workouts`.
- Shared system catalogs (`muscle_groups`, `equipment_categories`, `cardio_types`) are read-only for authenticated users.

---

## 8. Known Limitations & Constraints
- **Local-First Sync Latency**: Offline mutations are queued locally and synchronized when online.
- **Client-Editable Profiles**: Users can update `username` and `avatar_url`, but `email` updates are managed strictly through Supabase Auth.

---

## 9. Local Validation Results
- **Unit Tests**: All 51 unit and integration tests passed successfully (`npx ng test --watch=false`).
- **Production Build**: Completed successfully without errors (`npx ng build`).
- **SQL Static Analysis**: Syntax verified against PostgreSQL standards; triggers and RLS policies follow Supabase best practices.

---

## 10. Manual Verification Checklist (For Supabase Dashboard)
1. Execute `proposed-schema.sql` in the Supabase SQL Editor.
2. Execute `proposed-rls.sql` in the Supabase SQL Editor.
3. Create private bucket `progress-photos` in Supabase Storage.
4. Execute `proposed-storage-rls.sql` in the Supabase SQL Editor.
5. Verify table count (14 tables) in the Supabase Table Editor.

---

## 11. Explicit Confirmation of Safety Rules
- **No Remote SQL Executed**: This stage was strictly preparation and hardening; no remote Supabase operations were performed.
- **No Credentials Exposed**: No secrets, service role keys, or connection passwords were used or logged.
- **No Production Data Modified**: Local IndexedDB and client application behavior remain 100% offline-first.

---

## 12. Recommended Next Stage
- **Stage 13B** — Supabase Client Integration & Implementation (Angular Supabase Service, Auth UI, and Synchronization Engine).
