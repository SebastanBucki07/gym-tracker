import { Component, Input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleActivityStats } from './dashboard.service';
import { MuscleGroupId } from '../../data-access/contracts/muscle-group.model';

@Component({
  selector: 'app-muscle-visualization',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './muscle-visualization.component.html',
  styleUrl: './muscle-visualization.component.scss'
})
export class MuscleVisualizationComponent {
  @Input({ required: true }) muscleActivities: MuscleActivityStats[] = [];
  selectedMuscle = output<MuscleActivityStats | null>();

  currentView = signal<'front' | 'back'>('front');
  activeMuscleId = signal<MuscleGroupId | null>(null);

  setView(view: 'front' | 'back') {
    this.currentView.set(view);
  }

  selectMuscle(muscleId: MuscleGroupId) {
    this.activeMuscleId.set(muscleId);
    const stats = this.muscleActivities.find(m => m.muscleGroupId === muscleId) || null;
    this.selectedMuscle.emit(stats);
  }

  getIntensityClass(muscleId: MuscleGroupId): string {
    const stats = this.muscleActivities.find(m => m.muscleGroupId === muscleId);
    return stats ? stats.intensity : 'none';
  }

  getMuscleStats(muscleId: MuscleGroupId): MuscleActivityStats | undefined {
    return this.muscleActivities.find(m => m.muscleGroupId === muscleId);
  }
}
