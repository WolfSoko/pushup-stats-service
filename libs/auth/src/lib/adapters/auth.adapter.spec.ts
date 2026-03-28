import { Auth, deleteUser as deleteUserFn } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { AuthAdapter } from './auth.adapter';

vi.mock('@angular/fire/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/fire/auth')>();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = () => {};

  const makeObs = () => {
    const o: any = {
      subscribe: () => ({ unsubscribe: noop }),
      pipe: (..._: any[]) => o,
    };
    return o;
  };
  return {
    ...actual,
    authState: vi.fn(makeObs),
    user: vi.fn(makeObs),
    idToken: vi.fn(makeObs),
    deleteUser: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signOut: vi.fn((auth: any) => auth.signOut()),
    signInWithPopup: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInAnonymously: vi.fn(),
    linkWithCredential: vi.fn(),
    linkWithPopup: vi.fn(),
    GoogleAuthProvider: vi
      .fn()
      .mockImplementation(() => ({ addScope: vi.fn() })),
    EmailAuthProvider: { credential: vi.fn() },
  };
});

const deleteUserMock = vi.mocked(deleteUserFn);

describe('AuthAdapter', () => {
  let mockAuth: Partial<Auth>;
  beforeEach(() => {
    mockAuth = {
      currentUser: { uid: 'u' } as unknown as Auth['currentUser'],
      signOut: vi.fn(),
    };
    deleteUserMock.mockReset();
  });

  it('should expose isAuthenticated signal (given authState)', async () => {
    const { fixture } = await render('', {
      providers: [{ provide: Auth, useValue: mockAuth }, AuthAdapter],
    });
    const adapter = fixture.debugElement.injector.get(AuthAdapter);
    expect(typeof adapter.isAuthenticated()).toBe('boolean');
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
});
