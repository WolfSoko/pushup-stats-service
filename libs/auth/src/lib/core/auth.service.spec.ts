import { Signal } from '@angular/core';
import { User as FirebaseUser, UserCredential } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { AuthAdapter } from '../adapters/auth.adapter';
import { AuthService } from './auth.service';
import { POST_AUTH_HOOKS, PostAuthHook } from './ports/post-auth.hook';

function makeCredential(uid: string): UserCredential {
  return { user: { uid } as FirebaseUser } as UserCredential;
}

describe('AuthService', () => {
  let adapter: Partial<AuthAdapter>;
  let profileSyncHook: PostAuthHook;
  let migrationHook: PostAuthHook;

  beforeEach(() => {
    const mockFirebaseUser: Partial<FirebaseUser> = {
      uid: '123',
      email: 'test@test.de',
      displayName: 'Test',
      photoURL: null,
      emailVerified: true,
      providerId: 'google',
      isAnonymous: false,
    };
    adapter = {
      currentUser: mockFirebaseUser as FirebaseUser,
      authUser: (() => mockFirebaseUser as FirebaseUser) as Signal<
        FirebaseUser | null | undefined
      >,
      isAuthenticated: (() => true) as Signal<boolean>,
      idToken: (() => 'token') as Signal<string | null | undefined>,
      signInWithGoogle: jest.fn().mockResolvedValue(makeCredential('123')),
      signInWithEmail: jest.fn().mockResolvedValue(makeCredential('123')),
      signUpWithEmail: jest.fn().mockResolvedValue(makeCredential('123')),
      authStateReady: jest.fn().mockResolvedValue(undefined),
    };
    profileSyncHook = {
      onAuthenticated: jest.fn().mockResolvedValue(undefined),
    };
    migrationHook = {
      onAuthenticated: jest.fn().mockResolvedValue(undefined),
      onGuestMigration: jest.fn().mockResolvedValue(undefined),
    };
  });

  function makeProviders(
    hooks: PostAuthHook[] = [profileSyncHook, migrationHook]
  ) {
    return [
      AuthService,
      { provide: AuthAdapter, useValue: adapter },
      ...hooks.map((hook) => ({
        provide: POST_AUTH_HOOKS,
        useValue: hook,
        multi: true,
      })),
    ];
  }

  it('should map user correctly (given authUser returns value)', async () => {
    const { fixture } = await render('', { providers: makeProviders() });
    const service = fixture.debugElement.injector.get(AuthService);
    const user = service.user();
    expect(user).toBeDefined();
    expect(user?.uid).toBe('123');
  });

  it('should call signInWithGoogle when signing in with Google', async () => {
    const { fixture } = await render('', { providers: makeProviders() });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signInWithGoogle();
    expect(adapter.signInWithGoogle).toHaveBeenCalled();
  });

  it('should run post-auth hooks after Google sign-in', async () => {
    const { fixture } = await render('', { providers: makeProviders() });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signInWithGoogle();
    expect(profileSyncHook.onAuthenticated).toHaveBeenCalled();
  });

  it('should call signInWithEmail when signing in with email', async () => {
    const { fixture } = await render('', { providers: makeProviders() });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signInWithEmail('test@test.de', 'pw');
    expect(adapter.signInWithEmail).toHaveBeenCalledWith('test@test.de', 'pw');
  });

  it('should call signUpWithEmail when signing up with email', async () => {
    const { fixture } = await render('', { providers: makeProviders() });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signUpWithEmail('test@test.de', 'pw');
    expect(adapter.signUpWithEmail).toHaveBeenCalledWith('test@test.de', 'pw');
  });

  describe('signInGuestIfNeeded', () => {
    it('is a no-op when auth.currentUser is already set', async () => {
      const noopAdapter = {
        ...adapter,
        signInAnonymously: jest.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: noopAdapter },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInGuestIfNeeded();
      expect(noopAdapter.signInAnonymously).not.toHaveBeenCalled();
    });

    it('calls signInAnonymously when no session exists', async () => {
      const noSessionAdapter = {
        ...adapter,
        currentUser: null,
        authState: (() => null) as Signal<FirebaseUser | null | undefined>,
        signInAnonymously: jest
          .fn()
          .mockResolvedValue({ user: { uid: 'anon-uid' } }),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: noSessionAdapter },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInGuestIfNeeded();
      expect(noSessionAdapter.signInAnonymously).toHaveBeenCalled();
    });
  });

  describe('upgradeWithEmail', () => {
    it('links credential when currentUser is anonymous even when authUser signal is stale', async () => {
      const guestUser = { uid: 'guest-uid', isAnonymous: true } as FirebaseUser;
      const anonymousAdapter = {
        ...adapter,
        currentUser: guestUser,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        linkWithEmail: jest.fn().mockResolvedValue(makeCredential('guest-uid')),
        signUpWithEmail: jest.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: anonymousAdapter },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.upgradeWithEmail('new@test.de', 'pw');
      expect(anonymousAdapter.linkWithEmail).toHaveBeenCalledWith(
        'new@test.de',
        'pw'
      );
      expect(anonymousAdapter.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('falls back to signUpWithEmail when no user is anonymous', async () => {
      const nonAnonAdapter = {
        ...adapter,
        currentUser: null,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        signUpWithEmail: jest.fn().mockResolvedValue(makeCredential('new-uid')),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: nonAnonAdapter },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.upgradeWithEmail('new@test.de', 'pw');
      expect(nonAnonAdapter.signUpWithEmail).toHaveBeenCalledWith(
        'new@test.de',
        'pw'
      );
    });
  });

  describe('upgradeWithGoogle', () => {
    it('links credential when currentUser is anonymous even when authUser signal is stale', async () => {
      const guestUser = { uid: 'guest-uid', isAnonymous: true } as FirebaseUser;
      const anonymousAdapter = {
        ...adapter,
        currentUser: guestUser,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        linkWithGoogle: jest
          .fn()
          .mockResolvedValue(makeCredential('guest-uid')),
        signInWithGoogle: jest.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: anonymousAdapter },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.upgradeWithGoogle();
      expect(anonymousAdapter.linkWithGoogle).toHaveBeenCalled();
      expect(anonymousAdapter.signInWithGoogle).not.toHaveBeenCalled();
    });

    it('falls back to signInWithGoogle when no user is anonymous', async () => {
      const { fixture } = await render('', {
        providers: [AuthService, { provide: AuthAdapter, useValue: adapter }],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.upgradeWithGoogle();
      expect(adapter.signInWithGoogle).toHaveBeenCalled();
    });
  });

  describe('guest data migration', () => {
    it('signInWithEmailAndMigrateGuest: runs migration hook when currentUser is anonymous', async () => {
      const guestUser: Partial<FirebaseUser> = {
        uid: 'guest-uid',
        isAnonymous: true,
      };
      adapter.currentUser = guestUser as FirebaseUser;
      adapter.authUser = (() => null) as Signal<
        FirebaseUser | null | undefined
      >;
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithEmail = jest.fn().mockResolvedValue(realCredential);

      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithEmailAndMigrateGuest('a@b.de', 'pw');

      expect(migrationHook.onGuestMigration).toHaveBeenCalledWith(
        'guest-uid',
        'real-uid'
      );
    });

    it('signInWithEmailAndMigrateGuest: skips migration when currentUser is not anonymous', async () => {
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithEmail = jest.fn().mockResolvedValue(realCredential);

      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithEmailAndMigrateGuest('a@b.de', 'pw');

      expect(migrationHook.onGuestMigration).not.toHaveBeenCalled();
    });

    it('signInWithGoogleAndMigrateGuest: runs migration hook when currentUser is anonymous', async () => {
      const guestUser: Partial<FirebaseUser> = {
        uid: 'guest-uid',
        isAnonymous: true,
      };
      adapter.currentUser = guestUser as FirebaseUser;
      adapter.authUser = (() => null) as Signal<
        FirebaseUser | null | undefined
      >;
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithGoogle = jest.fn().mockResolvedValue(realCredential);

      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithGoogleAndMigrateGuest();

      expect(migrationHook.onGuestMigration).toHaveBeenCalledWith(
        'guest-uid',
        'real-uid'
      );
    });

    it('signInWithGoogleAndMigrateGuest: skips migration when currentUser is not anonymous', async () => {
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithGoogle = jest.fn().mockResolvedValue(realCredential);

      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithGoogleAndMigrateGuest();

      expect(migrationHook.onGuestMigration).not.toHaveBeenCalled();
    });
  });

  describe('logoutAllDevices', () => {
    it('revokes server-side sessions before signing out locally', async () => {
      const order: string[] = [];
      adapter.revokeAllSessions = jest.fn().mockImplementation(async () => {
        order.push('revoke');
      });
      adapter.signOut = jest.fn().mockImplementation(async () => {
        order.push('signOut');
      });

      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);

      await service.logoutAllDevices();

      expect(order).toEqual(['revoke', 'signOut']);
    });

    it('does not sign out locally when revoke fails (token still valid on this device)', async () => {
      adapter.revokeAllSessions = jest
        .fn()
        .mockRejectedValue(new Error('functions/unauthenticated'));
      adapter.signOut = jest.fn();

      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);

      await expect(service.logoutAllDevices()).rejects.toThrow(
        'functions/unauthenticated'
      );
      expect(adapter.signOut).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: runPostAuthHooks must prefer synchronous currentUser over the
  // signal-based user() which may still hold the stale anonymous user due to
  // the toSignal() microtask delay after an auth operation.
  // ---------------------------------------------------------------------------
  describe('runPostAuthHooks user-source precedence', () => {
    it('hooks receive the real user from currentUser, not the stale anonymous signal user', async () => {
      const staleAnonUser: Partial<FirebaseUser> = {
        uid: 'anon-uid',
        isAnonymous: true,
        email: null,
        displayName: null,
        photoURL: null,
        emailVerified: false,
        providerId: 'firebase',
      };
      const realUser: Partial<FirebaseUser> = {
        uid: 'real-uid',
        isAnonymous: false,
        email: 'real@test.de',
        displayName: 'Real User',
        photoURL: null,
        emailVerified: true,
        providerId: 'google',
      };

      // Simulate toSignal() lag: authUser signal still returns the stale
      // anonymous user even though Firebase has already updated currentUser.
      const staleAdapter = {
        ...adapter,
        // After sign-in, Firebase synchronously updates currentUser to the
        // real user, but the signal (toSignal(authState)) still holds stale data.
        currentUser: realUser as FirebaseUser,
        authUser: (() => staleAnonUser as FirebaseUser) as Signal<
          FirebaseUser | null | undefined
        >,
        signInWithGoogle: jest
          .fn()
          .mockResolvedValue(makeCredential('real-uid')),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: staleAdapter },
          {
            provide: POST_AUTH_HOOKS,
            useValue: profileSyncHook,
            multi: true,
          },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithGoogleAndMigrateGuest();

      // The hook must receive the REAL user (from currentUser), not the stale
      // anonymous user from the signal.
      expect(profileSyncHook.onAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'real-uid',
          email: 'real@test.de',
          isAnonymous: false,
        })
      );
      // Verify it was NOT called with the stale anonymous user
      expect(profileSyncHook.onAuthenticated).not.toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'anon-uid' })
      );
    });
  });
});
