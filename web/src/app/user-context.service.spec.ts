import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserContextService } from './user-context.service';
import { FirebaseAuthService } from './firebase/firebase-auth.service';
import { signal } from '@angular/core';

class FirebaseAuthStub {
  enabled = true;
  user = signal<{ uid: string } | null>(null);
}

describe('UserContextService', () => {
  it('uses firebase auth uid when available', () => {
    const firebaseAuth = new FirebaseAuthStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FirebaseAuthService, useValue: firebaseAuth },
      ],
    });

    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'firebase-user' });
    TestBed.flushEffects();

    expect(service.userIdSafe()).toBe('firebase-user');
  });

  it('resets userId to default on logout', () => {
    const firebaseAuth = new FirebaseAuthStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FirebaseAuthService, useValue: firebaseAuth },
      ],
    });

    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'firebase-user' });
    TestBed.flushEffects();
    expect(service.userIdSafe()).toBe('firebase-user');

    firebaseAuth.user.set(null);
    TestBed.flushEffects();
    expect(service.userIdSafe()).toBe('default');
  });
});
