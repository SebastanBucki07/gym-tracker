import { BodyMeasurement, MeasurementType } from '../contracts/measurement.model';

export function toSupabaseMeasurementType(type: MeasurementType): any {
  return {
    id: type.id,
    user_id: type.userId ?? null,
    name: type.name,
    unit: type.unit,
    is_system: type.isSystem
  };
}

export function fromSupabaseMeasurementType(row: any): MeasurementType {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    unit: row.unit,
    isSystem: row.is_system
  };
}

export function toSupabaseBodyMeasurement(m: BodyMeasurement): any {
  return {
    id: m.id,
    user_id: m.userId,
    measurement_type_id: m.measurementTypeId,
    value: m.value,
    measured_at: m.measuredAt instanceof Date ? m.measuredAt.toISOString() : m.measuredAt,
    notes: m.notes ?? null
  };
}

export function fromSupabaseBodyMeasurement(row: any): BodyMeasurement {
  return {
    id: row.id,
    userId: row.user_id,
    measurementTypeId: row.measurement_type_id,
    value: row.value,
    measuredAt: new Date(row.measured_at),
    notes: row.notes ?? undefined
  };
}
