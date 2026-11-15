import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { WorkoutHistoryService, WorkoutHistoryItem, PersonalRecord } from './workout-history.service';
import { WorkoutSet } from '../../../data-access/contracts/workout.model';

@Component({
  selector: 'app-workout-history',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './workout-history.component.html',
  styleUrl: './workout-history.component.scss'
})
export class WorkoutHistoryComponent implements OnInit {
  private historyService = inject(WorkoutHistoryService);
  private authService = inject(AuthService);

  workouts = signal<WorkoutHistoryItem[]>([]);
  filteredWorkouts = signal<WorkoutHistoryItem[]>([]);
  personalRecords = signal<PersonalRecord[]>([]);
  
  selectedWorkout = signal<WorkoutHistoryItem | null>(null);
  activeTab = signal<'history' | 'prs'>('history');

  searchTerm = signal<string>('');
  loading = signal<boolean>(true);

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const user = this.authService.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      const items = await this.historyService.getCompletedWorkouts(user.id);
      this.workouts.set(items);
      this.filteredWorkouts.set(items);

      const prs = await this.historyService.getPersonalRecords(user.id);
      this.personalRecords.set(prs);
    } catch (err) {
      console.error('Error loading workout history:', err);
    } finally {
      this.loading.set(false);
    }
  }

  filterWorkouts() {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      this.filteredWorkouts.set(this.workouts());
      return;
    }

    const filtered = this.workouts().filter(item => {
      const nameMatch = item.workout.name.toLowerCase().includes(term);
      const exerciseMatch = item.sets.some(s => 
        (s.exerciseName && s.exerciseName.toLowerCase().includes(term))
      );
      return nameMatch || exerciseMatch;
    });

    this.filteredWorkouts.set(filtered);
  }

  selectWorkout(item: WorkoutHistoryItem) {
    this.selectedWorkout.set(item);
  }

  closeDetails() {
    this.selectedWorkout.set(null);
  }

  async deleteWorkout(workoutId: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten trening z historii?')) return;

    try {
      await this.historyService.deleteWorkout(workoutId);
      if (this.selectedWorkout()?.workout.id === workoutId) {
        this.selectedWorkout.set(null);
      }
      await this.loadData();
    } catch (err) {
      console.error('Error deleting workout:', err);
    }
  }

  getGroupedSets(sets: WorkoutSet[]): { exerciseName: string; sets: WorkoutSet[] }[] {
    const map = new Map<string, WorkoutSet[]>();
    
    for (const set of sets) {
      const name = set.exerciseName || 'Ćwiczenie';
      if (!map.has(name)) {
        map.set(name, []);
      }
      map.get(name)!.push(set);
    }

    return Array.from(map.entries()).map(([exerciseName, sets]) => ({
      exerciseName,
      sets: sets.sort((a, b) => a.setNumber - b.setNumber)
    }));
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins} min ${secs}s`;
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${mins}`;
  }
}
