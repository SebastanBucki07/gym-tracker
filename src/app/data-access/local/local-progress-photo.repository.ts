import { ProgressPhotoRepository } from '../contracts/repository.contracts';
import { ProgressPhoto } from '../contracts/progress-photo.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalProgressPhotoRepository implements ProgressPhotoRepository {
  async getById(id: string): Promise<ProgressPhoto | undefined> {
    return await db.progressPhotos.get(id);
  }

  async getAll(userId: string): Promise<ProgressPhoto[]> {
    return await db.progressPhotos.where('userId').equals(userId).toArray();
  }

  async create(item: ProgressPhoto): Promise<string> {
    const queueItem = createSyncQueueItem({
      userId: item.userId,
      entityType: 'progressPhoto',
      entityId: item.id,
      operation: 'create',
      payload: item
    });

    await db.transaction('rw', db.progressPhotos, db.syncQueue, async () => {
      const existing = await db.progressPhotos.get(item.id);
      if (existing) {
        await db.progressPhotos.update(item.id, item as any);
      } else {
        await db.progressPhotos.add(item);
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

  async update(id: string, changes: Partial<ProgressPhoto>): Promise<void> {
    let hasQueueItem = false;

    await db.transaction('rw', db.progressPhotos, db.syncQueue, async () => {
      const existing = await db.progressPhotos.get(id);
      if (!existing) return;
      const updated = { ...existing, ...changes };
      const queueItem = createSyncQueueItem({
        userId: updated.userId,
        entityType: 'progressPhoto',
        entityId: id,
        operation: 'update',
        payload: updated
      });

      await db.progressPhotos.update(id, updated);
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

    await db.transaction('rw', db.progressPhotos, db.syncQueue, async () => {
      const existing = await db.progressPhotos.get(id);
      if (!existing) return;
      const queueItem = createSyncQueueItem({
        userId: existing.userId,
        entityType: 'progressPhoto',
        entityId: id,
        operation: 'delete'
      });

      await db.progressPhotos.delete(id);
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
