import { WorkoutRepository } from '../contracts/repository.contracts';
import { Workout, WorkoutSet } from '../contracts/workout.model';
import { db } from './app-database';

export class LocalWorkoutRepository implements WorkoutRepository {
  async getByUserId(userId: string): Promise<Workout[]> {
    return await db.workouts.where('userId').equals(userId).toArray();
  }

  async getById(id: string): Promise<Workout | undefined> {
    return await db.workouts.get(id);
  }

  async create(workout: Workout, sets: WorkoutSet[]): Promise<string> {
    await db.transaction('rw', db.workouts, db.workoutSets, async () => {
      await db.workouts.add(workout);
      if (sets && sets.length > 0) {
        await db.workoutSets.bulkAdd(sets);
      }
    });
    return workout.id;
  }

  async update(workoutId: string, workoutChanges: Partial<Workout>, sets?: WorkoutSet[]): Promise<void> {
    await db.transaction('rw', db.workouts, db.workoutSets, async () => {
      await db.workouts.update(workoutId, { ...workoutChanges, updatedAt: new Date() });
      if (sets) {
        await db.workoutSets.where('workoutId').equals(workoutId).delete();
        if (sets.length > 0) {
          await db.workoutSets.bulkAdd(sets);
        }
      }
    });
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.workouts, db.workoutSets, async () => {
      await db.workoutSets.where('workoutId').equals(id).delete();
      await db.workouts.delete(id);
    });
  }

  async getSetsForWorkout(workoutId: string): Promise<WorkoutSet[]> {
    return await db.workoutSets.where('workoutId').equals(workoutId).toArray();
  }
}
