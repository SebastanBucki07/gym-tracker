import { Injectable } from '@angular/core';
import { LocalWorkoutRepository } from '../../data-access/local/local-workout.repository';
import { LocalCardioRepository } from '../../data-access/local/local-cardio.repository';
import { LocalDailyStepsRepository } from '../../data-access/local/local-daily-steps.repository';
import { LocalMeasurementRepository } from '../../data-access/local/local-measurement.repository';
import { db } from '../../data-access/local/app-database';
import { MuscleGroupId } from '../../data-access/contracts/muscle-group.model';
import { CANONICAL_BODY_WEIGHT_TYPE_ID } from '../../data-access/contracts/measurement.model';

export type DateRangePreset = 'current-week' | 'previous-week' | 'current-month' | 'all';

export interface MuscleActivityStats {
  muscleGroupId: MuscleGroupId;
  muscleName: string;
  lastTrainedDate?: Date;
  daysAgo?: number;
  workoutCount: number;
  workingSetsCount: number; // weighted or count
  recentExercises: string[];
  intensity: 'none' | 'low' | 'medium' | 'high';
}

export interface DashboardSummary {
  startDate: Date;
  endDate: Date;
  strength: {
    workoutsCount: number;
    totalDurationSeconds: number;
    totalVolume: number;
    totalSets: number;
    totalReps: number;
  };
  cardio: {
    sessionsCount: number;
    totalDurationMinutes: number;
    totalDistanceKm: number;
    totalCalories: number;
    typeBreakdown: { typeName: string; count: number; duration: number }[];
  };
  steps: {
    totalSteps: number;
    averageDailySteps: number;
    daysCount: number;
    daysMeetingGoal: number;
    goal: number;
  };
  measurements: {
    latestWeight?: number;
    weightChange?: number;
    recentMeasurements: { date: Date; value: number; unit: string; typeName: string }[];
  };
  muscleActivities: MuscleActivityStats[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardQueryService {
  private workoutRepo = new LocalWorkoutRepository();
  private cardioRepo = new LocalCardioRepository();
  private stepsRepo = new LocalDailyStepsRepository();
  private measurementRepo = new LocalMeasurementRepository();

  getDateRange(preset: DateRangePreset): { startDate: Date; endDate: Date } {
    const now = new Date();
    // Monday start of week
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getTime() + 6 * 86400000 + 83999999); // end of sunday

    if (preset === 'current-week') {
      return { startDate: monday, endDate: new Date(monday.getTime() + 7 * 86400000 - 1) };
    } else if (preset === 'previous-week') {
      const prevMonday = new Date(monday.getTime() - 7 * 86400000);
      const prevSunday = new Date(monday.getTime() - 1);
      return { startDate: prevMonday, endDate: prevSunday };
    } else if (preset === 'current-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: firstDay, endDate: lastDay };
    } else {
      const farPast = new Date(2020, 0, 1);
      return { startDate: farPast, endDate: new Date() };
    }
  }

  toLocalDateString(date: Date | string): string {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async getDashboardSummary(userId: string, preset: DateRangePreset = 'current-week'): Promise<DashboardSummary> {
    const { startDate, endDate } = this.getDateRange(preset);
    const startStr = this.toLocalDateString(startDate);
    const endStr = this.toLocalDateString(endDate);

    // 1. Workouts & Sets
    const workouts = await this.workoutRepo.getByUserId(userId);
    const completedWorkouts = workouts.filter(w => {
      if (!w.isCompleted) return false;
      const d = new Date(w.startedAt);
      return d >= startDate && d <= endDate;
    });

    let workoutsCount = completedWorkouts.length;
    let totalDurationSeconds = 0;
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    // Muscle activity tracking across all history for recency, but filtered/weighted for period stats
    const muscleMap = new Map<MuscleGroupId, {
      lastTrainedDate?: Date;
      workoutCount: number;
      workingSetsCount: number;
      exercisesSet: Set<string>;
      workoutIdsSet: Set<string>;
    }>();

    const muscleGroupsMeta: { id: MuscleGroupId; name: string }[] = [
      { id: 'chest', name: 'Klatka piersiowa' },
      { id: 'back', name: 'Plecy' },
      { id: 'shoulders', name: 'Barki' },
      { id: 'biceps', name: 'Biceps' },
      { id: 'triceps', name: 'Triceps' },
      { id: 'forearms', name: 'Przedramiona' },
      { id: 'abs', name: 'Brzuch' },
      { id: 'glutes', name: 'Pośladki' },
      { id: 'quadriceps', name: 'Czworogłowe uda' },
      { id: 'hamstrings', name: 'Dwugłowe uda' },
      { id: 'calves', name: 'Łydki' },
      { id: 'traps', name: 'Czworoboczne' }
    ];

    muscleGroupsMeta.forEach(m => {
      muscleMap.set(m.id, {
        workoutCount: 0,
        workingSetsCount: 0,
        exercisesSet: new Set<string>(),
        workoutIdsSet: new Set<string>()
      });
    });

    // To check secondary muscles, fetch all exercises
    const allExercises = await db.exercises.toArray();
    const exerciseMap = new Map(allExercises.map(e => [e.id, e]));

    // Fetch all completed workouts for accurate last-trained calculation across all time
    const allCompletedWorkouts = workouts.filter(w => w.isCompleted);
    for (const w of allCompletedWorkouts) {
      const sets = await this.workoutRepo.getSetsForWorkout(w.id);
      const wDate = new Date(w.completedAt || w.startedAt);
      const isWithinPeriod = wDate >= startDate && wDate <= endDate;

      if (isWithinPeriod) {
        totalDurationSeconds += w.durationSeconds || 0;
      }

      // Track muscles per workout
      const workoutMuscles = new Set<MuscleGroupId>();

      for (const set of sets) {
        if (!set.isCompleted || set.isWarmup) continue;

        if (isWithinPeriod) {
          totalSets++;
          totalReps += set.repetitions || 0;
          totalVolume += (set.weight || 0) * (set.repetitions || 0);
        }

        const ex = exerciseMap.get(set.exerciseId);
        const primary = (set.primaryMuscleGroupId || (ex ? ex.primaryMuscleGroupId : undefined)) as MuscleGroupId | undefined;
        const secondaries = (ex ? (ex.secondaryMuscleGroupIds || []) : []) as MuscleGroupId[];

        const setMuscleSet = new Set<MuscleGroupId>();
        if (primary) setMuscleSet.add(primary);
        secondaries.forEach(sec => setMuscleSet.add(sec));

        const exerciseName = set.exerciseName || (ex ? ex.name : 'Ćwiczenie');

        setMuscleSet.forEach(mId => {
          const entry = muscleMap.get(mId);
          if (entry) {
            // Last trained (all time)
            if (!entry.lastTrainedDate || wDate > entry.lastTrainedDate) {
              entry.lastTrainedDate = wDate;
            }

            if (isWithinPeriod) {
              entry.workingSetsCount += (mId === primary ? 1 : 0.5); // Weighting system: primary 1.0, secondary 0.5
              entry.exercisesSet.add(exerciseName);
              workoutMuscles.add(mId);
              entry.workoutIdsSet.add(w.id);
            }
          }
        });
      }

      if (isWithinPeriod) {
        workoutMuscles.forEach(mId => {
          const entry = muscleMap.get(mId);
          if (entry) {
            entry.workoutCount++;
          }
        });
      }
    }

    // 2. Cardio Activities
    const cardioActivities = await this.cardioRepo.getActivities(userId);
    const periodCardio = cardioActivities.filter(c => {
      const d = new Date(c.performedAt);
      return d >= startDate && d <= endDate;
    });

    const cardioTypes = await this.cardioRepo.getTypes();
    const cardioTypeMap = new Map(cardioTypes.map(t => [t.id, t.name]));

    let totalCardioDurationMinutes = 0;
    let totalCardioDistanceKm = 0;
    let totalCardioCalories = 0;
    const cardioTypeStatsMap = new Map<string, { count: number; duration: number }>();

    periodCardio.forEach(c => {
      totalCardioDurationMinutes += c.durationMinutes;
      totalCardioDistanceKm += c.distanceKm || 0;
      totalCardioCalories += c.calories || 0;

      const typeName = cardioTypeMap.get(c.cardioTypeId) || 'Cardio';
      const existing = cardioTypeStatsMap.get(typeName) || { count: 0, duration: 0 };
      existing.count++;
      existing.duration += c.durationMinutes;
      cardioTypeStatsMap.set(typeName, existing);
    });

    const cardioTypeBreakdown = Array.from(cardioTypeStatsMap.entries()).map(([typeName, stats]) => ({
      typeName,
      count: stats.count,
      duration: stats.duration
    }));

    // 3. Daily Steps
    const stepsRecords = await this.stepsRepo.getByRange(userId, startStr, endStr);
    let totalSteps = 0;
    const goal = 10000;
    let daysMeetingGoal = 0;

    stepsRecords.forEach(s => {
      totalSteps += s.stepsCount;
      if (s.stepsCount >= goal) {
        daysMeetingGoal++;
      }
    });

    const daysCount = stepsRecords.length;
    const averageDailySteps = daysCount > 0 ? Math.round(totalSteps / daysCount) : 0;

    // 4. Measurements
    const measurements = await this.measurementRepo.getMeasurements(userId);
    const measurementTypes = await this.measurementRepo.getTypes(userId);
    const measTypeMap = new Map(measurementTypes.map(t => [t.id, t]));

    const weightType = measurementTypes.find(t => t.id === CANONICAL_BODY_WEIGHT_TYPE_ID)
      || measurementTypes.find(t => t.name.toLowerCase().includes('waga') || t.unit === 'kg');

    const weightTypeIds = new Set<string>();
    weightTypeIds.add(CANONICAL_BODY_WEIGHT_TYPE_ID);
    if (weightType) weightTypeIds.add(weightType.id);
    measurementTypes.forEach(t => {
      if (t.id.startsWith('type_weight_') || t.name.trim().toLowerCase() === 'waga ciała' || (t.isSystem && t.unit === 'kg')) {
        weightTypeIds.add(t.id);
      }
    });

    const weightMeasurements = measurements
      .filter(m => weightTypeIds.has(m.measurementTypeId) || m.measurementTypeId.startsWith('type_weight_'))
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

    const latestWeight = weightMeasurements.length > 0 ? weightMeasurements[0].value : undefined;
    let weightChange = undefined;
    if (weightMeasurements.length >= 2) {
      weightChange = Math.round((weightMeasurements[0].value - weightMeasurements[1].value) * 10) / 10;
    }

    const recentMeasurements = measurements
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .slice(0, 10)
      .map(m => {
        const t = measTypeMap.get(m.measurementTypeId);
        return {
          date: new Date(m.measuredAt),
          value: m.value,
          unit: t ? t.unit : '',
          typeName: t ? t.name : 'Pomiar'
        };
      });

    // 5. Muscle Activities Summary
    const nowTime = new Date().getTime();
    const muscleActivities: MuscleActivityStats[] = muscleGroupsMeta.map(mg => {
      const entry = muscleMap.get(mg.id)!;
      let daysAgo: number | undefined = undefined;
      if (entry.lastTrainedDate) {
        daysAgo = Math.floor((nowTime - new Date(entry.lastTrainedDate).getTime()) / 86400000);
      }

      let intensity: 'none' | 'low' | 'medium' | 'high' = 'none';
      if (daysAgo !== undefined) {
        if (daysAgo <= 3) intensity = 'high';
        else if (daysAgo <= 7) intensity = 'medium';
        else intensity = 'low';
      }

      return {
        muscleGroupId: mg.id,
        muscleName: mg.name,
        lastTrainedDate: entry.lastTrainedDate,
        daysAgo,
        workoutCount: entry.workoutCount,
        workingSetsCount: entry.workingSetsCount,
        recentExercises: Array.from(entry.exercisesSet),
        intensity
      };
    });

    return {
      startDate,
      endDate,
      strength: {
        workoutsCount,
        totalDurationSeconds,
        totalVolume,
        totalSets,
        totalReps
      },
      cardio: {
        sessionsCount: periodCardio.length,
        totalDurationMinutes: totalCardioDurationMinutes,
        totalDistanceKm: Number(totalCardioDistanceKm.toFixed(2)),
        totalCalories: totalCardioCalories,
        typeBreakdown: cardioTypeBreakdown
      },
      steps: {
        totalSteps,
        averageDailySteps,
        daysCount,
        daysMeetingGoal,
        goal
      },
      measurements: {
        latestWeight,
        weightChange,
        recentMeasurements
      },
      muscleActivities
    };
  }
}
