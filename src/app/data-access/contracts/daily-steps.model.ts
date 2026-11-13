export interface DailySteps {
  id: string;
  userId: string;
  date: string; // 'YYYY-MM-DD'
  stepsCount: number;
  updatedAt: Date;
}
