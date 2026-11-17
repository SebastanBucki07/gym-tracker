import { CardioRepository } from '../contracts/repository.contracts';
import { CardioActivity, CardioType } from '../contracts/cardio.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalCardioRepository implements CardioRepository {
  async getTypes(): Promise<CardioType[]> {
    return await db.cardioTypes.toArray();
  }

  async getActivities(userId: string): Promise<CardioActivity[]> {
    return await db.cardioActivities.where('userId').equals(userId).toArray();
  }

  async createActivity(activity: CardioActivity): Promise<string> {
    const queueItem = createSyncQueueItem({
      userId: activity.userId,
      entityType: 'cardio',
      entityId: activity.id,
      operation: 'create',
      payload: activity
    });

    const existing = await db.cardioActivities.get(activity.id);

    await db.transaction('rw', db.cardioActivities, db.syncQueue, () => {
      const op = existing
        ? db.cardioActivities.update(activity.id, activity as any)
        : db.cardioActivities.add(activity);
      return op.then(() => queueItem ? db.syncQueue.put(queueItem) : undefined);
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return activity.id;
  }

  async updateActivity(id: string, changes: Partial<CardioActivity>): Promise<void> {
    const existing = await db.cardioActivities.get(id);
    if (!existing) return;
    const updated = { ...existing, ...changes };
    const queueItem = createSyncQueueItem({
      userId: updated.userId,
      entityType: 'cardio',
      entityId: id,
      operation: 'update',
      payload: updated
    });

    await db.transaction('rw', db.cardioActivities, db.syncQueue, () =>
      db.cardioActivities.update(id, updated)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }

  async deleteActivity(id: string): Promise<void> {
    const existing = await db.cardioActivities.get(id);
    if (!existing) return;
    const queueItem = createSyncQueueItem({
      userId: existing.userId,
      entityType: 'cardio',
      entityId: id,
      operation: 'delete'
    });

    await db.transaction('rw', db.cardioActivities, db.syncQueue, () =>
      db.cardioActivities.delete(id)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
