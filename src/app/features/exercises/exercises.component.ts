import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LocalExerciseRepository } from '../../data-access/local/local-exercise.repository';
import { Exercise } from '../../data-access/contracts/exercise.model';
import { MuscleGroup } from '../../data-access/contracts/muscle-group.model';
import { EquipmentCategory } from '../../data-access/contracts/equipment-category.model';
import { db } from '../../data-access/local/app-database';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './exercises.component.html',
  styleUrl: './exercises.component.scss'
})
export class ExercisesComponent implements OnInit {
  private exerciseRepo = new LocalExerciseRepository();
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  exercises = signal<Exercise[]>([]);
  muscleGroups = signal<MuscleGroup[]>([]);
  equipmentCategories = signal<EquipmentCategory[]>([]);

  searchQuery = signal('');
  selectedMuscleGroup = signal('');
  selectedEquipment = signal('');

  selectedExercise = signal<Exercise | null>(null);
  isCreatingCustom = signal(false);

  currentUserId = computed(() => this.authService.currentUser()?.id || '');

  customForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    primaryMuscleGroupId: ['chest', Validators.required],
    equipmentCategoryId: ['barbell', Validators.required]
  });

  filteredExercises = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const mg = this.selectedMuscleGroup();
    const eq = this.selectedEquipment();

    return this.exercises().filter(ex => {
      if (!ex.isActive) return false;
      const matchesSearch = ex.name.toLowerCase().includes(q) || (ex.description && ex.description.toLowerCase().includes(q));
      const matchesMg = !mg || ex.primaryMuscleGroupId === mg;
      const matchesEq = !eq || ex.equipmentCategoryId === eq;
      return matchesSearch && matchesMg && matchesEq;
    });
  });

  async ngOnInit() {
    await this.loadCatalog();
  }

  async loadCatalog() {
    const userId = this.currentUserId();
    const [exs, mgs, eqs] = await Promise.all([
      this.exerciseRepo.getAll(userId),
      db.muscleGroups.toArray(),
      db.equipmentCategories.toArray()
    ]);
    this.exercises.set(exs);
    this.muscleGroups.set(mgs);
    this.equipmentCategories.set(eqs);
  }

  onSearchChange(event: any) {
    this.searchQuery.set(event.target.value);
  }

  onMuscleGroupChange(event: any) {
    this.selectedMuscleGroup.set(event.target.value);
  }

  onEquipmentChange(event: any) {
    this.selectedEquipment.set(event.target.value);
  }

  getMuscleGroupName(id: string): string {
    const mg = this.muscleGroups().find(m => m.id === id);
    return mg ? mg.name : id;
  }

  getEquipmentName(id: string): string {
    const eq = this.equipmentCategories().find(e => e.id === id);
    return eq ? eq.name : id;
  }

  selectExercise(ex: Exercise) {
    this.selectedExercise.set(ex);
  }

  closeModal() {
    this.selectedExercise.set(null);
  }

  openCreateModal() {
    this.customForm.reset({
      primaryMuscleGroupId: 'chest',
      equipmentCategoryId: 'barbell'
    });
    this.isCreatingCustom.set(true);
  }

  closeCreateModal() {
    this.isCreatingCustom.set(false);
  }

  async saveCustomExercise() {
    if (this.customForm.invalid) return;
    const userId = this.currentUserId();
    const val = this.customForm.value;

    const newExercise: Exercise = {
      id: 'ex_user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: val.name,
      description: val.description,
      primaryMuscleGroupId: val.primaryMuscleGroupId,
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: val.equipmentCategoryId,
      source: 'user',
      userId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.exerciseRepo.create(newExercise);
    this.closeCreateModal();
    await this.loadCatalog();
  }

  async deactivateExercise(ex: Exercise) {
    await this.exerciseRepo.update(ex.id, { isActive: false });
    this.closeModal();
    await this.loadCatalog();
  }
}
