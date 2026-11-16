# Gym Tracker — Supabase SQL Security & Deployment Audit (Stage 13C.2.1)

This document presents an independent, rigorous security and correctness audit of all Supabase SQL deployment scripts (`001_schema.sql` through `004_sync_metadata.sql`) prior to any manual production deployment.

---

## 1. Audit Summary & Overall Result
- **Branch**: `feature/stage-13c21-sql-security-audit`
- **Base Commit**: `f991305`
- **Overall Classification**: **PASS WITH CONDITIONS**
- **Deployment Status**: Proceed to deployment **only after** implementing the minor recommended enhancements listed in Section 2.

---

## 2. Detailed Findings & Findings Register

| ID | Severity | File & Section | Finding / Observation | Impact | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUDIT-01** | **LOW** | `001_schema.sql` (`handle_new_user`) | Profile creation fallback uses `user_` prefix with truncated UUID. | Clean fallback, but could theoretically collide if not unique. | `ON CONFLICT (id) DO NOTHING` handles collisions safely. No immediate block. |
| **AUDIT-02** | **MEDIUM** | `002_rls.sql` (`workout_sets`) | Workout sets ownership relies on `EXISTS` subquery against `public.workouts`. | If subquery lacks index on `workouts.id` and `workouts.user_id`, performance could degrade at scale. | Ensure `workouts(id, user_id)` composite index or primary key lookup optimization is present. |
| **AUDIT-03** | **LOW** | `004_sync_metadata.sql` (`get_user_deltas`) | Function stub returns empty set. | Placeholder function; not yet implemented for runtime pull sync. | Implement dynamic PostgREST query patterns or complete RPC implementation during Stage 13C.5 (Sync Engine). |
| **AUDIT-04** | **INFO** | `003_storage.sql` | Storage RLS policies rely on `storage.foldername(name)[1] = auth.uid()::text`. | Standard Supabase storage security pattern; fully isolates user folders. | None. Correctly implemented. |

---

## 3. Section-by-Section Audit Verification

### A. Schema Correctness (`001_schema.sql`)
- **Tables (14 total)**: All 14 entities (`profiles`, `app_settings`, `muscle_groups`, `equipment_categories`, `cardio_types`, `exercises`, `workouts`, `workout_sets`, `workout_plans`, `measurement_types`, `body_measurements`, `cardio_activities`, `daily_steps`, `progress_photos`) are correctly defined with precise primary keys, foreign keys, and check constraints.
- **Reference Tables**: `muscle_groups`, `equipment_categories`, and `cardio_types` correctly act as shared system reference tables without per-user ownership columns, while exercising system/user distinction (`source = 'system'` vs `user_id IS NOT NULL`) is strictly enforced via check constraints.
- **Timestamps**: All temporal columns use `TIMESTAMPTZ` with automated `updated_at` triggers.

### B. RLS Security (`002_rls.sql`)
- **Enabled**: RLS is explicitly enabled on all 14 tables.
- **Ownership Enforcement**: `auth.uid() = user_id` is enforced across all user-owned tables for SELECT, INSERT, UPDATE, and DELETE.
- **Update Protection**: UPDATE policies use `WITH CHECK` clauses to prevent users from transferring record ownership to another user ID.
- **Foreign Key Abuse Prevention**: `workout_sets` policy verifies that the parent `workouts.id` belongs to `auth.uid()`.

### C. Functions and Privileges (`001_schema.sql` & `004_sync_metadata.sql`)
- **SECURITY DEFINER**: Used appropriately for trigger functions (`handle_updated_at`, `handle_new_user`).
- **Search Path**: Explicitly hardened with `SET search_path = public` to prevent search path injection vulnerabilities.

### D. Storage Security (`003_storage.sql`)
- **Bucket Visibility**: Bucket `progress-photos` is documented as private.
- **Path Isolation**: Enforces `{auth.uid()}/{photo_id}.jpg` folder structure via `storage.foldername(name)[1] = auth.uid()::text` across SELECT, INSERT, UPDATE, and DELETE.

### E. Sync Metadata (`004_sync_metadata.sql`)
- **Columns**: Includes `sync_status`, `updated_at_utc`, and `deleted_at` tombstone support on transactional tables.
- **Idempotency**: Supports client-generated IDs and upsert semantics.

### F. Deployment Safety & Legacy Data
- **Deployment Order**: Documented clearly in `DEPLOYMENT_GUIDE.md` (Schema ➔ RLS ➔ Storage ➔ Sync Metadata).
- **Legacy Safety**: No SQL script automatically assigns ambiguous legacy records under `user_jan_1`.

---

## 4. Final Verification Statement
- **Remote Operations**: None performed.
- **Live Database**: Untouched.
- **Result**: **PASS WITH CONDITIONS** (Proceed to manual execution in Supabase Dashboard following `DEPLOYMENT_GUIDE.md`).
