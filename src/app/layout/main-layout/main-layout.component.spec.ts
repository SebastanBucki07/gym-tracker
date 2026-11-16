import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '../../core/auth/auth.service';
import { ActiveWorkoutService } from '../../features/workouts/active-workout/active-workout.service';
import { signal } from '@angular/core';

describe('MainLayoutComponent', () => {
  let currentUserSignal: any;
  let activeWorkoutSignal: any;

  beforeEach(async () => {
    currentUserSignal = signal({
      id: 'user_layout_1',
      username: 'Jan Kowalski',
      email: 'jan@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    activeWorkoutSignal = signal(null);

    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUserSignal,
            logout: () => {}
          }
        },
        {
          provide: ActiveWorkoutService,
          useValue: {
            activeWorkout: activeWorkoutSignal,
            isActive: () => activeWorkoutSignal() !== null,
            hasActiveWorkout: () => activeWorkoutSignal() !== null,
            loadFromStorage: () => false
          }
        }
      ]
    }).compileComponents();
  });

  it('should create layout component and show user info and default "Nowy trening" button', () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.username')?.textContent).toContain('Jan Kowalski');
    expect(compiled.querySelector('.workout-btn')?.textContent).toContain('Nowy trening');
    expect(compiled.querySelector('.user-avatar')?.textContent).toContain('J');
  });

  it('should display "Kontynuuj trening" when a workout is active', () => {
    activeWorkoutSignal.set({
      id: 'w_active_1',
      userId: 'user_layout_1',
      name: 'Trening w toku',
      startedAt: new Date(),
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const btn = compiled.querySelector('.workout-btn');
    expect(btn?.textContent).toContain('Kontynuuj trening');
    expect(btn?.classList.contains('in-progress')).toBe(true);
  });
});
