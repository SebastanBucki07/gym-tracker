import Dexie, { Table } from 'dexie';

import { User } from '../contracts/user.model';
import { Exercise } from '../contracts/exercise.model';
import { EquipmentCategory } from '../contracts/equipment-category.model';
import { MuscleGroup } from '../contracts/muscle-group.model';
import { Workout, WorkoutSet } from '../contracts/workout.model';
import { WorkoutPlan } from '../contracts/workout-plan.model';
import { MeasurementType, BodyMeasurement } from '../contracts/measurement.model';
import { CardioType, CardioActivity } from '../contracts/cardio.model';
import { DailySteps } from '../contracts/daily-steps.model';
import { ProgressPhoto } from '../contracts/progress-photo.model';
import { AppSettings } from '../contracts/settings.model';
import { SyncQueueItem, SyncMetadata } from '../contracts/sync.model';

export class AppDatabase extends Dexie {
  users!: Table<User, string>;
  exercises!: Table<Exercise, string>;
  equipmentCategories!: Table<EquipmentCategory, string>;
  muscleGroups!: Table<MuscleGroup, string>;
  workouts!: Table<Workout, string>;
  workoutSets!: Table<WorkoutSet, string>;
  workoutPlans!: Table<WorkoutPlan, string>;
  measurementTypes!: Table<MeasurementType, string>;
  bodyMeasurements!: Table<BodyMeasurement, string>;
  cardioTypes!: Table<CardioType, string>;
  cardioActivities!: Table<CardioActivity, string>;
  dailySteps!: Table<DailySteps, string>;
  progressPhotos!: Table<ProgressPhoto, string>;
  appSettings!: Table<AppSettings, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor() {
    super('GymTrackerDB');

    this.version(1).stores({
      users: 'id, email, username',
      exercises: 'id, primaryMuscleGroupId, equipmentCategoryId, source, userId, isActive',
      equipmentCategories: 'id',
      muscleGroups: 'id',
      workouts: 'id, userId, startedAt, isCompleted',
      workoutSets: 'id, workoutId, exerciseId',
      workoutPlans: 'id, userId',
      measurementTypes: 'id, userId, isSystem',
      bodyMeasurements: 'id, userId, measurementTypeId, measuredAt',
      cardioTypes: 'id, isSystem',
      cardioActivities: 'id, userId, cardioTypeId, performedAt',
      dailySteps: 'id, userId, date, [userId+date]',
      progressPhotos: 'id, userId, takenAt',
      appSettings: 'id, userId'
    });

    this.version(2).stores({
      users: 'id, email, username',
      exercises: 'id, primaryMuscleGroupId, equipmentCategoryId, source, userId, isActive',
      equipmentCategories: 'id',
      muscleGroups: 'id',
      workouts: 'id, userId, startedAt, isCompleted',
      workoutSets: 'id, workoutId, exerciseId',
      workoutPlans: 'id, userId',
      measurementTypes: 'id, userId, isSystem',
      bodyMeasurements: 'id, userId, measurementTypeId, measuredAt',
      cardioTypes: 'id, isSystem',
      cardioActivities: 'id, userId, cardioTypeId, performedAt',
      dailySteps: 'id, userId, date, [userId+date]',
      progressPhotos: 'id, userId, takenAt',
      appSettings: 'id, userId',
      syncQueue:
        'id, userId, entityType, entityId, status, createdAt, updatedAt, [userId+status], [userId+entityType]',
      syncMetadata:
        'id, userId, entityType, [userId+entityType]'
    });
  }
}

export const db = new AppDatabase();
