export type SyncEntityType =
  | 'workout'
  | 'workoutSet'
  | 'measurement'
  | 'measurementType'
  | 'cardio'
  | 'dailySteps'
  | 'exercise'
  | 'workoutPlan'
  | 'appSettings'
  | 'progressPhoto';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncItemStatus = 'pending' | 'processing' | 'failed' | 'synced';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'unauthenticated';

export interface SyncQueueItem<T = any> {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload?: T | null;
  status: SyncItemStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncState {
  status: SyncStatus;
  isOnline: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export interface SyncConfig {
  maxRetries: number;
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
  backoffMultiplier: number;
  autoSyncOnOnline: boolean;
  batchSize: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  backoffMultiplier: 2,
  autoSyncOnOnline: true,
  batchSize: 25
};

export interface SyncProcessResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ itemId: string; error: string }>;
}

export interface SyncMetadata {
  id: string;
  userId: string;
  entityType: SyncEntityType;
  lastPulledAt?: Date | null;
  lastPushedAt?: Date | null;
  updatedAt: Date;
}

export interface SyncEntityHandler<T = any> {
  entityType: SyncEntityType;
  push(item: SyncQueueItem<T>): Promise<void>;
  pull?(userId: string, since?: Date | null): Promise<T[]>;
}

export type EnqueueSyncItemParams<T = any> = Omit<
  SyncQueueItem<T>,
  'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'status' | 'maxRetries'
> & {
  maxRetries?: number;
};

export interface SyncQueueRepository {
  enqueue<T = any>(item: EnqueueSyncItemParams<T>): Promise<SyncQueueItem<T>>;
  getPendingItems(userId: string, limit?: number): Promise<SyncQueueItem[]>;
  getFailedItems(userId: string): Promise<SyncQueueItem[]>;
  getAllForUser(userId: string): Promise<SyncQueueItem[]>;
  getById(id: string): Promise<SyncQueueItem | undefined>;
  updateStatus(id: string, status: SyncItemStatus, errorMessage?: string): Promise<void>;
  incrementRetry(id: string, maxRetries: number, errorMessage?: string): Promise<SyncItemStatus>;
  resetFailed(userId: string): Promise<number>;
  remove(id: string): Promise<void>;
  clearForUser(userId: string): Promise<void>;
  getPendingCount(userId: string): Promise<number>;
  getFailedCount(userId: string): Promise<number>;
}

export class SyncAuthError extends Error {
  constructor(message = 'Brak aktywnej sesji Supabase Auth. Synchronizacja wymaga zalogowanego użytkownika.') {
    super(message);
    this.name = 'SyncAuthError';
  }
}
