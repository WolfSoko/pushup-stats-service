import { Signal } from '@angular/core';
import { User as FirebaseUser, UserCredential } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import {
  PushupFirestoreService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { AuthAdapter } from '../adapters/auth.adapter';
import { AuthService } from './auth.service';

function makeCredential(uid: string): UserCredential {
  return { user: { uid } as FirebaseUser } as UserCredential;
}

describe('AuthService', () => {
  let adapter: Partial<AuthAdapter>;
  let userConfigApi: Partial<UserConfigApiService>;
  let pushupFirestore: Partial<PushupFirestoreService>;

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
      signInWithGoogle: vi.fn().mockResolvedValue(makeCredential('123')),
      signInWithEmail: vi.fn().mockResolvedValue(makeCredential('123')),
      signUpWithEmail: vi.fn().mockResolvedValue(makeCredential('123')),
      authStateReady: vi.fn().mockResolvedValue(undefined),
    };
    userConfigApi = {
      getConfig: vi.fn().mockReturnValue(of({ userId: '123' })),
      updateConfig: vi.fn().mockReturnValue(of({})),
    };
    pushupFirestore = {
      migrateUserData: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should map user correctly (given authUser returns value)', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthService,
        { provide: AuthAdapter, useValue: adapter },
        { provide: UserConfigApiService, useValue: userConfigApi },
      ],
    });
    const service = fixture.debugElement.injector.get(AuthService);
    const user = service.user();
    expect(user).toBeDefined();
    expect(user?.uid).toBe('123');
  });

  it('should call signInWithGoogle when signing in with Google', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthService,
        { provide: AuthAdapter, useValue: adapter },
        { provide: UserConfigApiService, useValue: userConfigApi },
      ],
    });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signInWithGoogle();
    expect(adapter.signInWithGoogle).toHaveBeenCalled();
  });

  it('should call signInWithEmail when signing in with email', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthService,
        { provide: AuthAdapter, useValue: adapter },
        { provide: UserConfigApiService, useValue: userConfigApi },
      ],
    });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signInWithEmail('test@test.de', 'pw');
    expect(adapter.signInWithEmail).toHaveBeenCalledWith('test@test.de', 'pw');
  });

  it('should call signUpWithEmail when signing up with email', async () => {
    const { fixture } = await render('', {
      providers: [
        AuthService,
        { provide: AuthAdapter, useValue: adapter },
        { provide: UserConfigApiService, useValue: userConfigApi },
      ],
    });
    const service = fixture.debugElement.injector.get(AuthService);
    await service.signUpWithEmail('test@test.de', 'pw');
    expect(adapter.signUpWithEmail).toHaveBeenCalledWith('test@test.de', 'pw');
  });

  it('keeps existing config displayName on repeated Google login', async () => {
    userConfigApi.getConfig = vi.fn().mockReturnValue(
      of({
        userId: '123',
        displayName: 'CustomName',
      })
    );

    const { fixture } = await render('', {
      providers: [
        AuthService,
        { provide: AuthAdapter, useValue: adapter },
        { provide: UserConfigApiService, useValue: userConfigApi },
      ],
    });

    const service = fixture.debugElement.injector.get(AuthService);
    await service.signInWithGoogle();

    expect(userConfigApi.updateConfig).toHaveBeenCalledWith(
      '123',
      expect.objectContaining({ displayName: 'CustomName' })
    );
  });

  describe('signInGuestIfNeeded', () => {
    it('is a no-op when auth.currentUser is already set', async () => {
      // Given: adapter.currentUser is set (synchronous, persisted session)
      // authState() doesn't matter - short-circuits on currentUser
      const noopAdapter = {
        ...adapter,
        signInAnonymously: vi.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: noopAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.signInGuestIfNeeded();

      // Then: no new anonymous sign-in
      expect(noopAdapter.signInAnonymously).not.toHaveBeenCalled();
    });

    it('is a no-op when currentUser is set after authStateReady()', async () => {
      // Given: authStateReady() resolves and currentUser reflects a real session
      const mockUser = {
        uid: 'signal-uid',
        isAnonymous: false,
      } as FirebaseUser;
      const noopAdapter = {
        ...adapter,
        currentUser: mockUser,
        signInAnonymously: vi.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: noopAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.signInGuestIfNeeded();

      // Then: no new anonymous sign-in
      expect(noopAdapter.signInAnonymously).not.toHaveBeenCalled();
    });

    it('calls signInAnonymously when no session exists', async () => {
      // Given: no currentUser and no authState() signal value
      const noSessionAdapter = {
        ...adapter,
        currentUser: null,
        authState: (() => null) as Signal<FirebaseUser | null | undefined>,
        signInAnonymously: vi
          .fn()
          .mockResolvedValue({ user: { uid: 'anon-uid' } }),
      };
      userConfigApi.getConfig = vi
        .fn()
        .mockReturnValue(of({ userId: 'anon-uid' }));

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: noSessionAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.signInGuestIfNeeded();

      // Then: anonymous sign-in was triggered
      expect(noSessionAdapter.signInAnonymously).toHaveBeenCalled();
    });
  });

  describe('upgradeWithEmail', () => {
    it('links credential when currentUser is anonymous even when authUser signal is stale', async () => {
      // Given: currentUser is set to anonymous (race: signal is still null/stale)
      const guestUser = { uid: 'guest-uid', isAnonymous: true } as FirebaseUser;
      const anonymousAdapter = {
        ...adapter,
        currentUser: guestUser,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        linkWithEmail: vi.fn().mockResolvedValue(makeCredential('guest-uid')),
        signUpWithEmail: vi.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: anonymousAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.upgradeWithEmail('new@test.de', 'pw');

      // Then: links (preserves UID) instead of creating a new account
      expect(anonymousAdapter.linkWithEmail).toHaveBeenCalledWith(
        'new@test.de',
        'pw'
      );
      expect(anonymousAdapter.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('falls back to signUpWithEmail when no user is anonymous', async () => {
      // Given: no anonymous user in either currentUser or signal
      const nonAnonAdapter = {
        ...adapter,
        currentUser: null,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        signUpWithEmail: vi.fn().mockResolvedValue(makeCredential('new-uid')),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: nonAnonAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.upgradeWithEmail('new@test.de', 'pw');

      // Then: creates a new account
      expect(nonAnonAdapter.signUpWithEmail).toHaveBeenCalledWith(
        'new@test.de',
        'pw'
      );
    });
  });

  describe('upgradeWithGoogle', () => {
    it('links credential when currentUser is anonymous even when authUser signal is stale', async () => {
      // Given: currentUser is set to anonymous (race: signal is still null/stale)
      const guestUser = { uid: 'guest-uid', isAnonymous: true } as FirebaseUser;
      const anonymousAdapter = {
        ...adapter,
        currentUser: guestUser,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        linkWithGoogle: vi.fn().mockResolvedValue(makeCredential('guest-uid')),
        signInWithGoogle: vi.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: anonymousAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.upgradeWithGoogle();

      // Then: links (preserves UID) instead of a fresh Google sign-in
      expect(anonymousAdapter.linkWithGoogle).toHaveBeenCalled();
      expect(anonymousAdapter.signInWithGoogle).not.toHaveBeenCalled();
    });

    it('falls back to signInWithGoogle when no user is anonymous', async () => {
      // Given: currentUser is non-anonymous and signal is also not anonymous
      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: adapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.upgradeWithGoogle();

      // Then: regular Google sign-in
      expect(adapter.signInWithGoogle).toHaveBeenCalled();
    });
  });

  describe('guest data migration', () => {
    function makeProviders() {
      return [
        AuthService,
        { provide: AuthAdapter, useValue: adapter },
        { provide: UserConfigApiService, useValue: userConfigApi },
        { provide: PushupFirestoreService, useValue: pushupFirestore },
      ];
    }

    it('signInWithEmailAndMigrateGuest: migrates guest data when currentUser is anonymous (even if authUser() signal is null)', async () => {
      // Given: currentUser is anonymous (auth settled synchronously),
      // but authUser() signal hasn't resolved yet (startup race condition)
      const guestUser: Partial<FirebaseUser> = {
        uid: 'guest-uid',
        isAnonymous: true,
      };
      (adapter as any).currentUser = guestUser as FirebaseUser;
      (adapter as any).authUser = (() => null) as Signal<
        FirebaseUser | null | undefined
      >;
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithEmail = vi.fn().mockResolvedValue(realCredential);
      userConfigApi.getConfig = vi
        .fn()
        .mockReturnValue(of({ userId: 'real-uid' }));

      // When
      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithEmailAndMigrateGuest('a@b.de', 'pw');

      // Then: guest data is migrated using the UID from currentUser
      expect(pushupFirestore.migrateUserData).toHaveBeenCalledWith(
        'guest-uid',
        'real-uid'
      );
    });

    it('signInWithEmailAndMigrateGuest: skips migration when currentUser is not anonymous', async () => {
      // Given: non-anonymous currentUser (no guest session)
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithEmail = vi.fn().mockResolvedValue(realCredential);

      // When
      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithEmailAndMigrateGuest('a@b.de', 'pw');

      // Then: no migration attempted
      expect(pushupFirestore.migrateUserData).not.toHaveBeenCalled();
    });

    it('signInWithGoogleAndMigrateGuest: migrates guest data when currentUser is anonymous (even if authUser() signal is null)', async () => {
      // Given: currentUser is anonymous, authUser() signal hasn't resolved yet
      const guestUser: Partial<FirebaseUser> = {
        uid: 'guest-uid',
        isAnonymous: true,
      };
      (adapter as any).currentUser = guestUser as FirebaseUser;
      (adapter as any).authUser = (() => null) as Signal<
        FirebaseUser | null | undefined
      >;
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithGoogle = vi.fn().mockResolvedValue(realCredential);
      userConfigApi.getConfig = vi
        .fn()
        .mockReturnValue(of({ userId: 'real-uid' }));

      // When
      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithGoogleAndMigrateGuest();

      // Then: guest data is migrated using the UID from currentUser
      expect(pushupFirestore.migrateUserData).toHaveBeenCalledWith(
        'guest-uid',
        'real-uid'
      );
    });

    it('signInWithGoogleAndMigrateGuest: skips migration when currentUser is not anonymous', async () => {
      // Given: non-anonymous currentUser
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithGoogle = vi.fn().mockResolvedValue(realCredential);

      // When
      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithGoogleAndMigrateGuest();

      // Then: no migration attempted
      expect(pushupFirestore.migrateUserData).not.toHaveBeenCalled();
    });
  });
});
