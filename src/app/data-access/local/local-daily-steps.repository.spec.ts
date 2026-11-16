import { describe, it, expect, beforeEach } from 'vitest';
import { LocalDailyStepsRepository } from './local-daily-steps.repository';
import { db } from './app-database';
import { DailySteps } from '../contracts/daily-steps.model';

describe('LocalDailyStepsRepository', () => {
  let repo: LocalDailyStepsRepository;

  beforeEach(async () => {
    repo = new LocalDailyStepsRepository();
    await db.dailySteps.clear();
  });

  it('should upsert daily steps (create if not exists, update if exists)', async () => {
    const steps1: DailySteps = {
      id: 'steps_u1_2026-11-16',
      userId: 'user_1',
      date: '2026-11-16',
      stepsCount: 8000,
      updatedAt: new Date()
    };

    await repo.upsert(steps1);
    let fetched = await repo.getByDate('user_1', '2026-11-16');
    expect(fetched?.stepsCount).toBe(8000);

    // Upsert with updated steps count for same date
    const steps2: DailySteps = {
      id: 'steps_u1_2026-11-16_updated',
      userId: 'user_1',
      date: '2026-11-16',
      stepsCount: 12000,
      updatedAt: new Date()
    };

    await repo.upsert(steps2);
    fetched = await repo.getByDate('user_1', '2026-11-16');
    expect(fetched?.stepsCount).toBe(12000);

    // Verify only 1 record exists for that user and date
    const all = await repo.getByRange('user_1', '2026-11-01', '2026-11-30');
    expect(all.length).toBe(1);
  });
});
