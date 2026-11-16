import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSeedService } from './database-seed.service';
import { db } from '../../data-access/local/app-database';
import { CANONICAL_BODY_WEIGHT_TYPE_ID } from '../../data-access/contracts/measurement.model';

describe('DatabaseSeedService - Measurement Types Migration & Deduplication', () => {
  let service: DatabaseSeedService;

  beforeEach(async () => {
    service = new DatabaseSeedService();
    await db.measurementTypes.clear();
    await db.bodyMeasurements.clear();
  });

  it('should seed only one canonical system body weight type', async () => {
    await service.seedDatabase();

    const weightTypes = await db.measurementTypes
      .filter(t => t.name.toLowerCase().includes('waga') || t.id === CANONICAL_BODY_WEIGHT_TYPE_ID)
      .toArray();

    expect(weightTypes.length).toBe(1);
    expect(weightTypes[0].id).toBe(CANONICAL_BODY_WEIGHT_TYPE_ID);
    expect(weightTypes[0].isSystem).toBe(true);
    expect(weightTypes[0].unit).toBe('kg');
  });

  it('should be idempotent: running seed multiple times does not create duplicates', async () => {
    await service.seedDatabase();
    await service.seedDatabase();
    await service.seedDatabase();

    const weightTypes = await db.measurementTypes
      .filter(t => t.name.toLowerCase().includes('waga') || t.id === CANONICAL_BODY_WEIGHT_TYPE_ID)
      .toArray();

    expect(weightTypes.length).toBe(1);
    expect(weightTypes[0].id).toBe(CANONICAL_BODY_WEIGHT_TYPE_ID);
  });

  it('should migrate existing duplicate types and reassign measurements safely without data loss', async () => {
    // Simulate pre-existing legacy state with 3 duplicate weight types
    await db.measurementTypes.bulkAdd([
      { id: CANONICAL_BODY_WEIGHT_TYPE_ID, name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'type_weight_user_jan_1', userId: 'user_jan_1', name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'type_weight_user_anna_2', userId: 'user_anna_2', name: 'Waga ciała', unit: 'kg', isSystem: true },
      { id: 'custom_type_biceps', userId: 'user_jan_1', name: 'Biceps', unit: 'cm', isSystem: false }
    ]);

    // Add measurements linked to the legacy duplicate IDs
    const m1Date = new Date('2026-11-10');
    const m2Date = new Date('2026-11-12');
    await db.bodyMeasurements.bulkAdd([
      { id: 'meas_jan_1', userId: 'user_jan_1', measurementTypeId: 'type_weight_user_jan_1', value: 82.5, measuredAt: m1Date, notes: 'Waga rano' },
      { id: 'meas_anna_1', userId: 'user_anna_2', measurementTypeId: 'type_weight_user_anna_2', value: 61.0, measuredAt: m2Date, notes: 'Waga start' }
    ]);

    // Run migration & deduplication
    await service.migrateAndDeduplicateMeasurementTypes();

    // Check measurement types: should have exactly 1 body weight type + custom type preserved
    const allTypes = await db.measurementTypes.toArray();
    const weightTypes = allTypes.filter(t => t.name.toLowerCase().includes('waga') || t.id === CANONICAL_BODY_WEIGHT_TYPE_ID);
    expect(weightTypes.length).toBe(1);
    expect(weightTypes[0].id).toBe(CANONICAL_BODY_WEIGHT_TYPE_ID);

    const customBiceps = allTypes.find(t => t.id === 'custom_type_biceps');
    expect(customBiceps).toBeTruthy();
    expect(customBiceps?.isSystem).toBe(false);

    // Verify measurements: must be reassigned to canonical type with ALL details preserved
    const janMeas = await db.bodyMeasurements.get('meas_jan_1');
    expect(janMeas).toBeTruthy();
    expect(janMeas?.measurementTypeId).toBe(CANONICAL_BODY_WEIGHT_TYPE_ID);
    expect(janMeas?.value).toBe(82.5);
    expect(janMeas?.notes).toBe('Waga rano');
    expect(new Date(janMeas!.measuredAt).getTime()).toBe(m1Date.getTime());

    const annaMeas = await db.bodyMeasurements.get('meas_anna_1');
    expect(annaMeas).toBeTruthy();
    expect(annaMeas?.measurementTypeId).toBe(CANONICAL_BODY_WEIGHT_TYPE_ID);
    expect(annaMeas?.value).toBe(61.0);
  });
});
