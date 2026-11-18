import { Injectable, signal, computed } from '@angular/core';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { db } from '../../data-access/local/app-database';
import { SyncAuthError } from '../../data-access/contracts/sync.model';
import {
  toSupabaseWorkout,
  toSupabaseWorkoutSet
} from '../../data-access/mappers/workout.mapper';
import { toSupabaseExercise } from '../../data-access/mappers/exercise.mapper';
import {
  toSupabaseBodyMeasurement,
  toSupabaseMeasurementType
} from '../../data-access/mappers/measurement.mapper';
import { toSupabaseCardioActivity } from '../../data-access/mappers/cardio.mapper';
import { toSupabaseDailySteps } from '../../data-access/mappers/steps.mapper';
import { toSupabaseAppSettings } from '../../data-access/mappers/settings.mapper';
import { toSupabaseWorkoutPlan } from '../../data-access/mappers/workout-plan.mapper';

export type ImportStateStatus = 'idle' | 'previewing' | 'importing' | 'completed' | 'error';

export interface ImportPreviewResult {
  tableCounts: Record<string, number>;
  totalRecords: number;
  hasAmbiguousOwnership: boolean;
  legacyRecordsCount: number;
}

export interface ImportProgress {
  currentTable: string;
  processedTables: number;
  totalTables: number;
  importedRecords: number;
  totalRecords: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class InitialDataImportService {
  private statusSignal = signal<ImportStateStatus>('idle');
  private progressSignal = signal<ImportProgress>({
    currentTable: '',
    processedTables: 0,
    totalTables: 0,
    importedRecords: 0,
    totalRecords: 0,
    errors: []
  });

  readonly status = this.statusSignal.asReadonly();
  readonly progress = this.progressSignal.asReadonly();

  constructor(private supabaseAuth: SupabaseAuthService) {}

  private getActiveSupabaseUserId(): string {
    const supaUser = this.supabaseAuth.currentUser();
    if (!supaUser || !supaUser.id || supaUser.id === 'user_jan_1' || supaUser.id.trim() === '') {
      throw new SyncAuthError(
        'Brak aktywnej sesji Supabase Auth. Import danych wymaga zalogowanego użytkownika w chmurze.'
      );
    }
    return supaUser.id;
  }

  private async fetchTableRecords<T>(
    table: any,
    userId: string,
    allowOverride: boolean,
    filterFn?: (item: T) => boolean
  ): Promise<T[]> {
    const userRecords: T[] = await table.where('userId').equals(userId).toArray();
    let legacyRecords: T[] = [];
    if (allowOverride) {
      legacyRecords = await table.where('userId').equals('user_jan_1').toArray();
    }
    const combined = [...userRecords, ...legacyRecords];
    const map = new Map<string, T>();
    for (const item of combined) {
      const record = item as any;
      const id = record.id;
      if (id) {
        map.set(id, { ...record, userId });
      }
    }
    const results = Array.from(map.values());
    if (filterFn) {
      return results.filter(filterFn);
    }
    return results;
  }

  async previewLocalData(allowOverride = false): Promise<ImportPreviewResult> {
    const userId = this.getActiveSupabaseUserId();
    this.statusSignal.set('previewing');

    const tableCounts: Record<string, number> = {};
    let legacyRecordsCount = 0;

    const legacyWorkouts = await db.workouts.where('userId').equals('user_jan_1').count();
    const legacyMeasurements = await db.bodyMeasurements.where('userId').equals('user_jan_1').count();
    legacyRecordsCount = legacyWorkouts + legacyMeasurements;

    const settings = await this.fetchTableRecords<any>(db.appSettings, userId, allowOverride);
    tableCounts['app_settings'] = settings.length;

    const exercises = await this.fetchTableRecords<any>(
      db.exercises,
      userId,
      allowOverride,
      (e: any) => e.userId === userId || e.userId === 'user_jan_1' || e.source === 'user'
    );
    tableCounts['exercises'] = exercises.length;

    const mTypes = await this.fetchTableRecords<any>(
      db.measurementTypes,
      userId,
      allowOverride,
      (t: any) => t.userId === userId || t.userId === 'user_jan_1' || !t.isSystem
    );
    tableCounts['measurement_types'] = mTypes.length;

    const workouts = await this.fetchTableRecords<any>(db.workouts, userId, allowOverride);
    tableCounts['workouts'] = workouts.length;

    let totalSets = 0;
    for (const w of workouts) {
      const sets = await db.workoutSets.where('workoutId').equals(w.id).toArray();
      totalSets += sets.length;
    }
    tableCounts['workout_sets'] = totalSets;

    const plans = await this.fetchTableRecords<any>(db.workoutPlans, userId, allowOverride);
    tableCounts['workout_plans'] = plans.length;

    const measurements = await this.fetchTableRecords<any>(db.bodyMeasurements, userId, allowOverride);
    tableCounts['body_measurements'] = measurements.length;

    const cardio = await this.fetchTableRecords<any>(db.cardioActivities, userId, allowOverride);
    tableCounts['cardio_activities'] = cardio.length;

    const steps = await this.fetchTableRecords<any>(db.dailySteps, userId, allowOverride);
    tableCounts['daily_steps'] = steps.length;

    const photos = await this.fetchTableRecords<any>(db.progressPhotos, userId, allowOverride);
    tableCounts['progress_photos'] = photos.length;

    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);
    const hasAmbiguousOwnership = legacyRecordsCount > 0;

    return {
      tableCounts,
      totalRecords,
      hasAmbiguousOwnership,
      legacyRecordsCount
    };
  }

