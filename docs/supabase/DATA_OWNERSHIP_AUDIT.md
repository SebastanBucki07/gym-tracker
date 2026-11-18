# Gym Tracker — Data Ownership & Legacy Audit (Stage 13C.1)

This document provides a thorough audit of data ownership across all local Dexie tables, analyzing legacy data, seed/demo records, and multi-account workspace isolation risks.

---

## 1. Dexie Table Inventory & Ownership Mapping

| Local Table Name | Primary Key | User Ownership Field | Indexed By | Ownership Enforcement (Read/Write) |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `id` | `id` (Self) | `id, email, username` | Profile management |
| `exercises` | `id` | `userId` (Nullable) | `id, primaryMuscleGroupId, source, userId` | System exercises (`userId` null); User custom (`userId` set) |
| `equipmentCategories` | `id` | None (Shared Catalog) | `id` | Read-only shared catalog |
| `muscleGroups` | `id` | None (Shared Catalog) | `id` | Read-only shared catalog |
| `workouts` | `id` | `userId` | `id, userId, startedAt, isCompleted` | Scoped strictly to active `userId` (`getCurrentUserId()`) |
| `workoutSets` | `id` | Via parent `workoutId` | `id, workoutId, exerciseId` | Scoped via parent workout lookup |
| `workoutPlans` | `id` | `userId` | `id, userId` | Scoped strictly to active `userId` |
| `measurementTypes` | `id` | `userId` (Nullable) | `id, userId, isSystem` | System default or user custom |
| `bodyMeasurements` | `id` | `userId` | `id, userId, measurementTypeId, measuredAt` | Scoped strictly to active `userId` |
| `cardioTypes` | `id` | None (Shared Catalog) | `id` | Read-only shared catalog |
| `cardioActivities` | `id` | `userId` | `id, userId, cardioTypeId, performedAt` | Scoped strictly to active `userId` |
| `dailySteps` | `id` | `userId` | `id, userId, date, [userId+date]` | Scoped strictly to active `userId` |
| `progressPhotos` | `id` | `userId` | `id, userId, takenAt` | Scoped strictly to active `userId` |
| `appSettings` | `id` | `userId` | `id, userId` | Scoped strictly to active `userId` |

---

## 2. Legacy Data Analysis & Ownership Classification

During the evolution of Gym Tracker from a local-first single-device app to Supabase cloud auth, records were populated under different identifiers:
- **`user_jan_1` & `user_anna_2`**: Pre-existing local profiles containing seeded demo workouts, cardio, steps, and measurements.
- **`supa_<UUID>`**: Secure per-account local workspaces introduced in Stage 13B.3 for Supabase-authenticated users.
- **Stage 13B.2 Shared Fallback Period**: A brief period where unlinked Supabase users temporarily fell back to `user_jan_1` (remediated in Stage 13B.3).

### Ownership Classification Categories:
1. **Category A (Safely Attributable to Local Profile)**: Records explicitly created under local profile IDs (`user_jan_1`, `user_anna_2`) while local authentication was active.
2. **Category B (Safely Attributable to Supabase UUID)**: Records created under `supa_<UUID>` workspaces after Stage 13B.3.
3. **Category C (Ambiguous Legacy Records)**: Records created under `user_jan_1` during the Stage 13B.2 shared-user fallback period. **Risk**: May contain mixed data from multiple Supabase users who logged in before strict isolation was enforced. **Action**: Never automatically assign to any Supabase account without explicit user confirmation.
4. **Category D (Demo / Seed Data)**: Initial sample workouts and cardio created by `DatabaseSeedService`.
5. **Category E (Orphaned / Inconsistent Records)**: Records lacking valid foreign key references or user ownership links.

---

## 3. Data Ownership Risks & Mitigation
- **Risk**: Automatic migration of ambiguous `user_jan_1` records could leak another user's personal workout history into a newly registered Supabase account.
- **Mitigation**: Strict policy against automatic assignment of legacy shared data. Ambiguous records remain quarantined under their original ID until an explicit, user-driven import/recovery wizard is executed.
