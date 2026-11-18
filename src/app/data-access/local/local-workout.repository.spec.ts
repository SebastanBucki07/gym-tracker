import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './app-database';
import { LocalWorkoutRepository } from './local-workout.repository';
import { Workout } from '../contracts/workout.model';
import { LocalSyncQueueRepository } from './local-sync-queue.repository';

describe('LocalWorkoutRepository - Auto Queuing', () => {
  let repo: LocalWorkoutRepository;
  let syncQueueRepo: LocalSyncQueueRepository;

  beforeEach(async () => {
    repo = new LocalWorkoutRepository();
    syncQueueRepo = new LocalSyncQueueRepository();
    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.syncQueue.clear();
  });

  it('should auto-enqueue create operation', async () => {
    const workout: Workout = {
      id: 'w_1',
      userId: 'supa_user_1',
      name: 'Test Workout',
      startedAt: new Date(),
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await repo.create(workout, []);

    const queue = await syncQueueRepo.getPendingItems('supa_user_1');
    expect(queue.length).toBe(1);
    expect(queue[0].entityType).toBe('workout');
    expect(queue[0].entityId).toBe('w_1');
    expect(queue[0].operation).toBe('create');
  });

  it('should auto-enqueue update operation', async () => {
    const workout: Workout = {
      id: 'w_2',
      userId: 'supa_user_1',
      name: 'Test',
      startedAt: new Date(),
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await repo.create(workout, []);
    await db.syncQueue.clear(); // Clear the create task

    await repo.update('w_2', { name: 'Updated' });

    const queue = await syncQueueRepo.getPendingItems('supa_user_1');
    expect(queue.length).toBe(1);
    expect(queue[0].operation).toBe('update');
  });

  it('should auto-enqueue delete operation', async () => {
    const workout: Workout = {
      id: 'w_3',
      userId: 'supa_user_1',
      name: 'Test',
      startedAt: new Date(),
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await repo.create(workout, []);
    await db.syncQueue.clear();

    await repo.delete('w_3');

    const queue = await syncQueueRepo.getPendingItems('supa_user_1');
    expect(queue.length).toBe(1);
    expect(queue[0].operation).toBe('delete');
  });

  it('should ignore user_jan_1 (SyncAuthError) and still save locally', async () => {
    const workout: Workout = {
      id: 'w_4',
      userId: 'user_jan_1',
      name: 'Test',
      startedAt: new Date(),
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Should not throw
    await repo.create(workout, []);

    const saved = await repo.getById('w_4');
    expect(saved).toBeTruthy();
    
    const queue = await syncQueueRepo.getPendingItems('user_jan_1');
    expect(queue.length).toBe(0); // Queue should be empty for legacy user
  });
});
