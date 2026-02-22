import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { PLATFORM_ID } from '@angular/core';
import { FIREBASE_AUTH_CONFIG } from './firebase-auth.config';

describe('AuthService', () => {
  let service: AuthService;

  const mockConfig = {
    apiKey: 'test-api-key',
    authDomain: 'test.firebaseapp.com',
    projectId: 'test-project',
    storageBucket: 'test.appspot.com',
    messagingSenderId: '123456',
    appId: '1:123:web:abc',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FIREBASE_AUTH_CONFIG, useValue: mockConfig },
      ],
    });
  });

  afterEach(() => {
    service?.ngOnDestroy?.();
  });

  it('should be created', () => {
    service = TestBed.inject(AuthService);
    expect(service).toBeTruthy();
    service.ngOnDestroy();
  });

  it('should have signals', () => {
    service = TestBed.inject(AuthService);
    expect(service.user()).toBeNull();
    expect(typeof service.loading()).toBe('boolean');
    expect(typeof service.isAuthenticated()).toBe('boolean');
    service.ngOnDestroy();
  });
});
