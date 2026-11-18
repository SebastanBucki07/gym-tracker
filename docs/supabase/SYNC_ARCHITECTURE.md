# Gym Tracker — Bidirectional Synchronization Architecture (Stage 13D.1 Implemented)

This document specifies the bidirectional synchronization engine between local IndexedDB (Dexie) and Supabase PostgreSQL in Gym Tracker, detailing the foundation implemented in **Stage 13D.1**.

---

## 1. Architectural Model & Responsibilities
- **Local-First System of Record**: Dexie remains the primary runtime database for all user interactions. Data mutations are committed locally first with zero latency and full offline support.
- **Persistent Remote Store**: Supabase PostgreSQL serves as the authoritative remote cloud store.
- **Sole Cloud Identity**: Supabase Auth provides the single source of truth for remote user identification (`auth.users.id`).
- **Asynchronous Sync Engine (`SyncService`)**: Manages the lifecycle of synchronization, tracking online/offline state, enqueuing local mutations into an outbox, dispatching operations to registered entity handlers, managing retries, and surfacing reactive status signals to the UI.

---

## 2. Dexie Schema Version 2 (Implemented in Stage 13D.1)
The local database schema was upgraded from version 1 to version 2 without affecting pre-existing user records:

```typescript
this.version(2).stores({
  syncQueue:
    'id, userId, entityType, entityId, status, createdAt, updatedAt, [userId+status], [userId+entityType]',
  syncMetadata:
    'id, userId, entityType, [userId+entityType]'
});
```

### Table Specifications:
1. **`syncQueue`**: Outbox mutation log tracking local creations, updates, and deletions.
   - `id`: Unique queue mutation identifier (`sq_<timestamp>_<random>`).
   - `userId`: Authoritative Supabase user UUID (`auth.users.id`).
   - `entityType`: `'workout' | 'workoutSet' | 'measurement' | 'measurementType' | 'cardio' | 'dailySteps' | 'exercise' | 'workoutPlan' | 'appSettings' | 'progressPhoto'`.
   - `entityId`: Client-generated stable ID of the entity.
   - `operation`: `'create' | 'update' | 'delete'`.
   - `payload`: Serialized entity snapshot or partial payload.
   - `status`: `'pending' | 'processing' | 'failed' | 'synced'`.
   - `retryCount`: Number of attempted network sync operations.
   - `maxRetries`: Maximum allowed retry attempts before marking as `'failed'`.
   - `errorMessage`: Last encountered error message.
   - `createdAt` / `updatedAt`: Local timestamps.

2. **`syncMetadata`**: Checkpoints for incremental delta pulls.
   - `id`: Composite identifier (`${userId}_${entityType}`).
   - `userId`: Supabase UUID.
   - `entityType`: Target entity.
   - `lastPulledAt`: Timestamp of last successful remote pull.
   - `lastPushedAt`: Timestamp of last successful remote push.

---

## 3. Strict User Isolation & Anti-Leak Guarantees
Stage 13D.1 enforces strict account boundary isolation at the synchronization layer:

1. **No Shared Fallback**: Operations can only be enqueued or processed for authenticated Supabase users. Any attempt to sync with empty credentials or legacy default accounts (`user_jan_1`) throws an explicit `SyncAuthError`.
2. **Deterministic Workspace Filtering**: `syncQueue` queries strictly filter on `userId = currentSupabaseUser.id` using the compound index `[userId+status]`.
3. **Session Switching**: Switching active Supabase accounts immediately cancels in-flight synchronization for the previous user and resets reactive status and counters (`pendingCount`, `failedCount`) to reflect only the newly authenticated user.
4. **Queue Clearing Safety**: Clearing the queue for user A deletes only records matching `userId = userA.id`, leaving other users' queues untouched.

---

## 4. Status Management & Reactive Signals
`SyncService` exposes granular, reactive signals for the Angular UI:

| Signal | Type | Description |
| :--- | :--- | :--- |
| `status` | `Signal<SyncStatus>` | `'idle' \| 'syncing' \| 'offline' \| 'error' \| 'unauthenticated'` |
| `isSyncing` | `Signal<boolean>` | `true` while the queue is actively processing. |
| `isOnline` | `Signal<boolean>` | Reflects real-time browser network connectivity via `NetworkStatusService`. |
| `isAuthenticated` | `Signal<boolean>` | `true` when a Supabase Auth session is active. |
| `pendingCount` | `Signal<number>` | Number of pending queue operations for the active user. |
| `failedCount` | `Signal<number>` | Number of permanently failed queue operations (exceeded `maxRetries`). |
| `lastSyncAt` | `Signal<Date \| null>` | Timestamp of the last successful queue synchronization. |
| `lastError` | `Signal<string \| null>` | Error message from the last failed sync cycle. |
| `state` | `Computed<SyncState>` | Consolidated snapshot of all sync indicators. |

---

## 5. Retry Mechanism & Error Handling
- **Transient Failures**: When an entity push fails with an exception, `incrementRetry()` increments `retryCount`. If `retryCount < maxRetries`, the status remains `'pending'`, and the operation will be re-attempted on the next cycle.
- **Terminal Failures**: When `retryCount >= maxRetries`, the item status transitions to `'failed'`, `failedCount` is incremented, and `status` transitions to `'error'`.
- **Manual Retry API**: `retryFailed()` resets all `'failed'` items for the active user back to `'pending'` with `retryCount = 0` and restarts processing.
- **Offline Pause**: If the network is offline (`isOnline = false`), mutations are saved locally to `syncQueue` as `'pending'`, and queue dispatch is paused until connectivity returns.
- **Reconnection Trigger**: When connectivity transitions from offline to online, `autoSyncOnOnline` automatically triggers queue processing.

---

## 6. Safe Entity Handler Registration Pattern
To decouple entity-specific mapping and Supabase API calls from the core queue engine, `SyncService` uses a registry pattern:

```typescript
export interface SyncEntityHandler<T = any> {
  entityType: SyncEntityType;
  push(item: SyncQueueItem<T>): Promise<void>;
  pull?(userId: string, since?: Date | null): Promise<T[]>;
}
```

- In Stage 13D.1, handlers are registered dynamically via `registerEntityHandler()`.
- **Safety Invariant**: If no handler is registered for an entity type, the queue processor **does not mark the item as synced**. The item remains safely pending in Dexie until a corresponding remote handler is registered in subsequent stages.

---

## 7. Known Limitations of Stage 13D.1
- **Foundation Only**: Stage 13D.1 establishes the client-side queue, contracts, status engine, Dexie migration, and isolation guards.
- **No Remote Network Uploads**: Remote Supabase REST/PostgREST push handlers for workouts, measurements, cardio, steps, etc., are deferred to **Stage 13D.2+**.
- **No Storage Sync**: Progress photo binary upload to Supabase Storage is deferred to **Stage 13D.6**.
- **Zero Live Database Impact**: No SQL migrations were executed against live Supabase, no production RLS policies were modified, and no remote tables were queried.
