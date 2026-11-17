import {
  Injectable,
  signal,
  computed,
  effect,
  Optional,
  Inject,
  InjectionToken
} from '@angular/core';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { NetworkStatusService } from '../pwa/network-status.service';
import { LocalSyncQueueRepository } from '../../data-access/local/local-sync-queue.repository';
import { db } from '../../data-access/local/app-database';
import {
  DEFAULT_SYNC_CONFIG,
  SyncAuthError,
  SyncConfig,
  SyncEntityHandler,
  SyncEntityType,
  SyncOperation,
  SyncProcessResult,
  SyncQueueItem,
  SyncState,
  SyncStatus
} from '../../data-access/contracts/sync.model';
import { fromSupabaseWorkout, fromSupabaseWorkoutSet } from '../../data-access/mappers/workout.mapper';
import { fromSupabaseExercise } from '../../data-access/mappers/exercise.mapper';
import { fromSupabaseBodyMeasurement, fromSupabaseMeasurementType } from '../../data-access/mappers/measurement.mapper';
import { fromSupabaseCardioActivity } from '../../data-access/mappers/cardio.mapper';
import { fromSupabaseDailySteps } from '../../data-access/mappers/steps.mapper';
import { fromSupabaseAppSettings } from '../../data-access/mappers/settings.mapper';
import { fromSupabaseWorkoutPlan } from '../../data-access/mappers/workout-plan.mapper';
import { SupabaseWorkoutRepository } from '../../data-access/supabase/supabase-workout.repository';
import { SupabaseCardioRepository } from '../../data-access/supabase/supabase-cardio.repository';
import { SupabaseExerciseRepository } from '../../data-access/supabase/supabase-exercise.repository';
import { SupabaseMeasurementRepository } from '../../data-access/supabase/supabase-measurement.repository';
import { SupabaseMeasurementTypeRepository } from '../../data-access/supabase/supabase-measurement-type.repository';
import { SupabaseDailyStepsRepository } from '../../data-access/supabase/supabase-daily-steps.repository';
import { SupabaseWorkoutPlanRepository } from '../../data-access/supabase/supabase-workout-plan.repository';
import { SupabaseSettingsRepository } from '../../data-access/supabase/supabase-settings.repository';

export const SYNC_CONFIG = new InjectionToken<Partial<SyncConfig>>('SYNC_CONFIG');

export interface BidirectionalSyncResult extends SyncProcessResult {
  pulledCount: number;
  conflictsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private config: SyncConfig;
  private entityHandlers = new Map<SyncEntityType, SyncEntityHandler>();

  private statusSignal = signal<SyncStatus>('idle');
  private isSyncingSignal = signal<boolean>(false);
  private pendingCountSignal = signal<number>(0);
  private failedCountSignal = signal<number>(0);
  private conflictsCountSignal = signal<number>(0);
  private lastSyncAtSignal = signal<Date | null>(null);
  private lastErrorSignal = signal<string | null>(null);

  private lastKnownUserId: string | null = null;
  private lastKnownOnline = true;
  private syncLock = false;

  readonly status = this.statusSignal.asReadonly();
  readonly isSyncing = this.isSyncingSignal.asReadonly();
  readonly pendingCount = this.pendingCountSignal.asReadonly();
  readonly failedCount = this.failedCountSignal.asReadonly();
  readonly conflictsCount = this.conflictsCountSignal.asReadonly();
  readonly lastSyncAt = this.lastSyncAtSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

  readonly isOnline = computed(() => this.networkStatus?.isOnline() ?? true);
  readonly isAuthenticated = computed(() => this.supabaseAuth?.isAuthenticated() ?? false);
  readonly currentUserId = computed(() => this.supabaseAuth?.currentUser()?.id ?? null);

  readonly state = computed<SyncState>(() => ({
    status: this.statusSignal(),
    isOnline: this.isOnline(),
    isAuthenticated: this.isAuthenticated(),
    userId: this.currentUserId(),
    pendingCount: this.pendingCountSignal(),
    failedCount: this.failedCountSignal(),
    lastSyncAt: this.lastSyncAtSignal(),
    lastError: this.lastErrorSignal()
  }));

