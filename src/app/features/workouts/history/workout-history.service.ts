import { Injectable } from '@angular/core';
import { LocalWorkoutRepository } from '../../../data-access/local/local-workout.repository';
import { Workout, WorkoutSet } from '../../../data-access/contracts/workout.model';
import { MuscleGroupId } from '../../../data-access/contracts/muscle-group.model';

export interface WorkoutHistoryItem {
  workout: Workout;
  sets: WorkoutSet[];
  totalVolume: number;
  completedSetsCount: number;
  primaryMuscleGroups: string[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxWeightReps: number;
  maxReps: number;
  maxRepsWeight: number;
  estimated1RM: number;
  achievedAt: Date;
}

export interface MuscleLastTrained {
  muscleGroupId: MuscleGroupId;
  lastTrainedDate?: Date;
  daysAgo?: number;
  workoutName?: string;
}

export interface ProgressiveOverloadInfo {
  exerciseId: string;
  exerciseName: string;
  previousWeight: number;
  previousReps: number;
  previousDate: Date;
  suggestedWeight: number;
  suggestedReps: number;
  suggestionText: string;
}

export interface LastExercisePerformance {
  workoutDate: Date;
  maxWeight: number;
  totalSets: number;
  sets: { weight: number; repetitions: number; isWarmup: boolean; isCompleted: boolean }[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkoutHistoryService {
  private workoutRepo = new LocalWorkoutRepository();

  async getLastExercisePerformance(userId: string, exerciseId: string): Promise<LastExercisePerformance | null> {
    const history = await this.getCompletedWorkouts(userId);

    for (const item of history) {
      const setsForExercise = item.sets.filter(s => s.exerciseId === exerciseId && s.isCompleted);
      
      if (setsForExercise.length > 0) {
        let maxWeight = 0;
        setsForExercise.forEach(s => {
          if (!s.isWarmup && (s.weight || 0) > maxWeight) {
            maxWeight = s.weight || 0;
          }
        });

        return {
          workoutDate: item.workout.completedAt || item.workout.startedAt,
          maxWeight,
          totalSets: setsForExercise.length,
          sets: setsForExercise.map(s => ({
            weight: s.weight || 0,
            repetitions: s.repetitions || 0,
            isWarmup: !!s.isWarmup,
            isCompleted: !!s.isCompleted
          }))
        };
      }
    }
    
    return null;
  }

  async getCompletedWorkouts(userId: string): Promise<WorkoutHistoryItem[]> {
    const workouts = await this.workoutRepo.getByUserId(userId);
    const completed = workouts
      .filter(w => w.isCompleted)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const historyItems: WorkoutHistoryItem[] = [];

    for (const workout of completed) {
      const sets = await this.workoutRepo.getSetsForWorkout(workout.id);
      
      let totalVolume = 0;
      let completedSetsCount = 0;
      const muscleGroupsSet = new Set<string>();

      for (const set of sets) {
        if (set.isCompleted) {
          completedSetsCount++;
          if (!set.isWarmup) {
            totalVolume += (set.weight || 0) * (set.repetitions || 0);
          }
        }
        if (set.primaryMuscleGroupId) {
          muscleGroupsSet.add(set.primaryMuscleGroupId);
        }
      }

      historyItems.push({
        workout,
        sets,
        totalVolume,
        completedSetsCount,
        primaryMuscleGroups: Array.from(muscleGroupsSet)
      });
    }

    return historyItems;
  }

  async getWorkoutDetails(workoutId: string): Promise<WorkoutHistoryItem | null> {
    const workout = await this.workoutRepo.getById(workoutId);
    if (!workout) return null;

    const sets = await this.workoutRepo.getSetsForWorkout(workoutId);

    let totalVolume = 0;
    let completedSetsCount = 0;
    const muscleGroupsSet = new Set<string>();

    for (const set of sets) {
      if (set.isCompleted) {
        completedSetsCount++;
        if (!set.isWarmup) {
          totalVolume += (set.weight || 0) * (set.repetitions || 0);
        }
      }
      if (set.primaryMuscleGroupId) {
        muscleGroupsSet.add(set.primaryMuscleGroupId);
      }
    }

    return {
      workout,
      sets,
      totalVolume,
      completedSetsCount,
      primaryMuscleGroups: Array.from(muscleGroupsSet)
    };
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    await this.workoutRepo.delete(workoutId);
  }

  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    const history = await this.getCompletedWorkouts(userId);
    const prMap = new Map<string, {
      exerciseName: string;
      maxWeight: number;
      maxWeightReps: number;
      maxReps: number;
      maxRepsWeight: number;
      estimated1RM: number;
      achievedAt: Date;
    }>();

    for (const item of history) {
      const workoutDate = item.workout.completedAt || item.workout.startedAt;

      for (const set of item.sets) {
        if (!set.isCompleted || set.isWarmup) continue;

        const exerciseId = set.exerciseId;
        const exerciseName = set.exerciseName || 'Ćwiczenie';
        const weight = set.weight || 0;
        const reps = set.repetitions || 0;

        // Estimated 1RM using Epley formula: weight * (1 + reps / 30)
        const e1rm = reps > 0 ? weight * (1 + reps / 30) : weight;

        const existing = prMap.get(exerciseId);

        if (!existing) {
          prMap.set(exerciseId, {
            exerciseName,
            maxWeight: weight,
            maxWeightReps: reps,
            maxReps: reps,
            maxRepsWeight: weight,
            estimated1RM: e1rm,
            achievedAt: workoutDate
          });
        } else {
          let updatedMaxWeight = existing.maxWeight;
          let updatedMaxWeightReps = existing.maxWeightReps;
          if (weight > existing.maxWeight || (weight === existing.maxWeight && reps > existing.maxWeightReps)) {
            updatedMaxWeight = weight;
            updatedMaxWeightReps = reps;
          }

          let updatedMaxReps = existing.maxReps;
          let updatedMaxRepsWeight = existing.maxRepsWeight;
          if (reps > existing.maxReps || (reps === existing.maxReps && weight > existing.maxRepsWeight)) {
            updatedMaxReps = reps;
            updatedMaxRepsWeight = weight;
          }

          const updated1RM = Math.max(existing.estimated1RM, e1rm);

          prMap.set(exerciseId, {
            exerciseName,
            maxWeight: updatedMaxWeight,
            maxWeightReps: updatedMaxWeightReps,
            maxReps: updatedMaxReps,
            maxRepsWeight: updatedMaxRepsWeight,
            estimated1RM: updated1RM,
            achievedAt: workoutDate
          });
        }
      }
    }

    return Array.from(prMap.entries()).map(([exerciseId, data]) => ({
      exerciseId,
      ...data,
      estimated1RM: Math.round(data.estimated1RM * 10) / 10
    }));
  }

  async getMuscleActivity(userId: string): Promise<MuscleLastTrained[]> {
    const history = await this.getCompletedWorkouts(userId);
    const muscleMap = new Map<MuscleGroupId, { date: Date; workoutName: string }>();

    // Workouts are sorted newest first
    for (const item of history) {
      const workoutDate = item.workout.completedAt || item.workout.startedAt;

      for (const set of item.sets) {
        if (!set.isCompleted || set.isWarmup) continue;
        if (set.primaryMuscleGroupId) {
          const mId = set.primaryMuscleGroupId as MuscleGroupId;
          if (!muscleMap.has(mId)) {
            muscleMap.set(mId, {
              date: workoutDate,
              workoutName: item.workout.name
            });
          }
        }
      }
    }

    const now = new Date();
    const allMuscles: MuscleGroupId[] = [
      'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
      'abs', 'glutes', 'quadriceps', 'hamstrings', 'calves', 'traps'
    ];

    return allMuscles.map(mId => {
      const info = muscleMap.get(mId);
      if (!info) {
        return { muscleGroupId: mId };
      }

      const diffTime = Math.abs(now.getTime() - new Date(info.date).getTime());
      const daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        muscleGroupId: mId,
        lastTrainedDate: info.date,
        daysAgo,
        workoutName: info.workoutName
      };
    });
  }

