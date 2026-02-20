import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

let FirebaseAuthService: typeof import('./firebase-auth.service').FirebaseAuthService;

const signInWithPopupMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);
const onAuthStateChangedMock = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
}));

class GoogleAuthProvider {
  providerId = 'google';
}

class GithubAuthProvider {
  providerId = 'github';
}

class OAuthProvider {
  providerId: string;

  constructor(id: string) {
    this.providerId = id;
  }
}

class EmailAuthProvider {
  providerId = 'email';
}

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
  getAuth: vi.fn(() => ({ name: 'auth' })),
  onAuthStateChanged: (_auth: unknown, cb: (u: null) => void) => {
    onAuthStateChangedMock();
    cb(null);
  },
  signInWithPopup: () => signInWithPopupMock(),
  signOut: () => signOutMock(),
}));

describe('FirebaseAuthService', () => {
  beforeEach(async () => {
    (globalThis as unknown as { __PUS_FIREBASE__?: unknown }).__PUS_FIREBASE__ =
      {
        apiKey: 'key',
        authDomain: 'domain',
        projectId: 'project',
        appId: 'app',
      };

    ({ FirebaseAuthService } = await import('./firebase-auth.service'));
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
