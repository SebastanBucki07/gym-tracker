import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { MainLayoutComponent } from './main-layout.component';
import { AuthService } from '../../core/auth/auth.service';
import { ActiveWorkoutService } from '../../features/workouts/active-workout/active-workout.service';
import { NetworkStatusService } from '../../core/pwa/network-status.service';
import { PwaInstallService } from '../../core/pwa/pwa-install.service';
import { signal } from '@angular/core';

describe('MainLayoutComponent', () => {
  let currentUserSignal: any;
  let activeWorkoutSignal: any;
  let isOnlineSignal: any;
  let showReconnectedSignal: any;
  let canInstallSignal: any;

  beforeEach(async () => {
    currentUserSignal = signal({
      id: 'user_layout_1',
      username: 'Jan Kowalski',
      email: 'jan@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    activeWorkoutSignal = signal(null);
    isOnlineSignal = signal(true);
    showReconnectedSignal = signal(false);
    canInstallSignal = signal(false);

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
        },
        {
          provide: NetworkStatusService,
          useValue: {
            isOnline: isOnlineSignal,
            showReconnectedNotice: showReconnectedSignal,
            dismissReconnectedNotice: () => showReconnectedSignal.set(false)
          }
        },
        {
          provide: PwaInstallService,
          useValue: {
            canInstall: canInstallSignal,
            isInstalled: signal(false),
            updateAvailable: signal(false),
            promptInstall: () => Promise.resolve(true),
            reloadApp: () => {}
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

  it('should show offline banner when offline', () => {
    isOnlineSignal.set(false);
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const offlineBanner = compiled.querySelector('.offline-bar');
    expect(offlineBanner).toBeTruthy();
    expect(offlineBanner?.textContent).toContain('Tryb offline');
  });

  it('should show reconnected notice when back online', () => {
    showReconnectedSignal.set(true);
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const reconnectedBanner = compiled.querySelector('.reconnected-bar');
    expect(reconnectedBanner).toBeTruthy();
    expect(reconnectedBanner?.textContent).toContain('Połączenie z siecią zostało przywrócone');
  });

  it('should show install button when canInstall is true', () => {
    canInstallSignal.set(true);
    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const installBtn = compiled.querySelector('.install-pwa-btn');
    expect(installBtn).toBeTruthy();
    expect(installBtn?.textContent).toContain('Zainstaluj');
  });
});
