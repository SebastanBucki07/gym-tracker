import { Injectable, Optional } from '@angular/core';
import { AppDatabase, db } from './app-database';
import {
  EnqueueSyncItemParams,
  SyncItemStatus,
  SyncQueueItem,
  SyncQueueRepository,
  SyncAuthError
} from '../contracts/sync.model';

export function createSyncQueueItem<T = any>(item: EnqueueSyncItemParams<T>): SyncQueueItem<T> | null {
  if (!item.userId || item.userId === 'user_jan_1' || item.userId.trim() === '') {
    return null;
  }

  const normalizedUserId = item.userId.startsWith('supa_') ? item.userId : `supa_${item.userId}`;
  const now = new Date();
  const id = `sq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    ...item,
    userId: normalizedUserId,
    id,
    status: 'pending',
    retryCount: 0,
    maxRetries: item.maxRetries ?? 3,
    createdAt: now,
    updatedAt: now
  };
}

@Injectable({
  providedIn: 'root'
})
export class LocalSyncQueueRepository implements SyncQueueRepository {
  private database: AppDatabase;

  constructor(@Optional() customDb?: AppDatabase) {
    this.database = customDb || db;
  }

  private normalizeUserId(userId: string): string {
    if (!userId) return userId;
    return userId.startsWith('supa_') ? userId : `supa_${userId}`;
  }

  async enqueue<T = any>(item: EnqueueSyncItemParams<T>): Promise<SyncQueueItem<T>> {
    const queueItem = createSyncQueueItem(item);
    if (!queueItem) {
      throw new SyncAuthError(
        'Nie można zakolejkować operacji synchronizacji dla nieprawidłowego lub legacy użytkownika.'
      );
    }

    await this.database.syncQueue.put(queueItem);
    return queueItem;
  }

  async getPendingItems(userId: string, limit?: number): Promise<SyncQueueItem[]> {
    if (!userId || userId === 'user_jan_1') {
      return [];
    }

    const nUserId = this.normalizeUserId(userId);
    const items = await this.database.syncQueue
      .where('[userId+status]')
      .equals([nUserId, 'pending'])
      .toArray();

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (limit && limit > 0) {
      return items.slice(0, limit);
    }
    return items;
  }

  async getFailedItems(userId: string): Promise<SyncQueueItem[]> {
    if (!userId || userId === 'user_jan_1') {
      return [];
    }

    const nUserId = this.normalizeUserId(userId);
    const items = await this.database.syncQueue
      .where('[userId+status]')
      .equals([nUserId, 'failed'])
      .toArray();

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return items;
  }

  async getAllForUser(userId: string): Promise<SyncQueueItem[]> {
    if (!userId || userId === 'user_jan_1') {
      return [];
    }

    const nUserId = this.normalizeUserId(userId);
    const items = await this.database.syncQueue
      .where('userId')
      .equals(nUserId)
      .toArray();

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return items;
  }

  async getById(id: string): Promise<SyncQueueItem | undefined> {
    return await this.database.syncQueue.get(id);
  }

  async updateStatus(id: string, status: SyncItemStatus, errorMessage?: string): Promise<void> {
    const updateData: Partial<SyncQueueItem> = {
      status,
      updatedAt: new Date()
    };
    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }
    await this.database.syncQueue.update(id, updateData);
  }

  async incrementRetry(id: string, maxRetries: number, errorMessage?: string): Promise<SyncItemStatus> {
    const item = await this.database.syncQueue.get(id);
    if (!item) {
      return 'failed';
    }

    const newRetryCount = (item.retryCount || 0) + 1;
    const newStatus: SyncItemStatus = newRetryCount >= maxRetries ? 'failed' : 'pending';

    await this.database.syncQueue.update(id, {
      retryCount: newRetryCount,
      status: newStatus,
      errorMessage: errorMessage ?? item.errorMessage,
      updatedAt: new Date()
    });

    return newStatus;
  }

  async resetFailed(userId: string): Promise<number> {
    if (!userId || userId === 'user_jan_1') {
      return 0;
    }

    const failedItems = await this.getFailedItems(userId);
    if (failedItems.length === 0) {
      return 0;
    }

    const now = new Date();
    await this.database.transaction('rw', this.database.syncQueue, async () => {
      for (const item of failedItems) {
        await this.database.syncQueue.update(item.id, {
          status: 'pending',
          retryCount: 0,
          errorMessage: undefined,
          updatedAt: now
        });
      }
    });

    return failedItems.length;
  }

  async remove(id: string): Promise<void> {
    await this.database.syncQueue.delete(id);
  }

  async clearForUser(userId: string): Promise<void> {
    if (!userId) {
      return;
    }
    const nUserId = this.normalizeUserId(userId);
    await this.database.syncQueue.where('userId').equals(nUserId).delete();
  }

  async getPendingCount(userId: string): Promise<number> {
    if (!userId || userId === 'user_jan_1') {
      return 0;
    }
    const nUserId = this.normalizeUserId(userId);
    return await this.database.syncQueue
      .where('[userId+status]')
      .equals([nUserId, 'pending'])
      .count();
  }

  async getFailedCount(userId: string): Promise<number> {
    if (!userId || userId === 'user_jan_1') {
      return 0;
    }
    const nUserId = this.normalizeUserId(userId);
    return await this.database.syncQueue
      .where('[userId+status]')
      .equals([nUserId, 'failed'])
      .count();
  }
}