  constructor(
    private supabaseAuth: SupabaseAuthService,
    private networkStatus: NetworkStatusService,
    private queueRepository: LocalSyncQueueRepository,
    @Optional() @Inject(SYNC_CONFIG) customConfig?: Partial<SyncConfig>
  ) {
    this.config = {
      ...DEFAULT_SYNC_CONFIG,
      ...customConfig
    };

    this.registerEntityHandler(new SupabaseWorkoutRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseCardioRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseExerciseRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseMeasurementRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseMeasurementTypeRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseDailyStepsRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseWorkoutPlanRepository(supabaseAuth));
    this.registerEntityHandler(new SupabaseSettingsRepository(supabaseAuth));

    if (typeof window !== 'undefined') {
      window.addEventListener('sync-requested', () => {
        const supaUser = this.supabaseAuth.currentUser();
        console.log('sync-requested event received. supaUser:', supaUser, 'isOnline:', this.networkStatus.isOnline());
        if (this.networkStatus.isOnline() && !this.isSyncingSignal() && supaUser && supaUser.id !== 'user_jan_1') {
          this.sync().catch(err => console.error('Sync triggered from event failed:', err));
        } else {
          console.warn('Sync condition not met:', { isOnline: this.networkStatus.isOnline(), isSyncing: this.isSyncingSignal(), supaUser });
        }
      });
    }

    try {
      effect(() => {
        const supaUser = this.supabaseAuth.currentUser();
        const online = this.networkStatus.isOnline();
        this.handleContextChange(supaUser?.id || null, online);
      });
    } catch {
      // In isolated unit tests outside Angular injection context, initialize manually
      const supaUser = this.supabaseAuth?.currentUser?.();
      const online = this.networkStatus?.isOnline?.() ?? true;
      this.handleContextChange(supaUser?.id || null, online);
    }
  }

  async handleContextChange(currentUserId: string | null, isOnline: boolean): Promise<void> {
    const userChanged = currentUserId !== this.lastKnownUserId;
    const onlineChanged = isOnline !== this.lastKnownOnline;

    this.lastKnownUserId = currentUserId;
    this.lastKnownOnline = isOnline;

    if (!currentUserId || currentUserId === 'user_jan_1') {
      this.statusSignal.set('unauthenticated');
      this.pendingCountSignal.set(0);
      this.failedCountSignal.set(0);
      this.conflictsCountSignal.set(0);
      this.lastErrorSignal.set(null);
      return;
    }

    if (userChanged) {
      this.pendingCountSignal.set(0);
      this.failedCountSignal.set(0);
      this.conflictsCountSignal.set(0);
    }

    if (!isOnline) {
      this.statusSignal.set('offline');
      await this.refreshCounts(currentUserId);
      return;
    }

    // Authenticated & Online
    if (this.statusSignal() === 'offline' || this.statusSignal() === 'unauthenticated' || userChanged) {
      this.statusSignal.set('idle');
      this.lastErrorSignal.set(null);
    }

    await this.refreshCounts(currentUserId);

    if ((onlineChanged || userChanged) && isOnline && this.config.autoSyncOnOnline) {
      await this.sync().catch(() => {});
    }
  }

  getActiveSupabaseUserId(): string {
    const supaUser = this.supabaseAuth.currentUser();
    if (!supaUser || !supaUser.id || supaUser.id === 'user_jan_1' || supaUser.id.trim() === '') {
      throw new SyncAuthError(
        'Brak aktywnej sesji Supabase Auth. Synchronizacja wymaga zalogowanego użytkownika.'
      );
    }
    return supaUser.id;
  }

  async refreshCounts(userId?: string): Promise<void> {
    const targetUserId = userId || this.supabaseAuth.currentUser()?.id;
    if (!targetUserId || targetUserId === 'user_jan_1') {
      this.pendingCountSignal.set(0);
      this.failedCountSignal.set(0);
      return;
    }

    try {
      const pending = await this.queueRepository.getPendingCount(targetUserId);
      const failed = await this.queueRepository.getFailedCount(targetUserId);
      this.pendingCountSignal.set(pending);
      this.failedCountSignal.set(failed);
    } catch (err) {
      console.error('Failed to refresh sync queue counts:', err);
    }
  }

  registerEntityHandler(handler: SyncEntityHandler): void {
    this.entityHandlers.set(handler.entityType, handler);
  }

  unregisterEntityHandler(entityType: SyncEntityType): void {
    this.entityHandlers.delete(entityType);
  }

  hasEntityHandler(entityType: SyncEntityType): boolean {
    return this.entityHandlers.has(entityType);
  }

