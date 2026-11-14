# Gym Tracker — Project Specification

## 1. Goal
Build a modern, responsive personal gym and fitness tracking web application. Users can track strength training, workout plans, progressive overload, personal records, cardio, daily steps, body measurements, progress photos, muscle activity, and training history/calendar.

The app must initially work locally without an external backend. Its architecture must allow later Supabase integration without rewriting business logic or UI.

## 2. Users and authentication
- Local registration, login, logout, profile, and avatar.
- Support at least two local users for testing isolation.
- Every user-owned record includes `userId`; repositories enforce ownership for reads, updates, and deletes.
- Local authentication is for development/personal local use, not production security. Do not store or treat browser-side password hashes as production-grade authentication.
- Future production authentication: Supabase Auth and RLS.

## 3. Navigation
Main sections:
1. Dashboard
2. Workout history
3. Exercises
4. Active workout
5. Workout plans
6. Cardio & steps
7. Body measurements
8. Progress photos
9. Calendar
10. Settings

Suggested routes:
- `/login`, `/register`
- `/dashboard`
- `/workouts/history`
- `/workouts/:id`
- `/workouts/active`
- `/exercises`
- `/plans`
- `/activity`
- `/measurements`
- `/progress-photos`
- `/calendar`
- `/settings`

Use lazy loading, AuthGuard, GuestGuard, and suitable not-found handling.

## 4. Dashboard
- User avatar and logout.
- Weight chart, body-measurement charts, cardio and steps charts.
- Recent workouts and quick action to start a workout.
- Weekly statistics: total training volume, volume per primary muscle group, workouts, working sets, trained muscle groups, PRs, average daily steps.
- Week runs Monday–Sunday.
- Anatomical muscle visualization for the selected week.
- Days since each muscle group was last trained.
- In-progress workouts are not considered completed training.

## 5. Exercise catalog
- Seed approximately 50–100 popular exercises using JSON.
- Polish names and descriptions.
- Equipment categories: barbell (`barbell`), dumbbell (`dumbbell`), machine (`machine`), cable (`cable`), bodyweight (`bodyweight`), kettlebell (`kettlebell`), resistance band (`resistance-band`).
- Each exercise has a stable ID, name, description, exactly one primary muscle group, zero or more secondary muscle groups, equipment category, optional image/video, source (`system`/`user`), optional owner `userId`, active flag, timestamps.
- Browse, search, filter by muscle/equipment, view details.
- Create/edit/deactivate custom exercises.
- Keep system catalog separate from user exercises. Seed updates must never overwrite user-created exercises or historical workout data.

## 6. Muscle groups
Catalog:
- `chest` — Klatka piersiowa
- `back` — Plecy
- `shoulders` — Barki
- `biceps` — Biceps
- `triceps` — Triceps
- `forearms` — Przedramiona
- `abs` — Brzuch
- `glutes` — Pośladki
- `quadriceps` — Czworogłowe uda
- `hamstrings` — Dwugłowe uda
- `calves` — Łydki
- `traps` — Czworoboczne

Training volume is attributed exclusively to the primary muscle group. Secondary groups are for engagement/anatomical visualization unless requirements are explicitly changed.

## 7. Active workout
- Start empty or from a plan.
- Add Exercise must always be available, including for an empty workout.
- Desktop: exercise list on left, selected exercise/set details on right; muscle visualization alongside.
- Mobile: responsive vertical layout.
- Add/remove/reorder exercises; the same exercise may appear more than once.
- Sets contain weight, repetitions, completion status, warm-up flag, optional note, and completion timestamp.
- Warm-up sets are stored in history but excluded from default volume and progression statistics.
- Autosave, resume after refresh, loss prevention, workout completion, and summary.
- Changes to an active workout created from a plan must not modify the plan template.

