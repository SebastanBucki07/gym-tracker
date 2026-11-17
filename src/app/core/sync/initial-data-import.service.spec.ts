import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { InitialDataImportService } from './initial-data-import.service';
import { db } from '../../data-access/local/app-database';
import { SyncAuthError } from '../../data-access/contracts/sync.model';

describe('InitialDataImportService (Stage 13D.3)', () => {
  let importService: InitialDataImportService;
  let currentUserSignal: any;
  let mockSupabaseAuth: any;
  let mockSupabaseClient: any;
  let upsertSpy: any;

  const testSupabaseUserId = 'supa_uuid_import_user_123';

  beforeEach(async () => {
    await db.appSettings.clear();
    await db.exercises.clear();
    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.workoutPlans.clear();
    await db.bodyMeasurements.clear();
    await db.cardioActivities.clear();
    await db.dailySteps.clear();
    await db.progressPhotos.clear();
    await db.measurementTypes.clear();

    currentUserSignal = signal<any>(null);

    upsertSpy = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient = {
      from: vi.fn().mockImplementation((table: string) => ({
        upsert: upsertSpy
      }))
    };

    mockSupabaseAuth = {
      currentUser: currentUserSignal,
      isAuthenticated: signal<boolean>(false),
      getSupabaseClient: () => mockSupabaseClient
    };

    importService = new InitialDataImportService(mockSupabaseAuth);
  });

  it('should throw SyncAuthError when attempting preview or import without active Supabase session', async () => {
    await expect(importService.previewLocalData()).rejects.toThrow(SyncAuthError);
    await expect(importService.executeImport()).rejects.toThrow(SyncAuthError);
  });

  it('should reject legacy user_jan_1 during session checks', async () => {
    currentUserSignal.set({ id: 'user_jan_1', email: 'jan@example.com' });
    await expect(importService.previewLocalData()).rejects.toThrow(SyncAuthError);
  });

  it('should detect empty local database and return 0 counts', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });
    const preview = await importService.previewLocalData();

    expect(preview.totalRecords).toBe(0);
    expect(preview.hasAmbiguousOwnership).toBe(false);
  });

  it('should preview local records correctly for authenticated Supabase user', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    // Seed local data
    await db.appSettings.add({
      id: 'set_1',
      userId: testSupabaseUserId,
      theme: 'dark',
      weightUnit: 'kg',
      measurementUnit: 'cm',
      distanceUnit: 'km'
    });

    await db.workouts.add({
      id: 'w_1',
      userId: testSupabaseUserId,
      name: 'Push Workout',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.workoutSets.add({
      id: 's_1',
      workoutId: 'w_1',
      exerciseId: 'ex_1',
      setNumber: 1,
      weight: 80,
      repetitions: 10,
      isCompleted: true,
      isWarmup: false
    });

    const preview = await importService.previewLocalData();
    expect(preview.tableCounts['app_settings']).toBe(1);
    expect(preview.tableCounts['workouts']).toBe(1);
    expect(preview.tableCounts['workout_sets']).toBe(1);
    expect(preview.totalRecords).toBe(3);
  });

  it('should detect ambiguous ownership when legacy user_jan_1 records exist', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    // Add legacy record
    await db.workouts.add({
      id: 'w_legacy',
      userId: 'user_jan_1',
      name: 'Legacy Workout',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const preview = await importService.previewLocalData();
    expect(preview.hasAmbiguousOwnership).toBe(true);
    expect(preview.legacyRecordsCount).toBeGreaterThan(0);

    // Attempting import without override should fail
    await expect(importService.executeImport(false)).rejects.toThrow(/niejednoznacznego właściciela/);
  });

  it('should execute import successfully respecting dependency order and idempotency upsert', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    await db.appSettings.add({
      id: 'set_1',
      userId: testSupabaseUserId,
      theme: 'dark',
      weightUnit: 'kg',
      measurementUnit: 'cm',
      distanceUnit: 'km'
    });

    const progress = await importService.executeImport(true);

    expect(progress.importedRecords).toBe(1);
    expect(progress.errors.length).toBe(0);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('app_settings');
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'set_1', user_id: testSupabaseUserId }),
      { onConflict: 'id' }
    );
  });

  it('should handle partial table/record errors gracefully and collect them', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    await db.appSettings.add({
      id: 'set_1',
      userId: testSupabaseUserId,
      theme: 'dark',
      weightUnit: 'kg',
      measurementUnit: 'cm',
      distanceUnit: 'km'
    });

    upsertSpy.mockResolvedValueOnce({ error: { message: 'Network constraint failure' } });

    const progress = await importService.executeImport(true);
    expect(progress.errors.length).toBe(1);
    expect(progress.errors[0]).toContain('Network constraint failure');
  });

  it('should preserve local Dexie data intact after import execution', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    await db.appSettings.add({
      id: 'set_1',
      userId: testSupabaseUserId,
      theme: 'dark',
      weightUnit: 'kg',
      measurementUnit: 'cm',
      distanceUnit: 'km'
    });

    await importService.executeImport(true);

    const localSettings = await db.appSettings.get('set_1');
    expect(localSettings).toBeDefined();
    expect(localSettings?.userId).toBe(testSupabaseUserId);
  });
});
