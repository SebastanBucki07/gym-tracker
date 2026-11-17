import {
  Injectable,
  signal,
  computed,
  effect,
  Optional,
  Inject,
  InjectionToken
} from '@angular/core';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { NetworkStatusService } from '../pwa/network-status.service';
import { LocalSyncQueueRepository } from '../../data-access/local/local-sync-queue.repository';
import {
  DEFAULT_SYNC_CONFIG,
  SyncAuthError,
  SyncConfig,
  SyncEntityHandler,
  SyncEntityType,
  SyncOperation,
  SyncProcessResult,
  SyncQueueItem,
  SyncState,
  SyncStatus
} from '../../data-access/contracts/sync.model';

export const SYNC_CONFIG = new InjectionToken<Partial<SyncConfig>>('SYNC_CONFIG');

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private config: SyncConfig;
  private entityHandlers = new Map<SyncEntityType, SyncEntityHandler>();

  private statusSignal = signal<SyncStatus>('idle');
  private isSyncingSignal = signal<boolean>(false);
  private pendingCountSignal = signal<number>(0);
  private failedCountSignal = signal<number>(0);
  private lastSyncAtSignal = signal<Date | null>(null);
  private lastErrorSignal = signal<string | null>(null);

  private lastKnownUserId: string | null = null;
  private lastKnownOnline = true;
  private syncLock = false;

  readonly status = this.statusSignal.asReadonly();
  readonly isSyncing = this.isSyncingSignal.asReadonly();
  readonly pendingCount = this.pendingCountSignal.asReadonly();
  readonly failedCount = this.failedCountSignal.asReadonly();
  readonly lastSyncAt = this.lastSyncAtSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

  readonly isOnline = computed(() => this.networkStatus?.isOnline() ?? true);
  readonly isAuthenticated = computed(() => this.supabaseAuth?.isAuthenticated() ?? false);
  readonly currentUserId = computed(() => this.supabaseAuth?.currentUser()?.id ?? null);

  readonly state = computed<SyncState>(() => ({
    status: this.statusSignal(),
    isOnline: this.isOnline(),
    isAuthenticated: this.isAuthenticated(),
    userId: this.currentUserId(),
    pendingCount: this.pendingCountSignal(),
    failedCount: this.failedCountSignal(),
    lastSyncAt: this.lastSyncAtSignal(),
    lastError: this.lastErrorSignal()
  }));

  constructor(
    private supabaseAuth: SupabaseAuthService,
    private networkStatus: NetworkStatusService,
    private queueRepository: LocalSyncQueueRepository,
    @Optional() @Inject(SYNC_CONFIG) customConfig?: Partial<SyncConfig>
  ) {
    this.config = {
      ...DEFAULT_SYNC_CONFIG,
      ...customConfig
    };

    try {
      effect(() => {
        const supaUser = this.supabaseAuth.currentUser();
        const online = this.networkStatus.isOnline();
        this.handleContextChange(supaUser?.id || null, online);
      });
    } catch {
      // In isolated unit tests outside Angular injection context, initialize manually
      const supaUser = this.supabaseAuth?.currentUser?.();
      const online = this.networkStatus?.isOnline?.() ?? true;
      this.handleContextChange(supaUser?.id || null, online);
    }
  }

  async handleContextChange(currentUserId: string | null, isOnline: boolean): Promise<void> {
    const userChanged = currentUserId !== this.lastKnownUserId;
    const onlineChanged = isOnline !== this.lastKnownOnline;

    this.lastKnownUserId = currentUserId;
    this.lastKnownOnline = isOnline;

    if (!currentUserId || currentUserId === 'user_jan_1') {
      this.statusSignal.set('unauthenticated');
      this.pendingCountSignal.set(0);
      this.failedCountSignal.set(0);
      this.lastErrorSignal.set(null);
      return;
    }

    if (userChanged) {
      this.pendingCountSignal.set(0);
      this.failedCountSignal.set(0);
    }

    if (!isOnline) {
      this.statusSignal.set('offline');
      await this.refreshCounts(currentUserId);
      return;
    }

    // Authenticated & Online
    if (this.statusSignal() === 'offline' || this.statusSignal() === 'unauthenticated' || userChanged) {
      this.statusSignal.set('idle');
      this.lastErrorSignal.set(null);
    }

    await this.refreshCounts(currentUserId);

    if (onlineChanged && isOnline && this.config.autoSyncOnOnline) {
      await this.processQueue().catch(() => {});
    }
  }

  getActiveSupabaseUserId(): string {
    const supaUser = this.supabaseAuth.currentUser();
    if (!supaUser || !supaUser.id || supaUser.id === 'user_jan_1' || supaUser.id.trim() === '') {
      throw new SyncAuthError(
        'Brak aktywnej sesji Supabase Auth. Synchronizacja wymaga zalogowanego użytkownika.'
      );
    }
    return supaUser.id;
  }

  async refreshCounts(userId?: string): Promise<void> {
    const targetUserId = userId || this.supabaseAuth.currentUser()?.id;
    if (!targetUserId || targetUserId === 'user_jan_1') {
      this.pendingCountSignal.set(0);
      this.failedCountSignal.set(0);
      return;
    }

    try {
      const pending = await this.queueRepository.getPendingCount(targetUserId);
      const failed = await this.queueRepository.getFailedCount(targetUserId);
      this.pendingCountSignal.set(pending);
      this.failedCountSignal.set(failed);
    } catch (err) {
      console.error('Failed to refresh sync queue counts:', err);
    }
  }

  registerEntityHandler(handler: SyncEntityHandler): void {
    this.entityHandlers.set(handler.entityType, handler);
  }

  unregisterEntityHandler(entityType: SyncEntityType): void {
    this.entityHandlers.delete(entityType);
  }

  hasEntityHandler(entityType: SyncEntityType): boolean {
    return this.entityHandlers.has(entityType);
  }

  async enqueue<T = any>(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload?: T,
    triggerSync = false
  ): Promise<SyncQueueItem<T>> {
    const userId = this.getActiveSupabaseUserId();

    const item = await this.queueRepository.enqueue<T>({
      userId,
      entityType,
      entityId,
      operation,
      payload,
      maxRetries: this.config.maxRetries
    });

    await this.refreshCounts(userId);

    if (triggerSync && this.networkStatus.isOnline() && !this.isSyncingSignal()) {
      await this.processQueue();
    }

    return item;
  }

  async processQueue(): Promise<SyncProcessResult> {
    if (this.syncLock) {
      return { processedCount: 0, successCount: 0, failedCount: 0, errors: [] };
    }

    if (!this.networkStatus.isOnline()) {
      this.statusSignal.set('offline');
      return { processedCount: 0, successCount: 0, failedCount: 0, errors: [] };
    }

    let userId: string;
    try {
      userId = this.getActiveSupabaseUserId();
    } catch {
      this.statusSignal.set('unauthenticated');
      return { processedCount: 0, successCount: 0, failedCount: 0, errors: [] };
    }

    this.syncLock = true;
    this.isSyncingSignal.set(true);
    this.statusSignal.set('syncing');

    const result: SyncProcessResult = {
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: []
    };

    try {
      const pendingItems = await this.queueRepository.getPendingItems(userId, this.config.batchSize);

      for (const item of pendingItems) {
        result.processedCount++;
        const handler = this.entityHandlers.get(item.entityType);

        if (!handler) {
          // In Stage 13D.1, handlers are not yet wired to live Supabase backend.
          // Items remain safely in pending state without false 'synced' markings.
          continue;
        }

        await this.queueRepository.updateStatus(item.id, 'processing');

        try {
          await handler.push(item);
          await this.queueRepository.updateStatus(item.id, 'synced');
          result.successCount++;
        } catch (pushErr: any) {
          const errorMessage = pushErr instanceof Error ? pushErr.message : String(pushErr);
          const newStatus = await this.queueRepository.incrementRetry(
            item.id,
            item.maxRetries,
            errorMessage
          );

          result.failedCount++;
          result.errors.push({ itemId: item.id, error: errorMessage });
          this.lastErrorSignal.set(errorMessage);
        }
      }

      await this.refreshCounts(userId);

      if (result.errors.length > 0) {
        this.statusSignal.set('error');
      } else {
        this.statusSignal.set('idle');
        this.lastErrorSignal.set(null);
        this.lastSyncAtSignal.set(new Date());
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastErrorSignal.set(errorMsg);
      this.statusSignal.set('error');
    } finally {
      this.isSyncingSignal.set(false);
      this.syncLock = false;
    }

    return result;
  }

  async retryFailed(): Promise<SyncProcessResult> {
    const userId = this.getActiveSupabaseUserId();
    await this.queueRepository.resetFailed(userId);
    await this.refreshCounts(userId);
    this.lastErrorSignal.set(null);
    return await this.processQueue();
  }

  async clearQueueForCurrentUser(): Promise<void> {
    const userId = this.getActiveSupabaseUserId();
    await this.queueRepository.clearForUser(userId);
    await this.refreshCounts(userId);
    this.lastErrorSignal.set(null);
    this.statusSignal.set('idle');
  }

  getConfig(): SyncConfig {
    return { ...this.config };
  }
}
