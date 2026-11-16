import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ActiveWorkoutService } from '../../features/workouts/active-workout/active-workout.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit {
  authService = inject(AuthService);
  activeWorkoutService = inject(ActiveWorkoutService);
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
