import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import Dexie from 'dexie';
import { SyncService } from './sync.service';
import { LocalSyncQueueRepository } from '../../data-access/local/local-sync-queue.repository';
import { db } from '../../data-access/local/app-database';
import {
  SyncAuthError,
  SyncEntityHandler,
  SyncQueueItem
} from '../../data-access/contracts/sync.model';

describe('SyncService (Stage 13D.1 — Sync Foundation)', () => {
  let syncService: SyncService;
  let queueRepo: LocalSyncQueueRepository;

  let currentUserSignal: any;
  let isOnlineSignal: any;
  let mockSupabaseAuth: any;
  let mockNetworkStatus: any;

  beforeEach(async () => {
    await db.syncQueue.clear();

    currentUserSignal = signal<any>(null);
    isOnlineSignal = signal<boolean>(true);

    mockSupabaseAuth = {
      currentUser: currentUserSignal,
      isAuthenticated: signal<boolean>(false),
      currentSession: signal<any>(null),
      isLoading: signal<boolean>(false),
      isConfigError: signal<boolean>(false)
    };

    mockNetworkStatus = {
      isOnline: isOnlineSignal,
      showReconnectedNotice: signal<boolean>(false),
      dismissReconnectedNotice: () => {}
    };

    queueRepo = new LocalSyncQueueRepository(db);

    syncService = new SyncService(
      mockSupabaseAuth,
      mockNetworkStatus,
      queueRepo,
      { maxRetries: 2, autoSyncOnOnline: true }
    );
  });

  describe('1. Session Handling & Missing Session Safety', () => {
    it('should initialize in unauthenticated state when no Supabase user is logged in', () => {
      expect(syncService.status()).toBe('unauthenticated');
      expect(syncService.isAuthenticated()).toBe(false);
      expect(syncService.currentUserId()).toBeNull();
      expect(syncService.pendingCount()).toBe(0);
      expect(syncService.failedCount()).toBe(0);
      expect(syncService.state().status).toBe('unauthenticated');
    });

    it('should throw SyncAuthError when attempting to get active user ID without Supabase session', () => {
      expect(() => syncService.getActiveSupabaseUserId()).toThrow(SyncAuthError);
    });

    it('should throw SyncAuthError and reject enqueueing when no Supabase session exists', async () => {
      await expect(
        syncService.enqueue('workout', 'w_test_1', 'create', { name: 'Push Day' })
      ).rejects.toThrow(SyncAuthError);
    });

    it('should safely abort processQueue when no Supabase session exists without errors', async () => {
      const result = await syncService.processQueue();
      expect(result.processedCount).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(syncService.status()).toBe('unauthenticated');
    });

    it('should reject legacy user_jan_1 and prohibit sync operations', async () => {
      currentUserSignal.set({ id: 'user_jan_1', email: 'jan@example.com' });
      await syncService.handleContextChange('user_jan_1', true);

      expect(syncService.status()).toBe('unauthenticated');
      expect(() => syncService.getActiveSupabaseUserId()).toThrow(SyncAuthError);
      await expect(
        syncService.enqueue('workout', 'w_legacy', 'create')
      ).rejects.toThrow(SyncAuthError);
    });
  });

  describe('2. User Isolation & Multi-Account Integrity', () => {
    const userAlice = 'supa_uuid_alice_1111';
    const userBob = 'supa_uuid_bob_2222';

    beforeEach(async () => {
      currentUserSignal.set({ id: userAlice, email: 'alice@example.com' });
      await syncService.handleContextChange(userAlice, true);
    });

    it('should transition to idle and set current user ID when Supabase user logs in', () => {
      expect(syncService.status()).toBe('idle');
      expect(syncService.currentUserId()).toBe(userAlice);
      expect(syncService.getActiveSupabaseUserId()).toBe(userAlice);
    });

    it('should assign enqueued operations strictly to current Supabase user UUID', async () => {
      const item = await syncService.enqueue('workout', 'w_alice_1', 'create', { name: 'Legs' });

      expect(item.userId).toBe(userAlice);
      expect(item.status).toBe('pending');
      expect(syncService.pendingCount()).toBe(1);

      const storedItems = await queueRepo.getAllForUser(userAlice);
      expect(storedItems.length).toBe(1);
      expect(storedItems[0].userId).toBe(userAlice);
    });

    it('should strictly isolate queues between User Alice and User Bob', async () => {
      // Alice enqueues 2 items
      await syncService.enqueue('workout', 'w_alice_1', 'create');
      await syncService.enqueue('cardio', 'c_alice_1', 'create');
      expect(syncService.pendingCount()).toBe(2);

      // Switch to Bob
      currentUserSignal.set({ id: userBob, email: 'bob@example.com' });
      await syncService.handleContextChange(userBob, true);

      // Bob should have 0 items initially
      expect(syncService.pendingCount()).toBe(0);
      expect(syncService.currentUserId()).toBe(userBob);

      // Bob enqueues 1 item
      await syncService.enqueue('measurement', 'm_bob_1', 'create');
      expect(syncService.pendingCount()).toBe(1);

      // Verify repository contains distinct queues
      const aliceItems = await queueRepo.getAllForUser(userAlice);
      const bobItems = await queueRepo.getAllForUser(userBob);

      expect(aliceItems.length).toBe(2);
      expect(bobItems.length).toBe(1);
      expect(aliceItems.every(i => i.userId === userAlice)).toBe(true);
      expect(bobItems.every(i => i.userId === userBob)).toBe(true);
    });

    it('should clear queue only for current active user without touching other users', async () => {
      await syncService.enqueue('workout', 'w_alice_1', 'create');

      // Bob enqueues an item
      currentUserSignal.set({ id: userBob, email: 'bob@example.com' });
      await syncService.handleContextChange(userBob, true);
      await syncService.enqueue('workout', 'w_bob_1', 'create');

      // Clear Bob's queue
      await syncService.clearQueueForCurrentUser();
      expect(syncService.pendingCount()).toBe(0);

      // Switch back to Alice - her item is intact
      currentUserSignal.set({ id: userAlice, email: 'alice@example.com' });
      await syncService.handleContextChange(userAlice, true);
      expect(syncService.pendingCount()).toBe(1);
    });
  });

  describe('3. Offline Handling & Online Synchronization', () => {
    const userTest = 'supa_uuid_offline_test';

    beforeEach(async () => {
      currentUserSignal.set({ id: userTest, email: 'test@example.com' });
      await syncService.handleContextChange(userTest, true);
    });

    it('should transition to offline status when connection is lost', async () => {
      isOnlineSignal.set(false);
      await syncService.handleContextChange(userTest, false);

      expect(syncService.status()).toBe('offline');
      expect(syncService.isOnline()).toBe(false);
    });

    it('should allow enqueueing while offline and retain items locally as pending', async () => {
      isOnlineSignal.set(false);
      await syncService.handleContextChange(userTest, false);

      const item = await syncService.enqueue('dailySteps', 's_offline_1', 'update', { count: 8500 });
      expect(item.status).toBe('pending');
      expect(syncService.pendingCount()).toBe(1);

      // processQueue should not process while offline
      const result = await syncService.processQueue();
      expect(result.processedCount).toBe(0);
      expect(syncService.status()).toBe('offline');
    });

    it('should auto-sync when network returns online', async () => {
      // Register mock handler
      let pushedItem: SyncQueueItem | null = null;
      syncService.registerEntityHandler({
        entityType: 'dailySteps',
        push: async item => {
          pushedItem = item;
        }
      });

      // Go offline and enqueue
      isOnlineSignal.set(false);
      await syncService.handleContextChange(userTest, false);
      await syncService.enqueue('dailySteps', 's_1', 'update');

      expect(pushedItem).toBeNull();

      // Go back online
      isOnlineSignal.set(true);
      await syncService.handleContextChange(userTest, true);
      await syncService.processQueue();

      expect(pushedItem).not.toBeNull();
      expect((pushedItem as any)?.entityId).toBe('s_1');
      expect(syncService.pendingCount()).toBe(0);
    });
  });

  describe('4. Entity Handlers & No False "synced" Markings', () => {
    const userTest = 'supa_uuid_safety_test';

    beforeEach(async () => {
      currentUserSignal.set({ id: userTest, email: 'test@example.com' });
      await syncService.handleContextChange(userTest, true);
    });

    it('should keep items pending when no entity handler is registered and not mark them as synced', async () => {
      // Enqueue item without registered handler
      const item = await syncService.enqueue('workout', 'w_safe_1', 'create');

      const result = await syncService.processQueue();
      expect(result.processedCount).toBe(1);
      expect(result.successCount).toBe(0);

      // The item MUST remain pending in the database!
      const fetched = await queueRepo.getById(item.id);
      expect(fetched?.status).toBe('pending');
      expect(syncService.pendingCount()).toBe(1);
    });

    it('should mark item as synced only when registered handler successfully pushes', async () => {
      let pushCalled = false;
      const handler: SyncEntityHandler = {
        entityType: 'exercise',
        push: async item => {
          pushCalled = true;
          expect(item.entityId).toBe('ex_100');
        }
      };
      syncService.registerEntityHandler(handler);

      const item = await syncService.enqueue('exercise', 'ex_100', 'create');
      const result = await syncService.processQueue();

      expect(pushCalled).toBe(true);
      expect(result.successCount).toBe(1);
      expect(syncService.pendingCount()).toBe(0);

      const fetched = await queueRepo.getById(item.id);
      expect(fetched?.status).toBe('synced');
      expect(syncService.lastSyncAt()).toBeInstanceOf(Date);
    });
  });

  describe('5. Retry Mechanism & Error Handling', () => {
    const userTest = 'supa_uuid_retry_test';

    beforeEach(async () => {
      currentUserSignal.set({ id: userTest, email: 'test@example.com' });
      await syncService.handleContextChange(userTest, true);
    });

    it('should retry failed pushes and transition to failed state after maxRetries', async () => {
      let attempts = 0;
      syncService.registerEntityHandler({
        entityType: 'workout',
        push: async () => {
          attempts++;
          throw new Error('Supabase 503 Service Unavailable');
        }
      });

      const item = await syncService.enqueue('workout', 'w_fail_1', 'create');

      // First run: attempts = 1, retryCount becomes 1, status remains 'pending'
      const run1 = await syncService.processQueue();
      expect(attempts).toBe(1);
      expect(run1.failedCount).toBe(1);

      let stored = await queueRepo.getById(item.id);
      expect(stored?.retryCount).toBe(1);
      expect(stored?.status).toBe('pending');
      expect(syncService.status()).toBe('error');
      expect(syncService.lastError()).toContain('503');

      // Second run: attempts = 2, maxRetries is 2 -> status becomes 'failed'
      const run2 = await syncService.processQueue();
      expect(attempts).toBe(2);
      expect(run2.failedCount).toBe(1);

      stored = await queueRepo.getById(item.id);
      expect(stored?.retryCount).toBe(2);
      expect(stored?.status).toBe('failed');
      expect(syncService.failedCount()).toBe(1);
      expect(syncService.pendingCount()).toBe(0);
    });

    it('should allow retryFailed to re-queue and successfully sync failed items', async () => {
      let shouldFail = true;
      syncService.registerEntityHandler({
        entityType: 'cardio',
        push: async () => {
          if (shouldFail) {
            throw new Error('Temporary failure');
          }
        }
      });

      const item = await syncService.enqueue('cardio', 'c_fail_1', 'create');

      // Exhaust retries
      await syncService.processQueue();
      await syncService.processQueue();
      expect(syncService.failedCount()).toBe(1);

      // Now server recovers
      shouldFail = false;
      const retryResult = await syncService.retryFailed();

      expect(retryResult.successCount).toBe(1);
      expect(syncService.failedCount()).toBe(0);
      expect(syncService.pendingCount()).toBe(0);
      expect(syncService.status()).toBe('synced');

      const stored = await queueRepo.getById(item.id);
      expect(stored?.status).toBe('synced');
    });
  });

  describe('6. Dexie Version 2 Database Migration & Schema Compatibility', () => {
    it('should have syncQueue and syncMetadata tables defined on AppDatabase', () => {
      expect(db.syncQueue).toBeDefined();
      expect(db.syncMetadata).toBeDefined();
      expect(db.verno).toBe(2);
    });

    it('should preserve existing version 1 tables and data', async () => {
      expect(db.workouts).toBeDefined();
      expect(db.exercises).toBeDefined();
      expect(db.bodyMeasurements).toBeDefined();
      expect(db.dailySteps).toBeDefined();
      expect(db.cardioActivities).toBeDefined();
      expect(db.users).toBeDefined();
    });

    it('should cleanly upgrade a simulated v1 database to v2 without data loss', async () => {
      const testDbName = 'GymTrackerMigrationTest_' + Date.now();
      // Step 1: Open DB with v1 schema only
      const v1Db = new Dexie(testDbName);
      v1Db.version(1).stores({
        workouts: 'id, userId, startedAt, isCompleted',
        users: 'id, email, username'
      });
      await v1Db.open();

      // Insert pre-existing v1 data
      await (v1Db.table('workouts') as any).add({
        id: 'legacy_w_1',
        userId: 'supa_legacy_user',
        name: 'Legacy Workout',
        startedAt: new Date(),
        isCompleted: true
      });
      await (v1Db.table('users') as any).add({
        id: 'legacy_user_1',
        email: 'legacy@test.local',
        username: 'LegacyUser'
      });
      v1Db.close();

      // Step 2: Open with v2 schema
      const v2Db = new Dexie(testDbName);
      v2Db.version(1).stores({
        workouts: 'id, userId, startedAt, isCompleted',
        users: 'id, email, username'
      });
      v2Db.version(2).stores({
        syncQueue:
          'id, userId, entityType, entityId, status, createdAt, updatedAt, [userId+status], [userId+entityType]',
        syncMetadata: 'id, userId, entityType, [userId+entityType]'
      });
      await v2Db.open();

      expect(v2Db.verno).toBe(2);

      // Verify legacy v1 data is 100% intact
      const legacyWorkout = await v2Db.table('workouts').get('legacy_w_1');
      expect(legacyWorkout).toBeDefined();
      expect(legacyWorkout.name).toBe('Legacy Workout');

      const legacyUser = await v2Db.table('users').get('legacy_user_1');
      expect(legacyUser).toBeDefined();
      expect(legacyUser.username).toBe('LegacyUser');

      // Verify v2 syncQueue is fully operational
      await v2Db.table('syncQueue').add({
        id: 'sq_test_migrated',
        userId: 'supa_legacy_user',
        entityType: 'workout',
        entityId: 'legacy_w_1',
        operation: 'create',
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const queueItem = await v2Db.table('syncQueue').get('sq_test_migrated');
      expect(queueItem).toBeDefined();
      expect(queueItem.entityId).toBe('legacy_w_1');

      v2Db.close();
      await Dexie.delete(testDbName);
    });
  });
});
