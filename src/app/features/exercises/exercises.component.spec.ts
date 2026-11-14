import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ExercisesComponent } from './exercises.component';
import { AuthService } from '../../core/auth/auth.service';
import { db } from '../../data-access/local/app-database';
import { signal } from '@angular/core';
import { Exercise } from '../../data-access/contracts/exercise.model';

describe('ExercisesComponent', () => {
  beforeEach(async () => {
    await db.exercises.clear();
    await db.muscleGroups.clear();
    await db.equipmentCategories.clear();

    await db.muscleGroups.add({ id: 'chest', name: 'Klatka piersiowa', description: 'Opis' });
    await db.equipmentCategories.add({ id: 'barbell', name: 'Sztanga' });

    await TestBed.configureTestingModule({
      imports: [ExercisesComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 'user_1', email: 'test@example.com', username: 'TestUser', createdAt: new Date() })
          }
        }
      ]
    }).compileComponents();
  });

  it('should create component and load catalog', async () => {
    const fixture = TestBed.createComponent(ExercisesComponent);
    const comp = fixture.componentInstance;
    await comp.ngOnInit();
    fixture.detectChanges();

    expect(comp).toBeTruthy();
    expect(comp.muscleGroups().length).toBe(1);
    expect(comp.equipmentCategories().length).toBe(1);
  });

  it('should filter exercises by search query and filters', async () => {
    await db.exercises.bulkAdd([
      {
        id: 'ex_1',
        name: 'Wyciskanie sztangi',
        description: 'Klasyczne ćwiczenie',
        primaryMuscleGroupId: 'chest',
        secondaryMuscleGroupIds: [],
        equipmentCategoryId: 'barbell',
        source: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'ex_2',
        name: 'Inne ćwiczenie',
        description: 'Inne',
        primaryMuscleGroupId: 'back',
        secondaryMuscleGroupIds: [],
        equipmentCategoryId: 'barbell',
        source: 'system',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const fixture = TestBed.createComponent(ExercisesComponent);
    const comp = fixture.componentInstance;
    await comp.ngOnInit();

    comp.searchQuery.set('wyciskanie');
    expect(comp.filteredExercises().length).toBe(1);
    expect(comp.filteredExercises()[0].name).toBe('Wyciskanie sztangi');

    comp.searchQuery.set('');
    comp.selectedMuscleGroup.set('chest');
    expect(comp.filteredExercises().length).toBe(1);
    expect(comp.filteredExercises()[0].id).toBe('ex_1');
  });

  it('should create custom exercise via form and modal actions', async () => {
    const fixture = TestBed.createComponent(ExercisesComponent);
    const comp = fixture.componentInstance;
    await comp.ngOnInit();

    comp.openCreateModal();
    expect(comp.isCreatingCustom()).toBe(true);

    comp.customForm.setValue({
      name: 'Moje ćwiczenie',
      description: 'Opis własnego',
      primaryMuscleGroupId: 'chest',
      equipmentCategoryId: 'barbell'
    });

    await comp.saveCustomExercise();
    expect(comp.isCreatingCustom()).toBe(false);

    const userExercises = comp.exercises().filter(e => e.source === 'user');
    expect(userExercises.length).toBe(1);
    expect(userExercises[0].name).toBe('Moje ćwiczenie');
    expect(userExercises[0].userId).toBe('user_1');
  });

  it('should select exercise, show details, and deactivate user exercise', async () => {
    const testEx: Exercise = {
      id: 'ex_custom_test',
      name: 'Do dezaktywacji',
      description: 'Test',
      primaryMuscleGroupId: 'chest',
      secondaryMuscleGroupIds: [],
      equipmentCategoryId: 'barbell',
      source: 'user',
      userId: 'user_1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.exercises.add(testEx);

    const fixture = TestBed.createComponent(ExercisesComponent);
    const comp = fixture.componentInstance;
    await comp.ngOnInit();

    comp.selectExercise(testEx);
    expect(comp.selectedExercise()).toEqual(testEx);

    await comp.deactivateExercise(testEx);
    expect(comp.selectedExercise()).toBeNull();

    const updated = await db.exercises.get('ex_custom_test');
    expect(updated?.isActive).toBe(false);
  });
});
