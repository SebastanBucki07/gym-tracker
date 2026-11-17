import { WorkoutPlan } from '../contracts/workout-plan.model';

export function toSupabaseWorkoutPlan(plan: WorkoutPlan): any {
  return {
    id: plan.id,
    user_id: plan.userId,
    name: plan.name,
    description: plan.description ?? null,
    exercises: plan.exercises,
    created_at: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
    updated_at: plan.updatedAt instanceof Date ? plan.updatedAt.toISOString() : plan.updatedAt
  };
}

export function fromSupabaseWorkoutPlan(row: any): WorkoutPlan {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    exercises: row.exercises ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}
