import { Exercise } from '../contracts/exercise.model';

export function toSupabaseExercise(exercise: Exercise): any {
  return {
    id: exercise.id,
    user_id: exercise.userId ? (exercise.userId.startsWith('supa_') ? exercise.userId.replace('supa_', '') : exercise.userId) : null,
    name: exercise.name,
    description: exercise.description ?? null,
    primary_muscle_group_id: exercise.primaryMuscleGroupId,
    equipment_category_id: exercise.equipmentCategoryId,
    source: exercise.source,
    is_active: exercise.isActive,
    created_at: exercise.createdAt instanceof Date ? exercise.createdAt.toISOString() : exercise.createdAt,
    updated_at: exercise.updatedAt instanceof Date ? exercise.updatedAt.toISOString() : exercise.updatedAt
  };
}

export function fromSupabaseExercise(row: any): Exercise {
  return {
    id: row.id,
    userId: row.user_id ? `supa_${row.user_id}` : undefined,
    name: row.name,
    description: row.description ?? undefined,
    primaryMuscleGroupId: row.primary_muscle_group_id,
    secondaryMuscleGroupIds: row.secondary_muscle_group_ids ?? [],
    equipmentCategoryId: row.equipment_category_id,
    source: row.source,
    isActive: row.is_active,
    createdAt: new Date(row.created_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now())
  };
}
