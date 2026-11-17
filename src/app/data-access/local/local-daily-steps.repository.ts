import { DailyStepsRepository } from '../contracts/repository.contracts';
import { DailySteps } from '../contracts/daily-steps.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalDailyStepsRepository implements DailyStepsRepository {
  async getByDate(userId: string, date: string): Promise<DailySteps | undefined> {
    return await db.dailySteps.where('[userId+date]').equals([userId, date]).first();
  }

  async getByRange(userId: string, startDate: string, endDate: string): Promise<DailySteps[]> {
    return await db.dailySteps
      .where('userId')
      .equals(userId)
      .filter(s => s.date >= startDate && s.date <= endDate)
      .toArray();
  }

  async upsert(steps: DailySteps): Promise<void> {
    const existing = await db.dailySteps.where('[userId+date]').equals([steps.userId, steps.date]).first();
    let queueItem: any = null;

    if (existing) {
      const updated = {
        ...existing,
        stepsCount: steps.stepsCount,
        updatedAt: new Date()
      };
      queueItem = createSyncQueueItem({
        userId: steps.userId,
        entityType: 'dailySteps',
        entityId: existing.id,
        operation: 'update',
        payload: updated
      });

      await db.transaction('rw', db.dailySteps, db.syncQueue, () =>
        db.dailySteps.update(existing.id, updated)
          .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
      );
    } else {
      queueItem = createSyncQueueItem({
        userId: steps.userId,
        entityType: 'dailySteps',
        entityId: steps.id,
        operation: 'create',
        payload: steps
      });

      await db.transaction('rw', db.dailySteps, db.syncQueue, () =>
        db.dailySteps.add(steps)
          .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
      );
    }

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
