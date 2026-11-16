import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../data-access/local/app-database';
import { LocalWorkoutRepository } from '../../data-access/local/local-workout.repository';
import { LocalCardioRepository } from '../../data-access/local/local-cardio.repository';
import { LocalDailyStepsRepository } from '../../data-access/local/local-daily-steps.repository';
import { LocalMeasurementRepository } from '../../data-access/local/local-measurement.repository';
import { LocalProgressPhotoRepository } from '../../data-access/local/local-progress-photo.repository';
import { Workout, WorkoutSet } from '../../data-access/contracts/workout.model';
import { CardioActivity } from '../../data-access/contracts/cardio.model';
import { DailySteps } from '../../data-access/contracts/daily-steps.model';
import { BodyMeasurement, CANONICAL_BODY_WEIGHT_TYPE_ID } from '../../data-access/contracts/measurement.model';

describe('Offline Functionality & Local Persistence Verification', () => {
  let workoutRepo: LocalWorkoutRepository;
  let cardioRepo: LocalCardioRepository;
  let stepsRepo: LocalDailyStepsRepository;
  let measurementRepo: LocalMeasurementRepository;
  let photoRepo: LocalProgressPhotoRepository;

  beforeEach(async () => {
    workoutRepo = new LocalWorkoutRepository();
    cardioRepo = new LocalCardioRepository();
    stepsRepo = new LocalDailyStepsRepository();
    measurementRepo = new LocalMeasurementRepository();
    photoRepo = new LocalProgressPhotoRepository();

    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.cardioActivities.clear();
    await db.dailySteps.clear();
    await db.bodyMeasurements.clear();
    await db.progressPhotos.clear();
  });

  it('should support full offline workout lifecycle: creation, sets, autosave, and completion', async () => {
    const userId = 'user_offline_1';
    const now = new Date();

    const workout: Workout = {
      id: 'w_offline_1',
      userId,
      name: 'Trening w trybie offline',
      startedAt: now,
      isCompleted: false,
      createdAt: now,
      updatedAt: now
    };

    const sets: WorkoutSet[] = [
      {
        id: 'set_off_1',
        workoutId: 'w_offline_1',
        exerciseId: 'barbell_bench_press',
        exerciseName: 'Wyciskanie',
        setNumber: 1,
        weight: 100,
        repetitions: 5,
        isCompleted: true,
        isWarmup: false
      }
    ];

    // Create active workout in local IndexedDB
    await workoutRepo.create(workout, sets);

    let retrieved = await workoutRepo.getById('w_offline_1');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.isCompleted).toBe(false);

    // Complete workout offline
    await workoutRepo.update('w_offline_1', {
      isCompleted: true,
      completedAt: new Date(),
      durationSeconds: 1800
    });

    retrieved = await workoutRepo.getById('w_offline_1');
    expect(retrieved?.isCompleted).toBe(true);
    expect(retrieved?.durationSeconds).toBe(1800);

    const history = await workoutRepo.getByUserId(userId);
    expect(history.length).toBe(1);
  });

  it('should support offline cardio activity creation, filtering, and deletion', async () => {
    const userId = 'user_offline_1';
    const activity: CardioActivity = {
      id: 'cardio_off_1',
      userId,
      cardioTypeId: 'cardio_running',
      durationMinutes: 40,
      distanceKm: 6.5,
      calories: 450,
      performedAt: new Date()
    };

    await cardioRepo.createActivity(activity);
    let list = await cardioRepo.getActivities(userId);
    expect(list.length).toBe(1);
    expect(list[0].distanceKm).toBe(6.5);

    await cardioRepo.deleteActivity('cardio_off_1');
    list = await cardioRepo.getActivities(userId);
    expect(list.length).toBe(0);
  });

  it('should support offline daily steps upsert and uniqueness', async () => {
    const userId = 'user_offline_1';
    const today = '2026-11-16';

    const steps1: DailySteps = {
      id: `steps_${userId}_${today}`,
      userId,
      date: today,
      stepsCount: 7500,
      updatedAt: new Date()
    };
    await stepsRepo.upsert(steps1);

    let retrieved = await stepsRepo.getByDate(userId, today);
    expect(retrieved?.stepsCount).toBe(7500);

    // Update steps count offline
    const steps2: DailySteps = {
      id: `steps_${userId}_${today}`,
      userId,
      date: today,
      stepsCount: 10500,
      updatedAt: new Date()
    };
    await stepsRepo.upsert(steps2);

    retrieved = await stepsRepo.getByDate(userId, today);
    expect(retrieved?.stepsCount).toBe(10500);

    const range = await stepsRepo.getByRange(userId, today, today);
    expect(range.length).toBe(1);
  });

  it('should support offline body measurements creation and retrieval', async () => {
    const userId = 'user_offline_1';
    const measurement: BodyMeasurement = {
      id: 'meas_off_1',
      userId,
      measurementTypeId: CANONICAL_BODY_WEIGHT_TYPE_ID,
      value: 79.5,
      measuredAt: new Date(),
      notes: 'Zmierzone w trybie offline'
    };

    await measurementRepo.createMeasurement(measurement);
    const list = await measurementRepo.getMeasurements(userId);
    expect(list.length).toBe(1);
    expect(list[0].value).toBe(79.5);
  });

  it('should support offline progress photos storage with binary Blobs', async () => {
    const userId = 'user_offline_1';
    const fakeBlob = new Blob(['offline photo data'], { type: 'image/jpeg' });

    const photo = {
      id: 'photo_off_1',
      userId,
      imageBlob: fakeBlob,
      takenAt: new Date(),
      notes: 'Zdjęcie zrobione offline',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await photoRepo.create(photo);
    const retrieved = await photoRepo.getById('photo_off_1');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.notes).toBe('Zdjęcie zrobione offline');
    expect(retrieved?.imageBlob).toBeTruthy();
  });

  it('should preserve multi-user isolation offline', async () => {
    await workoutRepo.create({
      id: 'w_userA',
      userId: 'user_A',
      name: 'Trening A',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, []);

    await workoutRepo.create({
      id: 'w_userB',
      userId: 'user_B',
      name: 'Trening B',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, []);

    const userAWorkouts = await workoutRepo.getByUserId('user_A');
    expect(userAWorkouts.length).toBe(1);
    expect(userAWorkouts[0].id).toBe('w_userA');

    const userBWorkouts = await workoutRepo.getByUserId('user_B');
    expect(userBWorkouts.length).toBe(1);
    expect(userBWorkouts[0].id).toBe('w_userB');
  });
});
