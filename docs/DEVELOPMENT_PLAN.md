# Gym Tracker — Development Plan

Update this file as work progresses. Do not mark a stage complete until its acceptance criteria have been verified. Record commit hashes and test/build results.

Statuses: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `COMPLETED`.

## Stage 1 — Project initialization
Status: COMPLETED
- [ ] Create Angular SPA with routing, SCSS, strict TypeScript.
- [ ] Initialize/verify Git repository and `main`.
- [ ] Add `.gitignore` and README.
- [ ] Install and verify compatible dependencies (CDK, Dexie, ECharts integration, Playwright; test runner compatible with Angular).
- [ ] Create initial architecture folders.
- [ ] Configure `pl-PL` locale and date/unit conventions.
- [ ] Set up theme tokens for Light/Dark.
- [ ] Configure basic unit and E2E test infrastructure.
- [ ] Verify development server, tests, and production build.
- [ ] Commit stage using an English Conventional Commit.
Acceptance: app runs, builds, routes work, test infrastructure is usable, Git remote/repository is correct, no secrets or local DB files are tracked.
Commit: —
Notes: —

## Stage 2 — Domain models and IndexedDB
Status: COMPLETED
- [ ] Refine domain models and validation.
- [ ] Define repository contracts.
- [ ] Implement Dexie schema and indexes.
- [ ] Add schema versioning/migrations.
- [ ] Add idempotent JSON seed loading.
- [ ] Implement mappers and repository tests.
- [ ] Commit.

## Stage 3 — Local authentication
Status: COMPLETED
- [ ] Registration/login/logout/profile/avatar.
- [ ] Auth state and guards.
- [ ] Multi-user local data isolation.
- [ ] Tests and commit.

## Stage 4 — Exercise catalog
Status: COMPLETED
- [x] Muscle groups and equipment categories.
- [x] 50–100 Polish system exercises in JSON (65 exercises).
- [x] Browse/search/filter/details.
- [x] Custom exercise CRUD/deactivation.
- [x] Seed safety and tests.
- [x] Commit.

### Stage 4 verification / resume checkpoint
- [x] Confirm muscle groups and equipment categories are implemented and used consistently.
- [x] Count system exercises in the seed JSON (target: 50–100, actual: 65); verify Polish names and primary/secondary muscle groups.
- [x] Confirm catalog browse, search, filters, and exercise details work.
- [x] Confirm custom exercise create/edit/deactivate works and system exercises cannot be modified/deleted as custom records.
- [x] Verify seed is idempotent and does not overwrite user data or duplicate system exercises.
- [x] Run relevant unit tests and production build; fix failures (All unit tests passed successfully, production build successful).
- [x] Summarize what is complete, incomplete, broken, and the next concrete task.
- [x] After all acceptance items pass, record commit hash/message and set Stage 4 to COMPLETED.

Suggested Gemini CLI prompt to resume:
“Read GEMINI.md and the relevant project docs. Audit Stage 4 (Exercise catalog) against the checklist in docs/DEVELOPMENT_PLAN.md. Inspect the actual implementation and run relevant tests/build. Do not implement new features yet. Report each item as PASS / PARTIAL / MISSING, with file paths and evidence, then identify the exact next task. Update this plan only with verified facts.”

## Stage 5 — Workout engine
Status: COMPLETED
- [x] Empty workout and plan-based workout.
- [x] Add/remove/reorder/repeat exercises.
- [x] Set management and warm-up flag.
- [x] Autosave/resume after refresh.
- [x] Completion and summary.
- [x] Volume calculations and tests.
- [x] Commit.

## Stage 6 — Workout history and progression
Status: COMPLETED
- [x] History list/details/filters.
- [x] Historical snapshots.
- [x] Progressive overload comparisons/suggestions.
- [x] PRs and estimated 1RM.
- [x] Muscle activity/last trained.
- [x] Tests and commit.

## Stage 7 — Workout plans
Status: NOT STARTED
- [ ] Plan CRUD, duplication, ordering.
- [ ] Start workout from plan without mutating template.
- [ ] Tests and commit.

