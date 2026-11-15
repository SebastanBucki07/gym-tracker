
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActiveWorkoutService } from './active-workout.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LocalExerciseRepository } from '../../../data-access/local/local-exercise.repository';
import { Exercise } from '../../../data-access/contracts/exercise.model';
import { MuscleGroup } from '../../../data-access/contracts/muscle-group.model';
import { EquipmentCategory } from '../../../data-access/contracts/equipment-category.model';
import { db } from '../../../data-access/local/app-database';

@Component({
  selector: 'app-active-workout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './active-workout.component.html',
  styleUrl: './active-workout.component.scss'
})
export class ActiveWorkoutComponent implements OnInit {
  public activeWorkoutService = inject(ActiveWorkoutService);

  private authService = inject(AuthService);
  private exerciseRepo = new LocalExerciseRepository();
  private router = inject(Router);

  exercisesCatalog = signal<Exercise[]>([]);
  muscleGroups = signal<MuscleGroup[]>([]);
  equipmentCategories = signal<EquipmentCategory[]>([]);

  showAddExerciseModal = signal(false);
  showSummaryModal = signal(false);
  summaryData = signal<{
  elapsedSeconds: number;
  totalVolume: number;
  completedSetsCount: number;
  totalSetsCount: number;
} | null>(null);

  searchQuery = signal('');
  selectedMuscleGroup = signal('');

  filteredCatalog = signal<Exercise[]>([]);

  async ngOnInit(): Promise<void> {
    const user = this.authService.currentUser();

    if (!user) {
      await this.router.navigate(['/login']);
      return;
    }

    try {
      const [exs, mgs, eqs] = await Promise.all([
        this.exerciseRepo.getAll(user.id),
        db.muscleGroups.toArray(),
        db.equipmentCategories.toArray()
      ]);

      this.exercisesCatalog.set(exs);
      this.filteredCatalog.set(exs);
      this.muscleGroups.set(mgs);
      this.equipmentCategories.set(eqs);

      if (!this.activeWorkoutService.isActive()) {
        const resumed = this.activeWorkoutService.loadFromStorage(user.id);

        if (!resumed) {
          this.activeWorkoutService.startEmptyWorkout(
            user.id,
            'Trening siłowy'
          );
        }
      }

    } catch (error) {
      console.error(
        'Błąd inicjalizacji aktywnego treningu:',
        error
      );

      alert(
        'Nie udało się załadować danych treningu. ' +
        'Sprawdź konsolę przeglądarki.'
      );
    }
  }

  formatTime(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));

    const hrs = Math.floor(safeSeconds / 3600);
    const mins = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  openAddExerciseModal(): void {
    this.searchQuery.set('');
    this.selectedMuscleGroup.set('');

    this.filterCatalog();

    this.showAddExerciseModal.set(true);
  }

  closeAddExerciseModal(): void {
    this.showAddExerciseModal.set(false);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;

    this.searchQuery.set(target.value);

    this.filterCatalog();
  }

  onMuscleGroupFilter(mgId: string): void {
    this.selectedMuscleGroup.set(mgId);

    this.filterCatalog();
  }

  filterCatalog(): void {
    const q = this.searchQuery().toLowerCase().trim();
    const mg = this.selectedMuscleGroup();
    const exs = this.exercisesCatalog();

    const filtered = exs.filter(ex => {

      if (!ex.isActive) return false;

      const matchesQ =
        ex.name.toLowerCase().includes(q) ||
        (ex.description?.toLowerCase().includes(q) ?? false);

      const matchesMg =
        !mg || ex.primaryMuscleGroupId === mg;

      return matchesQ && matchesMg;
    });

    this.filteredCatalog.set(filtered);
  }

  selectExerciseToAdd(exercise: Exercise): void {
    this.activeWorkoutService.addExercise(exercise);

    this.closeAddExerciseModal();
  }

  async finishWorkout(): Promise<void> {
  console.log('=== DIAGNOSTYKA PRZED ZAKOŃCZENIEM ===');

  console.log(
    'Ćwiczenia:',
    this.activeWorkoutService.workoutExercises()
  );

  console.log(
    'Czas:',
    this.activeWorkoutService.elapsedSeconds()
  );

  console.log(
    'Objętość:',
    this.activeWorkoutService.totalVolume()
  );

  console.log(
    'Ukończone serie:',
    this.activeWorkoutService.completedSetsCount()
  );

  console.log(
    'Wszystkie serie:',
    this.activeWorkoutService.totalSetsCount()
  );

  const summary = {
    elapsedSeconds: this.activeWorkoutService.elapsedSeconds(),
    totalVolume: this.activeWorkoutService.totalVolume(),
    completedSetsCount: this.activeWorkoutService.completedSetsCount(),
    totalSetsCount: this.activeWorkoutService.totalSetsCount()
  };

  console.log('ZAPISYWANE PODSUMOWANIE:', summary);

  try {
    const id = await this.activeWorkoutService.completeWorkout();

    if (id) {
      this.summaryData.set(summary);
      this.showSummaryModal.set(true);
    }
  } catch (error) {
    console.error('Błąd podczas zapisywania treningu:', error);

    alert(
      'Nie udało się zapisać treningu. ' +
      'Trening pozostał aktywny. ' +
      'Sprawdź konsolę przeglądarki.'
    );
  }
}
closeSummary(): void {
    this.showSummaryModal.set(false);

    this.router.navigate(['/dashboard']);
  }

  discard(): void {
    if (
      confirm(
        'Czy na pewno chcesz porzucić ten trening? Postęp zostanie utracony.'
      )
    ) {
      this.activeWorkoutService.discardWorkout();

      this.router.navigate(['/dashboard']);
    }
  }

  getMuscleGroupName(id: string): string {
    return this.muscleGroups().find(
      m => m.id === id
    )?.name || id;
  }
}
