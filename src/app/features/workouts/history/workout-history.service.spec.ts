import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkoutHistoryService } from './workout-history.service';
import { db } from '../../../data-access/local/app-database';
import { Workout, WorkoutSet } from '../../../data-access/contracts/workout.model';

describe('WorkoutHistoryService', () => {
  let service: WorkoutHistoryService;

  beforeEach(async () => {
    await db.workouts.clear();
    await db.workoutSets.clear();
    localStorage.clear();

    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkoutHistoryService);
  });

  it('should calculate PRs and estimated 1RM correctly', async () => {
    const userId = 'user_test';
    const workoutId = 'w_1';
    const now = new Date();

    const workout: Workout = {
      id: workoutId,
      userId,
      name: 'Trening A',
      startedAt: now,
      completedAt: now,
      isCompleted: true,
      createdAt: now,
      updatedAt: now
    };

    const sets: WorkoutSet[] = [
      {
        id: 's_1',
        workoutId,
        exerciseId: 'ex_bench',
        exerciseName: 'Wyciskanie',
        primaryMuscleGroupId: 'chest',
        setNumber: 1,
        weight: 100,
        repetitions: 5,
        isCompleted: true,
        isWarmup: false
      },
      {
        id: 's_2',
        workoutId,
        exerciseId: 'ex_bench',
        exerciseName: 'Wyciskanie',
        primaryMuscleGroupId: 'chest',
        setNumber: 2,
        weight: 90,
        repetitions: 10,
        isCompleted: true,
        isWarmup: false
      }
    ];

    await db.workouts.add(workout);
    await db.workoutSets.bulkAdd(sets);

    const prs = await service.getPersonalRecords(userId);
    expect(prs.length).toBe(1);
    expect(prs[0].exerciseId).toBe('ex_bench');
    expect(prs[0].maxWeight).toBe(100);
    expect(prs[0].maxWeightReps).toBe(5);
    expect(prs[0].maxReps).toBe(10);
    // Epley formula max across sets (90kg x 10 gives 120kg 1RM)
    expect(prs[0].estimated1RM).toBe(120);
  });

  it('should calculate muscle last trained activity correctly', async () => {
    const userId = 'user_test';
    const workoutId = 'w_2';
    const now = new Date();

    const workout: Workout = {
      id: workoutId,
      userId,
      name: 'Trening Pleców',
      startedAt: now,
      completedAt: now,
      isCompleted: true,
      createdAt: now,
      updatedAt: now
    };

    const sets: WorkoutSet[] = [
      {
        id: 's_back',
        workoutId,
        exerciseId: 'ex_pull',
        exerciseName: 'Podciąganie',
        primaryMuscleGroupId: 'back',
        setNumber: 1,
        weight: 0,
        repetitions: 8,
        isCompleted: true,
        isWarmup: false
      }
    ];

    await db.workouts.add(workout);
    await db.workoutSets.bulkAdd(sets);

    const activity = await service.getMuscleActivity(userId);
    const backActivity = activity.find(a => a.muscleGroupId === 'back');
    const chestActivity = activity.find(a => a.muscleGroupId === 'chest');

    expect(backActivity?.daysAgo).toBe(0);
    expect(backActivity?.workoutName).toBe('Trening Pleców');
    expect(chestActivity?.lastTrainedDate).toBeUndefined();
  });

  it('should provide progressive overload suggestions', async () => {
    const userId = 'user_test';
    const workoutId = 'w_3';
    const now = new Date();

    const workout: Workout = {
      id: workoutId,
      userId,
      name: 'Trening Nóg',
      startedAt: now,
      completedAt: now,
      isCompleted: true,
      createdAt: now,
      updatedAt: now
    };

    const sets: WorkoutSet[] = [
      {
        id: 's_squat',
        workoutId,
        exerciseId: 'ex_squat',
        exerciseName: 'Przysiad',
        primaryMuscleGroupId: 'quadriceps',
        setNumber: 1,
        weight: 80,
        repetitions: 12,
        isCompleted: true,
        isWarmup: false
      }
    ];

    await db.workouts.add(workout);
    await db.workoutSets.bulkAdd(sets);

    const suggestion = await service.getProgressiveOverloadSuggestion(userId, 'ex_squat');
    expect(suggestion).not.toBeNull();
    expect(suggestion?.previousWeight).toBe(80);
    expect(suggestion?.previousReps).toBe(12);
    expect(suggestion?.suggestedWeight).toBe(82.5);
  });
});
