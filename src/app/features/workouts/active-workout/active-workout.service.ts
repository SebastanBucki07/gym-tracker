
import { Injectable, signal, computed, effect } from '@angular/core';
import { Workout, WorkoutSet } from '../../../data-access/contracts/workout.model';
import { WorkoutPlan } from '../../../data-access/contracts/workout-plan.model';
import { Exercise } from '../../../data-access/contracts/exercise.model';
import { LocalWorkoutRepository } from '../../../data-access/local/local-workout.repository';

export interface ActiveWorkoutExercise {
  clientId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscleGroupId?: string;
  order: number;
  sets: WorkoutSet[];
}

@Injectable({
  providedIn: 'root'
})
export class ActiveWorkoutService {
  private workoutRepo = new LocalWorkoutRepository();

  activeWorkout = signal<Workout | null>(null);
  workoutExercises = signal<ActiveWorkoutExercise[]>([]);
  elapsedSeconds = signal<number>(0);

  isActive = computed(() => this.activeWorkout() !== null);

  totalVolume = computed(() => {
    let volume = 0;

    for (const ex of this.workoutExercises()) {
      for (const set of ex.sets) {
        if (set.isCompleted && !set.isWarmup) {
          volume += (set.weight || 0) * (set.repetitions || 0);
        }
      }
    }

    return volume;
  });

  completedSetsCount = computed(() => {
    let count = 0;

    for (const ex of this.workoutExercises()) {
      for (const set of ex.sets) {
        if (set.isCompleted) count++;
      }
    }

    return count;
  });

