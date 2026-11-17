import { SettingsRepository } from '../contracts/repository.contracts';
import { AppSettings } from '../contracts/settings.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalSettingsRepository implements SettingsRepository {
  async getByUserId(userId: string): Promise<AppSettings | undefined> {
    return await db.appSettings.where('userId').equals(userId).first();
  }

  async upsert(settings: AppSettings): Promise<void> {
    let hasQueueItem = false;

    await db.transaction('rw', db.appSettings, db.syncQueue, async () => {
      const existing = await this.getByUserId(settings.userId);
      if (existing) {
        const queueItem = createSyncQueueItem({
          userId: settings.userId,
          entityType: 'appSettings',
          entityId: existing.id,
          operation: 'update',
          payload: settings
        });

        await db.appSettings.update(existing.id, settings as any);
        if (queueItem) {
          await db.syncQueue.put(queueItem);
          hasQueueItem = true;
        }
      } else {
        const queueItem = createSyncQueueItem({
          userId: settings.userId,
          entityType: 'appSettings',
          entityId: settings.id,
          operation: 'create',
          payload: settings
        });

        await db.appSettings.add(settings);
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
