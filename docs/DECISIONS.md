# Gym Tracker — Accepted Decisions

This file records decisions accepted by the project owner. Change only after explicit discussion/approval.

| Topic | Decision |
|---|---|
| Frontend | Angular + TypeScript + SCSS |
| Angular style | Standalone Components |
| State | Angular Signals where appropriate |
| Forms | Reactive Forms |
| UI library | Custom components + Angular CDK; no complete UI framework |
| Charts | ECharts + Angular integration |
| Unit tests | Vitest with compatible Angular setup |
| E2E | Playwright + TypeScript |
| Initial persistence | IndexedDB via Dexie |
| Initial data | JSON seed/import/export |
| Initial backend | None; local-first |
| Future backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Migration | Manual export/import JSON |
| Localization | Polish `pl-PL`, date `DD.MM.YYYY`, kg/cm/km |
| Themes | Dark Mode and Light Mode |
| App type | Responsive SPA/PWA, no SSR |
| Exercise seed | Approximately 50–100 popular Polish exercises |
| Exercise taxonomy | Equipment categories: barbell, dumbbell, machine, cable, bodyweight, kettlebell, resistance-band |
| Exercise muscles | One primary group + optional secondary groups |
| Volume attribution | Primary muscle group only |
| Warm-up sets | Stored, excluded from default training volume/progression statistics |
| Volume | Weight × reps for completed working sets |
| Last trained | Completed workout with at least one completed working set; not in-progress |
| Workout plans | Reusable templates usable on any day, not fixed weekly calendar |
| Active workout | Can start empty or from plan; Add Exercise always available |
| Active workout layout | Desktop exercise list left/details right; responsive vertical mobile |
| User isolation | Every user-owned record has userId; test at least two local users |
| Git | Mandatory from project start; stage commits required |
| Commit language | English only |
| Commit convention | Conventional Commits |
| Git branch | `main` stable; feature branches for larger work |
| Supabase migration | Explicit manual JSON workflow; changing repository does not migrate data |

## Not approved / do not assume
- RIR/RPE tracking.
- Rest timer.
- Fixed weekly workout-plan calendar.
- Automatic weight changes from progression suggestions.
- Any unlisted feature that materially changes scope or data model.
