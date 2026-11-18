# Gym Tracker — Supabase Authentication Implementation (Stage 13B)

This document details the implementation of **Supabase Auth** in Gym Tracker, fulfilling the requirements of Stage 13B while strictly upholding the project's local-first architecture.

---

## 1. Supabase Configuration & Environment Variables
- Supabase configuration parameters (`supabaseUrl` and `supabaseKey`) are stored in Angular environment files:
  - `src/environments/environment.ts` (Development)
  - `src/environments/environment.development.ts` (Development)
  - `src/environments/environment.production.ts` (Production)
- **Security Rule**: Sensitive server-side keys (`service_role`) are never exposed in frontend code. Only the public anon/publishable key is used.
- **Graceful Fallback**: If environment variables contain placeholder values (e.g. `placeholder-project`), `SupabaseAuthService` safely operates in offline/local-only mode without crashing client applications.

---

## 2. Authentication Architecture (`SupabaseAuthService`)
- Built using the official `@supabase/supabase-js` client library (`createClient`).
- Manages reactive Angular signals:
  - `currentUser`: Current authenticated Supabase user object.
  - `currentSession`: Active JWT session.
  - `isAuthenticated`: Computed signal indicating whether a cloud session is active.
  - `isLoading`: Loading state during session restoration.
  - `isConfigError`: Flag indicating missing or placeholder configuration.
- Session persistence is managed natively by the Supabase client (persisted in browser storage).

---

## 3. Login and Registration Flow
- **UI Tabs**: The authentication screens (`LoginComponent` and `RegisterComponent`) provide a clean tab switch between:
  1. **Profil lokalny** (Local profile management via Dexie / `AuthService`).
  2. **Supabase Cloud Auth** (Secure email & password authentication via `SupabaseAuthService`).
- **Validation**: Enforces valid email formats and minimum password lengths (6+ characters).
- **Error Handling**: Friendly Polish error messages (`pl-PL`) for invalid credentials, existing accounts, or unconfirmed emails.

---

## 4. Local-First Guarantees
- **Zero Local Data Modification**: Logging in, registering, or logging out via Supabase Auth does **not** automatically upload, overwrite, or delete local workouts or user records in Dexie/IndexedDB.
- **Offline Resilience**: The application continues to function fully offline using local IndexedDB storage.
- **No Silent Ownership Assignment**: Local workouts remain local; cloud identity is completely decoupled from local database records until a future explicit migration/sync stage is implemented.

---

## 5. Explicit Exclusions (Not Implemented in Stage 13B)
As mandated by the task specification, the following features are **NOT** part of Stage 13B and remain deferred:
- Cloud workout synchronization.
- Automatic local data upload or import.
- Progress photo uploads to Supabase Storage.
- Conflict resolution or sync queues.

---

## 6. Manual Setup Required in Supabase Dashboard
1. Enable the **Email** authentication provider in the Supabase Dashboard (`Authentication > Providers`).
2. Configure site URL and redirect URLs for local development (`http://localhost:4200`) and production.
3. Obtain your project's **Project URL** and **Publishable Anon Key** from `Project Settings > API` and populate them in `src/environments/environment.ts`.
