import { PLATFORM_ID } from '@angular/core';
import { Auth, deleteUser as deleteUserFn } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { render } from '@testing-library/angular';
import { AuthAdapter } from './auth.adapter';

jest.mock('@angular/fire/auth', () => {
  const actual = jest.requireActual('@angular/fire/auth');
  return {
    ...actual,
    deleteUser: jest.fn(),
  };
});

jest.mock('@angular/fire/functions', () => ({
  Functions: class {},
  httpsCallable: jest.fn(),
}));

const deleteUserMock = jest.mocked(deleteUserFn);
const httpsCallableMock = jest.mocked(httpsCallable);

describe('AuthAdapter', () => {
  let mockAuth: Partial<Auth>;
  beforeEach(() => {
    mockAuth = {
      currentUser: { uid: 'u' } as unknown as Auth['currentUser'],
      signOut: jest.fn(),
    };
    deleteUserMock.mockReset();
    httpsCallableMock.mockReset();
  });

  it('should expose isAuthenticated signal (given authState)', async () => {
    const { fixture } = await render('', {
      providers: [{ provide: Auth, useValue: mockAuth }, AuthAdapter],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    expect(typeof adapter.isAuthenticated()).toBe('boolean');
  });

  it('should expose authResolved signal', async () => {
    const { fixture } = await render('', {
      providers: [{ provide: Auth, useValue: mockAuth }, AuthAdapter],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    expect(typeof adapter.authResolved()).toBe('boolean');
  });

  it('should call signOut on auth', async () => {
    const { fixture } = await render('', {
      providers: [{ provide: Auth, useValue: mockAuth }, AuthAdapter],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    await adapter.signOut();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('should call deleteUser if currentUser exists', async () => {
    const { fixture } = await render('', {
      providers: [{ provide: Auth, useValue: mockAuth }, AuthAdapter],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    await adapter.deleteUser();
    expect(deleteUserMock).toHaveBeenCalledWith(mockAuth.currentUser);
  });

  it('should not call deleteUser if no currentUser', async () => {
    Object.defineProperty(mockAuth, 'currentUser', { value: undefined });
    const { fixture } = await render('', {
      providers: [{ provide: Auth, useValue: mockAuth }, AuthAdapter],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    await adapter.deleteUser();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  describe('unsubscribeAllPushDevices', () => {
    it('invokes the unsubscribeAllPushDevices callable', async () => {
      const callable = jest.fn().mockResolvedValue({ data: { ok: true } });
      httpsCallableMock.mockReturnValue(
        callable as unknown as ReturnType<typeof httpsCallable>
      );

      const { fixture } = await render('', {
        providers: [
          { provide: Auth, useValue: mockAuth },
          { provide: Functions, useValue: {} },
          AuthAdapter,
        ],
      });
      const adapter = fixture.debugElement.injector.get(AuthAdapter);
      await adapter.unsubscribeAllPushDevices();

      expect(httpsCallableMock).toHaveBeenCalledWith(
        expect.any(Object),
        'unsubscribeAllPushDevices'
      );
      expect(callable).toHaveBeenCalledWith({});
    });

    it('throws when Functions is not available (e.g. SSR)', async () => {
      const { fixture } = await render('', {
        providers: [
          { provide: Auth, useValue: mockAuth },
          { provide: PLATFORM_ID, useValue: 'server' },
          AuthAdapter,
        ],
      });
      const adapter = fixture.debugElement.injector.get(AuthAdapter);
      await expect(adapter.unsubscribeAllPushDevices()).rejects.toThrow(
        'Cloud Functions not available'
      );
    });

    it('propagates errors from the callable', async () => {
      const callable = jest
        .fn()
        .mockRejectedValue(new Error('functions/internal'));
      httpsCallableMock.mockReturnValue(
        callable as unknown as ReturnType<typeof httpsCallable>
      );

      const { fixture } = await render('', {
        providers: [
          { provide: Auth, useValue: mockAuth },
          { provide: Functions, useValue: {} },
          AuthAdapter,
        ],
      });
      const adapter = fixture.debugElement.injector.get(AuthAdapter);
      await expect(adapter.unsubscribeAllPushDevices()).rejects.toThrow(
        'functions/internal'
      );
    });
  });

  it('should not crash on server platform (SSR)', async () => {
    const { fixture } = await render('', {
      providers: [
        { provide: Auth, useValue: mockAuth },
        { provide: PLATFORM_ID, useValue: 'server' },
        AuthAdapter,
      ],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    // On the server, signals return null (= resolved, unauthenticated)
    // so SSR renders the unauthenticated state, not a "loading" state
    expect(adapter.authUser()).toBeNull();
    expect(adapter.authState()).toBeNull();
    expect(adapter.idToken()).toBeNull();
    expect(adapter.isAuthenticated()).toBe(false);
    expect(adapter.authResolved()).toBe(true);
  });
});
