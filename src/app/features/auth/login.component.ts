import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  supabaseAuth = inject(SupabaseAuthService);
  private router = inject(Router);

  errorMessage = signal<string | null>(null);
  loading = signal(false);
  users = signal<any[]>([]);
  authMode = signal<'local' | 'supabase'>('local');

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    this.loadUsers();
  }

  async loadUsers() {
    try {
      const all = await this.authService.getAllUsers();
      this.users.set(all);
    } catch (e) {
      // ignore
    }
  }

  setMode(mode: 'local' | 'supabase') {
    this.authMode.set(mode);
    this.errorMessage.set(null);
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.value;

    try {
      if (this.authMode() === 'supabase') {
        await this.supabaseAuth.signIn(email, password);
        // Supabase Auth succeeds, but local-first architecture keeps Dexie local records intact.
        await this.router.navigate(['/dashboard']);
      } else {
        await this.authService.login(email);
        await this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Wystąpił błąd logowania.');
    } finally {
      this.loading.set(false);
    }
  }

  async quickLogin(email: string) {
    try {
      await this.authService.login(email);
      await this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMessage.set(err.message);
    }
  }
}
