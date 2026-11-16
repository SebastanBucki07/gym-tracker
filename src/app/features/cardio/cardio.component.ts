import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { LocalCardioRepository } from '../../data-access/local/local-cardio.repository';
import { CardioActivity, CardioType } from '../../data-access/contracts/cardio.model';

@Component({
  selector: 'app-cardio',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './cardio.component.html',
  styleUrl: './cardio.component.scss'
})
export class CardioComponent implements OnInit {
  private authService = inject(AuthService);
  private cardioRepo = new LocalCardioRepository();
  private fb = inject(FormBuilder);

  cardioActivities = signal<CardioActivity[]>([]);
  cardioTypes = signal<CardioType[]>([]);
  loading = signal<boolean>(true);
  isCreating = signal<boolean>(false);
  editingId = signal<string | null>(null);

  cardioForm: FormGroup = this.fb.group({
    cardioTypeId: ['', Validators.required],
    durationMinutes: [30, [Validators.required, Validators.min(1)]],
    distanceKm: [null, [Validators.min(0)]],
    calories: [null, [Validators.min(0)]],
    averageHeartRate: [null, [Validators.min(30), Validators.max(220)]],
    performedAt: [new Date().toISOString().substring(0, 10), Validators.required],
    note: ['']
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    const user = this.authService.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      const [types, activities] = await Promise.all([
        this.cardioRepo.getTypes(),
        this.cardioRepo.getActivities(user.id)
      ]);
      this.cardioTypes.set(types);
      // Sort activities by performedAt desc
      const sorted = activities.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
      this.cardioActivities.set(sorted);
    } catch (err) {
      console.error('Error loading cardio data:', err);
    } finally {
      this.loading.set(false);
    }
  }

  getCardioTypeName(typeId: string): string {
    const t = this.cardioTypes().find(x => x.id === typeId);
    return t ? t.name : 'Cardio';
  }

  openCreateModal() {
    this.editingId.set(null);
    this.cardioForm.reset({
      cardioTypeId: this.cardioTypes()[0]?.id || '',
      durationMinutes: 30,
      distanceKm: null,
      calories: null,
      averageHeartRate: null,
      performedAt: new Date().toISOString().substring(0, 10),
      note: ''
    });
    this.isCreating.set(true);
  }

  openEditModal(activity: CardioActivity) {
    this.editingId.set(activity.id);
    const dateStr = new Date(activity.performedAt).toISOString().substring(0, 10);
    this.cardioForm.patchValue({
      cardioTypeId: activity.cardioTypeId,
      durationMinutes: activity.durationMinutes,
      distanceKm: activity.distanceKm ?? null,
      calories: activity.calories ?? null,
      averageHeartRate: activity.averageHeartRate ?? null,
      performedAt: dateStr,
      note: activity.note ?? ''
    });
    this.isCreating.set(true);
  }

  closeModal() {
    this.isCreating.set(false);
    this.editingId.set(null);
  }

  async saveCardio() {
    if (this.cardioForm.invalid) return;
    const user = this.authService.currentUser();
    if (!user) return;

    const val = this.cardioForm.value;
    const activityData: CardioActivity = {
      id: this.editingId() || 'cardio_' + crypto.randomUUID(),
      userId: user.id,
      cardioTypeId: val.cardioTypeId,
      durationMinutes: Number(val.durationMinutes),
      distanceKm: val.distanceKm ? Number(val.distanceKm) : undefined,
      calories: val.calories ? Number(val.calories) : undefined,
      averageHeartRate: val.averageHeartRate ? Number(val.averageHeartRate) : undefined,
      performedAt: new Date(val.performedAt),
      note: val.note || undefined
    };

    try {
      if (this.editingId()) {
        await this.cardioRepo.updateActivity(this.editingId()!, activityData);
      } else {
        await this.cardioRepo.createActivity(activityData);
      }
      this.closeModal();
      await this.loadData();
    } catch (err) {
      console.error('Error saving cardio activity:', err);
    }
  }

  async deleteActivity(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę aktywność cardio?')) return;
    try {
      await this.cardioRepo.deleteActivity(id);
      await this.loadData();
    } catch (err) {
      console.error('Error deleting cardio activity:', err);
    }
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
