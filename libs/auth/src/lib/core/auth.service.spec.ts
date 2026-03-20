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
      signInWithGoogle: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
    };
    userConfigApi = {
      getConfig: jest.fn().mockReturnValue(of({ userId: '123' })),
      updateConfig: jest.fn().mockReturnValue(of({})),
    };
    pushupFirestore = {
      migrateUserData: jest.fn().mockResolvedValue(undefined),
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
      adapter.currentUser = guestUser as FirebaseUser;
      adapter.authUser = (() => null) as Signal<
        FirebaseUser | null | undefined
      >;
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithEmail = jest.fn().mockResolvedValue(realCredential);
      userConfigApi.getConfig = jest
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
      adapter.signInWithEmail = jest.fn().mockResolvedValue(realCredential);

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
      adapter.currentUser = guestUser as FirebaseUser;
      adapter.authUser = (() => null) as Signal<
        FirebaseUser | null | undefined
      >;
      const realCredential = {
        user: { uid: 'real-uid' } as FirebaseUser,
      } as UserCredential;
      adapter.signInWithGoogle = jest.fn().mockResolvedValue(realCredential);
      userConfigApi.getConfig = jest
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
      adapter.signInWithGoogle = jest.fn().mockResolvedValue(realCredential);

      // When
      const { fixture } = await render('', { providers: makeProviders() });
      const service = fixture.debugElement.injector.get(AuthService);
      await service.signInWithGoogleAndMigrateGuest();

      // Then: no migration attempted
      expect(pushupFirestore.migrateUserData).not.toHaveBeenCalled();
    });
  });
});
