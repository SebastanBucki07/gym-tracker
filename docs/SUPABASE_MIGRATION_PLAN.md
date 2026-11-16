# Gym Tracker — Supabase Cloud Migration & Architecture Plan (Stage 13A)

This document presents a comprehensive technical audit and migration architecture plan for introducing cloud synchronization with **Supabase** while strictly preserving Gym Tracker's robust **local-first** architecture (IndexedDB / Dexie).

---

## 1. Current Architecture Overview
- **Frontend Framework**: Angular Standalone Components, Angular Router, Signals, Reactive Forms, TypeScript strict mode.
- **Local Persistence**: IndexedDB via Dexie (`GymTrackerDB`), fully offline-capable.
- **Authentication**: Local-first profile management (`LocalUserRepository`) storing profiles in IndexedDB with local session persistence (`localStorage`).
- **PWA & Offline**: Fully installable Progressive Web App with Angular Service Worker (`@angular/service-worker`) caching static assets and application shell.

---

## 2. Current Dexie Schema Inventory (`GymTrackerDB`)
The existing application defines the following Dexie stores and indexes:
- `users`: `id, email, username`
- `exercises`: `id, primaryMuscleGroupId, equipmentCategoryId, source, userId, isActive`
- `equipmentCategories`: `id`
- `muscleGroups`: `id`
- `workouts`: `id, userId, startedAt, isCompleted`
- `workoutSets`: `id, workoutId, exerciseId`
- `workoutPlans`: `id, userId`
- `measurementTypes`: `id, userId, isSystem`
- `bodyMeasurements`: `id, userId, measurementTypeId, measuredAt`
- `cardioTypes`: `id, isSystem`
- `cardioActivities`: `id, userId, cardioTypeId, performedAt`
- `dailySteps`: `id, userId, date, [userId+date]`
- `progressPhotos`: `id, userId, takenAt`
- `appSettings`: `id, userId`

---

## 3. Current Authentication Analysis
- **Model**: `User` (`id`, `username`, `email`, `avatarUrl`, `createdAt`, `updatedAt`).
- **Session**: Stored in `localStorage` (`gym_tracker_current_user_id`) and managed by `AuthService`.
- **Isolation**: Every user-owned record references `userId`.
- **Limitation**: Local authentication has no password hashing or cryptographic security; it relies entirely on local profile selection and device trust. Migrating to Supabase Auth brings industry-standard JWT sessions, secure password hashing, OAuth capabilities, and server-side identity verification.

---

## 4. Supabase Project Inspection Guidelines
Since this is a preparation-only stage, no live remote mutations or schema executions are performed.
- **Frontend Configuration Required**:
  - `SUPABASE_URL` (Supabase Project URL)
  - `SUPABASE_ANON_KEY` (Supabase Publishable/Anon Key)
- **Prohibited Credentials (Never Expose)**:
  - `service_role` secret key
  - Database connection strings with passwords
  - Personal access tokens

---

## 5. Recommended Authentication Migration Strategy
Three migration options were evaluated:
- **Option A (Supabase Auth Primary)**: Replace local auth entirely. Existing local users would need to recreate accounts.
- **Option B (New Cloud Accounts with Explicit Local Import)**: Recommended approach. Users create secure Supabase Auth accounts and trigger an explicit migration wizard that securely maps their local IndexedDB records to their new Supabase `auth.uid()`.
- **Option C (Transitional Hybrid)**: Maintaining dual authentication pathways. High complexity and potential data corruption risks.

**Recommendation**: **Option B**. It provides clean separation, robust cloud security via Supabase Auth, avoids plaintext password migration, and gives users explicit control over their cloud data migration.

---

## 6. Proposed PostgreSQL Schema
Defined in `docs/supabase/proposed-schema.sql`. Key principles:
- Uses `UUID` primary keys for `auth.users` references (`profiles.id`).
- Maintains existing string IDs or maps them cleanly for transactional entities.
- Adds synchronization metadata columns (`sync_status`, `updated_at_utc`, `deleted_at`) for offline-first sync.

---

## 7. Proposed Row Level Security (RLS) Policies
Defined in `docs/supabase/proposed-rls.sql`. Key principles:
- Enforces `auth.uid() = user_id` across all user-owned tables.
- Protects parent-child relationships (e.g. `workout_sets` verified against parent `workouts.user_id`).
- Provides read-only access to shared system catalogs (`muscle_groups`, `equipment_categories`, `cardio_types`).

---

## 8. Supabase Storage Design
- **Bucket Name**: `progress-photos` (Private bucket).
- **Folder Structure**: `{user_id}/{photo_id}.jpg`
- **Security**: Storage RLS policies ensure authenticated users can only upload, read, and delete objects within their own `{user_id}/` folder prefix.

---

## 9. Local-First Synchronization Architecture
- **Primary Persistence**: IndexedDB (Dexie) remains the system of record for the client during active offline usage.
- **Sync Engine (`SyncService`)**:
  - Detects online/offline transitions via `NetworkStatusService`.
  - Queues local mutations (creates, updates, deletes) with `sync_status = 'pending'`.
  - Pushes pending changes in dependency order (e.g., workouts before sets).
  - Pulls remote changes using `updated_at` timestamps.

---

## 10. Conflict Resolution Strategy
- **Last-Write-Wins (LWW)** applied to modifiable records (e.g. profile settings, active step counts).
- **Protected Historical Records**: Completed workouts and historical measurements are treated as immutable or merged conservatively to prevent accidental data loss.
- **Tombstone Soft Deletes**: Deletions are tracked using `deleted_at` timestamps to propagate deletions across devices correctly.

---

## 11. Existing Local-Data Migration Plan
1. User logs into Supabase Auth.
2. App detects existing local profiles in IndexedDB.
3. User initiates migration prompt ("Przenieś dane lokalne do chmury").
4. Client maps local string user IDs to Supabase Auth `auth.uid()`.
5. Batch uploads entities in correct dependency order.
6. Uploads binary progress photos from IndexedDB blobs to Supabase Storage.
7. Marks local records as synchronized upon server confirmation.

---

## 12. Environment Configuration Proposal
- Angular environment files (`environment.ts` and `environment.production.ts`) will store `supabaseUrl` and `supabaseKey`.
- `git` will ignore local overrides while tracking sample configuration templates.

---

## 13. Testing Strategy
- Unit tests for sync queue and serialization.
- Negative security tests verifying cross-user isolation via RLS.
- Offline transition simulation tests.

---

## 14. Implementation Phases (Future)
- **Phase 1**: Supabase Client Integration & Auth UI.
- **Phase 2**: Database Schema Deployment & RLS Activation.
- **Phase 3**: Storage Bucket & Progress Photo Migration.
- **Phase 4**: Offline Sync Engine & Conflict Resolution.

---

## 15. Risks & Unresolved Decisions
- Handling multi-device concurrent edits on identical workout sets.
- Storage bandwidth limits for large progress photo galleries.

---

## 16. Manual Actions Required from User
1. Create/configure Supabase project in Supabase Dashboard.
2. Obtain Project URL and Publishable (Anon) Key.
3. Review and execute `docs/supabase/proposed-schema.sql` and `docs/supabase/proposed-rls.sql` in Supabase SQL Editor.
4. Create private Storage bucket named `progress-photos`.
