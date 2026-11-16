# Gym Tracker — Proposed Bidirectional Synchronization Architecture (Stage 13C.1)

This document designs the future reliable bidirectional synchronization engine between local IndexedDB (Dexie) and Supabase PostgreSQL.

---

## 1. Architecture Principles
- **Local-First System of Record**: Dexie remains the primary runtime database for offline execution.
- **Asynchronous Sync Engine (`SyncService`)**: Detects online/offline connectivity, queues mutations locally, and pushes/pulls changes idempotently in dependency order.

---

## 2. Required Synchronization Metadata
To support reliable delta synchronization, conflict resolution, and soft deletes, the following metadata fields are designated for future implementation:
- `sync_status`: `'synced' | 'pending' | 'conflict'`
- `updated_at_utc`: `TIMESTAMPTZ` (Server-authoritative or synchronized UTC timestamp)
- `deleted_at`: `TIMESTAMPTZ | null` (Tombstone marker for propagating record deletions across devices)

---

## 3. Conflict Resolution Strategy
- **Last-Write-Wins (LWW)**: Applied to modifiable parameters such as app settings or daily step counts.
- **Protected Historical Records**: Completed workouts and historical body measurements are treated as immutable or merged conservatively to prevent accidental destruction of training logs.

---

## 4. Offline & Reconnection Behavior
- **Offline Mutations**: Saved immediately to Dexie with `sync_status = 'pending'`.
- **Reconnection Handling**: Automatically triggered when `NetworkStatusService` reports online restoration.
- **Idempotency**: All sync operations use client-generated stable IDs, ensuring retries never produce duplicate records.
