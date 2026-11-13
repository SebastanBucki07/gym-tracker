import { SettingsRepository } from '../contracts/repository.contracts';
import { AppSettings } from '../contracts/settings.model';
import { db } from './app-database';

export class LocalSettingsRepository implements SettingsRepository {
  async getByUserId(userId: string): Promise<AppSettings | undefined> {
    return await db.appSettings.where('userId').equals(userId).first();
  }

  async upsert(settings: AppSettings): Promise<void> {
    const existing = await this.getByUserId(settings.userId);
    if (existing) {
      await db.appSettings.update(existing.id, settings);
    } else {
      await db.appSettings.add(settings);
    }
  }
}
