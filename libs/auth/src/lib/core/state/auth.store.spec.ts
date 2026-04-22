import { Signal, signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../auth.service';
import { AuthStore } from './auth.store';

function makeAuthServiceMock(
  isAnonymous: boolean | null
): Partial<AuthService> {
  return {
    user: (() =>
      isAnonymous === null
        ? null
        : {
            isAnonymous,
            uid: 'u1',
            email: null,
            displayName: null,
            photoURL: null,
            emailVerified: false,
            providerId: 'unknown' as const,
          }) as Signal<ReturnType<AuthService['user']>>,
    isAuthenticated: (() => isAnonymous !== null) as Signal<boolean>,
    idToken: (() => null) as Signal<string | null | undefined>,
    userDbSyncState: signal('idle' as const),
  };
}

// ---------------------------------------------------------------------------
// AuthStore – signInWithEmail return value
// Regression for Bug 2: auth methods must return false on failure so callers
// don't need to check !authStore.error() externally (which could race against
// signal settling).
// ---------------------------------------------------------------------------
describe('AuthStore – signInWithEmail return value', () => {
  function makeFailingAuthServiceMock(): Partial<AuthService> {
    return {
      user: (() => null) as Signal<ReturnType<AuthService['user']>>,
      isAuthenticated: (() => false) as Signal<boolean>,
      idToken: (() => null) as Signal<string | null | undefined>,
      userDbSyncState: signal('idle' as const),
      signInWithEmailAndMigrateGuest: () =>
        Promise.reject(new Error('auth/invalid-credential')),
    };
  }

  function makeSucceedingAuthServiceMock(): Partial<AuthService> {
    return {
      user: (() => ({
        uid: 'u1',
        isAnonymous: false,
        email: 'test@test.de',
        displayName: null,
        photoURL: null,
        emailVerified: true,
        providerId: 'password' as const,
      })) as Signal<ReturnType<AuthService['user']>>,
      isAuthenticated: (() => true) as Signal<boolean>,
      idToken: (() => 'token') as Signal<string | null | undefined>,
      userDbSyncState: signal('success' as const),
      signInWithEmailAndMigrateGuest: () => Promise.resolve(),
    };
  }

  it('returns false and sets error when login fails', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: makeFailingAuthServiceMock() },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);

    const result = await store.signInWithEmail('bad@test.de', 'wrong');

    expect(result).toBe(false);
    expect(store.error()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('returns true and clears error when login succeeds', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: makeSucceedingAuthServiceMock() },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);

    const result = await store.signInWithEmail('test@test.de', 'Secret#1');

    expect(result).toBe(true);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });
});

describe('AuthStore – unsubscribeAllPushDevices', () => {
  function makeAuthServiceWith(
    impl: Partial<AuthService>
  ): Partial<AuthService> {
    return {
      user: (() => null) as Signal<ReturnType<AuthService['user']>>,
      isAuthenticated: (() => true) as Signal<boolean>,
      idToken: (() => 'token') as Signal<string | null | undefined>,
      userDbSyncState: signal('idle' as const),
      ...impl,
    };
  }

  it('returns true and clears error when unsubscribe succeeds', async () => {
    const service = makeAuthServiceWith({
      unsubscribeAllPushDevices: () => Promise.resolve(),
    });
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: service },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);

    const result = await store.unsubscribeAllPushDevices();

    expect(result).toBe(true);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('returns false and surfaces error when unsubscribe fails', async () => {
    const service = makeAuthServiceWith({
      unsubscribeAllPushDevices: () =>
        Promise.reject(new Error('functions/internal-error')),
    });
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: service },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);

    const result = await store.unsubscribeAllPushDevices();

    expect(result).toBe(false);
    expect(store.error()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('toggles loading flag during the call', async () => {
    let resolveCall: (() => void) | undefined;
    const service = makeAuthServiceWith({
      unsubscribeAllPushDevices: () =>
        new Promise<void>((resolve) => {
          resolveCall = resolve;
        }),
    });
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: service },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);

    const pending = store.unsubscribeAllPushDevices();
    expect(store.loading()).toBe(true);
    resolveCall?.();
    await pending;
    expect(store.loading()).toBe(false);
  });
});

describe('AuthStore – isGuest', () => {
  it('isGuest is false for a non-anonymous user', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: makeAuthServiceMock(false) },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);
    expect(store.isGuest()).toBe(false);
  });

  it('isGuest is true for an anonymous user', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: makeAuthServiceMock(true) },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);
    expect(store.isGuest()).toBe(true);
  });

  it('isGuest is false when user is null (logged out)', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthStore,
        { provide: AuthService, useValue: makeAuthServiceMock(null) },
        { provide: Auth, useValue: {} },
      ],
    });
    const store = fixture.debugElement.injector.get(AuthStore);
    expect(store.isGuest()).toBe(false);
  });
});
