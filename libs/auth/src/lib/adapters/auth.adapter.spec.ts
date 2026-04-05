import { Auth, deleteUser as deleteUserFn } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { AuthAdapter } from './auth.adapter';

jest.mock('@angular/fire/auth', () => {
  const actual = jest.requireActual('@angular/fire/auth');
  return {
    ...actual,
    deleteUser: jest.fn(),
  };
});

const deleteUserMock = jest.mocked(deleteUserFn);

describe('AuthAdapter', () => {
  let mockAuth: Partial<Auth>;
  beforeEach(() => {
    mockAuth = {
      currentUser: { uid: 'u' } as unknown as Auth['currentUser'],
      signOut: jest.fn(),
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
});
