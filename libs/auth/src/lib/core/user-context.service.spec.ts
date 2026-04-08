import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { UserContextService } from './user-context.service';
import { AuthStore } from './state/auth.store';
import { Auth } from '@angular/fire/auth';

/** Flush pending microtasks (Promise callbacks) */
const flushMicrotasks = () => new Promise((r) => process.nextTick(r));

class FirebaseAuthStub {
  user = signal<{
    uid: string;
    displayName?: string | null;
    email?: string | null;
    isAnonymous?: boolean;
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
        { provide: Auth, useValue: { currentUser: null } },
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

  it('uses firebase auth user.email when user.displayName is not available', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: '123', email: 'firebase@user' });
    TestBed.tick();
    expect(service.userNameSafe()).toBe('firebase@user');
  });

  it('isGuest returns true when user.isAnonymous is true', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'anon-123', isAnonymous: true });
    TestBed.tick();
    expect(service.isGuest()).toBe(true);
  });

  it('isGuest returns false when user.isAnonymous is false', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set({ uid: 'real-user', isAnonymous: false });
    TestBed.tick();
    expect(service.isGuest()).toBe(false);
  });

  it('isGuest returns false when user is null', () => {
    const service = TestBed.inject(UserContextService);
    firebaseAuth.user.set(null);
    TestBed.tick();
    expect(service.isGuest()).toBe(false);
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

  it('isAdmin returns false when no user is signed in', () => {
    const service = TestBed.inject(UserContextService);
    expect(service.isAdmin()).toBe(false);
  });
});

describe('UserContextService (admin claims)', () => {
  let firebaseAuth: FirebaseAuthStub;

  beforeEach(() => {
    firebaseAuth = new FirebaseAuthStub();
  });

  it('isAdmin returns true when user has admin custom claim', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthStore, useValue: firebaseAuth },
        {
          provide: Auth,
          useValue: {
            currentUser: {
              getIdTokenResult: () =>
                Promise.resolve({ claims: { admin: true } }),
            },
          },
        },
      ],
    });
    firebaseAuth.user.set({ uid: 'admin-user' });
    const service = TestBed.inject(UserContextService);
    // Flush resource params change, then await microtask for async loader
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    expect(service.isAdmin()).toBe(true);
  });

  it('isAdmin returns false when user lacks admin custom claim', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthStore, useValue: firebaseAuth },
        {
          provide: Auth,
          useValue: {
            currentUser: {
              getIdTokenResult: () => Promise.resolve({ claims: {} }),
            },
          },
        },
      ],
    });
    firebaseAuth.user.set({ uid: 'regular-user' });
    const service = TestBed.inject(UserContextService);
    // Flush resource params change, then await microtask for async loader
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    expect(service.isAdmin()).toBe(false);
  });
});
