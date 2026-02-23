import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { PLATFORM_ID } from '@angular/core';
import { FIREBASE_AUTH_CONFIG } from '../provide-auth';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FIREBASE_AUTH_CONFIG, useValue: mockConfig },
      ],
    });
  });

  it('should be created', () => {
    service = TestBed.inject(AuthService);
    expect(service).toBeTruthy();
  });

  it('should have initial state', () => {
    service = TestBed.inject(AuthService);
    expect(service.user()).toBeNull();
    expect(service.loading()).toBe('false');
    expect(service.isAuthenticated()).toBe('false');
  });
});
