export interface PlanExerciseItem {
  exerciseId: string;
  targetSets: number;
  targetRepetitions: number;
  targetWeight?: number;
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  exercises: PlanExerciseItem[];
  createdAt: Date;
  updatedAt: Date;
}
