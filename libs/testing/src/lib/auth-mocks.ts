/**
 * Shared auth mock factories for tests across the monorepo.
 *
 * Usage:
 *   import { makeAuthAdapterMock, makeAuthServiceMock, makeAuthStoreMock } from '@pu-stats/testing';
 *
 * All factories are framework-agnostic (no jest/vitest imports).
 * Pass your framework's spy as an override to track calls:
 *
 *   // Jest:
 *   const mock = makeAuthServiceMock({ signInGuestIfNeeded: jest.fn() });
 *   // Vitest:
 *   const mock = makeAuthServiceMock({ signInGuestIfNeeded: vitest.fn() });
 */

import { Signal, signal } from '@angular/core';
import { User as FirebaseUser, UserCredential } from '@angular/fire/auth';

/**
 * Structural shape of the auth User model.
 * Defined locally to avoid a circular dependency: testing → auth → testing.
 */
interface AuthUserShape {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
  isAnonymous: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal FirebaseUser-shaped object for testing. */
export function makeFirebaseUser(
  overrides: Partial<FirebaseUser> = {}
): FirebaseUser {
  return {
    uid: 'test-uid',
    email: 'test@test.de',
    displayName: 'Test User',
    photoURL: null,
    emailVerified: true,
    providerId: 'google',
    isAnonymous: false,
    ...overrides,
  } as FirebaseUser;
}

/** Creates a minimal UserCredential for testing. */
export function makeUserCredential(uid = 'test-uid'): UserCredential {
  return { user: { uid } as FirebaseUser } as UserCredential;
}

// ---------------------------------------------------------------------------
// AuthAdapter mock
// ---------------------------------------------------------------------------

/**
 * Creates a partial AuthAdapter mock with sensible defaults.
 * Stub functions return resolved promises or signal values.
 * Override any property to adapt the mock for a specific test scenario.
 *
 * @example
 * const adapter = makeAuthAdapterMock({ signInWithGoogle: jest.fn().mockResolvedValue(makeUserCredential()) });
 */
export function makeAuthAdapterMock(overrides: Record<string, unknown> = {}) {
  const mockUser = makeFirebaseUser();
  return {
    currentUser: mockUser,
    authUser: (() => mockUser) as Signal<FirebaseUser | null | undefined>,
    authState: (() => mockUser) as Signal<FirebaseUser | null | undefined>,
    isAuthenticated: (() => true) as Signal<boolean>,
    idToken: (() => 'token') as Signal<string | null | undefined>,
    signInWithGoogle: () => Promise.resolve(makeUserCredential()),
    signInWithEmail: () => Promise.resolve(makeUserCredential()),
    signUpWithEmail: () => Promise.resolve(makeUserCredential()),
    signInAnonymously: () => Promise.resolve(makeUserCredential()),
    linkWithEmail: () => Promise.resolve(makeUserCredential()),
    linkWithGoogle: () => Promise.resolve(makeUserCredential()),
    authStateReady: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    deleteUser: () => Promise.resolve(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AuthService mock
// ---------------------------------------------------------------------------

/**
 * Creates a partial AuthService mock.
 *
 * @param opts.isAnonymous - null = no user, false = real user, true = anonymous/guest
 * @param opts.overrides   - additional property overrides
 *
 * @example
 * // Simple – guest user:
 * const svc = makeAuthServiceMock({ isAnonymous: true });
 *
 * // With spy (Vitest):
 * const svc = makeAuthServiceMock({ overrides: { signInGuestIfNeeded: vitest.fn() } });
 */
export function makeAuthServiceMock(opts?: {
  isAnonymous?: boolean | null;
  overrides?: Record<string, unknown>;
}) {
  const isAnonymous = opts?.isAnonymous ?? false;

  const user: AuthUserShape | null =
    isAnonymous === null
      ? null
      : {
          uid: 'u1',
          email: null,
          displayName: null,
          photoURL: null,
          emailVerified: false,
          providerId: 'unknown',
          isAnonymous: isAnonymous === true,
        };

  return {
    user: (() => user) as Signal<AuthUserShape | null>,
    isAuthenticated: (() => isAnonymous !== null) as Signal<boolean>,
    idToken: (() => null) as Signal<string | null | undefined>,
    userDbSyncState: signal('idle' as const),
    signInWithGoogle: () => Promise.resolve(),
    signInWithEmail: () => Promise.resolve(),
    signUpWithEmail: () => Promise.resolve(),
    signInGuestIfNeeded: () => Promise.resolve(),
    upgradeWithEmail: () => Promise.resolve(),
    upgradeWithGoogle: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    deleteAccount: () => Promise.resolve(),
    ...opts?.overrides,
  };
}

// ---------------------------------------------------------------------------
// AuthStore mock
// ---------------------------------------------------------------------------

/**
 * Creates a plain-object AuthStore mock using Angular signals.
 * Compatible with both @testing-library/angular render() and TestBed.
 *
 * @example
 * { provide: AuthStore, useValue: makeAuthStoreMock({ isAuthenticated: true }) }
 * { provide: AuthStore, useValue: makeAuthStoreMock({ isAuthenticated: true, isGuest: true }) }
 */
export function makeAuthStoreMock(opts?: {
  isAuthenticated?: boolean;
  isGuest?: boolean;
}): { isAuthenticated: Signal<boolean>; isGuest: Signal<boolean> } {
  return {
    isAuthenticated: signal(opts?.isAuthenticated ?? false),
    isGuest: signal(opts?.isGuest ?? false),
  };
}

// ---------------------------------------------------------------------------
// Firebase Auth mock (raw @angular/fire/auth token)
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Firebase Auth token mock.
 * Use with `{ provide: Auth, useValue: makeFirebaseAuthMock() }`.
 *
 * @param opts.currentUser - the currentUser value (default: null)
 * @param opts.authStateReady - mock for authStateReady (default: resolves immediately)
 */
export function makeFirebaseAuthMock(opts?: {
  currentUser?: FirebaseUser | null;
  authStateReady?: () => Promise<void>;
}) {
  return {
    currentUser: opts?.currentUser ?? null,
    authStateReady: opts?.authStateReady ?? (() => Promise.resolve()),
  };
}
