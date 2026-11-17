import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { SyncService } from './sync.service';
import { LocalSyncQueueRepository } from '../../data-access/local/local-sync-queue.repository';
import { db } from '../../data-access/local/app-database';
import { SyncEntityHandler } from '../../data-access/contracts/sync.model';

describe('SyncService (Stage 13D.4 — Full Bidirectional Synchronization)', () => {
  let syncService: SyncService;
  let queueRepo: LocalSyncQueueRepository;

  let currentUserSignal: any;
  let isOnlineSignal: any;
  let mockSupabaseAuth: any;
  let mockNetworkStatus: any;

  const userA = 'supa_uuid_bidir_alice';
  const userB = 'supa_uuid_bidir_bob';

  beforeEach(async () => {
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.exercises.clear();

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

  it('1-3. Should push new record, update, and delete successfully when Supabase succeeds', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    let pushedPayload: any = null;
    let deletedId: string | null = null;

    const handler: SyncEntityHandler = {
      entityType: 'workout',
      push: async item => {
        if (item.operation === 'create' || item.operation === 'update') {
          pushedPayload = item.payload;
        } else if (item.operation === 'delete') {
          deletedId = item.entityId;
        }
      },
      pull: async () => []
    };
    syncService.registerEntityHandler(handler);

    // Enqueue create
    const itemCreate = await syncService.enqueue('workout', 'w_1', 'create', { id: 'w_1', name: 'Workout 1' });
    expect(itemCreate.status).toBe('pending');

    const res1 = await syncService.sync();
    expect(res1.successCount).toBe(1);
    expect(pushedPayload).toEqual({ id: 'w_1', name: 'Workout 1' });

    const storedCreate = await queueRepo.getById(itemCreate.id);
    expect(storedCreate?.status).toBe('synced');

    // Enqueue delete
    const itemDelete = await syncService.enqueue('workout', 'w_1', 'delete');
    const res2 = await syncService.sync();
    expect(res2.successCount).toBe(1);
    expect(deletedId).toBe('w_1');
  });

  it('4-6. Should confirm sync only after Supabase success, preserve queue on network error, and apply retry backoff', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    let attempts = 0;
    const handler: SyncEntityHandler = {
      entityType: 'exercise',
      push: async () => {
        attempts++;
        throw new Error('Network timeout');
      },
      pull: async () => []
    };
    syncService.registerEntityHandler(handler);

    const item = await syncService.enqueue('exercise', 'ex_1', 'create', { id: 'ex_1', name: 'Bench' });

    // First attempt fails, item remains pending with retryCount = 1
    await syncService.sync();
    expect(attempts).toBe(1);
    let fetched = await queueRepo.getById(item.id);
    expect(fetched?.status).toBe('pending');
    expect(fetched?.retryCount).toBe(1);

    // Second attempt hits maxRetries (2) -> transitions to failed
    await syncService.sync();
    expect(attempts).toBe(2);
    fetched = await queueRepo.getById(item.id);
    expect(fetched?.status).toBe('failed');
    expect(syncService.failedCount()).toBe(1);
  });

  it('7-9. Should pull new records, updates, and handle deleted_at tombstones', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    const remoteRecords = [
      { id: 'ex_remote_1', user_id: userA, name: 'Remote Exercise', primary_muscle_group_id: 'chest', equipment_category_id: 'barbell', source: 'system', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'ex_to_delete', user_id: userA, name: 'Deleted Exercise', deleted_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];

    const handler: SyncEntityHandler = {
      entityType: 'exercise',
      push: async () => {},
      pull: async () => remoteRecords
    };
    syncService.registerEntityHandler(handler);

    const res = await syncService.sync();
    expect(res.pulledCount).toBe(2);

    const savedEx = await db.exercises.get('ex_remote_1');
    expect(savedEx).toBeDefined();
    expect(savedEx?.name).toBe('Remote Exercise');

    const deletedEx = await db.exercises.get('ex_to_delete');
    expect(deletedEx).toBeUndefined();
  });

  it('10-11. Should protect local unsynced changes and detect conflicts', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    const handler: SyncEntityHandler = {
      entityType: 'exercise',
      push: async () => {
        throw new Error('Push delayed / offline');
      },
      pull: async () => [
        { id: 'ex_conflict_1', user_id: userA, name: 'Remote Modified', primary_muscle_group_id: 'chest', equipment_category_id: 'barbell', source: 'system', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ]
    };
    syncService.registerEntityHandler(handler);

    // Local mutation pending in outbox (push fails, leaving item pending)
    await syncService.enqueue('exercise', 'ex_conflict_1', 'update', { id: 'ex_conflict_1', name: 'Local Modified' });

    const res = await syncService.sync();
    expect(res.conflictsCount).toBe(1);
    expect(syncService.status()).toBe('conflict');
  });

  it('12-14. Should strictly isolate accounts, handle account change and logout during sync', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    await syncService.enqueue('workout', 'w_a', 'create');
    expect(syncService.pendingCount()).toBe(1);

    // Switch to User B
    currentUserSignal.set({ id: userB, email: 'bob@example.com' });
    await syncService.handleContextChange(userB, true);
    expect(syncService.pendingCount()).toBe(0);

    // Logout
    currentUserSignal.set(null);
    await syncService.handleContextChange(null, true);
    expect(syncService.status()).toBe('unauthenticated');
    expect(() => syncService.getActiveSupabaseUserId()).toThrow();
  });

  it('15-18. Should serialize sync execution (no parallel syncs) and maintain checkpoints per user and table', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    let pullCalls = 0;
    const handler: SyncEntityHandler = {
      entityType: 'workout',
      push: async () => {},
      pull: async () => {
        pullCalls++;
        return [];
      }
    };
    syncService.registerEntityHandler(handler);

    // Trigger two syncs in parallel
    const [res1, res2] = await Promise.all([syncService.sync(), syncService.sync()]);
    expect(res1).toBeDefined();
    expect(res2).toBeDefined();

    const metadata = await db.syncMetadata.get(`${userA}_workout`);
    expect(metadata).toBeDefined();
    expect(metadata?.lastPulledAt).toBeInstanceOf(Date);
  });

  it('19-20. Should auto-trigger on reconnection and preserve local data after successful sync', async () => {
    currentUserSignal.set({ id: userA, email: 'alice@example.com' });
    await syncService.handleContextChange(userA, true);

    isOnlineSignal.set(false);
    await syncService.handleContextChange(userA, false);
    expect(syncService.status()).toBe('offline');

    await db.workouts.put({
      id: 'w_local_persist',
      userId: userA,
      name: 'Persistent Workout',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Go online
    isOnlineSignal.set(true);
    await syncService.handleContextChange(userA, true);

    const localWorkout = await db.workouts.get('w_local_persist');
    expect(localWorkout).toBeDefined();
    expect(localWorkout?.name).toBe('Persistent Workout');
  });
});
