import { Injectable, signal, computed } from '@angular/core';
import { User } from '../../data-access/contracts/user.model';
import { LocalUserRepository } from '../../data-access/local/local-user.repository';
import { LocalSettingsRepository } from '../../data-access/local/local-settings.repository';
import { DatabaseSeedService } from '../database/database-seed.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userRepository = new LocalUserRepository();
  private settingsRepository = new LocalSettingsRepository();
  private seedService = new DatabaseSeedService();

  private currentUserSignal = signal<User | null>(null);

  currentUser = this.currentUserSignal.asReadonly();
  isAuthenticated = computed(() => !!this.currentUserSignal());

  constructor() {
    this.initAuth();
  }

  private async initAuth() {
    await this.seedService.seedDatabase();
    await this.seedInitialUsersIfNeeded();
    this.restoreSession();
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

  private restoreSession() {
    const savedUserId = localStorage.getItem('gym_tracker_current_user_id');
    if (savedUserId) {
      this.userRepository.getById(savedUserId).then(user => {
        if (user) {
          this.currentUserSignal.set(user);
        }
      });
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

  private loginUser(user: User): void {
    this.currentUserSignal.set(user);
    localStorage.setItem('gym_tracker_current_user_id', user.id);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.getAll('');
  }
}
