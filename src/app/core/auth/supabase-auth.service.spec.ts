import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseAuthService } from './supabase-auth.service';

describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseAuthService]
    });
    service = TestBed.inject(SupabaseAuthService);
  });

  it('should initialize with placeholder environment gracefully', () => {
    expect(service).toBeTruthy();
    // Since environment has placeholder values in test setup, isConfigError should be true
    expect(service.isConfigError()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should throw error when signing in with placeholder config', async () => {
    await expect(service.signIn('test@example.com', 'password123')).rejects.toThrow();
  });

  it('should throw error when signing up with placeholder config', async () => {
    await expect(service.signUp('test@example.com', 'password123', 'Tester')).rejects.toThrow();
  });
});
