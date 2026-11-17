import { WorkoutPlanRepository } from '../contracts/repository.contracts';
import { WorkoutPlan } from '../contracts/workout-plan.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalWorkoutPlanRepository implements WorkoutPlanRepository {
  async getById(id: string): Promise<WorkoutPlan | undefined> {
    return await db.workoutPlans.get(id);
  }

  async getAll(userId: string): Promise<WorkoutPlan[]> {
    return await db.workoutPlans.where('userId').equals(userId).toArray();
  }

  async create(item: WorkoutPlan): Promise<string> {
    const queueItem = createSyncQueueItem({
      userId: item.userId,
      entityType: 'workoutPlan',
      entityId: item.id,
      operation: 'create',
      payload: item
    });

    await db.transaction('rw', db.workoutPlans, db.syncQueue, async () => {
      const existing = await db.workoutPlans.get(item.id);
      if (existing) {
        await db.workoutPlans.update(item.id, item as any);
      } else {
        await db.workoutPlans.add(item);
      }
      if (queueItem) {
        await db.syncQueue.put(queueItem);
      }
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return item.id;
  }

  async update(id: string, changes: Partial<WorkoutPlan>): Promise<void> {
    let hasQueueItem = false;

    await db.transaction('rw', db.workoutPlans, db.syncQueue, async () => {
      const existing = await db.workoutPlans.get(id);
      if (!existing) return;
      const updated = { ...existing, ...changes, updatedAt: new Date() };
      const queueItem = createSyncQueueItem({
        userId: updated.userId,
        entityType: 'workoutPlan',
        entityId: id,
        operation: 'update',
        payload: updated
      });

      await db.workoutPlans.update(id, updated);
      if (queueItem) {
        await db.syncQueue.put(queueItem);
        hasQueueItem = true;
      }
    });

    if (hasQueueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }

  async delete(id: string): Promise<void> {
    let hasQueueItem = false;

    await db.transaction('rw', db.workoutPlans, db.syncQueue, async () => {
      const existing = await db.workoutPlans.get(id);
      if (!existing) return;
      const queueItem = createSyncQueueItem({
        userId: existing.userId,
        entityType: 'workoutPlan',
        entityId: id,
        operation: 'delete'
      });

      await db.workoutPlans.delete(id);
      if (queueItem) {
        await db.syncQueue.put(queueItem);
        hasQueueItem = true;
      }
    });

    if (hasQueueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
