import { ExerciseRepository } from '../contracts/repository.contracts';
import { Exercise } from '../contracts/exercise.model';
import { db } from './app-database';
import { createSyncQueueItem } from './local-sync-queue.repository';

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
    const queueItem = exercise.source === 'user' && exercise.userId ? createSyncQueueItem({
      userId: exercise.userId,
      entityType: 'exercise',
      entityId: exercise.id,
      operation: 'create',
      payload: exercise
    }) : null;

    const existing = await db.exercises.get(exercise.id);

    await db.transaction('rw', db.exercises, db.syncQueue, () => {
      const op = existing
        ? db.exercises.update(exercise.id, exercise as any)
        : db.exercises.add(exercise);
      return op.then(() => queueItem ? db.syncQueue.put(queueItem) : undefined);
    });

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
    return exercise.id;
  }

  async update(id: string, changes: Partial<Exercise>): Promise<void> {
    const existing = await db.exercises.get(id);
    if (!existing) return;
    const updated = { ...existing, ...changes, updatedAt: new Date() };
    const queueItem = updated.source === 'user' && updated.userId ? createSyncQueueItem({
      userId: updated.userId,
      entityType: 'exercise',
      entityId: id,
      operation: 'update',
      payload: updated
    }) : null;

    await db.transaction('rw', db.exercises, db.syncQueue, () =>
      db.exercises.update(id, updated)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await db.exercises.get(id);
    if (!existing) return;
    const queueItem = existing.source === 'user' && existing.userId ? createSyncQueueItem({
      userId: existing.userId,
      entityType: 'exercise',
      entityId: id,
      operation: 'delete'
    }) : null;

    await db.transaction('rw', db.exercises, db.syncQueue, () =>
      db.exercises.delete(id)
        .then(() => queueItem ? db.syncQueue.put(queueItem) : undefined)
    );

    if (queueItem && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-requested'));
    }
  }
}
