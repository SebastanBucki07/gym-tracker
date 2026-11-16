import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  supabaseAuth = inject(SupabaseAuthService);
  private router = inject(Router);

  errorMessage = signal<string | null>(null);
  loading = signal(false);
  authMode = signal<'local' | 'supabase'>('local');

  registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  setMode(mode: 'local' | 'supabase') {
    this.authMode.set(mode);
    this.errorMessage.set(null);
  }

  async onSubmit() {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, email, password } = this.registerForm.value;

    try {
      if (this.authMode() === 'supabase') {
        await this.supabaseAuth.signUp(email, password, username);
        await this.router.navigate(['/dashboard']);
      } else {
        await this.authService.register(username, email);
        await this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Wystąpił błąd podczas rejestracji.');
    } finally {
      this.loading.set(false);
    }
  }
}
