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

  async previewLocalData(): Promise<ImportPreviewResult> {
    const userId = this.getActiveSupabaseUserId();
    this.statusSignal.set('previewing');

    const tableCounts: Record<string, number> = {};
    let legacyRecordsCount = 0;

    // Check legacy user_jan_1 records
    const legacyWorkouts = await db.workouts.where('userId').equals('user_jan_1').count();
    const legacyMeasurements = await db.bodyMeasurements.where('userId').equals('user_jan_1').count();
    legacyRecordsCount = legacyWorkouts + legacyMeasurements;

    // Count user's local records in Dexie
    tableCounts['app_settings'] = await db.appSettings.where('userId').equals(userId).count();
    tableCounts['exercises'] = await db.exercises.filter(e => e.userId === userId || e.source === 'user').count();
    tableCounts['measurement_types'] = await db.measurementTypes.filter(t => t.userId === userId || !t.isSystem).count();
    
    const workouts = await db.workouts.where('userId').equals(userId).toArray();
    tableCounts['workouts'] = workouts.length;

    let totalSets = 0;
    for (const w of workouts) {
      const sets = await db.workoutSets.where('workoutId').equals(w.id).count();
      totalSets += sets;
    }
    tableCounts['workout_sets'] = totalSets;

    tableCounts['workout_plans'] = await db.workoutPlans.where('userId').equals(userId).count();
    tableCounts['body_measurements'] = await db.bodyMeasurements.where('userId').equals(userId).count();
    tableCounts['cardio_activities'] = await db.cardioActivities.where('userId').equals(userId).count();
    tableCounts['daily_steps'] = await db.dailySteps.where('userId').equals(userId).count();
    tableCounts['progress_photos'] = await db.progressPhotos.where('userId').equals(userId).count();

    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);
    const hasAmbiguousOwnership = legacyRecordsCount > 0 && tableCounts['workouts'] === 0;

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

    const preview = await this.previewLocalData();
    if (preview.hasAmbiguousOwnership && !allowAmbiguousOverride) {
      throw new Error(
        'Wykryto niejednoznacznego właściciela danych (rekordy przypisane do user_jan_1). Wymagana jawna zgoda na import.'
      );
    }

    this.statusSignal.set('importing');
    const errors: string[] = [];
    let importedRecords = 0;
    const tables = [
      'app_settings',
      'exercises',
      'measurement_types',
      'workouts',
      'workout_sets',
      'workout_plans',
      'body_measurements',
      'cardio_activities',
      'daily_steps',
      'progress_photos'
    ];

    const progress: ImportProgress = {
      currentTable: '',
      processedTables: 0,
      totalTables: tables.length,
      importedRecords: 0,
      totalRecords: preview.totalRecords,
      errors
    };

    this.progressSignal.set(progress);

    try {
      // 1. App Settings
      progress.currentTable = 'app_settings';
      this.progressSignal.set({ ...progress });
      const settings = await db.appSettings.where('userId').equals(userId).toArray();
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
      const exercises = await db.exercises.filter(e => e.userId === userId || e.source === 'user').toArray();
      for (const e of exercises) {
        const payload = toSupabaseExercise({ ...e, userId: e.userId === 'user_jan_1' ? userId : (e.userId || userId) });
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
      const mTypes = await db.measurementTypes.filter(t => t.userId === userId || !t.isSystem).toArray();
      for (const t of mTypes) {
        const payload = toSupabaseMeasurementType({ ...t, userId: t.userId === 'user_jan_1' ? userId : (t.userId || userId) });
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
      const workouts = await db.workouts.where('userId').equals(userId).toArray();
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
      progress.processedTables += 2; // Workouts & Workout Sets

      // 5. Workout Plans
      progress.currentTable = 'workout_plans';
      this.progressSignal.set({ ...progress });
      const plans = await db.workoutPlans.where('userId').equals(userId).toArray();
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
      const measurements = await db.bodyMeasurements.where('userId').equals(userId).toArray();
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
      const cardio = await db.cardioActivities.where('userId').equals(userId).toArray();
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
      const steps = await db.dailySteps.where('userId').equals(userId).toArray();
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
      const photos = await db.progressPhotos.where('userId').equals(userId).toArray();
      for (const ph of photos) {
        const payload = {
          id: ph.id,
          user_id: userId,
          storage_path: `photos/${userId}/${ph.id}.jpg`,
          taken_at: ph.takenAt instanceof Date ? ph.takenAt.toISOString() : ph.takenAt,
          notes: ph.notes ?? null,
          created_at: new Date().toISOString()
        };
        const { error } = await client.from('progress_photos').upsert(payload, { onConflict: 'id' });
        if (error) {
          errors.push(`progress_photos (${ph.id}): ${error.message}`);
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
