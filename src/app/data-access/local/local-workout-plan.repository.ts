import { WorkoutPlanRepository } from '../contracts/repository.contracts';
import { WorkoutPlan } from '../contracts/workout-plan.model';
import { db } from './app-database';

export class LocalWorkoutPlanRepository implements WorkoutPlanRepository {
  async getById(id: string): Promise<WorkoutPlan | undefined> {
    return await db.workoutPlans.get(id);
  }

  async getAll(userId: string): Promise<WorkoutPlan[]> {
    return await db.workoutPlans.where('userId').equals(userId).toArray();
  }

  async create(item: WorkoutPlan): Promise<string> {
    await db.workoutPlans.add(item);
    return item.id;
  }

  async update(id: string, changes: Partial<WorkoutPlan>): Promise<void> {
    await db.workoutPlans.update(id, { ...changes, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await db.workoutPlans.delete(id);
  }
}
