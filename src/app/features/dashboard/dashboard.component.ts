import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ActiveWorkoutService } from '../workouts/active-workout/active-workout.service';
import { DashboardQueryService, DashboardSummary, DateRangePreset, MuscleActivityStats } from './dashboard.service';
import { MuscleVisualizationComponent } from './muscle-visualization.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MuscleVisualizationComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  activeWorkoutService = inject(ActiveWorkoutService);
  private dashboardQuery = inject(DashboardQueryService);
  private router = inject(Router);

  selectedPreset = signal<DateRangePreset>('current-week');
  summary = signal<DashboardSummary | null>(null);
  loading = signal<boolean>(true);
  selectedMuscle = signal<MuscleActivityStats | null>(null);

  hasActiveWorkout(): boolean {
    const user = this.authService.currentUser();
    return this.activeWorkoutService.hasActiveWorkout(user?.id);
  }

  async ngOnInit() {
    await this.loadDashboard();
  }

  async loadDashboard() {
    const userId = this.authService.getCurrentUserId();

    this.loading.set(true);
    try {
      const data = await this.dashboardQuery.getDashboardSummary(userId, this.selectedPreset());
      this.summary.set(data);
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
    } finally {
      this.loading.set(false);
    }
  }

  onPresetChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value as DateRangePreset;
    this.selectedPreset.set(val);
    this.loadDashboard();
  }

  onMuscleSelected(stats: MuscleActivityStats | null) {
    this.selectedMuscle.set(stats);
    
    // On small screens, scroll to the details card when a muscle is selected
    if (stats && window.innerWidth <= 768) {
      setTimeout(() => {
        const el = document.getElementById('muscle-details-card');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50); // slight delay to allow angular to render the new state
    }
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  }

  formatDate(date?: Date | string): string {
    if (!date) return 'Nigdy';
    const d = new Date(date);
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
