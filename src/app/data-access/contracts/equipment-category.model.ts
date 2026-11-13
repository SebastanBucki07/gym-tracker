export type EquipmentCategoryId =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'resistance-band';

export interface EquipmentCategory {
  id: EquipmentCategoryId;
  name: string; // Polish name
}
