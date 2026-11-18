import { Injectable } from '@angular/core';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { SyncEntityHandler, SyncQueueItem } from '../contracts/sync.model';
import { toSupabaseExercise } from '../mappers/exercise.mapper';

@Injectable({
  providedIn: 'root'
})
export class SupabaseExerciseRepository implements SyncEntityHandler {
  entityType = 'exercise' as const;

  constructor(private supabaseAuth: SupabaseAuthService) {}

  async push(item: SyncQueueItem): Promise<void> {
    const client = this.supabaseAuth.getSupabaseClient();
    if (!client) throw new Error('Supabase client is not initialized.');

    const { operation, payload } = item;
    if (operation === 'create' || operation === 'update') {
      const data = toSupabaseExercise(payload);
      const { error } = await client.from('exercises').upsert(data);
      if (error) throw new Error(error.message);
    } else if (operation === 'delete') {
      const { error } = await client.from('exercises').delete().eq('id', item.entityId);
      if (error) throw new Error(error.message);
    }
  }

  async pull(userId: string): Promise<any[]> {
    const client = this.supabaseAuth.getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client.from('exercises').select('*').or(`user_id.eq.${userId},user_id.is.null`);
    if (error) throw new Error(error.message);
    return data || [];
  }
}
