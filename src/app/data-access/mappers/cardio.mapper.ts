import { CardioActivity } from '../contracts/cardio.model';

export function toSupabaseCardioActivity(act: CardioActivity): any {
  return {
    id: act.id,
    user_id: act.userId ? (act.userId.startsWith('supa_') ? act.userId.replace('supa_', '') : act.userId) : null,
    cardio_type_id: act.cardioTypeId,
    duration_minutes: act.durationMinutes,
    distance_km: act.distanceKm ?? null,
    calories: act.calories ?? null,
    average_heart_rate: act.averageHeartRate ?? null,
    performed_at: act.performedAt instanceof Date ? act.performedAt.toISOString() : act.performedAt,
    note: act.note ?? null
  };
}

export function fromSupabaseCardioActivity(row: any): CardioActivity {
  return {
    id: row.id,
    userId: row.user_id ? `supa_${row.user_id}` : row.user_id,
    cardioTypeId: row.cardio_type_id,
    durationMinutes: row.duration_minutes,
    distanceKm: row.distance_km ?? undefined,
    calories: row.calories ?? undefined,
    averageHeartRate: row.average_heart_rate ?? undefined,
    performedAt: new Date(row.performed_at),
    note: row.note ?? undefined
  };
}