  async getProgressiveOverloadSuggestion(
    userId: string,
    exerciseId: string
  ): Promise<ProgressiveOverloadInfo | null> {
    const history = await this.getCompletedWorkouts(userId);
    let lastSet: { weight: number; reps: number; date: Date; exerciseName: string } | null = null;

    for (const item of history) {
      const workoutDate = item.workout.completedAt || item.workout.startedAt;
      for (const set of item.sets) {
        if (set.exerciseId === exerciseId && set.isCompleted && !set.isWarmup) {
          // Since history is newest first, the first one we encounter is the most recent
          lastSet = {
            weight: set.weight || 0,
            reps: set.repetitions || 0,
            date: workoutDate,
            exerciseName: set.exerciseName || 'Ćwiczenie'
          };
          break;
        }
      }
      if (lastSet) break;
    }

    if (!lastSet) return null;

    // Suggestion logic (informational only, never auto-applied):
    // If reps >= 10-12, suggest increasing weight (e.g. +2.5kg) with base reps (e.g. 8-10).
    // Otherwise, suggest +1 rep or +2.5kg.
    let suggestedWeight = lastSet.weight;
    let suggestedReps = lastSet.reps;
    let suggestionText = '';

    if (lastSet.reps >= 10) {
      suggestedWeight = lastSet.weight + 2.5;
      suggestedReps = Math.max(6, lastSet.reps - 2);
      suggestionText = `Ostatnio: ${lastSet.weight}kg x ${lastSet.reps}. Sugestia: spróbuj zwiększyć ciężar do ${suggestedWeight}kg.`;
    } else {
      suggestedReps = lastSet.reps + 1;
      suggestionText = `Ostatnio: ${lastSet.weight}kg x ${lastSet.reps}. Sugestia: spróbuj wykonać ${suggestedReps} powtórzeń z ciężarem ${lastSet.weight}kg.`;
    }

    return {
      exerciseId,
      exerciseName: lastSet.exerciseName,
      previousWeight: lastSet.weight,
      previousReps: lastSet.reps,
      previousDate: lastSet.date,
      suggestedWeight,
      suggestedReps,
      suggestionText
    };
  }
}
