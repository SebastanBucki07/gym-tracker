import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { InitialDataImportService } from './initial-data-import.service';
import { db } from '../../data-access/local/app-database';
import { SyncAuthError } from '../../data-access/contracts/sync.model';

describe('InitialDataImportService (Stage 13D.3 Security & Audit Tests)', () => {
  let importService: InitialDataImportService;
  let currentUserSignal: any;
  let mockSupabaseAuth: any;
  let mockSupabaseClient: any;
  let upsertSpy: any;

  const testSupabaseUserId = 'supa_uuid_import_user_123';
  const otherSupabaseUserId = 'supa_uuid_other_user_999';

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

    const preview = await importService.previewLocalData();
    expect(preview.tableCounts['app_settings']).toBe(1);
    expect(preview.tableCounts['workouts']).toBe(1);
    expect(preview.totalRecords).toBe(2);
  });

  it('should strictly isolate data and ignore foreign user records in Dexie during preview and import', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    // Add record for another user
    await db.workouts.add({
      id: 'w_foreign',
      userId: otherSupabaseUserId,
      name: 'Foreign Workout',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const preview = await importService.previewLocalData();
    expect(preview.tableCounts['workouts']).toBe(0);
    expect(preview.totalRecords).toBe(0);
  });

  it('should detect ambiguous ownership when legacy user_jan_1 records exist and allow override when explicitly requested', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

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
    expect(preview.legacyRecordsCount).toBe(1);

    // Attempting import without override should throw
    await expect(importService.executeImport(false)).rejects.toThrow(/niejednoznacznego właściciela/);

    // Importing with explicit allowAmbiguousOverride = true should succeed
    const progress = await importService.executeImport(true);
    expect(progress.errors.length).toBe(0);
    expect(progress.importedRecords).toBe(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w_legacy', user_id: testSupabaseUserId.replace('supa_', '') }),
      { onConflict: 'id' }
    );
  });

  it('should handle conflict with existing cloud records idempotently via upsert', async () => {
    currentUserSignal.set({ id: testSupabaseUserId, email: 'user@example.com' });

    await db.appSettings.add({
      id: 'set_1',
      userId: testSupabaseUserId,
      theme: 'dark',
      weightUnit: 'kg',
      measurementUnit: 'cm',
      distanceUnit: 'km'
    });

    // Run import twice (simulating retry / resume / cloud conflict)
    const progress1 = await importService.executeImport(true);
    const progress2 = await importService.executeImport(true);

    expect(progress1.importedRecords).toBe(1);
    expect(progress2.importedRecords).toBe(1);
    expect(upsertSpy).toHaveBeenCalledTimes(2);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'set_1', user_id: testSupabaseUserId.replace('supa_', '') }),
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
