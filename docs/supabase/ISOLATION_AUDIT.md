# Gym Tracker — Multi-Account Isolation Audit (Stage 13B.4)

This document presents the findings of the read-only audit of multi-account data isolation between local profiles and Supabase-authenticated workspaces in Gym Tracker.

---

## 1. Current Branch and Commit
- **Branch**: `feature/stage-13b3-supabase-user-isolation`
- **Commit**: `1d5cdfa` (with uncommitted audit deliverable)

---

## 2. Findings by Audit Section

### A. Identity Resolution (`AuthService.getCurrentUserId()`)
- **Finding**: `getCurrentUserId()` checks `localUser` via `currentUserSignal()` first, then checks `supaUser` via `supabaseAuth?.currentUser?.()`.
- **Potential Risk**: If a user is logged into a local profile (e.g. `user_jan_1`) and subsequently authenticates via Supabase Auth without clearing the local profile state, `localUser` remains active, causing the Supabase user to write data into the local profile workspace rather than `supa_${supaUser.id}`.
- **Unauthenticated Fallback**: Successfully eliminated. Unauthenticated states throw an explicit error (`Brak aktywnego uwierzytelnionego użytkownika`), preventing fallback to `'user_jan_1'`.

### B. Lazy Profile Initialization
- **Finding**: Profile creation for `supa_${supaUser.id}` is triggered asynchronously via `this.userRepository.getById(...).then(...)` inside the synchronous `getCurrentUserId()` call, with errors silently caught via `.catch(() => {})`.
- **Potential Risk**: Race conditions if multiple components call `getCurrentUserId()` concurrently before the profile record is written to `db.users`. Silent failure handling hides underlying storage errors.

### C. Account Switching & Stale State
- **Finding**: Supabase Auth state changes are observed by `SupabaseAuthService`, but components that remain active across navigation (or cached components) do not automatically re-trigger data re-fetching unless `ngOnInit()` runs on route re-activation.
- **Potential Risk**: Stale UI state or cached signals showing previous account data until manual page refresh or route navigation.

### D. Data Access Audit
- **Audited Modules**: Dashboard, Calendar, Cardio, Measurements, ProgressPhotos, Steps, WorkoutHistory, Exercises, ActiveWorkout.
- **Status**: All modules correctly resolve their workspace ID through `AuthService.getCurrentUserId()`.

---

## 3. Existing Test Coverage & Missing Tests
- **Existing Coverage**:
  - Distinct Supabase UUIDs produce different workspaces (`supa_A` vs `supa_B`).
  - Strict isolation between Supabase users.
  - Unauthenticated calls throw an error.
  - Local profile authentication coexistence.
  - Logout preservation of Dexie records.
- **Missing Test Coverage**:
  - Race conditions during concurrent lazy profile initialization.
  - Conflict behavior when `localUser` and `supaUser` are both present simultaneously.
  - Component state clearing upon account switching.

---

## 4. Manual Verification Guide (Two Supabase Accounts)
1. Open the application in a browser (or Incognito window for Account B).
2. **Account A Verification**:
   - Log in using Supabase Account A.
   - Navigate to Cardio / Measurements / Workouts and create test records.
   - Verify records appear correctly.
3. **Account B Verification**:
   - Log out and log in using Supabase Account B (in the same browser session or separate window).
   - Navigate to Cardio / Measurements / Workouts.
   - **Expected**: Workspace resolves to `supa_${accountB.id}`; no records from Account A are visible (complete isolation).
   - Create test records for Account B.
4. **Switch Back**:
   - Log out of Account B and log back into Account A.
   - Verify that Account A's original records are intact and Account B's records are not visible.

---

## 5. Audit Criteria Status Summary
| Audit Criterion | Status | Notes |
| :--- | :--- | :--- |
| Supabase session resolves to `supa_<UUID>` | **PASS** | Validated via unit tests. |
| Local profile override prevention | **RISK** | `localUser` evaluated before `supaUser` (addressed in recommendations). |
| Unauthenticated fallback elimination | **PASS** | Throws explicit error instead of `'user_jan_1'`. |
| Lazy profile initialization safety | **RISK** | Asynchronous promise without await / silent catch. |
| Account switching & stale state handling | **NOT VERIFIED** | Requires active component subscription re-triggering on auth state change. |
| All data modules scoped to active workspace | **PASS** | Audited across all 9 feature modules. |
| Test coverage of multi-account flows | **PARTIAL** | Core isolation tested; concurrent/stale state tests pending. |
