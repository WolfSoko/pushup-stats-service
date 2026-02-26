import { Signal } from '@angular/core';
import { User as FirebaseUser } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { AuthAdapter } from '../adapters/auth.adapter';
import { AuthService } from './auth.service';

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
});
