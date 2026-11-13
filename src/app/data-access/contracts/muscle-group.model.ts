export type MuscleGroupId =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'glutes'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'traps';

export interface MuscleGroup {
  id: MuscleGroupId;
  name: string; // Polish name
  description?: string;
}
