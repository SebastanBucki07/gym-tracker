import { User } from './user.model';
import { Exercise } from './exercise.model';
import { Workout, WorkoutSet } from './workout.model';
import { WorkoutPlan } from './workout-plan.model';
import { BodyMeasurement, MeasurementType } from './measurement.model';
import { CardioActivity, CardioType } from './cardio.model';
import { DailySteps } from './daily-steps.model';
import { ProgressPhoto } from './progress-photo.model';
import { AppSettings } from './settings.model';

export interface BaseRepository<T> {
  getById(id: string): Promise<T | undefined>;
  getAll(userId: string): Promise<T[]>;
  create(item: T): Promise<string>;
  update(id: string, changes: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface UserRepository extends BaseRepository<User> {
  getByEmail(email: string): Promise<User | undefined>;
}

export interface ExerciseRepository {
  getAll(userId?: string): Promise<Exercise[]>;
  getById(id: string): Promise<Exercise | undefined>;
  create(exercise: Exercise): Promise<string>;
  update(id: string, changes: Partial<Exercise>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WorkoutRepository {
  getByUserId(userId: string): Promise<Workout[]>;
  getById(id: string): Promise<Workout | undefined>;
  create(workout: Workout, sets: WorkoutSet[]): Promise<string>;
  update(workoutId: string, workoutChanges: Partial<Workout>, sets?: WorkoutSet[]): Promise<void>;
  delete(id: string): Promise<void>;
  getSetsForWorkout(workoutId: string): Promise<WorkoutSet[]>;
}

export interface WorkoutPlanRepository extends BaseRepository<WorkoutPlan> {}

export interface MeasurementRepository {
  getTypes(userId?: string): Promise<MeasurementType[]>;
  getMeasurements(userId: string): Promise<BodyMeasurement[]>;
  createMeasurement(measurement: BodyMeasurement): Promise<string>;
  updateMeasurement(id: string, changes: Partial<BodyMeasurement>): Promise<void>;
  deleteMeasurement(id: string): Promise<void>;
}

export interface CardioRepository {
  getTypes(): Promise<CardioType[]>;
  getActivities(userId: string): Promise<CardioActivity[]>;
  createActivity(activity: CardioActivity): Promise<string>;
  updateActivity(id: string, changes: Partial<CardioActivity>): Promise<void>;
  deleteActivity(id: string): Promise<void>;
}

export interface DailyStepsRepository {
  getByDate(userId: string, date: string): Promise<DailySteps | undefined>;
  getByRange(userId: string, startDate: string, endDate: string): Promise<DailySteps[]>;
  upsert(steps: DailySteps): Promise<void>;
}

export interface ProgressPhotoRepository extends BaseRepository<ProgressPhoto> {}

export interface SettingsRepository {
  getByUserId(userId: string): Promise<AppSettings | undefined>;
  upsert(settings: AppSettings): Promise<void>;
}
