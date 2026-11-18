import { WorkoutRepository } from '../contracts/repository.contracts';
import { Workout, WorkoutSet } from '../contracts/workout.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

/**
 * Local-first workout persistence.
 * All work performed inside a Dexie transaction is chained from Dexie
 * operations (rather than an async callback) so the transaction context is
 * retained until every table operation has completed.
 */
export class LocalWorkoutRepository implements WorkoutRepository {
  async getByUserId(userId: string): Promise<Workout[]> {
    return db.workouts.where('userId').equals(userId).toArray();
  }

  async getById(id: string): Promise<Workout | undefined> {
    return db.workouts.get(id);
  }

  async create(workout: Workout, sets: WorkoutSet[]): Promise<string> {
    this.assertUniqueSetIds(sets);

    const queueItem = createSyncQueueItem({
      userId: workout.userId,
      entityType: 'workout',
      entityId: workout.id,
      operation: 'create',
      payload: { workout, sets }
    });

    await db.transaction('rw', db.workouts, db.workoutSets, db.syncQueue, () =>
      db.workouts.put(workout)
        .then(() => db.workoutSets.where('workoutId').equals(workout.id).delete())
        .then(() => sets.length > 0 ? db.workoutSets.bulkPut(sets) : undefined)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    this.requestSync(queueItem !== null);
    return workout.id;
  }

  async update(workoutId: string, workoutChanges: Partial<Workout>, sets?: WorkoutSet[]): Promise<void> {
    if (sets !== undefined) {
      this.assertUniqueSetIds(sets);
    }

    let shouldRequestSync = false;

    await db.transaction('rw', db.workouts, db.workoutSets, db.syncQueue, () =>
      db.workouts.get(workoutId).then(existingWorkout => {
        if (!existingWorkout) {
          return;
        }

        const updatedWorkout: Workout = {
          ...existingWorkout,
          ...workoutChanges,
          updatedAt: new Date()
        };

        return db.workouts.put(updatedWorkout)
          .then(() => {
            if (sets === undefined) {
              return db.workoutSets.where('workoutId').equals(workoutId).toArray();
            }

            return db.workoutSets.where('workoutId').equals(workoutId).delete()
              .then(() => sets.length > 0 ? db.workoutSets.bulkPut(sets) : undefined)
              .then(() => sets);
          })
          .then(finalSets => {
            const queueItem = createSyncQueueItem({
              userId: updatedWorkout.userId,
              entityType: 'workout',
              entityId: workoutId,
              operation: 'update',
              payload: { workout: updatedWorkout, sets: finalSets }
            });

            if (!queueItem) {
              return;
            }

            return db.syncQueue.put(queueItem).then(() => {
              shouldRequestSync = true;
            });
          });
      })
    );

    this.requestSync(shouldRequestSync);
  }

  async delete(id: string): Promise<void> {
    let shouldRequestSync = false;

    await db.transaction('rw', db.workouts, db.workoutSets, db.syncQueue, () =>
      db.workouts.get(id).then(existingWorkout => {
        if (!existingWorkout) {
          return;
        }

        const queueItem = createSyncQueueItem({
          userId: existingWorkout.userId,
          entityType: 'workout',
          entityId: id,
          operation: 'delete'
        });

        return db.workoutSets.where('workoutId').equals(id).delete()
          .then(() => db.workouts.delete(id))
          .then(() => {
            if (!queueItem) {
              return;
            }
            return db.syncQueue.put(queueItem).then(() => {
              shouldRequestSync = true;
            });
          });
      })
    );

    this.requestSync(shouldRequestSync);
  }

  async getSetsForWorkout(workoutId: string): Promise<WorkoutSet[]> {
    return db.workoutSets.where('workoutId').equals(workoutId).toArray();
  }

  private assertUniqueSetIds(sets: WorkoutSet[]): void {
    const ids = sets.map(set => set.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Zestaw serii zawiera powtarzające się identyfikatory ID.');
    }
  }

  /** Dispatch only after the Dexie transaction has committed successfully. */
  private requestSync(shouldRequest: boolean): void {
    if (shouldRequest && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
