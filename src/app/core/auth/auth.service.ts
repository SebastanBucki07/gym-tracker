import { Injectable, signal, computed } from '@angular/core';
import { User } from '../../data-access/contracts/user.model';
import { LocalUserRepository } from '../../data-access/local/local-user.repository';
import { LocalSettingsRepository } from '../../data-access/local/local-settings.repository';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userRepository = new LocalUserRepository();
  private settingsRepository = new LocalSettingsRepository();

  private currentUserSignal = signal<User | null>(null);

  currentUser = this.currentUserSignal.asReadonly();
  isAuthenticated = computed(() => !!this.currentUserSignal());

  constructor() {
    this.restoreSession();
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
