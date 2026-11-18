import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../data-access/local/app-database';
import { LocalWorkoutRepository } from '../../data-access/local/local-workout.repository';
import { LocalCardioRepository } from '../../data-access/local/local-cardio.repository';
import { LocalDailyStepsRepository } from '../../data-access/local/local-daily-steps.repository';
import { LocalMeasurementRepository } from '../../data-access/local/local-measurement.repository';
import { AuthService } from './auth.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { Workout, WorkoutSet } from '../../data-access/contracts/workout.model';
import { CardioActivity } from '../../data-access/contracts/cardio.model';
import { DailySteps } from '../../data-access/contracts/daily-steps.model';
import { BodyMeasurement, CANONICAL_BODY_WEIGHT_TYPE_ID } from '../../data-access/contracts/measurement.model';

describe('Supabase Auth & Local-First Dexie Integration (Stage 13B.2 & 13B.3 Isolation)', () => {
  let authService: AuthService;
  let supabaseAuth: SupabaseAuthService;
  let workoutRepo: LocalWorkoutRepository;
  let cardioRepo: LocalCardioRepository;
  let stepsRepo: LocalDailyStepsRepository;
  let measurementRepo: LocalMeasurementRepository;

  beforeEach(async () => {
    supabaseAuth = new SupabaseAuthService();
    authService = new AuthService(supabaseAuth);
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
  });

  it('1. A Supabase-authenticated user gets a distinct local workspace ID (supa_...) and can load local Dexie data', async () => {
    const supaId = '99999999-9999-9999-9999-999999999999';
    (supabaseAuth as any).userSignal.set({ id: supaId, email: 'supa@example.com' });
    authService.logout();

    const workspaceId = authService.getCurrentUserId();
    expect(workspaceId).toBe(`supa_${supaId}`);

    const workout: Workout = {
      id: 'w_supa_1',
      userId: workspaceId,
      name: 'Trening Supabase User',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await workoutRepo.create(workout, []);

    const loaded = await workoutRepo.getByUserId(workspaceId);
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe('Trening Supabase User');
  });

  it('2. A Supabase-authenticated user can create a workout locally in Dexie under their distinct workspace', async () => {
    const supaId = '88888888-8888-8888-8888-888888888888';
    (supabaseAuth as any).userSignal.set({ id: supaId, email: 'supa2@example.com' });
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
    expect(retrieved?.userId).toBe(`supa_${supaId}`);
  });

  it('3. A Supabase-authenticated user can create cardio, steps, and measurements locally', async () => {
    const supaId = '77777777-7777-7777-7777-777777777777';
    (supabaseAuth as any).userSignal.set({ id: supaId, email: 'supa3@example.com' });
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

  it('4. Local profile authentication still works alongside Supabase Auth', async () => {
    const localUser = {
      id: 'user_local_test',
      username: 'Lokalny Użytkownik',
      email: 'local@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.users.add(localUser);

    (supabaseAuth as any).userSignal.set(null);
    await authService.login('local@example.com');

    expect(authService.getCurrentUserId()).toBe('user_local_test');
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('5. Logging out of Supabase does not delete local Dexie records', async () => {
    const supaId = '66666666-6666-6666-6666-666666666666';
    (supabaseAuth as any).userSignal.set({ id: supaId, email: 'supa4@example.com' });
    authService.logout();
    const userId = authService.getCurrentUserId();

    await workoutRepo.create({
      id: 'w_persist',
      userId,
      name: 'Przetrwały trening Supabase',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, []);

    // Simulate Supabase logout
    (supabaseAuth as any).userSignal.set(null);

    const records = await workoutRepo.getByUserId(userId);
    expect(records.length).toBe(1);
    expect(records[0].name).toBe('Przetrwały trening Supabase');
  });
});
