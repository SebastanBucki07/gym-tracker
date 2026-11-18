import { Injectable, signal, computed } from '@angular/core';
import { User } from '../../data-access/contracts/user.model';
import { LocalUserRepository } from '../../data-access/local/local-user.repository';
import { LocalSettingsRepository } from '../../data-access/local/local-settings.repository';
import { DatabaseSeedService } from '../database/database-seed.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { SyncService } from '../sync/sync.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userRepository = new LocalUserRepository();
  private settingsRepository = new LocalSettingsRepository();
  private seedService = new DatabaseSeedService();

  private currentUserSignal = signal<User | null>(null);
  private isInitializedSignal = signal<boolean>(false);

  currentUser = this.currentUserSignal.asReadonly();
  isAuthenticated = computed(() => !!this.currentUserSignal() || (this.supabaseAuth?.isAuthenticated() ?? false));
  isInitialized = this.isInitializedSignal.asReadonly();

  constructor(
    private supabaseAuth?: SupabaseAuthService,
    private syncService?: SyncService
  ) {
    this.initAuth();
  }

  private async initAuth() {
    await this.seedService.seedDatabase();
    await this.seedInitialUsersIfNeeded();
    await this.restoreSession();
    this.isInitializedSignal.set(true);
  }

  async waitForSession(): Promise<boolean> {
    if (this.isInitializedSignal()) {
      return this.isAuthenticated();
    }
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.isInitializedSignal()) {
          clearInterval(interval);
          resolve(this.isAuthenticated());
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        resolve(this.isAuthenticated());
      }, 3000);
    });
  }

  private async seedInitialUsersIfNeeded() {
    try {
      const all = await this.userRepository.getAll('');
      if (all.length === 0) {
        const user1: User = {
          id: 'user_jan_1',
          username: 'Jan Kowalski',
          email: 'jan@example.com',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const user2: User = {
          id: 'user_anna_2',
          username: 'Anna Nowak',
          email: 'anna@example.com',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await this.userRepository.create(user1);
        await this.userRepository.create(user2);

        await this.seedService.seedSampleUserDataForUser(user1.id);
        await this.seedService.seedSampleUserDataForUser(user2.id);

        await this.settingsRepository.upsert({
          id: 'settings_user_jan_1',
          userId: user1.id,
          theme: 'dark',
          weightUnit: 'kg',
          measurementUnit: 'cm',
          distanceUnit: 'km'
        });
        await this.settingsRepository.upsert({
          id: 'settings_user_anna_2',
          userId: user2.id,
          theme: 'dark',
          weightUnit: 'kg',
          measurementUnit: 'cm',
          distanceUnit: 'km'
        });
      }
    } catch (e) {
      console.error('Failed to seed initial users', e);
    }
  }

  private async restoreSession(): Promise<void> {
    const savedUserId = localStorage.getItem('gym_tracker_current_user_id');
    if (savedUserId) {
      const user = await this.userRepository.getById(savedUserId);
      if (user) {
        this.currentUserSignal.set(user);
        await this.seedService.seedSampleUserDataForUser(user.id);
      }
    }
  }

  async register(username: string, email: string, avatarUrl?: string): Promise<User> {
    const existing = await this.userRepository.getByEmail(email);
    if (existing) {
      throw new Error('Użytkownik o takim adresie e-mail już istnieje.');
    }

    const newUser: User = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      username,
      email,
      avatarUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.userRepository.create(newUser);

    await this.settingsRepository.upsert({
      id: 'settings_' + newUser.id,
      userId: newUser.id,
      theme: 'dark',
      weightUnit: 'kg',
      measurementUnit: 'cm',
      distanceUnit: 'km'
    });

    this.loginUser(newUser);
    return newUser;
  }

  async login(email: string): Promise<User> {
    const user = await this.userRepository.getByEmail(email);
    if (!user) {
      throw new Error('Nie znaleziono użytkownika o podanym adresie e-mail.');
    }
    this.loginUser(user);
    return user;
  }

  async switchUser(userId: string): Promise<User> {
    const user = await this.userRepository.getById(userId);
    if (!user) {
      throw new Error('Nie znaleziono użytkownika.');
    }
    this.loginUser(user);
    return user;
  }

  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem('gym_tracker_current_user_id');
  }

  private async loginUser(user: User): Promise<void> {
    this.currentUserSignal.set(user);
    localStorage.setItem('gym_tracker_current_user_id', user.id);
    await this.seedService.seedSampleUserDataForUser(user.id);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.getAll('');
  }

  getCurrentUserId(): string {
    const localUser = this.currentUserSignal();
    if (localUser) {
      return localUser.id;
    }

    const supaUser = this.supabaseAuth?.currentUser?.();
    if (supaUser && supaUser.id) {
      const workspaceId = `supa_${supaUser.id}`;
      this.userRepository.getById(workspaceId).then(existing => {
        if (!existing) {
          const email = supaUser.email || 'supabase@user.local';
          const username = supaUser.user_metadata?.['username'] || email.split('@')[0];
          this.userRepository.create({
            id: workspaceId,
            username,
            email,
            createdAt: new Date(),
            updatedAt: new Date()
          }).catch(() => {});
        }
      });
      return workspaceId;
    }

    throw new Error('Brak aktywnego uwierzytelnionego użytkownika. Zaloguj się, aby kontynuować.');
  }
}
