import { MeasurementRepository } from '../contracts/repository.contracts';
import { BodyMeasurement, MeasurementType, CANONICAL_BODY_WEIGHT_TYPE_ID } from '../contracts/measurement.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

export class LocalMeasurementRepository implements MeasurementRepository {
  async getTypes(userId?: string): Promise<MeasurementType[]> {
    const all = userId
      ? await db.measurementTypes.filter(t => t.isSystem || t.userId === userId).toArray()
      : await db.measurementTypes.filter(t => t.isSystem).toArray();

    const seen = new Set<string>();
    const deduplicated: MeasurementType[] = [];

    const sorted = all.sort((a, b) => {
      if (a.id === CANONICAL_BODY_WEIGHT_TYPE_ID) return -1;
      if (b.id === CANONICAL_BODY_WEIGHT_TYPE_ID) return 1;
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return 0;
    });

    for (const t of sorted) {
      const isWeight = t.id === CANONICAL_BODY_WEIGHT_TYPE_ID || (t.isSystem && (t.name.trim().toLowerCase() === 'waga ciała' || t.name.trim().toLowerCase() === 'waga') && t.unit === 'kg') || t.id.startsWith('type_weight_');
      const key = isWeight ? 'canonical_weight' : `${t.name.trim().toLowerCase()}_${t.unit}_${t.userId || 'system'}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(t);
      }
    }

    return deduplicated;
  }

  async createMeasurementType(type: MeasurementType): Promise<string> {
    const queueItem = !type.isSystem && type.userId ? createSyncQueueItem({
      userId: type.userId,
      entityType: 'measurementType',
      entityId: type.id,
      operation: 'create',
      payload: type
    }) : null;

    const existing = await db.measurementTypes.get(type.id);

    await db.transaction('rw', db.measurementTypes, db.syncQueue, () => {
      const op = existing
        ? db.measurementTypes.update(type.id, type as any)
        : db.measurementTypes.add(type);
      return op.then(() => queueItem ? db.syncQueue.put(queueItem) : undefined);
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return type.id;
  }

  async getMeasurements(userId: string): Promise<BodyMeasurement[]> {
    return await db.bodyMeasurements.where('userId').equals(userId).toArray();
  }

  async createMeasurement(measurement: BodyMeasurement): Promise<string> {
    const queueItem = createSyncQueueItem({
      userId: measurement.userId,
      entityType: 'measurement',
      entityId: measurement.id,
      operation: 'create',
      payload: measurement
    });

    const existing = await db.bodyMeasurements.get(measurement.id);

    await db.transaction('rw', db.bodyMeasurements, db.syncQueue, () => {
      const op = existing
        ? db.bodyMeasurements.update(measurement.id, measurement as any)
        : db.bodyMeasurements.add(measurement);
      return op.then(() => queueItem ? db.syncQueue.put(queueItem) : undefined);
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return measurement.id;
  }

  async updateMeasurement(id: string, changes: Partial<BodyMeasurement>): Promise<void> {
    const existing = await db.bodyMeasurements.get(id);
    if (!existing) return;
    const updated = { ...existing, ...changes };
    const queueItem = createSyncQueueItem({
      userId: updated.userId,
      entityType: 'measurement',
      entityId: id,
      operation: 'update',
      payload: updated
    });

    await db.transaction('rw', db.bodyMeasurements, db.syncQueue, () =>
      db.bodyMeasurements.update(id, updated)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }

  async deleteMeasurement(id: string): Promise<void> {
    const existing = await db.bodyMeasurements.get(id);
    if (!existing) return;
    const queueItem = createSyncQueueItem({
      userId: existing.userId,
      entityType: 'measurement',
      entityId: id,
      operation: 'delete'
    });

    await db.transaction('rw', db.bodyMeasurements, db.syncQueue, () =>
      db.bodyMeasurements.delete(id)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
