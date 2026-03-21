/**
 * @pu-stats/testing — Shared test utilities for the pushup-stats monorepo.
 *
 * ## Auth mocks
 *   makeAuthAdapterMock(overrides?)  – Partial<AuthAdapter>
 *   makeAuthServiceMock(opts?)       – Partial<AuthService> (opts: isAnonymous, overrides)
 *   makeAuthStoreMock(opts?)         – { isAuthenticated, isGuest } signals
 *   makeFirebaseAuthMock(opts?)      – raw Firebase Auth token stub
 *   makeFirebaseUser(overrides?)     – FirebaseUser-shaped object
 *   makeUserCredential(uid?)         – UserCredential stub
 *
 * ## Data-access mocks
 *   makePushupFirestoreMock(overrides?)  – Partial<PushupFirestoreService>
 *   makeUserConfigMock(overrides?)       – Partial<UserConfigApiService>
 *   makeStatsApiMock(overrides?)         – Partial<StatsApiService>
 *   makeLeaderboardMock(overrides?)      – Partial<LeaderboardService>
 *
 * ## Pushup fixtures
 *   makePushupRecord(overrides?)       – single PushupRecord with defaults
 *   makePushupList(count?, overrides?) – array of PushupRecord
 *
 * ## Usage pattern
 * All factories are framework-agnostic. Inject your framework's spy for tracked calls:
 *
 *   // Jest  (libs/auth, libs/data-access, …)
 *   const svc = makeAuthServiceMock({ overrides: { signInGuestIfNeeded: jest.fn() } });
 *
 *   // Vitest  (web app)
 *   const svc = makeAuthServiceMock({ overrides: { signInGuestIfNeeded: vitest.fn() } });
 */

export * from './lib/auth-mocks';
export * from './lib/data-access-mocks';
export * from './lib/pushup-fixtures';
