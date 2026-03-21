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
