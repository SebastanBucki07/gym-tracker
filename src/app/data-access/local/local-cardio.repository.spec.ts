import { describe, it, expect, beforeEach } from 'vitest';
import { LocalCardioRepository } from './local-cardio.repository';
import { db } from './app-database';
import { CardioActivity, CardioType } from '../contracts/cardio.model';

describe('LocalCardioRepository', () => {
  let repo: LocalCardioRepository;

  beforeEach(async () => {
    repo = new LocalCardioRepository();
    await db.cardioActivities.clear();
    await db.cardioTypes.clear();
  });

  it('should create and retrieve cardio activities', async () => {
    const type: CardioType = { id: 'cardio_run', name: 'Bieganie', isSystem: true };
    await db.cardioTypes.add(type);

    const activity: CardioActivity = {
      id: 'act_1',
      userId: 'user_1',
      cardioTypeId: 'cardio_run',
      durationMinutes: 45,
      distanceKm: 7.5,
      calories: 500,
      averageHeartRate: 155,
      performedAt: new Date(),
      note: 'Poranny trening'
    };

    await repo.createActivity(activity);
    const activities = await repo.getActivities('user_1');

    expect(activities.length).toBe(1);
    expect(activities[0].durationMinutes).toBe(45);
    expect(activities[0].distanceKm).toBe(7.5);
  });

  it('should update and delete cardio activity', async () => {
    const activity: CardioActivity = {
      id: 'act_2',
      userId: 'user_1',
      cardioTypeId: 'cardio_run',
      durationMinutes: 30,
      performedAt: new Date()
    };

    await repo.createActivity(activity);
    await repo.updateActivity('act_2', { durationMinutes: 40 });
    
    let list = await repo.getActivities('user_1');
    expect(list[0].durationMinutes).toBe(40);

    await repo.deleteActivity('act_2');
    list = await repo.getActivities('user_1');
    expect(list.length).toBe(0);
  });
});
