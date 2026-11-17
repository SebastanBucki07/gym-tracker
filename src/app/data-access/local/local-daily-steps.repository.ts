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
    let hasQueueItem = false;

    await db.transaction('rw', db.dailySteps, db.syncQueue, async () => {
      const existing = await db.dailySteps.where('[userId+date]').equals([steps.userId, steps.date]).first();
      if (existing) {
        const updated = {
          ...existing,
          stepsCount: steps.stepsCount,
          updatedAt: new Date()
        };
        const queueItem = createSyncQueueItem({
          userId: steps.userId,
          entityType: 'dailySteps',
          entityId: existing.id,
          operation: 'update',
          payload: updated
        });

        await db.dailySteps.update(existing.id, updated);
        if (queueItem) {
          await db.syncQueue.put(queueItem);
          hasQueueItem = true;
        }
      } else {
        const queueItem = createSyncQueueItem({
          userId: steps.userId,
          entityType: 'dailySteps',
          entityId: steps.id,
          operation: 'create',
          payload: steps
        });

        await db.dailySteps.add(steps);
        if (queueItem) {
          await db.syncQueue.put(queueItem);
          hasQueueItem = true;
        }
      }
    });

    if (hasQueueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
