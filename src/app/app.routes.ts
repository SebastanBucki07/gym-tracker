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
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'exercises',
    canActivate: [authGuard],
    loadComponent: () => import('./features/exercises/exercises.component').then(m => m.ExercisesComponent)
  },
  {
    path: 'workouts/active',
    canActivate: [authGuard],
    loadComponent: () => import('./features/workouts/active-workout/active-workout.component').then(m => m.ActiveWorkoutComponent)
  },
  {
    path: 'workouts/history',
    canActivate: [authGuard],
    loadComponent: () => import('./features/workouts/history/workout-history.component').then(m => m.WorkoutHistoryComponent)
  },
  {
    path: 'progress-photos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/progress-photos/progress-photos.component').then(m => m.ProgressPhotosComponent)
  },
  {
    path: 'calendar',
    canActivate: [authGuard],
    loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
