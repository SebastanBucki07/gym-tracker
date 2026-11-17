import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSyncQueueRepository } from './local-sync-queue.repository';
import { db } from './app-database';
import { SyncAuthError } from '../contracts/sync.model';

describe('LocalSyncQueueRepository', () => {
  let repo: LocalSyncQueueRepository;

  beforeEach(async () => {
    repo = new LocalSyncQueueRepository();
    await db.syncQueue.clear();
  });

  it('should enqueue items and assign unique ID, timestamps, and pending status', async () => {
    const item = await repo.enqueue({
      userId: 'supa_user_uuid_1',
      entityType: 'workout',
      entityId: 'w_101',
      operation: 'create',
      payload: { name: 'Trening A' }
    });

    expect(item.id).toMatch(/^sq_/);
    expect(item.userId).toBe('supa_user_uuid_1');
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(0);
    expect(item.createdAt).toBeInstanceOf(Date);
    expect(item.payload).toEqual({ name: 'Trening A' });

    const stored = await repo.getById(item.id);
    expect(stored).toBeDefined();
    expect(stored?.entityId).toBe('w_101');
  });

  it('should reject enqueueing for legacy user_jan_1 or missing userId', async () => {
    await expect(
      repo.enqueue({
        userId: 'user_jan_1',
        entityType: 'workout',
        entityId: 'w_102',
        operation: 'create'
      })
    ).rejects.toThrow(SyncAuthError);

    await expect(
      repo.enqueue({
        userId: '',
        entityType: 'workout',
        entityId: 'w_103',
        operation: 'create'
      })
    ).rejects.toThrow(SyncAuthError);
  });

  it('should strictly isolate pending items between different users', async () => {
    const userA = 'supa_user_uuid_a';
    const userB = 'supa_user_uuid_b';

    await repo.enqueue({
      userId: userA,
      entityType: 'workout',
      entityId: 'w_a1',
      operation: 'create'
    });
    await repo.enqueue({
      userId: userA,
      entityType: 'dailySteps',
      entityId: 's_a1',
      operation: 'update'
    });

    await repo.enqueue({
      userId: userB,
      entityType: 'measurement',
      entityId: 'm_b1',
      operation: 'create'
    });

    const itemsA = await repo.getPendingItems(userA);
    const itemsB = await repo.getPendingItems(userB);

    expect(itemsA.length).toBe(2);
    expect(itemsA.map(i => i.entityId)).toEqual(['w_a1', 's_a1']);

    expect(itemsB.length).toBe(1);
    expect(itemsB[0].entityId).toBe('m_b1');

    const countA = await repo.getPendingCount(userA);
    const countB = await repo.getPendingCount(userB);
    expect(countA).toBe(2);
    expect(countB).toBe(1);
  });

  it('should increment retries and transition status to failed when maxRetries reached', async () => {
    const user = 'supa_user_uuid_test';
    const item = await repo.enqueue({
      userId: user,
      entityType: 'cardio',
      entityId: 'c_1',
      operation: 'create',
      maxRetries: 2
    });

    // Retry 1: Should remain pending
    const status1 = await repo.incrementRetry(item.id, 2, 'Network timeout 1');
    expect(status1).toBe('pending');
    let fetched = await repo.getById(item.id);
    expect(fetched?.retryCount).toBe(1);
    expect(fetched?.status).toBe('pending');
    expect(fetched?.errorMessage).toBe('Network timeout 1');

    // Retry 2: Should transition to failed
    const status2 = await repo.incrementRetry(item.id, 2, 'Network timeout 2');
    expect(status2).toBe('failed');
    fetched = await repo.getById(item.id);
    expect(fetched?.retryCount).toBe(2);
    expect(fetched?.status).toBe('failed');
    expect(fetched?.errorMessage).toBe('Network timeout 2');

    // Counts check
    expect(await repo.getPendingCount(user)).toBe(0);
    expect(await repo.getFailedCount(user)).toBe(1);
  });

  it('should reset failed items back to pending', async () => {
    const user = 'supa_user_uuid_reset';
    const item = await repo.enqueue({
      userId: user,
      entityType: 'exercise',
      entityId: 'e_1',
      operation: 'create',
      maxRetries: 1
    });

    await repo.incrementRetry(item.id, 1, 'Server error');
    expect(await repo.getFailedCount(user)).toBe(1);

    const resetCount = await repo.resetFailed(user);
    expect(resetCount).toBe(1);

    const resetItem = await repo.getById(item.id);
    expect(resetItem?.status).toBe('pending');
    expect(resetItem?.retryCount).toBe(0);
    expect(resetItem?.errorMessage).toBeUndefined();

    expect(await repo.getPendingCount(user)).toBe(1);
    expect(await repo.getFailedCount(user)).toBe(0);
  });

  it('should clear queue for specific user only', async () => {
    const userA = 'supa_user_a';
    const userB = 'supa_user_b';

    await repo.enqueue({ userId: userA, entityType: 'workout', entityId: 'w1', operation: 'create' });
    await repo.enqueue({ userId: userB, entityType: 'workout', entityId: 'w2', operation: 'create' });

    await repo.clearForUser(userA);

    expect(await repo.getPendingCount(userA)).toBe(0);
    expect(await repo.getPendingCount(userB)).toBe(1);
  });
});
