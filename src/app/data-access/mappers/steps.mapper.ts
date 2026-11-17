import { DailySteps } from '../contracts/daily-steps.model';

export function toSupabaseDailySteps(steps: DailySteps): any {
  return {
    id: steps.id,
    user_id: steps.userId,
    date: steps.date,
    steps_count: steps.stepsCount,
    updated_at: steps.updatedAt instanceof Date ? steps.updatedAt.toISOString() : steps.updatedAt
  };
}

export function fromSupabaseDailySteps(row: any): DailySteps {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    stepsCount: row.steps_count,
    updatedAt: new Date(row.updated_at)
  };
}
