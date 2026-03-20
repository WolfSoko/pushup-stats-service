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
      currentUser: null,
      authUser: (() => mockFirebaseUser as FirebaseUser) as Signal<
        FirebaseUser | null | undefined
      >,
      isAuthenticated: (() => true) as Signal<boolean>,
      idToken: (() => 'token') as Signal<string | null | undefined>,
      signInWithGoogle: jest.fn().mockResolvedValue(makeCredential('123')),
      signInWithEmail: jest.fn().mockResolvedValue(makeCredential('123')),
      signUpWithEmail: jest.fn().mockResolvedValue(makeCredential('123')),
    };
    userConfigApi = {
      getConfig: jest.fn().mockReturnValue(of({ userId: '123' })),
      updateConfig: jest.fn().mockReturnValue(of({})),
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
    userConfigApi.getConfig = jest.fn().mockReturnValue(
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

  describe('upgradeWithEmail', () => {
    it('links credential when currentUser is anonymous even when authUser signal is stale', async () => {
      // Given: currentUser is set to anonymous (race: signal is still null/stale)
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
        signUpWithEmail: jest.fn().mockResolvedValue(makeCredential('new-uid')),
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
        linkWithGoogle: jest
          .fn()
          .mockResolvedValue(makeCredential('guest-uid')),
        signInWithGoogle: jest.fn(),
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
      // Given: currentUser is null and signal is also not anonymous
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

  describe('signInWithEmailAndMigrateGuest', () => {
    it('captures guest UID from currentUser when signal is stale and migrates data', async () => {
      // Given: currentUser reflects anonymous guest; signal is stale/null
      const guestUser = { uid: 'guest-uid', isAnonymous: true } as FirebaseUser;
      const migrateAdapter = {
        ...adapter,
        currentUser: guestUser,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        signInWithEmail: jest
          .fn()
          .mockResolvedValue(makeCredential('real-uid')),
      };
      const pushupFirestore: Partial<PushupFirestoreService> = {
        migrateUserData: jest.fn().mockResolvedValue(undefined),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: migrateAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
          { provide: PushupFirestoreService, useValue: pushupFirestore },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.signInWithEmailAndMigrateGuest('real@test.de', 'pw');

      // Then: guest data migrated to the new UID
      expect(pushupFirestore.migrateUserData).toHaveBeenCalledWith(
        'guest-uid',
        'real-uid'
      );
    });

    it('skips migration when currentUser is not anonymous', async () => {
      // Given: no anonymous guest
      const signedInAdapter = {
        ...adapter,
        currentUser: null,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        signInWithEmail: jest
          .fn()
          .mockResolvedValue(makeCredential('real-uid')),
      };
      const pushupFirestore: Partial<PushupFirestoreService> = {
        migrateUserData: jest.fn(),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: signedInAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
          { provide: PushupFirestoreService, useValue: pushupFirestore },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.signInWithEmailAndMigrateGuest('real@test.de', 'pw');

      // Then: no migration
      expect(pushupFirestore.migrateUserData).not.toHaveBeenCalled();
    });
  });

  describe('signInWithGoogleAndMigrateGuest', () => {
    it('captures guest UID from currentUser when signal is stale and migrates data', async () => {
      // Given: currentUser reflects anonymous guest; signal is stale/null
      const guestUser = { uid: 'guest-uid', isAnonymous: true } as FirebaseUser;
      const migrateAdapter = {
        ...adapter,
        currentUser: guestUser,
        authUser: (() => null) as Signal<FirebaseUser | null | undefined>,
        signInWithGoogle: jest
          .fn()
          .mockResolvedValue(makeCredential('real-uid')),
      };
      const pushupFirestore: Partial<PushupFirestoreService> = {
        migrateUserData: jest.fn().mockResolvedValue(undefined),
      };

      const { fixture } = await render('', {
        providers: [
          AuthService,
          { provide: AuthAdapter, useValue: migrateAdapter },
          { provide: UserConfigApiService, useValue: userConfigApi },
          { provide: PushupFirestoreService, useValue: pushupFirestore },
        ],
      });
      const service = fixture.debugElement.injector.get(AuthService);

      // When
      await service.signInWithGoogleAndMigrateGuest();

      // Then: guest data migrated to the new UID
      expect(pushupFirestore.migrateUserData).toHaveBeenCalledWith(
        'guest-uid',
        'real-uid'
      );
    });
  });
});
