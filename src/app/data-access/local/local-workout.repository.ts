
import { WorkoutRepository } from '../contracts/repository.contracts';
import { Workout, WorkoutSet } from '../contracts/workout.model';
import { db } from './app-database';

export class LocalWorkoutRepository implements WorkoutRepository {

  async getByUserId(userId: string): Promise<Workout[]> {
    return db.workouts
      .where('userId')
      .equals(userId)
      .toArray();
  }

  async getById(id: string): Promise<Workout | undefined> {
    return db.workouts.get(id);
  }

 async create(
  workout: Workout,
  sets: WorkoutSet[]
): Promise<string> {

  const ids = sets.map(set => set.id);

  if (new Set(ids).size !== ids.length) {
    throw new Error(
      'Zestaw serii zawiera powtarzające się identyfikatory ID.'
    );
  }

  await db.transaction(
    'rw',
    db.workouts,
    db.workoutSets,
    () => {
      return db.workouts.add(workout).then(() => {
        if (sets.length === 0) {
          return;
        }

        return db.workoutSets.bulkAdd(sets);
      });
    }
  );

  return workout.id;
}

  async update(
  workoutId: string,
  workoutChanges: Partial<Workout>,
  sets?: WorkoutSet[]
): Promise<void> {

  if (sets !== undefined) {
    const ids = sets.map(set => set.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error(
        'Zestaw serii zawiera powtarzające się identyfikatory ID.'
      );
    }
  }

  await db.transaction(
    'rw',
    db.workouts,
    db.workoutSets,
    () => {
      return db.workouts.update(workoutId, {
        ...workoutChanges,
        updatedAt: new Date()
      }).then(() => {

        if (sets === undefined) {
          return;
        }

        return db.workoutSets
          .where('workoutId')
          .equals(workoutId)
          .delete()
          .then(() => {
            if (sets.length === 0) {
              return;
            }

            return db.workoutSets.bulkAdd(sets);
          });
      });
    }
  );
}
async delete(id: string): Promise<void> {

  await db.transaction(
    'rw',
    db.workouts,
    db.workoutSets,
    () => {
      return db.workoutSets
        .where('workoutId')
        .equals(id)
        .delete()
        .then(() => {
          return db.workouts.delete(id);
        });
    }
  );
}
  async getSetsForWorkout(
    workoutId: string
  ): Promise<WorkoutSet[]> {

    return db.workoutSets
      .where('workoutId')
      .equals(workoutId)
      .toArray();
  }
}
