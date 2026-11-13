import { MuscleGroupId } from './muscle-group.model';
import { EquipmentCategoryId } from './equipment-category.model';

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  primaryMuscleGroupId: MuscleGroupId;
  secondaryMuscleGroupIds: MuscleGroupId[];
  equipmentCategoryId: EquipmentCategoryId;
  imageUrl?: string;
  videoUrl?: string;
  source: 'system' | 'user';
  userId?: string; // Present if source === 'user'
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
