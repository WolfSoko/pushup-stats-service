import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { PLATFORM_ID } from '@angular/core';
import { FIREBASE_AUTH_CONFIG } from '../provide-auth';
import { AuthAdapter } from '../adapters/auth.adapter';
import { signal } from '@angular/core';

type User = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

const mockConfig = {
  enabled: false,
} as const;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FIREBASE_AUTH_CONFIG, useValue: mockConfig },
        {
          provide: AuthAdapter,
          useValue: {
            authUser: signal<User | null>(null),
            isAuthenticated: signal(false),
            idToken: signal<string | null>(null),
            signInWithGoogle: jest.fn(),
            signInWithEmail: jest.fn(),
            signUpWithEmail: jest.fn(),
            signOut: jest.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
