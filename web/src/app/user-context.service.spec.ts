import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserContextService } from './user-context.service';
import { signal } from '@angular/core';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';
import { Auth } from '@angular/fire/auth';

class FirebaseAuthStub {
  user = signal<{
    uid: string;
    displayName?: string | null;
    email?: string | null;
  } | null>(null);
}

describe('UserContextService', () => {
  let firebaseAuth: FirebaseAuthStub;

  beforeEach(() => {
    firebaseAuth = new FirebaseAuthStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthStore, useValue: firebaseAuth },
        { provide: Auth, useValue: {} },
      ],
    });
  });

  it('uses firebase auth uid when available', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'firebase-user' });
    TestBed.tick();
    expect(service.userIdSafe()).toBe('firebase-user');
  });

  it('uses firebase auth user.displayName when available', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: '123', displayName: 'firebase-user' });
    TestBed.tick();
    expect(service.userNameSafe()).toBe('firebase-user');
  });

  it('uses firebase auth user.displayName when available', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: '123', displayName: 'firebase-user' });
    TestBed.tick();
    expect(service.userNameSafe()).toBe('firebase-user');
  });
  it('uses firebase auth user.email when user.displayName is not available', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: '123', email: 'firebase@user' });
    TestBed.tick();
    expect(service.userNameSafe()).toBe('firebase@user');
  });

  it('resets user context to guest values on logout', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'firebase-user' });
    TestBed.tick();
    expect(service.userIdSafe()).toBe('firebase-user');

    firebaseAuth.user.set(null);
    TestBed.tick();
    expect(service.userIdSafe()).toBe('');
    expect(service.userNameSafe()).toBe('Gast');
  });
});
