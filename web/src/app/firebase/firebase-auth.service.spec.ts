import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { FirebaseAuthService } from './firebase-auth.service';

const signInWithPopupMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);
const onAuthStateChangedMock = vi.fn((_: unknown, cb: (u: null) => void) =>
  cb(null)
);

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(() => ({ providerId: 'google' })),
  GithubAuthProvider: vi.fn(() => ({ providerId: 'github' })),
  OAuthProvider: vi.fn((id: string) => ({ providerId: id })),
  EmailAuthProvider: vi.fn(() => ({ providerId: 'email' })),
  getAuth: vi.fn(() => ({ name: 'auth' })),
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
