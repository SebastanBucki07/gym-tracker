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

  async seedSampleUserDataForUser(userId: string): Promise<void> {
    try {
      const workoutCount = await db.workouts.where('userId').equals(userId).count();
      if (workoutCount > 0) return; // already seeded for this user

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const threeDaysAgo = new Date(now.getTime() - 86400000 * 3);

      // 1. Seed Measurement Types if none
      const mTypes = await db.measurementTypes.where('userId').equals(userId).toArray();
      let weightTypeId = 'type_weight_' + userId;
      if (mTypes.length === 0) {
        await db.measurementTypes.add({
          id: weightTypeId,
          userId,
          name: 'Waga ciała',
          unit: 'kg',
          isSystem: true
        });
      } else {
        weightTypeId = mTypes[0].id;
      }

      // 2. Seed Body Measurement
      await db.bodyMeasurements.add({
        id: 'meas_' + crypto.randomUUID(),
        userId,
        measurementTypeId: weightTypeId,
        value: 78.5,
        measuredAt: threeDaysAgo,
        notes: 'Pomiar początkowy'
      });

      // 3. Seed Cardio Types if none
      const cardioTypes = await db.cardioTypes.toArray();
      let treadmillId = 'cardio_treadmill';
      if (cardioTypes.length === 0) {
        await db.cardioTypes.add({
          id: treadmillId,
          name: 'Bieżnia',
          isSystem: true
        });
      } else {
        treadmillId = cardioTypes[0].id;
      }

      // 4. Seed Cardio Activity
      await db.cardioActivities.add({
        id: 'cardio_act_' + crypto.randomUUID(),
        userId,
        cardioTypeId: treadmillId,
        durationMinutes: 30,
        distanceKm: 4.2,
        calories: 320,
        averageHeartRate: 145,
        performedAt: yesterday,
        note: 'Poranny bieg interwałowy'
      });

      // 5. Seed Daily Steps
      const nowLocal = new Date();
      const dateStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
      await db.dailySteps.put({
        id: 'steps_' + userId + '_' + dateStr,
        userId,
        date: dateStr,
        stepsCount: 9420,
        updatedAt: now
      });

      // 6. Seed Workouts & Sets
      const w1Id = 'w_' + crypto.randomUUID();
      const w1: any = {
        id: w1Id,
        userId,
        name: 'Trening A - Klatka i Triceps',
        startedAt: threeDaysAgo,
        completedAt: new Date(threeDaysAgo.getTime() + 3600000),
        durationSeconds: 3600,
        notes: 'Świetna sesja treningowa',
        isCompleted: true,
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo
      };

      const w1Sets = [
        {
          id: 'set_' + crypto.randomUUID(),
          workoutId: w1Id,
          exerciseId: 'barbell_bench_press',
          exerciseName: 'Wyciskanie sztangi na ławce poziomej',
          primaryMuscleGroupId: 'chest',
          setNumber: 1,
          weight: 60,
          repetitions: 12,
          isCompleted: true,
          isWarmup: true
        },
        {
          id: 'set_' + crypto.randomUUID(),
          workoutId: w1Id,
          exerciseId: 'barbell_bench_press',
          exerciseName: 'Wyciskanie sztangi na ławce poziomej',
          primaryMuscleGroupId: 'chest',
          setNumber: 2,
          weight: 85,
          repetitions: 8,
          isCompleted: true,
          isWarmup: false
        },
        {
          id: 'set_' + crypto.randomUUID(),
          workoutId: w1Id,
          exerciseId: 'barbell_bench_press',
          exerciseName: 'Wyciskanie sztangi na ławce poziomej',
          primaryMuscleGroupId: 'chest',
          setNumber: 3,
          weight: 90,
          repetitions: 6,
          isCompleted: true,
          isWarmup: false
        }
      ];

      await db.workouts.add(w1);
      await db.workoutSets.bulkAdd(w1Sets);

      const w2Id = 'w_' + crypto.randomUUID();
      const w2: any = {
        id: w2Id,
        userId,
        name: 'Trening B - Nogi i Plecy',
        startedAt: yesterday,
        completedAt: new Date(yesterday.getTime() + 4500000),
        durationSeconds: 4500,
        notes: 'Mocne przysiady',
        isCompleted: true,
        createdAt: yesterday,
        updatedAt: yesterday
      };

      const w2Sets = [
        {
          id: 'set_' + crypto.randomUUID(),
          workoutId: w2Id,
          exerciseId: 'barbell_squat',
          exerciseName: 'Przysiad ze sztangą na plecach',
          primaryMuscleGroupId: 'quadriceps',
          setNumber: 1,
          weight: 100,
          repetitions: 5,
          isCompleted: true,
          isWarmup: false
        }
      ];

      await db.workouts.add(w2);
      await db.workoutSets.bulkAdd(w2Sets);

    } catch (err) {
      console.error('Error seeding sample user data:', err);
    }
  }
}
