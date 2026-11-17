import { Workout, WorkoutSet } from '../contracts/workout.model';

export function toSupabaseWorkout(workout: Workout): any {
  return {
    id: workout.id,
    user_id: workout.userId,
    name: workout.name,
    started_at: workout.startedAt instanceof Date ? workout.startedAt.toISOString() : workout.startedAt,
    completed_at: workout.completedAt ? (workout.completedAt instanceof Date ? workout.completedAt.toISOString() : workout.completedAt) : null,
    duration_seconds: workout.durationSeconds ?? null,
    notes: workout.notes ?? null,
    is_completed: workout.isCompleted,
    created_at: workout.createdAt instanceof Date ? workout.createdAt.toISOString() : workout.createdAt,
    updated_at: workout.updatedAt instanceof Date ? workout.updatedAt.toISOString() : workout.updatedAt
  };
}

export function fromSupabaseWorkout(row: any): Workout {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    notes: row.notes ?? undefined,
    isCompleted: row.is_completed,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export function toSupabaseWorkoutSet(set: WorkoutSet): any {
  return {
    id: set.id,
    workout_id: set.workoutId,
    exercise_id: set.exerciseId,
    exercise_name: set.exerciseName ?? null,
    primary_muscle_group_id: set.primaryMuscleGroupId ?? null,
    set_number: set.setNumber,
    weight: set.weight,
    repetitions: set.repetitions,
    is_completed: set.isCompleted,
    is_warmup: set.isWarmup,
    notes: set.notes ?? null,
    completed_at: set.completedAt ? (set.completedAt instanceof Date ? set.completedAt.toISOString() : set.completedAt) : null
  };
}

export function fromSupabaseWorkoutSet(row: any): WorkoutSet {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name ?? undefined,
    primaryMuscleGroupId: row.primary_muscle_group_id ?? undefined,
    setNumber: row.set_number,
    weight: row.weight,
    repetitions: row.repetitions,
    isCompleted: row.is_completed,
    isWarmup: row.is_warmup,
    notes: row.notes ?? undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined
  };
}
