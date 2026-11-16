import { MeasurementRepository } from '../contracts/repository.contracts';
import { BodyMeasurement, MeasurementType, CANONICAL_BODY_WEIGHT_TYPE_ID } from '../contracts/measurement.model';
import { db } from './app-database';

export class LocalMeasurementRepository implements MeasurementRepository {
  async getTypes(userId?: string): Promise<MeasurementType[]> {
    const all = userId
      ? await db.measurementTypes.filter(t => t.isSystem || t.userId === userId).toArray()
      : await db.measurementTypes.filter(t => t.isSystem).toArray();

    const seen = new Set<string>();
    const deduplicated: MeasurementType[] = [];

    // Prioritize canonical system types first
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
    await db.measurementTypes.add(type);
    return type.id;
  }

  async getMeasurements(userId: string): Promise<BodyMeasurement[]> {
    return await db.bodyMeasurements.where('userId').equals(userId).toArray();
  }

  async createMeasurement(measurement: BodyMeasurement): Promise<string> {
    await db.bodyMeasurements.add(measurement);
    return measurement.id;
  }

  async updateMeasurement(id: string, changes: Partial<BodyMeasurement>): Promise<void> {
    await db.bodyMeasurements.update(id, changes);
  }

  async deleteMeasurement(id: string): Promise<void> {
    await db.bodyMeasurements.delete(id);
  }
}
