import { AppSettings } from '../contracts/settings.model';

export function toSupabaseAppSettings(settings: AppSettings): any {
  return {
    id: settings.id,
    user_id: settings.userId,
    theme: settings.theme,
    weight_unit: settings.weightUnit,
    measurement_unit: settings.measurementUnit,
    distance_unit: settings.distanceUnit,
    updated_at: new Date().toISOString()
  };
}

export function fromSupabaseAppSettings(row: any): AppSettings {
  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme,
    weightUnit: row.weight_unit,
    measurementUnit: row.measurement_unit,
    distanceUnit: row.distance_unit
  };
}
