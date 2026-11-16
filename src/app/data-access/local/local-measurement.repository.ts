import { MeasurementRepository } from '../contracts/repository.contracts';
import { BodyMeasurement, MeasurementType } from '../contracts/measurement.model';
import { db } from './app-database';

export class LocalMeasurementRepository implements MeasurementRepository {
  async getTypes(userId?: string): Promise<MeasurementType[]> {
    if (!userId) {
      return await db.measurementTypes.filter(t => t.isSystem).toArray();
    }
    return await db.measurementTypes
      .filter(t => t.isSystem || t.userId === userId)
      .toArray();
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
