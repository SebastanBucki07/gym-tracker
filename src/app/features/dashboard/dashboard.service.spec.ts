import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardQueryService } from './dashboard.service';
import { db } from '../../data-access/local/app-database';
import { Workout, WorkoutSet } from '../../data-access/contracts/workout.model';
import { CardioActivity } from '../../data-access/contracts/cardio.model';
import { DailySteps } from '../../data-access/contracts/daily-steps.model';
import { BodyMeasurement } from '../../data-access/contracts/measurement.model';

describe('DashboardQueryService', () => {
  let service: DashboardQueryService;

  beforeEach(async () => {
    service = new DashboardQueryService();
    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.cardioActivities.clear();
    await db.dailySteps.clear();
    await db.bodyMeasurements.clear();
    await db.measurementTypes.clear();
  });

  it('should aggregate strength, cardio, steps, measurements and muscle activity correctly', async () => {
    const userId = 'user_dash_1';
    const now = new Date();

    // 1. Seed Workout
    const workoutId = 'w_1';
    const workout: Workout = {
      id: workoutId,
      userId,
      name: 'Trening Siłowy',
      startedAt: now,
      completedAt: now,
      durationSeconds: 3600,
      isCompleted: true,
      createdAt: now,
      updatedAt: now
    };
    await db.workouts.add(workout);

    const sets: WorkoutSet[] = [
      {
        id: 'set_1',
        workoutId,
        exerciseId: 'barbell_bench_press',
        exerciseName: 'Wyciskanie',
        primaryMuscleGroupId: 'chest',
        setNumber: 1,
        weight: 80,
        repetitions: 10,
        isCompleted: true,
        isWarmup: false
      },
      {
        id: 'set_2',
        workoutId,
        exerciseId: 'barbell_bench_press',
        exerciseName: 'Wyciskanie',
        primaryMuscleGroupId: 'chest',
        setNumber: 2,
        weight: 60,
        repetitions: 12,
        isCompleted: true,
        isWarmup: true // warmup should be excluded from volume/working sets
      }
    ];
    await db.workoutSets.bulkAdd(sets);

    // 2. Seed Cardio
    await db.cardioTypes.put({ id: 'cardio_treadmill', name: 'Bieżnia', isSystem: true });
    const cardio: CardioActivity = {
      id: 'c_1',
      userId,
      cardioTypeId: 'cardio_treadmill',
      durationMinutes: 30,
      distanceKm: 4.0,
      calories: 300,
      performedAt: now
    };
    await db.cardioActivities.add(cardio);

    // 3. Seed Steps
    const dateStr = service.toLocalDateString(now);
    const steps: DailySteps = {
      id: 'steps_1',
      userId,
      date: dateStr,
      stepsCount: 11000,
      updatedAt: now
    };
    await db.dailySteps.add(steps);

    // 4. Seed Measurement
    const meas: BodyMeasurement = {
      id: 'm_1',
      userId,
      measurementTypeId: 'meas_type_weight',
      value: 77.0,
      measuredAt: now
    };
    await db.measurementTypes.put({ id: 'meas_type_weight', name: 'Waga ciała', unit: 'kg', isSystem: true });
    await db.bodyMeasurements.add(meas);

    const summary = await service.getDashboardSummary(userId, 'current-week');

    expect(summary.strength.workoutsCount).toBe(1);
    expect(summary.strength.totalVolume).toBe(800); // 80 * 10 (warmup excluded)
    expect(summary.strength.totalSets).toBe(1); // warmup excluded

    expect(summary.cardio.sessionsCount).toBe(1);
    expect(summary.cardio.totalDurationMinutes).toBe(30);
    expect(summary.cardio.totalDistanceKm).toBe(4.0);
    expect(summary.cardio.typeBreakdown.length).toBe(1);
    expect(summary.cardio.typeBreakdown[0].typeName).toBe('Bieżnia');
    expect(summary.cardio.typeBreakdown[0].count).toBe(1);
    expect(summary.cardio.typeBreakdown[0].duration).toBe(30);

    expect(summary.steps.totalSteps).toBe(11000);
    expect(summary.steps.daysMeetingGoal).toBe(1);

    expect(summary.measurements.latestWeight).toBe(77.0);

    const chestStats = summary.muscleActivities.find(m => m.muscleGroupId === 'chest');
    expect(chestStats).toBeTruthy();
    expect(chestStats?.workoutCount).toBe(1);
    expect(chestStats?.workingSetsCount).toBe(1);
  });

  it('should enforce multi-user isolation', async () => {
    const now = new Date();
    await db.dailySteps.add({
      id: 'steps_u1',
      userId: 'user_1',
      date: service.toLocalDateString(now),
      stepsCount: 10000,
      updatedAt: now
    });

    await db.dailySteps.add({
      id: 'steps_u2',
      userId: 'user_2',
      date: service.toLocalDateString(now),
      stepsCount: 5000,
      updatedAt: now
    });

    const summaryUser1 = await service.getDashboardSummary('user_1', 'current-week');
    expect(summaryUser1.steps.totalSteps).toBe(10000);

    const summaryUser2 = await service.getDashboardSummary('user_2', 'current-week');
    expect(summaryUser2.steps.totalSteps).toBe(5000);
  });

  it('should retrieve latest body weight sorted by date and compute weightChange relative to previous measurement', async () => {
    const userId = 'user_weight_test';
    await db.measurementTypes.put({ id: 'meas_type_weight', name: 'Waga ciała', unit: 'kg', isSystem: true });

    // Insert 3 measurements out of chronological order
    await db.bodyMeasurements.bulkAdd([
      {
        id: 'm_mid',
        userId,
        measurementTypeId: 'meas_type_weight',
        value: 79.0,
        measuredAt: new Date('2026-11-10T08:00:00Z')
      },
      {
        id: 'm_latest',
        userId,
        measurementTypeId: 'meas_type_weight',
        value: 78.2, // latest
        measuredAt: new Date('2026-11-15T08:00:00Z')
      },
      {
        id: 'm_oldest',
        userId,
        measurementTypeId: 'meas_type_weight',
        value: 80.5,
        measuredAt: new Date('2026-11-01T08:00:00Z')
      }
    ]);

    const summary = await service.getDashboardSummary(userId, 'current-month');
    expect(summary.measurements.latestWeight).toBe(78.2);
    // previous was 79.0 -> 78.2 - 79.0 = -0.8
    expect(summary.measurements.weightChange).toBe(-0.8);
  });

  it('should handle empty measurement history gracefully', async () => {
    const summary = await service.getDashboardSummary('user_no_meas', 'current-week');
    expect(summary.measurements.latestWeight).toBeUndefined();
    expect(summary.measurements.weightChange).toBeUndefined();
    expect(summary.measurements.recentMeasurements.length).toBe(0);
  });

  it('should isolate body measurements between different users', async () => {
    await db.measurementTypes.put({ id: 'meas_type_weight', name: 'Waga ciała', unit: 'kg', isSystem: true });

    await db.bodyMeasurements.add({
      id: 'm_user_a',
      userId: 'user_A',
      measurementTypeId: 'meas_type_weight',
      value: 70.0,
      measuredAt: new Date()
    });

    await db.bodyMeasurements.add({
      id: 'm_user_b',
      userId: 'user_B',
      measurementTypeId: 'meas_type_weight',
      value: 95.0,
      measuredAt: new Date()
    });

    const summaryA = await service.getDashboardSummary('user_A', 'current-week');
    expect(summaryA.measurements.latestWeight).toBe(70.0);

    const summaryB = await service.getDashboardSummary('user_B', 'current-week');
    expect(summaryB.measurements.latestWeight).toBe(95.0);
  });

  it('should retrieve weight measurement even if referencing legacy type ID before migration', async () => {
    await db.measurementTypes.bulkPut([
      { id: 'meas_type_weight', name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'type_weight_user_legacy', userId: 'user_legacy', name: 'Waga ciała', unit: 'kg', isSystem: true }
    ]);

    await db.bodyMeasurements.add({
      id: 'm_legacy',
      userId: 'user_legacy',
      measurementTypeId: 'type_weight_user_legacy',
      value: 84.5,
      measuredAt: new Date()
    });

    const summary = await service.getDashboardSummary('user_legacy', 'current-week');
    expect(summary.measurements.latestWeight).toBe(84.5);
  });
});
