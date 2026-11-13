import { ExerciseRepository } from '../contracts/repository.contracts';
import { Exercise } from '../contracts/exercise.model';
import { db } from './app-database';

export class LocalExerciseRepository implements ExerciseRepository {
  async getAll(userId?: string): Promise<Exercise[]> {
    if (!userId) {
      return await db.exercises.toArray();
    }
    return await db.exercises
      .filter(ex => ex.source === 'system' || (ex.source === 'user' && ex.userId === userId))
      .toArray();
  }

  async getById(id: string): Promise<Exercise | undefined> {
    return await db.exercises.get(id);
  }

  async create(exercise: Exercise): Promise<string> {
    await db.exercises.add(exercise);
    return exercise.id;
  }

  async update(id: string, changes: Partial<Exercise>): Promise<void> {
    await db.exercises.update(id, { ...changes, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await db.exercises.delete(id);
  }
}
