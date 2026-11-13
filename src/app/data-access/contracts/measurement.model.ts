export interface MeasurementType {
  id: string;
  userId?: string; // Optional if system default
  name: string; // e.g. 'Waga', 'Klatka piersiowa'
  unit: string; // 'kg' or 'cm'
  isSystem: boolean;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  measurementTypeId: string;
  value: number;
  measuredAt: Date;
  notes?: string;
}
