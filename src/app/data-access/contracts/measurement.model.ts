export interface MeasurementType {
  id: string;
  userId?: string; // Optional if system default
  name: string; // e.g. 'Waga', 'Klatka piersiowa'
  unit: string; // 'kg' or 'cm'
  isSystem: boolean;
}

export const CANONICAL_BODY_WEIGHT_TYPE_ID = 'meas_type_weight';

export const SYSTEM_MEASUREMENT_TYPES: MeasurementType[] = [
  { id: CANONICAL_BODY_WEIGHT_TYPE_ID, name: 'Waga ciała', unit: 'kg', isSystem: true },
  { id: 'meas_type_bf', name: 'Tkanka tłuszczowa', unit: '%', isSystem: true },
  { id: 'meas_type_chest', name: 'Klatka piersiowa', unit: 'cm', isSystem: true },
  { id: 'meas_type_waist', name: 'Pas', unit: 'cm', isSystem: true },
  { id: 'meas_type_hips', name: 'Biodra', unit: 'cm', isSystem: true },
  { id: 'meas_type_arm', name: 'Ramię', unit: 'cm', isSystem: true },
  { id: 'meas_type_thigh', name: 'Udo', unit: 'cm', isSystem: true },
  { id: 'meas_type_calf', name: 'Łydka', unit: 'cm', isSystem: true }
];

export interface BodyMeasurement {
  id: string;
  userId: string;
  measurementTypeId: string;
  value: number;
  measuredAt: Date;
  notes?: string;
}
