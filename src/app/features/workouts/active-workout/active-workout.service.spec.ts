import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ActiveWorkoutService } from './active-workout.service';
import { db } from '../../../data-access/local/app-database';

describe('ActiveWorkoutService', () => {
  let service: ActiveWorkoutService;

  beforeEach(async () => {
    await db.exercises.clear();
    await db.workouts.clear();
    await db.workoutSets.clear();
    localStorage.clear();

    TestBed.configureTestingModule({});
    service = TestBed.inject(ActiveWorkoutService);
  });

  it('should start empty workout', () => {
    service.startEmptyWorkout('user_1', 'Mój trening');
    expect(service.isActive()).toBe(true);
    expect(service.activeWorkout()?.name).toBe('Mój trening');
    expect(service.activeWorkout()?.userId).toBe('user_1');
    expect(service.workoutExercises().length).toBe(0);
  });

  it('should add exercise and manage sets', () => {
    service.startEmptyWorkout('user_1');
    const mockEx = {
      id: 'ex_1',
      name: 'Wyciskanie',
      primaryMuscleGroupId: 'chest' as const,
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'barbell' as const,
      source: 'system' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    service.addExercise(mockEx);
    expect(service.workoutExercises().length).toBe(1);

    const clientExId = service.workoutExercises()[0].clientId;
    const set1Id = service.workoutExercises()[0].sets[0].id;

    // Update set weight and reps
    service.updateSet(clientExId, set1Id, { weight: 100, repetitions: 8 });
    
    // Toggle completed
    service.toggleSetCompleted(clientExId, set1Id);

    // Volume should be 100 * 8 = 800
    expect(service.totalVolume()).toBe(800);
    expect(service.completedSetsCount()).toBe(1);
  });

  it('should exclude warmup and incomplete sets from volume', () => {
    service.startEmptyWorkout('user_1');
    const mockEx = {
      id: 'ex_1',
      name: 'Przysiad',
      primaryMuscleGroupId: 'quadriceps' as const,
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'barbell' as const,
      source: 'system' as const,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    service.addExercise(mockEx);
    const clientExId = service.workoutExercises()[0].clientId;
    const set1Id = service.workoutExercises()[0].sets[0].id;

    // Set 1: warmup, completed (should not count towards volume)
    service.updateSet(clientExId, set1Id, { weight: 60, repetitions: 10 });
    service.toggleSetWarmup(clientExId, set1Id);
    service.toggleSetCompleted(clientExId, set1Id);

    expect(service.totalVolume()).toBe(0);

    // Add set 2: working set, completed
    service.addSet(clientExId);
    const set2Id = service.workoutExercises()[0].sets[1].id;
    service.updateSet(clientExId, set2Id, { weight: 100, repetitions: 5 });
    service.toggleSetCompleted(clientExId, set2Id);

    expect(service.totalVolume()).toBe(500); // 100 * 5
  });
});