  async executeImport(allowAmbiguousOverride = false): Promise<ImportProgress> {
    const userId = this.getActiveSupabaseUserId();
    const client = this.supabaseAuth.getSupabaseClient();
    
    if (!client) {
      throw new Error('Supabase client is not initialized.');
    }

    const preview = await this.previewLocalData(allowAmbiguousOverride);
    if (preview.hasAmbiguousOwnership && !allowAmbiguousOverride) {
      throw new Error(
        'Wykryto niejednoznacznego właściciela danych (rekordy przypisane do user_jan_1). Wymagana jawna zgoda na import.'
      );
    }

    this.statusSignal.set('importing');
    const errors: string[] = [];
    let importedRecords = 0;

    const progress: ImportProgress = {
      currentTable: '',
      processedTables: 0,
      totalTables: 10,
      importedRecords: 0,
      totalRecords: preview.totalRecords,
      errors
    };

    this.progressSignal.set(progress);

    try {
      // 1. App Settings
      progress.currentTable = 'app_settings';
      this.progressSignal.set({ ...progress });
      const settings = await this.fetchTableRecords<any>(db.appSettings, userId, allowAmbiguousOverride);
      for (const s of settings) {
        const payload = toSupabaseAppSettings({ ...s, userId });
        const { error } = await client.from('app_settings').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`app_settings (${s.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 2. Exercises
      progress.currentTable = 'exercises';
      this.progressSignal.set({ ...progress });
      const exercises = await this.fetchTableRecords<any>(
        db.exercises,
        userId,
        allowAmbiguousOverride,
        (e: any) => e.userId === userId || e.userId === 'user_jan_1' || e.source === 'user'
      );
      for (const e of exercises) {
        const payload = toSupabaseExercise({ ...e, userId });
        const { error } = await client.from('exercises').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`exercises (${e.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 3. Measurement Types
      progress.currentTable = 'measurement_types';
      this.progressSignal.set({ ...progress });
      const mTypes = await this.fetchTableRecords<any>(
        db.measurementTypes,
        userId,
        allowAmbiguousOverride,
        (t: any) => t.userId === userId || t.userId === 'user_jan_1' || !t.isSystem
      );
      for (const t of mTypes) {
        const payload = toSupabaseMeasurementType({ ...t, userId });
        const { error } = await client.from('measurement_types').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`measurement_types (${t.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 4. Workouts & Workout Sets
      progress.currentTable = 'workouts';
      this.progressSignal.set({ ...progress });
      const workouts = await this.fetchTableRecords<any>(db.workouts, userId, allowAmbiguousOverride);
      for (const w of workouts) {
        const payload = toSupabaseWorkout({ ...w, userId });
        const { error } = await client.from('workouts').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`workouts (${w.id}): ${error.message}`);
        } else {
          importedRecords++;
          const sets = await db.workoutSets.where('workoutId').equals(w.id).toArray();
          for (const s of sets) {
            const setPayload = toSupabaseWorkoutSet(s);
            const { error: sError } = await client.from('workout_sets').upsert(setPayload, { onConflict: 'id' });
            if (sError) {
              errors.push(`workout_sets (${s.id}): ${sError.message}`);
            } else {
              importedRecords++;
            }
          }
        }
      }
      progress.processedTables += 2;

      // 5. Workout Plans
      progress.currentTable = 'workout_plans';
      this.progressSignal.set({ ...progress });
      const plans = await this.fetchTableRecords<any>(db.workoutPlans, userId, allowAmbiguousOverride);
      for (const p of plans) {
        const payload = toSupabaseWorkoutPlan({ ...p, userId });
        const { error } = await client.from('workout_plans').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`workout_plans (${p.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 6. Body Measurements
      progress.currentTable = 'body_measurements';
      this.progressSignal.set({ ...progress });
      const measurements = await this.fetchTableRecords<any>(db.bodyMeasurements, userId, allowAmbiguousOverride);
      for (const m of measurements) {
        const payload = toSupabaseBodyMeasurement({ ...m, userId });
        const { error } = await client.from('body_measurements').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`body_measurements (${m.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 7. Cardio Activities
      progress.currentTable = 'cardio_activities';
      this.progressSignal.set({ ...progress });
      const cardio = await this.fetchTableRecords<any>(db.cardioActivities, userId, allowAmbiguousOverride);
      for (const c of cardio) {
        const payload = toSupabaseCardioActivity({ ...c, userId });
        const { error } = await client.from('cardio_activities').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`cardio_activities (${c.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 8. Daily Steps
      progress.currentTable = 'daily_steps';
      this.progressSignal.set({ ...progress });
      const steps = await this.fetchTableRecords<any>(db.dailySteps, userId, allowAmbiguousOverride);
      for (const st of steps) {
        const payload = toSupabaseDailySteps({ ...st, userId });
        const { error } = await client.from('daily_steps').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`daily_steps (${st.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      // 9. Progress Photos metadata
      progress.currentTable = 'progress_photos';
      this.progressSignal.set({ ...progress });
      const photos = await this.fetchTableRecords<any>(db.progressPhotos, userId, allowAmbiguousOverride);
      for (const ph of photos) {
        const record = ph as any;
        const payload = {
          id: record.id,
          user_id: userId,
          storage_path: `photos/${userId}/${record.id}.jpg`,
          taken_at: record.takenAt instanceof Date ? record.takenAt.toISOString() : record.takenAt,
          notes: record.notes ?? null,
          created_at: new Date().toISOString()
        };
        const { error } = await client.from('progress_photos').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`progress_photos (${record.id}): ${error.message}`);
        } else {
          importedRecords++;
        }
      }
      progress.processedTables++;

      progress.importedRecords = importedRecords;
      this.statusSignal.set('completed');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Import execution error: ${msg}`);
      this.statusSignal.set('error');
    }

    this.progressSignal.set({ ...progress });
    return progress;
  }
}
