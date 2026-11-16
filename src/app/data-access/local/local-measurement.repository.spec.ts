import { describe, it, expect, beforeEach } from 'vitest';
import { LocalMeasurementRepository } from './local-measurement.repository';
import { db } from './app-database';
import { BodyMeasurement, MeasurementType } from '../contracts/measurement.model';

describe('LocalMeasurementRepository', () => {
  let repo: LocalMeasurementRepository;

  beforeEach(async () => {
    repo = new LocalMeasurementRepository();
    await db.bodyMeasurements.clear();
    await db.measurementTypes.clear();
  });

  it('should create and retrieve measurements and types', async () => {
    const type: MeasurementType = {
      id: 'type_weight',
      userId: 'user_1',
      name: 'Waga',
      unit: 'kg',
      isSystem: false
    };

    await repo.createMeasurementType(type);

    const measurement: BodyMeasurement = {
      id: 'meas_1',
      userId: 'user_1',
      measurementTypeId: 'type_weight',
      value: 80.5,
      measuredAt: new Date(),
      notes: 'Rano na czczo'
    };

    await repo.createMeasurement(measurement);
    const measurements = await repo.getMeasurements('user_1');

    expect(measurements.length).toBe(1);
    expect(measurements[0].value).toBe(80.5);
  });

  it('should update and delete measurement', async () => {
    const measurement: BodyMeasurement = {
      id: 'meas_2',
      userId: 'user_1',
      measurementTypeId: 'type_weight',
      value: 79.0,
      measuredAt: new Date()
    };

    await repo.createMeasurement(measurement);
    await repo.updateMeasurement('meas_2', { value: 78.8 });

    let list = await repo.getMeasurements('user_1');
    expect(list[0].value).toBe(78.8);

    await repo.deleteMeasurement('meas_2');
    list = await repo.getMeasurements('user_1');
    expect(list.length).toBe(0);
  });

  it('should return deduplicated types prioritizing canonical body weight type', async () => {
    // Add canonical type and duplicate legacy system types
    await db.measurementTypes.bulkAdd([
      { id: 'meas_type_weight', name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'type_weight_user_1', userId: 'user_1', name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'type_weight_user_2', userId: 'user_2', name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'custom_type_chest', userId: 'user_1', name: 'Klatka własna', unit: 'cm', isSystem: false }
    ]);

    const types = await repo.getTypes('user_1');
    const weightTypes = types.filter(t => t.name.toLowerCase().includes('waga') || t.id === 'meas_type_weight');

    expect(weightTypes.length).toBe(1);
    expect(weightTypes[0].id).toBe('meas_type_weight');

    const customType = types.find(t => t.id === 'custom_type_chest');
    expect(customType).toBeTruthy();
  });
});
