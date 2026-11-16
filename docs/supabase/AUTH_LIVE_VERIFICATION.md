# Gym Tracker — Live Supabase Auth Verification (Stage 13B.1)

This document outlines the configuration guide, verification methodology, and manual checklist for connecting Gym Tracker's Supabase Auth implementation to a live Supabase project.

---

## 1. Local Configuration Procedure
To connect the local development environment to your real Supabase project without committing sensitive keys:
1. Open your Supabase Dashboard (`https://supabase.com/dashboard`).
2. Navigate to **Project Settings > API**.
3. Copy your **Project URL** and **Publishable Anon Key** (`anon` / `public`).
4. Update `src/environments/environment.ts` and `src/environments/environment.development.ts` locally:
   ```typescript
   export const environment = {
     production: false,
     supabaseUrl: 'YOUR_REAL_SUPABASE_URL',
     supabaseKey: 'YOUR_REAL_SUPABASE_ANON_KEY'
   };
   ```
   *(Note: Never commit your actual `supabaseUrl` or `supabaseKey` to version control. The repository maintains safe placeholders by default).*

---

## 2. Required Supabase Dashboard URL Settings
In your Supabase Dashboard (`Authentication > URL Configuration`):
- **Site URL**: `http://localhost:4200`
- **Redirect URLs**:
  - `http://localhost:4200/`
  - `http://localhost:4200/login`
  - `http://localhost:4200/dashboard`

---

## 3. Verified Authentication Lifecycle (Automated & Manual)

### Automated Unit Tests (Executed)
- **Client Initialization**: Verified graceful handling of missing or placeholder configuration (`SupabaseAuthService`).
- **Error Handling**: Verified localized Polish error messages for sign-in and sign-up failures.
- **Local-First Isolation**: Verified that Supabase Auth does not touch, modify, or delete local Dexie records or local profile states.

### Manual Live Verification Checklist (Developer Action Required)
1. **Sign-Up**: Navigate to `/register`, select **Supabase Cloud Auth**, enter valid credentials, and submit. Verify that a confirmation email is dispatched by Supabase.
2. **Email Confirmation**: Open your test email inbox and click the confirmation link.
3. **Sign-In**: Navigate to `/login`, select **Supabase Cloud Auth**, and sign in with the confirmed credentials. Verify successful redirect to `/dashboard` and session persistence.
4. **Session Restoration**: Refresh the browser page while logged in. Verify that the session is restored automatically without forcing re-login.
5. **Password Reset**: Use the password reset flow and verify receipt of the recovery email.
6. **Sign-Out**: Click **Wyloguj** in the global navbar. Verify that the Supabase session is cleared and the user returns to `/login`.
7. **Local-First Integrity**: Verify that local Dexie workout history, cardio, steps, and local profiles remain 100% intact and accessible before, during, and after cloud authentication operations.

---

## 4. Safety & Security Confirmations
- **No Service Role Keys Used**: Only the public anon key is referenced in frontend code.
- **No Schema Modifications**: No remote SQL migrations, tables, or storage buckets were created or altered during Stage 13B.1.
- **No Data Import**: No local Dexie records were automatically uploaded or associated with cloud accounts.
