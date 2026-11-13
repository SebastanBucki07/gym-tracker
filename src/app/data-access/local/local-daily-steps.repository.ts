import { DailyStepsRepository } from '../contracts/repository.contracts';
import { DailySteps } from '../contracts/daily-steps.model';
import { db } from './app-database';

export class LocalDailyStepsRepository implements DailyStepsRepository {
  async getByDate(userId: string, date: string): Promise<DailySteps | undefined> {
    return await db.dailySteps.where('[userId+date]').equals([userId, date]).first();
  }

  async getByRange(userId: string, startDate: string, endDate: string): Promise<DailySteps[]> {
    return await db.dailySteps
      .where('userId')
      .equals(userId)
      .filter(s => s.date >= startDate && s.date <= endDate)
      .toArray();
  }

  async upsert(steps: DailySteps): Promise<void> {
    const existing = await this.getByDate(steps.userId, steps.date);
    if (existing) {
      await db.dailySteps.update(existing.id, {
        stepsCount: steps.stepsCount,
        updatedAt: new Date()
      });
    } else {
      await db.dailySteps.add(steps);
    }
  }
}
