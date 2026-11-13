import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="user-info">
          @if (authService.currentUser(); as user) {
            <div class="avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
            <div>
              <h2>Witaj, {{ user.username }}!</h2>
              <p class="email">{{ user.email }}</p>
            </div>
          }
        </div>
        <button class="btn logout" (click)="logout()">Wyloguj się</button>
      </header>

      <main class="dashboard-content">
        <div class="welcome-card">
          <h3>Panel główny Gym Tracker</h3>
          <p>Lokalna sesja użytkownika jest aktywna. Dane są bezpiecznie izolowane w IndexedDB.</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--color-primary-text);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.25rem;
    }
    .email {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .btn.logout {
      background: transparent;
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn.logout:hover {
      background: rgba(239, 68, 68, 0.1);
    }
    .welcome-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2rem;
    }
    h3 { margin-bottom: 0.5rem; color: var(--text-primary); }
    p { color: var(--text-secondary); }
  `]
})
export class DashboardComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
