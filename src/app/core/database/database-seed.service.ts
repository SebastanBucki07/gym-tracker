import { Injectable } from '@angular/core';
import { db } from '../../data-access/local/app-database';
import muscleGroupsData from '../../../assets/data/muscle-groups.json';
import equipmentCategoriesData from '../../../assets/data/equipment-categories.json';
import exercisesData from '../../../assets/data/exercises.json';

@Injectable({
  providedIn: 'root'
})
export class DatabaseSeedService {
  async seedDatabase(): Promise<void> {
    try {
      const mgCount = await db.muscleGroups.count();
      if (mgCount === 0) {
        await db.muscleGroups.bulkAdd(muscleGroupsData as any);
      }

      const eqCount = await db.equipmentCategories.count();
      if (eqCount === 0) {
        await db.equipmentCategories.bulkAdd(equipmentCategoriesData as any);
      }

      const exCount = await db.exercises.count();
      if (exCount === 0) {
        const mappedExercises = exercisesData.map(ex => ({
          ...ex,
          createdAt: new Date(ex.createdAt),
          updatedAt: new Date(ex.updatedAt)
        }));
        await db.exercises.bulkAdd(mappedExercises as any);
      }
    } catch (err) {
      console.error('Error seeding database:', err);
    }
  }
}
