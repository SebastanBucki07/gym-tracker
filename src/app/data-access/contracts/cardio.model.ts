export interface CardioType {
  id: string;
  name: string; // e.g. 'Bieżnia', 'Rower'
  isSystem: boolean;
}

export interface CardioActivity {
  id: string;
  userId: string;
  cardioTypeId: string;
  durationMinutes: number;
  distanceKm?: number;
  calories?: number;
  averageHeartRate?: number;
  performedAt: Date;
  note?: string;
}
