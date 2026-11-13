import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Gym Tracker</h1>
        <h2>Rejestracja</h2>
        
        @if (errorMessage()) {
          <div class="alert error">{{ errorMessage() }}</div>
        }

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="username">Nazwa użytkownika</label>
            <input id="username" type="text" formControlName="username" placeholder="Wprowadź nazwę" />
          </div>

          <div class="form-group">
            <label for="email">Adres e-mail</label>
            <input id="email" type="email" formControlName="email" placeholder="Wprowadź e-mail" />
          </div>

          <button type="submit" class="btn primary" [disabled]="registerForm.invalid || loading()">
            {{ loading() ? 'Rejestrowanie...' : 'Zarejestruj się' }}
          </button>
        </form>

        <div class="auth-links">
          <p>Masz już konto? <a routerLink="/login">Zaloguj się</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: var(--bg-primary);
      padding: 1rem;
    }
    .auth-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: var(--shadow-md);
    }
    h1 { color: var(--color-primary); margin-bottom: 0.5rem; text-align: center; }
    h2 { margin-bottom: 1.5rem; text-align: center; color: var(--text-primary); }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .btn {
      width: 100%;
      padding: 0.75rem;
      background: var(--color-primary);
      color: var(--color-primary-text);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 1rem;
    }
    .btn:hover { background: var(--color-primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert.error {
      background: rgba(220, 38, 38, 0.1);
      color: var(--color-danger);
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .auth-links { margin-top: 1.5rem; text-align: center; }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage = signal<string | null>(null);
  loading = signal(false);

  registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]]
  });

  async onSubmit() {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const { username, email } = this.registerForm.value;
      await this.authService.register(username, email);
      await this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Wystąpił błąd podczas rejestracji.');
    } finally {
      this.loading.set(false);
    }
  }
}
