export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseName?: string; // Historical snapshot
  primaryMuscleGroupId?: string; // Historical snapshot
  setNumber: number;
  weight: number; // in kg
  repetitions: number;
  isCompleted: boolean;
  isWarmup: boolean;
  notes?: string;
  completedAt?: Date;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
  notes?: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
