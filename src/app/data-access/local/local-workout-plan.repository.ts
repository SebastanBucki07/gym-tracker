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

    const existing = await db.workoutPlans.get(item.id);

    await db.transaction('rw', db.workoutPlans, db.syncQueue, () => {
      const op = existing
        ? db.workoutPlans.update(item.id, item as any)
        : db.workoutPlans.add(item);
      return op.then(() => queueItem ? db.syncQueue.put(queueItem) : undefined);
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return item.id;
  }

  async update(id: string, changes: Partial<WorkoutPlan>): Promise<void> {
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

    await db.transaction('rw', db.workoutPlans, db.syncQueue, () =>
      db.workoutPlans.update(id, updated)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await db.workoutPlans.get(id);
    if (!existing) return;
    const queueItem = createSyncQueueItem({
      userId: existing.userId,
      entityType: 'workoutPlan',
      entityId: id,
      operation: 'delete'
    });

    await db.transaction('rw', db.workoutPlans, db.syncQueue, () =>
      db.workoutPlans.delete(id)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
