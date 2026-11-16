import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { LocalDailyStepsRepository } from '../../data-access/local/local-daily-steps.repository';
import { DailySteps } from '../../data-access/contracts/daily-steps.model';

@Component({
  selector: 'app-steps',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './steps.component.html',
  styleUrl: './steps.component.scss'
})
export class StepsComponent implements OnInit {
  private authService = inject(AuthService);
  private stepsRepo = new LocalDailyStepsRepository();
  private fb = inject(FormBuilder);

  stepsHistory = signal<DailySteps[]>([]);
  loading = signal<boolean>(true);

  stepsForm: FormGroup = this.fb.group({
    date: [new Date().toISOString().substring(0, 10), Validators.required],
    stepsCount: [10000, [Validators.required, Validators.min(0), Validators.max(200000)]]
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const user = this.authService.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      // Get last 30 days range or all
      const now = new Date();
      const past = new Date(now.getTime() - 90 * 86400000);
      const startStr = past.toISOString().substring(0, 10);
      const endStr = now.toISOString().substring(0, 10);

      const records = await this.stepsRepo.getByRange(user.id, startStr, endStr);
      // Sort desc by date
      records.sort((a, b) => b.date.localeCompare(a.date));
      this.stepsHistory.set(records);
    } catch (err) {
      console.error('Error loading daily steps:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async saveSteps() {
    if (this.stepsForm.invalid) return;
    const user = this.authService.currentUser();
    if (!user) return;

    const val = this.stepsForm.value;
    const dateStr = val.date;
    const stepsCount = Number(val.stepsCount);

    const stepsRecord: DailySteps = {
      id: 'steps_' + user.id + '_' + dateStr,
      userId: user.id,
      date: dateStr,
      stepsCount: stepsCount,
      updatedAt: new Date()
    };

    try {
      await this.stepsRepo.upsert(stepsRecord);
      await this.loadData();
      alert('Zapisano kroki pomyślnie!');
    } catch (err) {
      console.error('Error saving steps:', err);
    }
  }

  getTotalSteps(): number {
    return this.stepsHistory().reduce((acc, curr) => acc + curr.stepsCount, 0);
  }

  getAverageSteps(): number {
    const history = this.stepsHistory();
    if (history.length === 0) return 0;
    return Math.round(this.getTotalSteps() / history.length);
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
  }
}
