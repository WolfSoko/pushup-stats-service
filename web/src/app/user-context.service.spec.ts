import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserContextService } from './user-context.service';
import { signal } from '@angular/core';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthService } from '@pu-auth/auth';

class FirebaseAuthStub {
  user = signal<{ uid: string } | null>(null);
}

describe('UserContextService', () => {
  let firebaseAuth: FirebaseAuthStub;

  beforeEach(() => {
    firebaseAuth = new FirebaseAuthStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: firebaseAuth },
      ],
    });
  });

  it('uses firebase auth uid when available', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'firebase-user' });
    TestBed.tick();
    expect(service.userIdSafe()).toBe('firebase-user');
  });

  it('resets userId to default on logout', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'firebase-user' });
    TestBed.tick();
    expect(service.userIdSafe()).toBe('firebase-user');

    firebaseAuth.user.set(null);
    TestBed.tick();
    expect(service.userIdSafe()).toBe('default');
  });
});
