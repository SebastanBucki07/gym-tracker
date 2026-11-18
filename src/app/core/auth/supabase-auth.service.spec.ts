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

  it('should initialize successfully and provide reactive signals', () => {
    expect(service).toBeTruthy();
    expect(typeof service.isConfigError()).toBe('boolean');
    expect(typeof service.isAuthenticated()).toBe('boolean');
  });

  it('should have session and user signals', () => {
    expect(service.currentUser()).toBeDefined();
    expect(service.currentSession()).toBeDefined();
  });
});
