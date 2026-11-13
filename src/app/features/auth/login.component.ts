import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

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
  private router = inject(Router);

  errorMessage = signal<string | null>(null);
  loading = signal(false);
  users = signal<any[]>([]);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
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

  async onSubmit() {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const email = this.loginForm.value.email;
      await this.authService.login(email);
      await this.router.navigate(['/dashboard']);
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
