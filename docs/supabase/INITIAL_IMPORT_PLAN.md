# Gym Tracker — Safe Initial Import Plan (Stage 13C.1)

This document designs a safe, repeatable initial import process for moving authenticated users' local Dexie data to Supabase.

---

## 1. Import Workflow Requirements
1. **Explicit Consent**: Import is triggered via an explicit user action ("Przenieś dane do chmury").
2. **Ownership Verification**: Only imports records belonging to the authenticated user's active workspace ID (`supa_${supabaseUser.id}` or verified local profile).
3. **Dependency Order**:
   - Profiles / App Settings
   - Measurement Types & Custom Exercises
   - Workouts & Workout Sets
   - Workout Plans
   - Body Measurements & Cardio Activities
   - Daily Steps & Progress Photos Metadata / Storage Files
4. **Duplicate Prevention**: Uses upsert semantics (`ON CONFLICT (id) DO UPDATE`) to ensure retrying an interrupted import is 100% idempotent and safe.
5. **No Local Deletion**: Local Dexie records are never automatically deleted after upload.
6. **Legacy Quarantine**: Ambiguous legacy data under `'user_jan_1'` is quarantined and excluded from automatic cloud migration unless explicitly selected and reviewed by the user.
