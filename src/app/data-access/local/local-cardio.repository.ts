import { CardioRepository } from '../contracts/repository.contracts';
import { CardioActivity, CardioType } from '../contracts/cardio.model';
import { db } from './app-database';

export class LocalCardioRepository implements CardioRepository {
  async getTypes(): Promise<CardioType[]> {
    return await db.cardioTypes.toArray();
  }

  async getActivities(userId: string): Promise<CardioActivity[]> {
    return await db.cardioActivities.where('userId').equals(userId).toArray();
  }

  async createActivity(activity: CardioActivity): Promise<string> {
    await db.cardioActivities.add(activity);
    return activity.id;
  }

  async updateActivity(id: string, changes: Partial<CardioActivity>): Promise<void> {
    await db.cardioActivities.update(id, changes);
  }

  async deleteActivity(id: string): Promise<void> {
    await db.cardioActivities.delete(id);
  }
}
