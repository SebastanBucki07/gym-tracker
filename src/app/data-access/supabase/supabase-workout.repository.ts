import { Injectable } from '@angular/core';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { SyncEntityHandler, SyncQueueItem } from '../contracts/sync.model';
import { toSupabaseWorkout, toSupabaseWorkoutSet } from '../mappers/workout.mapper';

@Injectable({
  providedIn: 'root'
})
export class SupabaseWorkoutRepository implements SyncEntityHandler {
  entityType = 'workout' as const;

  constructor(private supabaseAuth: SupabaseAuthService) {}

  async push(item: SyncQueueItem): Promise<void> {
    const client = this.supabaseAuth.getSupabaseClient();
    if (!client) {
      throw new Error('Supabase client is not initialized.');
    }

    const { operation, payload } = item;
    if (!payload && operation !== 'delete') {
      throw new Error('Missing payload for sync queue item.');
    }

    if (operation === 'create' || operation === 'update') {
      const workoutObj = payload.workout || payload;
      const workoutData = toSupabaseWorkout(workoutObj);
      console.log('SupabaseWorkoutRepository pushing workoutData:', workoutData);
      const { error: wError } = await client.from('workouts').upsert(workoutData);
      if (wError) {
        console.error('Supabase workout upsert error:', wError);
        throw new Error(wError.message);
      }
      console.log('Supabase workout upsert success');

      const setsArr = payload.sets;
      if (setsArr && Array.isArray(setsArr)) {
        for (const set of setsArr) {
          const setData = toSupabaseWorkoutSet(set);
          const { error: sError } = await client.from('workout_sets').upsert(setData);
          if (sError) {
            console.error('Supabase workout set upsert error:', sError);
            throw new Error(sError.message);
          }
        }
      }
    } else if (operation === 'delete') {
      const { error } = await client.from('workouts').delete().eq('id', item.entityId);
      if (error) throw new Error(error.message);
    }
  }

  async pull(userId: string, since?: Date | null): Promise<any[]> {
    const client = this.supabaseAuth.getSupabaseClient();
    if (!client) return [];

    let query = client.from('workouts').select('*, workout_sets(*)').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }
}
