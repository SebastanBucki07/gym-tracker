import { Injectable } from '@angular/core';
import { LocalWorkoutRepository } from '../../data-access/local/local-workout.repository';
import { LocalCardioRepository } from '../../data-access/local/local-cardio.repository';
import { LocalDailyStepsRepository } from '../../data-access/local/local-daily-steps.repository';
import { LocalMeasurementRepository } from '../../data-access/local/local-measurement.repository';
import { Workout } from '../../data-access/contracts/workout.model';
import { CardioActivity } from '../../data-access/contracts/cardio.model';
import { DailySteps } from '../../data-access/contracts/daily-steps.model';
import { BodyMeasurement } from '../../data-access/contracts/measurement.model';

export interface DayActivitySummary {
  dateString: string; // 'YYYY-MM-DD'
  workouts: Workout[];
  cardio: CardioActivity[];
  steps?: DailySteps;
  measurements: BodyMeasurement[];
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private workoutRepo = new LocalWorkoutRepository();
  private cardioRepo = new LocalCardioRepository();
  private stepsRepo = new LocalDailyStepsRepository();
  private measurementRepo = new LocalMeasurementRepository();

  private toLocalDateString(date: Date | string): string {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async getMonthActivities(userId: string, year: number, month: number): Promise<Map<string, DayActivitySummary>> {
    // month is 0-indexed (0 = January)
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const startStr = this.toLocalDateString(startDate);
    const endStr = this.toLocalDateString(endDate);

    const workouts = await this.workoutRepo.getByUserId(userId);
    const completedWorkouts = workouts.filter(w => {
      if (!w.isCompleted) return false;
      const d = new Date(w.startedAt);
      return d >= startDate && d <= endDate;
    });

    const cardioActivities = await this.cardioRepo.getActivities(userId);
    const monthCardio = cardioActivities.filter(c => {
      const d = new Date(c.performedAt);
      return d >= startDate && d <= endDate;
    });

    const monthSteps = await this.stepsRepo.getByRange(userId, startStr, endStr);

    const measurements = await this.measurementRepo.getMeasurements(userId);
    const monthMeasurements = measurements.filter(m => {
      const d = new Date(m.measuredAt);
      return d >= startDate && d <= endDate;
    });

    const map = new Map<string, DayActivitySummary>();

    const ensureDay = (dateStr: string) => {
      if (!map.has(dateStr)) {
        map.set(dateStr, {
          dateString: dateStr,
          workouts: [],
          cardio: [],
          measurements: []
        });
      }
      return map.get(dateStr)!;
    };

    completedWorkouts.forEach(w => {
      const ds = this.toLocalDateString(w.startedAt);
      ensureDay(ds).workouts.push(w);
    });

    monthCardio.forEach(c => {
      const ds = this.toLocalDateString(c.performedAt);
      ensureDay(ds).cardio.push(c);
    });

    monthSteps.forEach(s => {
      ensureDay(s.date).steps = s;
    });

    monthMeasurements.forEach(m => {
      const ds = this.toLocalDateString(m.measuredAt);
      ensureDay(ds).measurements.push(m);
    });

    return map;
  }
}