  totalSetsCount = computed(() => {
    let count = 0;

    for (const ex of this.workoutExercises()) {
      count += ex.sets.length;
    }

    return count;
  });

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect((onCleanup) => {
      if (this.activeWorkout()) {
        this.timerInterval = setInterval(() => {
          this.elapsedSeconds.update(s => s + 1);
          this.saveToStorage();
        }, 1000);

        onCleanup(() => {
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
          }
        });
      }
    });
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  startEmptyWorkout(userId: string, name = 'Trening siłowy'): void {
    const now = new Date();

    const workout: Workout = {
      id: this.generateId('w'),
      userId,
      name,
      startedAt: now,
      isCompleted: false,
      createdAt: now,
      updatedAt: now
    };

    this.activeWorkout.set(workout);
    this.workoutExercises.set([]);
    this.elapsedSeconds.set(0);

    this.saveToStorage();
  }

  startWorkoutFromPlan(
    userId: string,
    plan: WorkoutPlan,
    exercisesCatalog: Exercise[]
  ): void {
    const now = new Date();
    const workoutId = this.generateId('w');

    const workout: Workout = {
      id: workoutId,
      userId,
      name: plan.name,
      startedAt: now,
      isCompleted: false,
      createdAt: now,
      updatedAt: now
    };

    const initialExercises: ActiveWorkoutExercise[] =
      plan.exercises.map((item, index) => {

        const exerciseDef = exercisesCatalog.find(
          e => e.id === item.exerciseId
        );

        const sets: WorkoutSet[] = [];

        for (let i = 1; i <= (item.targetSets || 3); i++) {
          sets.push({
            id: this.generateId('set'),
            workoutId,
            exerciseId: item.exerciseId,
            setNumber: i,
            weight: item.targetWeight || 0,
            repetitions: item.targetRepetitions || 10,
            isCompleted: false,
            isWarmup: false,
            notes: item.notes
          });
        }

        return {
          clientId: this.generateId('ex_item'),
          exerciseId: item.exerciseId,
          exerciseName: exerciseDef
            ? exerciseDef.name
            : 'Ćwiczenie',
          primaryMuscleGroupId: exerciseDef
            ? exerciseDef.primaryMuscleGroupId
            : undefined,
          order: index,
          sets
        };
      });

    this.activeWorkout.set(workout);
    this.workoutExercises.set(initialExercises);
    this.elapsedSeconds.set(0);

    this.saveToStorage();
  }

  addExercise(exercise: Exercise): void {
    const workout = this.activeWorkout();

    if (!workout) return;

    const currentExs = this.workoutExercises();

    const newEx: ActiveWorkoutExercise = {
      clientId: this.generateId('ex_item'),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      primaryMuscleGroupId: exercise.primaryMuscleGroupId,
      order: currentExs.length,
      sets: [
        {
          id: this.generateId('set'),
          workoutId: workout.id,
          exerciseId: exercise.id,
          setNumber: 1,
          weight: 0,
          repetitions: 10,
          isCompleted: false,
          isWarmup: false
        }
      ]
    };

    this.workoutExercises.set([...currentExs, newEx]);

    this.saveToStorage();
  }

  removeExercise(clientId: string): void {
    const updated = this.workoutExercises()
      .filter(ex => ex.clientId !== clientId)
      .map((ex, idx) => ({
        ...ex,
        order: idx
      }));

    this.workoutExercises.set(updated);

    this.saveToStorage();
  }

  reorderExercises(newOrderClientIds: string[]): void {
    const exs = this.workoutExercises();
    const reordered: ActiveWorkoutExercise[] = [];

    newOrderClientIds.forEach((id, idx) => {
      const found = exs.find(e => e.clientId === id);

      if (found) {
        reordered.push({
          ...found,
          order: idx
        });
      }
    });

    this.workoutExercises.set(reordered);

    this.saveToStorage();
  }

  repeatExercise(clientId: string): void {
    const target = this.workoutExercises().find(
      ex => ex.clientId === clientId
    );

    if (!target) return;

    const duplicatedSets: WorkoutSet[] = target.sets.map(
      (s, idx) => ({
        ...s,
        id: this.generateId('set'),
        setNumber: idx + 1,
        isCompleted: false,
        completedAt: undefined
      })
    );

    const duplicatedEx: ActiveWorkoutExercise = {
      clientId: this.generateId('ex_item'),
      exerciseId: target.exerciseId,
      exerciseName: target.exerciseName + ' (Kopia)',
      order: this.workoutExercises().length,
      sets: duplicatedSets
    };

    this.workoutExercises.set([
      ...this.workoutExercises(),
      duplicatedEx
    ]);

    this.saveToStorage();
  }

  addSet(clientId: string): void {
    const workout = this.activeWorkout();

    if (!workout) return;

    const updated = this.workoutExercises().map(ex => {

      if (ex.clientId === clientId) {
        const lastSet = ex.sets[ex.sets.length - 1];

        const newSet: WorkoutSet = {
          id: this.generateId('set'),
          workoutId: workout.id,
          exerciseId: ex.exerciseId,
          setNumber: ex.sets.length + 1,
          weight: lastSet ? lastSet.weight : 0,
          repetitions: lastSet ? lastSet.repetitions : 10,
          isCompleted: false,
          isWarmup: false
        };

        return {
          ...ex,
          sets: [...ex.sets, newSet]
        };
      }

      return ex;
    });

    this.workoutExercises.set(updated);

    this.saveToStorage();
  }

  updateSet(
    clientId: string,
    setId: string,
    changes: Partial<WorkoutSet>
  ): void {
    const updated = this.workoutExercises().map(ex => {

      if (ex.clientId === clientId) {
        const updatedSets = ex.sets.map(set => {
          if (set.id === setId) {
            return {
              ...set,
              ...changes
            };
          }

          return set;
        });

        return {
          ...ex,
          sets: updatedSets
        };
      }

      return ex;
    });

    this.workoutExercises.set(updated);

    this.saveToStorage();
  }

  removeSet(clientId: string, setId: string): void {
    const updated = this.workoutExercises().map(ex => {

      if (ex.clientId === clientId) {
        const filteredSets = ex.sets
          .filter(set => set.id !== setId)
          .map((set, idx) => ({
            ...set,
            setNumber: idx + 1
          }));

        return {
          ...ex,
          sets: filteredSets
        };
      }

      return ex;
    });

    this.workoutExercises.set(updated);

    this.saveToStorage();
  }

  toggleSetCompleted(clientId: string, setId: string): void {
    const updated = this.workoutExercises().map(ex => {

      if (ex.clientId === clientId) {
        const updatedSets = ex.sets.map(set => {

          if (set.id === setId) {
            const isCompleted = !set.isCompleted;

            return {
              ...set,
              isCompleted,
              completedAt: isCompleted
                ? new Date()
                : undefined
            };
          }

          return set;
        });

        return {
          ...ex,
          sets: updatedSets
        };
      }

      return ex;
    });

    this.workoutExercises.set(updated);

    this.saveToStorage();
  }

  toggleSetWarmup(clientId: string, setId: string): void {
    const updated = this.workoutExercises().map(ex => {

      if (ex.clientId === clientId) {
        const updatedSets = ex.sets.map(set => {

          if (set.id === setId) {
            return {
              ...set,
              isWarmup: !set.isWarmup
            };
          }

          return set;
        });

        return {
          ...ex,
          sets: updatedSets
        };
      }

      return ex;
    });

    this.workoutExercises.set(updated);

    this.saveToStorage();
  }

  private getStorageKey(userId?: string): string {
    return 'gym_tracker_active_workout_' + (userId || 'default');
  }

  saveToStorage(): void {
    const workout = this.activeWorkout();

    if (!workout) return;

    const data = {
      workout,
      exercises: this.workoutExercises(),
      elapsedSeconds: this.elapsedSeconds()
    };

    localStorage.setItem(
      this.getStorageKey(workout.userId),
      JSON.stringify(data)
    );
  }

  loadFromStorage(userId: string): boolean {
    const raw = localStorage.getItem(this.getStorageKey(userId));

    if (!raw) return false;

    try {
      const data = JSON.parse(raw);

      if (data && data.workout) {
        this.activeWorkout.set({
          ...data.workout,
          startedAt: new Date(data.workout.startedAt),
          createdAt: new Date(data.workout.createdAt),
          updatedAt: new Date(data.workout.updatedAt)
        });

        this.workoutExercises.set(data.exercises || []);
        this.elapsedSeconds.set(data.elapsedSeconds || 0);

        return true;
      }
    } catch (err) {
      console.error(
        'Error loading active workout from storage:',
        err
      );
    }

    return false;
  }

  hasActiveWorkout(userId?: string): boolean {
    if (this.isActive()) return true;
    if (userId) {
      return this.loadFromStorage(userId);
    }
    return false;
  }

  clearStorage(userId?: string): void {
    const workout = this.activeWorkout();

    const uId = userId || (
      workout ? workout.userId : 'default'
    );

    localStorage.removeItem(this.getStorageKey(uId));
  }

  async completeWorkout(): Promise<string | null> {
    const workout = this.activeWorkout();

    if (!workout) return null;

    const now = new Date();
    const startTime = new Date(workout.startedAt).getTime();
    const diffSeconds = Math.floor((now.getTime() - startTime) / 1000);
    const duration = Math.max(this.elapsedSeconds(), diffSeconds, 60);

    const completedWorkout: Workout = {
      ...workout,
      completedAt: now,
      durationSeconds: duration,
      isCompleted: true,
      updatedAt: now
    };

    const allSets: WorkoutSet[] = [];
    const usedSetIds = new Set<string>();

    for (const ex of this.workoutExercises()) {
      for (const set of ex.sets) {

        let id = set.id;

        // Zabezpieczenie również dla treningów
        // zapisanych wcześniej ze starymi identyfikatorami.
        if (!id || usedSetIds.has(id)) {
          id = this.generateId('set');
        }

        usedSetIds.add(id);

        allSets.push({
          ...set,
          id,
          workoutId: workout.id,
          exerciseName: ex.exerciseName,
          primaryMuscleGroupId: ex.primaryMuscleGroupId
        });
      }
    }

    // Jeśli zapis się nie powiedzie, trening pozostaje aktywny.
    await this.workoutRepo.create(
      completedWorkout,
      allSets
    );

    this.clearStorage(workout.userId);

    this.activeWorkout.set(null);
    this.workoutExercises.set([]);
    this.elapsedSeconds.set(0);

    return completedWorkout.id;
  }

  discardWorkout(): void {
    const workout = this.activeWorkout();

    if (workout) {
      this.clearStorage(workout.userId);
    }

    this.activeWorkout.set(null);
    this.workoutExercises.set([]);
    this.elapsedSeconds.set(0);
  }
}
