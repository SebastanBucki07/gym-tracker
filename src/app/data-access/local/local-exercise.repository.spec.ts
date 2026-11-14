import { describe, it, expect, beforeEach } from 'vitest';
import { LocalExerciseRepository } from './local-exercise.repository';
import { db } from './app-database';
import { Exercise } from '../contracts/exercise.model';

describe('LocalExerciseRepository', () => {
  let repo: LocalExerciseRepository;

  beforeEach(async () => {
    repo = new LocalExerciseRepository();
    await db.exercises.clear();
  });

  it('should create and get exercise by id', async () => {
    const exercise: Exercise = {
      id: 'ex_test_1',
      name: 'Test Exercise',
      description: 'Test description',
      primaryMuscleGroupId: 'chest',
      secondaryMuscleGroupIds: ['triceps'],
      equipmentCategoryId: 'barbell',
      source: 'system',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await repo.create(exercise);
    const fetched = await repo.getById('ex_test_1');

    expect(fetched).toBeTruthy();
    expect(fetched?.name).toBe('Test Exercise');
  });

  it('should filter exercises by userId (system + user specific)', async () => {
    const systemEx: Exercise = {
      id: 'ex_sys_1',
      name: 'System Exercise',
      primaryMuscleGroupId: 'chest',
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'barbell',
      source: 'system',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const user1Ex: Exercise = {
      id: 'ex_u1_1',
      name: 'User 1 Exercise',
      primaryMuscleGroupId: 'back',
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'dumbbell',
      source: 'user',
      userId: 'user_1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const user2Ex: Exercise = {
      id: 'ex_u2_1',
      name: 'User 2 Exercise',
      primaryMuscleGroupId: 'quadriceps',
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'machine',
      source: 'user',
      userId: 'user_2',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await repo.create(systemEx);
    await repo.create(user1Ex);
    await repo.create(user2Ex);

    const user1List = await repo.getAll('user_1');
    expect(user1List.length).toBe(2);
    expect(user1List.some(e => e.id === 'ex_sys_1')).toBe(true);
    expect(user1List.some(e => e.id === 'ex_u1_1')).toBe(true);
    expect(user1List.some(e => e.id === 'ex_u2_1')).toBe(false);
  });

  it('should update exercise and modify updatedAt', async () => {
    const exercise: Exercise = {
      id: 'ex_up_1',
      name: 'Old Name',
      primaryMuscleGroupId: 'chest',
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'barbell',
      source: 'user',
      userId: 'user_1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await repo.create(exercise);
    await repo.update('ex_up_1', { name: 'New Name', isActive: false });

    const updated = await repo.getById('ex_up_1');
    expect(updated?.name).toBe('New Name');
    expect(updated?.isActive).toBe(false);
  });

  it('should delete exercise', async () => {
    const exercise: Exercise = {
      id: 'ex_del_1',
      name: 'To Delete',
      primaryMuscleGroupId: 'chest',
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'barbell',
      source: 'user',
      userId: 'user_1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await repo.create(exercise);
    await repo.delete('ex_del_1');
    const fetched = await repo.getById('ex_del_1');
    expect(fetched).toBeUndefined();
  });
});
