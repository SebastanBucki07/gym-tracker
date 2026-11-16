import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'exercises',
        loadComponent: () => import('./features/exercises/exercises.component').then(m => m.ExercisesComponent)
      },
      {
        path: 'workouts/active',
        loadComponent: () => import('./features/workouts/active-workout/active-workout.component').then(m => m.ActiveWorkoutComponent)
      },
      {
        path: 'workouts/history',
        loadComponent: () => import('./features/workouts/history/workout-history.component').then(m => m.WorkoutHistoryComponent)
      },
      {
        path: 'progress-photos',
        loadComponent: () => import('./features/progress-photos/progress-photos.component').then(m => m.ProgressPhotosComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent)
      },
      {
        path: 'cardio',
        loadComponent: () => import('./features/cardio/cardio.component').then(m => m.CardioComponent)
      },
      {
        path: 'steps',
        loadComponent: () => import('./features/steps/steps.component').then(m => m.StepsComponent)
      },
      {
        path: 'measurements',
        loadComponent: () => import('./features/measurements/measurements.component').then(m => m.MeasurementsComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