  async enqueue<T = any>(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: T,
    triggerSync = false
  ): Promise<SyncQueueItem<T>> {
    const userId = this.getActiveSupabaseUserId();

    const item = await this.queueRepository.enqueue<T>({
      userId,
      entityType,
      entityId,
      operation,
      payload,
      maxRetries: this.config.maxRetries
    });

    await this.refreshCounts(userId);

    if (triggerSync && this.networkStatus.isOnline() && !this.isSyncingSignal()) {
      await this.sync();
    }

    return item;
  }

  async processQueue(): Promise<SyncProcessResult> {
    const res = await this.sync();
    return {
      processedCount: res.processedCount,
      successCount: res.successCount,
      failedCount: res.failedCount,
      errors: res.errors
    };
  }

  async sync(): Promise<BidirectionalSyncResult> {
    if (this.syncLock) {
      return { processedCount: 0, successCount: 0, failedCount: 0, errors: [], pulledCount: 0, conflictsCount: 0 };
    }

    if (!this.networkStatus.isOnline()) {
      this.statusSignal.set('offline');
      return { processedCount: 0, successCount: 0, failedCount: 0, errors: [], pulledCount: 0, conflictsCount: 0 };
    }

    let userId: string;
    try {
      userId = this.getActiveSupabaseUserId();
    } catch {
      this.statusSignal.set('unauthenticated');
      return { processedCount: 0, successCount: 0, failedCount: 0, errors: [], pulledCount: 0, conflictsCount: 0 };
    }

    this.syncLock = true;
    this.isSyncingSignal.set(true);
    this.statusSignal.set('syncing');

    const result: BidirectionalSyncResult = {
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: [],
      pulledCount: 0,
      conflictsCount: 0
    };

    try {
      // 1. PUSH: Outbox queue processing
      const pendingItems = await this.queueRepository.getPendingItems(userId, this.config.batchSize);

      for (const item of pendingItems) {
        // Verify user ownership strictly
        if (item.userId !== userId) {
          result.errors.push({ itemId: item.id, error: 'Security violation: item user_id does not match active session.' });
          continue;
        }

        result.processedCount++;
        const handler = this.entityHandlers.get(item.entityType);

        if (!handler) {
          continue;
        }

        await this.queueRepository.updateStatus(item.id, 'processing');

        try {
          await handler.push(item);
          await this.queueRepository.updateStatus(item.id, 'synced');
          result.successCount++;
        } catch (pushErr: any) {
          console.error('Supabase PUSH sync error for item:', item, pushErr);
          const errorMessage = pushErr instanceof Error ? pushErr.message : String(pushErr);
          const newStatus = await this.queueRepository.incrementRetry(
            item.id,
            item.maxRetries,
            errorMessage
          );

          result.failedCount++;
          result.errors.push({ itemId: item.id, error: errorMessage });
          this.lastErrorSignal.set(errorMessage);
        }
      }

      // 2. PULL: Inbound delta sync per entity handler
      for (const [entityType, handler] of this.entityHandlers.entries()) {
        if (!handler.pull) continue;

        try {
          const metaId = `${userId}_${entityType}`;
          const metadata = await db.syncMetadata.get(metaId);
          // Apply 5-second overlap buffer to prevent missing records at boundary with identical timestamps
          const since = metadata?.lastPulledAt ? new Date(new Date(metadata.lastPulledAt).getTime() - 5000) : null;

          const remoteRecords = await handler.pull(userId, since);

          // Verify active user session hasn't changed during async network call
          const currentActiveId = this.supabaseAuth.currentUser()?.id;
          if (!currentActiveId || currentActiveId !== userId) {
            break;
          }

          if (remoteRecords && remoteRecords.length > 0) {
            for (const remoteRecord of remoteRecords) {
              const entityId = remoteRecord.id;

              // Check conflict: does local record have active non-synced changes in queue?
              const activeQueueItems = await db.syncQueue
                .where('userId')
                .equals(userId)
                .filter(q => q.entityId === entityId && q.entityType === entityType && q.status !== 'synced')
                .toArray();

              if (activeQueueItems.length > 0) {
                // Conflict detected: local has active changes. Protect local changes.
                result.conflictsCount++;
                result.errors.push({
                  itemId: entityId,
                  error: `Conflict for ${entityType} ${entityId}: local active changes preserved.`
                });
                continue;
              }

              // Handle deleted_at (tombstone)
              if (remoteRecord.deleted_at) {
                await this.applyDeleteLocally(entityType, entityId);
              } else {
                await this.applyRemoteRecordLocally(entityType, remoteRecord);
              }
              result.pulledCount++;
            }
          }

          // Update checkpoint in syncMetadata
          await db.syncMetadata.put({
            id: metaId,
            userId,
            entityType,
            lastPulledAt: new Date(),
            lastPushedAt: new Date(),
            updatedAt: new Date()
          });
        } catch (pullErr: any) {
          const errMsg = pullErr instanceof Error ? pullErr.message : String(pullErr);
          result.errors.push({ itemId: `pull_${entityType}`, error: errMsg });
        }
      }

      await this.refreshCounts(userId);
      this.conflictsCountSignal.set(result.conflictsCount);

      if (result.conflictsCount > 0) {
        this.statusSignal.set('conflict');
      } else if (result.errors.length > 0 && result.failedCount > 0) {
        this.statusSignal.set('error');
      } else if (result.pulledCount > 0 || result.successCount > 0 || result.processedCount > 0) {
        this.statusSignal.set('synced');
        this.lastSyncAtSignal.set(new Date());
        this.lastErrorSignal.set(null);
      } else {
        this.statusSignal.set('idle');
        this.lastErrorSignal.set(null);
        this.lastSyncAtSignal.set(new Date());
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastErrorSignal.set(errorMsg);
      this.statusSignal.set('error');
    } finally {
      this.isSyncingSignal.set(false);
      this.syncLock = false;
    }

    return result;
  }

  private async applyRemoteRecordLocally(entityType: SyncEntityType, record: any): Promise<void> {
    switch (entityType) {
      case 'workout': {
        const workout = fromSupabaseWorkout(record);
        await db.workouts.put(workout);
        if (record.workout_sets && Array.isArray(record.workout_sets)) {
          for (const s of record.workout_sets) {
            const setObj = fromSupabaseWorkoutSet(s);
            await db.workoutSets.put(setObj);
          }
        }
        break;
      }
      case 'exercise': {
        const ex = fromSupabaseExercise(record);
        await db.exercises.put(ex);
        break;
      }
      case 'measurement': {
        const m = fromSupabaseBodyMeasurement(record);
        await db.bodyMeasurements.put(m);
        break;
      }
      case 'measurementType': {
        const t = fromSupabaseMeasurementType(record);
        await db.measurementTypes.put(t);
        break;
      }
      case 'cardio': {
        const c = fromSupabaseCardioActivity(record);
        await db.cardioActivities.put(c);
        break;
      }
      case 'dailySteps': {
        const st = fromSupabaseDailySteps(record);
        await db.dailySteps.put(st);
        break;
      }
      case 'appSettings': {
        const stg = fromSupabaseAppSettings(record);
        await db.appSettings.put(stg);
        break;
      }
      case 'workoutPlan': {
        const p = fromSupabaseWorkoutPlan(record);
        await db.workoutPlans.put(p);
        break;
      }
    }
  }

  private async applyDeleteLocally(entityType: SyncEntityType, entityId: string): Promise<void> {
    switch (entityType) {
      case 'workout':
        await db.workoutSets.where('workoutId').equals(entityId).delete();
        await db.workouts.delete(entityId);
        break;
      case 'exercise':
        await db.exercises.delete(entityId);
        break;
      case 'measurement':
        await db.bodyMeasurements.delete(entityId);
        break;
      case 'measurementType':
        await db.measurementTypes.delete(entityId);
        break;
      case 'cardio':
        await db.cardioActivities.delete(entityId);
        break;
      case 'dailySteps':
        await db.dailySteps.delete(entityId);
        break;
      case 'appSettings':
        await db.appSettings.delete(entityId);
        break;
      case 'workoutPlan':
        await db.workoutPlans.delete(entityId);
        break;
    }
  }

  async retryFailed(): Promise<BidirectionalSyncResult> {
    const userId = this.getActiveSupabaseUserId();
    await this.queueRepository.resetFailed(userId);
    await this.refreshCounts(userId);
    this.lastErrorSignal.set(null);
    return await this.sync();
  }

  async clearQueueForCurrentUser(): Promise<void> {
    const userId = this.getActiveSupabaseUserId();
    await this.queueRepository.clearForUser(userId);
    await this.refreshCounts(userId);
    this.lastErrorSignal.set(null);
    this.statusSignal.set('idle');
  }

  getConfig(): SyncConfig {
    return { ...this.config };
  }
}