## Stage 8 — Cardio, steps, measurements
Status: COMPLETED
- [x] Cardio type catalog and activity CRUD.
- [x] Daily steps upsert and uniqueness.
- [x] Measurement type catalog and independent records.
- [x] History and charts.
- [x] Tests and commit.

## Stage 9 — Progress photos and calendar
Status: COMPLETED
- [x] Photo Blob storage, dates, history/comparison.
- [x] Calendar activity display/navigation.
- [x] Tests and commit.

## Stage 10 — Dashboard and muscle visualization
Status: COMPLETED
- [x] Weekly statistics and charts.
- [x] Muscle visualization front/back.
- [x] Last-trained calculation.
- [x] Tests and commit.

## Stage 11 — PWA/offline
Status: COMPLETED
- [x] Manifest/icons/service worker/installability.
- [x] Offline shell and local data behavior.
- [x] Offline tests and commit.
- Notes:
  - Web App Manifest configured (`manifest.webmanifest` & `manifest.json`) with Gym Tracker name, short name, icons, standalone display mode, brand colors.
  - Standard PWA icon set generated (72x72 to 512x512) including maskable icons.
  - Angular Service Worker (`@angular/service-worker`) configured with `ngsw-config.json` prefetching app shell and lazily caching static assets.
  - Security: CacheStorage strictly limited to public app shell assets; private user data kept isolated in IndexedDB.
  - Offline network detection via `NetworkStatusService` with discreet status banner and auto-dismissing reconnection notice.
  - PWA installation prompt handled via `PwaInstallService` (`beforeinstallprompt`, standalone mode detection, install button).
  - Browser limitations: `beforeinstallprompt` is standard on Chromium browsers (Chrome, Edge, Android Webview); iOS Safari requires "Add to Home Screen" from the Share menu.

## Stage 12 — Final QA
Status: COMPLETED
- [x] Full unit/integration suite.
- [x] Playwright critical flows and user isolation.
- [x] Accessibility/responsive/performance review.
- [x] Production build and documentation.
- [x] Final commits.

## Stage 13 — Future Supabase integration (later)
Status: IN PROGRESS (Stage 13C.1 Migration Readiness & Data Ownership Audit Completed)
- [x] Supabase Architecture Plan & Schema Audit (Stage 13A).
- [x] Schema & Security Hardening, RLS, Storage RLS, and Schema Review (Stage 13A.1).
- [x] Final SQL Review & Deployment Readiness (`DEPLOYMENT_READINESS.md`, Stage 13A.2).
- [x] Supabase Auth implementation (`SupabaseAuthService`, login/signup UI, environment configuration, Stage 13B).
- [x] Live Supabase Auth integration & verification documentation (`AUTH_LIVE_VERIFICATION.md`, Stage 13B.1).
- [x] Auth redirect session restoration fix (`waitForSession` in `SupabaseAuthService` & async `authGuard`, Stage 13B.1).
- [x] Local data integration after Supabase auth (Stage 13B.2).
- [x] Supabase user data isolation (`supa_${supaUser.id}` workspace mapping, Stage 13B.3).
- [x] Multi-account isolation audit (`ISOLATION_AUDIT.md`, Stage 13B.4).
- [x] Migration readiness and data ownership audit (`DATA_OWNERSHIP_AUDIT.md`, `CLOUD_SCHEMA_MAPPING.md`, `SYNC_ARCHITECTURE.md`, `INITIAL_IMPORT_PLAN.md`, `STAGE_13C_ROADMAP.md`, Stage 13C.1).
- [ ] Repository implementations and mappers.
- [ ] JSON import/migration workflow.
- [ ] Security and migration tests.
- [ ] Commit.

## Current task
Stage 13C.1 — Migration readiness and data ownership audit: performed read-only audit of Dexie tables and legacy data ownership, produced data ownership classification, cloud schema mapping, sync architecture design, initial import plan, and implementation roadmap (`STAGE_13C_ROADMAP.md`).
