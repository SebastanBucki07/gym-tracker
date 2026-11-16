import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../data-access/local/app-database';
import { LocalWorkoutRepository } from '../../data-access/local/local-workout.repository';
import { AuthService } from './auth.service';
import { SupabaseAuthService } from './supabase-auth.service';

describe('Supabase User Data Isolation (Stage 13B.3)', () => {
  let authService: AuthService;
  let supabaseAuth: SupabaseAuthService;
  let workoutRepo: LocalWorkoutRepository;

  beforeEach(async () => {
    supabaseAuth = new SupabaseAuthService();
    authService = new AuthService(supabaseAuth);
    workoutRepo = new LocalWorkoutRepository();

    await db.workouts.clear();
    await db.workoutSets.clear();
    await db.users.clear();
  });

  it('should map different Supabase users to distinct local workspace IDs without falling back to user_jan_1', async () => {
    // Mock Supabase user A
    const userAId = '11111111-1111-1111-1111-111111111111';
    (supabaseAuth as any).userSignal.set({ id: userAId, email: 'usera@example.com' });
    authService.logout(); // ensure local user is null

    const workspaceA = authService.getCurrentUserId();
    expect(workspaceA).toBe(`supa_${userAId}`);

    // Mock Supabase user B
    const userBId = '22222222-2222-2222-2222-222222222222';
    (supabaseAuth as any).userSignal.set({ id: userBId, email: 'userb@example.com' });

    const workspaceB = authService.getCurrentUserId();
    expect(workspaceB).toBe(`supa_${userBId}`);
    expect(workspaceA).not.toBe(workspaceB);
  });

  it('should strictly isolate records between Supabase user A and User B', async () => {
    const userAId = 'aaaa0000-0000-0000-0000-000000000000';
    const userBId = 'bbbb0000-0000-0000-0000-000000000000';

    // User A workspace
    (supabaseAuth as any).userSignal.set({ id: userAId, email: 'a@example.com' });
    authService.logout();
    const wsA = authService.getCurrentUserId();

    await workoutRepo.create({
      id: 'w_A',
      userId: wsA,
      name: 'Trening User A',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, []);

    // User B workspace
    (supabaseAuth as any).userSignal.set({ id: userBId, email: 'b@example.com' });
    const wsB = authService.getCurrentUserId();

    await workoutRepo.create({
      id: 'w_B',
      userId: wsB,
      name: 'Trening User B',
      startedAt: new Date(),
      isCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, []);

    // Verify isolation
    const recordsA = await workoutRepo.getByUserId(wsA);
    const recordsB = await workoutRepo.getByUserId(wsB);

    expect(recordsA.length).toBe(1);
    expect(recordsA[0].name).toBe('Trening User A');

    expect(recordsB.length).toBe(1);
    expect(recordsB[0].name).toBe('Trening User B');
  });

  it('should throw an error when neither local nor Supabase auth is present instead of falling back to user_jan_1', () => {
    authService.logout();
    (supabaseAuth as any).userSignal.set(null);

    expect(() => authService.getCurrentUserId()).toThrowError();
  });
});
