# Gym Tracker

Gym Tracker is a modern, responsive progressive web application (PWA) designed for tracking strength workouts, exercise routines, progressive overload, body measurements, cardio activities, and physique progress.

## Features

- **Strength Workouts & Plans**: Create and perform workouts, manage custom workout plans, and track sets, reps, weight, and warm-up flags.
- **Exercise Catalog**: Built-in comprehensive exercise database with muscle group classification and equipment categories.
- **Progressive Overload & Personal Records**: Monitor strength gains, training volume, and estimated 1RM.
- **Cardio & Daily Steps**: Track cardiovascular activities and daily step counts.
- **Body Measurements & Progress Photos**: Record body metrics and track physical changes visually with IndexedDB photo storage.
- **Muscle Activity Visualization**: Anatomical heatmap visualization showing primary/secondary muscle group engagement and days since last trained.
- **Calendar & Dashboard**: Comprehensive training history and statistics overview.
- **Offline-First / PWA**: Local storage via IndexedDB with Dexie.js for complete offline functionality.
- **Localization**: Fully in Polish (pl-PL locale, DD.MM.YYYY date format, kg units).

## Technology Stack

- **Frontend**: Angular (Standalone Components, Signals, Reactive Forms, Angular CDK)
- **Styling**: SCSS, Custom CSS Properties (Dark/Light themes)
- **Charts**: Apache ECharts via `ngx-echarts`
- **Database**: IndexedDB with Dexie.js
- **Testing**: Vitest (Unit tests), Playwright (E2E tests)
- **Future Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)

## Development Setup

1. Clone repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```
3. Open `http://localhost:4200/` in your browser.

## Testing

- Run unit tests:
  ```bash
  npm test
  ```
- Run E2E tests:
  ```bash
  npx playwright test
  ```

## License

MIT
