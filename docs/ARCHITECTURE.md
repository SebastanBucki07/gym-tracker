# Gym Tracker — Technical Architecture

## Stack
- Angular (stable version selected at project setup), TypeScript strict, SCSS.
- Standalone Components, Angular Router, Signals, Reactive Forms, Angular CDK.
- ECharts + ngx-echarts.
- Dexie.js over IndexedDB.
- Vitest (compatible Angular test setup), Playwright + TypeScript.
- SPA, no SSR; PWA/offline.
- Future: Supabase PostgreSQL, Auth, Storage, RLS.

## Architecture principles
Feature-first organization; domain/business logic separated from presentation and infrastructure. Components call application services/use cases, which use repository contracts. Data access implementations are injected. Mappers translate persistence/domain representations and contain no business logic.

Suggested source tree (adapt to actual Angular CLI output; do not force unnecessary folders):
```text
src/
  app/
    core/            # auth, guards, database setup, config, error handling
    shared/           # reusable UI, directives, pipes, utilities
    layout/           # auth and main layouts
    features/
      dashboard/
      workouts/
      exercises/
      workout-plans/
      activity/
      body-measurements/
      progress-photos/
      calendar/
      settings/
    data-access/
      contracts/
      repositories/
      local/
      supabase/
      mappers/
    app.routes.ts
    app.config.ts
    app.component.ts
  assets/data/        # JSON seeds
  styles/             # variables, themes, mixins
e2e/
  fixtures/
  pages/
  tests/
  utils/
```

## Data model guidelines
Use stable IDs (UUID or equivalent), ISO timestamps, explicit nullable/optional fields, createdAt/updatedAt where appropriate, and clear ownership. Avoid storing display labels as relational identity.

Candidate domain entities:
- User
- Exercise
- EquipmentCategory
- MuscleGroup
- Workout
- WorkoutExercise
- WorkoutSet
- WorkoutPlan
- WorkoutPlanExercise
- MeasurementType
- BodyMeasurement
- CardioType
- CardioActivity
- DailySteps
- ProgressPhoto
- AppSettings

Suggested fields (refine before implementation):
- User: id, email, username, avatar reference, createdAt, updatedAt. Local auth credentials belong in a separate local-auth mechanism; never treat browser-side hashes as production security.
- Exercise: id, name, description, primaryMuscleGroupId, secondaryMuscleGroupIds, equipmentCategoryId, image/video refs, source (`system`/`user`), optional userId, isActive, timestamps.
- Workout: id, userId, name, status (`in-progress`/`completed``/`abandoned` if supported), startedAt, optional completedAt, notes, timestamps. Workout exercises/sets may be embedded in the local aggregate and mapped to relational tables later.
- WorkoutExercise: id, exerciseId, order, sets; preserve historical exercise snapshot/metadata where needed.
- WorkoutSet: id, setNumber, weight, repetitions, isCompleted, isWarmup, optional note/completedAt.
- WorkoutPlan: id, userId, name, description, ordered exercises, timestamps.
- WorkoutPlanExercise: id, exerciseId, order, targetSets, targetRepetitions, optional targetWeight.
- MeasurementType: id, name, unit (`kg`/`cm`), isSystem, optional userId, isActive.
- BodyMeasurement: id, userId, measurementTypeId, value, measuredAt.
- CardioType: id, name, isSystem, optional userId, isActive.
- CardioActivity: id, userId, cardioTypeId, durationMinutes, optional distanceKm/calories/averageHeartRate, performedAt, note.
- DailySteps: id, userId, date (date-only string), steps; unique userId+date.
- ProgressPhoto: id, userId, date, Blob or storage reference, metadata.
- AppSettings: id/userId, preferences.

Treat these as candidates, not immutable schemas. Refine validation, constraints, indexes, soft-delete behavior, and timestamps before coding.

## IndexedDB/Dexie
Suggested tables: users, exercises, equipmentCategories, muscleGroups, workouts, workoutPlans, measurementTypes, bodyMeasurements, cardioTypes, cardioActivities, dailySteps, progressPhotos, appSettings.
- Version the schema and implement Dexie migrations.
- Index user-owned records by userId and relevant dates/IDs.
- Enforce unique userId+date for steps.
- Store photo Blobs locally.
- Scope every user query and mutation by userId.
- Keep system seeds separate from custom data and make seeding idempotent.

## Repository contracts
Use contracts such as:
```ts
interface WorkoutRepository {
  getAll(userId: string): Promise<Workout[]>;
  getById(id: string, userId: string): Promise<Workout | undefined>;
  save(workout: Workout): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
}
```
Define equivalent contracts for users, exercises, plans, measurements, cardio, steps, photos, and settings as needed. Local and Supabase implementations must satisfy the same contracts. Prefer ownership-aware APIs and never trust IDs alone for access.

## Supabase mapping
Future tables may normalize aggregates into workouts, workout_exercises, workout_sets, etc. Map domain aggregates to/from relational rows. Apply RLS to all user-owned data and secure Storage paths. Do not rely on client-side userId filtering as authorization.

## Routing
Lazy routes for auth and features; AuthGuard for private routes, GuestGuard for login/register. Consider CanDeactivate only if autosave cannot guarantee safety.

## State
Use Angular Signals for UI/application state where suitable. Avoid duplicating repository data in multiple stores without a clear source of truth. Keep state transitions and calculations in domain/application services.

## Error handling and reliability
- Handle IndexedDB errors and quota failures gracefully.
- Autosave must expose meaningful save status and recoverability.
- Import/export validates schema and references.
- Preserve historical snapshots.
- Offline state must not be confused with remote synchronization.

## Testing
Unit-test pure domain calculations and mappers. Integration-test repositories with IndexedDB test support. Playwright E2E for critical workflows and isolation. Use stable test IDs; do not couple tests to fragile CSS selectors.
