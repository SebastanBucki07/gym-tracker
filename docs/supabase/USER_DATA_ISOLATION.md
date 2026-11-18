# Gym Tracker — Supabase User Data Isolation (Stage 13B.3)

This document details the architecture and implementation of per-account local workspace isolation for Supabase-authenticated users in Gym Tracker.

---

## 1. Root Cause of Previous Issue
- **Previous Problem**: When a user authenticated via Supabase Auth without selecting a local Dexie user profile, `AuthService.getCurrentUserId()` fell back to the shared default user ID `'user_jan_1'`.
- **Consequence**: Multiple distinct Supabase accounts read and wrote application records under the same shared Dexie user ID, causing cross-account data leaking.

---

## 2. New Local Identity Mapping (`supa_${supabaseUser.id}`)
- **Deterministic Namespacing**: When a user is authenticated via Supabase Auth (`SupabaseAuthService`), their stable Supabase UUID (`supaUser.id`) is prefixed to produce a distinct local workspace ID: `supa_${supaUser.id}`.
- **Lazy Profile Mirroring**: An Angular `effect()` automatically creates a corresponding profile record in `db.users` for `supa_${supaUser.id}` upon sign-in/session restoration, ensuring complete foreign key and relational integrity in Dexie.
- **Strict Prohibition of Fallbacks**: If neither a local profile is selected nor a Supabase user is authenticated, `getCurrentUserId()` throws an explicit error rather than silently falling back to `'user_jan_1'`.

---

## 3. Local-First Architecture & Data Isolation
- **Complete Isolation**: Supabase User A (`supa_uuid_A`) and Supabase User B (`supa_uuid_B`) operate in completely separate local Dexie workspaces. User A cannot read or modify User B's workouts, cardio, steps, measurements, or progress photos.
- **Zero Auto-Import**: New Supabase workspaces start completely clean with zero pre-seeded or copied demo data.
- **Coexistence**: Local profile authentication (`user_jan_1`, `user_anna_2`) continues working independently alongside Supabase Cloud Auth.

---

## 4. Treatment of Pre-existing `user_jan_1` Records
- Pre-existing records stored under `'user_jan_1'` remain strictly untouched under their original ID belonging to local profile Jan Kowalski.
- No automatic data reassignment or merging is performed.

---

## 5. Logout & Account Switching
- **Logout**: Clears the active identity context. Does not delete any local Dexie records.
- **Account Switching**: Switching between Supabase accounts (A to B) or local profiles correctly resolves the active workspace ID.
