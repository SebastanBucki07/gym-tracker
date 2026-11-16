import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { ActiveWorkoutService } from '../../features/workouts/active-workout/active-workout.service';
import { NetworkStatusService } from '../../core/pwa/network-status.service';
import { PwaInstallService } from '../../core/pwa/pwa-install.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit {
  authService = inject(AuthService);
  supabaseAuth = inject(SupabaseAuthService);
  activeWorkoutService = inject(ActiveWorkoutService);
  networkStatus = inject(NetworkStatusService);
  pwaInstall = inject(PwaInstallService);
  private router = inject(Router);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user && !this.activeWorkoutService.isActive()) {
      this.activeWorkoutService.loadFromStorage(user.id);
    }
  }

  hasActiveWorkout(): boolean {
    const user = this.authService.currentUser();
    return this.activeWorkoutService.hasActiveWorkout(user?.id);
  }

  async installPwa(): Promise<void> {
    await this.pwaInstall.promptInstall();
  }

  reloadForUpdate(): void {
    this.pwaInstall.reloadApp();
  }

  async logout(): Promise<void> {
    this.authService.logout();
    await this.supabaseAuth.signOut();
    this.router.navigate(['/login']);
  }
}
