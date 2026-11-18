import { Injectable } from '@angular/core';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { SyncEntityHandler, SyncQueueItem } from '../contracts/sync.model';
import { toSupabaseAppSettings } from '../mappers/settings.mapper';

@Injectable({
  providedIn: 'root'
})
export class SupabaseSettingsRepository implements SyncEntityHandler {
  entityType = 'appSettings' as const;

  constructor(private supabaseAuth: SupabaseAuthService) {}

  async push(item: SyncQueueItem): Promise<void> {
    const client = this.supabaseAuth.getSupabaseClient();
    if (!client) throw new Error('Supabase client is not initialized.');

    const { operation, payload } = item;
    if (operation === 'create' || operation === 'update') {
      const data = toSupabaseAppSettings(payload);
      const { error } = await client.from('app_settings').upsert(data);
      if (error) throw new Error(error.message);
    } else if (operation === 'delete') {
      const { error } = await client.from('app_settings').delete().eq('id', item.entityId);
      if (error) throw new Error(error.message);
    }
  }

  async pull(userId: string): Promise<any[]> {
    const client = this.supabaseAuth.getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client.from('app_settings').select('*').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data || [];
  }
}
