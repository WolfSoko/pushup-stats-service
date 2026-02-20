import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { FirebaseAuthService } from './firebase-auth.service';

const signInWithPopupMock = jest.fn(async () => undefined);
const signOutMock = jest.fn(async () => undefined);
const onAuthStateChangedMock = jest.fn((_: unknown, cb: (u: null) => void) =>
  cb(null)
);

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'app' })),
}));

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(() => ({ providerId: 'google' })),
  GithubAuthProvider: jest.fn(() => ({ providerId: 'github' })),
  OAuthProvider: jest.fn((id: string) => ({ providerId: id })),
  EmailAuthProvider: jest.fn(() => ({ providerId: 'email' })),
  getAuth: jest.fn(() => ({ name: 'auth' })),
  onAuthStateChanged: (...args: unknown[]) => onAuthStateChangedMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

describe('FirebaseAuthService', () => {
  beforeEach(() => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      {
        apiKey: 'key',
        authDomain: 'domain',
        projectId: 'project',
        appId: 'app',
      };
  });

  it('is disabled on server', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const service = TestBed.inject(FirebaseAuthService);
    expect(service.enabled).toBe(false);
  });

  it('signs in and out when enabled', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(FirebaseAuthService);
    expect(service.enabled).toBe(true);

    await service.signInWithProvider('google');
    expect(signInWithPopupMock).toHaveBeenCalled();

    await service.signOut();
    expect(signOutMock).toHaveBeenCalled();
  });
});