## 8. Training volume, progression, PR
- Volume = weight × repetitions.
- Count only completed working sets (`isCompleted=true`, `isWarmup=false`, valid weight/repetitions).
- Attribute volume only to the exercise primary muscle group.
- Progressive overload: previous performance/weights/repetitions, comparisons, history, and informational weight-increase suggestions; never automatically change user input.
- PRs: highest weight, highest repetitions, estimated 1RM. Label estimated 1RM clearly as an estimate.

## 9. Workout history
- List, filter, and inspect completed workouts.
- Details include date, duration, exercises, sets, reps, weights, volume, and muscle groups.
- Preserve historical exercise names/metadata when catalog entries are edited/deactivated.

## 10. Workout plans
Plans are reusable templates usable on any day, not a fixed weekly schedule (e.g. Push/Pull/Legs).
- Create, edit, duplicate, delete, and start from plan.
- Plan includes name, description, ordered exercises, target sets/repetitions, optional target weight.
- Starting a plan creates a separate workout instance.

## 11. Cardio and steps
Cardio record: ID, userId, cardio type ID, duration, optional distance/calories/average heart rate, performed date/time, optional note.
- Editable cardio-type catalog with stable IDs; seed examples: treadmill, stationary bike, elliptical, walking, running, swimming, rowing, other (Polish UI names).
- Rename must not alter historical records; deactivate rather than break references.
- Steps: one record per user/date; updates replace the daily value. Enforce unique `userId + date`.

## 12. Body measurements
Initial types: weight, chest, biceps, waist, hips, thigh, calf (Polish labels).
- Users can add custom measurement types.
- Independent measurement dates; only selected measurements need be recorded on a given day.
- History and separate charts per measurement type.
- Edit/delete records.
- Use a MeasurementType catalog and BodyMeasurement records.

## 13. Progress photos
- Upload photos with date, browse history, compare dates.
- Associate with user.
- Initially store image Blobs in IndexedDB; future Supabase Storage with secure policies.
- Validate files and avoid unnecessary duplication.

## 14. Muscle visualization
- Neutral anatomical figure, front and back.
- Highlight individual muscle groups.
- Show trained groups during active workout and weekly summary.
- Show days since last training.
- Last-trained date is based on a completed workout containing at least one completed working set for the group; ignore in-progress/abandoned workouts and warm-up-only activity.

## 15. Calendar
Show strength workouts, cardio, steps, and tracked activity. Navigate dates and inspect activity. Monday is first day of week.

## 16. Profile and settings
- Avatar/profile.
- Preferences and theme.
- Units.
- Measurement and cardio type settings.
- JSON export/import.
- App settings.

## 17. Import/export
- Export structured JSON backup.
- Import validates structure, schema version, records, and references.
- Avoid accidental overwrite; report results clearly.
- Support idempotency where appropriate.
- Provide backup before destructive operations.
- Manual migration to Supabase uses export/import JSON.
- Switching repository implementations does not automatically migrate local data.

## 18. UI/UX
- Custom UI components + Angular CDK; no complete UI framework unless approved.
- Modern, professional fitness dashboard, clear hierarchy, reusable components, accessible controls.
- Dark and Light themes, preference persisted, CSS custom properties.
- One responsive application for desktop/tablet/mobile.
- Semantic HTML, keyboard navigation, visible focus, labels, sufficient contrast, accessible dialogs.

## 19. PWA/offline
- Manifest, icons, service worker, installability, offline application shell.
- IndexedDB persistence and offline access to local data after initial load.
- Clearly distinguish local persistence from backend synchronization; do not claim Supabase sync while offline.

## 20. Testing
Unit/integration tests for calculations, PR/1RM, date/week boundaries, muscle activity, repositories, mappers, import/export validation.
Playwright E2E: authentication, user isolation, exercises CRUD, active workout/autosave/resume/completion/volume, plans, measurements, cardio/steps, import/export, offline.
Use fixtures, useful Page Objects, stable `data-testid` selectors.
