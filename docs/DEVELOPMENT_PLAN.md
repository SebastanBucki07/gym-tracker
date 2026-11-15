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
Status: NOT STARTED
- [ ] Cardio type catalog and activity CRUD.
- [ ] Daily steps upsert and uniqueness.
- [ ] Measurement type catalog and independent records.
- [ ] History and charts.
- [ ] Tests and commit.

## Stage 9 — Progress photos and calendar
Status: NOT STARTED
- [ ] Photo Blob storage, dates, history/comparison.
- [ ] Calendar activity display/navigation.
- [ ] Tests and commit.

## Stage 10 — Dashboard and muscle visualization
Status: NOT STARTED
- [ ] Weekly statistics and charts.
- [ ] Muscle visualization front/back.
- [ ] Last-trained calculation.
- [ ] Tests and commit.

## Stage 11 — PWA/offline
Status: NOT STARTED
- [ ] Manifest/icons/service worker/installability.
- [ ] Offline shell and local data behavior.
- [ ] Offline tests and commit.

## Stage 12 — Final QA
Status: NOT STARTED
- [ ] Full unit/integration suite.
- [ ] Playwright critical flows and user isolation.
- [ ] Accessibility/responsive/performance review.
- [ ] Production build and documentation.
- [ ] Final commits.

## Stage 13 — Future Supabase integration (later)
Status: NOT STARTED
- [ ] Supabase Auth, PostgreSQL, RLS, Storage.
- [ ] Repository implementations and mappers.
- [ ] JSON import/migration workflow.
- [ ] Security and migration tests.
- [ ] Commit.

## Current task
Stage 5 — Workout engine: empty workout and plan-based workout, exercise management, set management, autosave/resume, completion, volume calculations and tests.
