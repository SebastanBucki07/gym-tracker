import { Injectable } from '@angular/core';
import { db } from '../../data-access/local/app-database';
import muscleGroupsData from '../../../assets/data/muscle-groups.json';
import equipmentCategoriesData from '../../../assets/data/equipment-categories.json';
import exercisesData from '../../../assets/data/exercises.json';
import { CANONICAL_BODY_WEIGHT_TYPE_ID, SYSTEM_MEASUREMENT_TYPES } from '../../data-access/contracts/measurement.model';

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

      const cardioTypesCount = await db.cardioTypes.count();
      if (cardioTypesCount === 0) {
        await db.cardioTypes.bulkAdd([
          { id: 'cardio_treadmill', name: 'Bieżnia', isSystem: true },
          { id: 'cardio_running', name: 'Bieganie (teren)', isSystem: true },
          { id: 'cardio_cycling', name: 'Rower', isSystem: true },
          { id: 'cardio_swimming', name: 'Basen / Pływanie', isSystem: true },
          { id: 'cardio_rowing', name: 'Wioślarz', isSystem: true },
          { id: 'cardio_elliptical', name: 'Orbitrek', isSystem: true },
          { id: 'cardio_walking', name: 'Marsz / Spacer', isSystem: true },
          { id: 'cardio_other', name: 'Inne', isSystem: true }
        ]);
      }

      // Idempotent system measurement types seeding
      for (const st of SYSTEM_MEASUREMENT_TYPES) {
        const existing = await db.measurementTypes.get(st.id);
        if (!existing) {
          await db.measurementTypes.put(st);
        }
      }

      // Safe migration and deduplication of previously seeded duplicate measurement types
      await this.migrateAndDeduplicateMeasurementTypes();
    } catch (err) {
      console.error('Error seeding database:', err);
    }
  }

  async migrateAndDeduplicateMeasurementTypes(): Promise<void> {
    try {
      // 1. Ensure canonical body weight type is in place
      await db.measurementTypes.put({
        id: CANONICAL_BODY_WEIGHT_TYPE_ID,
        name: 'Waga ciała',
        unit: 'kg',
        isSystem: true
      });

      // 2. Identify duplicate body weight types
      const allTypes = await db.measurementTypes.toArray();
      const duplicateWeightTypes = allTypes.filter(t => {
        if (t.id === CANONICAL_BODY_WEIGHT_TYPE_ID) return false;
        const isWeightName = t.name.trim().toLowerCase() === 'waga ciała' || t.name.trim().toLowerCase() === 'waga';
        const isWeightUnit = t.unit.trim().toLowerCase() === 'kg';
        const isOldSeeded = t.id.startsWith('type_weight_');
        return isOldSeeded || (isWeightName && isWeightUnit && t.isSystem);
      });

      for (const dup of duplicateWeightTypes) {
        // Reassign any measurements pointing to the duplicate type to the canonical type
        const affectedMeasurements = await db.bodyMeasurements
          .where('measurementTypeId')
          .equals(dup.id)
          .toArray();

        for (const m of affectedMeasurements) {
          await db.bodyMeasurements.update(m.id, {
            measurementTypeId: CANONICAL_BODY_WEIGHT_TYPE_ID
          });
        }

        // Delete the duplicate type
        await db.measurementTypes.delete(dup.id);
      }
    } catch (err) {
      console.error('Error migrating and deduplicating measurement types:', err);
    }
  }

  async seedSampleUserDataForUser(userId: string): Promise<void> {
    try {
      const workoutCount = await db.workouts.where('userId').equals(userId).count();
      if (workoutCount > 0) return; // already seeded for this user

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const threeDaysAgo = new Date(now.getTime() - 86400000 * 3);

      // 1. Ensure canonical measurement type exists
      await db.measurementTypes.put({
        id: CANONICAL_BODY_WEIGHT_TYPE_ID,
        name: 'Waga ciała',
        unit: 'kg',
        isSystem: true
      });

      // 2. Seed Body Measurement referencing canonical body weight type
      await db.bodyMeasurements.add({
        id: 'meas_' + crypto.randomUUID(),
        userId,
        measurementTypeId: CANONICAL_BODY_WEIGHT_TYPE_ID,
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
