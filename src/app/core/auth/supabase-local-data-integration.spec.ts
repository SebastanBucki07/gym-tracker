import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../data-access/local/app-database';
import { LocalWorkoutRepository } from '../../data-access/local/local-workout.repository';
import { LocalCardioRepository } from '../../data-access/local/local-cardio.repository';
import { LocalDailyStepsRepository } from '../../data-access/local/local-daily-steps.repository';
import { LocalMeasurementRepository } from '../../data-access/local/local-measurement.repository';
import { AuthService } from './auth.service';
import { Workout, WorkoutSet } from '../../data-access/contracts/workout.model';
import { CardioActivity } from '../../data-access/contracts/cardio.model';
import { DailySteps } from '../../data-access/contracts/daily-steps.model';
import { BodyMeasurement, CANONICAL_BODY_WEIGHT_TYPE_ID } from '../../data-access/contracts/measurement.model';

describe('Supabase Auth & Local-First Dexie Integration (Stage 13B.2)', () => {
  let authService: AuthService;
  let workoutRepo: LocalWorkoutRepository;
  let cardioRepo: LocalCardioRepository;
  let stepsRepo: LocalDailyStepsRepository;
  let measurementRepo: LocalMeasurementRepository;

  beforeEach(async () => {
    authService = new AuthService();
    workoutRepo = new LocalWorkoutRepository();
    cardioRepo = new LocalCardioRepository();
    stepsRepo = new LocalDailyStepsRepository();
    measurementRepo = new LocalMeasurementRepository();

    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.cardioActivities.clear();
    await db.dailySteps.clear();
    await db.bodyMeasurements.clear();
    await db.users.clear();
    
    // Seed test local user
    await db.users.add({
      id: 'user_jan_1',
      username: 'Jan Kowalski',
      email: 'jan@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it('1. A Supabase-authenticated user (without local profile selection) can load local Dexie data using fallback userId', async () => {
    // Simulate Supabase authenticated state where local AuthService current user is logged out (null)
    authService.logout();

    const fallbackUserId = authService.getCurrentUserId();
    expect(fallbackUserId).toBe('user_jan_1');

    // Seed local Dexie data for fallback user
    const workout: Workout = {
      id: 'w_supa_1',
      userId: fallbackUserId,
      name: 'Trening Supabase User',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await workoutRepo.create(workout, []);

    const loaded = await workoutRepo.getByUserId(fallbackUserId);
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe('Trening Supabase User');
  });

  it('2. A Supabase-authenticated user can create a workout locally in Dexie', async () => {
    authService.logout();
    const userId = authService.getCurrentUserId();

    const workout: Workout = {
      id: 'w_supa_create',
      userId,
      name: 'Nowy trening w chmurze',
      startedAt: new Date(),
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const sets: WorkoutSet[] = [
      {
        id: 'set_1',
        workoutId: 'w_supa_create',
        exerciseId: 'barbell_bench_press',
        setNumber: 1,
        weight: 80,
        repetitions: 10,
        isCompleted: true,
        isWarmup: false
      }
    ];

    await workoutRepo.create(workout, sets);
    const retrieved = await workoutRepo.getById('w_supa_create');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.name).toBe('Nowy trening w chmurze');
  });

  it('3. A Supabase-authenticated user can create cardio, steps, and measurements locally', async () => {
    authService.logout();
    const userId = authService.getCurrentUserId();
    const today = '2026-11-16';

    // Cardio
    const cardio: CardioActivity = {
      id: 'c_supa_1',
      userId,
      cardioTypeId: 'cardio_running',
      durationMinutes: 25,
      performedAt: new Date()
    };
    await cardioRepo.createActivity(cardio);
    const cardioList = await cardioRepo.getActivities(userId);
    expect(cardioList.length).toBe(1);

    // Steps
    const steps: DailySteps = {
      id: `steps_${userId}_${today}`,
      userId,
      date: today,
      stepsCount: 12345,
      updatedAt: new Date()
    };
    await stepsRepo.upsert(steps);
    const stepsRetrieved = await stepsRepo.getByDate(userId, today);
    expect(stepsRetrieved?.stepsCount).toBe(12345);

    // Measurements
    const meas: BodyMeasurement = {
      id: 'm_supa_1',
      userId,
      measurementTypeId: CANONICAL_BODY_WEIGHT_TYPE_ID,
      value: 77.4,
      measuredAt: new Date()
    };
    await measurementRepo.createMeasurement(meas);
    const measList = await measurementRepo.getMeasurements(userId);
    expect(measList.length).toBe(1);
    expect(measList[0].value).toBe(77.4);
  });

  it('4. Opening tabs does not require Supabase application tables (dexie standalone)', async () => {
    authService.logout();
    const userId = authService.getCurrentUserId();

    const workouts = await workoutRepo.getByUserId(userId);
    const cardio = await cardioRepo.getActivities(userId);
    const steps = await stepsRepo.getByRange(userId, '2026-11-01', '2026-11-30');
    const measurements = await measurementRepo.getMeasurements(userId);

    expect(Array.isArray(workouts)).toBe(true);
    expect(Array.isArray(cardio)).toBe(true);
    expect(Array.isArray(steps)).toBe(true);
    expect(Array.isArray(measurements)).toBe(true);
  });

  it('5. Local profile authentication still works alongside Supabase Auth', async () => {
    await authService.login('jan@example.com');
    expect(authService.getCurrentUserId()).toBe('user_jan_1');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('6. Logging out does not delete local Dexie records', async () => {
    const userId = 'user_jan_1';
    await workoutRepo.create({
      id: 'w_persist',
      userId,
      name: 'Przetrwały trening',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, []);

    authService.logout();

    const records = await workoutRepo.getByUserId(userId);
    expect(records.some(r => r.name === 'Przetrwały trening')).toBe(true);
  });
});
