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

    await db.transaction('rw', db.cardioActivities, db.syncQueue, async () => {
      const existing = await db.cardioActivities.get(activity.id);
      if (existing) {
        await db.cardioActivities.update(activity.id, activity as any);
      } else {
        await db.cardioActivities.add(activity);
      }
      if (queueItem) {
        await db.syncQueue.put(queueItem);
      }
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return activity.id;
  }

  async updateActivity(id: string, changes: Partial<CardioActivity>): Promise<void> {
    let hasQueueItem = false;

    await db.transaction('rw', db.cardioActivities, db.syncQueue, async () => {
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

      await db.cardioActivities.update(id, updated);
      if (queueItem) {
        await db.syncQueue.put(queueItem);
        hasQueueItem = true;
      }
    });

    if (hasQueueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }

  async deleteActivity(id: string): Promise<void> {
    let hasQueueItem = false;

    await db.transaction('rw', db.cardioActivities, db.syncQueue, async () => {
      const existing = await db.cardioActivities.get(id);
      if (!existing) return;
      const queueItem = createSyncQueueItem({
        userId: existing.userId,
        entityType: 'cardio',
        entityId: id,
        operation: 'delete'
      });

      await db.cardioActivities.delete(id);
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
