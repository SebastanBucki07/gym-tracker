import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseAuthService {
  private supabase: SupabaseClient | null = null;

  private userSignal = signal<SupabaseUser | null>(null);
  private sessionSignal = signal<Session | null>(null);
  private loadingSignal = signal<boolean>(true);
  private configErrorSignal = signal<boolean>(false);

  currentUser = this.userSignal.asReadonly();
  currentSession = this.sessionSignal.asReadonly();
  isAuthenticated = computed(() => !!this.userSignal());
  isLoading = this.loadingSignal.asReadonly();
  isConfigError = this.configErrorSignal.asReadonly();

  constructor() {
    this.initSupabase();
  }

  private initSupabase() {
    try {
      const url = environment.supabaseUrl;
      const key = environment.supabaseKey;

      if (!url || !key || url.includes('placeholder-project') || key.includes('placeholder-anon')) {
        this.configErrorSignal.set(true);
        this.loadingSignal.set(false);
        return;
      }

      this.supabase = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      // Restore session
      this.supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!error && session) {
          this.sessionSignal.set(session);
          this.userSignal.set(session.user);
        }
        this.loadingSignal.set(false);
      });

      // Listen to auth changes
      this.supabase.auth.onAuthStateChange((_event, session) => {
        this.sessionSignal.set(session);
        this.userSignal.set(session?.user || null);
        this.loadingSignal.set(false);
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      this.configErrorSignal.set(true);
      this.loadingSignal.set(false);
    }
  }

  async waitForSession(): Promise<boolean> {
    if (!this.loadingSignal()) {
      return this.isAuthenticated();
    }
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (!this.loadingSignal()) {
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

  async signUp(email: string, password: string, username?: string): Promise<{ user: SupabaseUser | null; error: any }> {
    if (!this.supabase) {
      throw new Error('Supabase nie jest skonfigurowany. Użyj lokalnego logowania.');
    }

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/dashboard',
        data: {
          username: username || email.split('@')[0]
        }
      }
    });

    if (error) {
      throw new Error(this.translateAuthError(error.message));
    }

    if (data.user) {
      this.userSignal.set(data.user);
      this.sessionSignal.set(data.session);
    }

    return { user: data.user, error: null };
  }

  async signIn(email: string, password: string): Promise<{ user: SupabaseUser | null; error: any }> {
    if (!this.supabase) {
      throw new Error('Supabase nie jest skonfigurowany. Użyj lokalnego logowania.');
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(this.translateAuthError(error.message));
    }

    if (data.user) {
      this.userSignal.set(data.user);
      this.sessionSignal.set(data.session);
    }

    return { user: data.user, error: null };
  }

  async signOut(): Promise<void> {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }
    this.userSignal.set(null);
    this.sessionSignal.set(null);
  }

  async resetPassword(email: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase nie jest skonfigurowany.');
    }

    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login'
    });

    if (error) {
      throw new Error(this.translateAuthError(error.message));
    }
  }

  private translateAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'Nieprawidłowy adres e-mail lub hasło.';
    }
    if (lower.includes('user already registered')) {
      return 'Użytkownik z tym adresem e-mail już istnieje.';
    }
    if (lower.includes('password should be at least')) {
      return 'Hasło powinno składać się z co najmniej 6 znaków.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Adres e-mail nie został potwierdzony.';
    }
    return message;
  }
}
