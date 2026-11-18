import { SettingsRepository } from '../contracts/repository.contracts';
import { AppSettings } from '../contracts/settings.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalSettingsRepository implements SettingsRepository {
  async getByUserId(userId: string): Promise<AppSettings | undefined> {
    return await db.appSettings.where('userId').equals(userId).first();
  }

  async upsert(settings: AppSettings): Promise<void> {
    const existing = await this.getByUserId(settings.userId);
    let queueItem: any = null;

    if (existing) {
      queueItem = createSyncQueueItem({
        userId: settings.userId,
        entityType: 'appSettings',
        entityId: existing.id,
        operation: 'update',
        payload: settings
      });

      await db.transaction('rw', db.appSettings, db.syncQueue, () =>
        db.appSettings.update(existing.id, settings as any)
          .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
      );
    } else {
      queueItem = createSyncQueueItem({
        userId: settings.userId,
        entityType: 'appSettings',
        entityId: settings.id,
        operation: 'create',
        payload: settings
      });

      await db.transaction('rw', db.appSettings, db.syncQueue, () =>
        db.appSettings.add(settings)
          .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
      );
    }

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
