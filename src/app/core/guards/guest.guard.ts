import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SupabaseAuthService } from '../auth/supabase-auth.service';

export const guestGuard: CanActivateFn = async (_route, _state) => {
  const authService = inject(AuthService);
  const supabaseAuth = inject(SupabaseAuthService);
  const router = inject(Router);

  if (!authService.isInitialized()) {
    await authService.waitForSession();
  }

  if (supabaseAuth.isLoading()) {
    await supabaseAuth.waitForSession();
  }

  if (!authService.isAuthenticated() && !supabaseAuth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
